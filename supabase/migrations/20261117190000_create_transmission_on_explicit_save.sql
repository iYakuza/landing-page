-- Create a Transmission and its Human Archive identity only when the editor is explicitly saved.
create or replace function public.create_human_archive_transmission_v2(
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
  p_media_items jsonb,
  p_media_width integer
)
returns table(
  post_id uuid,
  archive_record_id bigint,
  status text,
  published_at timestamptz,
  updated_at timestamptz
)
language plpgsql
set search_path = 'pg_catalog', 'public'
as $function$
declare
  v_title text := btrim(coalesce(p_title, ''));
  v_base_slug text := lower(btrim(coalesce(p_slug, '')));
  v_slug text := v_base_slug;
  v_suffix integer := 2;
  v_category text := upper(btrim(coalesce(p_category, '')));
  v_excerpt text := btrim(coalesce(p_excerpt, ''));
  v_status text := lower(btrim(coalesce(p_status, '')));
  v_body text := coalesce(p_transmission_body, '');
  v_output_media jsonb := coalesce(p_output_media, '{}'::jsonb);
  v_media_items jsonb := coalesce(p_media_items, '[]'::jsonb);
  v_media_width integer := coalesce(p_media_width, 100);
  v_post public.vha_posts%rowtype;
begin
  if auth.uid() is null or not exists (
    select 1 from public.vha_cms_admins admin where admin.user_id = auth.uid()
  ) then
    raise exception 'CMS admin access required' using errcode = '42501';
  end if;

  if char_length(v_title) < 1 or char_length(v_title) > 180 then
    raise exception 'Title must contain between 1 and 180 characters' using errcode = '22023';
  end if;
  if v_base_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'Slug must contain lowercase letters, numbers and hyphens' using errcode = '22023';
  end if;
  if v_category not in (
    'HUMAN ARCHIVE', 'THE AWAKENING', 'THE DESCENT',
    'THE RECONNECTION', 'THE TRANSFORMATION', 'THE RETURN'
  ) then
    raise exception 'Choose Human Archive or one of the five Movements' using errcode = '22023';
  end if;
  if char_length(v_excerpt) > 400 then
    raise exception 'Excerpt must be 400 characters or fewer' using errcode = '22023';
  end if;
  if v_status not in ('draft', 'published') then
    raise exception 'Publication status must be draft or published' using errcode = '22023';
  end if;
  if v_status = 'published' and char_length(btrim(v_body)) = 0 then
    raise exception 'Add transmission content before publishing' using errcode = '22023';
  end if;
  if jsonb_typeof(v_media_items) is distinct from 'array' then
    raise exception 'Post media must be an array containing at most 30 attachments' using errcode = '22023';
  end if;
  if jsonb_array_length(v_media_items) > 30 then
    raise exception 'Post media must be an array containing at most 30 attachments' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_media_items) as media(item)
    where jsonb_typeof(media.item) <> 'object'
       or coalesce(media.item ->> 'url', '') = ''
       or coalesce(media.item ->> 'type', '') not in ('image', 'audio', 'video')
  ) then
    raise exception 'Each post attachment must include a URL and a valid media type' using errcode = '22023';
  end if;
  if jsonb_typeof(v_output_media) <> 'object'
    or (v_output_media - 'image' - 'audio' - 'video') <> '{}'::jsonb
    or (v_output_media ? 'image' and jsonb_typeof(v_output_media -> 'image') <> 'array')
    or (v_output_media ? 'audio' and jsonb_typeof(v_output_media -> 'audio') <> 'array')
    or (v_output_media ? 'video' and jsonb_typeof(v_output_media -> 'video') <> 'array')
  then
    raise exception 'Output media must contain only image, audio or video arrays' using errcode = '22023';
  end if;
  if v_media_width < 20 or v_media_width > 100 or mod(v_media_width, 5) <> 0 then
    raise exception 'Media width must be between 20 and 100 in increments of 5' using errcode = '22023';
  end if;

  -- Serialize slug selection and insert in one transaction; a collision receives a deterministic suffix.
  perform pg_advisory_xact_lock(hashtext('public.vha_posts:create_human_archive_transmission')::bigint);
  while exists (select 1 from public.vha_posts post where post.slug = v_slug) loop
    v_slug := v_base_slug || '-' || v_suffix::text;
    v_suffix := v_suffix + 1;
  end loop;

  insert into public.vha_posts (
    title, slug, category, excerpt, content_html, status, media_items, media_width
  ) values (
    v_title, v_slug, v_category, v_excerpt, v_body, v_status, v_media_items, v_media_width
  )
  returning * into v_post;

  insert into public.human_archive_record_structures (
    record_id, transmission_body, prompt_style, lyrics_style, output_text,
    output_media, updated_at, updated_by
  ) values (
    v_post.archive_record_id, v_body, coalesce(p_prompt_style, ''),
    coalesce(p_lyrics_style, ''), coalesce(p_output_text, ''),
    v_output_media, now(), auth.uid()
  );

  return query
  select v_post.id, v_post.archive_record_id, v_post.status,
         v_post.published_at, v_post.updated_at;
end;
$function$;

revoke all on function public.create_human_archive_transmission_v2(
  text, text, text, text, text, text, text, text, text, jsonb, jsonb, integer
) from public, anon, service_role;
grant execute on function public.create_human_archive_transmission_v2(
  text, text, text, text, text, text, text, text, text, jsonb, jsonb, integer
) to authenticated;
