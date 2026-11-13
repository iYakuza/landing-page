#!/usr/bin/env python3
"""Test parallel direct-to-Drive resumable upload, integrity checks, resume and finalization."""
import hashlib
import importlib.util
import os
import pathlib
import sys
import tempfile
from unittest.mock import patch

script = pathlib.Path(__file__).with_name("upload_apps_script_backup.py")
spec = importlib.util.spec_from_file_location("upload_backup", script)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

assert module.PART_BYTES == 4 * 1024 * 1024
archive_bytes = b"A" * module.PART_BYTES + b"last-bytes"
archive_sha = hashlib.sha256(archive_bytes).hexdigest()
backup_id = "20261113T000000Z-" + archive_sha[:8]
first = archive_bytes[:module.PART_BYTES]
second = archive_bytes[module.PART_BYTES:]
parts = [
    {"part_number": 1, "size": len(first), "sha256": hashlib.sha256(first).hexdigest()},
    {"part_number": 2, "size": len(second), "sha256": hashlib.sha256(second).hexdigest()},
]
calls = []
uploaded = []

def fake_post(endpoint, token, payload):
    calls.append(payload)
    action = payload["action"]
    if action == "list_upload_parts":
        return {
            "ok": True, "backup_id": backup_id, "total_parts": 2,
            "parts": [{"part_number": 1, "size": len(first), "sha256": parts[0]["sha256"]}],
        }
    if action == "create_upload_sessions":
        assert payload["parts"] == [parts[1]]
        return {
            "ok": True, "backup_id": backup_id, "total_parts": 2,
            "sessions": [{"part_number": 2, "already_present": False, "session_url": "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=test-session"}],
        }
    if action == "finalize_backup":
        assert payload["backup_id"] == backup_id
        assert payload["total_bytes"] == len(archive_bytes)
        assert payload["archive_sha256"] == archive_sha
        return {"ok": True, "backup_id": backup_id, "finalized": True, "total_bytes": len(archive_bytes)}
    raise AssertionError("Unexpected action: " + action)

def fake_put(session_url, chunk, expected_name):
    assert session_url.endswith("test-session")
    assert chunk == second
    assert expected_name.endswith("-part-0002-of-0002.gpgpart")
    uploaded.append(len(chunk))

with tempfile.TemporaryDirectory() as temp:
    archive = pathlib.Path(temp) / "backup.gpg"
    archive.write_bytes(archive_bytes)
    with patch.dict(os.environ, {
        "GOOGLE_DRIVE_INGEST_URL": "https://script.google.com/macros/s/test-deployment/exec",
        "GOOGLE_DRIVE_INGEST_TOKEN": "x" * 48,
    }), patch.object(sys, "argv", [str(script), str(archive)]), \
         patch.object(module, "post_json", fake_post), patch.object(module, "put_chunk", fake_put):
        module.main()

assert [call["action"] for call in calls] == ["list_upload_parts", "create_upload_sessions", "finalize_backup"]
assert calls[1]["parts"] == [parts[1]], "the already stored first part must not be uploaded again"
assert uploaded == [len(second)]
print("Direct Google Drive uploader tests passed.")
