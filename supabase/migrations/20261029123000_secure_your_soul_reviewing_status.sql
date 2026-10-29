alter table public.sys_transmissions drop constraint if exists sys_transmissions_status_check;
alter table public.sys_transmissions add constraint sys_transmissions_status_check
  check (status in ('pending','reviewing','rejected','published','removed'));