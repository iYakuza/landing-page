-- Give every Transmission a stable numeric Human Archive identity.
-- Legacy Human Archive records keep their existing numeric IDs (currently 4–3000).
-- The UUID primary key remains unchanged for existing foreign keys and URLs.

begin;

create sequence if not exists public.human_archive_record_id_seq
  as bigint
  start with 3001
  increment by 1
  minvalue 1
  no maxvalue
  cache 1
  no cycle;

alter table public.vha_posts
  add column if not exists archive_record_id bigint;

-- Assign stable IDs to existing Transmissions in creation order.
-- This is metadata-only: content, UUIDs, slugs, statuses and media remain untouched.
with numbered_posts as (
  select
    id,
    3000 + row_number() over (order by created_at, id) as assigned_archive_record_id
  from public.vha_posts
  where archive_record_id is null
)
update public.vha_posts as posts
set archive_record_id = numbered_posts.assigned_archive_record_id
from numbered_posts
where posts.id = numbered_posts.id;

alter table public.vha_posts
  alter column archive_record_id
  set default nextval('public.human_archive_record_id_seq'::regclass);

alter table public.vha_posts
  alter column archive_record_id set not null;

create unique index if not exists vha_posts_archive_record_id_uidx
  on public.vha_posts (archive_record_id);

-- Advance beyond both the backfilled IDs and any ID already consumed by the sequence.
select setval(
  'public.human_archive_record_id_seq'::regclass,
  greatest(
    coalesce((select max(archive_record_id) from public.vha_posts), 3000),
    (select last_value from public.human_archive_record_id_seq),
    3000
  ),
  true
);

alter sequence public.human_archive_record_id_seq
  owned by public.vha_posts.archive_record_id;

revoke all on sequence public.human_archive_record_id_seq from public, anon;
grant usage, select on sequence public.human_archive_record_id_seq to authenticated, service_role;

comment on column public.vha_posts.archive_record_id is
  'Stable numeric Human Archive identity. Legacy static archive IDs are preserved; new Transmissions receive IDs from human_archive_record_id_seq.';

comment on sequence public.human_archive_record_id_seq is
  'Allocates numeric Human Archive identities for Transmissions; starts above the legacy static archive ID range.';

commit;
