#!/usr/bin/env python3
"""Verify restored Auth users and identities without printing personal or credential data."""
import hashlib
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
    return json.loads(result.stdout.strip() or "[]")

def digest(value):
    return hashlib.sha256((value or "").encode("utf-8")).hexdigest()

source_users = json.loads((root / "auth" / "users.json").read_text(encoding="utf-8"))
source_identities = json.loads((root / "auth" / "identities.json").read_text(encoding="utf-8"))
target_users = query("select coalesce(json_agg(json_build_object('id',id,'email',email,'encrypted_password',encrypted_password) order by id),'[]'::json) from auth.users")
target_identities = query("select coalesce(json_agg(json_build_object('id',id,'user_id',user_id,'provider_id',provider_id,'provider',provider) order by id),'[]'::json) from auth.identities")
expected_users = sorted((str(u["id"]), u.get("email"), digest(u.get("encrypted_password"))) for u in source_users)
actual_users = sorted((str(u["id"]), u.get("email"), digest(u.get("encrypted_password"))) for u in target_users)
expected_identities = sorted((str(i["id"]), str(i["user_id"]), i.get("provider_id"), i.get("provider")) for i in source_identities)
actual_identities = sorted((str(i["id"]), str(i["user_id"]), i.get("provider_id"), i.get("provider")) for i in target_identities)
if expected_users != actual_users or expected_identities != actual_identities:
    raise SystemExit("Restored Auth users or identities do not match the source snapshot.")
print(f"Verified {len(actual_users)} Auth users and {len(actual_identities)} identities, including password-hash integrity.")
