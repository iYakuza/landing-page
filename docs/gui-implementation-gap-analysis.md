# GUI Reference vs Current Implementation — Gap Analysis

Reference: Library `/GUI.png` (1536 × 1024). Repository baseline: `main` at the time of review. This review is based on source inspection; it is not a browser-rendered pixel-diff.

## Already present (preserve and refine)

- Root `index.html` already contains the five-link Verse After Hours navigation, hero, CV shard, five movement cards, movement summary, latest-poetry grid, subscribe panel, Listening Room panel, footer and back-to-top control.
- `assets/va-logo.svg` is already used by the page and is the correct brand asset to retain.
- `green-dream/movements.svg` contains five reusable vector symbols (`awakening`, `descent`, `reconnection`, `transformation`, `return`).
- `home.js` already loads up to four published posts from Supabase and wires the mobile menu, subscribe hand-off and back-to-top behavior.
- `green-dream/script.js` already provides a YouTube-playlist radio implementation. Do not replace it with fabricated station URLs.
- `home.css` already includes a desktop three-column lower area and responsive breakpoints.

## Material differences from the reference

| Priority | Reference requirement | Current source observation | Work required |
|---|---|---|---|
| P1 | Hero CTA reads “VIEW THE CV” | Root homepage CTA currently reads “EXPLORE THE JOURNEY” and links to Green Dream | Change CTA label and route to the actual CV page/resource |
| P1 | Compact CV shard with filename, dashboard glyph and DOWNLOAD action | Current shard is a profile summary with multiple text rows and “OPEN CV” | Recompose as compact file card matching screenshot; keep destination tied to the real CV resource |
| P1 | Radio shows station artwork, track, transport/volume controls and six selectable station rows | Current player shows a YouTube playlist selector and one play/stop button | First inspect all existing audio/player integrations and supported station metadata; only then map the UI to real playable sources |
| P1 | Screenshot landscape should fill the entire viewport and remain visible behind all sections | Current homepage uses a remote Webflow S3 background with fixed cover and layered gradients | Verify the remote asset is the exact source image; if it is, retain it and tune crop/overlay rather than replacing it |
| P2 | Five tall illustrated movement cards with the reference's exact proportions | Current page uses five inline SVG symbols in the cards; the artwork is stylized vector art | Compare each symbol visually; reuse existing SVG if it matches, otherwise source the original art or make deliberate per-card assets |
| P2 | Poetry cards have four independent thumbnail artworks | Current cards are data-driven; SVG movement artwork is fallback when post media is absent | Preserve Supabase data; ensure four cards have real media URLs matching the screenshot's image treatment |
| P2 | Header has precise brand lockup, navigation centered, status strip and menu icon | Root markup and shared `game-ui.js` both participate in header construction; shared script removes page headers and injects global header | Keep one authoritative header only; verify the injected shared header is visually identical and does not conflict with root header CSS |
| P2 | Lower panels align at the same baseline and use thin cyan frame treatment | Current home CSS defines the same three-panel structure; global game UI adds another shared theme layer | Consolidate conflicting variables/selectors and compare rendered geometry |
| P3 | Footer includes logo mark, left motto, navigation, credit and right-side closing phrase | Root footer markup needs a final detailed comparison against the full reference | Confirm all footer zones and restore missing microcopy if absent |

## Risks to avoid

1. Do not rebuild the page from scratch: the repository already has working navigation, CMS, post loading, radio, and shared game UI.
2. Do not replace the existing crystal / Viewer Tools navigation or global shared navigation while matching the homepage screenshot.
3. Do not embed the full GUI screenshot as a background image. Every button, heading, card, link and form must remain an independent accessible component.
4. Do not create fake subscription success, fake CV downloads, or non-working radio stations.
5. Do not overwrite the separate `/green-dream/` experience simply because the root homepage uses Green Dream imagery.
6. Do not weaken CSP, security headers, routing, Supabase policies, or GitHub Actions to make a visual change easier.

## Recommended implementation sequence

1. Reconcile the root and shared navigation so one header is rendered.
2. Update hero CTA and redesign the CV shard to match the reference while preserving the actual CV destination.
3. Refine hero / movements / editorial aside geometry against the 1536 × 1024 reference.
4. Inspect the full audio integration and implement the screenshot's radio appearance without inventing streams.
5. Validate four real poetry thumbnails and lower-grid spacing.
6. Finish footer and mobile/tablet layouts.
7. Capture a 1536 × 1024 browser screenshot, compare against `GUI.png`, correct visual deltas, and run existing GitHub Actions.

## Status

- [x] Reference located in ChatGPT Library and visually inspected.
- [x] Component hierarchy and approximate reference geometry documented.
- [x] Existing asset inventory reviewed.
- [x] Root homepage and Green Dream implementation inspected.
- [ ] Browser screenshot / pixel-diff QA.
- [ ] Functional visual implementation changes.
- [ ] GitHub Actions validation on the implementation branch.
