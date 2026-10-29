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
| FR-02 — Offer Community, Institution, Wanderer entry paths | Implemented in repository; interaction test pending | `secure-your-soul/index.html`, `secure-your-soul/secure-your-soul.js` | Three semantic buttons, `aria-pressed`, live response panel, clear-selection action in source | Test keyboard selection, screen-reader announcements, and mobile focus |
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
- Added all planned narrative chapter sections: Protocol, Archive/the Continuity Archive, Arcana, Unknown, Garden/Signals, Circle, Workshop, and Release.
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


## Guided Reading accessibility follow-up — 2026-10-29

- Added optional keyboard navigation to Guided Reading: Left/Right Arrow advances between chapters; Escape exits the mode. Controls are disabled while focus is in editable form controls and do not intercept modified shortcuts.
- Added a site-wide reduced-motion media query to disable smooth scrolling/transitions/animations for visitors who request reduced motion.
- Source-level review only. Real keyboard, screen-reader, reduced-motion, mobile, and desktop browser testing remains outstanding.

- Source-level checks run after the accessibility update: JavaScript parses successfully with `new Function`; CSS brace counts are balanced (243/243); the HTML has no duplicate IDs and no missing in-page hash targets; all nine Guided Reading chapter IDs exist. These are static checks, not browser tests.


## Homepage entrance redesign — 2026-10-29

- **Reason:** the earlier pass put Secure Your Soul on a separate route while leaving the first screen recognizably the old GREEN DREAM homepage. That was not a sufficiently visible change to the main visitor experience.
- Rebuilt the homepage main area as one fixed-height entrance screen, keeping the existing GREEN DREAM background image and radio player while removing the long embedded CV and Circle sections from the homepage flow. Those destinations remain linked separately.
- Reframed the homepage around **VERSE AFTER HOURS / THE CITY IS LOUD. LEAVE A TRACE.** and the project mantra **WE PUSH. WE FALL. WE BEGIN AGAIN.**
- Added five clear chronological entry cards: Green Dream, Transmissions, Music, Secure Your Soul, and The Circle. The archive, community, and personal profile are now destinations rather than competing long sections on the entrance screen.
- Tightened the header, added responsive layouts for smaller screens, retained the existing radio player IDs/markup for its current script, updated stylesheet cache-busting, page title, and description.
- Commit: [7c42f0a](https://github.com/iYakuza/landing-page/commit/7c42f0a320740277d8e98cd239c5521564f93a98) (metadata) and [41c3e7a](https://github.com/iYakuza/landing-page/commit/41c3e7a6e7c771432b55296b4688c39020e302af) (homepage redesign).
- Source-level verification after the redesign: one main entrance section; all five destination cards present; existing radio markup retained; no duplicate HTML IDs; no missing in-page fragment targets; CSS brace counts balanced (239/239). This does **not** establish that GitHub Pages has deployed the commit or that browser rendering is correct.
- Still required: verify the live route after deployment; inspect desktop/tablet/mobile rendering and confirm the radio works in-browser. If the new layout is not visible after the commit is deployed, investigate GitHub Pages workflow/build/cache rather than assuming the source change failed.


## Homepage redesign rolled back — 2026-10-29

- User rejected the 2026-10-29 fixed entrance redesign.
- Restored `index.html` to its exact pre-redesign contents from parent commit `41c3e7a7e6c771432b55296b4688c39020e302af^`, including the original GREEN DREAM hero, scroll cue, embedded profile section, Circle portal, and original inline styles/stylesheet cache versions.
- Rollback commit: [d85567c](https://github.com/iYakuza/landing-page/commit/d85567cc09e533ef0919aa7f2390718713e0724e).
- This reverts the homepage file only. The separate Secure Your Soul page and its prior accessibility/backend work remain untouched.
- Live deployment/rendering has not been verified.


## Original-world boundary — 2026-10-29

- User direction: retain the atmosphere, spiritual and existential questions, visual mood, and philosophy that inspired the project, but remove all direct Cyberpunk 2077 concepts, terminology, characters, institutions, and other recognizable references.
- The feature page and its interaction labels now use original terminology: the Continuity Institute, the Continuity Archive, the Continuity Process, the Threshold, and three original narrative attitudes—Community, Institution, and Wanderer.
- Preserve the thematic tensions: digital identity versus personhood, memory versus lived experience, institutional control versus liberation, spiritual uncertainty, hope, redemption, impermanence, and the right to let go.
- All future writing and visuals must be original and self-contained. Do not reintroduce game names, characters, locations, organizations, technologies, or in-world vocabulary. Tarot, meditation, corporate ritual, fragments, murals, memorials, plants, stars, and the unknown may remain as broad thematic motifs.
- Updated feature source: `secure-your-soul/index.html` and `secure-your-soul/secure-your-soul.js`. This change is committed to GitHub; live deployment and browser rendering remain unverified.


## Original-world boundary — 2026-10-29

- Removed direct game-universe names and terminology from the Secure Your Soul feature page and its narrative-path interactions while retaining the corporate-archive / spiritual-manuscript mood.
- The feature is now framed as an original fictional world. Do not reintroduce game-specific names, characters, locations, organizations, technologies, or vocabulary.
- Source commits: [HTML](https://github.com/iYakuza/landing-page/commit/939aabe0f1d799e5126b995c7ae05af8ecf8bb0d), [JavaScript](https://github.com/iYakuza/landing-page/commit/85ba44f02a34f994b76cfceb8e8f18f13b206267).
- Deployment and browser rendering remain unverified.
