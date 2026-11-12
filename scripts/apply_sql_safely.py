#!/usr/bin/env python3
"""Apply a SQL snapshot file without leaking sensitive SQL or row values into CI logs."""
import os
import pathlib
import re
import subprocess
import sys
import tempfile

if len(sys.argv) != 2:
    raise SystemExit("Usage: apply_sql_safely.py <sql-file>")
database_url = os.environ.get("DATABASE_URL", "")
if not database_url:
    raise SystemExit("DATABASE_URL is required.")
sql_file = pathlib.Path(sys.argv[1])
if not sql_file.is_file():
    raise SystemExit("SQL restore file does not exist.")

sql_to_apply = sql_file
temporary_sql = None
skipped_role_settings = 0

# pg_dump may quote configuration parameter identifiers in ALTER ROLE
# statements (for example: SET "log_min_messages" TO ...). The local
# disposable Supabase instance cannot change this server logging parameter.
# Omit only that complete role-setting statement; preserve role creation and
# every other role setting.
if sql_file.name == "roles.sql":
    original_sql = sql_file.read_text(encoding="utf-8")
    sanitized_sql, skipped_role_settings = re.subn(
        r'(?is)\bALTER\s+ROLE\b[^;]*?\bSET\s+"?log_min_messages"?(?=\s|=)[^;]*;',
        "",
        original_sql,
    )
    if skipped_role_settings:
        handle = tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8", suffix=".sql", prefix="gd-roles-", delete=False
        )
        try:
            handle.write(sanitized_sql)
            handle.close()
        except Exception:
            handle.close()
            pathlib.Path(handle.name).unlink(missing_ok=True)
            raise
        temporary_sql = pathlib.Path(handle.name)
        sql_to_apply = temporary_sql

try:
    result = subprocess.run(
        ["psql", database_url, "-X", "-v", "ON_ERROR_STOP=1", "-q", "-f", str(sql_to_apply)],
        check=False, capture_output=True, text=True,
    )
finally:
    if temporary_sql is not None:
        temporary_sql.unlink(missing_ok=True)

if result.returncode:
    print(
        "SQL restore failed while applying " + sql_file.name + ".",
        file=sys.stderr,
    )
    # Role DDL contains role identifiers and attributes, not user rows or secret values.
    # Expose only PostgreSQL's primary ERROR line for this file to make restore failures diagnosable.
    if sql_file.name == "roles.sql":
        for line in result.stderr.splitlines():
            if re.match(r"^psql:.*: ERROR:", line) or re.match(r"^ERROR:", line):
                print("PostgreSQL: " + line.split("ERROR:", 1)[-1].strip(), file=sys.stderr)
                break
    else:
        print(
            "Detailed database output is suppressed because the snapshot contains private data and secrets.",
            file=sys.stderr,
        )
    sys.exit(1)

if skipped_role_settings:
    print(
        f"Applied SQL restore file safely: {sql_file.name} "
        f"(skipped {skipped_role_settings} unsupported log_min_messages role setting(s))."
    )
else:
    print("Applied SQL restore file safely: " + sql_file.name)
