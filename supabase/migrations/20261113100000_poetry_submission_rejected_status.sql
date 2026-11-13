-- Distinguish moderation decisions from technical submission failures.
alter table public.poetry_submissions
  drop constraint if exists poetry_submissions_status_check;

alter table public.poetry_submissions
  add constraint poetry_submissions_status_check
  check (status in ('pending', 'published', 'rejected', 'failed'));

-- These three records were submitted through the public viewer flow and
-- deliberately declined by an administrator during functionality testing.
-- Earlier CMS code incorrectly stored the moderation decision as "failed".
update public.poetry_submissions
set status = 'rejected'
where id in (
  '2ed5e8ec-6c2b-4f6b-b5d0-97e021c7b692',
  'b023c8f9-74ad-4448-b83b-a4f7c3fcd0af',
  'cc3bf634-ba9f-4899-91cf-1a8a9bf659f2'
)
and status = 'failed';
