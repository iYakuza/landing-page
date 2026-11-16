alter table public.human_archive_record_structures
  add column if not exists output_media jsonb;

alter table public.human_archive_record_structures
  add constraint human_archive_record_structures_output_media_shape
  check (
    output_media is null
    or (
      jsonb_typeof(output_media) = 'object'
      and output_media - 'image' - 'audio' - 'video' = '{}'::jsonb
      and (not (output_media ? 'image') or jsonb_typeof(output_media->'image') = 'array')
      and (not (output_media ? 'audio') or jsonb_typeof(output_media->'audio') = 'array')
      and (not (output_media ? 'video') or jsonb_typeof(output_media->'video') = 'array')
    )
  );

grant select on table public.human_archive_record_structures to anon, authenticated;
grant insert, update on table public.human_archive_record_structures to authenticated;
