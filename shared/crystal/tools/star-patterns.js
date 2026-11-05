/* Star Patterns tool registration. Existing constellation renderer handles the action. */
(() => {
  window.VHACrystal?.registerTool({
    id: "star-patterns",
    label: "STAR PATTERNS",
    description: "Choose a constellation arrangement for the navigation field.",
    presentation: "panel",
    run: () => document.querySelector('[data-tool="patterns"]')?.click()
  });
})();