# Shared Crystal

The Crystal is a site-wide component loaded by the existing shared `game-ui.js` entry point. Pages that already load the shared site interface receive the Crystal runtime automatically; new pages should include the same shared site entry point rather than recreating Crystal markup.

## Structure

- `crystal.js` — lifecycle API and central tool registry.
- `crystal.css` — shared Crystal design tokens; component-specific styling is being consolidated here from the legacy global stylesheet.
- `crystal-loader.js` — one-time loader for the runtime and tool modules.
- `tools/registry.js` — registry bootstrap.
- `tools/star-patterns.js` — Star Patterns registration.
- `tools/mood.js` — Mood registration.
- `tools/radio.js` — V/A Radio registration.
- `tools/constellation.js` — Constellation registration.
- `tools/presentation.js` — Presentation registration (not browser fullscreen).

## Add a page

Load the shared site interface, which currently loads the Crystal runtime:

```html
<link rel="stylesheet" href="/landing-page/game-ui.css">
<script src="/landing-page/game-ui.js" defer></script>
```

Do not copy the Crystal HTML, CSS, or tool implementations into a page.

## Register a tool

A tool module registers one object with `window.VHACrystal.registerTool({ id, label, description, presentation, run })`. The runtime exposes `getTools()`, `getTool(id)`, `runTool(id)`, `setOpen(value)`, and `isOpen()`.

## Migration status

This is the compatibility foundation. The existing constellation renderer, radio player, mood engine, and presentation reader are still executed by their established site scripts; the new modules currently register and delegate to those existing controls. Their implementation and styling will be moved into the matching tool modules in controlled steps so current behaviour is not lost. Until that extraction is complete, update the legacy execution code as well as the corresponding module when changing a tool's internal behaviour.
