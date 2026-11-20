# CMS data model and transaction design

This is the storage contract for the GitHub-only CMS described in `CMS_MIGRATION_PLAN.md`. It preserves the current Shared Chamber editor and moves persistence behind it.

## Existing public contracts verified

### Human Archive

`content/human-archive.json` is a valid canonical collection with:
- `schema_version: 1`, `collection: "human-archive"`;
- `record_count: 140` and 140 records;
- an embedded `media_manifest` with 111 manifest items;
- an `editor_structures` object with 197 entries.

Each current public record includes fields such as:
- `id` (public identifier such as `HA-0004`);
- `legacy_id` (numeric ID used by the existing chamber);
- `date`, `year`, `title`, `url`, `categories`;
- `content_html`, `excerpt_html`, `media_items`.

Each editor-structure entry is keyed by the legacy numeric record ID and can include:
- `record_id`, `public_record_id`, `updated_at`;
- `blocks` (ordered block objects with `id`, `html` and `type`);
- `transmission_body`, `prompt_style`, `lyrics_style`, `output_text`, `output_media`.

### Transmissions

`content/transmissions.json` is a valid canonical collection with six current records. The public record contract includes:
- `id` (currently `T-0001` through `T-0006`);
- `slug`, `title`, `status`, `excerpt`, `category`;
- `content_html`, `media_url`, `media_path`, `media_type`, `media_items`, `media_width`;
- `created_at`, `updated_at`, `published_at`;
- `archive_record_id`, `legacy_id`, `human_archive_id`.

The public JSON remains the source for public Transmissions rendering. The Chamber's current Supabase overlay is replaced with this canonical collection plus the private draft collection for owner editing.

## Private repository layout

The following layout is the proposed v1 contract. It is private-repository content only; no draft path is served by GitHub Pages.

```text
README.md
└── cms-data/
    └── v1/
        ├── sequences.json
        ├── drafts/
        │   └── transmissions/
        │       └── <draft-uuid>.json
        ├── media/
        │   └── drafts/
        │       └── <draft-uuid>/
        ├── human-archive-favorites.json
        ├── private-overrides/
        │   └── <record-id>.json
        ├── preferences.json
        └── audit/
            └── YYYY-MM.jsonl
```

### Draft record

A draft document stores the complete editor state needed to reopen the Chamber without querying a database:

```json
{
  "schema_version": 1,
  "draft_id": "uuid",
  "kind": "transmission",
  "record_id": 3009,
  "post_id": "T-0007",
  "source": "new",
  "status": "draft",
  "created_at": "ISO-8601",
  "updated_at": "ISO-8601",
  "revision": 1,
  "base_public_commit": null,
  "metadata": {
    "title": "",
    "slug": "",
    "category": "",
    "excerpt": "",
    "media_width": 100
  },
  "content": {
    "transmission_body": "",
    "prompt_style": "",
    "lyrics_style": "",
    "output_text": "",
    "output_media": {
      "image": [],
      "audio": [],
      "video": []
    },
    "blocks": [],
    "media_items": []
  }
}
```

The example IDs above illustrate the field types only; actual sequence values must be seeded from the complete source export and reserved transactionally. Do not assume the next public ID from the visible six published records alone.

For an edit of an existing published Transmission, `source` identifies the existing public record and `base_public_commit` records the public commit from which the draft was opened. This enables a clear conflict if the public record changes while the private draft is being edited.

### Sequences

`v1/sequences.json` stores the last verified numeric Transmissions suffix (`transmission_number`) and the last verified Archive record ID (`archive_record_id`). For the verified current export, the initial values are 6 and 3008 respectively, producing the next identifiers `T-0007` and `3009`. The seed must be written once after the export has been checked. Reserving an ID is a private-repository commit with an expected-head check. Concurrent draft creation must not silently allocate the same identifier. Gaps after discarded drafts are acceptable; reuse is not.

### Favourites

`v1/human-archive-favorites.json` stores a JSON array of `{ "record_id": number, "created_at": "ISO-8601" }`. It is private and never written into the public Human Archive collection.

### Private overrides and preferences

- Private overrides are reserved for owner-only settings that must not affect public rendering.
- Public-facing Human Archive structure edits (including ordered blocks and output media) belong in `content/human-archive.json`, not private overrides.
- Editor preferences belong in `v1/preferences.json`; never store credentials or tokens there.

### Audit records

Append one JSONL record per successful private save or publication action. Include action, timestamp, record identifiers, changed paths and the resulting Git commit SHA. Never include the token, file contents, private media bytes or other credentials.

## Media lifecycle

1. Selecting a file in the Chamber does not make it public.
2. Draft uploads are committed to `cms-data/v1/media/drafts/<draft-uuid>/...` in the private repository.
3. The draft JSON references each asset by a private repository path plus filename, media type, MIME type and display name.
4. On Publish, the CMS validates every referenced asset, reads its bytes from the private repository, and creates public blobs under the existing `media/transmissions/T-NNNN/` hierarchy.
5. The same public Git commit updates `content/transmissions.json` and includes every newly published media file. No record may reference a file that is absent from that commit.
6. Only after GitHub confirms the public commit may the private draft be marked published or removed. A cleanup failure must leave a recoverable private copy, not undo a successful public publication.
7. Unpublish first saves a complete private draft, then removes the public record in a separate public commit. If the public commit fails, the still-published public record remains intact and the UI must report that the unpublish is incomplete.

Human Archive media edits follow the same principle but write to the existing `media/human-archive/<record-id>/...` hierarchy and update the corresponding `media_manifest` and `editor_structures` references in the same public commit.

Keep the existing 30 MB per-file limit until a separate measured test justifies a change. Validate file type, size, normalized path, and references before creating any Git objects.

## Commit and conflict rules

- A private draft save is one private-repository commit containing the draft JSON, any new private media and its audit record.
- A public publish/edit/unpublish is one public-repository commit containing the canonical collection JSON, all added/removed media paths and any related public manifest changes.
- Read the current branch head before composing a transaction. Create blobs, a tree and a commit whose parent is that head. Update the branch ref with `force: false`. GitHub rejects a non-fast-forward update if another commit has advanced the branch; treat that as an edit conflict and reload rather than retrying blindly.
- For JSON updates, preserve unrelated records and unknown fields. Validate the collection count and uniqueness of record IDs/slugs before committing.
- Never claim Save or Publish succeeded until the GitHub ref update succeeds.
- A two-repository operation cannot be atomic across both repositories. Order operations so the recoverable private copy is written first for unpublish, and the public publication is confirmed before private cleanup for publish.

## Migration invariants

- Existing Human Archive IDs, record order, titles, dates, categories, HTML, media references, editor structures and block IDs must survive unchanged unless the owner explicitly edits them.
- Existing Transmissions IDs, slugs, categories/movements, body HTML, ordered blocks, media arrangements and public permalinks must survive unchanged.
- Drafts never appear in public JSON or public media paths.
- The five existing Transmissions movements and their existing category values remain intact.
- Signals/community submissions are outside this data model and remain deferred.


### GitHub store implementation notes

The first storage adapter implementation lives in `cms/github-store.js`. It provides private draft creation and persistence, private media upload/read, private favourites, public Archive structure updates, and a publish operation that writes the Transmissions collection, Archive editor structure, and promoted media files in one public Git commit. The private draft is deleted only after that public commit succeeds, preserving a recoverable private copy if publication fails.

The sequence file is intentionally not initialized automatically. The verified export supports seeding `transmission_number: 6` and `archive_record_id: 3008`, but that one-time seed must be performed explicitly after the owner has authenticated and confirmed the private repository is the intended CMS data store.

## Implemented transaction paths

The GitHub store now implements these transaction paths:

- **New draft:** reserve the next identifiers in the private sequence commit, then create the private draft JSON.
- **Autosave:** upload draft media to the private repository, serialize private media paths into the draft, and commit the updated draft with an expected private-branch head.
- **Edit published Transmission:** clone the public record and its editor structure into a private edit draft with the public base commit recorded.
- **Publish:** read the draft and public collections at a known public commit, promote private media, update the Transmissions collection and Archive editor structure together, and create one public commit. Delete the private draft only after that public commit succeeds.
- **Unpublish:** preserve the complete private edit draft first, remove the public Transmission and its editor structure in one public commit, then update the private draft’s base commit.
- **Discard:** remove a new or published-edit draft; for an existing private draft, restore its opening snapshot and remove media uploaded during the edit session.
- **Favourites:** store private owner favourites in the existing array-based JSON shape.

All write operations use expected branch-head checks to detect concurrent changes. A stale editor must reload rather than silently overwrite another commit.
