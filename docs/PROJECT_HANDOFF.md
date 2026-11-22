# Project handoff — landing-page GitHub CMS migration

**Last reviewed:** 22 November 2026  
**Purpose:** Persistent operational context for future contributors and ChatGPT conversations. This file is the project's working source of truth; chat history is not.

## Repositories and responsibilities

| Repository | Responsibility | Current state |
|---|---|---|
| `iYakuza/landing-page` | Website source, production GitHub Pages target, canonical production content and public media | Production branch is `main`; migration work is isolated on `recovery/supabase-content-export-20261119` |
| `iYakuza/landing-page-preview` | Isolated Preview website build plus Preview-only canonical JSON and media | `main` contains Preview data/media and its deployment workflow; do not merge this repository into production |
| `iYakuza/iyakuza-cms-private` | Private CMS drafts, draft media, favourites, private overrides and sequence state | Must remain private |

**Production website:** https://iyakuza.github.io/landing-page/  
**Preview website:** https://iyakuza.github.io/landing-page-preview/

## Branch and pull request

- Production branch: `iYakuza/landing-page:main`.
- Migration branch: `iYakuza/landing-page:recovery/supabase-content-export-20261119`.
- Main migration PR: [#135 — Migrate Shared Chamber CMS to GitHub-only storage](https://github.com/iYakuza/landing-page/pull/135).
- PR #135 is intentionally **Draft** until all release gates below pass and the owner explicitly authorizes the cutover.
- Production `main` must not be changed directly during migration work.
- Once approved, squash-merge PR #135 into `landing-page/main`. Do not merge `landing-page-preview` into `landing-page`.

## How Preview works

The Preview workflow is `iYakuza/landing-page-preview/.github/workflows/preview.yml`.

- It checks out Preview `main` for content and media.
- It clones the website source from `landing-page` branch `recovery/supabase-content-export-20261119`.
- It rewrites the CMS client configuration to target `landing-page-preview` and its Preview-only private branch.
- It builds and deploys to GitHub Pages.
- It polls the recovery source hourly and also runs on Preview content/media pushes or manual dispatch.
- A successful Preview deployment validates the Preview pipeline, not production readiness.

CMS writes made in Preview do not automatically transfer back to the migration branch or production. Reconcile only verified owner-approved content and assets; never copy Preview test drafts or Preview sequence state into production.

## Target production architecture

- GitHub Pages serves the static website from `landing-page/main`.
- Canonical public collections are `content/transmissions.json`, `content/human-archive.json`, and `content/signals.json`.
- Public media is stored in the repository's `media/` hierarchy.
- The browser-side CMS authenticates the owner with a fine-grained GitHub token held in session storage.
- Unpublished drafts and draft media live in the private companion repository.
- An explicit Publish operation promotes media and updates the public Transmissions JSON and linked Human Archive structure in one public Git commit.
- Draft saves must not publish unpublished content.

See:
- `docs/CONTENT_ARCHITECTURE.md`
- `docs/CMS_DATA_MODEL.md`
- `docs/CMS_MIGRATION_PLAN.md`
- `docs/CMS_MIGRATION_INVENTORY.md`
- `docs/WEBSITE_AND_CONTENT_STRUCTURE.md`

## Latest Preview investigation — 21 November 2026

The owner tested Human Archive record **3008 / Transmission T-0001**.

### Findings

1. The Preview archive card shows the obsolete Bing Bong MP3 although it is absent from the Transmission body. The file remains in T-0001's `media_items` attachment manifest with `status: available`. The chamber body does not show it because the body renderer does not create the loose-attachment gallery in the same way as the archive card.
2. The editor hydrated every `record.media_items` entry into `attachedPostMedia` and serialized the full list on save. There was no functional UI for removing an item from that collection.
3. Saving an unchanged published Transmission still created a public commit and started a Preview deployment. Preview run #39 completed successfully, but the publish changed timestamps and normalized media URLs rather than content.
4. Preview publishes finish their repository commit before the GitHub Pages deployment finishes. A media path can therefore be committed and rendered in the editor before its public URL is serving the new asset.

Evidence:
- [Preview publish run #39](https://github.com/iYakuza/landing-page-preview/actions/runs/44943331069)
- [Preview publish commit e358956](https://github.com/iYakuza/landing-page-preview/commit/e35895662472e852f0c46eb97b818938681fa5b1)
- The run's build and deploy jobs succeeded; total deployment was approximately 47 seconds.

### Changes added to the migration branch

- Added `isPublicationUnchanged` to compare the actual public post and linked structure while ignoring generated update timestamps, equivalent Preview/production site-root URL prefixes, and non-semantic generated media-manifest IDs.
- `publishDraft` now closes an unchanged private edit draft without writing a new public commit. A real metadata, content, structure or media change still publishes.
- Added a loose-attachment manager to the Chamber editor. It removes selected entries from the post's attachment manifest after confirmation. It does **not** delete underlying media bytes. Assets still referenced by body/block HTML are re-added to the published manifest by the existing block-media reconciliation.
- After promoting newly uploaded draft media, the editor now checks the public media URLs with same-origin HEAD requests. It waits up to 90 seconds; if assets are still not live, the status explicitly says media is still deploying instead of claiming normal publication readiness.
- Added regression tests for no-op publication comparisons, attachment removal wiring and the new public-media readiness check.

These changes are on `recovery/supabase-content-export-20261119` and are not yet production-deployed. Browser acceptance is still required.

## Current migration status / release notes

**Last updated: 22 November 2026.**

The owner has accepted the remaining legacy-media disposition. Those five files are no longer a release gate. The owner has confirmed the Preview publication lifecycle, record 3010 media playback/save/close flow, and no-change Save optimization. The public Signal submission form remains intentionally paused for post-merger redesign.

### Owner-confirmed media disposition

| Record | Title | Owner decision | Cutover treatment |
|---|---|---|---|
| T-0001 | Purtata corporatriștilor | Missing `cover.jpeg` is not wanted | Remove the stale cover entry; retain the verified video, MP3 and lyrics image |
| T-0002 | Sunt o culoare | Add the missing JPEG manually later as a block | Keep unavailable legacy media suppressed until updated |
| T-0003 | The God Beneath the Noise | Add the missing MP4 manually later as a block | Keep unavailable legacy media suppressed until updated |
| T-0004 | Negocieri pe timp de pace | Add the missing JPEG manually later as a block | Keep unavailable legacy media suppressed until updated |
| S-0001 | O noapte înstelată | Audio was from the first Signal publishing test; no recovery required | Keep the published text entry; do not recover the test audio |

The Transmissions public reader now clears top-level `media_url` / `media_path` fallback values when a record has a media manifest but none of its items are available. This prevents pending T-0002–T-0004 files from being rendered as broken players/images. Records without a media manifest retain their legacy fallback behavior.

### Confirmed browser acceptance

- Record 3010's private audio/video media hydration and Chamber/Redesign Chamber playback were accepted by the owner.
- Responsive inline video sizing was accepted.
- Save → Chamber → Close → archive was accepted.
- The no-change Save optimization was accepted; it avoids a redundant private-draft commit.
- The owner confirms the create/edit/publish/unpublish/republish lifecycle works as expected in Preview.
- Viewer Signal submissions stay disabled. Published Signals remain readable; submission intake will be revisited after production cutover.

### Disconnected / deferred integrations

- CV contact: retain the existing form UI, but the submit button is disabled and no submission request is sent. No mailto fallback or replacement service is introduced. Revisit the integration after the merger.
- Supabase Functions/config/migrations and Cloudflare recovery hosting code are removed from the active candidate. Historical `source_url` values on pending media remain inert provenance/recovery metadata; public readers must not render or request those pending assets.
- Backup, restore, emergency hosting and legacy media recovery automation are out of scope after the merger. Their old workflows and operational UI have been removed. Existing Google Drive archives and external accounts/projects have not been deleted or modified.
- The visitor Signal form will be redesigned after the merger.

### CI and security

The latest validated migration revision before this update, `3b9bc4ec9678c267a182016cd523178fe5e0108b`, passed static-site safety (**46/46 Node tests**), JavaScript syntax checks, static security posture, secret scanning and CodeQL. Re-run all checks on the current head after the final media-reader/contact adjustments.

### Production cutover

- The private production identifier sequence is seeded with last-used Transmission 6 and archive record 3008. The next production IDs are T-0007 and 3009.
- Preview's separate private branch contains test drafts and sequence values 10 / 3012; do not copy them into production.
- `landing-page-preview` is a content/deployment harness, not a branch of the source repository. Do not merge it wholesale.
- The production source candidate is PR #135 from `recovery/supabase-content-export-20261119` into `landing-page/main`. Production `main` remains unchanged.
- The preview deployment and production migration branch use the same website source branch. Preview-only private test drafts/media are not production content.

### Post-merger product focus

Return to the project's central goals: transparency, in-real-time updates, and human/AI conversations turned into a visible display of ideas. Signal intake, contact, backup/recovery redesign and other nonessential integrations can be handled after the core website is live.
