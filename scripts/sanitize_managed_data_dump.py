#!/usr/bin/env python3
"""Remove Auth and Storage COPY blocks from the generic pg_dump data file.

This recovery pipeline exports Auth users/identities separately and restores
Storage buckets/object bytes through the Storage API. Supabase CLI's data-only
dump can also contain rows from those managed schemas, which would otherwise
be applied a second time during a restore.
"""
import collections
import os
import pathlib
import re
import sys
import tempfile

MANAGED_SCHEMAS = {"auth", "storage"}
COPY_HEADER = re.compile(
    r"""^\s*COPY\s+(?P<schema>"(?:[^"]|"")*"|[A-Za-z_][A-Za-z_0-9$]*)\s*\.\s*"""
    r"""(?P<table>"(?:[^"]|"")*"|[A-Za-z_][A-Za-z_0-9$]*)\s*\(.*\)\s+FROM\s+stdin;\s*$""",
    re.IGNORECASE,
)


def identifier_value(token):
    if token.startswith('"') and token.endswith('"'):
        return token[1:-1].replace('""', '"')
    return token


def sanitize_data_dump(path):
    """Rewrite path without managed-schema COPY blocks; fail atomically on malformed input."""
    path = pathlib.Path(path)
    if not path.is_file():
        raise FileNotFoundError("SQL data dump does not exist.")

    mode = path.stat().st_mode & 0o777
    counts = collections.Counter()
    temporary_path = None
    active_target = None

    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            newline="",
            dir=str(path.parent),
            prefix=".managed-data-filter-",
            suffix=".tmp",
            delete=False,
        ) as destination:
            temporary_path = pathlib.Path(destination.name)
            with path.open("r", encoding="utf-8", newline="") as source:
                for line in source:
                    if active_target is not None:
                        if line.rstrip("\r\n") == r"\.":
                            active_target = None
                        continue

                    match = COPY_HEADER.match(line)
                    if match is not None:
                        schema = identifier_value(match.group("schema"))
                        table = identifier_value(match.group("table"))
                        if schema.casefold() in MANAGED_SCHEMAS:
                            active_target = f"{schema}.{table}"
                            counts[active_target] += 1
                            continue

                    destination.write(line)

        if active_target is not None:
            raise ValueError(
                "Managed-schema COPY block is missing its PostgreSQL terminator; "
                "original data dump was left unchanged."
            )

        os.chmod(temporary_path, mode)
        os.replace(temporary_path, path)
        temporary_path = None
        return counts
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)


def main():
    if len(sys.argv) != 2:
        raise SystemExit("Usage: sanitize_managed_data_dump.py <data.sql>")

    try:
        counts = sanitize_data_dump(sys.argv[1])
    except (OSError, UnicodeError, ValueError) as error:
        print("Managed data-dump filtering failed: " + str(error), file=sys.stderr)
        raise SystemExit(1)

    if counts:
        schemas = sorted({target.split(".", 1)[0] for target in counts})
        print(
            f"Excluded {sum(counts.values())} managed-schema COPY block(s) "
            f"from data.sql across: {', '.join(schemas)}. Row contents were not logged."
        )
    else:
        print("No Auth or Storage COPY blocks found in data.sql.")


if __name__ == "__main__":
    main()
