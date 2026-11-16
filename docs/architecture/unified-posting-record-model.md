# Unified posting system: record identity bridge

**Phase:** 3A — read published Transmissions into Human Archive  
**Status:** Phase 2 identity safeguards are applied and verified in production; Phase 3A read bridge is in review.

## Current sources of truth

- `human-archive/archive-data.json` and `archive-content.json` contain 140 historical Human Archive records. Their existing numeric IDs are part of the archive's identity and must remain unchanged. The current maximum legacy ID is **3000**.
- `public.vha_posts` contains the 8 current Transmissions (6 published, 2 drafts). Its UUID `id` is referenced by existing relationships, including `sys_transmissions.published_post_id`.
- `public.human_archive_record_structures` and `public.human_archive_favorites` use the archive's numeric record ID. The chamber structure remains a one-to-one extension of a Human Archive identity.
- Transmission media currently lives in `vha-post-media` and is associated through `vha_posts.media_items`; historical archive media associations remain in the static manifest.

## Identity contract

Every Transmission will have two stable identifiers:

| Field | Purpose | Change policy |
| --- | --- | --- |
| `vha_posts.id` (UUID) | Existing database primary key and foreign-key target | Never replace or regenerate |
| `vha_posts.archive_record_id` (BIGINT) | Numeric Human Archive identity used by archive-facing features | Assigned once; immutable after assignment |
| `vha_posts.slug` | Existing public URL identity | Preserve; do not regenerate during migration |

The historical static archive keeps its existing numeric IDs. New Transmission identities begin at **3001**, above the current legacy range. New records obtain their numeric identity from `human_archive_record_id_seq` through a database-owned trigger.

Existing Transmissions receive deterministic numeric identities in `created_at, id` order. This is a metadata-only backfill: it does not rewrite content, title, slug, status, timestamps, UUIDs, or media.

## Why there is no foreign key to the legacy archive

The 140 historical records are currently delivered from versioned JSON files, not from a relational master table. Their numeric IDs therefore cannot be represented by a foreign key to `vha_posts`. The shared numeric namespace is maintained by reserving the existing legacy range and allocating new Transmission IDs above it.

The chamber and favourites tables continue to accept numeric IDs for both legacy archive records and database-backed Transmissions. Do not add a foreign key that would invalidate the historical IDs.

The `vha_posts` table has existing table-level write grants, so a SELECT-only column grant cannot by itself make this identity immutable. A `SECURITY DEFINER` trigger allocates a fresh sequence value on every insert and restores the previous value on any attempted update. The sequence is not directly accessible to client roles.

## Phase boundaries

### Phase 2 — this change

- Add and backfill `archive_record_id` on `vha_posts` (applied to production as migration `20261116211929`).
- Enforce database-owned allocation and immutability with a trigger (applied to production as migration `20261116212229`).
- Keep UUID primary keys, slugs, public URLs, statuses, content and media untouched.
- Preserve the current Human Archive JSON snapshot and its IDs.
- Do not copy or delete any post content or media.
- Do not change the public archive or editor behaviour yet.

### Phase 3 — make Human Archive the posting interface

#### Phase 3A — read bridge

- Human Archive reads published database-backed Transmissions alongside the historical snapshot.
- The bridge maps `archive_record_id` to the archive's numeric record identity and preserves the original Transmission slug.
- Published Transmission media is resolved only from the existing `vha-post-media` public bucket and validated project host.
- Drafts remain private; only rows with `status = 'published'` are loaded into the public Human Archive.
- The REDESIGN CHAMBER is read-only for database-backed Transmissions during this first slice; its existing editor continues to manage legacy archive structures only. This prevents edits from diverging between `vha_posts.content_html` and `human_archive_record_structures.transmission_body`.

#### Phase 3B — canonical write bridge

- The REDESIGN CHAMBER becomes the single editor for new and existing database-backed records.
- A save updates the canonical `vha_posts` row and its optional `human_archive_record_structures` extension with coordinated error handling.
- The Transmissions page becomes a view of the same records, not a separate posting system.
- Quick Post remains an entry point into the same editor and retains its local recovery and draft-save behaviour.
- Only after write-through editing is verified should the legacy CMS posting surface be retired.

### Later retirement

Only after the unified editor and public views pass regression tests should the legacy CMS posting surface be retired. Do not delete historical JSON snapshots, old media, UUID relationships, or compatibility code as part of this phase.

## Non-negotiable invariants

1. Existing Human Archive numeric IDs remain unchanged.
2. Existing Transmission UUIDs remain unchanged.
3. Existing slugs and shareable URLs remain unchanged.
4. Existing published/draft status and content remain unchanged.
5. Existing media paths and associations remain unchanged.
6. Chamber structures and favourites continue to use numeric archive IDs.
7. No historical content or media is mass-migrated in Phase 2.
