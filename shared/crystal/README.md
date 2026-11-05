# Shared Crystal

The Crystal is a reusable site-wide component. Existing pages use the backwards-compatible `game-ui.js` entry point, which delegates to this runtime. New pages can load the Crystal loader directly. New pages should include the shared site styles and one script entry point, not copy Crystal markup or tool behaviour.

## Structure

- `runtime.js` — lifecycle API, open/closed state, and central tool registry.
- `crystal.js` — Crystal interface, tool dock, accessibility controls, and UI lifecycle.
- `crystal.css` — shared Crystal dock and tool styling.
- `crystal-loader.js` — ordered one-time loader for the runtime and tools.
- `tools/registry.js` — central registration for shared navigation tools.
- `tools/constellation.js` — constellation navigation renderer, routes, drag behaviour, saved positions, and page integration.
- `tools/star-patterns.js` — pattern picker control and preset application.
- `tools/mood.js` — mood prompts, AI theme generation, contrast safeguards, persistence, and reset.
- `tools/radio.js` — complete V/A Radio player, YouTube playlist engine, drag/resize persistence, and Crystal visibility control.
- `tools/presentation.js` — in-page editorial presentation and post reader. It does not use browser fullscreen.

## Add Crystal to a new page

Include the shared site stylesheet and the single entry script:

```html
<link rel="stylesheet" href="/landing-page/game-ui.css">
<script src="/landing-page/shared/crystal/crystal-loader.js" defer></script>
```

The entry script loads the runtime, navigation and tools in dependency order. Do not add per-tool scripts or duplicate the Crystal HTML.

## Tool registration

A tool registers with `window.VHACrystal.registerTool({ id, label, description, presentation, run })`. The runtime exposes `getTools()`, `getTool(id)`, `runTool(id)`, `setOpen(value)`, `isOpen()`, and `refresh()`.

## Styling boundary

Crystal dock and tool styles are in `crystal.css`. The constellation field, site-wide navigation and legacy page-theme selectors remain in `game-ui.css`, because that stylesheet also contains the shared visual system for the website. New Crystal-only styles belong in `crystal.css`.
