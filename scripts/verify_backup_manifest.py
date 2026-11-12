#!/usr/bin/env python3
"""Verify every file listed in backup-manifest.json before encryption."""
import hashlib
import json
import pathlib
import sys

root = pathlib.Path(sys.argv[1])
manifest_path = root / "backup-manifest.json"
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
expected = {item["path"]: item for item in manifest.get("files", [])}
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
print(f"Verified {len(actual)} files against backup-manifest.json")
