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

- `poetry-submit`: allows the public read-only archive GET path; rejects all non-GET/non-OPTIONS requests on the exact drill project before owner-token access or any Webflow write.
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

## Not yet a complete website failover

The restored backend is not yet a working staging copy of the website. Several static frontend files still hard-code the production project ref and publishable key, including:

- `index.html` (CSP and resource host allowlists)
- `home.js`
- `creator-posting.js`
- `analytics.js`
- `cms/cms.js`
- `posts/posts.js`

No production frontend files, production Supabase project, production Webflow content, DNS, or live website deployment were changed during this drill.

A separate staging website deployment must be prepared with the drill project's URL/key, Storage host, Edge Function URLs, CORS/CSP rules, and Auth redirect settings. It must be hosted separately from the production site. Until that isolated preview exists and is tested, this drill proves backend recovery—not full website failover.

## Outstanding integration dependencies

The backup restores Vault values, but not Edge Function runtime environment variables or third-party credentials. In particular:

- Turnstile integration needs a staging-compatible site/secret configuration and a dedicated `SYS_TRANSMISSION_RATE_SALT`.
- Contact email delivery is deliberately disabled on the drill.
- Google OAuth callback remains undeployed; the older route is not needed by the current Drive backup workflow.
- Project-level Auth provider, redirect URL, SMTP, and other dashboard configuration must be checked separately for a real failover.

Keep scheduled backups disabled until the first live backup plus the complete, isolated website recovery procedure has been exercised. The hosted restore workflow remains manual-only.
