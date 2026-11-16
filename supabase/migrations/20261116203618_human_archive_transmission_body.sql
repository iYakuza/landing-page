-- Add a dedicated rich-text transmission body without changing existing archive fields.
alter table public.human_archive_record_structures
  add column if not exists transmission_body text not null default '';
