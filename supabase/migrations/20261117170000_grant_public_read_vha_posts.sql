-- Allow public visitors to read published creator posts through the Supabase Data API.
-- RLS remains enabled and the existing anon SELECT policy limits visible rows to status = 'published'.

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_class relation
    where relation.oid = 'public.vha_posts'::regclass
      and relation.relrowsecurity
  ) then
    raise exception 'Refusing to grant anonymous access: RLS is not enabled on public.vha_posts';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_policies policy
    where policy.schemaname = 'public'
      and policy.tablename = 'vha_posts'
      and policy.cmd = 'SELECT'
      and 'anon' = any(policy.roles)
      and policy.qual like '%published%'
  ) then
    raise exception 'Refusing to grant anonymous access: published-only anon SELECT policy is missing';
  end if;
end;
$$;

grant select on table public.vha_posts to anon;
