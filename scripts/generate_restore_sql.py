#!/usr/bin/env python3
"""Generate SQL restore scripts from the encrypted archive's managed-data exports."""
import argparse
import json
import pathlib

def sql_literal(value):
    return "'" + str(value).replace("'", "''") + "'"

def ident(value):
    return '"' + str(value).replace('"', '""') + '"'

parser = argparse.ArgumentParser()
parser.add_argument("--root", required=True, type=pathlib.Path)
args = parser.parse_args()
root = args.root
restore_dir = root / "restore"
restore_dir.mkdir(parents=True, exist_ok=True)

# Restore the migration ledger separately because it is excluded from the app schema dump.
ledger = json.loads((root / "database" / "migration-ledger.json").read_text(encoding="utf-8"))
if not isinstance(ledger, list):
    raise SystemExit("Migration ledger export must be a JSON array.")
ledger_lines = [
    "-- Restore the source project's applied migration history into a fresh compatible Supabase project.",
    "begin;",
]
if ledger:
    payload = json.dumps(ledger, ensure_ascii=False, separators=(",", ":"))
    ledger_lines.append(
        "insert into supabase_migrations.schema_migrations "
        "(version, statements, name, created_by, idempotency_key, rollback) "
        "select version, statements, name, created_by, idempotency_key, rollback "
        "from jsonb_populate_recordset(null::supabase_migrations.schema_migrations, " +
        sql_literal(payload) + "::jsonb) "
        "on conflict (version) do update set "
        "statements = excluded.statements, name = excluded.name, "
        "created_by = excluded.created_by, idempotency_key = excluded.idempotency_key, "
        "rollback = excluded.rollback;"
    )
ledger_lines.append("commit;")
(restore_dir / "migration-ledger-restore.sql").write_text("\n".join(ledger_lines) + "\n", encoding="utf-8")

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

# Storage API uploads create new object rows; restore the original ownership fields afterward.
objects_file = root / "storage" / "objects-metadata.json"
storage_objects = json.loads(objects_file.read_text(encoding="utf-8")) if objects_file.exists() else []
owner_lines = ["-- Restore Storage object owner metadata after the object bytes have been uploaded."]
if storage_objects:
    values = []
    seen = set()
    for item in storage_objects:
        bucket_id = item.get("bucket_id")
        name = item.get("name")
        if not isinstance(bucket_id, str) or not bucket_id or not isinstance(name, str) or not name:
            raise SystemExit("Storage object metadata contains an invalid bucket or object name.")
        key = (bucket_id, name)
        if key in seen:
            raise SystemExit("Storage object metadata contains duplicate bucket/name pairs.")
        seen.add(key)
        owner_id = item.get("owner_id")
        owner = item.get("owner")
        owner_id_sql = "NULL::text" if owner_id is None else sql_literal(owner_id) + "::text"
        owner_sql = "NULL::uuid" if owner is None else sql_literal(owner) + "::uuid"
        values.append(
            "(" + sql_literal(bucket_id) + "::text, " + sql_literal(name) +
            "::text, " + owner_id_sql + ", " + owner_sql + ")"
        )
    owner_lines.append(
        "update storage.objects as target set owner_id = source.owner_id, owner = source.owner "
        "from (values " + ", ".join(values) +
        ") as source(bucket_id, name, owner_id, owner) "
        "where target.bucket_id = source.bucket_id and target.name = source.name;"
    )
(restore_dir / "storage-owners.sql").write_text("\n".join(owner_lines) + "\n", encoding="utf-8")

policy_file = root / "storage" / "policies.json"
storage_policies = json.loads(policy_file.read_text(encoding="utf-8")) if policy_file.exists() else []
policy_lines = ["-- Custom Storage RLS policies captured from the source project."]
security_file = root / "storage" / "security-settings.json"
if security_file.exists():
    security_settings = json.loads(security_file.read_text(encoding="utf-8"))
    table_rows = security_settings.get("tables", [])
    table_names = [item["table"] for item in table_rows]
    if any(name not in ("buckets", "objects") for name in table_names):
        raise SystemExit("Storage security export contains an unexpected table.")
    if table_names:
        owners = {item.get("owner") for item in table_rows}
        if len(owners) != 1 or not all(isinstance(owner, str) and owner for owner in owners):
            raise SystemExit("Storage tables must have one recorded owner for a safe ACL restore.")
        storage_owner = next(iter(owners))
        policy_lines.append("SET ROLE " + ident(storage_owner) + ";")
        table_array = "ARRAY[" + ", ".join(sql_literal(name) for name in table_names) + "]::text[]"
        policy_lines.extend([
            "-- Rebuild Storage table ACLs from the captured grant inventory.",
            "DO $restore_storage_acl$",
            "DECLARE role_name text; table_name text;",
            "BEGIN",
            "  FOREACH table_name IN ARRAY " + table_array + " LOOP",
            "    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE storage.%I FROM PUBLIC', table_name);",
            "    FOR role_name IN SELECT rolname FROM pg_roles LOOP",
            "      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE storage.%I FROM %I', table_name, role_name);",
            "    END LOOP;",
            "  END LOOP;",
            "END;",
            "$restore_storage_acl$;",
        ])
    allowed_privileges = {"SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER", "MAINTAIN"}
    for grant in security_settings.get("grants", []):
        table_name = grant.get("table")
        privilege = str(grant.get("privilege", "")).upper()
        grantee = grant.get("grantee")
        if table_name not in table_names or privilege not in allowed_privileges or not isinstance(grantee, str) or not grantee:
            raise SystemExit("Storage ACL export contains an unsupported grant record.")
        grantee_sql = "PUBLIC" if grantee.upper() == "PUBLIC" else ident(grantee)
        grant_option = " WITH GRANT OPTION" if grant.get("grantable") else ""
        policy_lines.append(
            "grant " + privilege + " on table \"storage\"." + ident(table_name) +
            " to " + grantee_sql + grant_option + ";"
        )
    for table in table_rows:
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
if security_file.exists() and table_rows:
    policy_lines.append("RESET ROLE;")
(restore_dir / "storage-policies.sql").write_text("\n".join(policy_lines) + "\n", encoding="utf-8")

print(
    f"Generated restore SQL for {len(ledger)} migrations, {len(users)} Auth users, "
    f"{len(identities)} identities, {len(vault)} Vault secrets, and {len(storage_policies)} Storage policies."
)
