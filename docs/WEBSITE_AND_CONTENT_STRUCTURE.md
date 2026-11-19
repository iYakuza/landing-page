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

**How it currently works:** `transmissions/index.html` provides the page layout; `transmissions/posts.js` still queries Supabase for published rows and renders them. The canonical JSON has been created but is not yet connected to the page loader.

**Media:** The central library is `media/transmissions/{T-ID}/`. WFH's featured image is present at `media/transmissions/T-0006/featured.jpg`. Seven other files remain pending: three matching objects were found in restore storage but downloads returned HTTP 402; the four Purtata corporatriștilor files are absent from the available restore bucket. See `recovery-data/transmission-media-report.json`.

### HA — Human Archive (historical archive)

**Public page:** `/human-archive/`

**Canonical GitHub collection:** `content/human-archive.json` contains all 140 records, the 111-entry media manifest, and all 197 exported editor structures. Canonical IDs use `HA-` plus the original numeric ID; the original number is retained as `legacy_id`.

**Legacy files still used by the current page loader:**
- `human-archive/archive-data.json` — record metadata/index.
- `human-archive/archive-content.json` — historical record content.
- `human-archive/media-manifest.json` — inventory of media references; a manifest is a list of files, not the files themselves.

The checked-in snapshots contain 140 historical records. The archive page is implemented by `human-archive/index.html`, `human-archive/archive.js` and the archive CSS files. The page loader has not yet been switched to the consolidated canonical JSON.

Additional archive structures and favourites are held in Supabase and were exported under `recovery-data/` on this recovery branch. The archive's media files are not all stored in the GitHub repository yet.

### S — Signals (visitor submissions)

**Public page:** `/signals/`

**Current source of truth:** Supabase table `public.poetry_submissions`.

**Canonical GitHub collection:** `content/signals.json` contains the one published submission with confirmed rights, assigned ID `S-0001`. The source export is also preserved at `recovery-data/poetry-submissions.json`.

**How it currently works:** The existing page has moved to `/signals/` and still uses the shared `transmissions/posts.js` renderer in community mode. That script currently queries Supabase; the canonical static Signals JSON has not yet been connected.

The separate `/community/` page is a Green Dream community landing page. It is not the same page as `/signals/`, which is the Signals archive.

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
| T — Transmissions | Canonical `content/transmissions.json`; legacy snapshot `transmissions/posts.json`; Supabase `vha_posts` remains current loader source | Supabase query in `transmissions/posts.js` | Six published text records consolidated; WFH image copied to central media; seven files remain pending |
| HA — Human Archive | Canonical `content/human-archive.json` plus legacy snapshots and exported Supabase structures | `human-archive/archive.js` still uses legacy snapshots | 140 records, 111 media references and 197 editor structures consolidated; actual media recovery remains incomplete |
| S — Signals | Canonical `content/signals.json`; source export `recovery-data/poetry-submissions.json`; Supabase `poetry_submissions` remains current loader source | Supabase query in shared `transmissions/posts.js` community mode | One published, rights-confirmed submission consolidated; static loader not yet connected |

The intended direction is for the public pages to read published content and media from GitHub, so visitors do not need Supabase to view existing posts. Supabase can remain available for administrative actions and new submissions until those workflows have a verified replacement.

## 6. Branches: which one is live?

- `main` is the existing website branch.
- `recovery/supabase-content-export-20261119` is a separate recovery workspace. It is not the live website.
- Recovery changes should be tested here first. They should reach `main` only after the content, media and page behaviour have been verified.

This document describes the repository contents inspected on the recovery branch. It is not a claim that every recovery task is complete.
