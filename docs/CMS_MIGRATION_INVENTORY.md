# CMS migration inventory — current state

This document describes the implementation on recovery/supabase-content-export-20261119 and the remaining work before PR #135 can be merged.

## Current architecture

| Area | Current implementation | Remaining boundary |
|---|---|---|
| CMS console and authentication | GitHub fine-grained PAT; owner verification; session-only token | Complete Preview acceptance tests |
| Shared Chamber | GitHub client/store; private drafts and media; atomic public commits | Complete publish/unpublish and concurrency tests |
| New Transmission launcher | Uses shared GitHub session and store | No known Supabase runtime call |
| Homepage | Reads published records from content/transmissions.json | Verify deployed Preview behavior |
| Green Dream archive | Reads Transmissions JSON and local audio media | Audio tracks appear as their assets are restored |
| Transmissions page | Reads content/transmissions.json; local media paths | Seven media items pending local recovery |
| Signals page | Reads content/signals.json; new submission/moderation workflow paused | One audio asset pending local recovery |
| Human Archive | Reads content/human-archive.json; local media manifest and local-only media resolution | 111 recovered assets verified; no remote fallback |
| CV contact form | Still calls Supabase Edge Function contact-about-role | Must choose mailto or retain a hosted backend |
| /community/ | Existing Green Dream community landing page and Slack CTA | Intentionally untouched; no Slack API integration |
| Secure Your Soul | Local page scripts; stale Supabase/Worker CSP allowances removed | No active Supabase/Worker call found in its page code |

## CMS transaction and data contracts

The Shared Chamber uses one shared editor and the GitHub storage adapter beneath it.

- New drafts and unpublished edits are stored in iYakuza/iyakuza-cms-private.
- Draft media is private until publication.
- Publishing promotes media and updates the public Transmissions collection and linked Human Archive structure in one Git commit.
- The private draft is removed only after the public commit succeeds.
- Unpublishing preserves a private edit draft before removing the public record.
- Existing record timestamps, legacy IDs, unknown metadata and Human Archive public_record_id values are preserved across edit/unpublish/republish.
- Writes use expected branch-head checks; stale data must be reconciled, not overwritten.

Legacy Supabase resources (vha_posts, human_archive_record_structures, human_archive_favorites, vha-post-media, and the old RPCs) are retained only as migration context and recovery references. They are not used by the audited public content readers or the GitHub CMS store.

## Canonical content and media integrity

| Collection | Current state |
|---|---|
| content/transmissions.json | Six published records; seven media items remain pending local recovery |
| content/human-archive.json | 140 records; 197 editor structures; 111 verified media-manifest items |
| content/signals.json | One published record; one audio item remains pending local recovery |

Human Archive media reconciliation:

- All 111 manifest items are marked verified and have corresponding local files in the recovery branch.
- 109 files were already common to source and Preview with matching Git blob hashes.
- Three additional external inline-reference assets from Preview were copied into the recovery branch.
- 86 historical Supabase media URLs are preserved as aliases to their corresponding local assets.
- Preview's editor structures were not copied wholesale. The source branch remains authoritative for the two structures that differed during comparison.

The seven Transmission attachments are expected to be re-uploaded from the owner's local copies. The Signals audio file still needs to be located or explicitly accepted as unavailable. The public runtime rejects legacy storage URLs rather than depending on the old storage service.

## Remaining external services and legacy tooling

### Public runtime

The CV contact form is the remaining active Supabase endpoint. It calls contact-about-role, which sends mail through Resend and uses Supabase-backed rate limiting plus the Cloudflare-provided client IP header. A dependency-free mailto replacement cannot attach files automatically; visitors would need to add attachments in their own email client.

### Recovery and backup workflows

The repository still contains legacy Supabase migration/restore workflows and Google Drive backup automation. These are not part of the public website runtime, but the scheduled Drive backup is conditional on BACKUP_ENABLED and uses Supabase as its source. They must be retired or replaced before the old Supabase project is shut down. Do not delete recovery tooling until the replacement backup strategy is confirmed.

### Community page

The separate /community/ page contains a Slack call-to-action link. It does not call the Slack API or use a webhook. The page remains untouched.

## Automated and manual validation

Latest automated checks on the recovery branch:

- Static-site safety checks: passed.
- JavaScript syntax checks and 13 Node regression tests: passed.
- Static security posture checks: passed with two documented warnings: eight pending media items and the CV contact-form exception.
- Secret scanning: passed.
- CodeQL: in progress at the time of this inventory.

Live-token testing has covered draft operations, media upload/deletion, favourites and recovery of HA-3008. Still required: complete publish/unpublish, visitor reload, edit metadata preservation, concurrent-change conflict, all block types, and sign-out/token clearing. The latest deployed Preview site still needs browser verification against the newest recovery-branch commits.

## Release blockers

1. Decide how to replace the CV contact form's Supabase/Cloudflare-backed email workflow.
2. Recover the seven Transmission media items and the one Signals audio item, or explicitly accept their temporary unavailability.
3. Complete the Preview end-to-end acceptance suite.
4. Wait for CodeQL to pass.
5. Initialize the production private sequence with last-used values 6 and 3008; do not copy Preview's test sequence or drafts.
6. Review and retire legacy Supabase/Google Drive backup tooling before decommissioning the old services.

PR #135 remains Draft. It must not be merged into main until these release blockers are resolved and the owner approves cutover.
