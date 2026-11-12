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
        raise SystemExit(f"Duplicate Storage metadata row: {key}")
    expected[key] = item
actual = {}
for item in download_manifest.get("objects", []):
    key = (item["bucket"], item["path"])
    if key in actual:
        raise SystemExit(f"Duplicate downloaded Storage object: {key}")
    actual[key] = item
if set(expected) != set(actual):
    missing = sorted(set(expected) - set(actual))
    unexpected = sorted(set(actual) - set(expected))
    raise SystemExit(f"Storage object inventory mismatch; missing={missing}, unexpected={unexpected}")
for key, record in expected.items():
    metadata = record.get("metadata") or {}
    expected_size = metadata.get("size")
    if expected_size is not None and int(expected_size) != actual[key]["bytes"]:
        raise SystemExit(f"Storage object size mismatch: {key}")
    if key[0] not in bucket_ids:
        raise SystemExit(f"Storage object references unknown bucket: {key}")
print(f"Verified {len(actual)} downloaded Storage objects against database metadata")
