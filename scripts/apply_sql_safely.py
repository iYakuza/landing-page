#!/usr/bin/env python3
"""Apply a SQL snapshot file without leaking sensitive SQL or row values into CI logs."""
import os
import pathlib
import re
import subprocess
import sys

if len(sys.argv) != 2:
    raise SystemExit("Usage: apply_sql_safely.py <sql-file>")
database_url = os.environ.get("DATABASE_URL", "")
if not database_url:
    raise SystemExit("DATABASE_URL is required.")
sql_file = pathlib.Path(sys.argv[1])
if not sql_file.is_file():
    raise SystemExit("SQL restore file does not exist.")
result = subprocess.run(
    ["psql", database_url, "-X", "-v", "ON_ERROR_STOP=1", "-q", "-f", str(sql_file)],
    check=False, capture_output=True, text=True,
)
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
print("Applied SQL restore file safely: " + sql_file.name)
