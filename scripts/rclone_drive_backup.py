#!/usr/bin/env python3
"""Upload and recover encrypted Green Dream archives with rclone's Google Drive backend.

The OAuth configuration is supplied as an ephemeral rclone config file by GitHub Actions.
Only uniquely named encrypted archives and small JSON manifests are written to Drive.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from uuid import uuid4

PREFIX = "greendream-content-"
BACKUP_ID_RE = re.compile(r"^[0-9]{8}T[0-9]{6}Z-[a-f0-9]{8}$")
FORMAT = "green-dream-encrypted-content-backup-v1"


def run_rclone(args: list[str], *, capture: bool = False) -> str:
    command = ["rclone", *args]
    try:
        result = subprocess.run(
            command,
            check=True,
            text=True,
            stdout=subprocess.PIPE if capture else None,
            stderr=None,
        )
    except FileNotFoundError:
        raise RuntimeError("rclone is not installed on this runner.") from None
    except subprocess.CalledProcessError as exc:
        raise RuntimeError(f"rclone failed (exit code {exc.returncode}); see the preceding transfer log.") from None
    return result.stdout.strip() if capture else ""


def remote_root() -> str:
    value = os.environ.get("RCLONE_REMOTE_PATH", "greendream:Green Dream Backups").strip()
    if ":" not in value or value.endswith(":"):
        raise RuntimeError("RCLONE_REMOTE_PATH must identify a configured rclone remote and folder.")
    return value.rstrip("/")


def sha256_file(path: pathlib.Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(4 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def md5_file(path: pathlib.Path) -> str:
    digest = hashlib.md5()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(4 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def remote_md5(remote_file: str) -> str:
    output = run_rclone(["md5sum", remote_file], capture=True)
    fields = output.split()
    if len(fields) < 2 or not re.fullmatch(r"[a-fA-F0-9]{32}", fields[0]):
        raise RuntimeError("Google Drive did not return a usable MD5 checksum for the uploaded file.")
    return fields[0].lower()


def upload(args: argparse.Namespace) -> None:
    archive = args.archive.resolve()
    if not archive.is_file() or archive.stat().st_size <= 0:
        raise RuntimeError("Encrypted archive is missing or empty.")
    root = remote_root()
    run_rclone(["mkdir", root])

    backup_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-" + uuid4().hex[:8]
    archive_name = f"{PREFIX}{backup_id}.tar.gz.gpg"
    manifest_name = f"{PREFIX}{backup_id}.json"
    archive_remote = f"{root}/{archive_name}"
    manifest_remote = f"{root}/{manifest_name}"
    expected_sha256 = sha256_file(archive)
    expected_md5 = md5_file(archive)
    manifest = {
        "format": FORMAT,
        "backup_id": backup_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "encrypted": True,
        "archive_name": archive_name,
        "bytes": archive.stat().st_size,
        "sha256": expected_sha256,
        "md5": expected_md5,
        "encryption": "GPG symmetric AES-256",
    }

    # A manifest is uploaded last. Its presence marks a complete, verified archive.
    run_rclone([
        "copyto", str(archive), archive_remote,
        "--immutable",
        "--drive-chunk-size", "64M",
        "--retries", "5",
        "--low-level-retries", "10",
        "--stats", "30s",
        "--stats-one-line",
        "--log-level", "INFO",
    ])
    actual_md5 = remote_md5(archive_remote)
    if actual_md5 != expected_md5:
        raise RuntimeError("Uploaded archive MD5 does not match the local encrypted archive.")

    with tempfile.TemporaryDirectory(prefix="greendream-drive-") as temp:
        manifest_path = pathlib.Path(temp) / manifest_name
        manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
        run_rclone(["copyto", str(manifest_path), manifest_remote, "--immutable", "--retries", "5"])
    print(f"Verified encrypted archive uploaded: {backup_id} ({archive.stat().st_size} bytes).")
    print(f"Drive archive: {archive_name}")
    print(f"Drive completion manifest: {manifest_name}")


def read_manifest(root: str, name: str) -> dict:
    if not name.startswith(PREFIX) or not name.endswith(".json") or "/" in name or "\\" in name:
        raise RuntimeError("Drive returned an invalid backup manifest filename.")
    raw = run_rclone(["cat", f"{root}/{name}"], capture=True)
    try:
        manifest = json.loads(raw)
    except json.JSONDecodeError:
        raise RuntimeError("A Drive backup manifest is not valid JSON.") from None
    backup_id = manifest.get("backup_id")
    if (
        manifest.get("format") != FORMAT
        or manifest.get("encrypted") is not True
        or not isinstance(backup_id, str)
        or not BACKUP_ID_RE.fullmatch(backup_id)
        or name != f"{PREFIX}{backup_id}.json"
        or manifest.get("archive_name") != f"{PREFIX}{backup_id}.tar.gz.gpg"
        or not isinstance(manifest.get("bytes"), int)
        or manifest["bytes"] <= 0
        or not re.fullmatch(r"[a-f0-9]{64}", str(manifest.get("sha256", "")))
        or not re.fullmatch(r"[a-f0-9]{32}", str(manifest.get("md5", "")))
    ):
        raise RuntimeError("A Drive backup manifest failed validation.")
    return manifest


def download(args: argparse.Namespace) -> None:
    root = remote_root()
    if args.backup_id and not BACKUP_ID_RE.fullmatch(args.backup_id):
        raise RuntimeError("Invalid backup ID.")
    if args.backup_id:
        names = [f"{PREFIX}{args.backup_id}.json"]
    else:
        output = run_rclone(["lsf", root, "--files-only", "--include", f"{PREFIX}*.json"], capture=True)
        names = sorted((line.strip() for line in output.splitlines() if line.strip()), reverse=True)
    if not names:
        raise RuntimeError("No completed Green Dream backups were found in the Drive folder.")

    selected = None
    for name in names:
        try:
            selected = read_manifest(root, name)
            break
        except RuntimeError:
            if args.backup_id:
                raise
            continue
    if selected is None:
        raise RuntimeError("No valid completed Green Dream backup manifest was found.")

    destination = args.output.resolve()
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_name(destination.name + ".partial")
    temporary.unlink(missing_ok=True)
    try:
        run_rclone([
            "copyto",
            f"{root}/{selected['archive_name']}",
            str(temporary),
            "--retries", "5",
            "--low-level-retries", "10",
            "--stats", "30s",
            "--stats-one-line",
            "--log-level", "INFO",
        ])
        if not temporary.is_file() or temporary.stat().st_size != selected["bytes"]:
            raise RuntimeError("Downloaded archive size does not match its Drive manifest.")
        if sha256_file(temporary) != selected["sha256"] or md5_file(temporary) != selected["md5"]:
            raise RuntimeError("Downloaded archive checksum does not match its Drive manifest.")
        temporary.replace(destination)
    except Exception:
        temporary.unlink(missing_ok=True)
        raise
    print(f"Downloaded and verified encrypted backup {selected['backup_id']} ({selected['bytes']} bytes).")
    print(f"Output: {destination}")


def main() -> None:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    upload_parser = sub.add_parser("upload")
    upload_parser.add_argument("archive", type=pathlib.Path)
    upload_parser.set_defaults(func=upload)
    download_parser = sub.add_parser("download")
    download_parser.add_argument("--backup-id", default="")
    download_parser.add_argument("--output", required=True, type=pathlib.Path)
    download_parser.set_defaults(func=download)
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Google Drive backup transfer failed: {exc}", file=sys.stderr)
        sys.exit(1)
