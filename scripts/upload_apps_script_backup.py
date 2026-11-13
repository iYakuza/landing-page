#!/usr/bin/env python3
"""Resumable, integrity-checked upload to the private Green Dream Apps Script receiver."""
from __future__ import annotations

import base64
import hashlib
import json
import os
import pathlib
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

PART_BYTES = 4 * 1024 * 1024
MAX_PARTS = 400
PREFIX = "greendream-backup-"
RETRIES = 5
RETRYABLE_HTTP = {429, 500, 502, 503, 504}


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def post_json(endpoint: str, token: str, payload: dict) -> dict:
    body = json.dumps({**payload, "token": token}, separators=(",", ":")).encode("utf-8")
    for attempt in range(RETRIES + 1):
        request = urllib.request.Request(
            endpoint, data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=240) as response:
                result = json.loads(response.read().decode("utf-8"))
            if not isinstance(result, dict) or result.get("ok") is not True:
                message = result.get("error", "Invalid receiver response.") if isinstance(result, dict) else "Invalid receiver response."
                diagnostic = result.get("diagnostic") if isinstance(result, dict) else None
                if isinstance(diagnostic, dict):
                    stage = diagnostic.get("stage")
                    error_type = diagnostic.get("type")
                    detail = diagnostic.get("detail")
                    safe = []
                    if isinstance(stage, str):
                        safe.append("stage=" + stage[:100])
                    if isinstance(error_type, str):
                        safe.append("type=" + error_type[:60])
                    if isinstance(detail, str):
                        safe.append("detail=" + detail[:240])
                    if safe:
                        message = str(message) + " (" + "; ".join(safe) + ")"
                raise RuntimeError(str(message))
            return result
        except urllib.error.HTTPError as exc:
            if exc.code not in RETRYABLE_HTTP or attempt >= RETRIES:
                raise RuntimeError(f"Backup receiver returned HTTP {exc.code}.") from None
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, UnicodeDecodeError):
            if attempt >= RETRIES:
                raise RuntimeError("The backup receiver request failed after repeated retries.") from None
        time.sleep(min(2 ** attempt, 20))
    raise RuntimeError("The backup receiver request could not be completed.")


def main() -> None:
    if len(sys.argv) != 2:
        raise RuntimeError("Usage: upload_apps_script_backup.py <encrypted-archive>")
    archive = pathlib.Path(sys.argv[1])
    if not archive.is_file() or archive.stat().st_size <= 0:
        raise RuntimeError("Encrypted backup archive does not exist or is empty.")

    endpoint = os.environ.get("GOOGLE_DRIVE_INGEST_URL", "").strip()
    token = os.environ.get("GOOGLE_DRIVE_INGEST_TOKEN", "")
    if not endpoint.startswith("https://script.google.com/macros/s/") or not endpoint.endswith("/exec"):
        raise RuntimeError("GOOGLE_DRIVE_INGEST_URL must be the deployed Apps Script web app URL.")
    if len(token) < 40:
        raise RuntimeError("GOOGLE_DRIVE_INGEST_TOKEN must contain at least 40 characters.")

    total_bytes = archive.stat().st_size
    total_parts = (total_bytes + PART_BYTES - 1) // PART_BYTES
    if total_parts > MAX_PARTS:
        raise RuntimeError(f"Backup is too large: {total_parts} parts exceeds the {MAX_PARTS}-part receiver limit.")

    archive_digest = hashlib.sha256()
    with archive.open("rb") as stream:
        for block in iter(lambda: stream.read(4 * 1024 * 1024), b""):
            archive_digest.update(block)
    archive_sha256 = archive_digest.hexdigest()

    # Stable for the same archive on the same UTC day, allowing a cancelled run to resume.
    backup_id = datetime.now(timezone.utc).strftime("%Y%m%dT000000Z") + "-" + archive_sha256[:8]
    state = post_json(endpoint, token, {
        "action": "list_upload_parts", "backup_id": backup_id, "total_parts": total_parts,
    })
    if state.get("backup_id") != backup_id or state.get("total_parts") != total_parts:
        raise RuntimeError("Receiver returned mismatched upload state.")
    existing = {}
    for item in state.get("parts", []):
        if not isinstance(item, dict):
            raise RuntimeError("Receiver returned an invalid existing-part record.")
        number, size, digest = item.get("part_number"), item.get("size"), item.get("sha256")
        if not isinstance(number, int) or not 1 <= number <= total_parts or number in existing:
            raise RuntimeError("Receiver returned invalid existing part numbering.")
        if not isinstance(size, int) or size < 1 or not isinstance(digest, str) or len(digest) != 64:
            raise RuntimeError("Receiver returned invalid existing part integrity data.")
        existing[number] = (size, digest)

    uploaded_bytes = 0
    skipped = 0
    with archive.open("rb") as stream:
        for number in range(1, total_parts + 1):
            chunk = stream.read(PART_BYTES)
            digest = sha256_bytes(chunk)
            uploaded_bytes += len(chunk)
            previous = existing.get(number)
            if previous:
                if previous != (len(chunk), digest):
                    raise RuntimeError(f"Stored part {number} conflicts with this archive; refusing to overwrite it.")
                skipped += 1
                print(f"Already stored: part {number}/{total_parts} ({uploaded_bytes}/{total_bytes} bytes).")
                continue
            result = post_json(endpoint, token, {
                "action": "upload_part",
                "backup_id": backup_id,
                "part_number": number,
                "total_parts": total_parts,
                "sha256": digest,
                "content_base64": base64.b64encode(chunk).decode("ascii"),
            })
            if result.get("backup_id") != backup_id or result.get("received_part") != number:
                raise RuntimeError("Receiver acknowledgement did not match the uploaded part.")
            print(f"Stored encrypted part {number}/{total_parts} ({uploaded_bytes}/{total_bytes} bytes).")

    final = post_json(endpoint, token, {
        "action": "finalize_backup",
        "backup_id": backup_id,
        "total_parts": total_parts,
        "total_bytes": total_bytes,
        "archive_sha256": archive_sha256,
    })
    if final.get("backup_id") != backup_id or final.get("finalized") is not True or final.get("total_bytes") != total_bytes:
        raise RuntimeError("Receiver did not confirm a complete, verified backup.")
    print(f"Google Drive backup complete: {backup_id}; {total_bytes} bytes; {total_parts} parts; {skipped} parts resumed.")
    print(f"Archive SHA-256: {archive_sha256}")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Google Drive backup failed: {exc}", file=sys.stderr)
        sys.exit(1)
