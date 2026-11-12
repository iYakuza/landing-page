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

def split_sql_statements(sql):
    """Split SQL on semicolons outside strings, identifiers, comments and dollar quotes."""
    statements, start, i = [], 0, 0
    state, dollar_tag, block_depth = "normal", "", 0
    while i < len(sql):
        if state == "normal":
            if sql.startswith("--", i):
                state, i = "line_comment", i + 2
            elif sql.startswith("/*", i):
                state, block_depth, i = "block_comment", 1, i + 2
            elif sql[i] == "'":
                state, i = "single_quote", i + 1
            elif sql[i] == '"':
                state, i = "double_quote", i + 1
            elif sql[i] == "$" and (m := re.match(r"\$[A-Za-z_][A-Za-z_0-9]*\$|\$\$", sql[i:])):
                dollar_tag, state, i = m.group(0), "dollar_quote", i + len(m.group(0))
            elif sql[i] == ";":
                statements.append(sql[start:i + 1])
                start, i = i + 1, i + 1
            else:
                i += 1
        elif state == "line_comment":
            if sql[i] == "\n":
                state = "normal"
            i += 1
        elif state == "block_comment":
            if sql.startswith("/*", i):
                block_depth, i = block_depth + 1, i + 2
            elif sql.startswith("*/", i):
                block_depth, i = block_depth - 1, i + 2
                if block_depth == 0:
                    state = "normal"
            else:
                i += 1
        elif state == "single_quote":
            if sql.startswith("''", i):
                i += 2
            elif sql[i] == "\\":
                i += 2
            elif sql[i] == "'":
                state, i = "normal", i + 1
            else:
                i += 1
        elif state == "double_quote":
            if sql.startswith('""', i):
                i += 2
            elif sql[i] == '"':
                state, i = "normal", i + 1
            else:
                i += 1
        elif state == "dollar_quote":
            if sql.startswith(dollar_tag, i):
                i += len(dollar_tag)
                state = "normal"
            else:
                i += 1
    if start < len(sql):
        statements.append(sql[start:])
    return statements


def executable_sql(statement):
    """Blank comments and string literals while retaining quoted identifiers."""
    out, i, state, depth = [], 0, "normal", 0
    while i < len(statement):
        if state == "normal":
            if statement.startswith("--", i):
                out.extend("  ")
                state, i = "line_comment", i + 2
            elif statement.startswith("/*", i):
                out.extend("  ")
                state, depth, i = "block_comment", 1, i + 2
            elif statement[i] == "'":
                out.append(" ")
                state, i = "single_quote", i + 1
            else:
                out.append(statement[i])
                i += 1
        elif state == "line_comment":
            if statement[i] == "\n":
                out.append("\n")
                state = "normal"
            else:
                out.append(" ")
            i += 1
        elif state == "block_comment":
            if statement.startswith("/*", i):
                out.extend("  ")
                depth, i = depth + 1, i + 2
            elif statement.startswith("*/", i):
                out.extend("  ")
                depth, i = depth - 1, i + 2
                if depth == 0:
                    state = "normal"
            else:
                out.append("\n" if statement[i] == "\n" else " ")
                i += 1
        elif state == "single_quote":
            if statement.startswith("''", i):
                out.extend("  ")
                i += 2
            elif statement[i] == "\\":
                out.append(" ")
                i += 1
                if i < len(statement):
                    out.append(" ")
                    i += 1
            elif statement[i] == "'":
                out.append(" ")
                state, i = "normal", i + 1
            else:
                out.append(" ")
                i += 1
    return "".join(out)


def sanitize_roles_sql(original_sql):
    """Remove only ALTER ROLE/USER statements setting log_min_messages."""
    kept, skipped, unsupported = [], 0, set()
    for statement in split_sql_statements(original_sql):
        code = executable_sql(statement)
        if not re.search(r"\blog_min_messages\b", code, re.IGNORECASE):
            kept.append(statement)
        elif re.match(r"\s*ALTER\s+(?:ROLE|USER)\b", code, re.IGNORECASE):
            skipped += 1
        else:
            command = re.match(r"\s*([A-Za-z]+)", code)
            unsupported.add(command.group(1).upper() if command else "UNKNOWN")
            kept.append(statement)
    if unsupported:
        raise SystemExit(
            "Restore sanitizer found log_min_messages outside a safely skippable "
            "ALTER ROLE/USER statement (statement type: "
            + ", ".join(sorted(unsupported))
            + "); refusing to apply roles.sql."
        )
    return "".join(kept), skipped


sql_to_apply = sql_file
temporary_sql = None
skipped_role_settings = 0

# The disposable restore database cannot change this server-level logging
# parameter. Parse SQL statements rather than relying on a formatting-sensitive regex.
if sql_file.name == "roles.sql":
    original_sql = sql_file.read_text(encoding="utf-8")
    sanitized_sql, skipped_role_settings = sanitize_roles_sql(original_sql)
    if skipped_role_settings:
        print(
            f"Restore sanitizer: skipped {skipped_role_settings} "
            "unsupported log_min_messages role setting statement(s)."
        )
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
