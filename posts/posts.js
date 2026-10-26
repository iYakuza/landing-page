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
    list.innerHTML=filtered.map((post,index)=>{
      const body=post.content_html?'<div class="post-body">'+cleanHtml(post.content_html)+'</div>':'';
      const back=permalink?'<p class="post-back"><a href="./">← BACK TO THE ARCHIVE</a></p>':'';
      const mediaUrl=validMediaUrl(post.media_url);
      const media=mediaUrl?'<div class="post-media">'+(post.media_type==='image'?'<img src="'+safe(mediaUrl)+'" alt="'+safe(post.title)+'" loading="lazy">':post.media_type==='video'?'<video src="'+safe(mediaUrl)+'" controls preload="metadata"></video>':'<audio src="'+safe(mediaUrl)+'" controls preload="metadata"></audio>')+'</div>':'';
      const shapeClass=['shape-i','shape-l','shape-square','shape-t','shape-z','shape-j','shape-o'][index%7];
      return '<article class="post-card '+shapeClass+'" id="post-'+safe(post.slug)+'"><div class="post-card-top"><span>'+prettyDate(post.published_at||post.created_at)+'</span><span class="post-category">'+safe(post.category||'UNCATEGORIZED')+'</span></div><h3>'+safe(post.title)+'</h3>'+media+'<p>'+safe(post.excerpt||'')+'</p>'+body+back+'</article>';
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
  function initViewerThemes(){
    const root=document.documentElement,form=document.getElementById("theme-prompt-form"),prompt=document.getElementById("theme-prompt"),status=document.getElementById("theme-status"),progress=document.getElementById("theme-progress"),bar=document.getElementById("theme-progress-bar"),percent=document.getElementById("theme-progress-percent"),message=document.getElementById("theme-progress-message");
    const palettes={neon:["#050906","#0b150d","#b6e833","rgba(182,232,51,.22)","#a98bff"],cyber:["#08051a","#140b26","#ff4fd8","rgba(255,79,216,.24)","#54d7ef"],violet:["#090617","#17102b","#b69cff","rgba(169,139,255,.25)","#54d7ef"],ember:["#160906","#26110d","#ff9b54","rgba(255,111,48,.24)","#ff4f82"],ocean:["#031015","#071e27","#53e7df","rgba(83,231,223,.22)","#579bff"]};
    function setVars(p){["--viewer-bg","--viewer-surface","--viewer-accent","--viewer-glow","--viewer-secondary"].forEach((key,i)=>root.style.setProperty(key,p[i]));}
    function activate(name,save=true){const p=palettes[name]||palettes.neon;setVars(p);root.dataset.viewerTheme=name;document.querySelectorAll(".theme-swatch").forEach(b=>{const active=b.dataset.theme===name;b.classList.toggle("is-active",active);b.setAttribute("aria-pressed",String(active));});if(save){try{localStorage.setItem("vha-viewer-theme",name);localStorage.removeItem("vha-viewer-custom");}catch{}}}
    function buildTheme(description){const t=description.toLowerCase();let p=[...palettes.neon];if(/pink|magenta|cyberpunk|neon city/.test(t))p=[...palettes.cyber];if(/violet|purple|lavender|dreamy|cosmic|galaxy/.test(t))p=[...palettes.violet];if(/orange|amber|sunset|fire|warm|red|crimson|ember/.test(t))p=[...palettes.ember];if(/ocean|sea|underwater|teal|cyan|blue|arctic|ice/.test(t))p=[...palettes.ocean];if(/greenhouse|forest|emerald|moss|acid green|bioluminescent|toxic/.test(t))p=[...palettes.neon];const hex=[...description.matchAll(/#([0-9a-f]{6})\b/ig)].map(m=>"#"+m[1]);if(hex.length)p[2]=hex[0];if(hex.length>1)p[4]=hex[1];if(/white background|light mode|bright paper|ivory/.test(t)){p[0]="#f0f3e8";p[1]="#ffffff";p[3]="rgba(30,60,30,.12)";}return p;}
    function applyCustom(p){setVars(p);root.dataset.viewerTheme="custom";document.querySelectorAll(".theme-swatch").forEach(b=>{b.classList.remove("is-active");b.setAttribute("aria-pressed","false");});try{localStorage.setItem("vha-viewer-custom",JSON.stringify(p));localStorage.setItem("vha-viewer-theme","custom");}catch{}}
    document.querySelectorAll(".theme-swatch").forEach(b=>b.addEventListener("click",()=>activate(b.dataset.theme)));
    try{const custom=JSON.parse(localStorage.getItem("vha-viewer-custom")||"null");if(custom&&custom.length===5)setVars(custom);else activate(localStorage.getItem("vha-viewer-theme")||"neon",false);}catch{activate("neon",false);}
    form?.addEventListener("submit",event=>{event.preventDefault();const description=prompt.value.trim();if(!description){status.textContent="ADD A DESCRIPTION FIRST, THEN TRANSMIT YOUR REQUEST.";prompt.focus();return;}const chosen=buildTheme(description);let value=0;progress.hidden=false;status.textContent="THEME SYNTHESIS STARTED. ESTIMATED TIME: ABOUT 6 SECONDS.";bar.style.width="0%";percent.textContent="0%";message.textContent="PARSING YOUR VISUAL BRIEF…";const button=form.querySelector("button[type=submit]");button.disabled=true;const timer=setInterval(()=>{value=Math.min(100,value+7);bar.style.width=value+"%";percent.textContent=value+"%";message.textContent=value<35?"PARSING YOUR VISUAL BRIEF…":value<70?"ASSEMBLING COLOR MATRICES…":"RENDERING ATMOSPHERIC EFFECTS…";if(value===100){clearInterval(timer);applyCustom(chosen);message.textContent="THEME COMPILED";status.textContent="THEME READY. PRESS CTRL + F5 TO REFRESH THE EXPERIENCE.";button.disabled=false;}},420);});
  }
  initViewerThemes();
  search.addEventListener('input',render);categoryFilter.addEventListener('change',render);load();
})();