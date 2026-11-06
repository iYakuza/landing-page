/* Standalone Latest Changelog tool for Crystal mode. */
(() => {
  if (!window.VHACrystal || document.querySelector(".vha-changelog-panel")) return;
  const root = window.VHACrystal.root;
  if (!root) throw new Error("Crystal viewer tools must be ready before Latest Changelog.");
  const changelogButton=document.createElement("button");
  changelogButton.type="button";
  changelogButton.className="vha-tool-row vha-changelog-trigger";
  changelogButton.dataset.tool="changelog";
  changelogButton.setAttribute("aria-expanded","false");
  changelogButton.innerHTML='<span class="vha-tool-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16M4 12h10M4 19h16"/><path d="m17 9 3 3-3 3"/></svg></span><span>Latest Changelog</span>';
  root.querySelector(".vha-tools-side.vha-tools-left")?.appendChild(changelogButton);

  const changelogPanel=document.createElement("section");
  changelogPanel.className="vha-changelog-panel";
  changelogPanel.hidden=true;
  changelogPanel.setAttribute("role","dialog");
  changelogPanel.setAttribute("aria-modal","false");
  changelogPanel.setAttribute("aria-labelledby","vha-changelog-title");
  changelogPanel.innerHTML='<header class="vha-changelog-header"><div><span class="vha-changelog-kicker">PROJECT ACTIVITY // LIVE FEED</span><h2 id="vha-changelog-title">Latest Changelog</h2><span class="vha-changelog-status" role="status" aria-live="polite">Connecting to the project log…</span></div><button type="button" class="vha-changelog-close" aria-label="Close changelog">×</button></header><div class="vha-changelog-list" aria-live="polite"></div><footer class="vha-changelog-quote"><blockquote>“Goodbye, V, and never stop fighting.”</blockquote><span>— Johnny Silverhand</span></footer>';
  document.body.appendChild(changelogPanel);
  const changelogList=changelogPanel.querySelector(".vha-changelog-list");
  const changelogStatus=changelogPanel.querySelector(".vha-changelog-status");
  const dateFormatter=new Intl.DateTimeFormat("en-GB",{day:"2-digit",month:"short",year:"numeric",timeZone:"Europe/Rome"});
  const timeFormatter=new Intl.DateTimeFormat("en-GB",{hour:"2-digit",minute:"2-digit",hour12:false,timeZone:"Europe/Rome"});
  let refreshTimer=null;
  let lastEntries=[];
  const feedUrl="/landing-page/changelog.json";

  function safeText(value,fallback){
    return typeof value==="string"&&value.trim()?value.trim():fallback;
  }
  function renderEntries(entries){
    changelogList.replaceChildren();
    entries.forEach(entry=>{
      const date=new Date(entry.timestamp);
      const item=document.createElement("article");
      item.className="vha-changelog-entry";
      const meta=document.createElement("div");
      meta.className="vha-changelog-meta";
      const stamp=document.createElement("time");
      stamp.dateTime=entry.timestamp||"";
      stamp.textContent=Number.isNaN(date.getTime())?"Recently":dateFormatter.format(date)+" · "+timeFormatter.format(date);
      const type=document.createElement("span");
      type.className="vha-changelog-type is-"+String(entry.category||"UPDATE").toLowerCase();
      type.textContent=safeText(entry.category,"UPDATE");
      meta.append(stamp,type);
      const component=document.createElement("span");
      component.className="vha-changelog-component";
      component.textContent=safeText(entry.component,"Project update");
      const title=document.createElement("h3");
      title.textContent=safeText(entry.title,"Project update");
      const detail=document.createElement("p");
      detail.className="vha-changelog-description";
      detail.textContent=safeText(entry.description,"A project update has been published.");
      item.append(meta,component,title,detail);

      const commits=Array.isArray(entry.commits)?entry.commits:[];
      if(commits.length){
        const disclosure=document.createElement("details");
        disclosure.className="vha-changelog-details";
        const summary=document.createElement("summary");
        summary.textContent="View technical details · "+commits.length+" "+(commits.length===1?"commit":"commits");
        const list=document.createElement("ul");
        commits.forEach(commit=>{
          const li=document.createElement("li");
          const link=document.createElement("a");
          link.href=commit.url;
          link.target="_blank";
          link.rel="noopener noreferrer";
          link.textContent=safeText(commit.message,"View source commit");
          li.appendChild(link);
          const files=Array.isArray(commit.files)?commit.files:[];
          if(files.length){
            const fileNote=document.createElement("span");
            fileNote.className="vha-changelog-files";
            fileNote.textContent=files.join(" · ");
            li.appendChild(fileNote);
          }
          list.appendChild(li);
        });
        disclosure.append(summary,list);
        item.appendChild(disclosure);
      }
      changelogList.appendChild(item);
    });
  }

  async function refreshChangelog(){
    try{
      const response=await fetch(feedUrl,{cache:"no-store"});
      if(!response.ok)throw new Error("Project log returned "+response.status);
      const data=await response.json();
      if(!data||!Array.isArray(data.entries))throw new Error("Project log format is invalid");
      lastEntries=data.entries;
      renderEntries(lastEntries);
      const updated=new Date(data.updated_at||"");
      changelogStatus.textContent="LIVE · "+lastEntries.length+" updates"+(Number.isNaN(updated.getTime())?"":" · refreshed "+timeFormatter.format(updated));
    }catch(error){
      console.warn("[Latest Changelog]",error);
      changelogStatus.textContent=lastEntries.length?"FEED TEMPORARILY UNAVAILABLE · showing saved updates":"Project updates are temporarily unavailable.";
      if(changelogList.childElementCount===0&&lastEntries.length)renderEntries(lastEntries);
    }
  }

  function setChangelogOpen(open){
    changelogPanel.hidden=!open;
    changelogButton.setAttribute("aria-expanded",String(open));
    changelogButton.classList.toggle("is-active",open);
    if(open){
      refreshChangelog();
      if(!refreshTimer)refreshTimer=setInterval(refreshChangelog,300000);
    }else if(refreshTimer){
      clearInterval(refreshTimer);
      refreshTimer=null;
    }
  }

  changelogButton.addEventListener("click",()=>setChangelogOpen(changelogPanel.hidden));
  changelogPanel.addEventListener("click",event=>event.stopPropagation());
  changelogPanel.querySelector(".vha-changelog-close").addEventListener("click",()=>setChangelogOpen(false));
  document.addEventListener("keydown",event=>{if(event.key==="Escape"&&!changelogPanel.hidden)setChangelogOpen(false)});

  const changelogStyle=document.createElement("style");
  changelogStyle.id="vha-changelog-style";
  changelogStyle.textContent=
    '.vha-changelog-panel{position:fixed;left:50%;bottom:104px;touch-action:pan-y;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;transform:translateX(-50%);z-index:2147483647;width:min(520px,calc(100vw - 28px));max-height:min(68vh,620px);overflow:auto;padding:18px 20px 16px;border:1px solid rgba(174,199,157,.28);border-radius:15px;background:rgba(5,12,8,.96);color:#e4eddf;box-shadow:0 18px 60px rgba(0,0,0,.55);-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px);font-family:ui-monospace,SFMono-Regular,Consolas,monospace}' +
    '.vha-changelog-panel[hidden]{display:none!important}.vha-changelog-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding-bottom:13px;border-bottom:1px solid rgba(174,199,157,.2)}' +
    '.vha-changelog-kicker{display:block;font-size:8px;letter-spacing:.18em;color:#a9c28e}.vha-changelog-header h2{margin:5px 0 0;font:500 20px/1.2 Georgia,serif;color:#e8f1df}' +
    '.vha-changelog-close{width:28px;height:28px;border:1px solid rgba(174,199,157,.28);border-radius:8px;background:transparent;color:#dce8d5;font-size:20px;cursor:pointer}.vha-changelog-status{display:block;margin-top:5px;color:#8fa18b;font-size:8px;letter-spacing:.08em}' +
    '.vha-changelog-entry{padding:13px 0;border-bottom:1px solid rgba(174,199,157,.13)}.vha-changelog-meta{display:flex;align-items:center;justify-content:space-between;gap:8px;color:#9cab99;font-size:9px;letter-spacing:.035em}' +
    '.vha-changelog-type{padding:3px 6px;border:1px solid rgba(174,199,157,.24);border-radius:4px;font-size:8px;letter-spacing:.1em;color:#c5d6b6}.vha-changelog-type.is-feature{color:#d7e8a9;border-color:rgba(195,220,135,.4)}' +
    '.vha-changelog-type.is-improvement{color:#a9d2c2;border-color:rgba(139,194,169,.35)}.vha-changelog-type.is-fix{color:#d6c39a;border-color:rgba(214,195,154,.35)}.vha-changelog-type.is-content{color:#c7b6df;border-color:rgba(190,166,220,.35)}' +
    '.vha-changelog-component{display:block;margin-top:8px;color:#9fbc86;font:8px/1.3 ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.13em;text-transform:uppercase}.vha-changelog-entry h3{margin:5px 0 5px;font:600 13px/1.4 Arial,sans-serif;color:#e4eddf}' +
    '.vha-changelog-description{margin:0;color:#aebbad;font:11px/1.6 Arial,sans-serif}.vha-changelog-details{margin-top:9px;color:#94a58f;font:9px/1.5 Arial,sans-serif}.vha-changelog-details summary{width:max-content;max-width:100%;cursor:pointer;color:#b6c9a7;letter-spacing:.025em}' +
    '.vha-changelog-details ul{display:grid;gap:7px;margin:8px 0 0;padding-left:17px}.vha-changelog-details a{color:#d2e2c1;text-decoration:underline;text-decoration-color:rgba(210,226,193,.35);text-underline-offset:3px}.vha-changelog-files{display:block;margin-top:2px;color:#738471;font:8px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace;overflow-wrap:anywhere}' +
    '.vha-changelog-quote{padding-top:14px;text-align:right}.vha-changelog-quote blockquote{margin:0;color:#c9d8b9;font:italic 14px/1.45 Georgia,serif}.vha-changelog-quote span{display:block;margin-top:5px;color:#8fa18b;font-size:9px;letter-spacing:.08em}' +
    '@media(max-width:600px){.vha-changelog-panel{bottom:76px;padding:14px 15px;max-height:70vh}.vha-changelog-header h2{font-size:18px}.vha-changelog-meta{font-size:8px}}';
  document.head.appendChild(changelogStyle);

  const blurLayer=document.getElementById("vha-crystal-blur-layer");
  if(blurLayer){
    blurLayer.style.setProperty("z-index","1000","important");
    blurLayer.style.setProperty("pointer-events","none","important");
  }
  changelogPanel.style.setProperty("z-index","2147483647","important");
  changelogPanel.style.setProperty("position","fixed","important");
  changelogPanel.style.setProperty("isolation","isolate","important");
  changelogPanel.style.setProperty("filter","none","important");
  changelogPanel.style.setProperty("-webkit-filter","none","important");
  changelogPanel.style.setProperty("opacity","1","important");
  changelogPanel.style.setProperty("visibility","visible","important");
  document.body.appendChild(changelogPanel);
  window.VHACrystal.registerTool({
    id:"latest-changelog",
    label:"LATEST CHANGELOG",
    description:"Explore clear, visitor-friendly updates and their underlying technical changes.",
    presentation:"dock",
    run:()=>setChangelogOpen(changelogPanel.hidden)
  });
})();