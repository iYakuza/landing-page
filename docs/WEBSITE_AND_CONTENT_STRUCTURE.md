# Website and content structure

This document explains the repository in plain language. It describes the current implementation on the recovery branch and distinguishes it from the intended long-term content model.

## 1. How the website is organised

The repository is the website's project folder. GitHub Pages serves its HTML, CSS, JavaScript, images, audio, video and other static files. A browser combines these files to display each page.

```text
landing-page/
│
├── index.html                  Home page
├── cv/                         Professional profile page
├── green-dream/                Green Dream page and its visual assets
├── human-archive/               Human Archive page, scripts, styles and snapshots
├── transmissions/              Existing Posts page, renamed, plus five movements
│   ├── index.html              Transmissions page layout
│   ├── posts.js                Current shared post renderer
│   ├── posts.css               Transmissions-specific appearance
│   ├── posts.json              Legacy published-post snapshot
│   ├── imported/               Individually imported legacy posts and media
│   └── the-awakening/ ...      Five movement landing pages
├── signals/                    Existing Community Signals page, moved here
├── community/                  Separate Green Dream community landing page
├── content/                    Three canonical collection JSON files
│   ├── transmissions.json
│   ├── signals.json
│   └── human-archive.json
├── media/                      Central media library, organised by collection and ID
├── cms/                        Older administration interface
├── editor-ui/                  Reusable block and rich-text editor code
├── shared/                     Components reused by multiple pages
├── assets/                     Shared logos and images
├── *.css                       Site-wide styles
├── *.js                        Site-wide scripts and behaviours
├── recovery-data/              Exported recovery snapshots (not page layouts)
├── docs/                       Technical notes and operating instructions
├── scripts/                    Backup, restore, validation and migration tools
├── supabase/                   Supabase configuration, functions and migrations
└── .github/workflows/          Automated GitHub tasks
```

### What the common file types mean

| File type | Plain-language purpose | Examples in this repository |
|---|---|---|
| `.html` | The page's structure and visible content placeholders | `index.html`, `transmissions/index.html` |
| `.css` | Colours, spacing, fonts, layout and responsive design | `game-ui.css`, `typography.css`, `transmissions/posts.css` |
| `.js` | Behaviour: loading data, buttons, search, filters, editors | `transmissions/posts.js`, `human-archive/archive.js` |
| `.json` | Structured information, such as posts, metadata or indexes | `transmissions/posts.json`, `human-archive/archive-content.json` |
| Images / audio / video | The actual media files displayed or played by pages | `assets/`, `transmissions/imported/` |
| `.md` | Human-readable documentation | `docs/`, `README.md` |
| `.yml` | Instructions for automated GitHub tasks | `.github/workflows/` |

## 2. Website-wide design and behaviour

These files are shared by multiple pages rather than belonging to one content collection:

- `green-dream/style.css` — shared Green Dream visual foundation.
- `game-ui.css` and `game-ui.js` — shared interface styling and behaviour.
- `typography.css` — shared typography.
- `tools.css` and `tools.js` — shared tools and interactive features.
- `shared/components/` — reusable page-layout components.
- `assets/` — shared logos and images.

A page can use both shared files and its own files. For example, Transmissions uses the shared visual files plus `transmissions/posts.css` and `transmissions/posts.js`.

## 3. The three content collections

The three collections now have separate canonical JSON files in `content/`. The public page loaders are still being migrated to read those files instead of querying Supabase.

### T — Transmissions (creator posts)

**Public page:** `/transmissions/`

**Current source of truth:** Supabase table `public.vha_posts`.

**Canonical GitHub collection:** `content/transmissions.json` contains the six published Transmissions, with permanent IDs `T-0001` through `T-0006`. The original UUIDs are retained as `legacy_id`. The legacy snapshot `transmissions/posts.json` is preserved during the loader transition. The 51 test drafts are excluded.

**How it currently works:** `transmissions/index.html` provides the page layout; `transmissions/posts.js` loads `content/transmissions.json` first and renders those canonical records. When Supabase is reachable, published CMS rows are merged over matching slugs so the existing editor workflow and newly published records remain visible. If that optional overlay fails, the GitHub records still render.

**Media:** The central library is `media/transmissions/{T-ID}/`. WFH's featured image is present at `media/transmissions/T-0006/featured.jpg`. Seven other files remain pending: three matching objects were found in restore storage but downloads returned HTTP 402; the four Purtata corporatriștilor files are absent from the available restore bucket. See `recovery-data/transmission-media-report.json`.

### HA — Human Archive (historical archive)

**Public page:** /human-archive/

**Canonical GitHub collection:** content/human-archive.json contains all 140 records, the 111-entry media manifest, and all 197 exported editor structures. Canonical IDs use HA- plus the original numeric ID; the original number is retained as legacy_id.

**Canonical page loader:** human-archive/archive.js loads the consolidated collection and resolves recovered media to local GitHub files. All 111 media-manifest assets are verified and present locally. The 86 historical Supabase URLs that correspond to those assets are aliases only, not remote fetches. Seven pending Transmission attachments are intentionally unavailable until re-uploaded.

The older archive-data.json, archive-content.json and media-manifest.json files are retained as migration/recovery snapshots, not as the public page's record source.
### S — Signals (visitor submissions)

**Public page:** /signals/

**Canonical GitHub collection:** content/signals.json contains the one published submission with confirmed rights, assigned ID S-0001. The source export is preserved at recovery-data/poetry-submissions.json.

The /signals/ page reads the canonical static JSON through the shared Transmissions reader. New visitor submissions and the moderation queue are paused/deferred. The published Signal's audio attachment is still pending local recovery and is not fetched from legacy storage.

The separate /community/ page is a Green Dream community landing page with a Slack call-to-action. It is not the Signals archive; the Slack link is not an API integration.
## 4. How a content record is stored

A post record is the information describing one post. It can contain:

- A unique ID and a public URL name (slug).
- Title, category, excerpt and publication date.
- The post body, stored as HTML content.
- One or more media references, including the media type and file location.
- Publication status (for example, published or draft).

The JSON record stores the text and the *addresses* of its media. The actual image, audio or video is a separate file and must also be present at the referenced location for it to display or play.

## 5. Current versus intended architecture

| Collection | Current content storage | Current page loader | Recovery status |
|---|---|---|---|
| T — Transmissions | Canonical content/transmissions.json | Homepage, Green Dream and Transmissions readers use the static collection | Six published records; seven media items pending local recovery |
| HA — Human Archive | Canonical content/human-archive.json; legacy snapshots retained for recovery | human-archive/archive.js loads canonical JSON and local media only | 140 records, 111 verified local media assets and 197 editor structures |
| S — Signals | Canonical content/signals.json | Shared transmissions/posts.js reads static JSON | One published, rights-confirmed submission; visitor submissions/moderation paused; one audio item pending local recovery |

Public content readers no longer require Supabase for Transmissions, Green Dream, Signals or Human Archive. The CV contact form remains a separate Supabase-backed exception pending a decision about a dependency-free mailto replacement.
## 6. Branches: which one is live?

- main is the existing production website branch.
- recovery/supabase-content-export-20261119 is the current migration workspace and the source for PR #135.
- iYakuza/landing-page-preview is a separate Preview deployment. It must be browser-verified against the latest recovery-branch commits before merge.
- Recovery changes should reach main only after content, media and page behaviour have been verified and cutover is explicitly approved.

This document describes the repository contents inspected on the recovery branch. It is not a claim that every recovery task is complete.