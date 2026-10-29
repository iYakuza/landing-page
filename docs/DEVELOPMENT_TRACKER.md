# Secure Your Soul — Development Tracker

**Primary repository:** https://github.com/iYakuza/landing-page  
**Primary site:** https://iyakuza.github.io/landing-page/  
**Feature route:** https://iyakuza.github.io/landing-page/secure-your-soul/  
**Source of truth:** [Product Vision & Experience Blueprint](./SECURE_YOUR_SOUL_LIVING_BLUEPRINT.md)

State labels: **Investigated**, **Planned**, **Implemented**, **Tested**, **Committed**, and **Deployed** are separate. Never infer a later state from an earlier one.

## Current baseline

| Blueprint requirement | State | Change / files | Verification | Remaining work / next action |
|---|---|---|---|---|
| FR-01 — Present identity and central narrative question | Implemented in repository; deployment pending verification | `secure-your-soul/index.html`, `secure-your-soul/secure-your-soul.css` | Source files created; GitHub Pages URL not yet verified live | Verify rendered page at the feature route; check desktop/mobile layout |
| FR-02 — Offer Street Kid, Corpo, Nomad entry paths | Implemented in repository; interaction test pending | `secure-your-soul/index.html`, `secure-your-soul/secure-your-soul.js` | Three semantic buttons, `aria-pressed`, live response panel, clear-selection action in source | Test keyboard selection, screen-reader announcements, and mobile focus |
| FR-05 — Moderate submissions before publishing | Not implemented; deliberately not opened | Signal intake notice in `secure-your-soul/index.html`; existing Supabase `poetry-submit` function inspected | Existing function requires a rights confirmation and anti-spam check but publishes directly to Webflow on successful submission; it is not suitable for Secure Your Soul without redesign | Implement a separate pending-only Signal intake and explicit publication consent; preserve human moderation before publication |
| FR-06 — Curated Signals archive | Partially implemented as original fictional sample shards | `secure-your-soul/index.html` | Static authored fragments only; no visitor data displayed | Define content model and moderation process before connecting visitor submissions |
| FR-07 — Real Discord invitation | Blocked on real invite | Entrance page does not invent a join URL | No placeholder invite added | Add only after a valid server invite is supplied/configured |
| FR-08 — GitHub development route | Implemented in source | `secure-your-soul/index.html` | External repository link includes `target=_blank` and `rel=noopener noreferrer` | Verify link from live page |
| FR-09 — Removal/correction request | Not implemented | No public intake has been enabled | No false removal promise made | Define owner and contact route before submissions open |
| FR-10 — Responsive/accessibility | Implemented in source; tests pending | Semantic landmarks, skip link, focus-visible styles, reduced-motion CSS, responsive layouts, generated sequential chapter navigation | Source-level checks passed for JavaScript syntax, chapter targets, CSS balance, and unique HTML IDs; no browser audit yet | Run live keyboard, contrast, viewport, and reduced-motion checks |
| FR-11 — Secure uploads/spam | Not implemented; no uploads enabled | No upload control present | No unmoderated upload surface introduced | Reuse existing backend only after security and retention review |
| Main URL and existing site continuity | Implemented in source; deployment pending | New experience is isolated under `/secure-your-soul/`; homepage nav gets a route link | Existing homepage body is preserved; only one nav link is added | Verify current GitHub Pages deployment and check existing features remain intact |

## Changes in this implementation pass

- Added a self-contained Secure Your Soul entrance experience at `/secure-your-soul/`.
- Added a restrained charcoal, jade, bone, and muted-gold visual system; no third-party fonts, libraries, game assets, or autoplay audio.
- Added all planned narrative chapter sections: Protocol, Archive/Mikoshi, Arcana, Unknown, Garden/Signals, Circle, Workshop, and Release.
- Implemented the three lifepath selection interaction. Paths are narrative choices and do not gate access.
- Added progressive chapter navigation to the nine story sections: chapter count, visual progress indicator, previous/next chapter links, and return-to-entrance at the end. Navigation is generated from a single chapter list to keep ordering maintainable.
- Added an optional page-by-page Guided Reading mode. Visitors can enter from the hero, read one chapter at a time with a persistent chapter indicator, move through chapters, and exit back to the full archive. The normal scrolling page remains the default when JavaScript is unavailable.
- Clearly labelled fictional material and made the submission/community limitations visible rather than faking a working backend or invite.
- Added a navigation link from the existing homepage without replacing its GREEN DREAM content.

## Verification log

- Source-level checks run after fetching the committed files from GitHub: JavaScript syntax passed; CSS braces balanced; no duplicate HTML IDs; all fragment links target an existing ID; three lifepaths are present; reduced-motion support and skip link are present; no external font imports or fake submission form were found. Guided Reading is an opt-in enhancement; the full scrolling page remains the default. These checks do not replace a real browser test.

| Check | Result | Evidence |
|---|---|---|
| Blueprint read | Passed | Library DOCX, 12 pages / 631 extracted lines |
| Repository/default branch | Passed | `iYakuza/landing-page`, default branch `main` |
| New source committed | Passed | Commits returned for each of the three new files |
| Guided Reading source checks | Passed (source-level only) | Latest committed JS parses; guided entry/exit and chapter-switch handlers are present; all nine chapter IDs and in-page anchors resolve; CSS braces balance; no duplicate IDs. Browser behavior remains unverified. |
| Static syntax / link checks | Passed (source-level only) | JavaScript parses with no syntax error; CSS brace balance is zero; no duplicate HTML IDs; all in-page anchor targets exist; reduced-motion and skip-link patterns present; no fake submission form; homepage route link exists |
| GitHub Actions | Unverified | Combined status endpoint returned no status entries for checked commits; this is not evidence of a pass or failure |
| Live route / deployed rendering | Unverified | Direct live URL could not be inspected through the available web viewer; do not mark deployed until verified |
| Browser accessibility and responsive checks | Pending | Guided Reading now offers one chapter at a time, a persistent chapter label, previous/next navigation, and an exit control. Keyboard focus, real viewport rendering, and behavior still require browser-level verification |

## Backend discovery

- Supabase project `verse-after-hours` is active and contains `poetry_submissions`, `vha_posts`, the `vha_cms_admins` admin allowlist, and an active `poetry-submit` Edge Function.
- `poetry_submissions` has RLS enabled and admin-only access to moderation records, plus a public insert policy constrained to pending/rights-confirmed rows. However, the current Edge Function also creates a Webflow CMS item with a live publication request and updates the submission to `published` in the same request. It therefore does **not** meet Secure Your Soul's requirement for explicit publication consent and human review before public release.
- Do not connect the new page to this function unchanged. The new intake should create pending records only; public publication must be a separate moderator action. Reuse existing admin identity controls only after confirming the admin UI can support the new workflow.

## Next highest-priority tasks

1. Verify the route and navigation link on the live GitHub Pages deployment.
2. Test Guided Reading entry/exit, keyboard focus, chapter progression, lifepath selection, and mobile layout in a real browser; fix any build/static-safety issues.
3. Design a separate pending-only Signal intake with explicit publication consent, safe text/URL validation, anti-spam controls, and moderator-only review.
4. Define and implement a realistic removal/correction request route before accepting public contributions.
5. Configure a real Discord invite only after the destination exists.


## Secure Your Soul intake backend — 2026-10-29

- Applied the private pending-first transmission schema and committed its SQL migration at `supabase/migrations/20261029120000_secure_your_soul_pending_transmissions.sql`.
- Deployed Edge Function `secure-your-soul-transmissions` version 1 and committed its source at `supabase/functions/secure-your-soul-transmissions/index.ts`.
- The new table is RLS-enabled and direct anon/authenticated access is revoked. Submission requires text validation, explicit rights and publication consent, honeypot, Turnstile, origin check, and a server-side rate limit. The submit path writes pending records only.
- Moderator operations require a verified Supabase user on the `vha_cms_admins` allowlist. Supported actions: list pending, publish, reject, and remove.
- Launch is blocked pending configuration of `SYS_ALLOWED_ORIGIN`, `SYS_TRANSMISSION_RATE_SALT`, `TURNSTILE_SECRET_KEY`, the Turnstile site key, a visitor-facing form, and a moderator review UI.
- End-to-end submissions and moderator actions have not yet been tested. Conditional pending-row claim and rollback now prevent two moderators from publishing the same pending transmission concurrently (Edge Function version 2). End-to-end testing is still pending. Keep visitor submissions closed until these checks pass.

- Follow-up hardening deployed to Supabase as Edge Function version 2: publication first claims the pending record conditionally, only finalizes the claimed row, and rolls back the post and record if finalization fails. Reject is restricted to pending records; removal is restricted to published records. Source synchronized to GitHub.

- Added explicit `reviewing` status in the database and deployed Edge Function version 3. The publish claim now uses `pending → reviewing → published`, with failure rollback to pending. This avoids using the rejected state as an in-progress lock.

- Edge Function version 4: rate-limit key now checks available proxy client-IP headers (`cf-connecting-ip`, `x-real-ip`, then the last `x-forwarded-for` address) before falling back to `unknown`. The selected value is hashed with a server-side salt before storage. This avoids accidentally applying a single three-submission limit to all visitors when a client-IP header is present. Proxy-header trust and live rate-limit behavior still require deployment-level testing.

- Edge Function version 5: reject now uses a conditional `pending → rejected` transition; removal claims `published → reviewing` before deleting the published post and then finalizes `reviewing → removed`. Failed post deletion restores the published state. These transitions reduce moderator race conditions; the full flow still needs end-to-end tests.

- Added [Signal intake release-gate test plan](SIGNAL_INTAKE_TEST_PLAN.md) covering origin/CORS, validation, consent, Turnstile, rate limits, private-table access, moderator authorization, concurrent publication, removal, escaping, and privacy. The test plan explicitly records that live end-to-end verification is outstanding.
