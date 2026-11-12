#!/usr/bin/env python3
"""Derive restore expectations from the exact dump/export files, not later live queries."""
import json
import pathlib
import re
import sys

root = pathlib.Path(sys.argv[1])
schema_path = root / "database" / "schema.sql"
data_path = root / "database" / "data.sql"
if not schema_path.is_file() or not data_path.is_file():
    raise SystemExit("Database schema/data dump files are missing.")

create_table = re.compile(r"^CREATE TABLE public\.([A-Za-z0-9_]+)\s*\(")
copy_table = re.compile(r"^COPY public\.([A-Za-z0-9_]+)\s*\(")
public_counts = {}
for line in schema_path.read_text(encoding="utf-8", errors="replace").splitlines():
    match = create_table.match(line)
    if match:
        public_counts[match.group(1)] = 0

current_table = None
row_count = 0
with data_path.open("r", encoding="utf-8", errors="replace") as stream:
    for line in stream:
        if current_table is None:
            match = copy_table.match(line)
            if match:
                current_table = match.group(1)
                if current_table not in public_counts:
                    raise SystemExit("Data dump references a public table absent from schema dump.")
                row_count = 0
        else:
            if line.rstrip("\r\n") == r"\.":
                public_counts[current_table] = row_count
                current_table = None
            else:
                row_count += 1
if current_table is not None:
    raise SystemExit("Data dump ended before a COPY section was complete.")

def array_length(path):
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, list):
        raise SystemExit("Backup metadata export is not a JSON array.")
    return len(value)

counts = {
    "public_tables": dict(sorted(public_counts.items())),
    "managed_tables": {
        "auth.users": array_length(root / "auth" / "users.json"),
        "auth.identities": array_length(root / "auth" / "identities.json"),
        "storage.buckets": array_length(root / "storage" / "buckets.json"),
        "storage.objects": array_length(root / "storage" / "objects-metadata.json"),
        "vault.decrypted_secrets": array_length(root / "secrets" / "vault-secrets.json"),
    },
}
target = root / "database" / "table-counts.json"
target.write_text(json.dumps(counts, indent=2) + "\n", encoding="utf-8")
print(f"Derived restore expectations from snapshot files: {len(public_counts)} public tables and {len(counts['managed_tables'])} managed tables.")
