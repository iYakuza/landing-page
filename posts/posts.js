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
  const requestedMovement = String(document.body.dataset.movement || '').trim().toUpperCase();
  const editModal=document.getElementById('post-edit-modal');
  const editForm=document.getElementById('post-edit-form');
  const editTitle=document.getElementById('inline-edit-title');
  const editSlug=document.getElementById('inline-edit-slug');
  const editCategory=document.getElementById('inline-edit-category');
  const editExcerpt=document.getElementById('inline-edit-excerpt');
  const editBody=document.getElementById('inline-edit-body');
  const editMessage=document.getElementById('post-edit-message');
  const editSave=document.getElementById('post-edit-save');
  let editingPost=null, editSaving=false;
  let posts = [];
  let canEditPosts = false;
  async function checkEditorAccess(){
    if(!client)return false;
    const {data:{session}}=await client.auth.getSession();
    if(!session?.user)return false;
    const {data,error}=await client.from('vha_cms_admins').select('user_id').eq('user_id',session.user.id).maybeSingle();
    return !error&&Boolean(data);
  }
  const safe = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const slugify = value => String(value||'').normalize('NFKD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,180);
  const prettyDate = value => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}).toUpperCase();
  };
  function safeLink(value){
    try{
      const url=new URL(String(value||''));
      if(url.protocol==='https:'&&url.hostname)return url.href;
      if(url.protocol==='mailto:'&&url.pathname)return url.href;
    }catch{}
    return '';
  }
  function cleanHtml(html){
    const doc=new DOMParser().parseFromString(String(html||''),'text/html');
    const allowed=new Set(['P','BR','STRONG','B','EM','I','U','H2','H3','UL','OL','LI','BLOCKQUOTE','A','HR','CODE','PRE']);
    function clean(node){[...node.childNodes].forEach(child=>{
      if(child.nodeType===Node.TEXT_NODE)return;
      if(child.nodeType!==Node.ELEMENT_NODE){child.remove();return;}
      if(!allowed.has(child.tagName)){clean(child);child.replaceWith(...child.childNodes);return;}
      const originalHref=child.tagName==='A'?(child.getAttribute('href')||'').trim():'';
      [...child.attributes].forEach(a=>child.removeAttribute(a.name));
      const safeHref=child.tagName==='A'?safeLink(originalHref):'';
        if(child.tagName==='A'&&safeHref){
        child.setAttribute('href',safeHref);child.setAttribute('target','_blank');child.setAttribute('rel','noopener noreferrer');
      }
      clean(child);
    });}
    clean(doc.body);return doc.body.innerHTML;
  }
  function validMediaUrl(value){
    try{const url=new URL(String(value||''));return url.protocol==='https:'&&url.hostname==='oeyxsqocldlovhsmzcjw.supabase.co'&&url.pathname.includes('/storage/v1/object/public/vha-post-media/')?url.href:'';}catch{return '';}
  }
  const MOVEMENTS=['THE AWAKENING','THE DESCENT','THE RECONNECTION','THE TRANSFORMATION','THE RETURN'];
  function displayCategory(value){
    const category=String(value||'').trim().toUpperCase();
    return MOVEMENTS.includes(category)?category:'UNASSIGNED';
  }
  function renderCategories(){
    const selected=categoryFilter.value;
    categoryFilter.innerHTML='<option value="">ALL MOVEMENTS</option>'+MOVEMENTS.map(c=>'<option value="'+safe(c)+'">'+safe(c)+'</option>').join('');
    categoryFilter.value=MOVEMENTS.includes(selected)?selected:'';
  }
  function shareActions(post){
    const postUrl=new URL(window.location.pathname,window.location.origin);
    postUrl.searchParams.set('post',post.slug);
    const url=postUrl.href, encodedUrl=encodeURIComponent(url), encodedTitle=encodeURIComponent(post.title||'Verse After Hours');
    return '<div class="post-share" aria-label="Share this post">'+
      '<span class="post-share-label">SHARE</span>'+
      '<button type="button" class="post-share-action" data-share-url="'+safe(url)+'" data-share-title="'+safe(post.title||'Verse After Hours')+'">↗ SHARE</button>'+
      '<button type="button" class="post-share-action" data-copy-share="'+safe(url)+'">COPY LINK</button>'+
      '<a class="post-share-action" href="https://www.facebook.com/sharer/sharer.php?u='+encodedUrl+'" target="_blank" rel="noopener noreferrer" aria-label="Share on Facebook">FACEBOOK</a>'+
      '<a class="post-share-action" href="https://twitter.com/intent/tweet?url='+encodedUrl+'&text='+encodedTitle+'" target="_blank" rel="noopener noreferrer" aria-label="Share on X">X</a>'+
      '<a class="post-share-action" href="https://www.linkedin.com/sharing/share-offsite/?url='+encodedUrl+'" target="_blank" rel="noopener noreferrer" aria-label="Share on LinkedIn">LINKEDIN</a>'+
      '<a class="post-share-action" href="https://wa.me/?text='+encodedTitle+'%20'+encodedUrl+'" target="_blank" rel="noopener noreferrer" aria-label="Share on WhatsApp">WHATSAPP</a>'+
      '<a class="post-share-action" href="mailto:?subject='+encodedTitle+'&body='+encodedUrl+'" aria-label="Share by email">EMAIL</a>'+
      '</div>';
  }
  function render(){
    const permalink=Boolean(requestedSlug);
    const term=search.value.trim().toLowerCase(),category=categoryFilter.value;
    const filtered=permalink
      ? posts.filter(post=>post.slug===requestedSlug)
      : posts.filter(post=>(!requestedMovement||displayCategory(post.category)===requestedMovement)&&(!category||displayCategory(post.category)===category)&&[post.title,post.category,post.excerpt,post.content_html].join(' ').replace(/<[^>]*>/g,' ').toLowerCase().includes(term));
    if(permalink){
      search.closest('label')?.setAttribute('hidden','');
      categoryFilter.closest('label')?.setAttribute('hidden','');
      count.textContent=filtered.length?'SINGLE TRANSMISSION':'TRANSMISSION NOT FOUND';
    }else{
      count.textContent=String(filtered.length).padStart(2,'0')+' TRANSMISSION'+(filtered.length===1?'':'S');
      if(requestedMovement)count.textContent=String(filtered.length).padStart(2,'0')+' / '+requestedMovement;
    }
    emptySearch.hidden=filtered.length>0;
    if(!filtered.length){
      list.innerHTML=permalink
        ? '<p class="posts-empty">THIS TRANSMISSION COULD NOT BE FOUND. IT MAY HAVE BEEN MOVED OR UNPUBLISHED. <a href="./">RETURN TO THE ARCHIVE ↗</a></p>'
        : '';
      return;
    }
    list.innerHTML=filtered.map((post,index)=>{
      const permalinkBack=permalink?'<p class="post-back"><a href="./">← BACK TO THE ARCHIVE</a></p>':'';
      const mediaUrl=validMediaUrl(post.media_url);
      const media=mediaUrl?'<div class="post-media">'+(post.media_type==='image'?'<img src="'+safe(mediaUrl)+'" alt="'+safe(post.title)+'" loading="lazy">':post.media_type==='video'?'<video src="'+safe(mediaUrl)+'" controls preload="metadata"></video>':'<audio src="'+safe(mediaUrl)+'" controls preload="metadata"></audio>')+'</div>':'';
      const shapeClass=['shape-i','shape-l','shape-square','shape-t','shape-z','shape-j','shape-s'][index%7];
      if(permalink){
        const body=post.content_html?'<div class="post-body">'+cleanHtml(post.content_html)+'</div>':'';
        const editButton=canEditPosts?'<button class="post-edit-button" type="button" data-inline-edit="'+safe(post.slug)+'" aria-label="Edit '+safe(post.title)+'">EDIT ↗</button>':'';
        return '<article class="post-card '+shapeClass+'" id="post-'+safe(post.slug)+'"><div class="post-card-top"><span>'+prettyDate(post.published_at||post.created_at)+'</span><span class="post-category">'+safe(displayCategory(post.category))+'</span>'+editButton+'</div><h3>'+safe(post.title)+'</h3>'+media+'<p>'+safe(post.excerpt||'')+'</p>'+body+shareActions(post)+permalinkBack+'</article>';
      }
      // Archive cards: split the article into four readable cells, then arrange them as a tetromino.
      const doc=new DOMParser().parseFromString(cleanHtml(post.content_html||''),'text/html');
      const contentNodes=[...doc.body.children].map(node=>node.outerHTML);
      const pieces=[];
      if(post.excerpt)pieces.push('<p class="post-excerpt">'+safe(post.excerpt)+'</p>');
      if(media)pieces.push(media);
      pieces.push(...contentNodes);
      const buckets=[[],[],[],[]];
      pieces.forEach((piece,i)=>buckets[Math.min(3,Math.floor(i*4/Math.max(1,pieces.length)))].push(piece));
      const blockMarkup=buckets.map((bucket,blockIndex)=>{
        const editButton=canEditPosts?'<button class="post-edit-button" type="button" data-inline-edit="'+safe(post.slug)+'" aria-label="Edit '+safe(post.title)+'">EDIT ↗</button>':'';
        const lead=blockIndex===0?'<div class="post-card-top"><span>'+prettyDate(post.published_at||post.created_at)+'</span><span class="post-category">'+safe(displayCategory(post.category))+'</span>'+editButton+'</div><h3><a class="post-title-link" href="?post='+encodeURIComponent(post.slug)+'">'+safe(post.title)+'</a></h3>':'';
        const inner=bucket.join('');
        return '<section class="post-cell post-cell-'+(blockIndex+1)+'">'+lead+(inner?'<div class="post-cell-content">'+inner+'</div>':'<span class="post-cell-index" aria-hidden="true">0'+(blockIndex+1)+'</span>')+'</section>';
      }).join('');
      return '<article class="post-card tetris-post '+shapeClass+'" id="post-'+safe(post.slug)+'"><div class="post-blocks">'+blockMarkup+'</div><a class="post-open-link" href="?post='+encodeURIComponent(post.slug)+'">OPEN TRANSMISSION ↗</a>'+shareActions(post)+'</article>';
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
    posts=data||[];canEditPosts=await checkEditorAccess();renderCategories();render();
  }

  function openInlineEditor(post){
    if(!canEditPosts||!post||!editModal)return;
    editingPost=post;editTitle.value=post.title||'';editSlug.value=post.slug||'';
    editCategory.value=displayCategory(post.category);editExcerpt.value=post.excerpt||'';
    editBody.innerHTML=cleanHtml(post.content_html||'');editMessage.textContent='';
    editModal.hidden=false;document.body.classList.add('post-edit-open');editTitle.focus();
  }
  function closeInlineEditor(){
    if(editSaving)return;
    editModal.hidden=true;document.body.classList.remove('post-edit-open');editingPost=null;
  }
  list.addEventListener('click',async event=>{
    const shareButton=event.target.closest('[data-share-url]');
    if(shareButton){
      event.preventDefault();
      const shareData={title:shareButton.dataset.shareTitle||document.title,url:shareButton.dataset.shareUrl};
      try{
        if(navigator.share){await navigator.share(shareData);}
        else if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(shareData.url);shareButton.textContent='LINK COPIED';}
        else {window.prompt('Copy this post link:',shareData.url);}
      }catch(error){if(error?.name!=='AbortError')window.prompt('Copy this post link:',shareData.url);}
      return;
    }
    const copyButton=event.target.closest('[data-copy-share]');
    if(copyButton){
      event.preventDefault();
      const url=copyButton.dataset.copyShare;
      try{
        if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(url);}
        else {const field=document.createElement('textarea');field.value=url;field.style.position='fixed';field.style.opacity='0';document.body.appendChild(field);field.select();document.execCommand('copy');field.remove();}
        copyButton.textContent='LINK COPIED';
      }catch{window.prompt('Copy this post link:',url);}
      return;
    }
    const button=event.target.closest('[data-inline-edit]');
    if(!button)return;
    event.preventDefault();event.stopPropagation();
    const post=posts.find(item=>item.slug===button.dataset.inlineEdit);
    if(post)openInlineEditor(post);
  });
  document.getElementById('post-edit-close')?.addEventListener('click',closeInlineEditor);
  document.getElementById('post-edit-cancel')?.addEventListener('click',closeInlineEditor);
  editModal?.addEventListener('click',event=>{if(event.target===editModal)closeInlineEditor();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!editModal.hidden)closeInlineEditor();});
  document.querySelectorAll('[data-inline-command]').forEach(button=>button.addEventListener('click',()=>{
    editBody.focus();const command=button.dataset.inlineCommand;
    if(command==='formatBlock')document.execCommand(command,false,'<'+button.dataset.inlineValue+'>');
    else document.execCommand(command,false,null);
  }));
  document.getElementById('inline-edit-link')?.addEventListener('click',()=>{
    editBody.focus();const url=prompt('Enter an https:// or mailto: link');
    if(url&&/^(https?:\/\/|mailto:)/i.test(url.trim()))document.execCommand('createLink',false,url.trim());
    else if(url)editMessage.textContent='Only https:// and mailto: links are allowed.';
  });
  editForm?.addEventListener('submit',async event=>{
    event.preventDefault();
    if(editSaving||!editingPost||!client)return;
    const title=editTitle.value.trim(),slug=slugify(editSlug.value),category=editCategory.value.trim().toUpperCase();
    const excerpt=editExcerpt.value.trim(),content_html=cleanHtml(editBody.innerHTML);
    if(!title||!slug||!MOVEMENTS.includes(category)){editMessage.textContent='Title, a valid slug, and movement are required.';return;}
    if(!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)){editMessage.textContent='Use lowercase words separated by hyphens for the URL slug.';return;}
    if(!content_html.trim()){editMessage.textContent='The post body cannot be empty.';return;}
    editSaving=true;editSave.disabled=true;editMessage.textContent='SAVING CHANGES…';
    try{
      const {data:{session}}=await client.auth.getSession();
      if(!session?.user)throw new Error('Your editor session has expired. Sign in again to edit posts.');
      const {data:admin,error:adminError}=await client.from('vha_cms_admins').select('user_id').eq('user_id',session.user.id).maybeSingle();
      if(adminError||!admin)throw new Error('This account does not have CMS editor access.');
      const {data,error}=await client.from('vha_posts').update({title,slug,category,excerpt,content_html}).eq('id',editingPost.id).eq('status','published').select('id,title,slug,category,excerpt,content_html,media_url,media_type,created_at,published_at').single();
      if(error)throw error;
      posts=posts.map(post=>post.id===data.id?{...post,...data}:post);
      const changedSlug=data.slug!==requestedSlug;
      editMessage.textContent='SAVED. REFRESHING TRANSMISSION…';
      editModal.hidden=true;document.body.classList.remove('post-edit-open');
      if(changedSlug&&new URLSearchParams(location.search).has('post')){
        const url=new URL(location.href);url.searchParams.set('post',data.slug);location.assign(url.toString());return;
      }
      editingPost=null;render();
    }catch(error){editMessage.textContent=error.message||'Could not save changes.';}
    finally{editSaving=false;editSave.disabled=false;}
  });

  function initViewerThemes(){
    const root=document.documentElement,form=document.getElementById("theme-prompt-form"),prompt=document.getElementById("theme-prompt"),status=document.getElementById("theme-status"),progress=document.getElementById("theme-progress"),bar=document.getElementById("theme-progress-bar"),percent=document.getElementById("theme-progress-percent"),message=document.getElementById("theme-progress-message"),result=document.getElementById("theme-result"),resultTitle=document.getElementById("theme-result-title"),resultDescription=document.getElementById("theme-result-description"),applyButton=document.getElementById("theme-apply"),resetButton=document.getElementById("theme-reset");
    const presets={
      neon:{name:"Neon Biosphere",summary:"Acid-green terminal archive with pixel edges and modular tiles.",colors:{page:"#050906",surface:"#0b150d",raised:"#122017",text:"#e8f4df",muted:"#aab7a7",accent:"#b6e833",secondary:"#a98bff",border:"#52613e",glow:"#24351b"},typography:{heading:"mono",body:"modern",scale:"balanced",weight:"bold"},layout:{density:"balanced",columns:"mosaic",card:"pixel",geometry:"cut-corner",hero:"poster"},details:{pattern:"grid",media:"framed",buttons:"mechanical",motion:"subtle",shadows:"glow",nav:"terminal"}},
      cyber:{name:"Cyberpunk",summary:"Electric night-city palette with high-contrast panels.",colors:{page:"#08051a",surface:"#140b26",raised:"#211137",text:"#f8edff",muted:"#c1aaca",accent:"#ff4fd8",secondary:"#54d7ef",border:"#75476e",glow:"#512044"},typography:{heading:"condensed",body:"modern",scale:"expressive",weight:"black"},layout:{density:"dense",columns:"mosaic",card:"glass",geometry:"cut-corner",hero:"immersive"},details:{pattern:"scanlines",media:"glow",buttons:"outlined",motion:"energetic",shadows:"glow",nav:"boxed"}},
      violet:{name:"Violet Static",summary:"Dreamlike violet editorial surfaces and soft neon detail.",colors:{page:"#090617",surface:"#17102b",raised:"#241a3e",text:"#f0ebff",muted:"#b7add0",accent:"#b69cff",secondary:"#54d7ef",border:"#625180",glow:"#34245b"},typography:{heading:"editorial",body:"humanist",scale:"expressive",weight:"regular"},layout:{density:"airy",columns:"masonry",card:"editorial",geometry:"organic",hero:"editorial"},details:{pattern:"grain",media:"film",buttons:"pill",motion:"subtle",shadows:"soft",nav:"underline"}},
      ember:{name:"Ember Signal",summary:"Warm, cinematic charcoal surfaces with firelight accents.",colors:{page:"#160906",surface:"#26110d",raised:"#351a14",text:"#fff0e7",muted:"#c8a99a",accent:"#ff9b54",secondary:"#ff4f82",border:"#7c4934",glow:"#54251a"},typography:{heading:"display",body:"editorial",scale:"expressive",weight:"bold"},layout:{density:"balanced",columns:"mosaic",card:"brutalist",geometry:"stacked",hero:"immersive"},details:{pattern:"grain",media:"film",buttons:"solid",motion:"subtle",shadows:"hard",nav:"boxed"}},
      ocean:{name:"Deep Ocean",summary:"Bioluminescent deep-water surfaces with cool glass framing.",colors:{page:"#031015",surface:"#071e27",raised:"#0c2a34",text:"#e4fbff",muted:"#9cbfc6",accent:"#53e7df",secondary:"#579bff",border:"#31616b",glow:"#12454a"},typography:{heading:"modern",body:"humanist",scale:"balanced",weight:"regular"},layout:{density:"airy",columns:"masonry",card:"glass",geometry:"rounded",hero:"immersive"},details:{pattern:"blueprint",media:"glow",buttons:"outlined",motion:"subtle",shadows:"soft",nav:"minimal"}}
    };
    let pendingTheme=null;
    const valid=(value,allowed,fallback)=>allowed.includes(value)?value:fallback;
    function applyTheme(theme,save=true){
      if(!theme||!theme.colors||!theme.typography||!theme.layout||!theme.details)return;
      const c=theme.colors;
      Object.entries({page:c.page,surface:c.surface,raised:c.raised,text:c.text,muted:c.muted,accent:c.accent,secondary:c.secondary,border:c.border,glow:c.glow}).forEach(([key,value])=>{if(/^#[0-9a-f]{6}$/i.test(value||""))root.style.setProperty("--theme-"+key,value);});
      root.dataset.themeHeading=valid(theme.typography.heading,["editorial","modern","mono","condensed","display"],"modern");
      root.dataset.themeBody=valid(theme.typography.body,["editorial","modern","mono","humanist"],"modern");
      root.dataset.themeScale=valid(theme.typography.scale,["compact","balanced","expressive"],"balanced");
      root.dataset.themeWeight=valid(theme.typography.weight,["light","regular","bold","black"],"bold");
      root.dataset.themeDensity=valid(theme.layout.density,["airy","balanced","dense"],"balanced");
      root.dataset.themeColumns=valid(theme.layout.columns,["one","two","mosaic","masonry"],"mosaic");
      root.dataset.themeCard=valid(theme.layout.card,["glass","paper","brutalist","pixel","soft","editorial"],"editorial");
      root.dataset.themeGeometry=valid(theme.layout.geometry,["square","rounded","cut-corner","organic","stacked"],"cut-corner");
      root.dataset.themeHero=valid(theme.layout.hero,["minimal","editorial","immersive","grid","poster"],"poster");
      root.dataset.themePattern=valid(theme.details.pattern,["none","grid","grain","botanical","scanlines","blueprint","paper"],"grid");
      root.dataset.themeMedia=valid(theme.details.media,["clean","film","framed","glow","polaroid"],"framed");
      root.dataset.themeButtons=valid(theme.details.buttons,["minimal","outlined","solid","pill","mechanical"],"mechanical");
      root.dataset.themeMotion=valid(theme.details.motion,["none","subtle","energetic"],"subtle");
      root.dataset.themeShadows=valid(theme.details.shadows,["flat","soft","hard","glow"],"glow");
      root.dataset.themeNav=valid(theme.details.nav,["minimal","boxed","underline","terminal"],"terminal");
      root.dataset.viewerTheme="custom";
      document.querySelectorAll(".theme-swatch").forEach(b=>{b.classList.remove("is-active");b.setAttribute("aria-pressed","false");});
      if(save){try{localStorage.setItem("vha-ai-theme",JSON.stringify(theme));}catch{}}
    }
    function setProgress(value,label){progress.hidden=false;bar.style.width=value+"%";percent.textContent=value+"%";message.textContent=label;}
    function showPreset(name){const p=presets[name]||presets.neon;pendingTheme=p;applyTheme(p);result.hidden=false;resultTitle.textContent=p.name.toUpperCase();resultDescription.textContent=p.summary;status.textContent="PRESET LOADED. IT IS APPLIED LOCALLY.";document.querySelectorAll(".theme-swatch").forEach(b=>{const active=b.dataset.theme===name;b.classList.toggle("is-active",active);b.setAttribute("aria-pressed",String(active));});}
    document.querySelectorAll(".theme-swatch").forEach(b=>b.addEventListener("click",()=>showPreset(b.dataset.theme)));
    document.querySelectorAll("[data-prompt]").forEach(b=>b.addEventListener("click",()=>{prompt.value=b.dataset.prompt;prompt.focus();}));
    try{const saved=JSON.parse(localStorage.getItem("vha-ai-theme")||"null");if(saved)applyTheme(saved,false);else showPreset("neon");}catch{showPreset("neon");}
    function buildLocalTheme(description){
      const q=description.toLowerCase();
      const moods=[
        {re:/\b(calm|peaceful|relaxed|serene|quiet|grounded)\b/,base:"ocean",name:"Quiet Tide",colors:{page:"#eaf2ef",surface:"#f7fbf8",raised:"#d8e7e1",text:"#203a38",muted:"#617a75",accent:"#438f87",secondary:"#8ab9c8",border:"#bfd4cc",glow:"#d6e7df"},heading:"editorial",body:"humanist",density:"airy",card:"soft",geometry:"rounded",pattern:"none",motion:"subtle",shadows:"soft"},
        {re:/\b(sad|down|heartbroken|grieving|hurt|melancholy|blue)\b/,base:"violet",name:"Blue Hour",colors:{page:"#111827",surface:"#1a2436",raised:"#263248",text:"#e5eaf4",muted:"#a8b4ca",accent:"#8caee8",secondary:"#b8a5d8",border:"#46536c",glow:"#293b5b"},heading:"editorial",body:"humanist",density:"airy",card:"soft",geometry:"rounded",pattern:"grain",motion:"subtle",shadows:"soft"},
        {re:/\b(anxious|anxiety|stressed|overthinking|overwhelmed|restless|frazzled)\b/,base:"ocean",name:"Steady Ground",colors:{page:"#edf1ed",surface:"#fbfcf8",raised:"#dce5dc",text:"#28352e",muted:"#65736a",accent:"#56816a",secondary:"#7f9ca5",border:"#c7d2c7",glow:"#d8e2d8"},heading:"modern",body:"humanist",density:"airy",card:"soft",geometry:"rounded",pattern:"none",motion:"none",shadows:"flat",columns:"one"},
        {re:/\b(angry|furious|frustrated|rage|irritated)\b/,base:"ember",name:"Redline",colors:{page:"#170b0d",surface:"#271316",raised:"#3a1b20",text:"#fff0ef",muted:"#d0a8aa",accent:"#ff5b62",secondary:"#ffb15e",border:"#7d343d",glow:"#5a2029"},heading:"condensed",body:"modern",density:"dense",card:"brutalist",geometry:"square",pattern:"grid",motion:"energetic",shadows:"hard"},
        {re:/\b(happy|joyful|excited|playful|cheerful|delighted|energized)\b/,base:"ember",name:"Little Sun",colors:{page:"#fff5df",surface:"#fffaf0",raised:"#ffe7b8",text:"#49301c",muted:"#80674f",accent:"#e88a35",secondary:"#e85d75",border:"#e7c998",glow:"#f7d69b"},heading:"display",body:"modern",density:"balanced",card:"soft",geometry:"rounded",pattern:"grain",motion:"energetic",shadows:"soft"},
        {re:/\b(hopeful|hope|optimistic|inspired|fresh start|motivated)\b/,base:"neon",name:"New Growth",colors:{page:"#f0f5e8",surface:"#fbfff5",raised:"#dfeacb",text:"#293923",muted:"#68785e",accent:"#6e9e42",secondary:"#e0a65b",border:"#c8d7b2",glow:"#d9e7c4"},heading:"editorial",body:"humanist",density:"airy",card:"paper",geometry:"organic",pattern:"botanical",motion:"subtle",shadows:"soft"},
        {re:/\b(lonely|alone|isolated|unseen|invisible)\b/,base:"violet",name:"After Hours",colors:{page:"#100d1c",surface:"#1b172b",raised:"#29223d",text:"#eee8f7",muted:"#b0a4c6",accent:"#a78bd4",secondary:"#6e9ec5",border:"#514464",glow:"#332546"},heading:"editorial",body:"humanist",density:"airy",card:"editorial",geometry:"rounded",pattern:"grain",motion:"subtle",shadows:"soft"},
        {re:/\b(nostalgic|nostalgia|homesick|wistful|sentimental)\b/,base:"ember",name:"Memory Lane",colors:{page:"#eee4d2",surface:"#faf3e5",raised:"#e1d1b5",text:"#3e3328",muted:"#796957",accent:"#a56c48",secondary:"#71816a",border:"#c7b79e",glow:"#d8c4a4"},heading:"editorial",body:"editorial",density:"airy",card:"paper",geometry:"organic",pattern:"grain",motion:"none",shadows:"soft"},
        {re:/\b(romantic|romance|tender|affection|in love)\b/,base:"violet",name:"Soft Focus",colors:{page:"#fff0f2",surface:"#fff9fa",raised:"#f5dce5",text:"#482d3a",muted:"#8a6878",accent:"#c45e87",secondary:"#9a8ad1",border:"#e6c3d2",glow:"#f0d4e0"},heading:"editorial",body:"humanist",density:"airy",card:"soft",geometry:"rounded",pattern:"grain",motion:"subtle",shadows:"soft"}
      ];
      const mood=moods.find(item=>item.re.test(q));
      const baseKey=mood?mood.base:(/cyberpunk|cyber punk|neon city|night city|futuristic/.test(q)?"cyber":/violet|lavender|dreamy|ethereal|poetic/.test(q)?"violet":/ember|fire|warm|sunset|orange|cinematic/.test(q)?"ember":/ocean|underwater|aquatic|blue|teal|bioluminescent/.test(q)?"ocean":/green dream|botanical|forest|nature|acid green|terminal|matrix/.test(q)?"neon":"neon");
      const theme=JSON.parse(JSON.stringify(presets[baseKey]));
      if(mood){
        theme.name=mood.name;theme.summary="A visual atmosphere shaped by the feeling you described.";
        theme.colors={...theme.colors,...mood.colors};
        theme.typography.heading=mood.heading;theme.typography.body=mood.body;
        theme.layout.density=mood.density;theme.layout.card=mood.card;theme.layout.geometry=mood.geometry;
        theme.details.pattern=mood.pattern;theme.details.motion=mood.motion;theme.details.shadows=mood.shadows;
        if(mood.columns)theme.layout.columns=mood.columns;
      }
      const setColor=(keys,value)=>{if(keys.some(k=>q.includes(k)))theme.colors.accent=value;};
      setColor(["pink","magenta","hot pink","fuchsia"],"#ff4fd8");
      setColor(["purple","violet","lavender"],"#b69cff");
      setColor(["cyan","ice blue","electric blue"],"#54d7ef");
      setColor(["orange","amber","sunset","fire"],"#ff9b54");
      setColor(["red","crimson","blood"],"#ff4f68");
      setColor(["gold","golden","yellow"],"#f3d35b");
      setColor(["lime","acid green","green"],"#b6e833");
      setColor(["turquoise","teal","mint"],"#53e7c1");
      if(/light mode|light theme|bright background|white background|cream|ivory|paper/.test(q)){
        theme.colors.page="#f2eee5";theme.colors.surface="#fffaf0";theme.colors.raised="#e8e0d2";
        theme.colors.text="#20251d";theme.colors.muted="#62695e";theme.colors.border="#b8b09f";theme.colors.glow="#d8d0c0";
        theme.layout.card=/brutalist|brutalism|raw/.test(q)?"brutalist":"paper";
        theme.details.pattern=/grid|blueprint/.test(q)?"blueprint":"paper";
      }
      if(/dark|black background|midnight|noir/.test(q)){theme.colors.page="#07080b";theme.colors.surface="#111319";theme.colors.raised="#1b1f29";theme.colors.text="#f2f4f8";theme.colors.muted="#a4aab7";}
      if(/minimal|minimalist|clean|simple/.test(q)){theme.layout.density="airy";theme.layout.columns="one";theme.layout.card="soft";theme.layout.geometry="square";theme.layout.hero="minimal";theme.details.pattern="none";theme.details.buttons="minimal";theme.details.nav="minimal";theme.details.motion="none";}
      if(/brutalist|brutalism|raw/.test(q)){theme.layout.card="brutalist";theme.layout.geometry="square";theme.details.buttons="mechanical";theme.details.shadows="hard";theme.details.pattern="grid";}
      if(/glass|glassmorphism|transparent|frosted/.test(q)){theme.layout.card="glass";theme.layout.geometry="rounded";theme.details.media="glow";theme.details.shadows="soft";}
      if(/pixel|8.bit|retro game|arcade|tetris/.test(q)){theme.typography.heading="mono";theme.layout.card="pixel";theme.layout.geometry="cut-corner";theme.details.buttons="mechanical";theme.details.pattern="grid";}
      if(/editorial|magazine|literary|bookish|serif/.test(q)){theme.typography.heading="editorial";theme.typography.body="editorial";theme.layout.card="editorial";theme.layout.columns="masonry";theme.layout.hero="editorial";theme.details.media="film";}
      if(/condensed|narrow type|industrial/.test(q))theme.typography.heading="condensed";
      if(/monospace|monospaced|terminal|code|hacker/.test(q)){theme.typography.heading="mono";theme.typography.body="mono";theme.details.nav="terminal";}
      if(/large type|oversized|bold typography|expressive type/.test(q)){theme.typography.scale="expressive";theme.typography.weight="black";theme.layout.hero="poster";}
      if(/compact|dense|tight spacing/.test(q))theme.layout.density="dense";
      if(/spacious|airy|lots of whitespace|wide spacing/.test(q))theme.layout.density="airy";
      if(/two columns|two-column/.test(q))theme.layout.columns="two";
      if(/single column|one column|full width/.test(q))theme.layout.columns="one";
      if(/masonry/.test(q))theme.layout.columns="masonry";
      if(/mosaic|asymmetric|asymmetrical/.test(q))theme.layout.columns="mosaic";
      if(/rounded|round corners|soft corners|pill/.test(q)){theme.layout.geometry="rounded";theme.details.buttons="pill";}
      if(/sharp corners|square corners|angular/.test(q))theme.layout.geometry="square";
      if(/cut corners|cyber corners/.test(q))theme.layout.geometry="cut-corner";
      if(/botanical|leaves|plant|organic/.test(q)){theme.details.pattern="botanical";theme.layout.geometry="organic";}
      if(/scanline|crt|vhs/.test(q))theme.details.pattern="scanlines";
      if(/blueprint|technical drawing/.test(q))theme.details.pattern="blueprint";
      if(/grain|film grain|analog/.test(q)){theme.details.pattern="grain";theme.details.media="film";}
      if(/no pattern|plain background|no texture/.test(q))theme.details.pattern="none";
      if(/polaroid|instant photo/.test(q))theme.details.media="polaroid";
      if(/glowing media|glow|neon glow/.test(q)){theme.details.media="glow";theme.details.shadows="glow";}
      if(/framed image|framed media|borders around media/.test(q))theme.details.media="framed";
      if(/no animation|static|reduced motion/.test(q))theme.details.motion="none";
      if(/energetic|animated|dynamic motion/.test(q))theme.details.motion="energetic";
      if(/underline navigation|underlined nav/.test(q))theme.details.nav="underline";
      if(/boxed navigation|navigation boxes/.test(q))theme.details.nav="boxed";
      if(/flat|no shadows/.test(q))theme.details.shadows="flat";
      if(/no buttons|outlined buttons|outline/.test(q))theme.details.buttons="outlined";
      if(/solid buttons|filled buttons/.test(q))theme.details.buttons="solid";
      if(!mood){
        theme.name="Local Design // "+({neon:"Neon Biosphere",cyber:"Cyberpunk",violet:"Violet Static",ember:"Ember Signal",ocean:"Deep Ocean"}[baseKey]);
        theme.summary="Built locally from your design brief. No paid API, account, or prompt history required.";
      }
      return theme;
    }
    form?.addEventListener("submit",event=>{
      event.preventDefault();
      const description=prompt.value.trim();
      if(description.length<12){status.textContent="DESCRIBE THE REDESIGN IN AT LEAST A FEW WORDS.";prompt.focus();return;}
      const button=form.querySelector("button[type=submit]");
      button.disabled=true;result.hidden=true;status.textContent="BUILDING YOUR DESIGN LOCALLY — NO API CALLS.";
      setProgress(20,"INTERPRETING STYLE, COLOR & MOOD…");
      pendingTheme=buildLocalTheme(description);
      setProgress(58,"CONFIGURING LAYOUT, TYPOGRAPHY & COMPONENTS…");
      applyTheme(pendingTheme,false);
      setProgress(82,"APPLYING MEDIA, NAVIGATION & DECORATION…");
      resultTitle.textContent=pendingTheme.name.toUpperCase();
      resultDescription.textContent=pendingTheme.summary;
      result.hidden=false;
      setProgress(100,"LOCAL DESIGN READY — PROMPT CLEARED");
      prompt.value="";prompt.removeAttribute("value");
      status.textContent="DESIGN GENERATED LOCALLY. NO PAID API USED. SELECT APPLY DESIGN TO SAVE IT IN THIS BROWSER.";
      button.disabled=false;
    });
    applyButton?.addEventListener("click",()=>{if(!pendingTheme)return;applyTheme(pendingTheme);status.textContent="THE NEW DESIGN SYSTEM IS APPLIED AND SAVED IN THIS BROWSER.";progress.hidden=true;});
    resetButton?.addEventListener("click",()=>{try{localStorage.removeItem("vha-ai-theme");}catch{}root.removeAttribute("data-theme-heading");root.removeAttribute("data-theme-body");root.removeAttribute("data-theme-scale");root.removeAttribute("data-theme-weight");root.removeAttribute("data-theme-density");root.removeAttribute("data-theme-columns");root.removeAttribute("data-theme-card");root.removeAttribute("data-theme-geometry");root.removeAttribute("data-theme-hero");root.removeAttribute("data-theme-pattern");root.removeAttribute("data-theme-media");root.removeAttribute("data-theme-buttons");root.removeAttribute("data-theme-motion");root.removeAttribute("data-theme-shadows");root.removeAttribute("data-theme-nav");["page","surface","raised","text","muted","accent","secondary","border","glow"].forEach(k=>root.style.removeProperty("--theme-"+k));showPreset("neon");status.textContent="DEFAULT DESIGN RESTORED.";});
  }
  if(document.getElementById('theme-prompt-form'))initViewerThemes();
  search.addEventListener('input',render);categoryFilter.addEventListener('change',render);load();
})();