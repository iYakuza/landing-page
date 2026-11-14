#!/usr/bin/env python3
"""Regression tests for the SQL role-dump sanitizer."""
import ast
import pathlib
import re

source = pathlib.Path("scripts/apply_sql_safely.py").read_text(encoding="utf-8")
tree = ast.parse(source)
wanted = {"split_sql_statements", "executable_sql", "strip_sql_comments", "redacted_sql_shape", "statement_at_line", "sanitize_roles_sql"}
nodes = [node for node in tree.body if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name in wanted]
namespace = {"re": re}
exec(compile(ast.Module(body=nodes, type_ignores=[]), "apply_sql_safely.py", "exec"), namespace)
sanitize = namespace["sanitize_roles_sql"]
shape = namespace["redacted_sql_shape"]
statement_at_line = namespace["statement_at_line"]

redacted = shape("ALTER ROLE secret_role SET log_min_messages TO 'do-not-log-this-value';")
assert "ALTER ROLE <identifier> SET LOG_MIN_MESSAGES TO '<literal>'" in redacted, redacted
assert "secret_role" not in redacted and "do-not-log-this-value" not in redacted, redacted
wrapped = "DO $do$ BEGIN EXECUTE 'ALTER ROLE secret_role SET log_min_messages TO secret_value'; END $do$;"
assert "DO $body$ BEGIN EXECUTE" in shape(wrapped)
assert "secret_role" not in shape(wrapped) and "secret_value" not in shape(wrapped)
assert statement_at_line("SET search_path = public;\\nALTER ROLE secret_role SET log_min_messages TO warning;\\n", 2).startswith("ALTER ROLE")

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
    ("GRANT app_role TO log_min_messages_reader;", "GRANT app_role TO log_min_messages_reader;", 0),
    ("ALTER ROLE app_user SET statement_timeout TO '5s';", "ALTER ROLE app_user SET statement_timeout TO '5s';", 0),
]
for source_sql, expected_sql, expected_skipped in cases:
    actual_sql, skipped = sanitize(source_sql)
    assert actual_sql == expected_sql, (source_sql, actual_sql)
    assert skipped == expected_skipped, (source_sql, skipped)

print(f"SQL sanitizer regression tests passed: {len(cases)} cases.")
