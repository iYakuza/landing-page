/* Star Patterns tool: opens the picker and exposes the pattern presets. */
(() => {
  const openPicker = () => {
    const map = document.getElementById("vha-world-map");
    if (!map) return false;
    const open = map.dataset.patternsOpen !== "true";
    map.dataset.patternsOpen = String(open);
    const button = document.querySelector('#vha-viewer-tools [data-tool="patterns"]');
    button?.setAttribute("aria-expanded", String(open));
    return open;
  };
  document.addEventListener("click", event => {
    const button = event.target.closest('#vha-viewer-tools [data-tool="patterns"]');
    if (button) {
      event.preventDefault();
      openPicker();
    }
  });
  window.VHACrystal?.registerTool({
    id: "star-patterns",
    label: "STAR PATTERNS",
    description: "Open the constellation preset picker and choose a star arrangement.",
    presentation: "panel",
    run: openPicker
  });
})();