-- Secure Your Soul: private, pending-first visitor transmissions.
-- Public visitors cannot read or write these tables directly; the Edge Function uses service credentials.
create table if not exists public.sys_transmissions (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  message text not null check (char_length(btrim(message)) between 1 and 10000),
  display_name text null check (display_name is null or char_length(display_name) <= 80),
  contact_email text null check (contact_email is null or char_length(contact_email) <= 254),
  rights_confirmed boolean not null default false check (rights_confirmed),
  publication_consent boolean not null default false check (publication_consent),
  status text not null default 'pending' check (status in ('pending','rejected','published','removed')),
  moderation_note text null check (moderation_note is null or char_length(moderation_note) <= 1000),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz null,
  reviewed_by uuid null references auth.users(id),
  published_post_id uuid null references public.vha_posts(id)
);

comment on table public.sys_transmissions is 'Private, pending-first submissions for the fictional Secure Your Soul counter-archive. Never auto-publish visitor content.';
alter table public.sys_transmissions enable row level security;
revoke all on table public.sys_transmissions from anon, authenticated;
grant all on table public.sys_transmissions to service_role;
create index if not exists sys_transmissions_status_created_at_idx on public.sys_transmissions (status, created_at desc);

create table if not exists public.sys_transmission_limits (
  ip_hash text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0)
);
alter table public.sys_transmission_limits enable row level security;
revoke all on table public.sys_transmission_limits from anon, authenticated;
grant all on table public.sys_transmission_limits to service_role;

create or replace function public.consume_sys_transmission_limit(p_ip_hash text, p_max_requests integer default 3)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_count integer;
begin
  if p_ip_hash is null or length(p_ip_hash) < 32 or p_max_requests < 1 or p_max_requests > 10 then return false; end if;
  insert into public.sys_transmission_limits(ip_hash, window_started_at, request_count)
  values (p_ip_hash, now(), 1)
  on conflict (ip_hash) do update
    set request_count = case when public.sys_transmission_limits.window_started_at < now() - interval '1 hour' then 1 else public.sys_transmission_limits.request_count + 1 end,
        window_started_at = case when public.sys_transmission_limits.window_started_at < now() - interval '1 hour' then now() else public.sys_transmission_limits.window_started_at end
  returning request_count into v_count;
  return v_count <= p_max_requests;
end;
$$;
revoke all on function public.consume_sys_transmission_limit(text, integer) from public, anon, authenticated;
grant execute on function public.consume_sys_transmission_limit(text, integer) to service_role;
