/* Deprecated compatibility entry point.
   The complete V/A Radio implementation now lives in /shared/crystal/tools/radio.js.
   Keep this file only for old bookmarks; do not add player logic here. */
(() => {
  if (window.VHACrystal?.getTool("radio")) return;
  document.addEventListener("vha-crystal-ready", () => {}, { once: true });
})();