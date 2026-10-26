(() => {
  const list = document.getElementById('posts-list');
  const search = document.getElementById('post-search');
  const count = document.getElementById('post-count');
  const emptySearch = document.getElementById('posts-empty-search');
  let posts = [];
  const safe = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const prettyDate = value => {
    const date = new Date(value + 'T12:00:00');
    return Number.isNaN(date.getTime()) ? safe(value) : date.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}).toUpperCase();
  };
  function render() {
    const term = search.value.trim().toLowerCase();
    const filtered = posts.filter(post => [post.title,post.category,post.excerpt,post.content].join(' ').toLowerCase().includes(term));
    count.textContent = String(filtered.length).padStart(2,'0') + ' TRANSMISSION' + (filtered.length === 1 ? '' : 'S');
    emptySearch.hidden = filtered.length > 0 || !term;
    if (!filtered.length) {
      list.innerHTML = term ? '' : '<p class="posts-empty">NO TRANSMISSIONS YET. THE NEXT SIGNAL IS YOURS TO SEND.</p>';
      return;
    }
    list.innerHTML = filtered.slice().sort((a,b) => String(b.date).localeCompare(String(a.date))).map((post,index) => {
      const id = 'post-' + index;
      const body = post.content ? '<details class="post-details"><summary>READ TRANSMISSION ↗</summary><div class="post-body">' + safe(post.content).replace(/\n/g,'<br>') + '</div></details>' : '';
      return '<article class="post-card"><div class="post-card-top"><span>' + prettyDate(post.date) + '</span><span class="post-category">' + safe(post.category || 'TRANSMISSION') + '</span></div><h3>' + safe(post.title) + '</h3><p>' + safe(post.excerpt || '') + '</p>' + body + '</article>';
    }).join('');
  }
  fetch('posts.json').then(response => { if (!response.ok) throw new Error('Archive unavailable'); return response.json(); }).then(data => {
    posts = Array.isArray(data) ? data : [];
    render();
  }).catch(() => {
    list.innerHTML = '<p class="posts-empty">THE ARCHIVE COULD NOT LOAD. PLEASE TRY AGAIN LATER.</p>';
    count.textContent = 'SIGNAL UNAVAILABLE';
  });
  search.addEventListener('input', render);
})();
