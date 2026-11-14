# Hosted recovery drill — 14 November 2026

## Outcome

The hosted recovery workflow completed successfully in a separate Supabase project.

- GitHub Actions run: [#43597340381](https://github.com/iYakuza/landing-page/actions/runs/43597340381)
- Backup ID: `system-20261113T000000Z-428ddefb`
- Target project: `green-dream-restore-drill-2`
- Target ref: `ioguymqdeuuursizifnn`
- Region: `eu-central-1`
- Workflow commit: `72a8686e566aa9aa5d2ffdc451453213e1bfa8d0`
- Result: success

An independent post-run database query confirmed:

| Item | Restored |
|---|---:|
| Public application tables | 9 |
| Migration history entries | 35 |
| Auth users | 1 |
| Auth identities | 1 |
| Vault secrets | 4 |
| Storage buckets | 3 |
| Storage objects | 10 |
| Storage policies | 7 |

The workflow also verified row counts, Vault values by SHA-256 without printing secret contents, Storage object checksums, and ownership metadata.

## Drill-only Edge Function deployment

Three functions are deployed to the drill project:

- `poetry-submit`: serves the one published Poetry Archive item from a bundled, checked-in recovery snapshot on GET, without calling Webflow or reading the Webflow API token. The exact drill project rejects all non-GET/non-OPTIONS requests before owner-token access or any Webflow write.
- `secure-your-soul-transmissions`: deployed with its existing fail-closed checks. Public submissions remain unavailable until the drill has a Turnstile secret and a dedicated `SYS_TRANSMISSION_RATE_SALT`. Moderator operations, if used, operate only on this drill database.
- `contact-about-role`: deployed with an exact-project guard that rejects POST requests on the drill project before rate limiting or email delivery.

The following were deliberately not deployed:

- `google-drive-oauth-callback`: the repository version contained a hard-coded production callback URL, and its Google OAuth client credentials/redirect registration are not part of the backup. The current Apps Script backup/restore flow does not require this legacy OAuth route.
- `website-theme`: this function is retired and returns HTTP 410 by design.

## Drill-only database hardening

The restored snapshot included two SECURITY DEFINER RPCs that return Vault values. The drill project now denies `anon` and `authenticated` execution on:

- `get_poetry_owner_edit_token()`
- `get_poetry_publisher_config()`

It also denies public execution of the three backend-only rate-limit RPCs:

- `check_contact_rate_limit(text, integer)`
- `consume_poetry_submission_limit(text, integer)`
- `consume_sys_transmission_limit(text, integer)`

All five remain executable by `service_role`. Post-change privilege checks confirmed that `anon` and `authenticated` cannot execute them. These permissions were changed directly on the drill database after restore; they are drill hardening, not part of the archived production snapshot.

Remaining Supabase advisor notices include RLS-enabled tables with no policies (`sys_transmissions` and `sys_transmission_limits`), which intentionally remain inaccessible through public table access, the public aggregate-only `vha_public_analytics_summary()` SECURITY DEFINER RPC, and disabled leaked-password protection. Review the latter two according to the intended production access model before any future production change.

## Isolated website recovery preview

A separate static website preview has now been deployed from the `recovery-drill-preview` branch:

- URL: https://green-dream-recovery-preview.pages.dev
- Cloudflare Pages project: `green-dream-recovery-preview`
- Source repository: `iYakuza/landing-page`
- Source branch: `recovery-drill-preview`
- Supabase backend: the restored drill project `ioguymqdeuuursizifnn`
- The owner CMS uses the drill project's Supabase URL and publishable key. A private **Recovery Centre** section links to the full-system backup, content/media backup, local validation, hosted restore, preview, and runbook workflows. These are launch links only; they do not dispatch Actions runs automatically.
- The owner manually confirmed that the Human Archive content appears. The EGO portrait was initially blocked by the Cloudflare Pages Content Security Policy. The WordPress media asset (media item 3013, `emanuel-ego-portrait.png`) was located, and the recovery branch CSP was updated to allow the WordPress media host. The new Pages deployment completed successfully and the owner confirmed the image appeared.
- The owner CMS Recovery Centre now includes launch links for full-system backup, content/media backup, local validation, hosted restore, recovery preview, runbooks, a guarded merged-branch cleanup workflow, and a one-time EGO portrait import workflow. The links do not dispatch Actions runs automatically.

This is an isolated, working preview—not a complete independent failover. Some assets and integrations still rely on external services.

## Remaining external dependencies and limitations

- The Human Archive EGO portrait is still referenced from WordPress.com. A one-time manual GitHub Actions workflow is available in the CMS Recovery Centre to copy the PNG into `assets/recovery/` on the recovery branch. After that run succeeds, the page reference and CSP can be switched to the local file and the WordPress image host removed from the recovery site's policy.
- The Human Archive catalogue contains 140 entries and those entries still link to their original WordPress records. The encrypted content/media backup exports WordPress post bodies and media into its offline recovery-site artifact, but this portable content export has not yet been integrated into the live recovery preview's Human Archive navigation.
- The Poetry Archive GET response no longer depends on Webflow: the drill-only `poetry-submit` function serves a static snapshot of the single published Webflow item. The production publication integration remains in source code, but the drill's write path is blocked.
- Contact email delivery is deliberately disabled by an exact-project guard. Do not add a live Resend key to the drill.
- Public transmission submissions remain dependent on staging-safe Turnstile configuration and a dedicated `SYS_TRANSMISSION_RATE_SALT`. Do not reuse production-only integration secrets without a separate safety review.
- Moderator operations in `secure-your-soul-transmissions` target only the drill database, but should be tested only with an owner-authorized account and synthetic content.
- `google-drive-oauth-callback` remains undeployed because the old code contains a production callback URL and its OAuth client/redirect setup is separate. The current Google Drive backup and restore workflows do not require it.
- `website-theme` is retired and intentionally not deployed.
- Supabase Auth provider settings, redirect allowlists, SMTP, domains, API keys, database credentials, and other project-level settings are not included in the backup. Check and configure these separately for a real failover.
- Auth sessions, MFA factors, and Auth audit history are not restored.
- The recovery preview is noindex and has no production custom domain. Do not repoint production DNS to it.

- The restored `vha_posts` and `poetry_submissions` media URLs have been rewritten to use the drill project's own Storage hostname where the referenced object exists. The restore workflow now performs the same rewrite automatically after restoring Storage objects, preventing future hosted restores from retaining source-project Storage URLs.
- The recovery Posts page now accepts image/video/audio URLs only from the restored Supabase Storage buckets or repository-local paths; WordPress image hosts were removed from its media allow-list and page CSP.

## Current operating safeguards

- Production Supabase project `verse-after-hours` and the live website were not modified by the hosted restore or recovery-preview changes.
- The drill project's write and email/publication paths remain restricted as described above.
- The hosted restore workflow remains manual-only and must target a NEW, EMPTY Supabase project. The current drill project is populated and must not be used as a fresh restore target.
- Scheduled backups remain disabled by owner preference. Do not set `BACKUP_ENABLED=true` or create a schedule without explicit approval.
- PR #20 remains open, draft, and unmerged. The working restore implementation remains on `backup/apps-script-transfer-redesign`; select this branch in GitHub Actions while the PR is unmerged.

