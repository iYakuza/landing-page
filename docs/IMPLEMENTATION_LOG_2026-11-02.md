# Secure Your Soul — implementation record

Updated: 2026-11-02
Repository: https://github.com/iYakuza/landing-page
Production URL remains: https://iyakuza.github.io/landing-page/

## Authoritative reference
`Secure_Your_Soul_Product_Vision_Experience_Blueprint_UPDATED.docx` (version 1.0, 29 October 2026). This implementation follows its core direction: corporate archive meets forbidden spiritual manuscript; atmosphere over spectacle; mystery with structure; humanity over machinery; entry paths are narrative choices, never permissions; accessibility and real-world clarity remain explicit.

## Current implementation baseline
- Existing page content, navigation destinations, radio, music, posts, CV, Human Archive, Community and CMS are retained.
- Shared presentation layer: `game-ui.css` and `game-ui.js`, loaded on the existing full-page routes.
- Original visual language is authored in CSS/HTML/SVG; no third-party game art or newly generated imagery is required.
- Existing static site URL and GitHub Pages workflow remain the production route.

## GUI decomposition before implementation: World Navigation HUD
1. **System strip:** network state and current destination label.
2. **Shortcut rail:** direct routes to EGO, Garden, Archive, Signals, Listening Room and Circle.
3. **Map control:** keyboard-operable button with expanded state and labelled relationship to the map panel.
4. **World map panel:** responsive overlay with a clear heading, short explanatory copy, map canvas and six linked destination nodes.
5. **Map geometry:** original inline SVG route lines, CSS grid, contour rings and symbolic node marks.
6. **Dismissal behavior:** close button, Escape key and backdrop click; focus returns to the Map control.
7. **Responsive behavior:** horizontal shortcut rail and rearranged map nodes on narrow screens.
8. **Accessibility:** semantic navigation, dialog role, aria-modal, labels, visible focus, reduced-motion compatibility; the map is supplementary and never gates ordinary navigation.

## Changes in this iteration
- Extended `game-ui.css` with the shared HUD, map overlay, route lines, node cards, mobile layout and interaction states.
- Reworked `game-ui.js` to render the HUD and map using local DOM/SVG only; no network calls, storage, accounts or external libraries.
- Preserved all existing page navigation and feature scripts. Added the map as an optional navigation layer rather than replacing page menus.
- Existing page-specific chapter navigation and Guided Reading on Secure Your Soul remain intact.
- The map currently links six existing public destinations. The Workshop remains discoverable through existing site links; no fictional or non-existent destination is presented as a live route.

## Verification and release record
- Previous baseline commit `84e9b5fe85f5678c897db836e89b4f2c0b976c3a`: static-site safety, static security posture, secret scanning and CodeQL reported success; Pages deployment was pending at that check.
- New HUD implementation commits: CSS `208664059203cece9124fb3ccee103cc0a1ceb21`; JS `8b9770c433137b93bcf536b2c5875d77a945fa5b`.
- Static-site safety checks: passed on corrected HUD commit `a5748087fa70a0dbc043f5a2bc54b8082533437a`.
- Secret scanning: passed on the same commit.
- Static security posture and CodeQL: still running at the last check.
- GitHub Pages build/deployment: still pending at the last check.
- An initial JavaScript syntax check caught an over-escaped path regex in `game-ui.js`; corrected it and reran the safety workflow successfully.
- Live website fetch was unavailable during verification, so the published UI has not yet been confirmed.
- No live-browser interaction test has been performed in this iteration.

## Outstanding work
1. Verify all latest GitHub Actions, including static safety, security posture, secret scanning, CodeQL and Pages deployment.
2. Verify published routes and the map overlay on desktop and mobile.
3. Continue page-specific treatments: Secure Your Soul lifepath constellation, Transmissions archive case-file cards, Human Archive record vault, Listening Room/radio console and Garden/Arcana map.
4. Review Signal intake against the blueprint before enabling public publishing: explicit publication consent, validation, moderation, attribution, retention and removal route.
5. Add a real Discord invite only after one is configured; do not ship placeholder external destinations.
6. Maintain clear distinction between fictional in-world claims and actual website functionality.


## Visual correction — EGO dashboard (2026-11-02)
The previous shared HUD did not resemble the supplied game-dashboard mock-up. It was a navigation strip and a modal map, not a complete command-centre composition. This was acknowledged and corrected with a page-specific rebuild.

### GUI decomposition implemented
- Top system bar: island network state, sector and current node.
- Main hero stage: existing EGO portrait asset retained, layered with original inline SVG moon, mountain silhouettes, tree silhouettes and pagoda geometry.
- Left identity block: EGO title, declaration, short philosophy line and archive entry action.
- Right mission panel: objective headline, description, first-path action and compact world stats.
- Bottom destination rail: Green Dream, Transmissions, Human Archive, V/A Radio and The Circle.
- Project source link: GitHub repository destination.
- Lower status labels: one human, unfinished record, no final form.
- Mobile adaptation: stacked mission panel and 3-column shortcut rail.

### New commits
- EGO hero HTML: `ad200da3b7b9bb9a558b29b3567f7406980dcb9f`
- EGO dashboard styling: `c5be17bcbe16b1b27c98f73364e7a3883332de08`

### Visual reference
The Canva design job has completed and is available as a separate editable reference: https://canva.link/bztcuhso2nrkrd4
This is not installed website functionality and is not treated as an implemented page.

### Latest verification snapshot
- Secret scanning: passed on `c5be17b`.
- Static-site safety, static security posture, CodeQL and Pages deployment: in progress at the last check.
- No live browser screenshot or cross-device visual comparison has been performed yet.


## Transmissions archive — dossier record treatment (2026-11-02)

### GUI decomposition implemented
- Stable-looking archive record code derived from the publication date, with a short list ordinal.
- Metadata row separating record identity, publication date/disclosure control, movement category and existing actions.
- Persistent title and excerpt preview so each transmission is identifiable before opening.
- Expanded body remains a separate disclosure region; media and original content are preserved.
- Restrained dossier treatment: narrow acid-green spine, archival linework, muted metadata, readable title hierarchy and responsive metadata wrapping.

### Functional preservation
- Supabase queries, public-only published records, newest-first ordering and pagination are unchanged.
- Search, movement/category filtering, direct post URLs, edit controls, sharing, image viewer and expandable Suno sections are retained.
- No schema, RLS policy, storage bucket or external service was changed.

### Commits
- Archive renderer: `d9b8c34a494e4b812ce1b1844e7d0121701e40c3`
- Dossier styling: `83575788455b793e4dd65dfc57ccdcfc7e5ded22`
- Asset cache refresh: `1a785a87ffbe5488c6ffa169de8cbcec86ce9a0b`

### Verification
- The preceding EGO dashboard baseline (`9afdcdf`) has completed successfully across static-site safety, static security posture, secret scanning, CodeQL and Pages deployment.
- This archive iteration has just been committed; its own Actions and Pages deployment must be checked before calling it verified.
- Live visual/browser interaction checks remain outstanding; repository code inspection alone does not establish cross-device appearance.


## Listening Room — functional playlist console (2026-11-02)

### GUI decomposition implemented
- Channel header with room identity, playback state and concise listening guidance.
- Embedded playlist display framed as a quiet audio console rather than a promotional player card.
- Privacy-enhanced YouTube embed using the existing Green Dream playlist ID already used by the site's radio implementation.
- Explicit user-initiated playback; no autoplay parameter.
- Small source/status footer and listening note explaining the external player.
- Existing Suno original-track panel and all existing destinations remain below the new console.

### Security and maintenance
- Added only the exact `youtube-nocookie.com` frame source required by the new embed to this page's CSP.
- Removed a duplicate analytics.js include found during inspection; the page now loads the analytics script once.
- Did not alter the Green Dream draggable radio, playlist source, Supabase, or existing radio geometry behavior.

### Commits
- Listening Room console: `fe9456394ca9968e19422a1a9911792a33771dff`
- Duplicate analytics include removal: `56109f72c73ce0619b66234e6d7a1ce23c44632c`

### Verification
- This iteration's static safety, security, secret scanning, CodeQL and Pages deployment checks are triggered by the commits and remain to be confirmed.
- Embedded playlist playback requires a browser test; repository inspection confirms the playlist ID matches the existing Green Dream radio configuration.


## Human Archive — personal record vault (2026-11-02)

### GUI decomposition implemented
- Each legacy record now has a distinct archive identifier derived from its original year and WordPress record ID.
- Year marker, original date and source context are separated into a clear metadata hierarchy.
- Titles receive a stronger editorial hierarchy while each record remains a direct link to its original WordPress source.
- Cards use restrained archival geometry and muted linework, consistent with the Human Archive's role as a personal record vault.
- Responsive single-column layout retained for narrow screens.

### Functional preservation and hardening
- Search now matches title, year, date and original record ID.
- Year filtering, newest-first presentation and original WordPress destinations remain intact.
- Archive JSON is validated as an array; records are checked for required fields and outbound links are restricted to HTTPS on the original WordPress host before rendering.
- Links continue to open in a new tab with `noopener noreferrer`.
- No record data, URLs, or original WordPress content was rewritten.

### Commits
- Archive renderer: `91308a4beb9ea176a2632171ab410a8581d66c0a`
- Record-vault styling: `fc916345aa2274d697d1b7a2fe32f36777260693`
- Asset cache refresh: `8f10adb430ef818554c5b0724372729223e3880a`

### Verification
- The Human Archive iteration has been committed; latest CI and Pages deployment must be confirmed before release verification.
- Visual browser review remains outstanding.


## World map keyboard containment refinement (2026-11-02)
- Added a keyboard focus loop while the world map dialog is open, so Tab and Shift+Tab remain inside the modal.
- Escape still closes the map; focus returns to the element that opened it.
- Preserved and restored the body's previous inline overflow value rather than always clearing it on close.
- Commit: `d3fc0b8fc735e1e88f554dfea41e3a9853867d05`.
- This is a progressive accessibility improvement; screen-reader and real-browser testing remain outstanding.

- Follow-up refinement: transmission dossier codes now use the publication date plus a slug-derived token, so they remain stable when search or movement filters change the visible list order. Commit: `fb8b5cc54117a3e5024e35f2c221628b693674c7`; asset version refreshed in `cddbfb93adaf0e8903e346827d76192180bd4356`.


## Corrective direction reset — institutional three-path entrance (2026-11-02)

The prior iterations over-indexed on generic green HUD styling and dossier decoration. That did not meet the Blueprint's creative direction. This correction shifts the homepage experience toward the defined visual identity: corporate archive meets forbidden spiritual manuscript; deep charcoal/dark green, bone-white text, muted jade, restrained gold, serif editorial titles, monospaced metadata, tactile grain, meaningful negative space, and clear non-fictional navigation.

### Homepage experience implemented
- Added an institutional visitor-entry chapter immediately after the personal EGO identity hero.
- Introduced the three required narrative entry paths: Community, Institution, Wanderer.
- Each path has a distinct purpose, descriptive copy, and a real existing destination; none is an access gate.
- Added explicit copy clarifying that paths are invitations and visitors may move freely between them.
- Built an editorial three-column composition with restrained gold rules, muted jade, serif display type, quiet texture, and a responsive stacked layout.
- Preserved the existing EGO hero, Green Dream, radio, CV, community and other homepage sections.

### Acceptance alignment
- Supports FR-02 (three optional entry paths).
- Reinforces FR-01 (central narrative question) and the Blueprint's mystery-with-structure principle.
- No claims that the real site preserves a soul or uploads a personality.
- No backend, schema, RLS, or external service changes.

### Commit
- `62f9ed4266e8fcf3d87892aab4a124a1795f9eaa`

### Verification
- CI and Pages deployment triggered for this commit; pending final run status.
- This change is a structural step toward the Blueprint, not a claim that the whole website now matches the target experience. The rest of the site still needs the same page-specific visual treatment and browser comparison.


## Secure Your Soul — purpose and entry-path clarification (2026-11-02)

The page previously presented its fictional premise too indirectly. A visitor could reasonably mistake the Institute's language for a real service or fail to understand what the experience asks them to do.

### Changes
- The hero now explicitly identifies the page as speculative fiction before the visitor begins intake.
- States the central question in plain language: if a machine remembers everything about you, is it still you?
- Explains the visitor's role: examine the Institute's case, compare evidence and decide what to believe.
- Clarifies that exploration does not submit or store visitor information.
- Renames the primary action from "Begin Intake" to "Explore the Story".
- Reworked the three paths into genuinely distinct reading routes: Community → Human Counter-Archive, Institution → Official Protocol, Wanderer → Unclassified Record.
- Reinforces that paths are narrative perspectives, not accounts, permissions or access controls.
- Added restrained responsive styling for the new orientation copy; no external assets or dependencies.

### Commits
- Hero and explanation: `e4abeea6951b45cf08c769a9e8ac7d50b2fc9524`
- Responsive presentation: `adf2be6ab1aacf20073d387c388e2bafcc7a52e0`
- Distinct entry paths: `aaf44eca4c933eb9126c1abdd828741da10a9ec9`

### Verification
- GitHub Pages build/deployment was queued for `aaf44ec` at the time of inspection.
- The live URL could not be fetched by the web preview cache; published appearance and browser interaction remain unverified.
- Static-site safety and security workflows must be checked after the current deployment run completes.


## GUI mock-up correction — Secure Your Soul command centre (2026-11-02)

The prior chapter-based Continuity Institute page was not the supplied GUI mock-up. The authoritative visual reference is the Canva presentation **Green Dream UX System** (design ID `DAHZyXiqx2Y`, 8 pages), titled “Secure Your Soul — Game Interface System for Green Dream / Verse After Hours”. Its structure is a game-style command centre and shared world interface, not a conventional editorial narrative landing page.

### Reference elements translated into the website
- Shared system/navigation HUD: online network state, current realm/location, world shortcuts and map access.
- EGO Command Centre: personal node hero, node status, realm alignment, bond stability, dream recall and compact status indicators.
- Realm Map: visual node map with Dreamroot Sanctum, Veilwood Grove and Silent Shores, plus an active objective panel.
- Connected destinations: Green Dream exploration, Transmissions mission archive, Human Archive memory vault, Listening Room audio console, Community Hub / The Circle, and Creator Workshop.
- Reused existing live website destinations and the shared HUD/world-map script; no duplicate backend or fabricated submission workflow.
- Clearly labels numeric node/status values as mock-up presentation data, not biological, health or consciousness measurements.
- Responsive desktop-to-mobile layout; CSS-only map drawing; no new external dependencies or generated assets.

### Commits
- Command-centre markup: `c664ce0ded799fcf54fc4ded8ce9fa3ecb09b07e`
- GUI styling: `85cf9a779245b1386ce23693f01abaf36e6cbba7`
- Map control connection: `2be90fb7e6fc387629cc26516b56f2e7cbe0339b`
- CSP-compatible map markers: `aa98e7cf645e23595ddc6198100d0b1cf8c37be3`, `edf86e5baec516361a0f4c87c41dd50fbc3e137e`

### Verification
- Static review confirms the command-centre controls route to existing pages and the map button activates the shared world-map overlay.
- Inline style attributes were removed from map markers to remain compatible with the page Content Security Policy.
- GitHub Actions build, static-site safety and security checks are pending for the latest commit; visual browser verification remains outstanding.
