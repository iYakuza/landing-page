/* Match My Mood — complete theme engine, prompt composer, persistence and reset. */
(() => {
  const root=document.getElementById("vha-viewer-tools");
  if(!root)return;
  const moodFontStacks={
    serif:'Georgia,"Times New Roman",serif',
    sans:'Arial,Helvetica,sans-serif',
    mono:'ui-monospace,SFMono-Regular,Consolas,monospace',
    humanist:'"Trebuchet MS",Arial,sans-serif'
  };
  function setMoodTheme(theme){
    const html=document.documentElement;
    // UAT guardrail: keep generated palettes within readable contrast ranges.
    const rgb=hex=>{const h=String(hex||"").replace("#","");return /^([0-9a-f]{6})$/i.test(h)?[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)):null};
    const luminance=hex=>{const c=rgb(hex);if(!c)return .5;const v=c.map(n=>n/255).map(n=>n<=.04045?n/12.92:Math.pow((n+.055)/1.055,2));return .2126*v[0]+.7152*v[1]+.0722*v[2]};
    const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
    const mix=(hex,target,amount)=>{const c=rgb(hex)||[80,100,80],t=target==="white"?255:0;return "#"+c.map(n=>Math.round(n+(t-n)*amount).toString(16).padStart(2,"0")).join("")};
    const validHex=value=>/^#[0-9a-f]{6}$/i.test(String(value||""));
    const minSurfaceContrast=1.25;
    const sourcePage=validHex(theme.page)?theme.page:"#101810";
    const light=luminance(sourcePage)>.42;
    let page=sourcePage;
    if(!light&&luminance(page)>.07){for(let i=0;i<100&&luminance(page)>.07;i++)page=mix(page,"black",.035)}
    let surface=validHex(theme.surface)?theme.surface:page;
    if(light){
      const maxSurface=(luminance(page)+.05)/minSurfaceContrast-.05;
      if(luminance(surface)>maxSurface){for(let i=0;i<100&&luminance(surface)>maxSurface;i++)surface=mix(surface,"black",.035)}
      else if(luminance(surface)<.30){for(let i=0;i<100&&luminance(surface)<.30;i++)surface=mix(surface,"white",.035)}
    }else{
      const maxSurface=.12;
      if(luminance(surface)>maxSurface){for(let i=0;i<100&&luminance(surface)>maxSurface;i++)surface=mix(surface,"black",.035)}
      if(contrast(surface,page)<minSurfaceContrast){
        const candidates=[];
        ["black","white"].forEach(target=>{
          let candidate=surface;
          for(let i=1;i<=100;i++){
            const next=mix(candidate,target,.035);
            if(luminance(next)>maxSurface)break;
            candidate=next;
            if(contrast(candidate,page)>=minSurfaceContrast){
              candidates.push({color:candidate,distance:Math.abs(luminance(candidate)-luminance(surface))});
              break;
            }
          }
        });
        if(candidates.length){
          surface=candidates.sort((a,b)=>a.distance-b.distance)[0].color;
        }else{
          let best=surface,bestRatio=contrast(surface,page);
          ["black","white"].forEach(target=>{
            let candidate=surface;
            for(let i=1;i<=100;i++){
              const next=mix(candidate,target,.035);
              if(luminance(next)>maxSurface)break;
              candidate=next;
              const ratio=contrast(candidate,page);
              if(ratio>bestRatio){best=candidate;bestRatio=ratio}
            }
          });
          surface=best;
        }
      }
    }
    const safeForeground=(hex,bgs,min=4.5)=>{let c=validHex(hex)?hex:(light?"#111511":"#f7f8f5");if(bgs.every(bg=>contrast(c,bg)>=min))return c;const target=light?"black":"white";for(let i=1;i<=100;i++){const candidate=mix(c,target,i/100);if(bgs.every(bg=>contrast(candidate,bg)>=min))return candidate}return target==="black"?"#000000":"#ffffff"};
    const raised=light?mix(surface,"white",.42):mix(surface,"black",.35);
    const text=safeForeground(light?"#111511":"#f7f8f5",[page,surface,raised],4.5);
    const accent=safeForeground(theme.accent,[page,surface,raised],4.5);
    const muted=safeForeground(theme.muted,[page,surface,raised],4.5);
    const border=safeForeground(theme.border||accent,[page,surface,raised],3);
    const glow=safeForeground(theme.glow||accent,[page,surface,raised],3);
    const onAccent=contrast("#000000",accent)>=contrast("#ffffff",accent)?"#000000":"#ffffff";
    const palette={page,surface,text,muted,accent,border,glow};
    Object.entries(palette).forEach(([key,value])=>{
      const variable=key==="page"?"--theme-page":key==="surface"?"--theme-surface":key==="text"?"--theme-text":key==="muted"?"--theme-muted":key==="accent"?"--theme-accent":key==="border"?"--theme-border":"--theme-glow";
      html.style.setProperty(variable,value);
    });
    html.style.setProperty("--theme-raised",raised);
    html.style.setProperty("--theme-secondary",accent);
    html.style.setProperty("--theme-on-accent",onAccent);
    html.dataset.vhaMood="generated";
    html.style.colorScheme=light?"light":"dark";
    document.body.style.backgroundColor=page;
    document.body.style.color=text;
    let globalStyle=document.getElementById("vha-mood-global-overrides");
    if(!globalStyle){globalStyle=document.createElement("style");globalStyle.id="vha-mood-global-overrides";document.head.appendChild(globalStyle);}
    globalStyle.textContent=`html[data-vha-mood],html[data-vha-mood] body,html[data-vha-mood] body>*,html[data-vha-mood] body>div,html[data-vha-mood] #app,html[data-vha-mood] #root,html[data-vha-mood] main,html[data-vha-mood] .gd,html[data-vha-mood] .gd-main,html[data-vha-mood] .gd-shell,html[data-vha-mood] .gd-page,html[data-vha-mood] .posts-main,html[data-vha-mood] .posts-content,html[data-vha-mood] .posts-page,html[data-vha-mood] .song-page,html[data-vha-mood] .cv-page,html[data-vha-mood] .cv-shell,html[data-vha-mood] .page-shell,html[data-vha-mood] .site-shell,html[data-vha-mood] .hero,html[data-vha-mood] .gd-hero{background-color:var(--theme-page)!important;color:var(--theme-text)!important}html[data-vha-mood] header,html[data-vha-mood] footer,html[data-vha-mood] nav,html[data-vha-mood] section,html[data-vha-mood] article,html[data-vha-mood] aside:not(#vha-viewer-tools),html[data-vha-mood] .gd-nav,html[data-vha-mood] .gd-footer,html[data-vha-mood] .gd-panel,html[data-vha-mood] .gd-card,html[data-vha-mood] .gd-radio,html[data-vha-mood] .gd-move,html[data-vha-mood] .post-card,html[data-vha-mood] .posts-note,html[data-vha-mood] .posts-filters,html[data-vha-mood] .viewer-console,html[data-vha-mood] .song-panel,html[data-vha-mood] .song-player-card,html[data-vha-mood] .cv-card,html[data-vha-mood] .cv-section,html[data-vha-mood] .transmission-card{background-color:var(--theme-surface)!important;color:var(--theme-text)!important;border-color:var(--theme-border)!important}html[data-vha-mood] h1,html[data-vha-mood] h2,html[data-vha-mood] h3,html[data-vha-mood] p,html[data-vha-mood] li,html[data-vha-mood] label,html[data-vha-mood] .gd-brand strong,html[data-vha-mood] .gd-brand small{color:var(--theme-text)!important}html[data-vha-mood] a:not(.vha-tools-trigger),html[data-vha-mood] em,html[data-vha-mood] .gd-kicker,html[data-vha-mood] .gd-status,html[data-vha-mood] .post-category{color:var(--theme-accent)!important;border-color:var(--theme-border)!important}html[data-vha-mood] input,html[data-vha-mood] textarea,html[data-vha-mood] select,html[data-vha-mood] [contenteditable=true]{background:var(--theme-surface)!important;background-image:none!important;color:var(--theme-text)!important;border-color:var(--theme-border)!important}`;
    globalStyle.textContent+=`
      html[data-vha-mood] body *{text-shadow:none!important}\n      html[data-vha-mood] body :is(span,strong,b,small,div,section,article,aside,header,footer,nav,main,li,dt,dd,th,td,legend,summary,label){color:var(--theme-text)!important}\n      html[data-vha-mood] :is(button,[role="button"],input[type="button"],input[type="submit"],input[type="reset"]){color:var(--theme-text)!important;background-color:var(--theme-surface)!important;border:1px solid var(--theme-border)!important;text-shadow:none!important;opacity:1!important}
      html[data-vha-mood] :is(button,[role="button"],input[type="button"],input[type="submit"],input[type="reset"]):hover,html[data-vha-mood] :is(button,[role="button"],input[type="button"],input[type="submit"],input[type="reset"]):focus-visible{color:var(--theme-page)!important;background-color:var(--theme-accent)!important;border-color:var(--theme-accent)!important;outline:2px solid var(--theme-accent)!important;outline-offset:2px!important}
      html[data-vha-mood] :is(a,a:visited){color:var(--theme-accent)!important;text-decoration:underline!important;text-decoration-thickness:1px!important;text-underline-offset:3px!important}
      html[data-vha-mood] a:focus-visible{outline:2px solid var(--theme-accent)!important;outline-offset:3px!important}
      html[data-vha-mood] :is(table,thead,tbody,tfoot,tr,th,td){color:var(--theme-text)!important;border-color:var(--theme-border)!important}
      html[data-vha-mood] :is(table,thead,tbody,tfoot){background-color:var(--theme-surface)!important}
      html[data-vha-mood] th{background-color:var(--theme-page)!important;color:var(--theme-text)!important;font-weight:700!important}
      html[data-vha-mood] td{background-color:var(--theme-surface)!important}
      html[data-vha-mood] :is(svg,[class*="icon"],[class*="Icon"]){color:var(--theme-accent)}
      html[data-vha-mood] svg :is(path,line,polyline,polygon,circle,rect,ellipse){stroke:var(--theme-accent)}
      html[data-vha-mood] svg :is(path,polygon,circle,rect,ellipse)[fill]:not([fill="none"]){fill:var(--theme-accent)}
      html[data-vha-mood] :is(input,textarea,select,[contenteditable="true"]){color:var(--theme-text)!important;background-color:var(--theme-surface)!important;border-color:var(--theme-border)!important;caret-color:var(--theme-accent)!important}
      html[data-vha-mood] ::placeholder{color:var(--theme-muted)!important;opacity:1!important}
      html[data-vha-mood] :is(button,a,input,textarea,select,[tabindex]):focus-visible{outline:2px solid var(--theme-accent)!important;outline-offset:2px!important}
      html[data-vha-mood] :is(.vha-tool-icon,.vha-tool-row,.vha-tools-trigger,.ego-bottom-hud,.ego-bottom-hud button,.ego-bottom-hud a){color:var(--theme-accent)!important}\n      html[data-vha-mood] :is(.ego-bottom-hud,.ego-bottom-hud button,.ego-bottom-hud a) svg,html[data-vha-mood] :is(.ego-bottom-hud,.ego-bottom-hud button,.ego-bottom-hud a) svg *{color:var(--theme-accent)!important;stroke:var(--theme-accent)!important;fill:none!important}\n      html[data-vha-mood] :is(.ego-bottom-hud,.ego-bottom-hud button,.ego-bottom-hud a){background-color:var(--theme-surface)!important;border-color:var(--theme-border)!important}
      html[data-vha-mood] .vha-constellation-lines{opacity:1!important;filter:drop-shadow(0 0 2px color-mix(in srgb,var(--theme-accent) 35%,transparent))!important}
      html[data-vha-mood] .vha-constellation-lines path,html[data-vha-mood] .vha-constellation-route{stroke:var(--theme-accent)!important;stroke-opacity:1!important;stroke-width:1.8px!important;stroke-dasharray:3 5!important;filter:drop-shadow(0 0 2px color-mix(in srgb,var(--theme-accent) 45%,transparent))!important}
      html[data-vha-mood] .vha-map-node svg{stroke:var(--theme-accent)!important;filter:drop-shadow(0 0 5px color-mix(in srgb,var(--theme-accent) 55%,transparent))!important}
      html[data-vha-mood] .vha-star-tooltip{color:var(--theme-text)!important;background:color-mix(in srgb,var(--theme-surface) 88%,transparent)!important;text-shadow:none!important}\n      html[data-vha-mood] .ego-bottom-hud :is(button,a):hover,html[data-vha-mood] .ego-bottom-hud :is(button,a):focus-visible{background-color:var(--theme-accent)!important;color:var(--theme-on-accent)!important}
    `;
    globalStyle.textContent+="\n"+
      "html[data-vha-mood] body *{text-shadow:none!important}\n"+
      "html[data-vha-mood] body :is(h1,h2,h3,h4,h5,h6,p,li,dt,dd,blockquote,figcaption,label,legend,summary,small,strong,b,em,i,span,div,section,article,aside,header,footer,nav,main,th,td,caption){color:var(--theme-text)!important}\n"+
      "html[data-vha-mood] body :is(header,footer,nav,section,article,aside,main,form,fieldset,details,.gd-panel,.gd-card,.gd-radio,.gd-move,.post-card,.posts-note,.posts-filters,.viewer-console,.song-panel,.song-player-card,.cv-card,.cv-section,.transmission-card,.cv-wrap,.vha-journey-note,.vha-constellation-presets){background-color:var(--theme-surface)!important;color:var(--theme-text)!important;border-color:var(--theme-border)!important}\n"+
      "html[data-vha-mood] body :is(main,.gd-main,.gd-shell,.gd-page,.posts-main,.posts-content,.posts-page,.song-page,.cv-page,.cv-shell,.page-shell,.site-shell){background-color:var(--theme-page)!important}\n"+
      "html[data-vha-mood] :is(button,[role=button],input[type=button],input[type=submit],input[type=reset],.vha-constellation-presets button){background:var(--theme-surface)!important;color:var(--theme-text)!important;border:1px solid var(--theme-border)!important;opacity:1!important}\n"+
      "html[data-vha-mood] :is(button,[role=button],input[type=button],input[type=submit],input[type=reset],.vha-constellation-presets button):hover,html[data-vha-mood] :is(button,[role=button],input[type=button],input[type=submit],input[type=reset],.vha-constellation-presets button):focus-visible{background:var(--theme-accent)!important;color:var(--theme-on-accent)!important;border-color:var(--theme-accent)!important}\n"+
      "html[data-vha-mood] :is(a,a:visited){color:var(--theme-accent)!important;text-decoration-color:var(--theme-accent)!important}\n"+
      "html[data-vha-mood] :is(input,textarea,select,[contenteditable=true]){background:var(--theme-surface)!important;color:var(--theme-text)!important;border-color:var(--theme-border)!important}\n"+
      "html[data-vha-mood] :is(table,thead,tbody,tfoot,tr,th,td){background-color:var(--theme-surface)!important;color:var(--theme-text)!important;border-color:var(--theme-border)!important}\n"+
      "html[data-vha-mood] th{background-color:var(--theme-raised)!important}\n"+
      "html[data-vha-mood] .vha-tool-row,html[data-vha-mood] .vha-tool-icon{color:var(--theme-text)!important}\n"+
      "html[data-vha-mood] .vha-tool-icon svg,html[data-vha-mood] .vha-tools-trigger svg{stroke:var(--theme-accent)!important;fill:none!important}\n"+
      "html[data-vha-mood] .vha-constellation-lines path,html[data-vha-mood] .vha-constellation-route{stroke:var(--theme-accent)!important;stroke-opacity:1!important;stroke-width:2px!important}\n"+
      "html[data-vha-mood] .vha-star-tooltip{color:var(--theme-text)!important;background:var(--theme-surface)!important}\n"+
      "html[data-vha-mood] .vha-mood-box,html[data-vha-mood] .vha-mood-box *{color:var(--theme-text)!important}\n"+
      "html[data-vha-mood] .vha-mood-box button[data-tool=apply-mood]{background:var(--theme-accent)!important;color:var(--theme-on-accent)!important}\n"+
      "html[data-vha-mood] :is(small,figcaption,caption,time,.muted,.text-muted,[data-muted=true],.vha-mood-status,#vha-presentation-hint){color:var(--theme-muted)!important}";
    globalStyle.textContent += "\n" + [
      "html[data-vha-mood] body,html[data-vha-mood] body>*,html[data-vha-mood] #app,html[data-vha-mood] #root,html[data-vha-mood] main,html[data-vha-mood] .gd,html[data-vha-mood] .gd-main,html[data-vha-mood] .gd-shell,html[data-vha-mood] .gd-page,html[data-vha-mood] .posts-main,html[data-vha-mood] .posts-content,html[data-vha-mood] .posts-page,html[data-vha-mood] .song-page,html[data-vha-mood] .cv-page,html[data-vha-mood] .cv-shell,html[data-vha-mood] .page-shell,html[data-vha-mood] .site-shell,html[data-vha-mood] .hero,html[data-vha-mood] .gd-hero,html[data-vha-mood] .posts-hero,html[data-vha-mood] .cv-hero{background-image:none!important}",
      "html[data-vha-mood] body :is(header,footer,nav,section,article,aside,form,fieldset,details,.gd-nav,.gd-footer,.gd-panel,.gd-card,.gd-radio,.gd-move,.post-card,.posts-note,.posts-filters,.viewer-console,.song-panel,.song-player-card,.cv-card,.cv-section,.cv-wrap,.cv-hero,.transmission-card,.transmit-panel,.vha-journey-note,.vha-constellation-presets,.vha-mood-box,.vha-star-tooltip){background-image:none!important}",
      "html[data-vha-mood] body.vha-crystal-open #vha-world-map{background:var(--theme-page)!important;background-image:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}",
      "html[data-vha-mood] .vha-map-node{opacity:1!important}",
      "html[data-vha-mood] .vha-star-tooltip{opacity:1!important;animation:none!important;transition:none!important;background:var(--theme-surface)!important;color:var(--theme-text)!important;text-shadow:none!important}",
      "html[data-vha-mood] body :is(.gd-move,.gd-hero,.posts-hero,.cv-hero,.hero,.post-card,.transmit-panel)::before,html[data-vha-mood] body :is(.gd-move,.gd-hero,.posts-hero,.cv-hero,.hero,.post-card,.transmit-panel)::after{background-image:none!important}",
      "html[data-vha-mood] .cv-hero::after{color:var(--theme-muted)!important;opacity:1!important;text-shadow:none!important}",
      "html[data-vha-mood] body a:not(.vha-map-node):not([class*=\"button\"]):not([class*=\"btn\"]):not([class*=\"cta\"]):not([class*=\"primary\"]):not([role=\"button\"]){background-color:transparent!important;background-image:none!important}",
      "html[data-vha-mood] body a:not(.vha-map-node):not([class*=\"button\"]):not([class*=\"btn\"]):not([class*=\"cta\"]):not([class*=\"primary\"]):not([role=\"button\"]):hover,html[data-vha-mood] body a:not(.vha-map-node):not([class*=\"button\"]):not([class*=\"btn\"]):not([class*=\"cta\"]):not([class*=\"primary\"]):not([role=\"button\"]):focus-visible{background-color:transparent!important;background-image:none!important;color:var(--theme-accent)!important;text-decoration:underline!important}",
      "html[data-vha-mood] body :is(a[class*=\"button\"],a[class*=\"btn\"],a[class*=\"cta\"],a[class*=\"primary\"],a[role=\"button\"]):not([class*=\"secondary\"]){background:var(--theme-accent)!important;background-image:none!important;color:var(--theme-on-accent)!important;border-color:var(--theme-accent)!important;text-decoration:none!important}",
      "html[data-vha-mood] body :is(a[class*=\"button\"],a[class*=\"btn\"],a[class*=\"cta\"],a[class*=\"primary\"],a[role=\"button\"]):not([class*=\"secondary\"]) *{color:var(--theme-on-accent)!important}",
      "html[data-vha-mood] body :is(a[class*=\"button\"],a[class*=\"btn\"],a[class*=\"cta\"],a[class*=\"primary\"],a[role=\"button\"]):not([class*=\"secondary\"]) svg :is(path,line,polyline,polygon,circle,rect,ellipse){stroke:var(--theme-on-accent)!important}",
      "html[data-vha-mood] body :is(a[class*=\"button\"],a[class*=\"btn\"],a[class*=\"cta\"],a[class*=\"primary\"],a[role=\"button\"]):not([class*=\"secondary\"]) svg :is(path,polygon,circle,rect,ellipse)[fill]:not([fill=\"none\"]){fill:var(--theme-on-accent)!important}",
      "html[data-vha-mood] body :is(button,[role=\"button\"],input[type=\"button\"],input[type=\"submit\"],input[type=\"reset\"]):is(:hover,:focus-visible) *{color:var(--theme-on-accent)!important}",
      "html[data-vha-mood] body :is(button,[role=\"button\"],input[type=\"button\"],input[type=\"submit\"],input[type=\"reset\"]):is(:hover,:focus-visible) svg :is(path,line,polyline,polygon,circle,rect,ellipse){stroke:var(--theme-on-accent)!important}",
      "html[data-vha-mood] body :is(button,[role=\"button\"],input[type=\"button\"],input[type=\"submit\"],input[type=\"reset\"]):is(:hover,:focus-visible) svg :is(path,polygon,circle,rect,ellipse)[fill]:not([fill=\"none\"]){fill:var(--theme-on-accent)!important}",
      "html[data-vha-mood] #vha-viewer-tools :is(button,[role=\"button\"],input[type=\"button\"],input[type=\"submit\"],input[type=\"reset\"]):is(:hover,:focus-visible) *{color:var(--theme-on-accent)!important}",
      "html[data-vha-mood] #vha-viewer-tools :is(button,[role=\"button\"],input[type=\"button\"],input[type=\"submit\"],input[type=\"reset\"]):is(:hover,:focus-visible) svg :is(path,line,polyline,polygon,circle,rect,ellipse){stroke:var(--theme-on-accent)!important}",
      "html[data-vha-mood] #vha-viewer-tools :is(button,[role=\"button\"],input[type=\"button\"],input[type=\"submit\"],input[type=\"reset\"]):is(:hover,:focus-visible) svg :is(path,polygon,circle,rect,ellipse)[fill]:not([fill=\"none\"]){fill:var(--theme-on-accent)!important}"
    ].join("\n");
    const font=key=>moodFontStacks[key]||moodFontStacks.sans;
    const radius=Math.min(28,Math.max(0,Number(theme.radius)||0));
    const shadow=Math.min(.45,Math.max(0,Number(theme.shadow)||0));
    let moodStyle=document.getElementById("vha-mood-profile");
    if(!moodStyle){moodStyle=document.createElement("style");moodStyle.id="vha-mood-profile";document.head.appendChild(moodStyle);}
    moodStyle.textContent=`html[data-vha-mood]{--vha-mood-radius:${radius}px;--vha-mood-shadow:0 8px ${12+Math.round(shadow*56)}px rgba(0,0,0,${shadow});--vha-mood-line:${theme.lineHeight};--vha-mood-spacing:${theme.letterSpacing}em;--vha-mood-font:${font(theme.bodyFont)};--vha-mood-display-font:${font(theme.displayFont)};--vha-mood-gap:${theme.gap}px;--vha-mood-panel-padding:${theme.padding}px}
      html[data-vha-mood] body,html[data-vha-mood] body *{font-family:var(--vha-mood-font)!important}
      html[data-vha-mood] :is(h1,h2,h3,h4,h5,h6,.gd-hero h1,.gd-section h2,.gd-listening h2,.cv-name,.cv-section h2,.post-title,.posts-title){font-family:var(--vha-mood-display-font)!important}
      html[data-vha-mood] :is(.gd-movements,.gd-lower,.gd-listening,.cv-columns,.cv-skills,.gd-cvgrid,.posts-grid,#posts-list,.gd-section-head){gap:var(--vha-mood-gap)!important}
      html[data-vha-mood] :is(.gd-panel,.cv-hero,.cv-contact-panel){padding:var(--vha-mood-panel-padding)!important}
      html[data-vha-mood] .gd-panel,html[data-vha-mood] .gd-card,html[data-vha-mood] .gd-radio,html[data-vha-mood] .gd-move,html[data-vha-mood] .post-card,html[data-vha-mood] .posts-note,html[data-vha-mood] .posts-filters,html[data-vha-mood] .viewer-console,html[data-vha-mood] .song-panel,html[data-vha-mood] .song-player-card,html[data-vha-mood] .cv-card,html[data-vha-mood] .cv-section,html[data-vha-mood] .transmission-card,html[data-vha-mood] .cv-wrap{border-radius:var(--vha-mood-radius)!important;box-shadow:var(--vha-mood-shadow)!important;transition:border-radius .35s ease,box-shadow .35s ease,background-color .35s ease}
      html[data-vha-mood] p,html[data-vha-mood] li,html[data-vha-mood] .post-excerpt,html[data-vha-mood] .gd-copy{line-height:var(--vha-mood-line)!important;letter-spacing:var(--vha-mood-spacing)}`;
    try{localStorage.setItem("vha-mood-ai-theme-v1",JSON.stringify(theme));}catch{}
  }
  function resetMoodTheme(){
    const html=document.documentElement;
    ["--theme-page","--theme-surface","--theme-raised","--theme-text","--theme-muted","--theme-accent","--theme-secondary","--theme-border","--theme-glow"].forEach(k=>html.style.removeProperty(k));
    delete html.dataset.vhaMood;
    html.style.removeProperty("color-scheme");
    document.body.style.removeProperty("background-color");
    document.body.style.removeProperty("color");
    document.getElementById("vha-mood-global-overrides")?.remove();
    document.getElementById("vha-mood-profile")?.remove();
    document.getElementById("vha-mood-fonts")?.remove();
    try{localStorage.removeItem("vha-mood-ai-theme-v1");localStorage.removeItem("vha-mood-palette");}catch{}
  }
  function restoreMoodTheme(){
    try{
      const theme=JSON.parse(localStorage.getItem("vha-mood-ai-theme-v1")||"null");
      if(theme&&/^#[0-9a-f]{6}$/i.test(theme.page||"")&&/^#[0-9a-f]{6}$/i.test(theme.surface||"")&&/^#[0-9a-f]{6}$/i.test(theme.text||"")&&/^#[0-9a-f]{6}$/i.test(theme.accent||""))setMoodTheme(theme);
    }catch{}
  }
  async function generateMoodPrompt(emotion){
    const status=root.querySelector(".vha-mood-status");
    const promptButton=root.querySelector('[data-tool="generate-prompt"]');
    const description=root.querySelector("#vha-mood-description");
    if(!emotion){status.textContent="Choose an emotion first, then generate a prompt.";return}
    if(promptButton){promptButton.disabled=true;promptButton.textContent="Composing…";}
    status.textContent="Finding words for this feeling…";
    try{
      const response=await fetch("https://ego-mood-ai.stefancu-emanuel.workers.dev",{
        method:"POST",
        headers:{"Content-Type":"text/plain;charset=UTF-8"},
        body:JSON.stringify({mode:"prompt",emotion})
      });
      const result=await response.json().catch(()=>({}));
      if(!response.ok||!result.ok||!result.prompt)throw new Error(result.error||"The AI could not compose a prompt just now.");
      description.value=result.prompt;
      description.focus();
      status.textContent="A new prompt for "+emotion+". Edit it, add to it, or make it your own.";
    }catch(error){
      status.textContent=error instanceof Error?error.message:"The AI could not compose a prompt just now. Please try again.";
    }finally{
      if(promptButton){promptButton.disabled=false;promptButton.textContent="Generate another prompt";}
    }
  }
  async function generateMoodTheme(value){
    const input=String(value||"").trim();
    const status=root.querySelector(".vha-mood-status");
    if(input.length<3){status.textContent="Write a little more about what is going on for you.";return}
    const applyButton=root.querySelector('[data-tool="apply-mood"]');
    if(applyButton){applyButton.disabled=true;applyButton.textContent="Generating…";}
    status.textContent="Reading your words and composing a new visual atmosphere…";
    try{
      const response=await fetch("https://ego-mood-ai.stefancu-emanuel.workers.dev",{
        method:"POST",
        headers:{"Content-Type":"text/plain;charset=UTF-8"},
        body:JSON.stringify({description:input})
      });
      const result=await response.json().catch(()=>({}));
      if(!response.ok||!result.ok||!result.theme)throw new Error(result.error||"The AI service could not complete the request.");
      setMoodTheme(result.theme);
      status.textContent="Generated for: "+result.theme.mood+". "+result.theme.interpretation;
    }catch(error){
      status.textContent=error instanceof Error?error.message:"The AI could not generate a theme just now. Please try again.";
    }finally{
      if(applyButton){applyButton.disabled=false;applyButton.textContent="Generate a visual response";}
    }
  }
  restoreMoodTheme();
  const trigger = root.querySelector(".vha-tools-trigger");
  const panel = root.querySelector(".vha-tools-panel");

  document.addEventListener("click",async event=>{
    const button=event.target.closest('#vha-viewer-tools [data-tool]');
    if(!button)return;
    const tool=button.dataset.tool;
    if(tool==="mood"){
      const open=root.dataset.moodOpen!=="true";
      root.dataset.moodOpen=String(open);
      button.setAttribute("aria-expanded",String(open));
      const description=root.querySelector("#vha-mood-description");
      if(open)requestAnimationFrame(()=>description?.focus());
    }else if(tool==="generate-prompt"){
      await generateMoodPrompt(root.querySelector("#vha-mood-emotion")?.value);
    }else if(tool==="apply-mood"){
      await generateMoodTheme(root.querySelector("#vha-mood-description")?.value);
    }else if(tool==="reset-mood"){
      resetMoodTheme();
      root.querySelector("#vha-mood-description").value="";
      root.querySelector(".vha-mood-status").textContent="Default website theme restored across the website.";
    }
  });
  window.VHACrystal?.registerTool({id:"mood",label:"MATCH MY MOOD",description:"Generate and apply a visual atmosphere across the website.",presentation:"panel",run:()=>document.querySelector('[data-tool="mood"]')?.click()});
})();