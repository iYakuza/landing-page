#!/usr/bin/env python3
"""Verify that the restored Supabase migration ledger matches the captured snapshot."""
import json
import os
import pathlib
import subprocess
import sys

root = pathlib.Path(sys.argv[1])
database_url = os.environ.get("DATABASE_URL", "")
if not database_url:
    raise SystemExit("DATABASE_URL is required.")
expected = json.loads((root / "database" / "migration-ledger.json").read_text(encoding="utf-8"))
sql = "select coalesce(json_agg(json_build_object('version',version,'name',name) order by version), '[]'::json) from supabase_migrations.schema_migrations"
result = subprocess.run(
    ["psql", database_url, "-X", "-v", "ON_ERROR_STOP=1", "-Atc", sql],
    check=False, capture_output=True, text=True,
)
if result.returncode:
    raise SystemExit("Could not read the restored migration ledger; database details suppressed.")
actual = json.loads(result.stdout.strip() or "[]")
if actual != expected:
    raise SystemExit(
        f"Migration ledger verification failed: expected {len(expected)} entries, found {len(actual)}."
    )
print(f"Verified all {len(actual)} restored migration ledger entries.")
