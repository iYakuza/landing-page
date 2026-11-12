#!/usr/bin/env python3
"""Compare restored Storage RLS policies and table security settings with the snapshot."""
import json
import os
import subprocess
import sys
import pathlib

root = pathlib.Path(sys.argv[1])
database_url = os.environ.get("DATABASE_URL", "")
if not database_url:
    raise SystemExit("DATABASE_URL is required.")

def query(sql):
    result = subprocess.run(
        ["psql", database_url, "-X", "-v", "ON_ERROR_STOP=1", "-Atc", sql],
        check=False, capture_output=True, text=True,
    )
    if result.returncode:
        raise RuntimeError("Storage security query failed: " + result.stderr.strip()[:1000])
    return json.loads(result.stdout.strip() or "[]")

expected_policies = json.loads((root / "storage" / "policies.json").read_text(encoding="utf-8"))
actual_policies = query(
    "select coalesce(json_agg(json_build_object('schemaname',schemaname,'tablename',tablename,'policyname',policyname,'permissive',permissive,'roles',roles,'cmd',cmd,'qual',qual,'with_check',with_check) order by tablename,policyname),'[]'::json) from pg_policies where schemaname='storage'"
)
if expected_policies != actual_policies:
    raise SystemExit("Restored Storage RLS policies do not match the source snapshot.")

expected_security = json.loads((root / "storage" / "security-settings.json").read_text(encoding="utf-8"))
actual_security = query(
    "select json_build_object('tables',(select coalesce(json_agg(json_build_object('table',c.relname,'rowsecurity',c.relrowsecurity,'forcerowsecurity',c.relforcerowsecurity) order by c.relname),'[]'::json) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='storage' and c.relkind in ('r','p') and c.relname in ('buckets','objects')),'grants',(select coalesce(json_agg(json_build_object('table',c.relname,'grantee',coalesce(pg_get_userbyid(a.grantee),'PUBLIC'),'grantor',pg_get_userbyid(a.grantor),'privilege',a.privilege_type,'grantable',a.is_grantable) order by c.relname,coalesce(pg_get_userbyid(a.grantee),'PUBLIC'),pg_get_userbyid(a.grantor),a.privilege_type),'[]'::json) from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a where n.nspname='storage' and c.relkind in ('r','p') and c.relname in ('buckets','objects') and a.grantee <> c.relowner and a.grantee <> a.grantor and a.grantee <> (select oid from pg_roles where rolname = current_user)))::text"
)
def without_grantor(value):
    return {
        "tables": value.get("tables", []),
        "grants": [
            {key: item.get(key) for key in ("table", "grantee", "privilege", "grantable")}
            for item in value.get("grants", [])
        ],
    }

if without_grantor(expected_security) != without_grantor(actual_security):
    raise SystemExit("Restored Storage RLS/ACL settings do not match the source snapshot; details suppressed.")
print(f"Verified {len(actual_policies)} Storage policies and bucket/object security settings.")
