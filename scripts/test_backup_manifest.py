#!/usr/bin/env python3
"""Test backup manifest generation and strict verification."""
import json
import pathlib
import subprocess
import sys
import tempfile

scripts = pathlib.Path(__file__).parent
create = scripts / "create_backup_manifest.py"
verify = scripts / "verify_backup_manifest.py"

def run(script, root, success):
    result = subprocess.run([sys.executable, str(script), str(root)], capture_output=True, text=True)
    if success and result.returncode:
        raise AssertionError(result.stderr or result.stdout)
    if not success and result.returncode == 0:
        raise AssertionError("Manifest verifier accepted an invalid or tampered backup.")
    return result

with tempfile.TemporaryDirectory() as temp:
    root = pathlib.Path(temp)
    (root / "database").mkdir()
    (root / "database" / "schema.sql").write_text("create table test (id int);\n", encoding="utf-8")
    (root / "database" / "data.sql").write_text("COPY test FROM stdin;\n1\n\\.\n", encoding="utf-8")
    (root / "nested").mkdir()
    (root / "nested" / "backup-manifest.json").write_text("payload file, not the root manifest", encoding="utf-8")

    run(create, root, True)
    run(verify, root, True)

    manifest_path = root / "backup-manifest.json"
    original = json.loads(manifest_path.read_text(encoding="utf-8"))

    tampered = dict(original)
    tampered["file_count"] += 1
    manifest_path.write_text(json.dumps(tampered), encoding="utf-8")
    run(verify, root, False)

    tampered = dict(original)
    tampered["files"] = original["files"] + [dict(original["files"][0])]
    tampered["file_count"] = len(tampered["files"])
    manifest_path.write_text(json.dumps(tampered), encoding="utf-8")
    run(verify, root, False)

    manifest_path.write_text(json.dumps(original), encoding="utf-8")
    with (root / "database" / "data.sql").open("a", encoding="utf-8") as stream:
        stream.write("tamper\n")
    run(verify, root, False)

print("Strict backup manifest tests passed.")
