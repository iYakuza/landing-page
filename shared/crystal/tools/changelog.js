/* Standalone Latest Changelog tool for Crystal mode. */
(() => {
  if (!window.VHACrystal || document.querySelector(".vha-changelog-panel")) return;
  // Changelog is an independent Crystal tool, isolated from the viewer shell.
  const changelogEntries = [
    { timestamp: "2026-11-06T19:19:13Z", type: "FEATURE", title: "Introduced the Latest Changelog", detail: "Added a Crystal panel that records recent site updates with precise timestamps, change categories, concise explanations and a character quote." },

    { timestamp: "2026-11-06T19:12:33Z", type: "FIX", title: "Removed the obsolete Star Patterns popup", detail: "Kept pattern selection in the Crystal dock dropdown instead of maintaining a duplicate popup." },
    { timestamp: "2026-11-06T19:12:21Z", type: "IMPROVEMENT", title: "Connected the Star Patterns dropdown", detail: "Selecting a pattern now applies its constellation arrangement immediately." },
    { timestamp: "2026-11-06T19:12:06Z", type: "IMPROVEMENT", title: "Replaced the Star Patterns button", detail: "Introduced a native dropdown with ten selectable constellation layouts." },
    { timestamp: "2026-11-06T19:05:22Z", type: "FEATURE", title: "Added Creator Workshop as a standalone star", detail: "Made the private Creator Workshop destination visible in the constellation without connecting it to the other stars." }
  ];
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
  changelogPanel.innerHTML='<header class="vha-changelog-header"><div><span class="vha-changelog-kicker">CRYSTAL DEVELOPMENT LOG</span><h2 id="vha-changelog-title">Latest Changelog</h2></div><button type="button" class="vha-changelog-close" aria-label="Close changelog">×</button></header><div class="vha-changelog-list"></div><footer class="vha-changelog-quote"><blockquote>“Goodbye, V, and never stop fighting.”</blockquote><span>— Johnny Silverhand</span></footer>';
  document.body.appendChild(changelogPanel);
  const changelogList=changelogPanel.querySelector(".vha-changelog-list");
  const dateFormatter=new Intl.DateTimeFormat("en-GB",{day:"2-digit",month:"short",year:"numeric",timeZone:"Europe/Rome"});
  const timeFormatter=new Intl.DateTimeFormat("en-GB",{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false,timeZone:"Europe/Rome"});
  changelogEntries.forEach(entry=>{
    const date=new Date(entry.timestamp);
    const item=document.createElement("article");
    item.className="vha-changelog-entry";
    const meta=document.createElement("div");meta.className="vha-changelog-meta";
    const stamp=document.createElement("time");stamp.dateTime=entry.timestamp;
    stamp.textContent=dateFormatter.format(date)+" · "+timeFormatter.format(date);
    const type=document.createElement("span");type.className="vha-changelog-type is-"+entry.type.toLowerCase();type.textContent=entry.type;
    meta.append(stamp,type);
    const title=document.createElement("h3");title.textContent=entry.title;
    const detail=document.createElement("p");detail.textContent=entry.detail;
    item.append(meta,title,detail);changelogList.appendChild(item);
  });
  function setChangelogOpen(open){
    changelogPanel.hidden=!open;
    changelogButton.setAttribute("aria-expanded",String(open));
    changelogButton.classList.toggle("is-active",open);
  }
  changelogButton.addEventListener("click",()=>setChangelogOpen(changelogPanel.hidden));
  changelogPanel.querySelector(".vha-changelog-close").addEventListener("click",()=>setChangelogOpen(false));
  document.addEventListener("keydown",event=>{if(event.key==="Escape"&&!changelogPanel.hidden)setChangelogOpen(false)});
  const changelogStyle=document.createElement("style");
  changelogStyle.id="vha-changelog-style";
  changelogStyle.textContent=`
    .vha-changelog-panel{position:fixed;left:50%;bottom:104px;transform:translateX(-50%);z-index:2147483647;width:min(520px,calc(100vw - 28px));max-height:min(68vh,620px);overflow:auto;padding:18px 20px 16px;border:1px solid rgba(174,199,157,.28);border-radius:15px;background:rgba(5,12,8,.96);color:#e4eddf;box-shadow:0 18px 60px rgba(0,0,0,.55);-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px);font-family:ui-monospace,SFMono-Regular,Consolas,monospace}
    .vha-changelog-panel[hidden]{display:none!important}
    .vha-changelog-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding-bottom:13px;border-bottom:1px solid rgba(174,199,157,.2)}
    .vha-changelog-kicker{font-size:8px;letter-spacing:.18em;color:#a9c28e}
    .vha-changelog-header h2{margin:5px 0 0;font:500 20px/1.2 Georgia,serif;color:#e8f1df}
    .vha-changelog-close{width:28px;height:28px;border:1px solid rgba(174,199,157,.28);border-radius:8px;background:transparent;color:#dce8d5;font-size:20px;cursor:pointer}
    .vha-changelog-entry{padding:13px 0;border-bottom:1px solid rgba(174,199,157,.13)}
    .vha-changelog-meta{display:flex;align-items:center;justify-content:space-between;gap:8px;color:#9cab99;font-size:9px;letter-spacing:.035em}
    .vha-changelog-type{padding:3px 6px;border:1px solid rgba(174,199,157,.24);border-radius:4px;font-size:8px;letter-spacing:.1em;color:#c5d6b6}
    .vha-changelog-type.is-feature{color:#d7e8a9;border-color:rgba(195,220,135,.4)}
    .vha-changelog-type.is-improvement{color:#a9d2c2;border-color:rgba(139,194,169,.35)}
    .vha-changelog-type.is-fix{color:#d6c39a;border-color:rgba(214,195,154,.35)}
    .vha-changelog-entry h3{margin:7px 0 4px;font:600 12px/1.4 Arial,sans-serif;color:#e4eddf}
    .vha-changelog-entry p{margin:0;color:#aebbad;font:11px/1.55 Arial,sans-serif}
    .vha-changelog-quote{padding-top:14px;text-align:right}
    .vha-changelog-quote blockquote{margin:0;color:#c9d8b9;font:italic 14px/1.45 Georgia,serif}
    .vha-changelog-quote span{display:block;margin-top:5px;color:#8fa18b;font-size:9px;letter-spacing:.08em}
    @media(max-width:600px){.vha-changelog-panel{bottom:76px;padding:14px 15px;max-height:70vh}.vha-changelog-header h2{font-size:18px}.vha-changelog-meta{font-size:8px}}
  `;
  document.head.appendChild(changelogStyle);


  // The blur layer is a sibling backdrop, never an ancestor of this tool.
  const blurLayer=document.getElementById("vha-crystal-blur-layer");
  if(blurLayer){
    blurLayer.style.setProperty("z-index","2147483000","important");
    blurLayer.style.setProperty("pointer-events","none","important");
  }
  changelogPanel.style.setProperty("z-index","2147483647","important");
  changelogPanel.style.setProperty("position","fixed","important");
  changelogPanel.style.setProperty("isolation","isolate","important");
  document.body.appendChild(changelogPanel);
  window.VHACrystal.registerTool({
    id:"latest-changelog",
    label:"LATEST CHANGELOG",
    description:"View the latest timestamped Crystal development updates.",
    presentation:"dock",
    run:()=>setChangelogOpen(changelogPanel.hidden)
  });
})();
