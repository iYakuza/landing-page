#!/usr/bin/env python3
"""Verify that restored Storage object ownership matches the captured metadata."""
import json
import os
import pathlib
import subprocess
import sys

root = pathlib.Path(sys.argv[1])
database_url = os.environ.get("DATABASE_URL", "")
if not database_url:
    raise SystemExit("DATABASE_URL is required.")
metadata = json.loads((root / "storage" / "objects-metadata.json").read_text(encoding="utf-8"))
expected = sorted(
    [
        {
            "bucket_id": item["bucket_id"],
            "name": item["name"],
            "owner_id": item.get("owner_id"),
            "owner": item.get("owner"),
        }
        for item in metadata
    ],
    key=lambda item: (item["bucket_id"], item["name"]),
)
sql = (
    "select coalesce(json_agg(json_build_object('bucket_id',bucket_id,'name',name,"
    "'owner_id',owner_id,'owner',owner) order by bucket_id,name), '[]'::json) "
    "from storage.objects"
)
result = subprocess.run(
    ["psql", database_url, "-X", "-v", "ON_ERROR_STOP=1", "-Atc", sql],
    check=False, capture_output=True, text=True,
)
if result.returncode:
    raise SystemExit("Could not read restored Storage ownership metadata; database details suppressed.")
actual = json.loads(result.stdout.strip() or "[]")
if actual != expected:
    raise SystemExit(
        f"Storage ownership verification failed: expected {len(expected)} objects, found {len(actual)}."
    )
print(f"Verified owner metadata for all {len(actual)} Storage objects.")
