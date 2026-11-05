/* Shared constellation navigation module. */
(() => {
  window.VHACrystal?.registerTool({
    id: "constellation",
    label: "CONSTELLATION",
    description: "Open or close the website's navigable star map.",
    presentation: "overlay",
    run: () => document.querySelector(".vha-map-toggle")?.click()
  });
})();