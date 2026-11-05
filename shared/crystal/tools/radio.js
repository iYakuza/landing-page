/* Radio tool registration. The shared radio player remains the playback provider. */
(() => {
  window.VHACrystal?.registerTool({
    id: "radio",
    label: "V/A RADIO",
    description: "Show or minimise the shared listening player.",
    presentation: "dock",
    run: () => document.querySelector('#vha-viewer-tools [data-tool="radio"]')?.click()
  });
})();