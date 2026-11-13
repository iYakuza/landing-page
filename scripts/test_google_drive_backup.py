import hashlib
import pathlib
import tempfile
import unittest
from unittest.mock import patch
import urllib.error

import google_drive_backup as drive


class Response:
    def __init__(self, body=b"", headers=None):
        self.body = body
        self.headers = headers or {}
    def __enter__(self):
        return self
    def __exit__(self, *args):
        return False
    def read(self, size=-1):
        return self.body


class DriveTransferTests(unittest.TestCase):
    def test_requires_oauth_secrets_without_printing_values(self):
        with patch.dict("os.environ", {}, clear=True):
            with self.assertRaisesRegex(drive.DriveError, "GOOGLE_CLIENT_ID"):
                drive.credentials()

    def test_md5_and_sha256_stream_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = pathlib.Path(tmp) / "sample"
            path.write_bytes(b"Green Dream")
            self.assertEqual(drive.md5_file(path), hashlib.md5(b"Green Dream", usedforsecurity=False).hexdigest())
            self.assertEqual(drive.sha256_file(path), hashlib.sha256(b"Green Dream").hexdigest())

    def test_resumable_upload_verifies_remote_md5_and_size(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = pathlib.Path(tmp) / "archive.gpg"
            path.write_bytes(b"encrypted fixture")
            md5 = drive.md5_file(path)
            calls = []
            def fake_urlopen(req, timeout=0):
                calls.append(req)
                if req.full_url.startswith(drive.UPLOAD_API + "?"):
                    return Response(b"", {"Location": "https://www.googleapis.com/upload/drive/v3/files/session"})
                if req.full_url.endswith("/session"):
                    return Response(
                        ('{"id":"file-1","name":"archive.gpg","size":%d,"md5Checksum":"%s"}' % (path.stat().st_size, md5)).encode()
                    )
                raise AssertionError(req.full_url)
            with patch.object(drive.urllib.request, "urlopen", side_effect=fake_urlopen):
                result = drive.upload_resumable("token", "folder", path)
            self.assertEqual(result["id"], "file-1")
            self.assertEqual(len(calls), 2)
            self.assertTrue(any(key.lower() == "content-range" for key in calls[1].headers))

    def test_rejects_remote_checksum_mismatch(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = pathlib.Path(tmp) / "archive.gpg"
            path.write_bytes(b"encrypted fixture")
            def fake_urlopen(req, timeout=0):
                if req.full_url.startswith(drive.UPLOAD_API):
                    return Response(b"", {"Location": "https://www.googleapis.com/upload/drive/v3/files/session"})
                return Response(b'{"id":"file-1","name":"archive.gpg","size":17,"md5Checksum":"00000000000000000000000000000000"}')
            with patch.object(drive.urllib.request, "urlopen", side_effect=fake_urlopen):
                with self.assertRaisesRegex(drive.DriveError, "MD5 checksum"):
                    drive.upload_resumable("token", "folder", path)

    def test_rejects_unexpected_resumable_session_host(self):
        with patch.object(drive.urllib.request, "urlopen", return_value=Response(b"", {"Location": "https://attacker.invalid/session"})):
            with self.assertRaisesRegex(drive.DriveError, "unexpected resumable"):
                drive.start_resumable_upload("token", {"name": "x"}, 1)


if __name__ == "__main__":
    unittest.main()
