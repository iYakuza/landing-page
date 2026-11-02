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
