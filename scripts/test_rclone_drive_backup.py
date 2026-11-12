#!/usr/bin/env python3
"""Small safety tests for rclone Drive backup manifest validation."""
import importlib.util
import json
import pathlib
import unittest
from unittest.mock import patch

path = pathlib.Path(__file__).with_name("rclone_drive_backup.py")
spec = importlib.util.spec_from_file_location("rclone_drive_backup", path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class TransferTests(unittest.TestCase):
    def test_accepts_valid_completed_manifest(self):
        backup_id = "20261112T120000Z-a1b2c3d4"
        manifest = {
            "format": module.FORMAT,
            "backup_id": backup_id,
            "encrypted": True,
            "archive_name": f"{module.PREFIX}{backup_id}.tar.gz.gpg",
            "bytes": 99,
            "sha256": "a" * 64,
            "md5": "b" * 32,
        }
        with patch.object(module, "run_rclone", return_value=json.dumps(manifest)):
            result = module.read_manifest("greendream:Green Dream Backups", f"{module.PREFIX}{backup_id}.json")
        self.assertEqual(result["backup_id"], backup_id)

    def test_rejects_unencrypted_manifest(self):
        backup_id = "20261112T120000Z-a1b2c3d4"
        manifest = {
            "format": module.FORMAT,
            "backup_id": backup_id,
            "encrypted": False,
            "archive_name": f"{module.PREFIX}{backup_id}.tar.gz.gpg",
            "bytes": 99,
            "sha256": "a" * 64,
            "md5": "b" * 32,
        }
        with patch.object(module, "run_rclone", return_value=json.dumps(manifest)):
            with self.assertRaises(RuntimeError):
                module.read_manifest("greendream:Green Dream Backups", f"{module.PREFIX}{backup_id}.json")

    def test_upload_rejects_missing_archive_before_drive_access(self):
        with patch.object(module, "run_rclone") as call:
            with self.assertRaises(RuntimeError):
                module.upload(type("Args", (), {"archive": pathlib.Path("/missing/archive.gpg")})())
            call.assert_not_called()


if __name__ == "__main__":
    unittest.main()
