#!/usr/bin/env python3
"""Regression tests for the SQL role-dump sanitizer."""
import ast
import pathlib
import re

source = pathlib.Path("scripts/apply_sql_safely.py").read_text(encoding="utf-8")
tree = ast.parse(source)
wanted = {"split_sql_statements", "executable_sql", "sanitize_roles_sql"}
nodes = [node for node in tree.body if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name in wanted]
namespace = {"re": re}
exec(compile(ast.Module(body=nodes, type_ignores=[]), "apply_sql_safely.py", "exec"), namespace)
sanitize = namespace["sanitize_roles_sql"]

cases = [
    ("SET log_min_messages = warning;", "", 1),
    ("ALTER ROLE app_user SET log_min_messages TO warning;", "", 1),
    ('ALTER ROLE "app_user" SET "log_min_messages" TO warning;', "", 1),
    ("ALTER DATABASE appdb SET log_min_messages = warning;", "", 1),
    ("GRANT app_role TO log_min_messages_reader;", "GRANT app_role TO log_min_messages_reader;", 0),
    ("ALTER ROLE app_user SET statement_timeout TO '5s';", "ALTER ROLE app_user SET statement_timeout TO '5s';", 0),
]
for source_sql, expected_sql, expected_skipped in cases:
    actual_sql, skipped = sanitize(source_sql)
    assert actual_sql == expected_sql, (source_sql, actual_sql)
    assert skipped == expected_skipped, (source_sql, skipped)

print(f"SQL sanitizer regression tests passed: {len(cases)} cases.")
