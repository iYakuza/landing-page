(() => {
  const SUPABASE_URL = 'https://oeyxsqocldlovhsmzcjw.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_kuUFxaClmROwgZpGIw6bzg_ddvb521h';
  const MOVEMENTS = [
    'THE AWAKENING',
    'THE DESCENT',
    'THE RECONNECTION',
    'THE TRANSFORMATION',
    'THE RETURN'
  ];
  const archive = document.getElementById('movement-archive');
  const playlist = document.getElementById('gd-media-playlist');
  const player = document.getElementById('gd-archive-player');
  if (!archive || !playlist || !player) return;
  const safe = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  function safeMediaUrl(value) {
    try {
      const url = new URL(String(value || ''));
      return url.protocol === 'https:' && url.hostname === 'oeyxsqocldlovhsmzcjw.supabase.co' &&
        url.pathname.includes('/storage/v1/object/public/vha-post-media/') ? url.href : '';
    } catch { return ''; }
  }
  function audioTitle(url, fallback) {
    try {
      const name = decodeURIComponent(new URL(url).pathname.split('/').pop() || '')
        .replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[_-]+/g, ' ').trim();
      if (name && name.length > 1) return name.replace(/\b\w/g, c => c.toUpperCase());
    } catch {}
    return fallback || 'Untitled audio';
  }
  function openPost(post) {
    window.location.href = '../posts/?post=' + encodeURIComponent(post.slug);
  }
  function render(posts) {
    archive.innerHTML = MOVEMENTS.map((movement, index) => {
      const items = posts.filter(post => String(post.category || '').trim().toUpperCase() === movement);
      const content = items.length ? items.map(post =>
        '<a href="../posts/?post=' + encodeURIComponent(post.slug) + '">' + safe(post.title) +
        '<small>' + safe(movement) + ' // ' + safe(post.title) + '</small></a>'
      ).join('') : '<p class="gd-smallprint">No posts assigned to this movement yet.</p>';
      return '<details><summary><span>0' + (index + 1) + ' / ' + safe(movement) + '</span><span>' + items.length + '</span></summary><div class="gd-movement-posts">' + content + '</div></details>';
    }).join('');
    const tracks = posts.filter(post => post.media_type === 'audio' && safeMediaUrl(post.media_url))
      .map(post => ({...post, url:safeMediaUrl(post.media_url)}));
    if (!tracks.length) {
      playlist.innerHTML = '<p class="gd-archive-empty">NO AUDIO TRANSMISSIONS YET. Upload an audio file to a published post in the Creator Console to add it to this playlist. Video and image files are intentionally excluded.</p>';
      return;
    }
    playlist.innerHTML = tracks.map((post, index) => {
      const title = audioTitle(post.media_url, post.title);
      return '<article class="gd-media-row" data-track-index="' + index + '">' +
        '<span class="gd-media-number">' + String(index + 1).padStart(2, '0') + '</span>' +
        '<div class="gd-media-track"><strong>' + safe(title) + '</strong><small>' + safe(post.category || 'UNASSIGNED') + ' // ' + safe(post.title) + '</small></div>' +
        '<button class="gd-media-play" type="button" aria-label="Play ' + safe(title) + '" data-play-track="' + index + '">▶</button></article>';
    }).join('');
    let activeIndex = -1;
    function selectTrack(index, autoplay = true) {
      if (index < 0 || index >= tracks.length) return;
      activeIndex = index;
      const track = tracks[index];
      player.src = track.url;
      player.dataset.trackIndex = String(index);
      playlist.querySelectorAll('.gd-media-row').forEach((row, rowIndex) => {
        const active = rowIndex === index;
        row.classList.toggle('is-playing', active);
        const button = row.querySelector('button');
        if (button) { button.textContent = active && !player.paused ? 'Ⅱ' : '▶'; button.setAttribute('aria-label', (active ? 'Pause ' : 'Play ') + audioTitle(track.url, track.title)); }
      });
      if (autoplay) player.play().then(() => updateButtons()).catch(() => updateButtons());
    }
    function updateButtons() {
      playlist.querySelectorAll('.gd-media-row').forEach((row, index) => {
        const button = row.querySelector('button');
        if (button) button.textContent = index === activeIndex && !player.paused ? 'Ⅱ' : '▶';
      });
    }
    playlist.querySelectorAll('[data-play-track]').forEach(button => button.addEventListener('click', () => {
      const index = Number(button.dataset.playTrack);
      if (index === activeIndex && !player.paused) { player.pause(); updateButtons(); }
      else selectTrack(index, true);
    }));
    player.addEventListener('play', updateButtons);
    player.addEventListener('pause', updateButtons);
    player.addEventListener('ended', () => { if (activeIndex + 1 < tracks.length) selectTrack(activeIndex + 1, true); });
  }
  async function init() {
    const client = window.supabase?.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
    if (!client) {
      archive.innerHTML = '<p class="gd-smallprint">The poetry archive is temporarily unavailable.</p>';
      playlist.innerHTML = '<p class="gd-archive-empty">The audio library is temporarily unavailable.</p>';
      return;
    }
    const {data, error} = await client.from('vha_posts')
      .select('title,slug,category,media_url,media_type,published_at,created_at')
      .eq('status','published')
      .order('published_at',{ascending:false,nullsFirst:false});
    if (error) {
      archive.innerHTML = '<p class="gd-smallprint">Could not load the poetry archive. Please try again later.</p>';
      playlist.innerHTML = '<p class="gd-archive-empty">Could not load the audio library. Please try again later.</p>';
      return;
    }
    render(data || []);
  }
  init();
})();