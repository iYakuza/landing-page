#!/usr/bin/env python3
"""Exercise snapshot-derived row counts with quoted and unquoted pg_dump identifiers."""
import json
import pathlib
import subprocess
import sys
import tempfile

repo_root = pathlib.Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as temp:
    root = pathlib.Path(temp)
    for folder in ("database", "auth", "storage", "secrets"):
        (root / folder).mkdir()
    (root / "database" / "schema.sql").write_text(
        'CREATE TABLE IF NOT EXISTS "public"."posts" (id integer, title text);\n'
        'CREATE TABLE public.empty_table (id integer);\n'
        'CREATE TABLE "public"."CaseSensitive" (id integer);\n'
        'CREATE TABLE "public"."odd""name" (id integer);\n',
        encoding="utf-8",
    )
    (root / "database" / "data.sql").write_text(
        'COPY "public"."posts" (id, title) FROM stdin;\n'
        '1\tFirst\n2\tSecond\n\\.\n'
        'COPY public.empty_table (id) FROM stdin;\n'
        '\\.\n'
        'COPY "public"."odd""name" (id) FROM stdin;\n'
        '7\n\\.\n',
        encoding="utf-8",
    )
    (root / "auth" / "users.json").write_text('[{"id":"user-1"}]', encoding="utf-8")
    (root / "auth" / "identities.json").write_text("[]", encoding="utf-8")
    (root / "storage" / "buckets.json").write_text('[{"id":"bucket"}]', encoding="utf-8")
    (root / "storage" / "objects-metadata.json").write_text('[{"bucket_id":"bucket","name":"file"}]', encoding="utf-8")
    (root / "secrets" / "vault-secrets.json").write_text('[{"name":"secret","secret":"value"}]', encoding="utf-8")
    subprocess.run(
        [sys.executable, str(repo_root / "scripts" / "create_restore_expectations.py"), str(root)],
        check=True,
        capture_output=True,
        text=True,
    )
    actual = json.loads((root / "database" / "table-counts.json").read_text(encoding="utf-8"))
    expected = {
        "public_tables": {
            "CaseSensitive": 0,
            "empty_table": 0,
            'odd"name': 1,
            "posts": 2,
        },
        "managed_tables": {
            "auth.users": 1,
            "auth.identities": 0,
            "storage.buckets": 1,
            "storage.objects": 1,
            "vault.decrypted_secrets": 1,
        },
    }
    if actual != expected:
        raise SystemExit("Snapshot-derived restore expectations test failed: " + json.dumps(actual, sort_keys=True))
print("Snapshot-derived restore expectations test passed.")
