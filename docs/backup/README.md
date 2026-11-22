# Backup and recovery — deferred

**Status:** Backup and recovery are outside the current production migration scope.

As of 22 November 2026, the migration candidate withdraws the old automated backup, restore, media-recovery and temporary recovery-hosting workflows from GitHub Actions. The CMS no longer exposes those controls. The former Supabase Functions and Cloudflare Pages recovery deployment code are removed from the active project candidate.

This is a pause, not a data-deletion operation:

- Existing files in the owner's Google Drive are untouched.
- No external Google Drive, Supabase or Cloudflare account or project has been deleted by these repository changes.
- No backup archives or recovered website content have been deleted.
- Previous implementation code remains available in Git history, but must not be run as a current procedure.

A new backup and recovery design will be considered after the production migration. Until then, do not use older instructions, workflows, or restore scripts from historical commits as an operational recovery process.
