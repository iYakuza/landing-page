/* Presentation mode — guided page presentation, not browser fullscreen control. */
(() => {
  window.VHACrystal?.registerTool({
    id: "presentation",
    label: "PRESENTATION",
    description: "Present the site's chapters in a focused, navigable sequence.",
    presentation: "overlay",
    run: () => document.querySelector('#vha-viewer-tools [data-tool="presentation"]')?.click()
  });
})();