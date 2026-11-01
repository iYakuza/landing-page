# Mood Engine — Implementation Notes

## Current code ownership

- `tools.js`: Viewer Tools markup, preset interactions, phrase matching, profile application, persistence and reset.
- `tools.css`: shared site typography baseline and global navigation.
- Page stylesheets: page-specific component definitions. These must not be the place for mood-specific duplication.

## Current behaviour

The engine stores the selected profile and palette in `localStorage` under `vha-mood-palette`. On page load, Viewer Tools reads the saved value and reapplies the profile. The raw free-text description is not persisted.

The renderer adds `data-vha-mood` to the root element and injects dynamic styles. The global theme tokens and explicit component selectors ensure that shared and page-specific surfaces respond to the active profile.

## Typography loading

The expressive display fonts are requested from Google Fonts on mood application:

- Comic Neue — Happy
- Great Vibes — Romantic
- Metal Mania — Angry

System fallbacks are defined in each profile. If the font service is unavailable, the site should remain legible. Reset removes the injected font stylesheet link.

## Known architectural debt

The Mood Engine is currently embedded in the larger Viewer Tools script. That is acceptable for the current feature size but makes the mood system harder to test and extend. Refactor into dedicated files when the next substantial feature is added:

- `mood-engine.js`: profile catalogue, matching, state, persistence and application API.
- `mood-engine.css`: shared visual tokens and component adaptation rules.
- `docs/mood-engine/MOOD_PROFILES.md`: human-readable design catalogue.
- `docs/mood-engine/README.md`: architecture and operating principles.

Viewer Tools should then call a small public interface, for example `MoodEngine.apply(description)`, `MoodEngine.applyProfile(id)`, `MoodEngine.reset()` and `MoodEngine.getActiveProfile()`.

## Future profile data shape

```js
{
  id: "romantic",
  label: "Romantic",
  keywords: [{ phrase: "tender", weight: 1 }, { phrase: "in love", weight: 2 }],
  colors: {
    page: "#160d17",
    surface: "#251326",
    text: "#f4dfeb",
    muted: "...",
    accent: "#d99abd",
    border: "..."
  },
  typography: {
    body: "Georgia, serif",
    display: "Great Vibes, cursive",
    scale: "expressive",
    lineHeight: 1.9,
    letterSpacing: "0.01em"
  },
  layout: {
    density: "intimate",
    spacing: "relaxed",
    geometry: "organic",
    columns: "editorial"
  },
  details: {
    shadows: "soft",
    pattern: "none",
    media: "soft-frame"
  },
  motion: "gentle"
}
```

The example is a target schema, not the current runtime object. Keep this distinction clear until the refactor is complete.

## Regression test matrix

Test each profile on:

- Homepage / landing page
- Green Dream page
- CV page, including profile panel, grid and floating navigation
- Music and listening sections
- Posts archive and each transmission
- Community / Signals page
- Viewer Tools panel and dropdown navigation

For each page verify:

1. Fonts visibly change where intended and remain readable.
2. Body text uses the profile body font; display font is limited to headings/short accents.
3. Cards, media rows, CV components, dropdowns and forms use the active palette.
4. No text becomes invisible or low contrast.
5. No horizontal overflow is introduced at mobile widths.
6. Saved mood survives navigation and refresh.
7. Reset restores the exact original typography, colours and layout.
8. Browser back/forward and dynamic content do not leave unthemed components.

## Implementation status

- [x] Declarative mood profile styling added to the existing renderer.
- [x] Romantic profile and preset added.
- [x] Happy / Romantic / Angry expressive typefaces mapped to their display/body roles.
- [x] Remote font loading and reset cleanup added.
- [ ] Extract profile catalogue and renderer from `tools.js`.
- [ ] Expand profile data to full layout and component tokens.
- [ ] Add automated contrast, overflow and persistence tests.
