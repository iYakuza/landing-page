create table public.human_archive_record_structures (
  record_id bigint primary key check (record_id > 0),
  prompt_style text not null default '',
  lyrics_style text not null default '',
  output_text text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.human_archive_record_structures enable row level security;

revoke all on table public.human_archive_record_structures from anon, authenticated;
grant select on table public.human_archive_record_structures to anon, authenticated;
grant insert, update on table public.human_archive_record_structures to authenticated;

create policy "Anyone can read Human Archive record structures"
  on public.human_archive_record_structures
  for select
  to anon, authenticated
  using (true);

create policy "CMS admins can create Human Archive record structures"
  on public.human_archive_record_structures
  for insert
  to authenticated
  with check (
    updated_by = (select auth.uid())
    and exists (
      select 1
      from public.vha_cms_admins admin
      where admin.user_id = (select auth.uid())
    )
  );

create policy "CMS admins can update Human Archive record structures"
  on public.human_archive_record_structures
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.vha_cms_admins admin
      where admin.user_id = (select auth.uid())
    )
  )
  with check (
    updated_by = (select auth.uid())
    and exists (
      select 1
      from public.vha_cms_admins admin
      where admin.user_id = (select auth.uid())
    )
  );
