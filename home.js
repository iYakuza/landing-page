(() => {
  const root=document.querySelector('.va-home');
  if(!root||root.dataset.homeReady==='true')return;
  root.dataset.homeReady='true';
  const safe=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const movementId=value=>{
    const key=String(value||'').toUpperCase();
    if(key.includes('DESCENT'))return 'descent';
    if(key.includes('RECONNECTION'))return 'reconnection';
    if(key.includes('TRANSFORMATION'))return 'transformation';
    if(key.includes('RETURN'))return 'return';
    return 'awakening';
  };
  function validImageUrl(value){
    try{
      const raw=String(value||'').trim();
      if(raw.startsWith('/landing-page/posts/imported/')&&!raw.includes('..')&&!raw.includes('?')&&!raw.includes('#')&&!raw.includes(String.fromCharCode(92)))return raw;
      const url=new URL(raw);
      const ownStorage=url.hostname==='oeyxsqocldlovhsmzcjw.supabase.co'&&(url.pathname.includes('/storage/v1/object/public/vha-post-media/')||url.pathname.includes('/storage/v1/object/public/poetry-media/'));
      const wordpress=['emanuelstefancu.wordpress.com','i0.wp.com'].includes(url.hostname)&&url.pathname.includes('/wp-content/uploads/')&&/\.(jpg|jpeg|png|webp|gif|avif)$/i.test(url.pathname);
      return url.protocol==='https:'&&(ownStorage||wordpress)?url.href:'';
    }catch{return '';}
  }
  function dateLabel(value){
    const date=new Date(value);
    if(Number.isNaN(date.getTime()))return 'RECENT TRANSMISSION';
    return new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric'}).format(date).toUpperCase();
  }
  function renderPosts(posts){
    const grid=document.getElementById('latest-poetry');
    if(!grid)return;
    const selected=(posts||[]).filter(post=>String(post.category||'').toUpperCase()!=='SITE NOTE').slice(0,4);
    if(!selected.length){
      grid.innerHTML='<p class="va-empty">No published transmissions are available yet. <a href="/landing-page/posts/">Open the archive ↗</a></p>';
      return;
    }
    grid.innerHTML=selected.map(post=>{
      const image=post.media_type==='image'?validImageUrl(post.media_url):'';
      const art='<svg class="va-poem-art" viewBox="0 0 280 360" role="img" aria-label="'+safe(post.category||'Green Dream artwork')+' artwork"><use href="/landing-page/green-dream/movements.svg#'+movementId(post.category)+'"></use></svg>';
      const media=image?'<img class="va-poem-image" src="'+safe(image)+'" alt="" loading="lazy">':art;
      const href='/landing-page/posts/?post='+encodeURIComponent(post.slug);
      return '<a class="va-poem-card" href="'+href+'">'+media+'<span class="va-poem-copy"><strong>'+safe(post.title)+'</strong><time datetime="'+safe(post.published_at||post.created_at||'')+'">'+dateLabel(post.published_at||post.created_at)+'</time><small>'+safe(post.category||'TRANSMISSION')+'</small></span></a>';
    }).join('');
  }
  let supabaseSdkPromise=null;
  function ensureSupabaseSdk(){
    if(window.supabase?.createClient)return Promise.resolve(true);
    if(supabaseSdkPromise)return supabaseSdkPromise;
    supabaseSdkPromise=new Promise(resolve=>{
      const script=document.createElement('script');
      script.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0';
      script.async=true;
      script.crossOrigin='anonymous';
      script.referrerPolicy='no-referrer';
      script.onload=()=>resolve(Boolean(window.supabase?.createClient));
      script.onerror=()=>resolve(false);
      document.head.appendChild(script);
    });
    return supabaseSdkPromise;
  }
  async function loadPosts(){
    const grid=document.getElementById('latest-poetry');
    if(!await ensureSupabaseSdk()){if(grid)grid.innerHTML='<p class="va-empty">The poetry archive is temporarily unavailable. <a href="/landing-page/posts/">Browse all transmissions ↗</a></p>';return;}
    const client=window.supabase?.createClient('https://oeyxsqocldlovhsmzcjw.supabase.co','sb_publishable_kuUFxaClmROwgZpGIw6bzg_ddvb521h');
    if(!client){if(grid)grid.innerHTML='<p class="va-empty">The poetry archive is temporarily unavailable. <a href="/landing-page/posts/">Browse all transmissions ↗</a></p>';return;}
    const {data,error}=await client.from('vha_posts').select('title,slug,category,media_url,media_type,published_at,created_at').eq('status','published').order('published_at',{ascending:false,nullsFirst:false}).limit(12);
    if(error){if(grid)grid.innerHTML='<p class="va-empty">The latest transmissions could not be loaded. <a href="/landing-page/posts/">Browse the archive ↗</a></p>';return;}
    renderPosts(data||[]);
  }
  const menuButton=document.querySelector('.va-menu-toggle');
  const mobileMenu=document.getElementById('va-mobile-nav');
  menuButton?.addEventListener('click',()=>{
    const open=mobileMenu?.classList.toggle('is-open')||false;
    menuButton.setAttribute('aria-expanded',String(open));
  });
  mobileMenu?.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>{
    mobileMenu.classList.remove('is-open');
    menuButton?.setAttribute('aria-expanded','false');
  }));
  const subscribe=document.getElementById('va-subscribe-form');
  subscribe?.addEventListener('submit',event=>{
    event.preventDefault();
    const email=subscribe.elements.email.value.trim();
    if(!email)return;
    const contactEmail=document.getElementById('cv-contact-email');
    const subject=document.getElementById('cv-contact-subject');
    const message=document.getElementById('cv-contact-message');
    if(contactEmail)contactEmail.value=email;
    if(subject)subject.value='Subscribe to Verse After Hours updates';
    if(message)message.value='Please add this email address to the Verse After Hours updates list. I would like to receive new poems, project updates and occasional signals from the night.';
    const status=document.getElementById('va-subscribe-status');
    if(status)status.textContent='One more step: confirm your request in the contact window.';
    document.querySelector('.cv-contact-open')?.click();
  });
  document.querySelector('.va-back-top')?.addEventListener('click',()=>window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'}));
  loadPosts();
})();