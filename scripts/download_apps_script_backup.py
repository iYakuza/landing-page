#!/usr/bin/env python3
"""Download and verify encrypted archives from the private Green Dream Apps Script receiver."""
from __future__ import annotations

import argparse
import base64
import concurrent.futures
import hashlib
import os
import pathlib
import re
import sys
import time
import urllib.error
import urllib.request

import apps_script_transport

MAX_PARTS = 400
BACKUP_ID = re.compile(r"^(?:(?:system|content)-)?[0-9]{8}T[0-9]{6}Z-[a-f0-9]{8}$")
SHA256 = re.compile(r"^[a-f0-9]{64}$")
RETRIES = 2
REQUEST_TIMEOUT_SECONDS = 60
DOWNLOAD_WORKERS = 4
MAX_DOWNLOAD_WORKERS = 8
DOWNLOAD_DEADLINE_SECONDS = 90 * 60
RETRYABLE_HTTP = {408, 429, 500, 502, 503, 504}


def remaining_seconds(deadline: float | None) -> float:
    remaining = deadline - time.monotonic()
    if remaining <= 0:
        raise RuntimeError("The backup download exceeded its 90-minute deadline.")
    return remaining


def post_json(endpoint: str, token: str, payload: dict, deadline: float) -> dict:
    result = apps_script_transport.post_json(
        endpoint, token, payload,
        timeout=min(REQUEST_TIMEOUT_SECONDS, remaining_seconds(deadline)),
        deadline=deadline,
        retries=RETRIES,
    )
    if result.get("ok") is not True:
        raise RuntimeError("The backup receiver rejected the recovery request.")
    return result


def download_one_part(
    endpoint: str,
    token: str,
    backup_id: str,
    number: int,
    part_count: int,
    expected: dict,
    deadline: float,
) -> tuple[int, bytes]:
    """Fetch and verify one part; safe to run concurrently with other part requests."""
    response = post_json(endpoint, token, {
        "action": "download_part", "backup_id": backup_id, "part_number": number,
    }, deadline)
    if (
        response.get("backup_id") != backup_id
        or response.get("part_number") != number
        or response.get("total_parts") != part_count
    ):
        raise RuntimeError(f"The receiver returned mismatched metadata for part {number}.")
    try:
        chunk = base64.b64decode(response.get("content_base64", ""), validate=True)
    except (ValueError, TypeError):
        raise RuntimeError(f"The receiver returned invalid base64 for part {number}.") from None
    digest = hashlib.sha256(chunk).hexdigest()
    if (
        len(chunk) != expected["size"]
        or response.get("size") != len(chunk)
        or digest != expected["sha256"]
        or digest != response.get("sha256")
    ):
        raise RuntimeError(f"Downloaded part {number} failed SHA-256 verification.")
    return number, chunk


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=pathlib.Path)
    parser.add_argument("--backup-id", default="", help="Completed backup ID; legacy untyped IDs must be selected explicitly.")
    parser.add_argument("--backup-type", choices=("system", "content"), default="system", help="Backup type to select when no explicit ID is supplied.")
    parser.add_argument(
        "--workers", type=int, default=DOWNLOAD_WORKERS,
        choices=range(1, MAX_DOWNLOAD_WORKERS + 1),
        help=f"Parallel Drive part downloads (default: {DOWNLOAD_WORKERS}; maximum: {MAX_DOWNLOAD_WORKERS}).",
    )
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
        f"Starting authenticated backup recovery with {args.workers} parallel download workers. "
        f"Each receiver request is capped at {REQUEST_TIMEOUT_SECONDS}s; overall download deadline "
        f"is {DOWNLOAD_DEADLINE_SECONDS // 60} minutes.",
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

    offsets = {}
    current_offset = 0
    for number in range(1, part_count + 1):
        offsets[number] = current_offset
        current_offset += indexed[number]["size"]
    if current_offset != total_bytes:
        raise SystemExit("The backup part offsets do not match the declared archive size.")

    print(
        f"Recovering {args.backup_type} backup {backup_id}: {part_count} parts, "
        f"{total_bytes / (1024 * 1024):.2f} MB. Downloading up to {args.workers} parts "
        "at once; each part is SHA-256 verified before it is written.",
        flush=True,
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    temporary = args.output.with_suffix(args.output.suffix + ".partial")
    written = 0
    completed_parts = 0
    try:
        with temporary.open("w+b") as output:
            output.truncate(total_bytes)
            with concurrent.futures.ThreadPoolExecutor(
                max_workers=min(args.workers, part_count),
                thread_name_prefix="drive-recovery",
            ) as pool:
                futures = {
                    pool.submit(
                        download_one_part, endpoint, token, backup_id,
                        number, part_count, indexed[number], deadline,
                    ): number
                    for number in range(1, part_count + 1)
                }
                try:
                    for future in concurrent.futures.as_completed(futures):
                        number, chunk = future.result()
                        # Only the coordinator writes to the file. Random-access
                        # placement preserves archive order regardless of completion order.
                        output.seek(offsets[number])
                        output.write(chunk)
                        written += len(chunk)
                        completed_parts += 1
                        elapsed = max(time.monotonic() - started_at, 0.001)
                        percent = written / total_bytes * 100
                        speed = written / (1024 * 1024) / elapsed
                        print(
                            f"Recovery progress: {completed_parts}/{part_count} parts | "
                            f"{written / (1024 * 1024):.2f}/{total_bytes / (1024 * 1024):.2f} MB "
                            f"verified ({percent:.1f}%) | {speed:.2f} MB/s | {elapsed:.0f}s elapsed.",
                            flush=True,
                        )
                except Exception:
                    for future in futures:
                        future.cancel()
                    raise
            output.flush()

        if written != total_bytes or completed_parts != part_count:
            raise RuntimeError("The downloaded backup is incomplete.")
        full_hash = hashlib.sha256()
        with temporary.open("rb") as source:
            while True:
                block = source.read(8 * 1024 * 1024)
                if not block:
                    break
                full_hash.update(block)
        actual_archive_sha = full_hash.hexdigest()
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
