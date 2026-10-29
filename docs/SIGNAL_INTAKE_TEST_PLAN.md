# Secure Your Soul — Signal intake test plan

This plan is a release gate. Do not connect the public form or announce submissions until the critical cases below pass against the deployed Supabase project.

## Preconditions

- [ ] Configure `SYS_ALLOWED_ORIGIN` to the exact production origin.
- [ ] Configure `SYS_TRANSMISSION_RATE_SALT` with at least 32 random characters.
- [ ] Configure `TURNSTILE_SECRET_KEY` and the matching public Turnstile site key.
- [ ] Confirm the Edge Function runtime can access the project URL, server credential, and anon/publishable key.
- [ ] Create/confirm a moderator account in `vha_cms_admins`.
- [ ] Use only clearly marked test content; do not submit personal or sensitive information.

## Submission endpoint

| Case | Input / action | Expected result |
|---|---|---|
| S-01 | `OPTIONS` from the configured origin | 204; CORS allows only the configured origin |
| S-02 | Request from another origin | 403 |
| S-03 | GET request | 405 |
| S-04 | Malformed JSON | 400; no row created |
| S-05 | Body above size limit | 413; no row created |
| S-06 | Missing title or title over 120 characters | 400; no row created |
| S-07 | Empty message or message over 10,000 characters | 400; no row created |
| S-08 | Missing rights confirmation or publication consent | 400; no row created |
| S-09 | Honeypot field populated | Generic 202; no row created |
| S-10 | Missing/invalid Turnstile token | 403; no row created |
| S-11 | Valid consent, valid Turnstile, under rate limit | 201; one row created with status `pending` |
| S-12 | Exceed three requests within one hour for the same rate-limit identity | 429 |
| S-13 | Repeat S-11 with server secrets absent | 503; no row created |
| S-14 | Inspect database as `anon` and `authenticated` | Cannot read/write either private intake table or call the rate-limit RPC |

## Moderator endpoint

| Case | Action | Expected result |
|---|---|---|
| M-01 | `list_pending` without a valid session | 401 |
| M-02 | Valid Supabase user not in `vha_cms_admins` | 403 |
| M-03 | Allowlisted moderator lists pending queue | 200; pending items only; bounded to 100 |
| M-04 | Publish pending item without rights/consent flags | 409; no post created |
| M-05 | Publish a valid pending item | One post created; transmission transitions through `reviewing` to `published` |
| M-06 | Two concurrent publish attempts for the same item | Exactly one can claim the pending row; no duplicate post |
| M-07 | Reject a pending item | `pending → rejected`; no public post |
| M-08 | Reject an already-reviewed item | 409 |
| M-09 | Remove a published item | `published → reviewing → removed`; linked public post deleted |
| M-10 | Remove a pending or rejected item | 409 |
| M-11 | Force post deletion failure during removal | Transmission returns to `published`; error returned |
| M-12 | Publish content containing HTML/script markup | Markup is escaped in generated HTML; no script executes |

## Privacy and recovery

- [ ] Confirm contact email is never included in public post content or the public queue.
- [ ] Confirm no submission body or contact email is written to application logs.
- [ ] Verify a user can request correction/removal through a published, documented contact path before intake launches.
- [ ] Confirm moderator actions are attributable through `reviewed_by` and timestamps.
- [ ] Test keyboard-only operation and screen-reader labels after the visitor and moderator UIs exist.
- [ ] Confirm the public website clearly states that submissions are reviewed and may be published only with explicit consent.

## Release decision

**Current status: NOT READY.** The schema and Edge Function are deployed, but no live submission, Turnstile, moderator, publication, or removal test has been completed. The visitor-facing form and moderator UI are not connected. Complete all critical cases and record evidence before opening intake.
