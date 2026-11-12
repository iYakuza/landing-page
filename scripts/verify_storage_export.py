#!/usr/bin/env python3
"""Cross-check downloaded Storage objects against the database metadata snapshot."""
import json
import pathlib
import sys

root = pathlib.Path(sys.argv[1])
buckets = json.loads((root / "storage" / "buckets.json").read_text(encoding="utf-8"))
database_objects = json.loads((root / "storage" / "objects-metadata.json").read_text(encoding="utf-8"))
download_manifest = json.loads(
    (root / "storage" / "objects" / "storage-manifest.json").read_text(encoding="utf-8")
)
bucket_ids = {item["id"] for item in buckets}
expected = {}
for item in database_objects:
    key = (item["bucket_id"], item["name"])
    if key in expected:
        raise SystemExit("Duplicate Storage metadata row detected; object path suppressed.")
    expected[key] = item
actual = {}
for item in download_manifest.get("objects", []):
    key = (item["bucket"], item["path"])
    if key in actual:
        raise SystemExit("Duplicate downloaded Storage object detected; object path suppressed.")
    actual[key] = item
if set(expected) != set(actual):
    missing = sorted(set(expected) - set(actual))
    unexpected = sorted(set(actual) - set(expected))
    raise SystemExit(f"Storage object inventory mismatch: {len(missing)} missing and {len(unexpected)} unexpected; object paths suppressed.")
for key, record in expected.items():
    metadata = record.get("metadata") or {}
    expected_size = metadata.get("size")
    if expected_size is not None and int(expected_size) != actual[key]["bytes"]:
        raise SystemExit(f"Storage object size mismatch in bucket {key[0]}; object path suppressed.")
    if key[0] not in bucket_ids:
        raise SystemExit(f"Storage object references an unknown bucket ({key[0]}); object path suppressed.")
print(f"Verified {len(actual)} downloaded Storage objects against database metadata")
