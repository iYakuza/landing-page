#!/usr/bin/env python3
"""Verify restored Vault secret names and values without printing secret contents."""
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

result = subprocess.run(
    ["psql", database_url, "-X", "-v", "ON_ERROR_STOP=1", "-Atc",
     "select coalesce(json_agg(json_build_object('name',name,'description',description,'secret',decrypted_secret) order by name),'[]'::json) from vault.decrypted_secrets"],
    check=False, capture_output=True, text=True,
)
if result.returncode:
    raise SystemExit("Vault verification query failed: " + result.stderr.strip()[:1000])
source = json.loads((root / "secrets" / "vault-secrets.json").read_text(encoding="utf-8"))
target = json.loads(result.stdout.strip() or "[]")
def digest(value):
    return hashlib.sha256((value or "").encode("utf-8")).hexdigest()
expected = sorted((item["name"], item.get("description") or "", digest(item["secret"])) for item in source)
actual = sorted((item["name"], item.get("description") or "", digest(item["secret"])) for item in target)
if expected != actual:
    raise SystemExit("Restored Vault secret names or values do not match the source snapshot.")
print(f"Verified {len(actual)} Vault secrets by name and SHA-256 digest; secret contents were not printed.")
