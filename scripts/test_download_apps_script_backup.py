#!/usr/bin/env python3
"""Exercise encrypted backup download/reassembly with a mocked Apps Script receiver."""
import base64
import hashlib
import importlib.util
import json
import os
import pathlib
import sys
import tempfile
from unittest.mock import patch

script = pathlib.Path(__file__).with_name("download_apps_script_backup.py")
spec = importlib.util.spec_from_file_location("download_backup", script)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

backup_id = "20261112T120000Z-a1b2c3d4"
assert module.MAX_PARTS == 400
chunks = [b"encrypted-part-one", b"encrypted-part-two"]
parts = [
    {"part_number": index + 1, "size": len(chunk), "sha256": hashlib.sha256(chunk).hexdigest()}
    for index, chunk in enumerate(chunks)
]
total = sum(len(chunk) for chunk in chunks)

class FakeResponse:
    def __init__(self, payload):
        self.payload = payload
    def __enter__(self):
        return self
    def __exit__(self, *args):
        return False
    def read(self):
        return self.payload

def fake_urlopen(request, timeout=0):
    payload = json.loads(request.data.decode("utf-8"))
    if payload["action"] == "list_backups":
        result = {"ok": True, "backups": [{
            "backup_id": backup_id, "part_count": len(chunks),
            "total_bytes": total, "parts": parts,
        }]}
    elif payload["action"] == "download_part":
        number = payload["part_number"]
        chunk = chunks[number - 1]
        result = {
            "ok": True, "backup_id": backup_id, "part_number": number,
            "total_parts": len(chunks), "size": len(chunk),
            "sha256": hashlib.sha256(chunk).hexdigest(),
            "content_base64": base64.b64encode(chunk).decode("ascii"),
        }
    else:
        raise AssertionError("Unexpected receiver action")
    return FakeResponse(json.dumps(result).encode("utf-8"))

with tempfile.TemporaryDirectory() as temp:
    output = pathlib.Path(temp) / "backup.gpg"
    with patch.dict(os.environ, {
        "GOOGLE_DRIVE_INGEST_URL": "https://script.google.com/macros/s/test-deployment/exec",
        "GOOGLE_DRIVE_INGEST_TOKEN": "x" * 48,
    }), patch.object(sys, "argv", [str(script), "--output", str(output)]), patch.object(module.urllib.request, "urlopen", fake_urlopen):
        module.main()
    assert output.read_bytes() == b"".join(chunks)

print("Apps Script backup downloader tests passed.")
