# Project handoff — landing-page GitHub CMS migration

**Last reviewed:** 21 November 2026  
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

## Current migration blockers / release gates

Do not merge PR #135 until each item is resolved or explicitly accepted by the owner.

1. **Preview browser acceptance:** verify record 3008's obsolete Bing Bong attachment can be removed, then confirm it disappears from the archive card and public `media_items` manifest without breaking retained body media.
2. **Media readiness:** upload a uniquely named audio/video/image asset; verify private draft playback, publish, the explicit waiting status, successful public URL HEAD verification, immediate playback, reload and reopen. Also test timeout messaging.
3. **No-change publish:** open a published Transmission, make no edits, save, and verify no new public commit/deployment is created; private draft cleanup must still complete.
4. **Save/close lifecycle:** verify Save → published read-only Chamber → Close succeeds without stale-draft autosave errors.
5. **Publication lifecycle:** verify new Transmission, edit, publish, reload, unpublish, republish, conflict detection, concurrent editor protection, sign-out and token clearing.
6. **CodeQL:** the PR head observed on 21 November had a GitHub Advanced Security CodeQL check reporting 12 new alerts, including 5 high-severity alerts. Inspect and resolve every genuine new high-severity issue; distinguish pre-existing/large-diff noise rather than suppressing findings.
7. **CV contact form:** `cv/contact.js` still calls the Supabase `contact-about-role` Edge Function. Decide whether to retain this dependency or replace it with a clearly accepted alternative that accounts for file attachments.
8. **Legacy media:** the old Supabase media source returned HTTP 402 during recovery. Restore access and recover outstanding original media, provide replacements, or record explicit owner acceptance of each unavailable asset.
9. **Production content reconciliation:** T-0001 / record 3008 updates and the uploaded MP3/video/lyrics image in Preview must be reconciled into the migration branch before production cutover. Do not import test-only content, attachments or identifiers unintentionally.
10. **Production sequence:** initialize the production private sequence from verified production values (the migration record identifies last-used `transmission_number: 6` and `archive_record_id: 3008`). Never copy Preview's sequence/test drafts.
11. **Backups and recovery:** review Google Drive backup and legacy Supabase migration/restore tooling. Do not shut down the old Supabase project or delete recovery tooling until a verified replacement backup/restore process exists.

## Working rules

- Investigate before changing files; make scoped changes on the recovery branch.
- Preserve existing site URLs, pages, content and media unless a change is explicitly part of the approved architecture.
- Use repository state, PRs, CI and this handoff as the durable record; do not rely on chat memory.
- After each change: inspect the diff, run syntax/regression/security checks, inspect workflow results, and update this handoff/PR status.
- Separate verified evidence from hypotheses. Never claim browser acceptance based only on CI or repository inspection.
- Keep PR #135 Draft until every release gate has an evidence-backed disposition.


## Preview T-0001 reconciliation into the migration branch — 21 November 2026

**Status: reconciled at repository level; browser acceptance still required.**

A one-time checksum-verified GitHub Actions transfer copied these Preview files into the recovery branch:

| File | Bytes | Git blob SHA |
|---|---:|---|
| `media/transmissions/T-0001/3bf2c4f2-7a59-4a4e-a71e-6c7956c23234-Purtata-corporatris-tilor-video.mp4` | 12,981,931 | `8b5191309fb8275a983e0a8fda676b9c593027b4` |
| `media/transmissions/T-0001/ae2ae42b-1f30-4ae3-bdbb-3884857ee3a9-Purtata-corporatris-tilor-lyrics.png` | 3,487,332 | `21587a36e6e803cf02928f4f38ba1ab00ee1ea48` |
| `media/transmissions/T-0001/b793521b-5bb5-404b-82ba-598a64cc46f3-Purtata-corporatris-tilor-mp3.mp3` | 2,722,328 | `3d829c8ed53a2e13aec10f8993eadf115b2bfc4b` |

The Actions job checked each downloaded file's exact byte count and Git blob SHA before committing any data. Transfer run: [#44952369034](https://github.com/iYakuza/landing-page/actions/runs/44952369034). Data commit: [`f1d83c4`](https://github.com/iYakuza/landing-page/commit/f1d83c46de4b6f38f6f3cfbbfb15e3ae1885ddc2).

The reconciliation updated only T-0001 and its linked Human Archive structure:

- The Transmission body and saved block HTML now reference the uploaded MP3, video and lyrics image using production-relative `media/transmissions/T-0001/...` paths.
- The Transmission's public `media_items` manifest contains exactly those three available local assets.
- The Human Archive `editor_structures` entry for `record_id: 3008` retains `public_record_id: HA-3008`; its body, block stream and output-media lists now use the same three local files.
- The obsolete Bing Bong attachment is absent from the reconciled public manifest and body. Its physical file was not copied to production.
- Production `created_at` and `published_at` remain unchanged. `updated_at` records the latest Preview save.
- The 111-item Human Archive media manifest was not broadly replaced or rewritten.
- The temporary `.github/workflows/reconcile-preview-t1.yml` transfer workflow was removed immediately after the successful transfer.

Repository-level verification confirmed the three paths exist with the expected sizes and blob SHAs, the T-0001 body and structure contain no obsolete Bing Bong reference, the linked structure has no Preview-specific URL prefixes, and no Preview sequence or test drafts were copied.

**Remaining:** owner-authenticated Preview browser acceptance of the reconciled editor changes, and the other release gates above. This reconciliation is on the recovery branch only; production `main` has not been changed.


## Production private sequence initialization — 21 November 2026

The production private repository `iYakuza/iyakuza-cms-private` now has `cms-data/v1/sequences.json` on its `main` branch:

```json
{
  "transmission_number": 6,
  "archive_record_id": 3008,
  "updated_at": "2026-11-21T21:38:00.000Z"
}
```

Commit: [`25c424d`](https://github.com/iYakuza/iyakuza-cms-private/commit/25c424d9bda757c017fc9845bb9d3eff006d08e7).

This produces the next production identifiers **T-0007** and **3009**. The seed was created only because the production `main` branch had no sequence file; the production export's last-used identifiers were verified from the migration inventory and data. The private Preview branch remains unchanged and retains its test sequence (`10`, `3012`) and test drafts. Do not copy those Preview values or drafts into production.


## Remaining legacy media after T-0001 reconciliation — 21 November 2026

The migration branch's `recovery-data/transmission-media-report.json` and current canonical collections identify these remaining pending assets:

| Record | Missing/pending asset | Evidence / disposition |
|---|---|---|
| T-0001 | Original `cover.jpeg` | The source object was absent from the available restore bucket. The new uploaded audio, video and lyrics image are already verified and reconciled as replacements. |
| T-0002 | `featured.jpeg` | Matching object exists in restore metadata; download was blocked by HTTP 402. |
| T-0003 | `video.mp4` | Matching object exists in restore metadata; download was blocked by HTTP 402. |
| T-0004 | `featured.jpeg` | Matching object exists in restore metadata; download was blocked by HTTP 402. |
| S-0001 | `audio.mp3` | Remains `pending_recovery`; no local asset is present in the recovery or Preview media directories. |

The Transmission recovery report originally listed 7 pending Transmission files (4 for T-0001 and one each for T-0002/T-0003/T-0004). After the verified T-0001 reconciliation, 4 of those remain. S-0001 adds one further pending Signals asset. Keep these references marked unavailable/pending; do not guess filenames, substitute other files, or mark them available without verifying bytes.

The old Supabase download source returned HTTP 402 (cached egress quota exceeded). T-0002/T-0003/T-0004 matching objects were found in restore metadata but could not be downloaded. T-0001's source files were not present in the available restore project's bucket. This is still a production cutover exception that requires recovery, replacements or explicit owner acceptance.


## Security remediation and latest validation — 21 November 2026

The migration branch includes these additional security changes:

- Pinned DOMPurify **3.4.18** locally under `shared/vendor/`, with its upstream license included. The same shared asset is loaded before the Human Archive and Transmissions renderers; no new third-party runtime CDN dependency was introduced.
- The five CodeQL high-severity DOM-XSS findings previously reported in `human-archive/archive.js` were traced to raw `DOMParser` entry points. The five rendering/cleaning paths now obtain a sanitized DOM fragment through DOMPurify before the allowlist reconstruction. The one search-only parser that reads text content remains a text-only path.
- Transmission content is also sanitized at the final collapsible-template insertion point. Reflection labels are HTML-escaped; both the original clean-up and final insertion use the shared sanitizer.
- The embed block classifier now parses URLs and matches exact approved provider hostnames instead of substring regexes.
- The legacy Poetry submission converter keeps encoded angle brackets from being decoded into raw markup and encodes any residual literal angle brackets in its plain-text output.

CodeQL SARIF from the post-DOMPurify scan on commit `745af8d3e1d5d5f710c6b9013a8c25e245f537ad` confirmed **zero high-severity findings** and no remaining `js/xss-through-dom` or missing-regexp-anchor findings. That report still contained two lower-severity `js/incomplete-multi-character-sanitization` warnings (Poetry plain-text conversion and Transmission section content); the Transmission renderer has since been hardened at the final HTML insertion boundary. The follow-up CodeQL run on the latest branch head `69d7d2731ac2432343f07b27a1143b19f74ff1b8` was still running at 22:03 UTC, so do not report the latest CodeQL gate as green until that run completes and its SARIF/check result is reviewed.

Latest completed validations on the current head:
- Static-site validation: **37/37 Node tests passed**, including the new DOMPurify final-sink test and Poetry plain-text test.
- Static security posture: passed.
- Secret scanning: passed.
- JavaScript syntax and project-specific static checks: passed.

The short-lived SARIF artifact retention in `.github/workflows/codeql.yml` was added only to inspect the findings because normal GitHub connector endpoints did not expose alert details. After final CodeQL triage, remove the staging/upload steps and rerun checks; do not leave diagnostic-only workflow behavior in the production architecture unless explicitly justified.

## Preview acceptance retest — private draft media and Chamber lifecycle (22 November 2026)

The owner's authenticated browser retest of **record 3010 / T-0008** exposed three distinct behaviours:
- A newly uploaded `You Are Water.mp3` played inside Design mode and was successfully written to the Preview private repository and draft HTML, but disappeared from the archive card after save/reopen.
- Cancelling the native file picker unexpectedly exited the entire Chamber.
- Closing after an explicit Save displayed `SAVING PRIVATE DRAFT…` and performed a redundant second save.

Repository evidence from `iYakuza/iyakuza-cms-private:preview` confirmed that the audio bytes were present and the saved HTML contained their exact private path. The earlier `The_Microwave_in_My_Kitchen_demo.mp3` block is a caption-only orphan with no source URL and cannot be played; it must be removed and re-uploaded from the owner's local copy.

Corrective changes on this recovery branch:
- The archive-card renderer now converts only session-mapped private Blob URLs to verified private repository paths before DOMPurify sanitization, then resolves those paths back to the session Blob URL during safe element reconstruction. Image, audio/video and nested source elements all use the same verified resolver.
- A native file-picker cancellation or Escape now dismisses the nested media picker without closing the Human Archive Chamber.
- A successful explicit draft save updates the autosave signature baseline, so the subsequent Chamber close does not write the same draft again.
- Added regression coverage for the archive-card sanitization path, mapped/unmapped private-media URL resolution, nested file-picker cancellation and explicit-save/autosave signature parity.
- Bumped Human Archive and block-editor asset cache versions.

Validation:
- Preview workflow [#45024858887](https://github.com/iYakuza/landing-page-preview/actions/runs/45024858887): **build and deploy succeeded**.
- Preview validation: JavaScript syntax checks passed; **42/42 Node regression tests passed**.
- Recovery-branch workflows on commit `319ba41cd225531f34a915c9d290a33ab74d2525`: Static-site safety, static security posture, secret scanning and CodeQL all completed successfully.
- This is code/CI and repository-level verification only. The owner must still repeat the browser acceptance on record 3010 after deployment. Confirm (1) You Are Water player displays and plays from the archive card and Chamber after reopening and hard refresh, (2) cancelling file selection leaves Chamber open, and (3) Close no longer triggers a redundant private autosave after Save Chamber.

No production `main` change was made. PR #135 remains Draft and unmerged.
 
## Current release decision

PR #135 remains Draft. Do not merge until the current CodeQL run is complete and triaged, owner-authenticated browser acceptance has covered the new attachment/media/no-op flows, the five missing legacy assets are recovered/replaced/explicitly accepted, and the CV contact-form dependency decision is recorded. Production `main` remains untouched.
