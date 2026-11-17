-- Permanently delete a Human Archive Transmission only while it is a draft.
-- The function runs as the authenticated caller, checks CMS-admin membership,
-- and returns only storage paths owned by this numeric Archive record.

begin;

grant delete on table public.human_archive_record_structures to authenticated;

drop policy if exists "CMS admins can delete Human Archive record structures"
  on public.human_archive_record_structures;
create policy "CMS admins can delete Human Archive record structures"
  on public.human_archive_record_structures
  for delete to authenticated
  using (
    exists (
      select 1
      from public.vha_cms_admins admin
      where admin.user_id = (select auth.uid())
    )
  );

create or replace function public.delete_human_archive_transmission_draft_v1(
  p_post_id uuid
)
returns table(archive_record_id bigint, storage_paths text[])
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_archive_record_id bigint;
  v_status text;
  v_media_items jsonb;
  v_legacy_media_path text;
  v_prefix text;
  v_storage_paths text[] := array[]::text[];
  v_deleted_count integer;
begin
  if auth.uid() is null or not exists (
    select 1
    from public.vha_cms_admins admin
    where admin.user_id = auth.uid()
  ) then
    raise exception 'CMS admin access required' using errcode = '42501';
  end if;

  select post.archive_record_id, post.status, post.media_items, post.media_path
  into v_archive_record_id, v_status, v_media_items, v_legacy_media_path
  from public.vha_posts post
  where post.id = p_post_id
  for update;

  if not found then
    raise exception 'Transmission not found' using errcode = 'P0002';
  end if;

  if v_status <> 'draft' then
    raise exception 'Only draft Transmissions can be deleted' using errcode = '55000';
  end if;

  v_prefix := 'human-archive/' || v_archive_record_id::text || '/';

  select coalesce(array_agg(distinct candidate.path), array[]::text[])
  into v_storage_paths
  from (
    select item.value ->> 'path' as path
    from jsonb_array_elements(coalesce(v_media_items, '[]'::jsonb)) as item(value)

    union all

    select output_item.value ->> 'path' as path
    from public.human_archive_record_structures structure
    cross join lateral jsonb_each(coalesce(structure.output_media, '{}'::jsonb)) as media_group(key, value)
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(media_group.value) = 'array'
        then media_group.value else '[]'::jsonb end
    ) as output_item(value)
    where structure.record_id = v_archive_record_id

    union all

    select v_legacy_media_path
  ) as candidate
  where candidate.path is not null
    and left(candidate.path, char_length(v_prefix)) = v_prefix;

  delete from public.human_archive_favorites favorite
  where favorite.record_id = v_archive_record_id;

  delete from public.human_archive_record_structures structure
  where structure.record_id = v_archive_record_id;

  delete from public.vha_posts post
  where post.id = p_post_id
    and post.status = 'draft';

  get diagnostics v_deleted_count = row_count;
  if v_deleted_count <> 1 then
    raise exception 'Draft Transmission was not deleted' using errcode = '55000';
  end if;

  return query select v_archive_record_id, v_storage_paths;
end;
$$;

revoke all on function public.delete_human_archive_transmission_draft_v1(uuid)
  from public, anon, service_role;
grant execute on function public.delete_human_archive_transmission_draft_v1(uuid)
  to authenticated;

comment on function public.delete_human_archive_transmission_draft_v1(uuid) is
  'Deletes only an authenticated CMS admin-owned draft Transmission, its Human Archive structure and favorites. Returns only storage paths beneath the matching permanent numeric Human Archive record prefix for best-effort client cleanup.';

commit;
