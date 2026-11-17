-- Save Transmission metadata, publication state and chamber structure atomically.
-- SECURITY INVOKER keeps existing RLS policies in force. The existing
-- vha_posts_touch_updated_at trigger maintains published_at on status changes.

begin;

create or replace function public.save_human_archive_transmission_v4(
  p_post_id uuid,
  p_title text,
  p_slug text,
  p_category text,
  p_excerpt text,
  p_status text,
  p_transmission_body text,
  p_prompt_style text,
  p_lyrics_style text,
  p_output_text text,
  p_output_media jsonb,
  p_media_items jsonb
)
returns table(status text, published_at timestamptz, updated_at timestamptz)
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
  v_status text := lower(btrim(coalesce(p_status, '')));
  v_result_status text;
  v_result_published_at timestamptz;
  v_result_updated_at timestamptz;
  v_body text := coalesce(p_transmission_body, '');
begin
  if auth.uid() is null or not exists (
    select 1 from public.vha_cms_admins admin where admin.user_id = auth.uid()
  ) then
    raise exception 'CMS admin access required' using errcode = '42501';
  end if;
  if char_length(v_title) < 1 or char_length(v_title) > 180 then
    raise exception 'Title must contain between 1 and 180 characters' using errcode = '22023';
  end if;
  if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'Slug must contain lowercase letters, numbers and hyphens' using errcode = '22023';
  end if;
  if char_length(v_category) < 1 or char_length(v_category) > 60 then
    raise exception 'Category must contain between 1 and 60 characters' using errcode = '22023';
  end if;
  if char_length(v_excerpt) > 400 then
    raise exception 'Excerpt must be 400 characters or fewer' using errcode = '22023';
  end if;
  if v_status not in ('draft','published') then
    raise exception 'Publication status must be draft or published' using errcode = '22023';
  end if;
  if v_status = 'published' and char_length(btrim(v_body)) = 0 then
    raise exception 'Add transmission content before publishing' using errcode = '22023';
  end if;
  if v_status = 'published' and v_category = 'UNASSIGNED' then
    raise exception 'Choose a movement category before publishing' using errcode = '22023';
  end if;
  if p_media_items is null or jsonb_typeof(p_media_items) <> 'array' then
    raise exception 'Post media must be a JSON array' using errcode = '22023';
  end if;
  if jsonb_array_length(p_media_items) > 30 then
    raise exception 'A Transmission can have at most 30 post attachments' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_media_items) as media(item)
    where jsonb_typeof(media.item) <> 'object'
       or coalesce(media.item ->> 'url', '') = ''
       or coalesce(media.item ->> 'type', '') not in ('image','audio','video')
  ) then
    raise exception 'Each post attachment must include a URL and a valid media type' using errcode = '22023';
  end if;
  if p_output_media is null
    or jsonb_typeof(p_output_media) <> 'object'
    or (p_output_media - 'image' - 'audio' - 'video') <> '{}'::jsonb
    or (p_output_media ? 'image' and jsonb_typeof(p_output_media -> 'image') <> 'array')
    or (p_output_media ? 'audio' and jsonb_typeof(p_output_media -> 'audio') <> 'array')
    or (p_output_media ? 'video' and jsonb_typeof(p_output_media -> 'video') <> 'array')
  then
    raise exception 'Output media must be an object containing image, audio or video arrays' using errcode = '22023';
  end if;

  update public.vha_posts as post
  set title = v_title, slug = v_slug, category = v_category, excerpt = v_excerpt,
      content_html = v_body, status = v_status, media_items = p_media_items
  where post.id = p_post_id
  returning post.archive_record_id, post.status, post.published_at, post.updated_at
  into v_archive_record_id, v_result_status, v_result_published_at, v_result_updated_at;

  if not found then
    raise exception 'Transmission not found' using errcode = 'P0002';
  end if;

  insert into public.human_archive_record_structures (
    record_id, transmission_body, prompt_style, lyrics_style, output_text,
    output_media, updated_at, updated_by
  )
  values (
    v_archive_record_id, v_body, coalesce(p_prompt_style, ''),
    coalesce(p_lyrics_style, ''), coalesce(p_output_text, ''),
    p_output_media, now(), auth.uid()
  )
  on conflict (record_id) do update
  set transmission_body = excluded.transmission_body,
      prompt_style = excluded.prompt_style, lyrics_style = excluded.lyrics_style,
      output_text = excluded.output_text, output_media = excluded.output_media,
      updated_at = excluded.updated_at, updated_by = excluded.updated_by;

  return query select v_result_status, v_result_published_at, v_result_updated_at;
end;
$$;

revoke all on function public.save_human_archive_transmission_v4(uuid,text,text,text,text,text,text,text,text,text,jsonb,jsonb)
  from public, anon, service_role;
grant execute on function public.save_human_archive_transmission_v4(uuid,text,text,text,text,text,text,text,text,text,jsonb,jsonb)
  to authenticated;

comment on function public.save_human_archive_transmission_v4(uuid,text,text,text,text,text,text,text,text,text,jsonb,jsonb) is
  'Atomically saves Transmission metadata, publication status and Human Archive chamber structure. Existing vha_posts status trigger sets published_at on first publication and clears it on unpublish. Preserves post UUID and archive numeric ID while updating the explicitly supplied CMS attachment list.';

commit;