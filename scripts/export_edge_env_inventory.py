#!/usr/bin/env python3
"""Record Edge Function environment variable names without reading their values."""
import argparse
import json
import pathlib
import re

parser = argparse.ArgumentParser()
parser.add_argument("--source", required=True, type=pathlib.Path)
parser.add_argument("--output", required=True, type=pathlib.Path)
args = parser.parse_args()
pattern = re.compile(r'Deno\.env\.get\(["\']([^"\']+)["\']\)')
functions = []
for source in sorted(args.source.glob("*/index.ts")):
    text = source.read_text(encoding="utf-8")
    names = sorted(set(pattern.findall(text)))
    functions.append({
        "function": source.parent.name,
        "environment_variable_names": names,
        "values_included": False,
    })
payload = {
    "note": "Variable names only. Runtime Edge Function secret values are not readable through this backup inventory.",
    "functions": functions,
}
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
print(f"Recorded environment variable names for {len(functions)} Edge Functions")
