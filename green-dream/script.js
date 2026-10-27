(() => {
  const root = document.querySelector('.gd');
  if (!root) return;

  // The radio is intentionally locked to the owner's curated YouTube playlist.
  const playlistId = 'PL-HvxCN6LbEtKhlSDDndY8mdupqTbTlgn';
  const station = { title: 'Green Dream — curated playlist', artist: 'Verse After Hours // YouTube playlist' };
  const stations = [station];

  let index = 0;
  let playing = false;
  const radio = root.querySelector('#gd-radio');
  const head = root.querySelector('#gd-drag');
  const track = root.querySelector('#gd-track');
  const artist = root.querySelector('#gd-artist');
  const play = root.querySelector('#gd-play');
  const eq = root.querySelector('.gd-eq');
  const player = root.querySelector('#gd-player');
  const note = root.querySelector('#gd-radio-note');
  const stationButtons = [...root.querySelectorAll('[data-track]')];

  function setStatus(message) { note.textContent = message; }

  function stopPlayer() {
    player.replaceChildren();
    player.hidden = true;
    playing = false;
    play.textContent = '▶ PLAY';
    play.setAttribute('aria-label', 'Play radio');
    eq.classList.add('paused');
  }

  function selectStation(nextIndex) {
    index = (nextIndex + stations.length) % stations.length;
    const station = stations[index];
    track.textContent = station.title;
    artist.textContent = station.artist;
    stationButtons.forEach((button, i) => {
      const selected = i === index;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    stopPlayer();
    setStatus('Ready to play the Green Dream playlist. Press PLAY to start it.');
  }

  function startPlayer() {
    const iframe = document.createElement('iframe');
    iframe.title = station.title;
    iframe.src = 'https://www.youtube-nocookie.com/embed/videoseries?list=' + encodeURIComponent(playlistId) + '&autoplay=1&rel=0';
    iframe.allow = 'autoplay; encrypted-media; picture-in-picture; web-share';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.allowFullscreen = true;
    player.replaceChildren(iframe);
    player.hidden = false;
    playing = true;
    play.textContent = '■ STOP';
    play.setAttribute('aria-label', 'Stop radio');
    eq.classList.remove('paused');
    setStatus('Green Dream playlist loaded. Use the YouTube controls to move through its tracks.');
  }

  stationButtons.forEach(button => button.addEventListener('click', () => selectStation(Number(button.dataset.track))));
  root.querySelector('#gd-next').addEventListener('click', () => { if (playing) setStatus('Use the YouTube playlist controls to skip to the next track.'); else startPlayer(); });
  root.querySelector('#gd-prev').addEventListener('click', () => { if (playing) setStatus('Use the YouTube playlist controls to return to the previous track.'); else startPlayer(); });
  play.addEventListener('click', () => {
    if (playing) {
      stopPlayer();
      setStatus('Playback stopped.');
    } else {
      startPlayer();
    }
  });

  root.querySelector('#gd-close').addEventListener('click', event => {
    const minimized = radio.classList.toggle('minimized');
    event.currentTarget.textContent = minimized ? '+' : '−';
    event.currentTarget.setAttribute('aria-expanded', String(!minimized));
    event.currentTarget.setAttribute('aria-label', minimized ? 'Expand radio' : 'Minimize radio');
  });

  // Pointer-based dragging works with mouse and touch; keep the panel inside
  // the visible viewport and allow touch scrolling outside the drag handle.
  let dragging = false;
  let pointerOffsetX = 0;
  let pointerOffsetY = 0;
  head.addEventListener('pointerdown', event => {
    if (event.target.closest('button')) return;
    dragging = true;
    const rect = radio.getBoundingClientRect();
    pointerOffsetX = event.clientX - rect.left;
    pointerOffsetY = event.clientY - rect.top;
    head.setPointerCapture(event.pointerId);
    radio.classList.add('dragging');
  });
  head.addEventListener('pointermove', event => {
    if (!dragging) return;
    const maxX = Math.max(0, window.innerWidth - radio.offsetWidth);
    const maxY = Math.max(0, window.innerHeight - radio.offsetHeight);
    const x = Math.min(maxX, Math.max(0, event.clientX - pointerOffsetX));
    const y = Math.min(maxY, Math.max(0, event.clientY - pointerOffsetY));
    radio.style.left = x + 'px';
    radio.style.top = y + window.scrollY + 'px';
    radio.style.right = 'auto';
    radio.style.bottom = 'auto';
  });
  function endDrag() {
    dragging = false;
    radio.classList.remove('dragging');
  }
  head.addEventListener('pointerup', endDrag);
  head.addEventListener('pointercancel', endDrag);
  window.addEventListener('resize', () => {
    if (!radio.style.left) return;
    const maxX = Math.max(0, window.innerWidth - radio.offsetWidth);
    radio.style.left = Math.min(maxX, Math.max(0, parseFloat(radio.style.left) || 0)) + 'px';
  });

  selectStation(0);
})();