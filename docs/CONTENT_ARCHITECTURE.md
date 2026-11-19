# Content and media architecture

This is the agreed target architecture for the website. It is being introduced on the recovery branch first; the live `main` branch is not changed by this work.

## Public collections and URLs

| Collection | Public URL | Canonical ID | Content file | Media root |
|---|---|---|---|---|
| Transmissions | `/transmissions/` | `T-0001` | `content/transmissions.json` | `media/transmissions/` |
| Signals | `/signals/` | `S-0001` | `content/signals.json` | `media/signals/` |
| Human Archive | `/human-archive/` | `HA-0004` | `content/human-archive.json` | `media/human-archive/` |

The existing Transmissions page and five movement pages are to be moved from `/posts/` to `/transmissions/`. The existing Signals community page is to be moved from `/posts/community/` to `/signals/`. These are moves/renames of the existing pages, not redesigns or replacements. No redirects are to be created. The existing Human Archive page remains at `/human-archive/`.

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

A record's media entries contain a relative `src` path, a media type, a display name, the original source URL for recovery provenance, and a recovery status. The source URL is not used by the intended public page once the local file has been recovered.

## Publication and security

Only published content belongs in the public collection JSON files. Drafts, rejected submissions, private moderation data, credentials and administrative secrets must not be committed to the public repository. Public GitHub files are readable by visitors; JSON separation is an organisation and performance choice, not an access-control mechanism. The editor must enforce publishing rules and must never put service-role keys or other secrets in browser code or public files.

## Loading

Each public collection page should load only its own JSON file. The page can render records in batches and lazy-load media where appropriate; the collection JSON remains one file per type.

## Recovery and deployment safety

All work is performed on `recovery/supabase-content-export-20261119`. The existing `main` branch remains untouched until content, media, page routes, links, editor workflows and deployment behaviour have been verified. A media reference marked `pending_recovery` must not be treated as a recovered asset.
