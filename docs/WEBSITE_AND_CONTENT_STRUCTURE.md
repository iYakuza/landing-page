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
├── posts/                      Transmissions page and post-related files
│   ├── index.html              Transmissions page layout
│   ├── posts.js                Loads and displays post records
│   ├── posts.css               Transmissions-specific appearance
│   ├── posts.json              Static snapshot of published Transmissions
│   ├── community/              Community Signals page route
│   ├── imported/               Individually imported legacy posts and media
│   └── the-awakening/ ...      Five movement landing pages
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
| `.html` | The page's structure and visible content placeholders | `index.html`, `posts/index.html` |
| `.css` | Colours, spacing, fonts, layout and responsive design | `game-ui.css`, `typography.css`, `posts/posts.css` |
| `.js` | Behaviour: loading data, buttons, search, filters, editors | `posts/posts.js`, `human-archive/archive.js` |
| `.json` | Structured information, such as posts, metadata or indexes | `posts/posts.json`, `human-archive/archive-content.json` |
| Images / audio / video | The actual media files displayed or played by pages | `assets/`, `posts/imported/` |
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

A page can use both shared files and its own files. For example, Transmissions uses the shared visual files plus `posts/posts.css` and `posts/posts.js`.

## 3. The three content collections

The three labels below are a useful way to understand the content. They are not yet implemented as three completely separate, consistently named folders or databases.

### T — Transmissions (creator posts)

**Public page:** `/posts/`

**Current source of truth:** Supabase table `public.vha_posts`.

**GitHub copy:** `posts/posts.json` on this recovery branch contains the six published Transmissions only. The 51 test drafts have been excluded from this public-post snapshot.

**How it currently works:** `posts/index.html` provides the page layout; `posts/posts.js` currently queries Supabase for published rows and renders them. The JSON snapshot exists, but the current page script has not yet been switched to use it.

**Media:** The post records refer to image, audio and video files. Most Transmission media references still point to Supabase Storage and have not yet been copied into the repository. WFH has a local imported-post folder at `posts/imported/wfh/`.

### HA — Human Archive (historical archive)

**Public page:** `/human-archive/`

**Current content snapshots:**
- `human-archive/archive-data.json` — record metadata/index.
- `human-archive/archive-content.json` — historical record content.
- `human-archive/media-manifest.json` — inventory of media references; a manifest is a list of files, not the files themselves.

The checked-in snapshot contains 140 historical records. The archive page is implemented by `human-archive/index.html`, `human-archive/archive.js` and the archive CSS files.

Additional archive structures and favourites are held in Supabase and were exported under `recovery-data/` on this recovery branch. The archive's media files are not all stored in the GitHub repository yet.

### S — Signals (visitor submissions)

**Public page:** `/signals/`

**Current source of truth:** Supabase table `public.poetry_submissions`.

**Current GitHub recovery export:** `recovery-data/poetry-submissions.json` contains the published submission export after test/rejected rows are excluded.

**How it currently works:** The community page uses the shared post-rendering script in community mode. That script currently queries Supabase; a local static Signals feed has not yet been connected.

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
| T — Transmissions | Supabase `vha_posts`; six published rows also exported to `posts/posts.json` | Supabase query in `posts/posts.js` | Text snapshot recovered; most media still to copy; page not yet switched to local JSON |
| HA — Human Archive | Static JSON snapshots plus Supabase structures/favourites and media storage | `human-archive/archive.js` | 140 historical records have static snapshots; additional structures exported; media recovery remains incomplete |
| S — Signals | Supabase `poetry_submissions`; published export in `recovery-data/poetry-submissions.json` | Supabase query in shared `posts/posts.js` community mode | One published submission in the export; local static feed not yet connected |

The intended direction is for the public pages to read published content and media from GitHub, so visitors do not need Supabase to view existing posts. Supabase can remain available for administrative actions and new submissions until those workflows have a verified replacement.

## 6. Branches: which one is live?

- `main` is the existing website branch.
- `recovery/supabase-content-export-20261119` is a separate recovery workspace. It is not the live website.
- Recovery changes should be tested here first. They should reach `main` only after the content, media and page behaviour have been verified.

This document describes the repository contents inspected on the recovery branch. It is not a claim that every recovery task is complete.
