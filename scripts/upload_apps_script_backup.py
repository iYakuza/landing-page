#!/usr/bin/env python3
"""Send an encrypted backup archive to the private Google Apps Script Drive receiver."""
import base64
import hashlib
import json
import os
import pathlib
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from uuid import uuid4

PART_BYTES = 1 * 1024 * 1024
MAX_PARTS = 400
PREFIX = "greendream-backup-"


def post_json(url, payload):
    request = urllib.request.Request(
        url,
        data=json.dumps(payload, separators=(",", ":")).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            result = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        # Do not include request bodies or tokens in error output.
        raise RuntimeError(f"Backup receiver returned HTTP {exc.code}.") from None
    except (urllib.error.URLError, TimeoutError):
        raise RuntimeError("Could not reach the Google Drive backup receiver.") from None
    if not isinstance(result, dict) or result.get("ok") is not True:
        message = result.get("error", "The receiver rejected the upload.") if isinstance(result, dict) else "Invalid receiver response."
        raise RuntimeError(str(message))
    return result


def main():
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

    backup_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-" + uuid4().hex[:8]
    total_bytes = archive.stat().st_size
    total_parts = (total_bytes + PART_BYTES - 1) // PART_BYTES
    if total_parts > MAX_PARTS:
        raise RuntimeError("Backup is too large for the configured receiver (maximum 400 parts).")

    sent = 0
    with archive.open("rb") as stream:
        for number in range(1, total_parts + 1):
            chunk = stream.read(PART_BYTES)
            digest = hashlib.sha256(chunk).hexdigest()
            result = post_json(endpoint, {
                "action": "upload_part",
                "token": token,
                "backup_id": backup_id,
                "part_number": number,
                "total_parts": total_parts,
                "sha256": digest,
                "content_base64": base64.b64encode(chunk).decode("ascii"),
            })
            if result.get("backup_id") != backup_id or result.get("received_part") != number:
                raise RuntimeError("Receiver acknowledgement did not match the uploaded part.")
            sent += len(chunk)
            print(f"Uploaded encrypted backup part {number}/{total_parts} ({sent}/{total_bytes} bytes).")

    if result.get("finalized") is not True or result.get("received_parts") != total_parts:
        raise RuntimeError("All parts were sent, but the receiver did not finalize the backup set.")
    print(f"Google Drive backup receiver finalized {backup_id} ({total_bytes} encrypted bytes).")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Google Drive backup failed: {exc}", file=sys.stderr)
        sys.exit(1)
