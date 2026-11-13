-- Distinguish moderation decisions from technical submission failures.
alter table public.poetry_submissions
  drop constraint if exists poetry_submissions_status_check;

alter table public.poetry_submissions
  add constraint poetry_submissions_status_check
  check (status in ('pending', 'published', 'rejected', 'failed'));

-- Earlier CMS versions recorded an administrator's DECLINE action as
-- "failed". These rows have no technical error and were never published.
update public.poetry_submissions
set status = 'rejected'
where status = 'failed'
  and error_message is null
  and published_at is null;
