# Content and media architecture

This is the agreed target architecture for the website. It is being introduced on the recovery branch first; the live `main` branch is not changed by this work.

## Public collections and URLs

| Collection | Public URL | Canonical ID | Content file | Media root |
|---|---|---|---|---|
| Transmissions | `/transmissions/` | `T-0001` | `content/transmissions.json` | `media/transmissions/` |
| Signals | `/signals/` | `S-0001` | `content/signals.json` | `media/signals/` |
| Human Archive | `/human-archive/` | `HA-0004` | `content/human-archive.json` | `media/human-archive/` |

The existing Transmissions page and five movement pages have been moved from `/posts/` to `/transmissions/`. The existing Signals community page has been moved from `/posts/community/` to `/signals/`. These were moves/renames of the existing pages, not redesigns or replacements. No redirects were created. The existing Human Archive page remains at `/human-archive/`.

## JSON design

There is exactly one canonical JSON file per collection. Each file contains all published records in that collection, including text, metadata, content blocks, and media references. The actual media bytes are separate files in the media library.

- Transmissions currently contains six published records. The previous UUID is retained as `legacy_id`; the new canonical IDs are `T-0001` through `T-0006` in the order of the recovered snapshot.
- Signals currently contains one published submission with `rights_confirmed: true`. Its previous UUID is retained as `legacy_id`; its canonical ID is `S-0001`. Other submissions are excluded from the public file.
- Human Archive contains 140 records. Existing numeric record IDs are retained as `legacy_id`; canonical IDs use `HA-` followed by the original ID padded to at least four digits. The 111-entry media manifest and all 197 exported editor structures are retained in the same collection JSON so no recovery data is discarded.

## Media paths

Media is organised by collection and canonical record ID, for example:

```text
media/
├── transmissions/T-0001/...
├── signals/S-0001/...
└── human-archive/HA-0004/...
```

A record's media entries contain a relative `src` path, a media type, a display name, the original source URL for recovery provenance, and a recovery status. The source URL is retained for recovery provenance. Human Archive resolves its 108 recovered local files from the manifest and GitHub media tree; three external references remain intentionally unmirrored.

## Publication and security

Only published content belongs in the public collection JSON files. Drafts, rejected submissions, private moderation data, credentials and administrative secrets must not be committed to the public repository. Public GitHub files are readable by visitors; JSON separation is an organisation and performance choice, not an access-control mechanism. The editor must enforce publishing rules and must never put service-role keys or other secrets in browser code or public files.

## Loading

Each public collection page loads its canonical JSON file. The Transmissions public listing treats `content/transmissions.json` as authoritative and does not merge live database rows. Media references marked `pending_recovery` are omitted from public media galleries and embedded media rendering until their files are recovered and the canonical status is updated to `available`. Signals retains its existing loading and submission implementation for now; its future visitor-submission workflow is deferred. Human Archive loads its 140 historical records, media manifest and editor structures from `content/human-archive.json`; its recovered local media resolves to `media/human-archive/HA-####/` paths in GitHub. The existing shared Chamber, administrator permissions, favourites and editor save/upload workflow remain on their current integration in this phase. The collection JSON remains one file per type.

## Recovery and deployment safety

All work is performed on `recovery/supabase-content-export-20261119`. The existing `main` branch remains untouched until content, media, page routes, links, editor workflows and deployment behaviour have been verified. A media reference marked `pending_recovery` must not be treated as a recovered asset. The Human Archive media manifest currently contains 111 entries: 108 files are present in the GitHub media tree, while three external inline references are intentionally not mirrored.
