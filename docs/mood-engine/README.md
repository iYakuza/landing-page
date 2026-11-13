# Match My Mood — Design System

**Status:** Active / implemented  
**Owner surface:** Crystal → Viewer Tools → Match my mood  
**Runtime entry point:** `shared/crystal/tools/mood.js`  
**UI markup:** `shared/crystal/crystal.js`  
**Panel styling:** `shared/crystal/crystal.css`  
**Scope:** Site-wide visual adaptation across Verse After Hours and Green Dream pages

## Purpose

Match My Mood lets a visitor choose the emotion that feels closest to their present experience. Each choice applies a predefined visual atmosphere designed for that emotion.

This is a creative personalisation feature, not a mood diagnosis, mental-health assessment, or therapeutic intervention. The names are expressive art-direction labels, not claims that everyone experiences an emotion in the same way.

The catalogue uses eight primary emotions from Plutchik's model:

- Joy
- Trust
- Fear
- Surprise
- Sadness
- Disgust
- Anger
- Anticipation

There is no free-text prompt composer, AI-generated prompt, AI-generated theme, or remote mood interpretation.

## Current architecture

1. **Input layer** — a single accessible emotion selector in the Crystal panel.
2. **Preset catalogue** — eight declarative, human-authored visual profiles in `mood.js`.
3. **Theme renderer** — applies the chosen profile through CSS custom properties and scoped site-wide selectors.
4. **Contrast safeguards** — adjusts foreground, accent, muted, border and glow colours to preserve readable contrast.
5. **Persistence** — stores only the selected preset ID in browser local storage so it follows the visitor between pages.
6. **Reset** — removes the active profile and injected styles, then restores the site's default appearance.

## Theme contract

Each preset defines:

- **Identity:** `id`, `mood`, and a short `interpretation` written for the visitor.
- **Colour:** page, surface, accent, muted, border and glow tokens.
- **Typography:** body and display font stacks.
- **Scale and rhythm:** type scale, line height, letter spacing, grid gap and panel padding.
- **Geometry:** corner radius and shadow intensity.

The renderer uses four local system font stacks: serif, sans-serif, monospace and humanist. It does not load third-party fonts.

## Design principles

- **Atmosphere, not stereotype:** the preset is a visual interpretation, not a universal description of an emotion.
- **Legibility before expression:** typography and colour must remain readable across every page.
- **Coherent change:** colour, typography, spacing, scale and geometry should reinforce one another.
- **Preserve identity:** mood adaptation must not erase the site's content hierarchy, navigation or meaning.
- **Respect user agency:** visitors choose a preset or reset it at any time.
- **No forced positivity:** sadness, fear, anger and disgust are not treated as errors to be corrected.
- **Responsive by default:** preset changes must not create horizontal scrolling or hide content.
- **Reversible:** reset restores the default site appearance.
- **Local by design:** the selected emotion is stored in this browser only; no emotion description is collected or transmitted.

## Privacy

The selector submits no free-text description. The feature makes no network request and does not call an AI service. Local storage contains only the selected preset ID under `vha-mood-preset-v2`.

No raw mood text, profile description or personal emotional narrative is sent to a server, logged, or stored remotely.

## Accessibility and safety

- Normal text and interactive controls retain a minimum 4.5:1 foreground contrast target.
- Borders and non-text visual indicators use a 3:1 contrast target where applicable.
- The renderer maintains visible separation between page and surface backgrounds.
- Keyboard focus indicators remain visible.
- Colour is not the only indicator of state.
- No preset makes claims about the visitor's mental health or promises a therapeutic effect.

## Current implementation

| Emotion | Art direction | Body / display type |
|---|---|---|
| Joy | Warm, open, gently expressive | Humanist / serif |
| Trust | Grounded, steady, soft-edged | Humanist / sans-serif |
| Fear | Quiet, spacious, clear | Sans-serif / monospace |
| Surprise | Crisp, bright, energetic | Sans-serif / monospace |
| Sadness | Slow, gentle, contemplative | Serif / serif |
| Disgust | Earthy, direct, uncluttered | Monospace / humanist |
| Anger | Strong contrast, firm structure | Sans-serif / sans-serif |
| Anticipation | Thoughtful, luminous, forward-looking | Serif / humanist |

The exact design tokens are documented in `MOOD_PROFILES.md`.

## Future work

1. Add a manual visual test matrix for homepage, Green Dream, CV, music, archive and transmission pages.
2. Add automated tests for preset persistence, reset, contrast and responsive overflow.
3. Review how the global selectors interact with future site components before expanding the catalogue.
4. Consider mixed-emotion combinations only if they can be designed and explained without introducing generated themes.

## Change checklist

When editing a preset:

- [ ] Keep the preset declarative and human-authored.
- [ ] Define all colour, typography, scale, rhythm and geometry tokens.
- [ ] Check body copy, headings, controls, forms, cards, media and SVG/icon treatment.
- [ ] Check desktop, tablet and mobile layouts.
- [ ] Check text and non-text contrast.
- [ ] Check persistence after navigation and browser refresh.
- [ ] Check reset restores the default appearance.
- [ ] Update `MOOD_PROFILES.md` and this document.
