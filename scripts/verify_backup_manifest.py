#!/usr/bin/env python3
"""Validate the backup manifest structure and every payload file checksum."""
import hashlib
import json
import pathlib
import re
import sys

root = pathlib.Path(sys.argv[1])
manifest_path = root / "backup-manifest.json"
try:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
except (OSError, json.JSONDecodeError) as exc:
    raise SystemExit("Backup manifest is missing or invalid JSON.") from exc

if not isinstance(manifest, dict) or manifest.get("format") != "green-dream-backup-v1":
    raise SystemExit("Backup manifest format is missing or unsupported.")
entries = manifest.get("files")
if not isinstance(entries, list):
    raise SystemExit("Backup manifest file inventory is invalid.")

expected = {}
declared_total = 0
for item in entries:
    if not isinstance(item, dict):
        raise SystemExit("Backup manifest contains an invalid file record.")
    name, size, digest = item.get("path"), item.get("bytes"), item.get("sha256")
    if not isinstance(name, str) or not name or "\\" in name:
        raise SystemExit("Backup manifest contains an invalid file path.")
    relative = pathlib.PurePosixPath(name)
    if relative.is_absolute() or any(part in ("", ".", "..") for part in relative.parts) or relative.as_posix() != name:
        raise SystemExit("Backup manifest contains an unsafe file path.")
    if name == "backup-manifest.json":
        raise SystemExit("Backup manifest must not list itself as a payload file.")
    if type(size) is not int or size < 0:
        raise SystemExit("Backup manifest contains an invalid file size.")
    if not isinstance(digest, str) or not re.fullmatch(r"[a-f0-9]{64}", digest):
        raise SystemExit("Backup manifest contains an invalid SHA-256 digest.")
    if name in expected:
        raise SystemExit("Backup manifest contains a duplicate file path.")
    expected[name] = {"bytes": size, "sha256": digest}
    declared_total += size

if type(manifest.get("file_count")) is not int or manifest["file_count"] != len(entries):
    raise SystemExit("Backup manifest file count does not match its inventory.")
if type(manifest.get("total_bytes")) is not int or manifest["total_bytes"] != declared_total:
    raise SystemExit("Backup manifest total byte count does not match its inventory.")

actual = {
    path.relative_to(root).as_posix(): path
    for path in root.rglob("*")
    if path.is_file() and path != manifest_path
}
if set(expected) != set(actual):
    missing = sorted(set(expected) - set(actual))
    unexpected = sorted(set(actual) - set(expected))
    raise SystemExit(f"Manifest file list mismatch; missing={missing}, unexpected={unexpected}")

for name, path in actual.items():
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    record = expected[name]
    if path.stat().st_size != record["bytes"] or digest.hexdigest() != record["sha256"]:
        raise SystemExit(f"Checksum verification failed: {name}")

print(f"Verified {len(actual)} files and {declared_total} bytes against backup-manifest.json")
