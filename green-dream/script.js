(() => {
  const root = document.querySelector('.gd');
  if (!root) return;

  // Known public YouTube livestream IDs. Other station buttons open a search
  // rather than pretending an unverified stream is playing.
  const stations = [
    { title: 'Lofi Girl — beats to relax/study to', artist: 'Lofi Girl // YouTube live', video: 'jfKfPfyJRdk' },
    { title: 'Synthwave Radio', artist: 'Synthwave / retrowave // YouTube', video: '4xDzrJKXOOY' },
    { title: 'Jazz Lofi Radio', artist: 'YouTube search // jazz lofi radio', query: 'jazz lofi radio live stream' },
    { title: 'Asian Lofi Radio', artist: 'YouTube search // Asian lofi radio', query: 'Asian lofi radio live stream' },
    { title: 'Sleep Lofi Radio', artist: 'YouTube search // sleep lofi radio', query: 'sleep lofi radio live stream' },
    { title: 'Classic Hip Hop Radio', artist: 'YouTube search // classic hip hop radio', query: 'classic hip hop radio live stream' }
  ];

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
    setStatus(station.video
      ? 'Ready to play. Audio is loaded from YouTube only after you press PLAY.'
      : 'This station is not embedded yet. Open its YouTube search to choose a stream.');
  }

  function startPlayer() {
    const station = stations[index];
    if (!station.video) {
      window.open('https://www.youtube.com/results?search_query=' + encodeURIComponent(station.query), '_blank', 'noopener,noreferrer');
      setStatus('Opened YouTube search in a new tab. Playback is controlled by YouTube.');
      return;
    }
    const iframe = document.createElement('iframe');
    iframe.title = station.title;
    iframe.src = 'https://www.youtube-nocookie.com/embed/' + station.video + '?autoplay=1&rel=0';
    iframe.allow = 'autoplay; encrypted-media; picture-in-picture; web-share';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.allowFullscreen = true;
    player.replaceChildren(iframe);
    player.hidden = false;
    playing = true;
    play.textContent = '■ STOP';
    play.setAttribute('aria-label', 'Stop radio');
    eq.classList.remove('paused');
    setStatus('YouTube player loaded. If playback does not start, use its player controls or check browser/network restrictions.');
  }

  stationButtons.forEach(button => button.addEventListener('click', () => selectStation(Number(button.dataset.track))));
  root.querySelector('#gd-next').addEventListener('click', () => selectStation(index + 1));
  root.querySelector('#gd-prev').addEventListener('click', () => selectStation(index - 1));
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