/* Mood tool registration. Mood generation and theme persistence remain in tools.js. */
(() => {
  window.VHACrystal?.registerTool({
    id: "mood",
    label: "MATCH MY MOOD",
    description: "Generate and apply a visual atmosphere across the website.",
    presentation: "panel",
    run: () => document.querySelector('#vha-viewer-tools [data-tool="mood"]')?.click()
  });
})();