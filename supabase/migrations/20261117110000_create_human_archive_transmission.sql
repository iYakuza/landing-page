create or replace function public.create_human_archive_transmission()
returns table (
  id uuid,
  archive_record_id bigint,
  title text,
  slug text,
  category text,
  excerpt text,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  published_at timestamptz
)
language plpgsql
security invoker
set search_path = pg_catalog, public
as $function$
declare
  v_title text := 'Untitled Transmission';
  v_base_slug text := 'untitled-transmission';
  v_slug text := v_base_slug;
  v_suffix integer := 2;
  v_post public.vha_posts%rowtype;
begin
  if auth.uid() is null or not exists (
    select 1 from public.vha_cms_admins admin where admin.user_id = auth.uid()
  ) then
    raise exception 'CMS admin access required' using errcode = '42501';
  end if;

  while exists (select 1 from public.vha_posts post where post.slug = v_slug) loop
    v_slug := v_base_slug || '-' || v_suffix::text;
    v_suffix := v_suffix + 1;
  end loop;

  insert into public.vha_posts (title, slug, category, excerpt, content_html, status)
  values (v_title, v_slug, 'TRANSMISSIONS', '', '', 'draft')
  returning * into v_post;

  insert into public.human_archive_record_structures (
    record_id, transmission_body, prompt_style, lyrics_style, output_text,
    output_media, updated_at, updated_by
  )
  values (
    v_post.archive_record_id, '', '', '', '', '{}'::jsonb, now(), auth.uid()
  );

  return query
  select v_post.id, v_post.archive_record_id, v_post.title, v_post.slug,
         v_post.category, v_post.excerpt, v_post.status, v_post.created_at,
         v_post.updated_at, v_post.published_at;
end;
$function$;

revoke all on function public.create_human_archive_transmission() from public, anon, service_role;
grant execute on function public.create_human_archive_transmission() to authenticated;
