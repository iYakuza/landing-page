(() => {
  const SUPABASE_URL = 'https://oeyxsqocldlovhsmzcjw.supabase.co';
  // Publishable key is intended for public clients; RLS protects the database.
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_kuUFxaClmROwgZpGIw6bzg_ddvb521h';
  const client = window.supabase?.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  const list = document.getElementById('posts-list');
  const search = document.getElementById('post-search');
  const categoryFilter = document.getElementById('category-filter');
  const count = document.getElementById('post-count');
  const emptySearch = document.getElementById('posts-empty-search');
  const requestedSlug = new URLSearchParams(window.location.search).get('post');
  let posts = [];
  const safe = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const prettyDate = value => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}).toUpperCase();
  };
  function cleanHtml(html){
    const doc=new DOMParser().parseFromString(String(html||''),'text/html');
    const allowed=new Set(['P','BR','STRONG','B','EM','I','U','H2','H3','UL','OL','LI','BLOCKQUOTE','A','HR','CODE','PRE']);
    function clean(node){[...node.childNodes].forEach(child=>{
      if(child.nodeType===Node.TEXT_NODE)return;
      if(child.nodeType!==Node.ELEMENT_NODE){child.remove();return;}
      if(!allowed.has(child.tagName)){clean(child);child.replaceWith(...child.childNodes);return;}
      const originalHref=child.tagName==='A'?(child.getAttribute('href')||'').trim():'';
      [...child.attributes].forEach(a=>child.removeAttribute(a.name));
      if(child.tagName==='A'&&/^(https?:|mailto:)/i.test(originalHref)){
        child.setAttribute('href',originalHref);child.setAttribute('target','_blank');child.setAttribute('rel','noopener noreferrer');
      }
      clean(child);
    });}
    clean(doc.body);return doc.body.innerHTML;
  }
  function validMediaUrl(value){
    try{const url=new URL(String(value||''));return url.protocol==='https:'&&url.hostname==='oeyxsqocldlovhsmzcjw.supabase.co'&&url.pathname.includes('/storage/v1/object/public/vha-post-media/')?url.href:'';}catch{return '';}
  }
  function renderCategories(){
    const selected=categoryFilter.value;
    const categories=[...new Set(posts.map(p=>String(p.category||'UNCATEGORIZED').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
    categoryFilter.innerHTML='<option value="">ALL CATEGORIES</option>'+categories.map(c=>'<option value="'+safe(c)+'">'+safe(c)+'</option>').join('');
    categoryFilter.value=categories.includes(selected)?selected:'';
  }
  function render(){
    const permalink=Boolean(requestedSlug);
    const term=search.value.trim().toLowerCase(),category=categoryFilter.value;
    const filtered=permalink
      ? posts.filter(post=>post.slug===requestedSlug)
      : posts.filter(post=>(!category||post.category===category)&&[post.title,post.category,post.excerpt,post.content_html].join(' ').replace(/<[^>]*>/g,' ').toLowerCase().includes(term));
    if(permalink){
      search.closest('label')?.setAttribute('hidden','');
      categoryFilter.closest('label')?.setAttribute('hidden','');
      count.textContent=filtered.length?'SINGLE TRANSMISSION':'TRANSMISSION NOT FOUND';
    }else{
      count.textContent=String(filtered.length).padStart(2,'0')+' TRANSMISSION'+(filtered.length===1?'':'S');
    }
    emptySearch.hidden=filtered.length>0;
    if(!filtered.length){
      list.innerHTML=permalink
        ? '<p class="posts-empty">THIS TRANSMISSION COULD NOT BE FOUND. IT MAY HAVE BEEN MOVED OR UNPUBLISHED. <a href="./">RETURN TO THE ARCHIVE ↗</a></p>'
        : '';
      return;
    }
    list.innerHTML=filtered.map(post=>{
      const body=post.content_html?'<div class="post-body">'+cleanHtml(post.content_html)+'</div>':'';
      const back=permalink?'<p class="post-back"><a href="./">← BACK TO THE ARCHIVE</a></p>':'';
      const mediaUrl=validMediaUrl(post.media_url);
      const media=mediaUrl?'<div class="post-media">'+(post.media_type==='image'?'<img src="'+safe(mediaUrl)+'" alt="'+safe(post.title)+'" loading="lazy">':post.media_type==='video'?'<video src="'+safe(mediaUrl)+'" controls preload="metadata"></video>':'<audio src="'+safe(mediaUrl)+'" controls preload="metadata"></audio>')+'</div>':'';
      return '<article class="post-card" id="post-'+safe(post.slug)+'"><div class="post-card-top"><span>'+prettyDate(post.published_at||post.created_at)+'</span><span class="post-category">'+safe(post.category||'UNCATEGORIZED')+'</span></div><h3>'+safe(post.title)+'</h3>'+media+'<p>'+safe(post.excerpt||'')+'</p>'+body+back+'</article>';
    }).join('');
    if(permalink){
      document.title=filtered[0].title+' // VERSE AFTER HOURS';
      requestAnimationFrame(()=>list.querySelector('.post-card')?.scrollIntoView({behavior:'smooth',block:'start'}));
    }
  }
  async function load(){
    if(!client){list.innerHTML='<p class="posts-empty">THE ARCHIVE COULD NOT CONNECT.</p>';count.textContent='SIGNAL UNAVAILABLE';return;}
    const {data,error}=await client.from('vha_posts').select('id,title,slug,category,excerpt,content_html,media_url,media_type,created_at,published_at').eq('status','published').order('published_at',{ascending:false,nullsFirst:false});
    if(error){list.innerHTML='<p class="posts-empty">THE ARCHIVE COULD NOT LOAD. PLEASE TRY AGAIN LATER.</p>';count.textContent='SIGNAL UNAVAILABLE';return;}
    posts=data||[];renderCategories();render();
  }
  search.addEventListener('input',render);categoryFilter.addEventListener('change',render);load();
})();