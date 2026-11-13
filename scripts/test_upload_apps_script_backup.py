#!/usr/bin/env python3
"""Test the Apps Script uploader's chunking, retry-safe resume, and finalization."""
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
calls = []

def fake_post(endpoint, token, payload):
    calls.append(payload)
    action = payload["action"]
    if action == "list_upload_parts":
        return {
            "ok": True, "backup_id": backup_id, "total_parts": 2,
            "completed": False,
            "parts": [{"part_number": 1, "size": len(first), "sha256": hashlib.sha256(first).hexdigest()}],
        }
    if action == "upload_part":
        assert payload["part_number"] == 2
        assert payload["content_base64"]
        return {"ok": True, "backup_id": backup_id, "received_part": 2}
    if action == "finalize_backup":
        assert payload["backup_id"] == backup_id
        assert payload["total_bytes"] == len(archive_bytes)
        assert payload["archive_sha256"] == archive_sha
        return {"ok": True, "backup_id": backup_id, "finalized": True, "total_bytes": len(archive_bytes)}
    raise AssertionError("Unexpected action: " + action)

with tempfile.TemporaryDirectory() as temp:
    archive = pathlib.Path(temp) / "backup.gpg"
    archive.write_bytes(archive_bytes)
    with patch.dict(os.environ, {
        "GOOGLE_DRIVE_INGEST_URL": "https://script.google.com/macros/s/test-deployment/exec",
        "GOOGLE_DRIVE_INGEST_TOKEN": "x" * 48,
    }), patch.object(sys, "argv", [str(script), str(archive)]), patch.object(module, "post_json", fake_post):
        module.main()

assert [call["action"] for call in calls] == ["list_upload_parts", "upload_part", "finalize_backup"]
assert calls[1]["part_number"] == 2, "the already stored first part must be skipped"
print("Apps Script uploader tests passed.")
