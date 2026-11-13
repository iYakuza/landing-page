#!/usr/bin/env python3
"""Test bounded parallel Drive upload, checksums, resume, progress and finalization."""
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
assert module.REQUEST_TIMEOUT_SECONDS == 60
assert module.UPLOAD_DEADLINE_SECONDS == 15 * 60
assert module.HEARTBEAT_SECONDS == 15
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

def fake_post(endpoint, token, payload, deadline=None):
    calls.append(payload)
    action = payload["action"]
    if action == "list_upload_parts":
        return {
            "ok": True, "backup_id": backup_id, "total_parts": 2,
            "parts": [{"part_number": 1, "size": len(first), "sha256": parts[0]["sha256"]}],
        }
    if action == "create_upload_sessions":
        assert payload["parts"] == [parts[1]]
        assert deadline is not None
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

def fake_put(session_url, chunk, expected_name, timeout):
    assert session_url.endswith("test-session")
    assert chunk == second
    assert expected_name.endswith("-part-0002-of-0002.gpgpart")
    assert 0 < timeout <= module.REQUEST_TIMEOUT_SECONDS
    uploaded.append(len(chunk))


# A real Drive resumable PUT must declare the byte range, even when a whole
# part is sent in one request.
class FakeResponse:
    status = 201
    def __enter__(self):
        return self
    def __exit__(self, *args):
        return False
    def read(self):
        return b'{"name":"expected-part.gpgpart","size":"6"}'

captured = {}
def fake_urlopen(request, timeout):
    captured["request"] = request
    captured["timeout"] = timeout
    return FakeResponse()

with patch.object(module.urllib.request, "urlopen", fake_urlopen):
    module.put_chunk(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=test",
        b"abcdef",
        "expected-part.gpgpart",
        module.REQUEST_TIMEOUT_SECONDS,
    )
request = captured["request"]
assert request.get_method() == "PUT"
assert request.get_header("Content-range") == "bytes 0-5/6"
assert request.get_header("Content-length") == "6"
assert captured["timeout"] == 60

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
# Session creation is deliberately batched so Apps Script never receives one
# oversized fetchAll burst for the entire archive.
batch_sizes = []
def fake_create_sessions(endpoint, token, backup, total, batch, deadline):
    batch_sizes.append(len(batch))
    return {item["part_number"]: {"already_present": True} for item in batch}

many_parts = [{"part_number": i + 1, "size": 1, "sha256": "a" * 64} for i in range(17)]
with patch.object(module, "create_sessions", fake_create_sessions):
    batched = module.create_sessions_batched("endpoint", "token", "backup", 17, many_parts, module.time.monotonic() + 60)
assert batch_sizes == [8, 8, 1]
assert set(batched) == set(range(1, 18))

print("Bounded direct Google Drive uploader tests passed.")
