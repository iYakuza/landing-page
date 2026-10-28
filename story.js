/* GREEN DREAM story pacing, optional drone and aggregate transparency stats. */
(() => {
  'use strict';
  const root = document.querySelector('.gd-storyworld');
  if (!root || root.dataset.ready === '1') return;
  root.dataset.ready = '1';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const soundButton = document.getElementById('gd-sound-toggle');
  const soundArt = document.getElementById('gd-sensory-art');
  let audioContext = null;
  let oscillators = [];
  let gainNode = null;

  function stopDrone() {
    if (gainNode && audioContext) {
      try { gainNode.gain.setTargetAtTime(0, audioContext.currentTime, 0.18); } catch (_) {}
    }
    window.setTimeout(() => {
      oscillators.forEach(osc => { try { osc.stop(); } catch (_) {} });
      oscillators = [];
      if (audioContext) { try { audioContext.close(); } catch (_) {} }
      audioContext = null;
      gainNode = null;
    }, 650);
    soundButton?.setAttribute('aria-pressed', 'false');
    if (soundButton) soundButton.textContent = '◉  ADD A QUIET DRONE';
    soundArt?.classList.remove('is-listening');
  }

  async function startDrone() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      const note = document.getElementById('gd-sound-note');
      if (note) note.textContent = 'Audio is not available in this browser. The visual journey still works.';
      return;
    }
    try {
      audioContext = new AudioContextClass();
      await audioContext.resume();
      gainNode = audioContext.createGain();
      gainNode.gain.setValueAtTime(0.0001, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.035, audioContext.currentTime + 1.2);
      gainNode.connect(audioContext.destination);
      [55, 82.41, 110].forEach((frequency, index) => {
        const osc = audioContext.createOscillator();
        const voiceGain = audioContext.createGain();
        osc.type = index === 1 ? 'sine' : 'triangle';
        osc.frequency.value = frequency;
        voiceGain.gain.value = index === 0 ? 0.48 : 0.18;
        osc.connect(voiceGain);
        voiceGain.connect(gainNode);
        osc.start();
        oscillators.push(osc);
      });
      soundButton?.setAttribute('aria-pressed', 'true');
      if (soundButton) soundButton.textContent = 'Ⅱ  RETURN TO SILENCE';
      soundArt?.classList.add('is-listening');
      const note = document.getElementById('gd-sound-note');
      if (note) note.textContent = 'A quiet, locally generated drone is playing. No audio is sent or recorded.';
    } catch (_) {
      stopDrone();
      const note = document.getElementById('gd-sound-note');
      if (note) note.textContent = 'Audio could not start here. The visual journey still works.';
    }
  }

  soundButton?.addEventListener('click', () => {
    if (soundButton.getAttribute('aria-pressed') === 'true') stopDrone();
    else startDrone();
  });
  window.addEventListener('pagehide', stopDrone, { once: true });

  if (!reduceMotion) {
    let scheduled = false;
    window.addEventListener('scroll', () => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(() => {
        const steps = [...document.querySelectorAll('.gd-story-step')];
        const viewport = window.innerHeight || 1;
        steps.forEach((step, index) => {
          const rect = step.getBoundingClientRect();
          const visible = Math.max(0, Math.min(rect.bottom, viewport) - Math.max(rect.top, 0));
          step.style.setProperty('--journey-presence', String(Math.min(1, visible / Math.max(1, rect.height))));
          step.dataset.inView = visible > rect.height * 0.3 ? 'true' : 'false';
          step.style.transitionDelay = (index * 24) + 'ms';
        });
        scheduled = false;
      });
    }, { passive: true });
  }

  const statsStatus = document.getElementById('gd-public-stats-status');
  const statFields = {
    pageviews: document.querySelector('[data-public-stat="pageviews"]'),
    sessions: document.querySelector('[data-public-stat="sessions"]'),
    referred_pageviews: document.querySelector('[data-public-stat="referred_pageviews"]'),
    pageviews_7d: document.querySelector('[data-public-stat="pageviews_7d"]')
  };
  const number = value => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
  async function loadPublicStats() {
    try {
      const response = await fetch('https://oeyxsqocldlovhsmzcjw.supabase.co/rest/v1/rpc/vha_public_analytics_summary', {
        method: 'POST',
        headers: {
          'apikey': 'sb_publishable_kuUFxaClmROwgZpGIw6bzg_ddvb521h',
          'Content-Type': 'application/json'
        },
        body: '{}',
        credentials: 'omit',
        cache: 'no-store'
      });
      if (!response.ok) throw new Error('stats unavailable');
      const data = await response.json();
      Object.entries(statFields).forEach(([key, element]) => {
        if (element) element.textContent = number(data[key]);
      });
      if (statsStatus) statsStatus.textContent = 'LIVE AGGREGATES · UPDATED ' + new Date(data.updated_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (_) {
      Object.values(statFields).forEach(element => { if (element) element.textContent = '—'; });
      if (statsStatus) statsStatus.textContent = 'LIVE COUNTS TEMPORARILY UNAVAILABLE';
    }
  }
  loadPublicStats();
})();