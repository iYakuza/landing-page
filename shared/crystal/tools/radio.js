/* V/A Radio — player component, playback bridge and Crystal visibility control. */
(() => {
  if (!document.getElementById("gd-radio")) {
    const radio = document.createElement("aside");
    radio.className = "gd-radio";
    radio.id = "gd-radio";
    radio.setAttribute("aria-label", "Draggable radio player");
    radio.innerHTML = '<div class="gd-radio-head" id="gd-drag"><span>◉ V/A RADIO <small>LIVE SIGNAL</small></span><button id="gd-close" aria-label="Minimize radio" aria-expanded="true">−</button></div><div class="gd-radio-body"><div class="gd-eq paused" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><p class="gd-tiny">NOW TRANSMITTING</p><strong class="gd-track" id="gd-track">Green Dream Playlist</strong><small class="gd-artist" id="gd-artist">Choose a video to play</small><div class="gd-controls"><button id="gd-play" aria-label="Play radio">▶ PLAY</button></div><div class="gd-stations gd-video-picker"><label for="gd-video-select">PLAYLIST // SELECT A VIDEO</label><select id="gd-video-select" aria-label="Choose a video from the Green Dream playlist"><option value="">Loading playlist titles…</option></select></div><div class="gd-player" id="gd-player" hidden></div><small class="gd-note" id="gd-radio-note">Loading the video list from your YouTube playlist…</small></div>';
    document.body.appendChild(radio);
    const playerScript = document.createElement("script");
    playerScript.src = "/landing-page/green-dream/script.js?v=20261103-radio-content-3";
    playerScript.async = false;
    document.body.appendChild(playerScript);
  }
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