#!/usr/bin/env python3
"""Test parallel authenticated recovery download and per-part/whole-archive hashes."""
import base64
import hashlib
import importlib.util
import os
import pathlib
import sys
import tempfile
import threading
import time
from unittest.mock import patch

script = pathlib.Path(__file__).with_name("download_apps_script_backup.py")
spec = importlib.util.spec_from_file_location("download_backup", script)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

assert module.REQUEST_TIMEOUT_SECONDS == 60
assert module.DOWNLOAD_DEADLINE_SECONDS == 90 * 60
assert module.DOWNLOAD_WORKERS == 2
backup_id = "system-20261113T000000Z-a1b2c3d4"
chunks = [b"encrypted-part-one", b"encrypted-part-two"]
whole = b"".join(chunks)
parts = [
    {"part_number": i + 1, "size": len(chunk), "sha256": hashlib.sha256(chunk).hexdigest()}
    for i, chunk in enumerate(chunks)
]
calls = []
active_downloads = 0
max_active_downloads = 0
download_lock = threading.Lock()


def fake_post(endpoint, token, payload, deadline):
    global active_downloads, max_active_downloads
    calls.append(payload)
    assert deadline is not None
    if payload["action"] == "list_backups":
        common = {
            "part_count": len(chunks), "total_bytes": len(whole),
            "archive_sha256": hashlib.sha256(whole).hexdigest(), "parts": parts,
        }
        return {"ok": True, "backups": [
            {"backup_id": "content-20261113T000000Z-b1b2c3d4", **common},
            {"backup_id": backup_id, **common},
        ]}
    if payload["action"] == "download_part":
        number = payload["part_number"]
        with download_lock:
            active_downloads += 1
            max_active_downloads = max(max_active_downloads, active_downloads)
        try:
            # Part 2 finishes first; the output must still be reassembled in order.
            time.sleep(0.05 if number == 1 else 0.01)
            chunk = chunks[number - 1]
            return {
                "ok": True, "backup_id": backup_id, "part_number": number,
                "total_parts": len(chunks), "size": len(chunk),
                "sha256": hashlib.sha256(chunk).hexdigest(),
                "content_base64": base64.b64encode(chunk).decode("ascii"),
            }
        finally:
            with download_lock:
                active_downloads -= 1
    raise AssertionError("Unexpected action")


with tempfile.TemporaryDirectory() as temp:
    output = pathlib.Path(temp) / "backup.gpg"
    with patch.dict(os.environ, {
        "GOOGLE_DRIVE_INGEST_URL": "https://script.google.com/macros/s/test-deployment/exec",
        "GOOGLE_DRIVE_INGEST_TOKEN": "x" * 48,
    }), patch.object(sys, "argv", [str(script), "--output", str(output)]), patch.object(module, "post_json", fake_post):
        module.main()
    assert output.read_bytes() == whole

assert [x["action"] for x in calls].count("list_backups") == 1
assert [x["action"] for x in calls].count("download_part") == 2
assert max_active_downloads >= 2, "recovery downloads should overlap instead of running serially"


# Reject a corrupt part before allowing it into the reconstructed archive.
corrupt_chunk = b"corrupted-part"
def corrupt_post(endpoint, token, payload, deadline):
    return {
        "ok": True, "backup_id": backup_id, "part_number": 1, "total_parts": 2,
        "size": len(corrupt_chunk), "sha256": "0" * 64,
        "content_base64": base64.b64encode(corrupt_chunk).decode("ascii"),
    }

with patch.object(module, "post_json", corrupt_post):
    try:
        module.download_one_part(
            "https://script.google.com/macros/s/test-deployment/exec",
            "x" * 48, backup_id, 1, 2, parts[0], time.monotonic() + 60,
        )
    except RuntimeError as exc:
        assert "SHA-256 verification" in str(exc)
    else:
        raise AssertionError("A corrupt download part must be rejected.")


# Content recovery must select a content archive even when a newer system
# backup is also present in the receiver inventory.
content_id = "content-20261113T000000Z-b1b2c3d4"
content_bytes = b"content-archive-fixture"
content_part = {
    "part_number": 1,
    "size": len(content_bytes),
    "sha256": hashlib.sha256(content_bytes).hexdigest(),
}


def fake_content_post(endpoint, token, payload, deadline):
    if payload["action"] == "list_backups":
        return {"ok": True, "backups": [{
            "backup_id": content_id, "part_count": 1, "total_bytes": len(content_bytes),
            "archive_sha256": hashlib.sha256(content_bytes).hexdigest(), "parts": [content_part],
        }]}
    if payload["action"] == "download_part":
        return {
            "ok": True, "backup_id": content_id, "part_number": 1, "total_parts": 1,
            "size": len(content_bytes), "sha256": content_part["sha256"],
            "content_base64": base64.b64encode(content_bytes).decode("ascii"),
        }
    raise AssertionError("Unexpected content recovery action")


with tempfile.TemporaryDirectory() as temp:
    output = pathlib.Path(temp) / "content-backup.gpg"
    with patch.dict(os.environ, {
        "GOOGLE_DRIVE_INGEST_URL": "https://script.google.com/macros/s/test-deployment/exec",
        "GOOGLE_DRIVE_INGEST_TOKEN": "x" * 48,
    }), patch.object(sys, "argv", [str(script), "--backup-type", "content", "--output", str(output)]), patch.object(module, "post_json", fake_content_post):
        module.main()
    assert output.read_bytes() == content_bytes

print("Parallel Apps Script recovery downloader tests passed.")
