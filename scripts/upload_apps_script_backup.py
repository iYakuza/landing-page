#!/usr/bin/env python3
"""Bounded, observable, resumable direct-to-Drive upload of encrypted backup parts."""
from __future__ import annotations

import concurrent.futures
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
WORKERS = 4
SESSION_BATCH_SIZE = 8
PREFIX = "greendream-backup-"
BACKUP_TYPES = {"system", "content"}
RETRIES = 2
REQUEST_TIMEOUT_SECONDS = 60
UPLOAD_DEADLINE_SECONDS = 15 * 60
HEARTBEAT_SECONDS = 15
RETRYABLE_HTTP = {408, 429, 500, 502, 503, 504}


def remaining_seconds(deadline: float | None) -> float | None:
    if deadline is None:
        return None
    remaining = deadline - time.monotonic()
    if remaining <= 0:
        raise RuntimeError("The Google Drive transfer exceeded its 15-minute deadline.")
    return remaining


def post_json(endpoint: str, token: str, payload: dict, deadline: float | None = None) -> dict:
    body = json.dumps({**payload, "token": token}, separators=(",", ":")).encode("utf-8")
    for attempt in range(RETRIES + 1):
        remaining = remaining_seconds(deadline)
        timeout = REQUEST_TIMEOUT_SECONDS if remaining is None else min(REQUEST_TIMEOUT_SECONDS, remaining)
        request = urllib.request.Request(
            endpoint, data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                result = json.loads(response.read().decode("utf-8"))
            if not isinstance(result, dict) or result.get("ok") is not True:
                message = result.get("error", "Invalid receiver response.") if isinstance(result, dict) else "Invalid receiver response."
                diagnostic = result.get("diagnostic") if isinstance(result, dict) else None
                if isinstance(diagnostic, dict):
                    safe = []
                    for key in ("stage", "type", "detail"):
                        value = diagnostic.get(key)
                        if isinstance(value, str):
                            safe.append(key + "=" + value[:240])
                    if safe:
                        message = str(message) + " (" + "; ".join(safe) + ")"
                raise RuntimeError(str(message))
            return result
        except urllib.error.HTTPError as exc:
            if exc.code not in RETRYABLE_HTTP or attempt >= RETRIES:
                raise RuntimeError(f"Backup receiver returned HTTP {exc.code}.") from None
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, UnicodeDecodeError):
            if attempt >= RETRIES:
                raise RuntimeError("The backup receiver request failed after bounded retries.") from None
        remaining = remaining_seconds(deadline)
        time.sleep(min(2 ** attempt, 4, remaining if remaining is not None else 4))
    raise RuntimeError("The backup receiver request could not be completed.")


def create_sessions(endpoint: str, token: str, backup_id: str, total_parts: int,
                    parts: list[dict], deadline: float | None = None) -> dict[int, dict]:
    response = post_json(endpoint, token, {
        "action": "create_upload_sessions",
        "backup_id": backup_id,
        "total_parts": total_parts,
        "parts": parts,
    }, deadline=deadline)
    if response.get("backup_id") != backup_id or response.get("total_parts") != total_parts:
        raise RuntimeError("Drive returned mismatched upload session metadata.")
    sessions = response.get("sessions")
    if not isinstance(sessions, list) or len(sessions) != len(parts):
        raise RuntimeError("Drive returned an incomplete upload session inventory.")
    indexed = {}
    expected = {item["part_number"] for item in parts}
    for item in sessions:
        if not isinstance(item, dict):
            raise RuntimeError("Drive returned an invalid upload session record.")
        number = item.get("part_number")
        if not isinstance(number, int) or number not in expected or number in indexed:
            raise RuntimeError("Drive returned invalid upload session numbering.")
        if item.get("already_present") is True:
            indexed[number] = {"already_present": True}
        else:
            url = item.get("session_url")
            if not isinstance(url, str) or not url.startswith("https://www.googleapis.com/upload/drive/v3/files?"):
                raise RuntimeError("Drive returned an invalid resumable upload URL.")
            indexed[number] = {"already_present": False, "session_url": url}
    if set(indexed) != expected:
        raise RuntimeError("Drive returned an incomplete upload session inventory.")
    return indexed


def create_sessions_batched(endpoint: str, token: str, backup_id: str, total_parts: int,
                            parts: list[dict], deadline: float) -> dict[int, dict]:
    """Keep each Apps Script fetchAll burst small and report session preparation progress."""
    sessions: dict[int, dict] = {}
    for offset in range(0, len(parts), SESSION_BATCH_SIZE):
        batch = parts[offset:offset + SESSION_BATCH_SIZE]
        batch_number = offset // SESSION_BATCH_SIZE + 1
        batch_total = (len(parts) + SESSION_BATCH_SIZE - 1) // SESSION_BATCH_SIZE
        print(
            f"Preparing Drive upload sessions: batch {batch_number}/{batch_total} "
            f"({min(offset + len(batch), len(parts))}/{len(parts)} parts).",
            flush=True,
        )
        sessions.update(create_sessions(endpoint, token, backup_id, total_parts, batch, deadline))
    return sessions


class RetryableUploadError(RuntimeError):
    """A Drive upload failure for which querying or retrying the same session is safe."""


class ExpiredUploadSessionError(RetryableUploadError):
    """The Drive resumable session expired and must be recreated."""


def verify_upload_confirmation(body: bytes, expected_name: str, expected_size: int) -> None:
    try:
        result = json.loads(body.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError):
        raise RuntimeError("Google Drive returned an invalid upload confirmation.") from None
    if result.get("name") != expected_name or int(result.get("size", -1)) != expected_size:
        raise RuntimeError("Google Drive upload confirmation did not match the expected part.")


def put_chunk(session_url: str, chunk: bytes, expected_name: str, timeout: float,
              start: int = 0, total_size: int | None = None) -> None:
    total = total_size if total_size is not None else len(chunk)
    end = start + len(chunk) - 1
    request = urllib.request.Request(
        session_url,
        data=chunk,
        headers={
            "Content-Type": "application/octet-stream",
            "Content-Length": str(len(chunk)),
            "Content-Range": f"bytes {start}-{end}/{total}",
        },
        method="PUT",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            status = response.status
            body = response.read()
    except urllib.error.HTTPError as exc:
        if exc.code in (404, 410):
            raise ExpiredUploadSessionError(f"Google Drive upload session expired (HTTP {exc.code}).") from None
        if exc.code in RETRYABLE_HTTP or exc.code == 308:
            raise RetryableUploadError(f"Google Drive upload returned HTTP {exc.code}.") from None
        raise RuntimeError(f"Google Drive upload returned HTTP {exc.code}.") from None
    if status == 308:
        raise RetryableUploadError("Google Drive accepted an incomplete upload response.")
    if status not in (200, 201):
        raise RuntimeError(f"Google Drive did not complete the part upload (HTTP {status}).")
    verify_upload_confirmation(body, expected_name, total)


def query_upload_status(session_url: str, total_size: int, expected_name: str,
                        timeout: float) -> dict:
    """Ask Drive how much of this exact resumable session it has received."""
    request = urllib.request.Request(
        session_url,
        data=b"",
        headers={
            "Content-Length": "0",
            "Content-Range": f"bytes */{total_size}",
        },
        method="PUT",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            status = response.status
            headers = response.headers
            body = response.read()
    except urllib.error.HTTPError as exc:
        status = exc.code
        headers = exc.headers
        body = exc.read()
    if status in (200, 201):
        verify_upload_confirmation(body, expected_name, total_size)
        return {"complete": True, "offset": total_size}
    if status == 404 or status == 410:
        raise ExpiredUploadSessionError(f"Google Drive upload session expired (HTTP {status}).")
    if status in RETRYABLE_HTTP:
        raise RetryableUploadError(f"Google Drive upload-status query returned HTTP {status}.")
    if status != 308:
        raise RuntimeError(f"Google Drive returned an unexpected upload-status response (HTTP {status}).")

    received = headers.get("Range") if headers else None
    if not received:
        offset = 0
    else:
        import re
        match = re.fullmatch(r"bytes=0-(\d+)", str(received).strip())
        if not match:
            raise RuntimeError("Google Drive returned an invalid resumable-upload byte range.")
        offset = int(match.group(1)) + 1
    if offset < 0 or offset > total_size:
        raise RuntimeError("Google Drive returned an out-of-range resumable-upload position.")
    return {"complete": False, "offset": offset}


def upload_one(archive: pathlib.Path, endpoint: str, token: str, backup_id: str,
               total_parts: int, part: dict, session_url: str,
               deadline: float) -> tuple[int, bool]:
    number = part["part_number"]
    offset = (number - 1) * PART_BYTES
    expected_name = f"{PREFIX}{backup_id}-part-{number:04d}-of-{total_parts:04d}.gpgpart"
    with archive.open("rb") as stream:
        stream.seek(offset)
        chunk = stream.read(part["size"])
    if len(chunk) != part["size"] or hashlib.sha256(chunk).hexdigest() != part["sha256"]:
        raise RuntimeError(f"Local archive part {number} changed after its checksum was calculated.")

    current_session = session_url
    next_offset = 0
    needs_status_query = False
    for attempt in range(RETRIES + 1):
        remaining = remaining_seconds(deadline)
        if needs_status_query:
            try:
                state = query_upload_status(
                    current_session, len(chunk), expected_name,
                    min(REQUEST_TIMEOUT_SECONDS, remaining),
                )
                if state["complete"]:
                    return number, True
                next_offset = state["offset"]
                if next_offset == len(chunk):
                    raise RuntimeError("Drive reports all bytes received without confirming file completion.")
                needs_status_query = False
                if next_offset:
                    print(
                        f"Part {number}: resuming the same Drive session at byte "
                        f"{next_offset}/{len(chunk)}.",
                        flush=True,
                    )
            except ExpiredUploadSessionError:
                refreshed = create_sessions(endpoint, token, backup_id, total_parts, [part], deadline)
                if refreshed[number]["already_present"]:
                    return number, False
                current_session = refreshed[number]["session_url"]
                next_offset = 0
                needs_status_query = False
                print(f"Part {number}: expired session replaced; restarting this part.", flush=True)
            except (urllib.error.URLError, TimeoutError, RetryableUploadError) as status_exc:
                if attempt >= RETRIES:
                    raise RuntimeError(
                        f"Part {number} could not query its Drive session after bounded retries "
                        f"({type(status_exc).__name__})."
                    ) from None
                print(
                    f"Part {number}: session status is temporarily unavailable "
                    f"({type(status_exc).__name__}); checking again without resending bytes.",
                    flush=True,
                )
                time.sleep(min(2 ** attempt, 4, remaining_seconds(deadline)))
                continue

        try:
            put_chunk(
                current_session, chunk[next_offset:], expected_name,
                min(REQUEST_TIMEOUT_SECONDS, remaining_seconds(deadline)),
                start=next_offset, total_size=len(chunk),
            )
            return number, True
        except (urllib.error.URLError, TimeoutError, RetryableUploadError) as exc:
            if attempt >= RETRIES:
                raise RuntimeError(
                    f"Part {number} failed after {RETRIES + 1} bounded attempts ({type(exc).__name__})."
                ) from None
            needs_status_query = True
            print(
                f"Part {number}: attempt {attempt + 1}/{RETRIES + 1} did not complete "
                f"({type(exc).__name__}); checking the existing Drive session before retrying.",
                flush=True,
            )
            time.sleep(min(2 ** attempt, 4, remaining_seconds(deadline)))
    raise RuntimeError(f"Part {number} could not be uploaded.")


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

    backup_type = os.environ.get("BACKUP_TYPE", "system").strip().lower()
    if backup_type not in BACKUP_TYPES:
        raise RuntimeError("BACKUP_TYPE must be either 'system' or 'content'.")

    started_at = time.monotonic()
    print(
        f"Preparing {backup_type} backup upload: {total_bytes / (1024 * 1024):.2f} MB across "
        f"{total_parts} parts; {WORKERS} parallel transfers. Each request is capped at "
        f"{REQUEST_TIMEOUT_SECONDS}s; transfer deadline is {UPLOAD_DEADLINE_SECONDS // 60} minutes.",
        flush=True,
    )

    parts = []
    archive_digest = hashlib.sha256()
    with archive.open("rb") as stream:
        while True:
            chunk = stream.read(PART_BYTES)
            if not chunk:
                break
            parts.append({
                "part_number": len(parts) + 1,
                "size": len(chunk),
                "sha256": hashlib.sha256(chunk).hexdigest(),
            })
            archive_digest.update(chunk)
    archive_sha256 = archive_digest.hexdigest()
    if len(parts) != total_parts:
        raise RuntimeError("Archive changed while its checksums were being calculated.")

    backup_id = backup_type + "-" + datetime.now(timezone.utc).strftime("%Y%m%dT000000Z") + "-" + archive_sha256[:8]
    print("Checking previously stored parts...", flush=True)
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
        expected = parts[number - 1]
        if (size, digest) != (expected["size"], expected["sha256"]):
            raise RuntimeError(f"Stored part {number} conflicts with this archive; refusing to overwrite it.")
        existing[number] = True

    missing = [part for part in parts if part["part_number"] not in existing]
    deadline = time.monotonic() + UPLOAD_DEADLINE_SECONDS
    print(
        f"Already verified: {len(existing)}/{total_parts} parts. "
        f"Initialising {len(missing)} remaining upload sessions.",
        flush=True,
    )
    session_map = create_sessions_batched(endpoint, token, backup_id, total_parts, missing, deadline) if missing else {}

    completed = set(existing)
    uploaded_this_run = 0
    for number, session in session_map.items():
        if session["already_present"]:
            completed.add(number)
    pending = [part for part in missing if part["part_number"] not in completed]

    if pending:
        with concurrent.futures.ThreadPoolExecutor(max_workers=WORKERS) as pool:
            futures = {
                pool.submit(
                    upload_one, archive, endpoint, token, backup_id, total_parts,
                    part, session_map[part["part_number"]]["session_url"], deadline,
                ): part
                for part in pending
            }
            while futures:
                remaining = remaining_seconds(deadline)
                done, _ = concurrent.futures.wait(
                    tuple(futures),
                    timeout=min(HEARTBEAT_SECONDS, remaining),
                    return_when=concurrent.futures.FIRST_COMPLETED,
                )
                if not done:
                    active = ", ".join(str(part["part_number"]) for part in futures.values())
                    elapsed = time.monotonic() - started_at
                    print(
                        f"Heartbeat: {len(completed)}/{total_parts} parts verified; "
                        f"{len(futures)} transfers active (parts {active}); {elapsed:.0f}s elapsed.",
                        flush=True,
                    )
                    continue
                for future in done:
                    part = futures.pop(future)
                    number, newly_uploaded = future.result()
                    completed.add(number)
                    if newly_uploaded:
                        uploaded_this_run += part["size"]
                    verified_bytes = sum(parts[n - 1]["size"] for n in completed)
                    elapsed = max(time.monotonic() - started_at, 0.001)
                    percent = verified_bytes / total_bytes * 100
                    speed = uploaded_this_run / (1024 * 1024) / elapsed
                    print(
                        f"Progress: {len(completed)}/{total_parts} parts | "
                        f"{verified_bytes / (1024 * 1024):.2f}/{total_bytes / (1024 * 1024):.2f} MB verified "
                        f"({percent:.1f}%) | {speed:.2f} MB/s transferred | {elapsed:.0f}s elapsed.",
                        flush=True,
                    )

    print("All parts are present. Asking Drive to verify and commit the backup manifest...", flush=True)
    final = post_json(endpoint, token, {
        "action": "finalize_backup",
        "backup_id": backup_id,
        "total_parts": total_parts,
        "total_bytes": total_bytes,
        "archive_sha256": archive_sha256,
    })
    if final.get("backup_id") != backup_id or final.get("finalized") is not True or final.get("total_bytes") != total_bytes:
        raise RuntimeError("Receiver did not confirm a complete, verified backup.")
    elapsed = max(time.monotonic() - started_at, 0.001)
    print(f"Google Drive backup complete: {backup_id}; {total_bytes} bytes; {total_parts} verified parts.", flush=True)
    print(f"Archive SHA-256: {archive_sha256}", flush=True)
    print(f"Direct Drive transfer elapsed: {elapsed:.1f}s.", flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Google Drive backup failed: {exc}", file=sys.stderr, flush=True)
        sys.exit(1)
