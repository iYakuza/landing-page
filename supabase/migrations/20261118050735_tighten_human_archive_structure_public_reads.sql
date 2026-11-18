-- Preserve public access to legacy archive structures and published Transmissions,
-- while preventing unauthenticated and non-admin users from reading draft structures.

begin;

drop policy if exists "Anyone can read Human Archive record structures"
  on public.human_archive_record_structures;

create policy "Public can read legacy and published Transmission structures"
  on public.human_archive_record_structures
  for select
  to anon, authenticated
  using (
    record_id <= 3000
    or exists (
      select 1
      from public.vha_posts post
      where post.archive_record_id = human_archive_record_structures.record_id
        and post.status = 'published'
    )
  );

create policy "CMS admins can read all Human Archive record structures"
  on public.human_archive_record_structures
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.vha_cms_admins admin
      where admin.user_id = (select auth.uid())
    )
  );

commit;
