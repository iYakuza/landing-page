-- Ensure archive_record_id is allocated by the database and cannot be changed by clients.
-- Existing table-level INSERT/UPDATE grants on vha_posts are intentionally preserved.

begin;

-- Remove the column default so the trigger consumes exactly one sequence value per insert.
alter table public.vha_posts
  alter column archive_record_id drop default;

create or replace function public.assign_human_archive_record_id()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'INSERT' then
    new.archive_record_id := nextval('public.human_archive_record_id_seq'::regclass);
  else
    new.archive_record_id := old.archive_record_id;
  end if;

  return new;
end;
$$;

revoke all on function public.assign_human_archive_record_id() from public, anon, authenticated, service_role;

drop trigger if exists vha_posts_assign_human_archive_record_id
  on public.vha_posts;

create trigger vha_posts_assign_human_archive_record_id
before insert or update of archive_record_id
on public.vha_posts
for each row
execute function public.assign_human_archive_record_id();

-- Sequence access is needed only by the SECURITY DEFINER trigger function.
revoke all on sequence public.human_archive_record_id_seq
  from public, anon, authenticated, service_role;

comment on function public.assign_human_archive_record_id() is
  'Allocates immutable Human Archive numeric IDs for Transmissions; clients cannot supply or change archive_record_id.';

commit;
