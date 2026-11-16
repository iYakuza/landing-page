# Unified posting system: record identity bridge

**Phase:** 3 — make Human Archive the canonical posting interface  
**Status:** numeric identity bridge and immutable-ID trigger applied to production.

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
| `vha_posts.slug` | Existing public URL identity | Preserve unless an admin explicitly edits it in the chamber |

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

**Initial integration slice:** load database-backed Transmissions into the Human Archive index using `archive_record_id` as the visible numeric identity. Public visitors receive published rows only; authenticated archive admins also receive drafts. Existing UUIDs, slugs, content, status and media references remain in `vha_posts`. This is merged.

**Canonical chamber-save slice (merged):** admin users can open a Transmission chamber in REDESIGN CHAMBER. The editor preserves the CMS layout classes and supported formatting. Saving calls `save_human_archive_transmission`, a `SECURITY INVOKER` RPC that updates `vha_posts.content_html` and upserts the numeric-ID chamber structure in one database transaction under the existing RLS policies. The original UUID, archive numeric ID, slug, status and CMS media associations are preserved. Migration `20261116215410` is applied to production; PR #77 is merged and the admin save flow has been browser-tested.

- Human Archive reads published database-backed Transmissions alongside the historical snapshot.
- The REDESIGN CHAMBER becomes the single editor for new and existing database-backed records.
- A save updates the canonical `vha_posts` row and its optional `human_archive_record_structures` extension.
- Drafts remain private; public archive views expose published records only.
- The Transmissions page becomes a view of the same records, not a separate posting system.
- Quick Post remains an entry point into the same editor and retains its local recovery and draft-save behaviour.

**Metadata-editing slice (implementation in review):** the Transmission chamber exposes title, public slug, movement category and excerpt alongside the body and structure. These fields are saved atomically with the chamber through `save_human_archive_transmission_v2` (production migration `20261116233208`). The operation preserves the post UUID, archive numeric ID, current publication status, publication timestamp and all media associations. Existing slugs are loaded unchanged by default; changing one intentionally changes the public URL. Publication status remains read-only in this slice.

**Publication-control slice (implementation in review):** admins can choose Draft (private) or Published (public) from the Transmission chamber. The chamber saves status together with metadata and structure through `save_human_archive_transmission_v3`. It uses the existing `vha_posts_touch_updated_at` trigger, which stamps `published_at` when a draft is published and clears it when a published post is saved as draft. The database function validates the status, content and category, checks CMS-admin membership, and preserves UUID, archive numeric ID and all media associations. The CMS remains available as fallback until browser regression is complete.

### Later retirement

Only after the unified editor and public views pass regression tests should the legacy CMS posting surface be retired. Do not delete historical JSON snapshots, old media, UUID relationships, or compatibility code as part of this phase.

## Non-negotiable invariants

1. Existing Human Archive numeric IDs remain unchanged.
2. Existing Transmission UUIDs remain unchanged.
3. Existing slugs and shareable URLs remain unchanged unless an admin explicitly changes the slug through the metadata editor; such a change intentionally updates the public URL.
4. Existing published/draft status and content remain unchanged.
5. Existing media paths and associations remain unchanged.
6. Chamber structures and favourites continue to use numeric archive IDs.
7. No historical content or media is mass-migrated in Phase 2.
