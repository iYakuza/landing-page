/* Constellation tool registration. Navigation and star positioning are in the shared map engine. */
(() => {
  window.VHACrystal?.registerTool({
    id: "constellation",
    label: "CONSTELLATION",
    description: "Open or close the website's navigable star map.",
    presentation: "overlay",
    run: () => document.querySelector('.vha-map-toggle')?.click()
  });
})();