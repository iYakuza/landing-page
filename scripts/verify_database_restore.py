#!/usr/bin/env python3
"""Capture or compare row counts for application and managed data restored from a snapshot."""
import argparse
import json
import os
import pathlib
import subprocess
import sys

SYSTEM_TABLES = (
    "auth.users",
    "auth.identities",
    "storage.buckets",
    "storage.objects",
    "vault.decrypted_secrets",
)

def run_psql(database_url, sql):
    result = subprocess.run(
        ["psql", database_url, "-X", "-v", "ON_ERROR_STOP=1", "-Atc", sql],
        check=False, capture_output=True, text=True,
    )
    if result.returncode:
        raise RuntimeError("PostgreSQL count query failed: " + result.stderr.strip()[:1000])
    return result.stdout.strip()

def capture(database_url):
    table_names = run_psql(
        database_url,
        "select tablename from pg_tables where schemaname='public' order by tablename",
    ).splitlines()
    public = {}
    for name in table_names:
        ident = '"' + name.replace('"', '""') + '"'
        value = run_psql(database_url, "select count(*) from public." + ident)
        public[name] = int(value)
    system = {}
    for table in SYSTEM_TABLES:
        value = run_psql(database_url, "select count(*) from " + table)
        system[table] = int(value)
    return {"public_tables": public, "managed_tables": system}

parser = argparse.ArgumentParser()
parser.add_argument("--output", type=pathlib.Path)
parser.add_argument("--compare", type=pathlib.Path)
args = parser.parse_args()
database_url = os.environ.get("DATABASE_URL", "")
if not database_url:
    raise SystemExit("DATABASE_URL is required.")
try:
    actual = capture(database_url)
    if args.compare:
        expected = json.loads(args.compare.read_text(encoding="utf-8"))
        if expected != actual:
            print(json.dumps({"expected": expected, "actual": actual}, indent=2), file=sys.stderr)
            raise SystemExit("Restored database row counts do not match the source snapshot.")
        print("Database restore row counts verified.")
    elif args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(actual, indent=2) + "\n", encoding="utf-8")
        print(f"Captured row counts for {len(actual['public_tables'])} public tables and {len(actual['managed_tables'])} managed tables.")
    else:
        raise SystemExit("Specify --output or --compare.")
except Exception as exc:
    print("Database count verification failed: " + str(exc), file=sys.stderr)
    sys.exit(1)
