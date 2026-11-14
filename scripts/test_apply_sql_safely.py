#!/usr/bin/env python3
"""Regression tests for the SQL role-dump sanitizer."""
import ast
import pathlib
import re

source = pathlib.Path("scripts/apply_sql_safely.py").read_text(encoding="utf-8")
tree = ast.parse(source)
wanted = {"split_sql_statements", "executable_sql", "strip_sql_comments", "redacted_sql_shape", "statement_at_line", "postgres_error_diagnostic", "sanitize_roles_sql"}
nodes = [node for node in tree.body if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name in wanted]
namespace = {"re": re}
exec(compile(ast.Module(body=nodes, type_ignores=[]), "apply_sql_safely.py", "exec"), namespace)
sanitize = namespace["sanitize_roles_sql"]
shape = namespace["redacted_sql_shape"]
statement_at_line = namespace["statement_at_line"]
postgres_error_diagnostic = namespace["postgres_error_diagnostic"]

redacted = shape("ALTER ROLE secret_role SET log_min_messages TO 'do-not-log-this-value';")
assert "ALTER ROLE <identifier> SET LOG_MIN_MESSAGES TO '<literal>'" in redacted, redacted
assert "secret_role" not in redacted and "do-not-log-this-value" not in redacted, redacted
wrapped = "DO $do$ BEGIN EXECUTE 'ALTER ROLE secret_role SET log_min_messages TO secret_value'; END $do$;"
assert "DO $body$ BEGIN EXECUTE" in shape(wrapped)
assert "secret_role" not in shape(wrapped) and "secret_value" not in shape(wrapped)
assert statement_at_line("SET search_path = public;\nALTER ROLE secret_role SET log_min_messages TO warning;\n", 2).lstrip().startswith("ALTER ROLE")

diagnostic = postgres_error_diagnostic(
    'psql:/tmp/restore.sql:7: ERROR: invalid input syntax for type uuid: "private-user-id"'
)
assert diagnostic == (7, 'invalid input syntax for type uuid: "<redacted>"'), diagnostic
assert "private-user-id" not in diagnostic[1]
plain_diagnostic = postgres_error_diagnostic("ERROR: relation does not exist")
assert plain_diagnostic == (None, "relation does not exist"), plain_diagnostic

ledger_statement = (
    "insert into supabase_migrations.schema_migrations "
    "(version, statements, name, created_by, idempotency_key, rollback) "
    "select version, statements, name, created_by, idempotency_key, rollback "
    "from jsonb_populate_recordset(null::supabase_migrations.schema_migrations, "
    "'[\\\"private migration payload\\\"]'::jsonb) "
    "on conflict (version) do update set statements = excluded.statements;"
)
ledger_shape = shape(ledger_statement)
assert "INSERT INTO" in ledger_shape and "JSONB_POPULATE_RECORDSET" in ledger_shape, ledger_shape
assert "CREATED_BY" in ledger_shape and "IDEMPOTENCY_KEY" in ledger_shape, ledger_shape
assert "private migration payload" not in ledger_shape, ledger_shape

cases = [
    ("SET log_min_messages = warning;", "", 1),
    ("SELECT pg_catalog.set_config('log_min_messages', 'warning', false);", "", 1),
    ("\\restrict abc123\nSELECT pg_catalog.set_config('log_min_messages', 'warning', false);\n\\unrestrict abc123", "\\restrict abc123\n\n\\unrestrict abc123", 1),
    ("SELECT set_config('log_min_messages', 'warning', true);", "", 1),
    ("SELECT pg_catalog.set_config(E'log_min_messages', 'warning', false);", "", 1),
    ("SELECT pg_catalog.set_config($cfg$log_min_messages$cfg$, 'warning', false);", "", 1),
    ("DO $do$ BEGIN PERFORM pg_catalog.set_config('log_min_messages', 'warning', false); END $do$;", "", 1),
    ("DO $block$ BEGIN PERFORM set_config(E'log_min_messages', 'warning', true); END $block$;", "", 1),
    ("DO $do$ BEGIN EXECUTE 'SET log_min_messages = warning'; END $do$;", "", 1),
    ("DO $do$ BEGIN EXECUTE 'ALTER ROLE app_user SET log_min_messages TO warning'; END $do$;", "", 1),
    ("DO $do$ BEGIN EXECUTE format('ALTER ROLE %I SET %I TO %L', 'app_user', 'log_min_messages', 'warning'); END $do$;", "", 1),
    ("SELECT pg_catalog.set_config('search_path', 'log_min_messages', false);", "SELECT pg_catalog.set_config('search_path', 'log_min_messages', false);", 0),
    ("SELECT pg_catalog.set_config('search_path', 'safe', false); -- set_config('log_min_messages', 'warning', false)\n", "SELECT pg_catalog.set_config('search_path', 'safe', false); -- set_config('log_min_messages', 'warning', false)\n", 0),
    ("ALTER ROLE app_user SET log_min_messages TO warning;", "", 1),
    ('ALTER ROLE "app_user" SET "log_min_messages" TO warning;', "", 1),
    ("ALTER DATABASE appdb SET log_min_messages = warning;", "", 1),
    ("\\restrict abc123\nSET log_min_messages TO warning;", "\\restrict abc123\n", 1),
    ("\\restrict abc123\nALTER ROLE app_user SET log_min_messages TO warning;", "\\restrict abc123\n", 1),
    ("\\restrict abc123\nSET log_min_messages TO warning;\n\\unrestrict abc123", "\\restrict abc123\n\n\\unrestrict abc123", 1),
    ("GRANT SET ON PARAMETER \"log_min_messages\" TO \"app_user\";", "", 1),
    ("GRANT SET ON PARAMETER log_min_messages TO app_user;", "", 1),
    ("GRANT SET, ALTER SYSTEM ON PARAMETER \"log_min_messages\" TO app_user;", "", 1),
    ("GRANT ALL PRIVILEGES ON PARAMETER log_min_messages TO app_user;", "", 1),
    ("REVOKE SET ON PARAMETER \"log_min_messages\" FROM app_user;", "", 1),
    ("GRANT SET ON PARAMETER work_mem TO app_user;", "GRANT SET ON PARAMETER work_mem TO app_user;", 0),
    ("GRANT app_role TO log_min_messages_reader;", "GRANT app_role TO log_min_messages_reader;", 0),
    ("ALTER ROLE app_user SET statement_timeout TO '5s';", "ALTER ROLE app_user SET statement_timeout TO '5s';", 0),
]
for source_sql, expected_sql, expected_skipped in cases:
    actual_sql, skipped = sanitize(source_sql)
    assert actual_sql == expected_sql, (source_sql, actual_sql)
    assert skipped == expected_skipped, (source_sql, skipped)

print(f"SQL sanitizer regression tests passed: {len(cases)} cases.")
