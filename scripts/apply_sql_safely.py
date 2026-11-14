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



def strip_sql_comments(sql):
    """Remove SQL comments while preserving quoted text for safe directive matching."""
    out, i, state, dollar_tag, block_depth = [], 0, "normal", "", 0
    while i < len(sql):
        if state == "normal":
            if sql.startswith("--", i):
                out.extend("  ")
                state, i = "line_comment", i + 2
            elif sql.startswith("/*", i):
                out.extend("  ")
                state, block_depth, i = "block_comment", 1, i + 2
            elif sql[i] == "'":
                out.append(sql[i])
                state, i = "single_quote", i + 1
            elif sql[i] == '"':
                out.append(sql[i])
                state, i = "double_quote", i + 1
            elif sql[i] == "$" and (m := re.match(r"\$[A-Za-z_][A-Za-z_0-9]*\$|\$\$", sql[i:])):
                dollar_tag = m.group(0)
                out.append(dollar_tag)
                state, i = "dollar_quote", i + len(dollar_tag)
            else:
                out.append(sql[i])
                i += 1
        elif state == "line_comment":
            if sql[i] == "\n":
                out.append("\n")
                state = "normal"
            else:
                out.append(" ")
            i += 1
        elif state == "block_comment":
            if sql.startswith("/*", i):
                out.extend("  ")
                block_depth, i = block_depth + 1, i + 2
            elif sql.startswith("*/", i):
                out.extend("  ")
                block_depth, i = block_depth - 1, i + 2
                if block_depth == 0:
                    state = "normal"
            else:
                out.append("\n" if sql[i] == "\n" else " ")
                i += 1
        elif state == "single_quote":
            out.append(sql[i])
            if sql.startswith("''", i):
                out.append("'")
                i += 2
            elif sql[i] == "\\" and i + 1 < len(sql):
                out.append(sql[i + 1])
                i += 2
            elif sql[i] == "'":
                state, i = "normal", i + 1
            else:
                i += 1
        elif state == "double_quote":
            out.append(sql[i])
            if sql.startswith('""', i):
                out.append('"')
                i += 2
            elif sql[i] == '"':
                state, i = "normal", i + 1
            else:
                i += 1
        elif state == "dollar_quote":
            if sql.startswith(dollar_tag, i):
                out.append(dollar_tag)
                i += len(dollar_tag)
                state = "normal"
            else:
                out.append(sql[i])
                i += 1
    return "".join(out)

def redacted_sql_shape(sql):
    """Return a SQL structure fingerprint without exposing identifiers or values."""
    safe_words = {
        "ALTER", "ROLE", "USER", "DATABASE", "SET", "RESET", "SESSION", "LOCAL",
        "TO", "FROM", "GRANT", "CREATE", "DROP", "DO", "BEGIN", "END", "EXECUTE",
        "SELECT", "PERFORM", "SET_CONFIG", "PG_CATALOG", "FORMAT", "QUOTE_IDENT",
        "AS", "ON", "IN", "WITH", "NOLOGIN", "LOGIN", "NOCREATEDB", "CREATEDB",
        "NOSUPERUSER", "SUPERUSER", "NOREPLICATION", "REPLICATION", "BYPASSRLS",
        "NOBYPASSRLS", "IF", "EXISTS", "THEN", "ELSE", "ELSIF", "WHEN", "DECLARE",
        "RETURN", "LANGUAGE", "PLPGSQL", "CURRENT_SETTING", "TRUE", "FALSE", "NULL",
        "REVOKE", "ALL", "PRIVILEGES", "E",
    }
    token_pattern = re.compile(
        r"""'(?:''|\\.|[^'])*'|"(?:\"\"|[^"])*"|\$[A-Za-z_][A-Za-z_0-9]*\$|\$\$|[A-Za-z_][A-Za-z_0-9$]*|\d+|\s+|.""",
        re.DOTALL,
    )
    output = []
    for match in token_pattern.finditer(strip_sql_comments(sql)):
        token = match.group(0)
        if token.isspace():
            output.append(" ")
        elif token.startswith("'"):
            value = token[1:-1].replace("''", "'").strip().lower()
            output.append("'log_min_messages'" if value == "log_min_messages" else "'<literal>'")
        elif token.startswith('"'):
            value = token[1:-1].replace('""', '"').strip().lower()
            output.append('"log_min_messages"' if value == "log_min_messages" else '"<identifier>"')
        elif token.startswith("$") and token.endswith("$"):
            output.append("$body$")
        elif token.isdigit():
            output.append("<number>")
        elif re.fullmatch(r"[A-Za-z_][A-Za-z_0-9$]*", token):
            output.append(token.upper() if token.upper() in safe_words or token.lower() == "log_min_messages" else "<identifier>")
        else:
            output.append(token)
    return re.sub(r"\s+", " ", "".join(output)).strip()[:900]


def statement_at_line(sql, line_number):
    """Find the semicolon-delimited SQL statement containing a psql line number."""
    current_line = 1
    for statement in split_sql_statements(sql):
        final_line = current_line + statement.count("\n")
        if current_line <= line_number <= final_line:
            return statement
        current_line = final_line
    return ""


def sanitize_roles_sql(original_sql):
    """Remove non-portable log_min_messages settings from the role dump."""
    kept, skipped, unsupported = [], 0, set()
    literal_diagnostics = []
    for statement_number, statement in enumerate(split_sql_statements(original_sql), start=1):
        code = executable_sql(statement)

        # The target may appear as a string argument to set_config(), which
        # executable_sql() intentionally masks. Inspect a comment-free copy
        # only for this exact SELECT form before taking the fast path.
        comment_free = re.sub(
            r"(?m)^[ \t]*\\[A-Za-z]+[^\n]*(?:\n|$)",
            " ",
            strip_sql_comments(statement),
        ).lstrip()
        classified = re.sub(
            r"(?m)^[ \t]*\\[A-Za-z]+[^\n]*(?:\n|$)", " ", code
        ).lstrip()
        # Redacted diagnostics for parameter names hidden inside SQL strings.
        literal_parameter = bool(
            re.search(r"\blog_min_messages\b", comment_free, re.IGNORECASE)
            and not re.search(r"\blog_min_messages\b", code, re.IGNORECASE)
        )
        has_set_config_text = bool(re.search(r"\bset_config\s*\(", comment_free, re.IGNORECASE))
        has_execute_text = bool(re.search(r"\bEXECUTE\b", comment_free, re.IGNORECASE))
        has_set_reset_text = bool(
            re.search(
                r"""(?is)\b(?:SET|RESET)\s+(?:SESSION\s+)?["']?log_min_messages\b""",
                comment_free,
            )
        )
        if literal_parameter and (has_set_config_text or has_execute_text or has_set_reset_text):
            command_match = re.match(r"([A-Za-z]+)", classified)
            literal_diagnostics.append(
                f"statement {statement_number}: command={command_match.group(1).upper() if command_match else 'UNKNOWN'}, "
                f"set_config={str(has_set_config_text).lower()}, "
                f"execute={str(has_execute_text).lower()}, "
                f"set_reset_text={str(has_set_reset_text).lower()}"
            )

        set_config_parameter = bool(
            re.search(
                r"""(?is)\b(?:pg_catalog\s*\.\s*)?set_config\s*\(\s*(?:(?:[eE]\s*)?'log_min_messages'|(\$[A-Za-z_][A-Za-z_0-9]*\$|\$\$)log_min_messages\1)\s*(?:::\s*[\w."]+)?\s*,""",
                comment_free,
            )
            or re.search(
                r"""(?is)\b(?:EXECUTE\s+)?['"]\s*(?:SET|RESET)\s+(?:SESSION\s+)?["']?log_min_messages\b""",
                comment_free,
            )
            # pg_dump role dumps can wrap role settings in DO blocks and build
            # the ALTER ROLE statement dynamically. Recognize both a literal
            # target and format('%I ...', ..., 'log_min_messages', ...) form.
            or re.search(
                r"""(?is)\bEXECUTE\b[\s\S]{0,4096}?\bALTER\s+(?:ROLE|USER|DATABASE)\b[\s\S]{0,2048}?\bSET\s+["']?log_min_messages\b""",
                comment_free,
            )
            or re.search(
                r"""(?is)\bEXECUTE\b[\s\S]{0,4096}?\b(?:SET|RESET)\s+%I\b[\s\S]{0,2048}?\blog_min_messages\b""",
                comment_free,
            )
        )
        if not re.search(r"\blog_min_messages\b", code, re.IGNORECASE) and not set_config_parameter:
            kept.append(statement)
            continue

        # pg_dump may wrap SQL in psql session directives such as \restrict.
        # Those directives are not SQL and can precede the actual command in
        # the same semicolon-delimited fragment. Remove directive-only lines
        # before classifying the statement, without changing the SQL applied.
        directives = re.findall(
            r"(?m)^[ \t]*\\[A-Za-z]+[^\n]*(?:\n|$)", statement
        )
        classified = re.sub(
            r"(?m)^[ \t]*\\[A-Za-z]+[^\n]*(?:\n|$)", " ", code
        ).lstrip()

        if re.match(r"(?:SET|RESET)\b", classified, re.IGNORECASE):
            # Standalone server logging defaults are environment-specific.
            # Preserve psql session directives such as \restrict if they share
            # a fragment with the skipped SQL command.
            kept.extend(directives)
            skipped += 1
        elif set_config_parameter:
            # Some dump wrappers express the same session setting as
            # SELECT pg_catalog.set_config('log_min_messages', ...).
            # The parameter name is inside a string literal, so executable_sql()
            # intentionally masks it; recognize only this exact first argument.
            kept.extend(directives)
            skipped += 1
        elif re.match(r"ALTER\s+(?:ROLE|USER|DATABASE)\b", classified, re.IGNORECASE):
            # Omit only the ALTER statement carrying this unsupported setting;
            # retain role creation, attributes, memberships and grants.
            kept.extend(directives)
            skipped += 1
        elif re.match(r"GRANT\b", classified, re.IGNORECASE):
            # GRANT statements may reference a role whose name contains this
            # token; they do not set PostgreSQL parameters.
            kept.append(statement)
        else:
            command = re.match(r"([A-Za-z]+)", classified)
            unsupported.add(command.group(1).upper() if command else "UNKNOWN")
            kept.append(statement)
    for diagnostic in literal_diagnostics:
        print("Restore sanitizer diagnostic (SQL values redacted): " + diagnostic)
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

applied_roles_sql = (
    sql_to_apply.read_text(encoding="utf-8") if sql_file.name == "roles.sql" else ""
)

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
                location = re.match(r"^psql:.*?:(\d+): ERROR:", line)
                if location:
                    line_number = int(location.group(1))
                    print("SQL diagnostic: roles.sql reported line " + str(line_number) + ".", file=sys.stderr)
                    statement = statement_at_line(applied_roles_sql, line_number)
                    if statement:
                        print(
                            "SQL diagnostic: statement shape (role identifiers and literal values redacted): "
                            + redacted_sql_shape(statement),
                            file=sys.stderr,
                        )
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
