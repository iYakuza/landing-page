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

## Current migration status / release gates

**Last updated: 22 November 2026.**

Do not merge PR #135 until the five outstanding legacy media assets below are restored or the owner explicitly accepts their unavailability. The owner has confirmed that the publication lifecycle works in the Preview environment; the public Signal submission form is the one known exception and remains intentionally paused until after the merger.

### Confirmed

- Record 3010's private video/audio media hydration and Chamber/Redesign Chamber viewing were accepted in the owner's browser test.
- Save → Chamber → Close → archive was accepted.
- The no-change Save optimization was accepted; it avoids a redundant private-draft commit.
- The owner confirms the create/edit/publish/unpublish/republish lifecycle works as expected in Preview.
- The public Signal intake form remains disabled. Published Signals remain readable; visitor submissions will be revisited after the production migration.
- The GitHub-only CMS uses the public website repository for published content and the private companion repository for drafts and private media.
- CodeQL on the validated code revision `bc1593feec3d8cb8d26f542338855d4f2edfcd6f` completed successfully with zero security-tagged SARIF findings. Its static-site safety, static security posture, and secret-scanning checks also passed. Re-run CI against the latest migration commit before merge.

### Remaining pre-merge decision: five legacy media assets

The old source media could not be downloaded during recovery. The owner is checking their local files for:

| Record | Title | Missing asset |
|---|---|---|
| T-0001 | Purtata corporatriștilor | `cover.jpeg` |
| T-0002 | Sunt o culoare | `featured.jpeg` |
| T-0003 | The God Beneath the Noise | `video.mp4` |
| T-0004 | Negocieri pe timp de pace | `featured.jpeg` |
| S-0001 | O noapte înstelată | `audio.mp3` |

Restore the original files where available. For any file that cannot be found, obtain the owner's explicit acceptance before cutover. Keep the historical source URLs in the content data until the corresponding record is resolved; they are inert provenance/recovery references, not active requests.

### Completed migration safeguards

- T-0001 / Human Archive record 3008 content reconciliation is in the recovery branch. Do not import Preview-only drafts or test media into production.
- The production private sequence was initialized from the verified production values: last-used Transmission 6 and archive record 3008. Preview's test sequence must not be copied.
- The Preview repository remains a deployment/content harness and must not be merged into the production source repository.
- Production `main` has not been modified. PR #135 remains the sole migration path and is still Draft/open/unmerged.

### Explicitly deferred by the owner

- The visitor Signal submission workflow will be redesigned after the merger. It must remain disabled for now.
- Backup, restore, legacy media recovery and emergency hosting are outside the current release scope. Their old GitHub Actions workflows and active Supabase / Cloudflare integration code have been withdrawn from the candidate. The old procedures are not an operational recovery process.
- Existing Google Drive archives and external provider accounts/projects have not been deleted or modified. Repository code removal does not decommission external services or erase externally stored data. Revisit a replacement backup/recovery architecture after the merger.

### CV contact

The CV contact form is being replaced with a browser-only `mailto:` handoff to the public contact address. It opens a prefilled email in the visitor's email application; visitors must manually add any attachments there. The website will not upload or transmit CV attachments.
