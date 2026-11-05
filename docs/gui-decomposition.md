# GUI Decomposition — Verse After Hours / Green Dream

- **Reference:** Library file `/GUI.png`
- **Canvas:** 1536 × 1024 px (3:2 screenshot)
- **Target:** `https://iyakuza.github.io/landing-page/`
- **Repository:** `iYakuza/landing-page`
- **Branch:** `gui-decomposition-2026-11-05`
- **Purpose:** A visual implementation contract for reproducing the supplied mock-up. Coordinates below are measured from the screenshot and are reference geometry, not hard-coded responsive CSS values.

## 1. Visual system

| Token | Reference |
|---|---|
| Base background | Near-black blue-green, approx. `#031116` |
| Panel background | Translucent deep teal/black, approx. `#03151b` |
| Primary accent | Electric cyan, approx. `#00eaf5` |
| Secondary accent | Acid yellow, approx. `#e9ed00` |
| Main text | Cool off-white, approx. `#dce9e9` |
| Muted text | Blue-grey, approx. `#9eb8bd` |
| Display/type character | Technical, condensed/monospaced uppercase labels; geometric display face for titles |
| Borders | Thin cyan strokes, clipped/chamfered corners, restrained glow |
| Background treatment | Full-bleed cinematic forest/city landscape; dark translucent overlays preserve text contrast |

The screenshot is a single flattened reference image. The background artwork, logo, card illustrations and thumbnails must be treated as separate assets where available; text, borders, controls and layout should be real DOM/CSS rather than baked into a screenshot.

## 2. Page hierarchy

```
Page
├── Ambient background / atmospheric overlay
├── Header
│   ├── VA brand mark
│   ├── Brand title + tagline
│   ├── Primary navigation
│   ├── Open-channel status strip
│   └── Menu toggle
├── Main
│   ├── Hero
│   │   ├── Special-project eyebrow
│   │   ├── GREEN DREAM title
│   │   ├── Three-line introduction
│   │   ├── View the CV action
│   │   └── CV download shard
│   ├── Green Dream overview
│   │   ├── Five Movements heading
│   │   ├── Five movement cards
│   │   └── Editorial summary + Explore More action
│   └── Lower content grid
│       ├── Latest Poetry (four cards)
│       ├── Subscribe panel
│       └── Listening Room panel
├── Floating V/A Radio player
├── Back-to-top control
└── Footer
    ├── VA mark
    ├── Motto
    ├── Secondary navigation
    ├── Credit
    └── Closing microcopy
```

## 3. Reference geometry (1536 × 1024)

Bounding boxes are approximate screenshot pixel coordinates: `x, y, width, height`. Use these to guide proportions at the reference viewport; use CSS Grid/Flexbox and responsive constraints for implementation.

| ID | Element | Approx. bounding box | Notes |
|---|---|---:|---|
| H-01 | Header / brand zone | 0, 0, 510, 86 | VA mark at 47, 15; title and subtitle to its right |
| H-02 | Primary navigation | 520, 39, 630, 47 | Five links; Green Dream active in yellow |
| H-03 | Status strip | 1177, 0, 282, 39 | “NOCTURNE PROTOCOL // OPEN CHANNEL” |
| H-04 | Menu icon | 1490, 14, 27, 24 | Three-line menu |
| R-01 | Floating V/A Radio | 1264, 53, 250, 360 | Fixed desktop panel; collapse/close affordance |
| M-01 | Main content frame | 48, 90, 1246, 836 | Main composition, excluding floating radio |
| G-01 | Hero copy | 49, 145, 640, 230 | Eyebrow, title, three intro lines, CTA |
| G-02 | CV shard | 929, 204, 210, 274 | File title, dashboard preview, download action |
| G-03 | Five Movements panel | 48, 433, 831, 269 | Heading and five illustrated cards |
| G-04 | Movement editorial aside | 907, 478, 190, 239 | Short statement, descriptive copy, Explore More |
| G-05 | Latest Poetry panel | 48, 737, 702, 188 | Four cards in a single desktop row |
| G-06 | Subscribe panel | 772, 740, 240, 181 | Heading, supporting text, email field, yellow submit |
| G-07 | Listening Room panel | 1027, 741, 267, 180 | Headphone icon, description, CTA |
| F-01 | Footer | 0, 941, 1536, 63 | Four aligned zones |
| U-01 | Back-to-top | 1473, 870, 42, 44 | Fixed lower-right control |

## 4. Component inventory and behavior

| Component | Required contents | Expected behavior |
|---|---|---|
| `SiteHeader` | Logo, wordmark, tagline, primary links, status strip, menu toggle | Links navigate to their real destinations; mobile menu opens/closes and exposes expanded state |
| `HeroSection` | Eyebrow, H1, intro, CV CTA | CTA scrolls to or opens the CV resource; heading remains selectable text |
| `CvShard` | CV file identity, compact dashboard/preview graphic, Download button | Download points to the current approved CV file; no fake download |
| `MovementGallery` | Five cards with number, title, artwork | Each card links to its corresponding movement/section; focus and hover states |
| `MovementAside` | Three-line statement, body copy, Explore More | CTA links to Green Dream overview/details |
| `LatestPoetry` | Four latest published items with image, title, date, category | Data-driven cards link to the corresponding post; graceful empty/loading/error states |
| `SubscribePanel` | Email field, submit button, status text | Validate email; submit through an implemented subscription endpoint. Do not imply subscription succeeded if only opening a contact form |
| `ListeningRoomCard` | Headphone icon, copy, CTA | Navigate to the Listening Room |
| `RadioPlayer` | Station art/title, station list, play/pause, previous/next or station selection, volume | Real controls must operate the configured audio streams; close/collapse controls must work |
| `SiteFooter` | Mark, motto, nav, credit, closing copy | Footer links mirror primary navigation |
| `BackToTop` | Up control | Scroll to page top; keyboard accessible |

## 5. Asset decomposition

### Existing repository assets to reuse first

- `assets/va-logo.svg` — primary VA brand mark; inspect and use for header and footer.
- `green-dream/movements.svg` — existing vector movement artwork; inspect symbol IDs and map each movement to the correct symbol.
- `assets/nihil-et-esse.svg` — existing supporting brand/art asset; do not substitute for the VA logo.

### Assets to locate or create

| Asset ID | Description | Preferred format | Fallback |
|---|---|---|---|
| A-01 | Full-bleed Green Dream forest/city landscape | WebP/AVIF | Optimized JPG |
| A-02 | Five individual movement illustrations | SVG or WebP, one per movement | Existing symbols from `movements.svg` |
| A-03 | Four poetry thumbnails | WebP/AVIF | Supabase/WordPress post media |
| A-04 | CV dashboard/document glyph | SVG | CSS-drawn document icon |
| A-05 | Listening Room headphone icon | Inline SVG | Accessible icon glyph |
| A-06 | Radio station cover thumbnails | WebP/AVIF | Station-specific artwork |
| A-07 | VA mark | Existing SVG | None; preserve exact brand mark |

Do not crop text, card borders, or buttons out of the flattened GUI and reuse them as image assets. Those are interface elements and must be recreated in HTML/CSS. Crop only illustration/artwork regions if the original source art cannot be found. Do not invent substitute artwork when an existing project asset is available.

## 6. Layout and responsive rules

- **Desktop (≥1200 px):** header in one row; hero copy and CV shard form a two-column composition; movements gallery and editorial aside form a two-column row; lower content uses poetry / subscribe / listening columns; radio floats top-right.
- **Tablet (621–1199 px):** compact header; collapse primary navigation behind menu toggle as needed; reduce movement and lower-grid columns; keep content readable and prevent radio overlap.
- **Mobile (≤620 px):** single-column hero; CV shard follows hero copy; radio becomes an in-flow or user-invoked panel rather than covering content; movement cards use a two-column grid; lower panels stack; footer wraps.
- Preserve the screenshot's content order at every breakpoint.
- Avoid fixed pixel widths for main content. Use max-width, percentages, `clamp()`, grid minmax and fluid gaps.
- Keep touch targets comfortably tappable and provide visible keyboard focus.
- Respect `prefers-reduced-motion`; do not make readability depend on animation.
- Keep all meaningful text as HTML text, not part of raster assets.

## 7. Implementation mapping in the current repository

The project already contains a substantial static-site implementation. The next coding pass should adapt and reconcile existing files rather than create a parallel site or replace working functionality blindly.

| Existing file | Responsibility to verify |
|---|---|
| `index.html` | Global shell, global scripts/styles, site-level navigation and integrations |
| `home.css` | Homepage layout and responsive rules |
| `home.js` | Homepage behavior, post loading, mobile menu, subscribe interaction, back-to-top |
| `green-dream/index.html` | Green Dream page structure |
| `green-dream/style.css` | Green Dream page styling |
| `green-dream/script.js` | Green Dream interactions |
| `green-dream/movements.svg` | Existing vector movement artwork |
| `assets/va-logo.svg` | Official VA brand mark |
| Radio/player source files | Identify existing player implementation before modifying the radio panel |

The live landing page currently uses `/landing-page/` paths. Preserve GitHub Pages routing, existing Supabase post loading, contact flow, audio integrations, security headers/CSP, and unrelated site sections unless a verified defect requires a change.

## 8. Visual QA acceptance criteria

1. At 1536 × 1024, the page follows the same section order and approximate proportions as the reference.
2. The VA logo is the actual `assets/va-logo.svg`, not typed text or a generated substitute.
3. Navigation has the same five labels and placement; Green Dream is visibly active.
4. The landscape remains full-bleed behind the page composition with sufficient darkening for legibility.
5. Hero title, intro, CV shard, five movement cards and right-side summary align as in the reference.
6. Latest Poetry contains four cards in the desktop layout and remains data-driven.
7. Subscribe and Listening Room occupy adjacent lower panels on desktop.
8. The V/A Radio panel is visually faithful and its controls are functional.
9. Footer has the logo, motto, navigation, credit and closing microcopy.
10. At tablet/mobile widths, no horizontal overflow, overlapping text, clipped controls or obstructed content.
11. All links and buttons have real destinations/actions, accessible names, keyboard focus and appropriate semantics.
12. Existing workflows and security controls remain intact; run the repository's available checks before merging.

## 9. Known gaps / items requiring source confirmation

- The supplied GUI is a flattened image; it does not reveal the original independent source layers or exact font files.
- The full landscape and the five card artworks are not currently listed as standalone files in the repository asset tree. Search existing post media, SVG symbols and connected media sources before generating replacements.
- The screenshot depicts a radio player, but the exact stream URLs and station metadata must come from the existing player implementation; do not fabricate streams.
- The CV filename shown in the mock-up is a visual reference. Keep the actual downloadable CV path consistent with the current site configuration.
- Exact pixel-perfect comparison requires a browser screenshot of the deployed/local implementation at the same viewport and a visual diff pass.

---
This document is the decomposition baseline. Treat the reference screenshot as the visual source of truth and the existing repository as the functional source of truth.
