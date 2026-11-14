create table public.human_archive_favorites (
  record_id bigint primary key check (record_id > 0),
  created_at timestamptz not null default now()
);

alter table public.human_archive_favorites enable row level security;

revoke all on table public.human_archive_favorites from anon, authenticated;
grant select on table public.human_archive_favorites to anon, authenticated;
grant insert, delete on table public.human_archive_favorites to authenticated;

create policy "Anyone can read Human Archive favorites"
  on public.human_archive_favorites
  for select
  to anon, authenticated
  using (true);

create policy "CMS admins can star Human Archive records"
  on public.human_archive_favorites
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.vha_cms_admins admin
      where admin.user_id = (select auth.uid())
    )
  );

create policy "CMS admins can unstar Human Archive records"
  on public.human_archive_favorites
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.vha_cms_admins admin
      where admin.user_id = (select auth.uid())
    )
  );
