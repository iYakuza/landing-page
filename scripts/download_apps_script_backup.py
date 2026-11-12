#!/usr/bin/env python3
"""Download, reassemble, and verify an encrypted backup from the Apps Script receiver."""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import pathlib
import re
import sys
import urllib.error
import urllib.request

BACKUP_ID = re.compile(r"^[0-9]{8}T[0-9]{6}Z-[a-f0-9]{8}$")
SHA256 = re.compile(r"^[a-f0-9]{64}$")

def post_json(url: str, payload: dict) -> dict:
    request = urllib.request.Request(
        url,
        data=json.dumps(payload, separators=(",", ":")).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            result = json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, UnicodeDecodeError):
        raise RuntimeError("The authenticated backup receiver request failed.") from None
    if not isinstance(result, dict) or result.get("ok") is not True:
        raise RuntimeError("The backup receiver rejected the recovery request.")
    return result

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=pathlib.Path)
    parser.add_argument("--backup-id", default="", help="Completed backup ID; defaults to the newest completed backup.")
    args = parser.parse_args()

    endpoint = os.environ.get("GOOGLE_DRIVE_INGEST_URL", "")
    token = os.environ.get("GOOGLE_DRIVE_INGEST_TOKEN", "")
    if not endpoint.startswith("https://script.google.com/macros/s/") or not endpoint.endswith("/exec"):
        raise SystemExit("GOOGLE_DRIVE_INGEST_URL must be a deployed Apps Script web app URL.")
    if len(token) < 40:
        raise SystemExit("GOOGLE_DRIVE_INGEST_TOKEN is missing or too short.")
    if args.backup_id and not BACKUP_ID.fullmatch(args.backup_id):
        raise SystemExit("Invalid backup ID.")

    listing = post_json(endpoint, {"action": "list_backups", "token": token})
    backups = listing.get("backups")
    if not isinstance(backups, list) or not backups:
        raise SystemExit("No completed backups are available in the private Drive folder.")
    selected = next((item for item in backups if item.get("backup_id") == args.backup_id), None) if args.backup_id else backups[0]
    if not isinstance(selected, dict) or not BACKUP_ID.fullmatch(str(selected.get("backup_id", ""))):
        raise SystemExit("The selected completed backup was not found.")
    backup_id = selected["backup_id"]
    part_count = selected.get("part_count")
    parts = selected.get("parts")
    total_bytes = selected.get("total_bytes")
    if not isinstance(part_count, int) or not 1 <= part_count <= 100 or not isinstance(parts, list) or len(parts) != part_count:
        raise SystemExit("The receiver returned an invalid backup manifest.")
    if not isinstance(total_bytes, int) or total_bytes < 1:
        raise SystemExit("The receiver returned an invalid backup size.")

    indexed = {}
    for item in parts:
        if not isinstance(item, dict):
            raise SystemExit("The receiver returned an invalid part record.")
        number = item.get("part_number")
        size = item.get("size")
        digest = item.get("sha256")
        if not isinstance(number, int) or not 1 <= number <= part_count or number in indexed:
            raise SystemExit("The receiver returned invalid part numbering.")
        if not isinstance(size, int) or size < 1 or not isinstance(digest, str) or not SHA256.fullmatch(digest):
            raise SystemExit("The receiver returned invalid part integrity metadata.")
        indexed[number] = {"size": size, "sha256": digest}
    if set(indexed) != set(range(1, part_count + 1)) or sum(x["size"] for x in indexed.values()) != total_bytes:
        raise SystemExit("The backup part inventory is incomplete or inconsistent.")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    temporary = args.output.with_suffix(args.output.suffix + ".partial")
    full_hash = hashlib.sha256()
    written = 0
    try:
        with temporary.open("wb") as output:
            for number in range(1, part_count + 1):
                response = post_json(endpoint, {
                    "action": "download_part", "token": token,
                    "backup_id": backup_id, "part_number": number,
                })
                if response.get("backup_id") != backup_id or response.get("part_number") != number or response.get("total_parts") != part_count:
                    raise RuntimeError("The receiver returned a mismatched backup part.")
                try:
                    chunk = base64.b64decode(response.get("content_base64", ""), validate=True)
                except (ValueError, TypeError):
                    raise RuntimeError("The receiver returned an invalid encoded backup part.") from None
                expected = indexed[number]
                digest = hashlib.sha256(chunk).hexdigest()
                if len(chunk) != expected["size"] or response.get("size") != len(chunk) or digest != expected["sha256"] or digest != response.get("sha256"):
                    raise RuntimeError("A downloaded backup part failed SHA-256 verification.")
                output.write(chunk)
                full_hash.update(chunk)
                written += len(chunk)
                print(f"Verified and downloaded part {number}/{part_count} ({written}/{total_bytes} bytes).")
        if written != total_bytes:
            raise RuntimeError("The reassembled encrypted backup has an unexpected size.")
        os.replace(temporary, args.output)
    except Exception:
        temporary.unlink(missing_ok=True)
        raise
    print(f"Encrypted backup {backup_id} reassembled and verified: {written} bytes; SHA-256 {full_hash.hexdigest()}")
    print(f"Output: {args.output}")

if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Backup download failed: {exc}", file=sys.stderr)
        sys.exit(1)
