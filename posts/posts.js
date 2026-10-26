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
  function initFallingTetris(){
    const canvas=document.getElementById("falling-tetris-bg");
    if(!canvas||!canvas.getContext)return;
    const reduced=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if(reduced)return;
    const ctx=canvas.getContext("2d");
    if(!ctx)return;
    const root=document.documentElement;
    const shapes=[
      [[1,1,1,1]],
      [[1,0,0],[1,1,1]],
      [[0,0,1],[1,1,1]],
      [[1,1],[1,1]],
      [[0,1,1],[1,1,0]],
      [[0,1,0],[1,1,1]],
      [[1,1,0],[0,1,1]]
    ];
    const palette=["#b6e833","#a98bff","#54d7ef","#f2f4e8"];
    let width=0,height=0,dpr=1,last=0,spawnClock=0,frame=0,raf=0;
    const pieces=[];
    function resize(){
      dpr=Math.min(window.devicePixelRatio||1,1.5);
      width=window.innerWidth;height=window.innerHeight;
      canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
      ctx.setTransform(dpr,0,0,dpr,0,0);
    }
    function spawn(){
      const matrix=shapes[Math.floor(Math.random()*shapes.length)];
      const cell=16+Math.random()*14;
      const cols=Math.max(1,Math.floor(width/cell));
      const col=Math.floor(Math.random()*cols);
      pieces.push({matrix,cell,x:col*cell,y:-matrix.length*cell-Math.random()*height*.25,
        speed:22+Math.random()*48,alpha:.28+Math.random()*.42,
        color:palette[Math.floor(Math.random()*palette.length)],rot:Math.random()<.2?Math.PI/2:0});
      if(pieces.length>18)pieces.shift();
    }
    function drawPiece(p){
      ctx.save();ctx.globalAlpha=p.alpha;ctx.translate(p.x,p.y);ctx.rotate(p.rot);
      p.matrix.forEach((row,ry)=>row.forEach((filled,rx)=>{
        if(!filled)return;
        const x=rx*p.cell,y=ry*p.cell,s=p.cell-1.5;
        ctx.fillStyle=p.color;ctx.fillRect(x,y,s,s);
        ctx.fillStyle="rgba(255,255,255,.24)";ctx.fillRect(x+2,y+2,s-4,Math.max(2,p.cell*.11));
        ctx.strokeStyle="rgba(4,10,7,.72)";ctx.lineWidth=1;ctx.strokeRect(x+.5,y+.5,s-1,s-1);
      }));
      ctx.restore();
    }
    function tick(now){
      raf=0;
      if(document.hidden)return;
      const dt=Math.min((now-last)/1000||0,.05);last=now;spawnClock+=dt;frame++;
      ctx.clearRect(0,0,width,height);
      if(spawnClock>.72){spawnClock=0;if(pieces.length<15)spawn();}
      const accent=getComputedStyle(root).getPropertyValue("--theme-accent").trim();
      pieces.forEach(p=>{
        p.y+=p.speed*dt;
        if(accent&&/^#[0-9a-f]{6}$/i.test(accent)&&frame%90===0)p.color=accent;
        drawPiece(p);
      });
      for(let i=pieces.length-1;i>=0;i--){
        if(pieces[i].y>height+80)pieces.splice(i,1);
      }
      raf=requestAnimationFrame(tick);
    }
    function start(){if(!raf&&!document.hidden){last=performance.now();raf=requestAnimationFrame(tick);}}
    function stop(){if(raf){cancelAnimationFrame(raf);raf=0;}}
    resize();spawn();spawn();start();
    window.addEventListener("resize",resize,{passive:true});
    document.addEventListener("visibilitychange",()=>{if(document.hidden)stop();else start();});
  }
  function initViewerThemes(){
    const root=document.documentElement,form=document.getElementById("theme-prompt-form"),prompt=document.getElementById("theme-prompt"),status=document.getElementById("theme-status"),progress=document.getElementById("theme-progress"),bar=document.getElementById("theme-progress-bar"),percent=document.getElementById("theme-progress-percent"),message=document.getElementById("theme-progress-message"),result=document.getElementById("theme-result"),resultTitle=document.getElementById("theme-result-title"),resultDescription=document.getElementById("theme-result-description"),applyButton=document.getElementById("theme-apply"),resetButton=document.getElementById("theme-reset");
    const endpoint="https://oeyxsqocldlovhsmzcjw.supabase.co/functions/v1/website-theme";
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
    form?.addEventListener("submit",async event=>{
      event.preventDefault();const description=prompt.value.trim();
      if(description.length<12){status.textContent="DESCRIBE THE REDESIGN IN AT LEAST A FEW WORDS.";prompt.focus();return;}
      const button=form.querySelector("button[type=submit]");button.disabled=true;result.hidden=true;status.textContent="SENDING YOUR DESIGN BRIEF TO THE AI THEME ENGINE…";setProgress(12,"READING THE VISUAL BRIEF…");
      const stages=[["MAPPING LAYOUT & TYPOGRAPHY…",30],["DESIGNING COMPONENTS & TILE GEOMETRY…",54],["BUILDING COLOR, MEDIA & DECORATION TOKENS…",78]];
      let stage=0;const stageTimer=setInterval(()=>{if(stage<stages.length){setProgress(stages[stage][1],stages[stage][0]);stage++;}},1600);
      try{
        const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt:description})});
        const data=await response.json();
        if(!response.ok)throw new Error(data.error||"The theme service could not complete the request.");
        pendingTheme=data.theme;setProgress(100,"DESIGN SYSTEM READY — TEMPORARY BRIEF CLEARED");prompt.value="";prompt.removeAttribute("value");resultTitle.textContent=(pendingTheme.name||"GENERATED THEME").toUpperCase();resultDescription.textContent=pendingTheme.summary||"A complete visual design system has been generated.";result.hidden=false;status.textContent="THEME GENERATED. THE PROMPT FIELD IS CLEARED; ONLY THE CURRENT RESULT IS KEPT FOR APPLYING."; 
      }catch(error){status.textContent=error.message||"THE AI THEME ENGINE IS CURRENTLY UNAVAILABLE.";progress.hidden=true;}
      finally{clearInterval(stageTimer);button.disabled=false;}
    });
    applyButton?.addEventListener("click",()=>{if(!pendingTheme)return;applyTheme(pendingTheme);status.textContent="THE NEW DESIGN SYSTEM IS APPLIED AND SAVED IN THIS BROWSER.";progress.hidden=true;});
    resetButton?.addEventListener("click",()=>{try{localStorage.removeItem("vha-ai-theme");}catch{}root.removeAttribute("data-theme-heading");root.removeAttribute("data-theme-body");root.removeAttribute("data-theme-scale");root.removeAttribute("data-theme-weight");root.removeAttribute("data-theme-density");root.removeAttribute("data-theme-columns");root.removeAttribute("data-theme-card");root.removeAttribute("data-theme-geometry");root.removeAttribute("data-theme-hero");root.removeAttribute("data-theme-pattern");root.removeAttribute("data-theme-media");root.removeAttribute("data-theme-buttons");root.removeAttribute("data-theme-motion");root.removeAttribute("data-theme-shadows");root.removeAttribute("data-theme-nav");["page","surface","raised","text","muted","accent","secondary","border","glow"].forEach(k=>root.style.removeProperty("--theme-"+k));showPreset("neon");status.textContent="DEFAULT DESIGN RESTORED.";});
  }
  initFallingTetris();
  initViewerThemes();
  search.addEventListener('input',render);categoryFilter.addEventListener('change',render);load();
})();