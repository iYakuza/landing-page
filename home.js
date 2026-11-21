(() => {
  const root=document.querySelector('.va-home');
  if(!root||root.dataset.homeReady==='true')return;
  root.dataset.homeReady='true';
  const safe=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const siteBasePath=window.location.pathname.startsWith('/landing-page-preview/')?'/landing-page-preview':'/landing-page';
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
      if(!raw)return '';
      const relative=raw.replace(/^\/+/, '');
      if(relative.startsWith('media/')&&!relative.split('/').some(part=>part==='.'||part==='..')&&!raw.includes(String.fromCharCode(92))&&!/[?#]/.test(raw)){
        return siteBasePath+'/'+relative.split('/').map(encodeURIComponent).join('/');
      }
      const url=new URL(raw,window.location.origin);
      if(url.origin===window.location.origin&&(url.pathname.startsWith('/landing-page/media/')||url.pathname.startsWith('/landing-page-preview/media/')))return url.href;
      const wordpress=['emanuelstefancu.wordpress.com','i0.wp.com'].includes(url.hostname)&&url.pathname.includes('/wp-content/uploads/')&&/\.(jpg|jpeg|png|webp|gif|avif)$/i.test(url.pathname);
      return url.protocol==='https:'&&wordpress?url.href:'';
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
      grid.innerHTML='<p class="va-empty">No published transmissions are available yet. <a href="'+siteBasePath+'/transmissions/">Open the archive ↗</a></p>';
      return;
    }
    grid.innerHTML=selected.map(post=>{
      const imageItem=(Array.isArray(post.media_items)?post.media_items:[]).find(item=>item&&item.status==='available'&&item.type==='image');
      const image=validImageUrl(imageItem?.url||imageItem?.src||imageItem?.path||(post.media_type==='image'?post.media_url||post.media_path:''));
      const art='<svg class="va-poem-art" viewBox="0 0 280 360" role="img" aria-label="'+safe(post.category||'Green Dream artwork')+' artwork"><use href="'+siteBasePath+'/green-dream/movements.svg#'+movementId(post.category)+'"></use></svg>';
      const media=image?'<img class="va-poem-image" src="'+safe(image)+'" alt="" loading="lazy">':art;
      const href=siteBasePath+'/transmissions/?post='+encodeURIComponent(post.slug);
      return '<a class="va-poem-card" href="'+href+'">'+media+'<span class="va-poem-copy"><strong>'+safe(post.title)+'</strong><time datetime="'+safe(post.published_at||post.created_at||'')+'">'+dateLabel(post.published_at||post.created_at)+'</time><small>'+safe(post.category||'TRANSMISSION')+'</small></span></a>';
    }).join('');
  }
  async function loadPosts(){
    const grid=document.getElementById('latest-poetry');
    try{
      const response=await fetch(siteBasePath+'/content/transmissions.json',{credentials:'same-origin',cache:'no-store'});
      if(!response.ok)throw new Error('The Transmissions collection returned HTTP '+response.status+'.');
      const collection=await response.json();
      if(!Array.isArray(collection.records))throw new Error('The Transmissions collection has an invalid structure.');
      const posts=collection.records.filter(post=>post&&post.status==='published').sort((a,b)=>{
        const dateA=Date.parse(a.published_at||a.created_at||'')||0;
        const dateB=Date.parse(b.published_at||b.created_at||'')||0;
        return dateB-dateA;
      });
      renderPosts(posts);
    }catch(error){
      console.error('The local Transmissions collection could not be loaded:',error);
      if(grid)grid.innerHTML='<p class="va-empty">The latest transmissions could not be loaded. <a href="'+siteBasePath+'/transmissions/">Browse the archive ↗</a></p>';
    }
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
  loadPosts();
})();