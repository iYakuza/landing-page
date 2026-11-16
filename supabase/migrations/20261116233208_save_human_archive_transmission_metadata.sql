-- Save Transmission metadata and chamber structure atomically.
-- SECURITY INVOKER preserves the existing RLS policies on both tables.

begin;

create or replace function public.save_human_archive_transmission_v2(
  p_post_id uuid,
  p_title text,
  p_slug text,
  p_category text,
  p_excerpt text,
  p_transmission_body text,
  p_prompt_style text,
  p_lyrics_style text,
  p_output_text text,
  p_output_media jsonb
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_archive_record_id bigint;
  v_title text := btrim(coalesce(p_title, ''));
  v_slug text := lower(btrim(coalesce(p_slug, '')));
  v_category text := upper(btrim(coalesce(p_category, '')));
  v_excerpt text := btrim(coalesce(p_excerpt, ''));
begin
  if auth.uid() is null or not exists (
    select 1
    from public.vha_cms_admins admin
    where admin.user_id = auth.uid()
  ) then
    raise exception 'CMS admin access required'
      using errcode = '42501';
  end if;

  if char_length(v_title) < 1 or char_length(v_title) > 180 then
    raise exception 'Title must contain between 1 and 180 characters'
      using errcode = '22023';
  end if;

  if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'Slug must contain lowercase letters, numbers and hyphens'
      using errcode = '22023';
  end if;

  if char_length(v_category) < 1 or char_length(v_category) > 60 then
    raise exception 'Category must contain between 1 and 60 characters'
      using errcode = '22023';
  end if;

  if char_length(v_excerpt) > 400 then
    raise exception 'Excerpt must be 400 characters or fewer'
      using errcode = '22023';
  end if;

  if p_output_media is null
    or jsonb_typeof(p_output_media) <> 'object'
    or (p_output_media - 'image' - 'audio' - 'video') <> '{}'::jsonb
    or (p_output_media ? 'image' and jsonb_typeof(p_output_media -> 'image') <> 'array')
    or (p_output_media ? 'audio' and jsonb_typeof(p_output_media -> 'audio') <> 'array')
    or (p_output_media ? 'video' and jsonb_typeof(p_output_media -> 'video') <> 'array')
  then
    raise exception 'Output media must be an object containing image, audio or video arrays'
      using errcode = '22023';
  end if;

  update public.vha_posts
  set
    title = v_title,
    slug = v_slug,
    category = v_category,
    excerpt = v_excerpt,
    content_html = coalesce(p_transmission_body, ''),
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
    p_output_media,
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

revoke all on function public.save_human_archive_transmission_v2(uuid,text,text,text,text,text,text,text,text,jsonb)
  from public, anon, service_role;
grant execute on function public.save_human_archive_transmission_v2(uuid,text,text,text,text,text,text,text,text,jsonb)
  to authenticated;

comment on function public.save_human_archive_transmission_v2(uuid,text,text,text,text,text,text,text,text,jsonb) is
  'Atomically saves a Transmission title, slug, category, excerpt, body and Human Archive chamber structure while preserving post UUID, archive numeric ID, publication status, publication timestamp and all media associations.';

commit;
