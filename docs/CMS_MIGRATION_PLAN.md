# Supabase-independent CMS migration

## Goal
The public site and the entire publishing workflow must operate without Supabase. GitHub is the published content source of truth; the Cloudflare backend provides private workflow services.

## Target components
- **GitHub Pages:** serves the existing public website and published collection JSON.
- **Canonical GitHub JSON:** `content/transmissions.json`, `content/signals.json`, and `content/human-archive.json`.
- **Cloudflare Worker:** secure API for administrator actions and visitor submissions. It will be exposed on a `workers.dev` hostname because this Cloudflare account currently has no custom domain zone configured.
- **Cloudflare D1 (EU jurisdiction):** private drafts, pending Signals, favourites, media metadata, audit history, and rate-limit counters.
- **Private object storage:** draft and pending-submission media must remain private until publication. Cloudflare R2 is the intended store, but R2 is not yet enabled in the account.
- **GitHub API:** the Worker publishes approved/published records and public media into the repository. GitHub credentials must be stored as Worker secrets, never in browser code or this repository.
- **Administrator identity:** GitHub OAuth, restricted to the explicitly allowlisted administrator account. OAuth client credentials and the allowed GitHub numeric user ID must be configured as Worker secrets/variables before login can be enabled.

## Private D1 database
Database: `landing-page-cms` (EU jurisdiction, read replication disabled; created 2026-11-19).
Schema is in `cloudflare/schema.sql` and has been applied to the new EU-jurisdiction database. It defines:
- administrator allowlist;
- private drafts with optimistic version numbers;
- pending/approved/rejected Signals submissions;
- Human Archive favourites;
- media metadata;
- audit log;
- basic submission rate-limit counters.

No public content is stored exclusively in D1. Published content is committed to the canonical GitHub JSON collections.

## Workflow rules
1. Public pages read published content from GitHub only. They must not query Supabase or use Supabase SDKs.
2. Draft autosave writes to the private CMS API/D1 and does not expose unpublished content in the public repository.
3. Draft media and visitor-submission media stay in private storage until publication/approval.
4. Publishing validates the draft, uploads approved media to the repository's canonical media folder, updates the correct JSON collection, and records an audit entry.
5. Signals visitor submissions are stored as pending; only an authenticated administrator can approve or reject them. Approval publishes the record to `content/signals.json`.
6. Administrator authentication and authorization are checked server-side on every privileged request. Browser-side flags are never treated as authorization.
7. Favourites are private CMS data and are only exposed to authenticated administrators.
8. Existing editor markup, controls, keyboard behavior, block model, layouts, and content renderers are preserved while their data transport is replaced.

## Rollout safety
- All work remains on `recovery/supabase-content-export-20261119`.
- GitHub Pages production branch `main` is not changed during development.
- Do not deploy a partially configured API or switch off Supabase in the live site until OAuth, GitHub publishing credentials, private media storage, editor CRUD, Signals moderation, and rollback tests pass.
- The old Supabase integration remains in place on the live branch only until cutover is complete; it is not the target architecture.

## Remaining setup
- Enable Cloudflare R2 in the Cloudflare dashboard and create a private bucket for drafts and pending uploads.
- Create a GitHub OAuth App with callback URL on the deployed Worker; configure its client ID/secret and allowlisted numeric GitHub user ID as Worker settings/secrets.
- Create a least-privilege GitHub credential for the Worker to write only to the website repository.
- Deploy the Worker to a `workers.dev` hostname and configure the public site to call it.
