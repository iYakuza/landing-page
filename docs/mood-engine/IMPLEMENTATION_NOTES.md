# Match My Mood — Implementation Notes

## Current code ownership

- `shared/crystal/crystal.js`: Viewer Tools shell and Match My Mood selector markup.
- `shared/crystal/tools/mood.js`: eight preset definitions, contrast guardrails, theme application, persistence and reset.
- `shared/crystal/crystal.css`: shared Crystal dock, mood panel and helper-text styling.
- Page stylesheets: page-specific component definitions. They are not the source of individual mood presets.

## Current behaviour

The visitor selects one of eight fixed emotions and activates **Apply this atmosphere**. The renderer applies the corresponding palette, font stacks, type scale, line height, letter spacing, spacing, panel padding, corner radius and shadow.

The selected preset ID is stored in local storage under `vha-mood-preset-v2`. On page load, the renderer validates the saved ID against the known preset catalogue and reapplies that preset. Reset clears the saved ID and removes injected theme styles.

No free-text description is collected. The mood feature does not call an AI endpoint or any remote service.

## Preset catalogue

The eight preset objects are defined in `shared/crystal/tools/mood.js`:

- `joy`
- `trust`
- `fear`
- `surprise`
- `sadness`
- `disgust`
- `anger`
- `anticipation`

Each object contains the same complete token set. Add or revise a preset as data; do not add emotion-specific branches to unrelated page stylesheets.

## Typography

All font stacks are local system fallbacks:

- Serif: Georgia / Times New Roman
- Sans-serif: Arial / Helvetica
- Monospace: ui-monospace / Consolas
- Humanist: Trebuchet MS / Arial

No Google Fonts stylesheet, external font request, or font-loader cleanup is required.

## Contrast and rendering

The renderer retains its contrast guardrails:

- Foreground text is adjusted to meet a 4.5:1 target across page, surface and raised surfaces.
- Borders and glow indicators are adjusted to a 3:1 target.
- Page and surface luminance are kept visibly distinct.
- Focus indicators and interactive states remain explicit.

The renderer applies a site-wide theme marker to the document root and injects the shared overrides and profile-specific typography/spacing rules. Reset removes those injected styles and returns the document to the default theme.

## Privacy

The only persisted mood-related value is the selected preset ID. No free-text emotional content is collected, transmitted, logged or stored remotely.

The retired AI mood Worker and its endpoint are no longer part of the implementation.

## Regression test matrix

Test each preset on:

- Homepage / landing page
- Green Dream page
- CV page, including profile panel, grid and floating navigation
- Music and listening sections
- Posts archive and all five movements
- Community / Signals page
- Viewer Tools panel and dropdown navigation

For each page verify:

1. Body and display fonts change as intended.
2. Paragraphs, controls and navigation remain readable.
3. Page and component surfaces use the selected palette.
4. Text and non-text contrast remain sufficient.
5. No horizontal overflow is introduced at mobile widths.
6. The saved preset survives navigation and refresh.
7. Reset restores the default typography, colours and layout.
8. Dynamic content does not remain in an unthemed state.

## Implementation status

- [x] Eight declarative emotion presets added.
- [x] AI prompt generation and AI theme generation removed.
- [x] Site-wide contrast safeguards retained.
- [x] Typography, type scale, spacing and geometry tokens defined per preset.
- [x] Local preset-ID persistence and reset implemented.
- [x] Third-party font loading removed from the mood feature.
- [x] Retired AI Worker endpoint removed from page Content Security Policies.
- [ ] Add automated contrast, overflow and persistence tests.
- [ ] Complete manual visual review across all listed page types.
