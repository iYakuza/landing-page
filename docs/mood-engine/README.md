# Mood Engine

**Status:** Active feature / iterative implementation  
**Owner surface:** Viewer Tools → Match my mood  
**Runtime entry point:** `tools.js`  
**Scope:** Site-wide visual adaptation across Verse After Hours and Green Dream pages

## Purpose

The Mood Engine translates a visitor's self-described emotional tone into a coordinated visual atmosphere. It is a creative personalisation feature, not a mood diagnosis, mental-health assessment, or therapeutic intervention.

The engine should change the *experience*, not only the colour palette. A mood profile can influence:

- Colour palette and contrast relationships
- Body and display typography
- Type scale, weight, line-height and letter spacing
- Spacing and content density
- Card geometry, borders, shadows and surface treatment
- Page composition and component arrangement
- Motion intensity and transition behaviour
- Media framing and decorative detail

## Architecture

Keep these concerns separate as the feature grows:

1. **Input layer** — free-text description and optional preset chips. It gathers only what the visitor chooses to share.
2. **Mood interpretation** — keyword/phrase scoring maps text to a profile. It should be explainable, deterministic and conservative when confidence is low.
3. **Profile catalogue** — declarative definitions of visual tokens. Adding a profile should normally mean adding data, not duplicating application logic.
4. **Theme renderer** — applies profile tokens through CSS custom properties and scoped selectors. It must work across every page and shared component.
5. **Persistence** — stores the selected profile and palette locally so it follows the visitor between pages. No mood text is sent to a server.
6. **Reset** — removes the active profile, dynamic styles and font loader, then restores the site's default design.

The current implementation lives in `tools.js`. The next refactoring step should move the profile catalogue and rendering rules into dedicated `mood-engine.js` and `mood-engine.css` files while leaving Viewer Tools responsible for opening the gadget and collecting input.

## Runtime flow

```text
Visitor describes a feeling / selects a preset
                 |
                 v
        Mood interpretation
                 |
        confidence / ambiguity
           /           \
       clear            unclear
         |                 |
         v                 v
   Select profile     Reflective fallback
           \           /
            v         v
          Load profile tokens
                 |
                 v
       Apply site-wide visual system
                 |
                 v
       Persist profile locally
                 |
                 v
        Navigate across pages
                 |
                 v
        Reapply saved profile
```

## Profile contract

Every profile should define, at minimum:

- `id`, `label`, `description`
- `keywords` and phrase weights for interpretation
- `colors`: page, surface, text, muted, accent, border
- `typography`: body family, display family, scale, weight, line-height, letter spacing
- `layout`: density, spacing, content width, columns, card geometry
- `details`: shadows, borders, patterns, media treatment
- `motion`: none, reduced, gentle or expressive
- `accessibility`: minimum contrast expectations and fallback behaviour

Profiles should be declarative and versionable. Avoid embedding mood-specific rules in unrelated page stylesheets.

## Design principles

- **Atmosphere, not stereotype:** mood names are creative directions, not universal claims about how people feel.
- **Legibility before expression:** expressive display fonts must not make paragraphs, controls or navigation difficult to read.
- **Coherent change:** typography, spacing, colour and component treatment should reinforce one another.
- **Preserve identity:** mood adaptation should not erase the site's imagery, content hierarchy or navigation.
- **Respect user agency:** the visitor can edit their description, choose a preset, change profile or reset at any time.
- **Low stimulation when appropriate:** anxious and tired profiles reduce motion and visual clutter; never add flashing or aggressive movement.
- **Responsive by default:** density and layout changes must not create horizontal scrolling or hide content.
- **Reversible:** reset must restore the original site styles, including font families.
- **Graceful fallback:** if a remote font fails, a local system fallback keeps the page readable.

## Privacy

The visitor's free-text description is processed in the browser. The selected profile and palette are stored in local storage to persist across pages. Do not transmit, log, or store the raw description. The current expressive typefaces are loaded from Google Fonts when the mood feature is applied; this introduces a third-party font request and should be documented if the font provider changes.

## Accessibility and safety

- Keep body copy and controls readable; reserve script/display/novelty fonts for headings and short accents.
- Maintain sufficient text/background contrast for every palette.
- Honour `prefers-reduced-motion`; anxious and tired profiles should further reduce motion.
- Do not use colour as the only indicator of state.
- Do not infer diagnoses or make claims about the visitor's mental health.
- Avoid prescriptive language such as "this will calm you"; describe the visual treatment instead.

## Current implementation

- Existing profiles: Calm, Sad, Anxious, Happy, Angry, Tired, Focused, Hopeful, Reflective fallback.
- Added profile: Romantic.
- Happy uses Comic Neue for a playful, youthful character.
- Romantic uses Great Vibes for display headings with a readable serif body.
- Angry uses Metal Mania for display headings with a neutral sans-serif body.
- Other profiles use system-safe typography stacks.
- Profile persistence and reset remain handled by the existing Viewer Tools mood flow.

## Planned evolution

1. Move profiles into a dedicated catalogue module.
2. Move shared rendering rules into a dedicated stylesheet.
3. Expand the profile schema to cover spacing, density, layout composition, media framing and motion in a consistent way.
4. Add a confidence threshold and a clear "I couldn't confidently match that" state.
5. Add a preview/confirm step before applying a profile.
6. Add a small profile test matrix covering homepage, Green Dream, CV, music and all transmission pages.
7. Add automated checks for contrast, responsive overflow, persistence and reset.

## Change checklist

When adding or editing a profile:

- [ ] Add profile metadata and keywords.
- [ ] Define the full token set; do not leave a profile half-defined.
- [ ] Choose a body font for sustained reading and a display font for personality.
- [ ] Check headings, body copy, buttons, dropdowns, forms, cards, media and SVG/icon treatment.
- [ ] Check desktop, tablet and mobile layouts.
- [ ] Check contrast and reduced-motion behaviour.
- [ ] Check local persistence after navigation and browser refresh.
- [ ] Check reset restores the exact default appearance.
- [ ] Update `MOOD_PROFILES.md` and this document.
