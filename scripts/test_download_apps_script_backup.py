#!/usr/bin/env python3
"""Test authenticated Apps Script download, per-part hashes, and whole-archive hash."""
import base64
import hashlib
import importlib.util
import os
import pathlib
import sys
import tempfile
from unittest.mock import patch

script = pathlib.Path(__file__).with_name("download_apps_script_backup.py")
spec = importlib.util.spec_from_file_location("download_backup", script)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

backup_id = "20261113T000000Z-a1b2c3d4"
chunks = [b"encrypted-part-one", b"encrypted-part-two"]
whole = b"".join(chunks)
parts = [
    {"part_number": i + 1, "size": len(chunk), "sha256": hashlib.sha256(chunk).hexdigest()}
    for i, chunk in enumerate(chunks)
]
calls = []

def fake_post(endpoint, token, payload):
    calls.append(payload)
    if payload["action"] == "list_backups":
        return {"ok": True, "backups": [{
            "backup_id": backup_id, "part_count": len(chunks), "total_bytes": len(whole),
            "archive_sha256": hashlib.sha256(whole).hexdigest(), "parts": parts,
        }]}
    if payload["action"] == "download_part":
        number = payload["part_number"]
        chunk = chunks[number - 1]
        return {
            "ok": True, "backup_id": backup_id, "part_number": number,
            "total_parts": len(chunks), "size": len(chunk),
            "sha256": hashlib.sha256(chunk).hexdigest(),
            "content_base64": base64.b64encode(chunk).decode("ascii"),
        }
    raise AssertionError("Unexpected action")

with tempfile.TemporaryDirectory() as temp:
    output = pathlib.Path(temp) / "backup.gpg"
    with patch.dict(os.environ, {
        "GOOGLE_DRIVE_INGEST_URL": "https://script.google.com/macros/s/test-deployment/exec",
        "GOOGLE_DRIVE_INGEST_TOKEN": "x" * 48,
    }), patch.object(sys, "argv", [str(script), "--output", str(output)]), patch.object(module, "post_json", fake_post):
        module.main()
    assert output.read_bytes() == whole

assert [x["action"] for x in calls] == ["list_backups", "download_part", "download_part"]
print("Apps Script downloader tests passed.")
