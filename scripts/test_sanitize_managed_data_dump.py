#!/usr/bin/env python3
"""Regression tests for filtering separately restored Supabase managed data."""
import importlib.util
import pathlib
import tempfile

module_path = pathlib.Path("scripts/sanitize_managed_data_dump.py")
spec = importlib.util.spec_from_file_location("sanitize_managed_data_dump", module_path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

fixture = (
    "-- source snapshot\n"
    'COPY "auth"."users" ("id", "email") FROM stdin;\n'
    "auth-user-secret@example.invalid\n"
    "\\.\n"
    'COPY "auth"."identities" ("id", "provider") FROM stdin;\n'
    "auth-identity-secret\n"
    "\\.\n"
    'COPY "storage"."buckets" ("id", "name") FROM stdin;\n'
    "storage-bucket-secret\n"
    "\\.\n"
    'COPY "storage"."objects" ("id", "name") FROM stdin;\n'
    "storage-object-secret\n"
    "\\.\n"
    'COPY "public"."posts" ("id", "title") FROM stdin;\n'
    "public-post-preserved\n"
    "\\.\n"
    'COPY "custom"."records" ("id", "value") FROM stdin;\n'
    "custom-record-preserved\n"
    "\\.\n"
    "SELECT pg_catalog.setval('public.posts_id_seq', 1, false);\n"
)

with tempfile.TemporaryDirectory() as directory:
    path = pathlib.Path(directory) / "data.sql"
    path.write_text(fixture, encoding="utf-8", newline="")
    counts = module.sanitize_data_dump(path)
    filtered = path.read_text(encoding="utf-8")

    assert counts == {
        "auth.users": 1,
        "auth.identities": 1,
        "storage.buckets": 1,
        "storage.objects": 1,
    }, counts

    for private_value in (
        "auth-user-secret",
        "auth-identity-secret",
        "storage-bucket-secret",
        "storage-object-secret",
    ):
        assert private_value not in filtered, private_value

    assert 'COPY "public"."posts"' in filtered
    assert "public-post-preserved" in filtered
    assert 'COPY "custom"."records"' in filtered
    assert "custom-record-preserved" in filtered
    assert "setval('public.posts_id_seq'" in filtered
    assert filtered.startswith("-- source snapshot")

with tempfile.TemporaryDirectory() as directory:
    path = pathlib.Path(directory) / "broken.sql"
    malformed = 'COPY "auth"."users" ("id") FROM stdin;\nprivate-row\n'
    path.write_text(malformed, encoding="utf-8", newline="")
    try:
        module.sanitize_data_dump(path)
    except ValueError as error:
        assert "terminator" in str(error)
    else:
        raise AssertionError("An unterminated managed COPY block was accepted.")
    assert path.read_text(encoding="utf-8") == malformed

with tempfile.TemporaryDirectory() as directory:
    path = pathlib.Path(directory) / "app-only.sql"
    app_only = 'COPY "public"."posts" ("id") FROM stdin;\npublic-only\n\\.\n'
    path.write_text(app_only, encoding="utf-8", newline="")
    counts = module.sanitize_data_dump(path)
    assert not counts
    assert path.read_text(encoding="utf-8") == app_only

print("Managed data-dump sanitizer tests passed: Auth/Storage excluded; public/custom data preserved.")
