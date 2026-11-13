#!/usr/bin/env python3
"""Test bounded authenticated recovery download and per-part/whole-archive hashes."""
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

assert module.REQUEST_TIMEOUT_SECONDS == 60
assert module.DOWNLOAD_DEADLINE_SECONDS == 30 * 60
backup_id = "system-20261113T000000Z-a1b2c3d4"
chunks = [b"encrypted-part-one", b"encrypted-part-two"]
whole = b"".join(chunks)
parts = [
    {"part_number": i + 1, "size": len(chunk), "sha256": hashlib.sha256(chunk).hexdigest()}
    for i, chunk in enumerate(chunks)
]
calls = []

def fake_post(endpoint, token, payload, deadline):
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
print("Bounded Apps Script recovery downloader tests passed.")
