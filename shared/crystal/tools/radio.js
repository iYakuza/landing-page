/* V/A Radio tool: playback shell integration and Crystal visibility control. */
(() => {
  document.addEventListener("click", event => {
    const button = event.target.closest('#vha-viewer-tools [data-tool="radio"]');
    if (!button) return;
    const radio = document.getElementById("gd-radio");
    if (!radio) return;
    const hidden = radio.classList.contains("radio-hidden");
    radio.classList.toggle("radio-hidden", !hidden);
    radio.setAttribute("aria-hidden", String(!hidden));
    button.setAttribute("aria-pressed", String(!hidden));
    const close = radio.querySelector("#gd-close");
    if (close) {
      close.textContent = hidden ? "−" : "+";
      close.setAttribute("aria-expanded", String(hidden));
      close.setAttribute("aria-label", hidden ? "Minimize radio" : "Restore radio from Viewer Tools");
    }
  });
  window.VHACrystal?.registerTool({
    id: "radio",
    label: "V/A RADIO",
    description: "Show or minimise the shared listening player.",
    presentation: "dock",
    run: () => document.querySelector('[data-tool="radio"]')?.click()
  });
})();