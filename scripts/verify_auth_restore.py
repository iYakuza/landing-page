#!/usr/bin/env python3
"""Verify complete restored Auth user and identity records without printing their contents."""
import json
import os
import pathlib
import subprocess
import sys

root = pathlib.Path(sys.argv[1])
database_url = os.environ.get("DATABASE_URL", "")
if not database_url:
    raise SystemExit("DATABASE_URL is required.")

def query(sql):
    result = subprocess.run(
        ["psql", database_url, "-X", "-v", "ON_ERROR_STOP=1", "-Atc", sql],
        check=False, capture_output=True, text=True,
    )
    if result.returncode:
        raise RuntimeError("Auth verification query failed: " + result.stderr.strip()[:1000])
    value = json.loads(result.stdout.strip() or "[]")
    if not isinstance(value, list):
        raise RuntimeError("Auth verification query returned an invalid record set.")
    return value

def normalized(rows, label):
    if not isinstance(rows, list) or any(not isinstance(row, dict) for row in rows):
        raise RuntimeError("The source Auth " + label + " export is invalid.")
    ids = [str(row.get("id", "")) for row in rows]
    if any(not value for value in ids) or len(ids) != len(set(ids)):
        raise RuntimeError("The source Auth " + label + " export has missing or duplicate IDs.")
    return sorted(
        (json.dumps(row, ensure_ascii=False, sort_keys=True, separators=(",", ":")) for row in rows)
    )

source_users = json.loads((root / "auth" / "users.json").read_text(encoding="utf-8"))
source_identities = json.loads((root / "auth" / "identities.json").read_text(encoding="utf-8"))
target_users = query("select coalesce(json_agg(to_jsonb(u) order by id),'[]'::json) from auth.users u")
target_identities = query("select coalesce(json_agg(to_jsonb(i) order by id),'[]'::json) from auth.identities i")

if normalized(source_users, "users") != normalized(target_users, "users"):
    raise SystemExit("Restored Auth user records do not match the complete source snapshot.")
if normalized(source_identities, "identities") != normalized(target_identities, "identities"):
    raise SystemExit("Restored Auth identity records do not match the complete source snapshot.")

print(
    f"Verified all fields for {len(target_users)} Auth users and "
    f"{len(target_identities)} identities; account and credential data was not printed."
)
