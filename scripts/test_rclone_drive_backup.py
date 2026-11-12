#!/usr/bin/env python3
"""Safety tests for the rclone Drive backup transfer and manifest handling."""
import importlib.util
import json
import pathlib
import tempfile
import unittest
from argparse import Namespace
from unittest.mock import patch

path = pathlib.Path(__file__).with_name("rclone_drive_backup.py")
spec = importlib.util.spec_from_file_location("rclone_drive_backup", path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

BACKUP_ID = "20261112T120000Z-a1b2c3d4"
MANIFEST_NAME = f"{module.PREFIX}{BACKUP_ID}.json"


def valid_manifest(**overrides):
    value = {
        "format": module.FORMAT,
        "backup_id": BACKUP_ID,
        "encrypted": True,
        "archive_name": f"{module.PREFIX}{BACKUP_ID}.tar.gz.gpg",
        "bytes": 99,
        "sha256": "a" * 64,
        "md5": "b" * 32,
    }
    value.update(overrides)
    return value


class TransferTests(unittest.TestCase):
    def test_accepts_valid_completed_manifest(self):
        with patch.object(module, "run_rclone", return_value=json.dumps(valid_manifest())):
            result = module.read_manifest("greendream:Green Dream Backups", MANIFEST_NAME)
        self.assertEqual(result["backup_id"], BACKUP_ID)

    def test_rejects_unencrypted_manifest(self):
        with patch.object(module, "run_rclone", return_value=json.dumps(valid_manifest(encrypted=False))):
            with self.assertRaises(RuntimeError):
                module.read_manifest("greendream:Green Dream Backups", MANIFEST_NAME)

    def test_rejects_non_object_json(self):
        for raw in ("[]", "null", '"manifest"'):
            with self.subTest(raw=raw), patch.object(module, "run_rclone", return_value=raw):
                with self.assertRaises(RuntimeError):
                    module.read_manifest("greendream:Green Dream Backups", MANIFEST_NAME)

    def test_rejects_malformed_json(self):
        with patch.object(module, "run_rclone", return_value="{"):
            with self.assertRaisesRegex(RuntimeError, "valid JSON"):
                module.read_manifest("greendream:Green Dream Backups", MANIFEST_NAME)

    def test_rejects_boolean_byte_count(self):
        with patch.object(module, "run_rclone", return_value=json.dumps(valid_manifest(bytes=True))):
            with self.assertRaises(RuntimeError):
                module.read_manifest("greendream:Green Dream Backups", MANIFEST_NAME)

    def test_rejects_invalid_checksum(self):
        with patch.object(module, "run_rclone", return_value=json.dumps(valid_manifest(sha256="not-a-hash"))):
            with self.assertRaises(RuntimeError):
                module.read_manifest("greendream:Green Dream Backups", MANIFEST_NAME)

    def test_rejects_manifest_filename_path_traversal(self):
        with patch.object(module, "run_rclone") as run:
            with self.assertRaises(RuntimeError):
                module.read_manifest("greendream:Green Dream Backups", "../outside.json")
            run.assert_not_called()

    def test_rejects_missing_archive_before_drive_access(self):
        with patch.object(module, "run_rclone") as run:
            with self.assertRaises(RuntimeError):
                module.upload(Namespace(archive=pathlib.Path("/missing/archive.gpg")))
            run.assert_not_called()

    def test_upload_publishes_manifest_only_after_remote_checksum_matches(self):
        with tempfile.TemporaryDirectory() as temp:
            archive = pathlib.Path(temp) / "archive.gpg"
            archive.write_bytes(b"encrypted test archive")
            with patch.object(module, "run_rclone") as run, patch.object(
                module, "remote_md5", return_value=module.md5_file(archive)
            ):
                module.upload(Namespace(archive=archive))
            commands = [entry.args[0] for entry in run.call_args_list]
            self.assertEqual(commands[0][0], "mkdir")
            self.assertEqual(commands[1][0], "copyto")
            self.assertEqual(commands[2][0], "copyto")
            self.assertTrue(commands[2][1].endswith(".json"))

    def test_upload_does_not_publish_manifest_when_remote_checksum_differs(self):
        with tempfile.TemporaryDirectory() as temp:
            archive = pathlib.Path(temp) / "archive.gpg"
            archive.write_bytes(b"encrypted test archive")
            with patch.object(module, "run_rclone") as run, patch.object(
                module, "remote_md5", return_value="0" * 32
            ):
                with self.assertRaisesRegex(RuntimeError, "MD5 does not match"):
                    module.upload(Namespace(archive=archive))
            commands = [entry.args[0] for entry in run.call_args_list]
            self.assertEqual([command[0] for command in commands], ["mkdir", "copyto"])

    def test_download_rejects_archive_checksum_mismatch(self):
        with tempfile.TemporaryDirectory() as temp:
            destination = pathlib.Path(temp) / "recovery.gpg"
            manifest = valid_manifest(bytes=5, sha256="a" * 64, md5="b" * 32)

            def fake_rclone(args, *, capture=False):
                if args[0] == "cat":
                    return json.dumps(manifest)
                if args[0] == "copyto":
                    pathlib.Path(args[2]).write_bytes(b"wrong")
                    return ""
                raise AssertionError(f"Unexpected rclone command: {args}")

            with patch.object(module, "run_rclone", side_effect=fake_rclone), patch.object(
                module, "sha256_file", return_value="f" * 64
            ), patch.object(module, "md5_file", return_value="e" * 32):
                with self.assertRaisesRegex(RuntimeError, "checksum"):
                    module.download(Namespace(backup_id=BACKUP_ID, output=destination))
            self.assertFalse(destination.exists())
            self.assertFalse(destination.with_name(destination.name + ".partial").exists())


if __name__ == "__main__":
    unittest.main()
