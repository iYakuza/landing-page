/* Star Patterns — preset picker, constellation layouts and persistence. */
(() => {
  const patterns = {
    "orion": [[25,24],[33,35],[42,47],[50,39],[58,47],[67,35],[75,24],[50,15],[39,15],[61,15],[30,62],[70,62]],
    "ursa-major": [[20,29],[30,23],[41,27],[52,35],[63,43],[72,55],[80,68],[61,64],[48,55],[36,49],[25,44],[19,58]],
    "cassiopeia": [[20,38],[31,23],[43,41],[56,22],[69,40],[77,56],[65,68],[51,57],[38,71],[24,59],[44,14],[61,73]],
    "cygnus": [[50,10],[50,24],[50,40],[50,57],[50,72],[34,30],[66,30],[25,20],[75,20],[37,49],[63,49],[50,88]],
    "scorpius": [[25,15],[36,21],[47,32],[57,45],[64,58],[61,70],[51,76],[73,69],[78,56],[74,42],[65,30],[48,14]],
    "hello-smile": [[50,12],[30,30],[70,30],[24,50],[76,50],[31,69],[40,79],[50,83],[60,79],[69,69],[40,48],[60,48]],
    "heart-signal": [[50,82],[30,64],[18,43],[19,27],[32,17],[45,25],[50,36],[55,25],[68,17],[81,27],[82,43],[70,64]],
    "north-star": [[50,8],[56,35],[84,35],[62,52],[70,82],[50,65],[30,82],[38,52],[16,35],[44,35],[50,8],[50,92]],
    "after-hours": [[50,10],[36,20],[27,36],[25,54],[34,71],[50,83],[43,65],[42,49],[46,33],[56,20],[68,16],[78,22]],
    "waveform": [[8,50],[16,50],[24,50],[32,50],[40,50],[48,50],[56,50],[64,50],[72,50],[80,50],[88,50],[96,50]]
  };
  function applyPattern(patternName) {
    const map = document.getElementById("vha-world-map");
    const pattern = patterns[patternName];
    const nodes = [...(map?.querySelectorAll(".vha-map-node") || [])].filter(node => node.dataset.node !== "creator");
    if (!map || !pattern || !nodes.length) return;
    const saved = map.vhaConstellation?.getSavedPositions?.() || {};
    nodes.forEach((node, index) => {
      const [x, y] = pattern[index % pattern.length];
      node.style.setProperty("--star-x", x + "%");
      node.style.setProperty("--star-y", y + "%");
      node.style.setProperty("left", x + "%", "important");
      node.style.setProperty("top", y + "%", "important");
      saved[node.dataset.node] = { x, y };
    });
    try { localStorage.setItem(map.vhaConstellation?.storageKey || "stars-v2", JSON.stringify(saved)); } catch {}
    const creator = map.querySelector('.vha-map-node[data-node="creator"]');
    if (creator) {
      creator.style.setProperty("--star-x", "88%");
      creator.style.setProperty("--star-y", "18%");
      creator.style.setProperty("left", "88%", "important");
      creator.style.setProperty("top", "18%", "important");
      saved.creator = { x: 88, y: 18 };
      try { localStorage.setItem(map.vhaConstellation?.storageKey || "stars-v2", JSON.stringify(saved)); } catch {}
    }
    const picker = document.querySelector(".vha-constellation-presets");
    const select = picker?.querySelector(".vha-patterns-select");
    if (select) select.value = patternName;
    map.vhaConstellation?.updateRoute?.();
    map.dataset.activeConstellation = patternName;
  }
  function positionPickerAboveButton(){
    const button=document.querySelector('#vha-viewer-tools [data-tool="patterns"]');
    const picker=document.querySelector(".vha-constellation-presets");
    if(!button||!picker||picker.getAttribute("aria-hidden")==="true")return;
    if(picker.parentElement!==document.body)document.body.appendChild(picker);
    const anchor=button.getBoundingClientRect();
    const width=Math.min(240,innerWidth-20);
    picker.style.setProperty("box-sizing","border-box","important");
    picker.style.setProperty("width",width+"px","important");
    picker.style.setProperty("max-width","calc(100vw - 20px)","important");
    picker.style.setProperty("max-height","min(58vh,440px)","important");
    picker.style.setProperty("position","fixed","important");
    picker.style.setProperty("display","block","important");
    picker.style.setProperty("visibility","visible","important");
    picker.style.setProperty("opacity","1","important");
    picker.style.setProperty("z-index","2147483647","important");
    picker.style.setProperty("transform","none","important");
    picker.style.setProperty("bottom","auto","important");
    picker.style.setProperty("right","auto","important");
    picker.style.setProperty("left","0px","important");
    picker.style.setProperty("top","0px","important");
    const height=picker.getBoundingClientRect().height||360;
    const available=Math.max(100,anchor.top-14);
    picker.style.setProperty("max-height",Math.min(available,innerHeight*.58,440)+"px","important");
    const measuredHeight=picker.getBoundingClientRect().height||Math.min(height,available);
    const left=Math.max(10,Math.min(innerWidth-width-10,anchor.left+anchor.width/2-width/2));
    const top=Math.max(8,anchor.top-measuredHeight-10);
    picker.style.setProperty("left",left+"px","important");
    picker.style.setProperty("top",top+"px","important");
  }
  function setPickerOpen(open){
    placePickerInBody();
    const map=document.getElementById("vha-world-map");
    const picker=document.querySelector(".vha-constellation-presets");
    const trigger=document.querySelector('#vha-viewer-tools [data-tool="patterns"]');
    if(!picker||!trigger)return;
    if(map)map.dataset.patternsOpen=String(open);
    document.body.classList.toggle("vha-patterns-open",open);
    trigger.setAttribute("aria-expanded",String(open));
    picker.setAttribute("aria-hidden",String(!open));
    picker.style.setProperty("display",open?"block":"none","important");
    picker.style.setProperty("visibility",open?"visible":"hidden","important");
    picker.style.setProperty("opacity",open?"1":"0","important");
    picker.style.setProperty("z-index","2147483647","important");
    picker.style.setProperty("filter","none","important");
    picker.style.setProperty("-webkit-filter","none","important");
    picker.style.setProperty("pointer-events",open?"auto":"none","important");
    if(open){requestAnimationFrame(()=>requestAnimationFrame(positionPickerAboveButton));}
  }
  function placePickerInBody(){
    const picker=document.querySelector(".vha-constellation-presets");
    // Like V/A Radio, this is an independent floating panel attached to body.
    // Never nest it inside the blur layer: backdrop-filter creates its own stacking context.
    if(picker&&document.body&&picker.parentElement!==document.body)document.body.appendChild(picker);
  }
  function bindPicker(){
    placePickerInBody();
    const map=document.getElementById("vha-world-map");
    if(!map||map.dataset.starPatternsBound==="true")return;
    map.dataset.starPatternsBound="true";
    const minimize = document.querySelector(".vha-patterns-minimize");
    if (minimize && !minimize.dataset.bound) {
      minimize.dataset.bound = "true";
      minimize.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        setPickerOpen(false);
      });
    }
    const select = document.querySelector(".vha-patterns-select");
    if (select && !select.dataset.bound) {
      select.dataset.bound = "true";
      select.addEventListener("change", event => {
        event.stopPropagation();
        if (select.value) applyPattern(select.value);
      });
    }
    // The trigger is dynamically moved into the Crystal dock. Bind it at document
    // capture level so no dock handler or detached-map event can swallow the click.
    if(!document.documentElement.dataset.vhaPatternsClickBound){
      document.documentElement.dataset.vhaPatternsClickBound="true";
      document.addEventListener("click",event=>{
        const trigger=event.target.closest('#vha-viewer-tools [data-tool="patterns"]');
        if(!trigger)return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const expanded=trigger.getAttribute("aria-expanded")==="true";
        setPickerOpen(!expanded);
      },true);
    }
  }
  document.addEventListener("vha-constellation-ready",bindPicker);
  document.addEventListener("vha-crystal-ready",placePickerInBody);
  document.addEventListener("vha-crystal-state-change",placePickerInBody);
  window.addEventListener("resize",()=>{if(document.body.classList.contains("vha-patterns-open"))positionPickerAboveButton()});
  window.addEventListener("scroll",()=>{if(document.body.classList.contains("vha-patterns-open"))positionPickerAboveButton()},{passive:true});
  document.addEventListener("vha-crystal-mode-change",event=>{
    if(event.detail?.open)return;
    setPickerOpen(false);
  });
  bindPicker();
  window.VHACrystal?.registerTool({
    id: "star-patterns",
    label: "STAR PATTERNS",
    description: "Choose and save a constellation arrangement.",
    presentation: "panel",
    run: () => {
      placePickerInBody();
      const trigger=document.querySelector('#vha-viewer-tools [data-tool="patterns"]');
      if(trigger)trigger.click();
      else setPickerOpen(true);
    }
  });
})();