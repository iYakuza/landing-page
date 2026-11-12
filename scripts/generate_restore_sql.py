#!/usr/bin/env python3
"""Generate SQL restore scripts from the encrypted archive's Auth and Vault exports."""
import argparse
import json
import pathlib

def sql_literal(value):
    return "'" + str(value).replace("'", "''") + "'"

parser = argparse.ArgumentParser()
parser.add_argument("--root", required=True, type=pathlib.Path)
args = parser.parse_args()
root = args.root
restore_dir = root / "restore"
restore_dir.mkdir(parents=True, exist_ok=True)

users = json.loads((root / "auth" / "users.json").read_text(encoding="utf-8"))
identities = json.loads((root / "auth" / "identities.json").read_text(encoding="utf-8"))
auth_lines = [
    "-- Sensitive account data. Run only against a fresh compatible Supabase Auth schema.",
    "-- This restores users and identities, not sessions, MFA factors, or audit history.",
    "begin;",
]
for table, rows in (("auth.users", users), ("auth.identities", identities)):
    if rows:
        payload = json.dumps(rows, ensure_ascii=False, separators=(",", ":"))
        auth_lines.append(
            "insert into " + table +
            " select * from jsonb_populate_recordset(null::" + table + ", " +
            sql_literal(payload) + "::jsonb);"
        )
auth_lines.append("commit;")
(restore_dir / "auth-restore.sql").write_text("\n".join(auth_lines) + "\n", encoding="utf-8")

vault = json.loads((root / "secrets" / "vault-secrets.json").read_text(encoding="utf-8"))
vault_lines = [
    "-- Sensitive secret values. Run only after the target project's Supabase Vault extension is enabled.",
    "-- These values are re-encrypted under the target project's Vault key.",
]
for item in vault:
    secret = item.get("secret")
    name = item.get("name")
    if secret is None or not name:
        raise SystemExit("Vault export contains a record without a secret or name.")
    description = item.get("description") or ""
    vault_lines.append(
        "select vault.create_secret(" +
        sql_literal(secret) + ", " + sql_literal(name) + ", " +
        sql_literal(description) + ");"
    )
(restore_dir / "vault-restore.sql").write_text("\n".join(vault_lines) + "\n", encoding="utf-8")

policy_file = root / "storage" / "policies.json"
storage_policies = json.loads(policy_file.read_text(encoding="utf-8")) if policy_file.exists() else []
policy_lines = [
    "-- Custom Storage RLS policies captured from the source project.",
]
def ident(value):
    return '"' + str(value).replace('"', '""') + '"'
security_file = root / "storage" / "security-settings.json"
if security_file.exists():
    security_settings = json.loads(security_file.read_text(encoding="utf-8"))
    for table in security_settings.get("tables", []):
        table_name = ident(table["table"])
        state = "enable" if table.get("rowsecurity") else "disable"
        force = "force" if table.get("forcerowsecurity") else "no force"
        policy_lines.append("alter table \"storage\"." + table_name + " " + state + " row level security;")
        policy_lines.append("alter table \"storage\"." + table_name + " " + force + " row level security;")
for policy in storage_policies:
    table = ident(policy["tablename"])
    name = ident(policy["policyname"])
    schema = ident(policy["schemaname"])
    roles = policy.get("roles") or ["public"]
    role_sql = ", ".join("PUBLIC" if role.lower() == "public" else ident(role) for role in roles)
    command = policy["cmd"].upper()
    mode = policy["permissive"].upper()
    policy_lines.append("drop policy if exists " + name + " on " + schema + "." + table + ";")
    statement = "create policy " + name + " on " + schema + "." + table + " as " + mode + " for " + command + " to " + role_sql
    if policy.get("qual"):
        statement += " using (" + policy["qual"] + ")"
    if policy.get("with_check"):
        statement += " with check (" + policy["with_check"] + ")"
    policy_lines.append(statement + ";")
(restore_dir / "storage-policies.sql").write_text("\n".join(policy_lines) + "\n", encoding="utf-8")

print(f"Generated restore SQL for {len(users)} Auth users, {len(identities)} identities, and {len(vault)} Vault secrets, and " + str(len(storage_policies)) + " Storage policies")
