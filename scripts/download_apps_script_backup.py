#!/usr/bin/env python3
"""Download and verify encrypted archives from the private Green Dream Apps Script receiver."""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import pathlib
import re
import sys
import time
import urllib.error
import urllib.request

MAX_PARTS = 400
BACKUP_ID = re.compile(r"^(?:(?:system|content)-)?[0-9]{8}T[0-9]{6}Z-[a-f0-9]{8}$")
SHA256 = re.compile(r"^[a-f0-9]{64}$")
RETRIES = 2
REQUEST_TIMEOUT_SECONDS = 60
DOWNLOAD_DEADLINE_SECONDS = 30 * 60
RETRYABLE_HTTP = {408, 429, 500, 502, 503, 504}


def remaining_seconds(deadline: float | None) -> float:
    remaining = deadline - time.monotonic()
    if remaining <= 0:
        raise RuntimeError("The backup download exceeded its 30-minute deadline.")
    return remaining


def post_json(endpoint: str, token: str, payload: dict, deadline: float) -> dict:
    body = json.dumps({**payload, "token": token}, separators=(",", ":")).encode("utf-8")
    for attempt in range(RETRIES + 1):
        timeout = min(REQUEST_TIMEOUT_SECONDS, remaining_seconds(deadline))
        request = urllib.request.Request(
            endpoint, data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                result = json.loads(response.read().decode("utf-8"))
            if not isinstance(result, dict) or result.get("ok") is not True:
                raise RuntimeError("The backup receiver rejected the recovery request.")
            return result
        except urllib.error.HTTPError as exc:
            if exc.code not in RETRYABLE_HTTP or attempt >= RETRIES:
                raise RuntimeError(f"The backup receiver returned HTTP {exc.code}.") from None
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, UnicodeDecodeError):
            if attempt >= RETRIES:
                raise RuntimeError("The backup receiver request failed after bounded retries.") from None
        time.sleep(min(2 ** attempt, 4, remaining_seconds(deadline)))
    raise RuntimeError("The backup receiver request could not be completed.")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=pathlib.Path)
    parser.add_argument("--backup-id", default="", help="Completed backup ID; legacy untyped IDs must be selected explicitly.")
    parser.add_argument("--backup-type", choices=("system", "content"), default="system", help="Backup type to select when no explicit ID is supplied.")
    args = parser.parse_args()

    endpoint = os.environ.get("GOOGLE_DRIVE_INGEST_URL", "").strip()
    token = os.environ.get("GOOGLE_DRIVE_INGEST_TOKEN", "")
    if not endpoint.startswith("https://script.google.com/macros/s/") or not endpoint.endswith("/exec"):
        raise SystemExit("GOOGLE_DRIVE_INGEST_URL must be a deployed Apps Script web app URL.")
    if len(token) < 40:
        raise SystemExit("GOOGLE_DRIVE_INGEST_TOKEN is missing or too short.")
    if args.backup_id and not BACKUP_ID.fullmatch(args.backup_id):
        raise SystemExit("Invalid backup ID.")

    started_at = time.monotonic()
    deadline = started_at + DOWNLOAD_DEADLINE_SECONDS
    print(
        f"Starting authenticated backup recovery. Each receiver request is capped at "
        f"{REQUEST_TIMEOUT_SECONDS}s; overall download deadline is {DOWNLOAD_DEADLINE_SECONDS // 60} minutes.",
        flush=True,
    )
    listing = post_json(endpoint, token, {"action": "list_backups"}, deadline)
    backups = listing.get("backups")
    if not isinstance(backups, list) or not backups:
        raise SystemExit("No completed backups are available in the private Drive folder.")
    if args.backup_id:
        selected = next((item for item in backups if item.get("backup_id") == args.backup_id), None)
        if args.backup_id.startswith(("system-", "content-")) and not args.backup_id.startswith(args.backup_type + "-"):
            raise SystemExit(f"Backup ID type does not match requested {args.backup_type} recovery.")
    else:
        matching = [
            item for item in backups
            if isinstance(item, dict) and str(item.get("backup_id", "")).startswith(args.backup_type + "-")
        ]
        selected = matching[0] if matching else None
    if not isinstance(selected, dict) or not BACKUP_ID.fullmatch(str(selected.get("backup_id", ""))):
        raise SystemExit(
            f"No completed {args.backup_type} backup was found. "
            "Older untyped backups must be selected explicitly by backup ID."
        )

    backup_id = selected["backup_id"]
    part_count = selected.get("part_count")
    parts = selected.get("parts")
    total_bytes = selected.get("total_bytes")
    archive_sha256 = selected.get("archive_sha256")
    if not isinstance(part_count, int) or not 1 <= part_count <= MAX_PARTS or not isinstance(parts, list) or len(parts) != part_count:
        raise SystemExit("The receiver returned an invalid backup manifest.")
    if not isinstance(total_bytes, int) or total_bytes < 1:
        raise SystemExit("The receiver returned an invalid backup size.")
    if archive_sha256 is not None and (not isinstance(archive_sha256, str) or not SHA256.fullmatch(archive_sha256)):
        raise SystemExit("The receiver returned an invalid archive checksum.")

    indexed = {}
    for item in parts:
        if not isinstance(item, dict):
            raise SystemExit("The receiver returned an invalid part record.")
        number, size, digest = item.get("part_number"), item.get("size"), item.get("sha256")
        if not isinstance(number, int) or not 1 <= number <= part_count or number in indexed:
            raise SystemExit("The receiver returned invalid part numbering.")
        if not isinstance(size, int) or size < 1 or not isinstance(digest, str) or not SHA256.fullmatch(digest):
            raise SystemExit("The receiver returned invalid part integrity metadata.")
        indexed[number] = {"size": size, "sha256": digest}
    if set(indexed) != set(range(1, part_count + 1)) or sum(x["size"] for x in indexed.values()) != total_bytes:
        raise SystemExit("The backup part inventory is incomplete or inconsistent.")

    print(
        f"Recovering {args.backup_type} backup {backup_id}: {part_count} parts, "
        f"{total_bytes / (1024 * 1024):.2f} MB. Verifying each part as it arrives.",
        flush=True,
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    temporary = args.output.with_suffix(args.output.suffix + ".partial")
    full_hash = hashlib.sha256()
    written = 0
    try:
        with temporary.open("wb") as output:
            for number in range(1, part_count + 1):
                response = post_json(endpoint, token, {
                    "action": "download_part", "backup_id": backup_id, "part_number": number,
                }, deadline)
                if response.get("backup_id") != backup_id or response.get("part_number") != number or response.get("total_parts") != part_count:
                    raise RuntimeError("The receiver returned a mismatched backup part.")
                try:
                    chunk = base64.b64decode(response.get("content_base64", ""), validate=True)
                except (ValueError, TypeError):
                    raise RuntimeError("The receiver returned an invalid encoded backup part.") from None
                expected = indexed[number]
                digest = hashlib.sha256(chunk).hexdigest()
                if len(chunk) != expected["size"] or response.get("size") != len(chunk) or digest != expected["sha256"] or digest != response.get("sha256"):
                    raise RuntimeError(f"Downloaded part {number} failed SHA-256 verification.")
                output.write(chunk)
                full_hash.update(chunk)
                written += len(chunk)
                elapsed = max(time.monotonic() - started_at, 0.001)
                percent = written / total_bytes * 100
                print(
                    f"Recovery progress: {number}/{part_count} parts | "
                    f"{written / (1024 * 1024):.2f}/{total_bytes / (1024 * 1024):.2f} MB "
                    f"verified ({percent:.1f}%) | {elapsed:.0f}s elapsed.",
                    flush=True,
                )
        actual_archive_sha = full_hash.hexdigest()
        if written != total_bytes:
            raise RuntimeError("The reassembled encrypted backup has an unexpected size.")
        if archive_sha256 and actual_archive_sha != archive_sha256:
            raise RuntimeError("The reassembled archive SHA-256 does not match the completion manifest.")
        os.replace(temporary, args.output)
    except Exception:
        temporary.unlink(missing_ok=True)
        raise
    elapsed = time.monotonic() - started_at
    print(f"Encrypted backup {backup_id} reassembled and verified: {written} bytes; SHA-256 {actual_archive_sha}", flush=True)
    print(f"Recovery download elapsed: {elapsed:.1f}s.", flush=True)
    print(f"Output: {args.output}", flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Backup download failed: {exc}", file=sys.stderr, flush=True)
        sys.exit(1)
