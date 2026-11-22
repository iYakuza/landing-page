# Content architecture

There is one live website: https://iyakuza.github.io/landing-page/.

GitHub Pages serves the static site from `iYakuza/landing-page:main`. The same repository is the source of truth for public content and media.

## Canonical collections

| Collection | File | Public route | Media folder |
|---|---|---|---|
| Transmissions | `content/transmissions.json` | `/transmissions/` | `media/transmissions/` |
| Signals | `content/signals.json` | `/signals/` | `media/signals/` |
| Human Archive | `content/human-archive.json` | `/human-archive/` | `media/human-archive/` |

Published records and files are read directly from GitHub Pages. There is no separate content database.

## CMS

The browser CMS uses the GitHub API. Private drafts, draft media, favourites and sequence state are stored in `iYakuza/iyakuza-cms-private`. An explicit Publish action promotes approved content and media into the public repository.

## Media

The `media/` directory is the permanent public media library. New public assets should be committed there and referenced by repository-relative paths. Do not link the public reader to an external storage bucket.

Some records contain links or embeds from media platforms such as YouTube, Spotify, SoundCloud, Vimeo, Dailymotion or Loom. These are content providers, not storage or CMS backends.

## Site updates

Changes are made directly to production `main`. The website has no staging copy. GitHub Actions checks the source and deploys GitHub Pages after changes to `main`.
