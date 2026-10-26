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
      const permalinkBack=permalink?'<p class="post-back"><a href="./">← BACK TO THE ARCHIVE</a></p>':'';
      const mediaUrl=validMediaUrl(post.media_url);
      const media=mediaUrl?'<div class="post-media">'+(post.media_type==='image'?'<img src="'+safe(mediaUrl)+'" alt="'+safe(post.title)+'" loading="lazy">':post.media_type==='video'?'<video src="'+safe(mediaUrl)+'" controls preload="metadata"></video>':'<audio src="'+safe(mediaUrl)+'" controls preload="metadata"></audio>')+'</div>':'';
      const shapeClass=['shape-i','shape-l','shape-square','shape-t','shape-z','shape-j','shape-s'][index%7];
      if(permalink){
        const body=post.content_html?'<div class="post-body">'+cleanHtml(post.content_html)+'</div>':'';
        return '<article class="post-card '+shapeClass+'" id="post-'+safe(post.slug)+'"><div class="post-card-top"><span>'+prettyDate(post.published_at||post.created_at)+'</span><span class="post-category">'+safe(post.category||'UNCATEGORIZED')+'</span></div><h3>'+safe(post.title)+'</h3>'+media+'<p>'+safe(post.excerpt||'')+'</p>'+body+permalinkBack+'</article>';
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
        const lead=blockIndex===0?'<div class="post-card-top"><span>'+prettyDate(post.published_at||post.created_at)+'</span><span class="post-category">'+safe(post.category||'UNCATEGORIZED')+'</span></div><h3>'+safe(post.title)+'</h3>':'';
        const inner=bucket.join('');
        return '<section class="post-cell post-cell-'+(blockIndex+1)+'">'+lead+(inner?'<div class="post-cell-content">'+inner+'</div>':'<span class="post-cell-index" aria-hidden="true">0'+(blockIndex+1)+'</span>')+'</section>';
      }).join('');
      return '<article class="post-card tetris-post '+shapeClass+'" id="post-'+safe(post.slug)+'"><div class="post-blocks">'+blockMarkup+'</div><a class="post-open-link" href="?post='+encodeURIComponent(post.slug)+'">OPEN TRANSMISSION ↗</a></article>';
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
    const ctx=canvas.getContext("2d"); if(!ctx)return;
    const SHAPES=[
      [[1,1,1,1]], [[1,0,0],[1,1,1]], [[0,0,1],[1,1,1]],
      [[1,1],[1,1]], [[0,1,1],[1,1,0]], [[0,1,0],[1,1,1]],
      [[1,1,0],[0,1,1]]
    ];
    const COLORS=["#b6e833","#a98bff","#54d7ef","#f2f4e8","#76e6a6","#ff70c8","#f2c85b"];
    let width=0,height=0,dpr=1,cell=32,cols=0,rows=0,last=0,dropClock=0,raf=0,paused=false,over=false,score=0,lines=0;
    let board=[],active=null;
    function newBoard(){return Array.from({length:rows},()=>Array(cols).fill(null));}
    function clone(m){return m.map(row=>row.slice());}
    function spawn(){
      const i=Math.floor(Math.random()*SHAPES.length);
      active={m:clone(SHAPES[i]),x:Math.max(0,Math.floor((cols-SHAPES[i][0].length)/2)),y:0,color:COLORS[i]};
      if(collides(active.m,active.x,active.y))over=true;
    }
    function collides(m,x,y){
      for(let r=0;r<m.length;r++)for(let c=0;c<m[r].length;c++)if(m[r][c]){
        const bx=x+c,by=y+r;
        if(bx<0||bx>=cols||by>=rows||(by>=0&&board[by][bx]))return true;
      }
      return false;
    }
    function lock(){
      active.m.forEach((row,r)=>row.forEach((v,c)=>{if(v&&active.y+r>=0&&active.x+c>=0&&active.x+c<cols)board[active.y+r][active.x+c]=active.color;}));
      let cleared=0;
      board=board.filter(row=>{if(row.every(Boolean)){cleared++;return false;}return true;});
      while(board.length<rows)board.unshift(Array(cols).fill(null));
      if(cleared){lines+=cleared;score+=[0,100,300,500,800][cleared]||cleared*250;}
      spawn();
    }
    function move(dx,dy=0){
      if(!active||over||paused)return;
      if(!collides(active.m,active.x+dx,active.y+dy)){active.x+=dx;active.y+=dy;if(dy)score++;return;}
      if(dy>0)lock();
    }
    function rotate(){
      if(!active||over||paused)return;
      const m=active.m[0].map((_,i)=>active.m.map(row=>row[i]).reverse());
      for(const kick of [0,-1,1,-2,2])if(!collides(m,active.x+kick,active.y)){active.m=m;active.x+=kick;return;}
    }
    function hardDrop(){if(!active||over||paused)return;while(!collides(active.m,active.x,active.y+1)){active.y++;score+=2;}lock();}
    function restart(){board=newBoard();score=0;lines=0;over=false;paused=false;dropClock=0;spawn();}
    function resize(){
      const oldCols=cols,oldRows=rows;
      dpr=Math.min(window.devicePixelRatio||1,1.5);width=window.innerWidth;height=window.innerHeight;
      cell=Math.max(22,Math.min(38,Math.floor(Math.min(width/Math.max(1,Math.floor(width/32)),height/Math.max(1,Math.floor(height/32))))||32);
      cols=Math.max(10,Math.floor(width/cell));rows=Math.max(12,Math.floor(height/cell));
      canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
      canvas.style.width=width+"px";canvas.style.height=height+"px";
      ctx.setTransform(dpr,0,0,dpr,0,0);
      if(!board.length){board=newBoard();return;}
      if(cols!==oldCols||rows!==oldRows){
        const next=Array.from({length:rows},()=>Array(cols).fill(null));
        const copyRows=Math.min(rows,board.length),copyCols=Math.min(cols,oldCols);
        for(let r=0;r<copyRows;r++)for(let c=0;c<copyCols;c++)next[rows-copyRows+r][c]=board[board.length-copyRows+r]?.[c]||null;
        board=next;
        if(active){active.x=Math.max(0,Math.min(cols-active.m[0].length,active.x));active.y=Math.max(0,Math.min(rows-active.m.length,active.y));}
      }
    }
    function block(x,y,color,alpha){
      const px=x*cell,py=y*cell,g=1.2;
      ctx.globalAlpha=alpha;ctx.fillStyle=color;ctx.fillRect(px+g,py+g,cell-2*g,cell-2*g);
      ctx.globalAlpha=alpha*.58;ctx.fillStyle="#ffffff";ctx.fillRect(px+g+2,py+g+2,Math.max(1,cell*.4),Math.max(1,cell*.075));
      ctx.globalAlpha=alpha;ctx.strokeStyle=color;ctx.lineWidth=1;ctx.strokeRect(px+g+.5,py+g+.5,cell-2*g-1,cell-2*g-1);
    }
    function textLine(text,x,y,align="left",alpha=.72){
      ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle="#c9f68b";ctx.font="11px monospace";ctx.textAlign=align;ctx.fillText(text,x,y);ctx.restore();
    }
    function draw(){
      ctx.clearRect(0,0,width,height);
      // A screen-wide field: no small centered playfield, just a faint full-screen grid.
      ctx.save();ctx.fillStyle="#07100b";ctx.globalAlpha=.045;ctx.fillRect(0,0,width,height);
      ctx.strokeStyle="#b6e833";ctx.globalAlpha=.09;ctx.lineWidth=1;
      for(let c=0;c<=cols;c++){ctx.beginPath();ctx.moveTo(c*cell,0);ctx.lineTo(c*cell,rows*cell);ctx.stroke();}
      for(let r=0;r<=rows;r++){ctx.beginPath();ctx.moveTo(0,r*cell);ctx.lineTo(cols*cell,r*cell);ctx.stroke();}
      ctx.restore();
      board.forEach((row,y)=>row.forEach((color,x)=>{if(color)block(x,y,color,.62);}));
      if(active)active.m.forEach((row,r)=>row.forEach((v,c)=>{if(v)block(active.x+c,active.y+r,active.color,.88);}));
      // Compact status sits at the top edge; the falling field remains the visual background.
      ctx.save();ctx.fillStyle="rgba(3,8,5,.62)";ctx.fillRect(0,0,width,28);ctx.restore();
      textLine("TRANSMISSIONS // LIVE FIELD",16,18,"left",.78);
      textLine("WASD MOVE / W ROTATE / S DROP  ·  SPACE HARD DROP  ·  P PAUSE  ·  R RESET",width/2,18,"center",.72);
      textLine("SCORE "+String(score).padStart(5,"0")+"  LINES "+String(lines).padStart(2,"0"),width-16,18,"right",.78);
      if(paused||over){
        ctx.save();ctx.fillStyle="rgba(3,7,4,.74)";ctx.fillRect(0,0,width,height);
        ctx.globalAlpha=1;ctx.fillStyle="#b6e833";ctx.textAlign="center";ctx.font="bold 18px monospace";
        ctx.fillText(over?"FIELD SATURATED":"FIELD PAUSED",width/2,height/2);
        ctx.font="12px monospace";ctx.fillText(over?"PRESS R TO CLEAR THE FIELD":"PRESS P TO RESUME",width/2,height/2+26);ctx.restore();
      }
    }
    function tick(now){
      raf=0;if(document.hidden)return;
      const dt=Math.min((now-last)/1000||0,.05);last=now;
      if(!paused&&!over){dropClock+=dt;if(dropClock>(Math.max(.16,.72-lines*.012))){dropClock=0;move(0,1);}}
      draw();raf=requestAnimationFrame(tick);
    }
    function start(){if(!raf&&!document.hidden){last=performance.now();raf=requestAnimationFrame(tick);}}
    function stop(){if(raf){cancelAnimationFrame(raf);raf=0;}}
    function onKey(e){
      if(e.ctrlKey||e.metaKey||e.altKey)return;
      const target=e.target;
      if(target&&(target.isContentEditable||/INPUT|TEXTAREA|SELECT/.test(target.tagName)))return;
      const key=e.key.toLowerCase();
      if(["a","d","s","w"," ","arrowleft","arrowright","arrowdown","arrowup"].includes(key))e.preventDefault();
      if(key==="r"){restart();return;}
      if(key==="p"){if(!over)paused=!paused;return;}
      if(key==="a"||key==="arrowleft")move(-1);
      else if(key==="d"||key==="arrowright")move(1);
      else if(key==="s"||key==="arrowdown")move(0,1);
      else if(key==="w"||key==="arrowup")rotate();
      else if(key===" ")hardDrop();
    }
    restart();resize();draw();start();
    window.addEventListener("keydown",onKey,{passive:false});
    window.addEventListener("resize",resize,{passive:true});
    document.addEventListener("visibilitychange",()=>{if(document.hidden)stop();else start();});
  }
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
      const baseKey=/cyberpunk|cyber punk|neon city|night city|futuristic/.test(q)?"cyber":/violet|lavender|dreamy|ethereal|poetic/.test(q)?"violet":/ember|fire|warm|sunset|orange|cinematic/.test(q)?"ember":/ocean|underwater|aquatic|blue|teal|bioluminescent/.test(q)?"ocean":/green dream|botanical|forest|nature|acid green|terminal|matrix/.test(q)?"neon":"neon";
      const theme=JSON.parse(JSON.stringify(presets[baseKey]));
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
      theme.name="Local Design // "+({neon:"Neon Biosphere",cyber:"Cyberpunk",violet:"Violet Static",ember:"Ember Signal",ocean:"Deep Ocean"}[baseKey]);
      theme.summary="Built locally from your design brief. No paid API, account, or prompt history required.";
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
  initFallingTetris();
  initViewerThemes();
  search.addEventListener('input',render);categoryFilter.addEventListener('change',render);load();
})();