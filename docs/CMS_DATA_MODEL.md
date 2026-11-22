# CMS data model

The CMS uses GitHub as its storage layer.

## Repositories

- Public: `iYakuza/landing-page`.
- Private: `iYakuza/iyakuza-cms-private`.

## Public content

The public repository contains three canonical collections:

| Collection | File | IDs |
|---|---|---|
| Transmissions | `content/transmissions.json` | `T-0001`, `T-0002`, … |
| Signals | `content/signals.json` | `S-0001`, `S-0002`, … |
| Human Archive | `content/human-archive.json` | `HA-0004`, … |

Published media is stored in `media/transmissions/`, `media/signals/` and `media/human-archive/`. The Human Archive collection includes its editor structures and media manifest.

## Private content

The private repository stores:

- `cms-data/v1/drafts/` — unpublished Transmission drafts.
- `cms-data/v1/media/drafts/` — private draft media.
- `cms-data/v1/human-archive-favorites.json` — owner favourites.
- `cms-data/v1/sequences.json` — next identifier state.

## Publishing transaction

1. Save drafts and draft media to the private repository.
2. On explicit Publish, validate the selected draft and current public repository snapshot.
3. Promote required media into the public `media/` hierarchy.
4. Commit the canonical collection and related editor structure to public `main`.
5. Reconcile the private draft after the public commit succeeds.

Writes use the expected GitHub branch head. If the public snapshot changes during editing, the CMS must stop and ask for reconciliation instead of silently overwriting newer content.

## Security

- Public content and media are public by design.
- Unpublished drafts and draft media stay in the private repository.
- The owner provides a fine-grained GitHub token for the editing session.
- The token is never stored in public files, URLs or commits.
