#!/usr/bin/env python3
"""Exercise the snapshot-derived row-count parser with a synthetic pg_dump sample."""
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
        "CREATE TABLE public.posts (id integer, title text);\n"
        "CREATE TABLE public.empty_table (id integer);\n",
        encoding="utf-8",
    )
    (root / "database" / "data.sql").write_text(
        "COPY public.posts (id, title) FROM stdin;\n"
        "1\tFirst\n2\tSecond\n\\.\n",
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
        "public_tables": {"empty_table": 0, "posts": 2},
        "managed_tables": {
            "auth.users": 1,
            "auth.identities": 0,
            "storage.buckets": 1,
            "storage.objects": 1,
            "vault.decrypted_secrets": 1,
        },
    }
    if actual != expected:
        raise SystemExit("Snapshot-derived restore expectations test failed.")
print("Snapshot-derived restore expectations test passed.")
