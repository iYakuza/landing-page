-- Atomically save a Transmission's canonical body and its Human Archive chamber structure.
-- SECURITY INVOKER preserves the existing RLS policies on both tables.

begin;

create or replace function public.save_human_archive_transmission(
  p_post_id uuid,
  p_transmission_body text,
  p_prompt_style text,
  p_lyrics_style text,
  p_output_text text,
  p_output_media jsonb,
  p_media_items jsonb default null
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_archive_record_id bigint;
begin
  if auth.uid() is null or not exists (
    select 1
    from public.vha_cms_admins admin
    where admin.user_id = auth.uid()
  ) then
    raise exception 'CMS admin access required'
      using errcode = '42501';
  end if;

  if p_media_items is not null and jsonb_typeof(p_media_items) <> 'array' then
    raise exception 'Media items must be a JSON array'
      using errcode = '22023';
  end if;

  update public.vha_posts
  set
    content_html = coalesce(p_transmission_body, ''),
    media_items = coalesce(p_media_items, media_items),
    media_url = case
      when p_media_items is null then media_url
      else nullif(p_media_items -> 0 ->> 'url', '')
    end,
    media_path = case
      when p_media_items is null then media_path
      else nullif(p_media_items -> 0 ->> 'path', '')
    end,
    media_type = case
      when p_media_items is null then media_type
      else nullif(p_media_items -> 0 ->> 'type', '')
    end,
    updated_at = now()
  where id = p_post_id
  returning archive_record_id into v_archive_record_id;

  if not found then
    raise exception 'Transmission not found'
      using errcode = 'P0002';
  end if;

  insert into public.human_archive_record_structures (
    record_id,
    transmission_body,
    prompt_style,
    lyrics_style,
    output_text,
    output_media,
    updated_at,
    updated_by
  )
  values (
    v_archive_record_id,
    coalesce(p_transmission_body, ''),
    coalesce(p_prompt_style, ''),
    coalesce(p_lyrics_style, ''),
    coalesce(p_output_text, ''),
    coalesce(p_output_media, '{}'::jsonb),
    now(),
    auth.uid()
  )
  on conflict (record_id) do update
  set
    transmission_body = excluded.transmission_body,
    prompt_style = excluded.prompt_style,
    lyrics_style = excluded.lyrics_style,
    output_text = excluded.output_text,
    output_media = excluded.output_media,
    updated_at = excluded.updated_at,
    updated_by = excluded.updated_by;
end;
$$;

revoke all on function public.save_human_archive_transmission(uuid,text,text,text,text,jsonb,jsonb)
  from public, anon, service_role;
grant execute on function public.save_human_archive_transmission(uuid,text,text,text,text,jsonb,jsonb)
  to authenticated;

comment on function public.save_human_archive_transmission(uuid,text,text,text,text,jsonb,jsonb) is
  'Atomically saves a Transmission body and its Human Archive chamber structure while preserving the original post UUID, slug, status and archive numeric ID.';

commit;