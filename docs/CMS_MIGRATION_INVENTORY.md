# CMS migration inventory

This document records the existing data and behavior that must be preserved while replacing Supabase with the GitHub-only architecture in `CMS_MIGRATION_PLAN.md`.

## Current integration map

### 1. CMS console — `cms/index.html` and `cms/cms.js`

Current responsibilities:
- Email/password sign-in, password reset and persisted Supabase session.
- Admin allowlist check against `vha_cms_admins`.
- Community review queue backed by `poetry_submissions`.
- Approve/decline updates to community submissions.
- Recovery-centre links currently mention Supabase and Cloudflare workflows.

Migration treatment:
- Replace sign-in with the owner-scoped fine-grained GitHub token flow described in the migration plan.
- Keep the admin console layout and recovery/navigation elements where still relevant, but remove obsolete Supabase/Cloudflare operations only after checking their workflow dependencies.
- Community moderation is explicitly deferred. It must not be accidentally exposed as a GitHub CMS feature or silently dropped from the public Signals rendering path.

### 2. Shared Chamber — `human-archive/archive.js`

This is the critical editor integration. It is not a simple form submission. It currently uses:

| Supabase resource | Existing behavior | GitHub-only destination |
|---|---|---|
| `vha_cms_admins` | Confirms editor/admin access | Verified GitHub token identity, fixed owner allowlist and repository-scoped permissions |
| `vha_posts` | Transmission metadata, body, publication status, timestamps and media references | Public `content/transmissions.json` for published records; private companion-repo JSON for drafts |
| `human_archive_favorites` | Author favourites on Human Archive records | Private companion-repo favourites JSON |
| `human_archive_record_structures` | Legacy Human Archive structure/output overrides and block data | Public canonical Human Archive collection for public structures; private companion data only for genuinely private overrides |
| `vha-post-media` | Uploads and deletion of attachments and block output media | Private repository assets while draft; public `media/` paths only during explicit publication |
| `save_human_archive_transmission_v5` | Creates/updates Transmission metadata, body, media, status and optimistic concurrency | One version-checked Git commit that updates the relevant JSON and media |
| `create_human_archive_transmission_v3` | Creates a draft Transmission and its linked Archive record | Create a private draft record with a stable ID; allocate/publish public IDs and paths transactionally |
| `save_human_archive_record_structure_v1` | Saves legacy record structure and output fields | Version-checked update to the appropriate canonical/private JSON record |
| `save_human_archive_record_blocks_v1` | Saves ordered block stream with concurrency check | Persist the complete ordered block stream in the relevant JSON document |
| `delete_human_archive_transmission_draft_v1` | Deletes a draft and returns owned storage paths | Delete private draft data and unreferenced private assets; never delete a published record implicitly |

Important editor contracts observed in the current implementation:
- The Shared Chamber is loaded by `creator-posting.js` and is shared by Human Archive and Transmissions.
- New Transmission creation starts as a draft. The editor has explicit Discard and Save Chamber actions.
- Draft autosave is enabled for draft Transmissions and tracks a last-saved signature.
- The editor checks expected update timestamps and presents an edit-conflict state instead of silently overwriting a newer version.
- Publishing and unpublishing are explicit status changes, with confirmation.
- A Transmission stores metadata, sanitized body HTML, ordered blocks, output text, output media, attached post media, media width and timestamps.
- Block media and attached media are currently uploaded to paths rooted at `human-archive/{record-id}/...`.
- The 30 MB per-file limit is enforced in the editor.
- Deletion and rollback paths attempt to clean up newly uploaded or no-longer-referenced media.
- Existing Human Archive records can have structure overrides and output media without becoming Transmissions. These must remain distinct from new Transmission drafts.

### 3. New Transmission launcher — `creator-posting.js`

Current responsibilities:
- Loads the Shared Chamber CSS and editor scripts on demand.
- Checks the Supabase session and admin table before showing the global New Transmission button.
- Opens the existing Shared Chamber through `VHA_OPEN_NEW_TRANSMISSION` and `VHA_OPEN_EXISTING_TRANSMISSION` events.

Migration treatment:
- Keep the lazy-loading behavior and event contract.
- Replace only its authorization dependency with the shared GitHub session/client.
- Do not duplicate the Chamber UI or create a second editor.

### 4. Public Transmissions and Signals — `transmissions/posts.js`

Current responsibilities:
- Loads public Transmissions from `content/transmissions.json`.
- Loads public Signals from `content/signals.json`.
- May overlay additional live Supabase rows for Signals/community content.
- Checks Supabase admin status to show edit/favourite controls.
- Reads and writes Human Archive favourites.
- Community submission uploads and writes use `poetry-media` and `poetry_submissions`.

Migration treatment:
- Keep canonical JSON as the public read source.
- Remove the live Supabase overlay only as part of the agreed Signals/community deferral; do not alter the existing Signals URL or public JSON records in this Chamber migration.
- Reuse the shared GitHub session for owner-only edit/favourite controls.
- Move favourites to private companion JSON.
- Community visitor submission and moderation are a separate deferred workflow, not part of the private owner CMS store.

### 5. Block editor — `editor-ui/block-editor.js`

The block editor itself has no Supabase database client. It receives media upload and media-library callbacks from the Shared Chamber. Preserve the block model, supported block types, ordering, names, columns, rich-text integration, keyboard behavior, and media insertion contract. Replace the callbacks/data provider beneath it rather than redesigning the editor.

## Existing local data sources inspected

| Path | Current observation | Intended use |
|---|---|---|
| `content/transmissions.json` | Valid collection object with `schema_version`, `collection` and `records`; six records observed | Canonical published Transmissions |
| `content/signals.json` | Existing public collection | Public Signals rendering; moderation deferred |
| `content/human-archive.json` | Valid canonical collection (1,143,614 bytes; 140 records), with embedded `media_manifest` and 197 `editor_structures` entries. The large-file `fetch_file` response was empty, but the Git blob endpoint returned and parsed the complete JSON. | Existing canonical Human Archive source; preserve and validate its schema and references |
| `human-archive/archive-content.json` | Captured source collection with 140 records | Source material for rebuilding the canonical Human Archive collection |
| `human-archive/archive-data.json` | 140-record index array | Supporting source/index data |
| `human-archive/media-manifest.json` | Existing media inventory | Local media reference mapping |
| `recovery-data/human-archive-favorites.json` | Export containing two favourite records | Seed for private favourites |
| `recovery-data/human-archive-structures.json` | Export containing 197 structure records | Seed for structure overrides and block streams |
| `transmissions/posts.json` | Legacy array with six Transmission records observed | Legacy/reference data; canonical public collection remains `content/transmissions.json` |

`content/human-archive.json` is present and structurally complete. The earlier apparent empty result was a limitation of the large-file fetch response, not an empty repository file. Before cutover, still compare its 140 records, embedded media manifest and 197 editor-structure entries against the captured source/export files and any newer backups; validate IDs, media references and block streams. Do not rewrite the canonical collection without a verified reason.

## Security and integration requirements

- The browser token is session-only and must never be serialized into repository files, URLs, localStorage, console output, audit records or error messages.
- The GitHub client must validate owner identity and the expected repository names before enabling writes.
- Private draft writes go only to `iYakuza/iyakuza-cms-private`; public writes go only to `iYakuza/landing-page`.
- All multi-file public publishing must create blobs/tree/commit and update the branch ref with an expected-head check. A failed ref update must leave the previous public state intact.
- The editor must surface API errors and version conflicts; it must not report a save or publish as successful until GitHub confirms the ref update.
- No GitHub Actions, Supabase, Cloudflare, OAuth secret, external database or third-party object storage is required for the core migration.

## Implementation order after inventory

1. Restore and validate the Human Archive canonical collection as a separate data-integrity task.
2. Add and test a small GitHub API/session client against both selected repositories.
3. Replace CMS sign-in and share one verified session across the console, creator launcher, Transmissions controls and Shared Chamber.
4. Implement private draft, favourites and private override repositories/data formats.
5. Migrate media uploads to private draft assets and publish-time public copies.
6. Replace the Chamber's Supabase RPC calls with version-checked GitHub commits while preserving the current UI.
7. Remove Supabase SDK/configuration and obsolete CSP permissions only after every caller has been migrated.
8. Validate all existing records and workflows on the recovery branch before any cutover.
