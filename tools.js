/* Verse After Hours — saved theme manager and same-origin theme receiver */
(() => {
  function applyTheme(theme) {
    if (!theme || !theme.colors || !theme.typography || !theme.layout || !theme.details) return;
    const c = theme.colors;
    for (const key of ["page","surface","raised","text","muted","accent","secondary","border","glow"]) {
      if (/^#[0-9a-f]{6}$/i.test(c[key] || "")) root.style.setProperty("--theme-" + key, c[key]);
    }
    const attrs = {
      "theme-heading": [theme.typography.heading, ["editorial","modern","mono","condensed","display"], "modern"],
      "theme-body": [theme.typography.body, ["editorial","modern","mono","humanist"], "modern"],
      "theme-scale": [theme.typography.scale, ["compact","balanced","expressive"], "balanced"],
      "theme-weight": [theme.typography.weight, ["light","regular","bold","black"], "bold"],
      "theme-density": [theme.layout.density, ["airy","balanced","dense"], "balanced"],
      "theme-columns": [theme.layout.columns, ["one","two","mosaic","masonry"], "mosaic"],
      "theme-card": [theme.layout.card, ["glass","paper","brutalist","pixel","soft","editorial"], "editorial"],
      "theme-geometry": [theme.layout.geometry, ["square","rounded","cut-corner","organic","stacked"], "cut-corner"],
      "theme-hero": [theme.layout.hero, ["minimal","editorial","immersive","grid","poster"], "poster"],
      "theme-pattern": [theme.details.pattern, ["none","grid","grain","botanical","scanlines","blueprint","paper"], "grid"],
      "theme-media": [theme.details.media, ["clean","film","framed","glow","polaroid"], "framed"],
      "theme-buttons": [theme.details.buttons, ["minimal","outlined","solid","pill","mechanical"], "mechanical"],
      "theme-motion": [theme.details.motion, ["none","subtle","energetic"], "subtle"],
      "theme-shadows": [theme.details.shadows, ["flat","soft","hard","glow"], "glow"],
      "theme-nav": [theme.details.nav, ["minimal","boxed","underline","terminal"], "terminal"]
    };
    for (const [name, [value, allowed, fallback]] of Object.entries(attrs)) root.dataset[name] = allowed.includes(value) ? value : fallback;
    root.dataset.viewerTheme = "custom";
    try { localStorage.setItem("vha-ai-theme", JSON.stringify(theme)); } catch {}
    const colors = {page:c.page,surface:c.surface,raised:c.raised,text:c.text,muted:c.muted,accent:c.accent,secondary:c.secondary,border:c.border,glow:c.glow};
    try { localStorage.setItem("vha-global-theme", JSON.stringify({theme,colors})); } catch {}
  }
  window.addEventListener("message", e => {
    if (e.origin !== location.origin || e.data?.type !== "vha-theme-apply") return;
    applyTheme(e.data.theme);
  });
  try {
    const saved = JSON.parse(localStorage.getItem("vha-global-theme") || "null");
    if (saved?.theme) applyTheme(saved.theme);
  } catch {}
})();

/* Floating Viewer Tools HUD — draggable, compact, and theme-aware. */
(() => {
  if (document.getElementById("vha-viewer-tools")) return;
  const style = document.createElement("style");
  style.id = "vha-viewer-tools-style";
  style.textContent = `
    #vha-viewer-tools{position:fixed;right:18px;bottom:18px;z-index:2147483008;font-family:var(--vha-font,Arial,Helvetica,sans-serif);font-size:11px;line-height:1.25;color:var(--theme-accent,#d8ff3e);touch-action:pan-y}
    #vha-viewer-tools *{box-sizing:border-box}
    #vha-viewer-tools .vha-tools-trigger{position:relative;z-index:2;display:grid;place-items:center;width:52px;height:52px;border:1px solid var(--theme-accent,#d8ff3e);border-radius:50%;background:var(--theme-surface,#080e09);color:var(--theme-accent,#d8ff3e);box-shadow:0 0 0 4px color-mix(in srgb,var(--theme-accent,#d8ff3e) 9%,transparent),0 3px 18px #0008;cursor:grab;touch-action:none;user-select:none;transition:background .15s,box-shadow .15s}
    #vha-viewer-tools .vha-tools-trigger:active{cursor:grabbing}
    #vha-viewer-tools .vha-tools-trigger:hover,#vha-viewer-tools[data-open="true"] .vha-tools-trigger{background:var(--theme-raised,#101910);box-shadow:0 0 0 4px color-mix(in srgb,var(--theme-accent,#d8ff3e) 15%,transparent),0 3px 22px #0009}
    #vha-viewer-tools .vha-tools-trigger svg{width:25px;height:25px;stroke:#fff!important;fill:#fff!important;color:#fff!important}#vha-viewer-tools .vha-tools-trigger svg path{stroke:#fff!important;fill:#fff!important}
    #vha-viewer-tools .vha-tools-label{position:absolute;right:0;bottom:calc(100% + 8px);padding:5px 8px;border:1px solid var(--theme-border,var(--theme-accent,#d8ff3e));background:var(--theme-page,#050906);color:var(--theme-accent,#d8ff3e);font-size:9px;font-weight:700;letter-spacing:1px;white-space:nowrap;pointer-events:none;opacity:0;visibility:hidden;transition:opacity .12s,visibility .12s}
    #vha-viewer-tools .vha-tools-trigger:hover + .vha-tools-label{opacity:1;visibility:visible}
    #vha-viewer-tools .vha-tools-panel{position:absolute;right:calc(100% + 10px);bottom:0;width:164px;padding:7px;border:1px solid var(--theme-border,var(--theme-accent,#d8ff3e));background:color-mix(in srgb,var(--theme-surface,#080e09) 96%,transparent);color:var(--theme-text,#e8f4df);box-shadow:0 8px 26px #0009;backdrop-filter:blur(10px);display:grid;gap:3px;opacity:0;visibility:hidden;transform:translateX(5px);transition:opacity .16s,transform .16s,visibility .16s}
    #vha-viewer-tools[data-open="true"] .vha-tools-panel{opacity:1;visibility:visible;transform:translateX(0)}
    #vha-viewer-tools .vha-tool-row{display:flex;align-items:center;gap:9px;width:100%;min-height:34px;padding:3px 5px;border:0;background:transparent;color:var(--theme-text,#e8f4df);text-align:left;cursor:pointer;font:inherit}
    #vha-viewer-tools .vha-tool-row:hover,#vha-viewer-tools .vha-tool-row:focus-visible{color:var(--theme-accent,#d8ff3e);background:color-mix(in srgb,var(--theme-accent,#d8ff3e) 8%,transparent);outline:1px solid var(--theme-border,var(--theme-accent,#d8ff3e))}
    #vha-viewer-tools .vha-tool-icon{display:grid;place-items:center;flex:0 0 28px;width:28px;height:28px;border:1px solid var(--theme-border,var(--theme-accent,#d8ff3e));color:var(--theme-accent,#d8ff3e);background:var(--theme-page,#050906)}
    #vha-viewer-tools .vha-tool-icon svg{width:17px;height:17px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
    #vha-viewer-tools .vha-tool-row[aria-pressed="true"] .vha-tool-icon{border-color:var(--theme-accent,#d8ff3e)}
    #vha-viewer-tools .vha-mood-box{display:none;border-top:1px solid var(--theme-border,#d8ff3e35);margin-top:4px;padding:8px 3px 2px;gap:6px}
    #vha-viewer-tools[data-mood-open="true"] .vha-mood-box{display:grid}
    #vha-viewer-tools .vha-mood-box label{font-size:10px;color:var(--theme-accent,#d8ff3e)}
    #vha-viewer-tools .vha-mood-box textarea{width:100%;min-height:62px;resize:vertical;padding:7px;border:1px solid var(--theme-border,#d8ff3e35);background:var(--theme-page,#050906);color:var(--theme-text,#e8f4df);font:inherit;line-height:1.4}
    #vha-viewer-tools .vha-mood-box textarea:focus-visible{outline:1px solid var(--theme-accent,#d8ff3e)}
    #vha-viewer-tools .vha-mood-box button{padding:7px;border:1px solid var(--theme-accent,#d8ff3e);background:var(--theme-accent,#d8ff3e);color:var(--theme-page,#050906);font:inherit;font-weight:700;cursor:pointer}#vha-viewer-tools .vha-mood-presets{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px}#vha-viewer-tools .vha-mood-presets button{padding:6px 2px;background:transparent;color:var(--theme-text,#e8f4df);font-size:9px;text-transform:capitalize}#vha-viewer-tools .vha-mood-presets button:hover,#vha-viewer-tools .vha-mood-presets button:focus-visible{background:var(--theme-accent,#d8ff3e);color:var(--theme-page,#050906)}
    #vha-viewer-tools .vha-mood-status{font-size:9px;color:var(--theme-muted,#9aab9c);min-height:12px}
    #vha-viewer-tools .vha-tools-help{margin:3px 4px 1px;padding-top:6px;border-top:1px solid var(--theme-border,#d8ff3e35);color:var(--theme-muted,#9aab9c);font-size:8px;letter-spacing:.4px}
    #vha-presentation-bar{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:2147483007;display:none;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--theme-border,var(--theme-accent,#d8ff3e));background:color-mix(in srgb,var(--theme-surface,#080e09) 96%,transparent);color:var(--theme-text,#e8f4df);font:11px/1.2 Arial,Helvetica,sans-serif;box-shadow:0 8px 28px #0009;backdrop-filter:blur(12px);max-width:calc(100vw - 24px)}
    body.vha-presentation-active #vha-presentation-bar{display:flex}
    #vha-presentation-bar button{min-width:34px;min-height:32px;padding:5px 9px;border:1px solid var(--theme-border,var(--theme-accent,#d8ff3e));background:transparent;color:var(--theme-text,#e8f4df);font:inherit;cursor:pointer}
    #vha-presentation-bar button:hover,#vha-presentation-bar button:focus-visible{background:var(--theme-accent,#d8ff3e);color:var(--theme-page,#050906);outline:2px solid var(--theme-accent,#d8ff3e);outline-offset:2px}
    #vha-presentation-progress{min-width:100px;text-align:center;white-space:nowrap;color:var(--theme-accent,#d8ff3e);font:700 10px/1.2 ui-monospace,monospace;letter-spacing:.5px}
    #vha-presentation-hint{font-size:9px;color:var(--theme-muted,#9aab9c);white-space:nowrap}
    body.vha-presentation-active{scroll-behavior:auto}
    @media(max-width:600px){#vha-presentation-bar{bottom:10px;gap:5px;padding:6px}#vha-presentation-hint{display:none}#vha-presentation-progress{min-width:84px}}
    body.vha-tools-hide-ui header,body.vha-tools-hide-ui footer,body.vha-tools-hide-ui nav,body.vha-tools-hide-ui .gd-nav,body.vha-tools-hide-ui .gd-footer{opacity:0!important;pointer-events:none!important;transition:opacity .2s}
    body.vha-tools-hide-ui #vha-viewer-tools{opacity:1!important;pointer-events:auto!important}
    body.vha-tools-large-text main,body.vha-tools-large-text .gd{font-size:1.12em}
    @media(max-width:600px){#vha-viewer-tools{right:12px;bottom:12px}#vha-viewer-tools .vha-tools-trigger{width:46px;height:46px}#vha-viewer-tools .vha-tools-trigger svg{width:22px;height:22px}#vha-viewer-tools .vha-tools-panel{right:calc(100% + 8px);bottom:0;width:152px}#vha-viewer-tools .vha-tool-row{min-height:32px}#vha-viewer-tools .vha-tool-icon{width:26px;height:26px;flex-basis:26px}}
    @media(prefers-reduced-motion:reduce){#vha-viewer-tools *{transition:none!important}}
  `;
  document.head.appendChild(style);
  const icons = {
    mood:'<path d="M12 21s-8-4.4-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6.6-8 11-8 11Z"/><path d="M8.5 12.5c1.8 1.8 5.2 1.8 7 0"/>',
    tools:'<path d="M22.1 2.2a7.1 7.1 0 0 1-8.5 8.5L6.2 18.1a2.8 2.8 0 0 1-4-4l7.4-7.4a7.1 7.1 0 0 1 8.5-8.5l-4.2 4.2 3.8 3.8z"/>',
    fullscreen:'<path d="M8 3H3v5M3 3l7 7M16 3h5v5m0-5-7 7M3 16v5h5m-5 0 7-7m13 2v5h-5m5 0-7-7"/>',
    moon:'<path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z"/>',
    text:'<path d="M4 7V4h16v3M12 4v16M8 20h8"/>',
    ui:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    reset:'<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    help:'<circle cx="12" cy="12" r="9"/><path d="M9.6 9a2.5 2.5 0 1 1 4.2 1.8c-1.1 1-1.8 1.2-1.8 3M12 17h.01"/>'
  };
  const svg = name => '<svg viewBox="0 0 24 24" aria-hidden="true">'+icons[name]+'</svg>';
  const root = document.createElement("aside");
  root.id = "vha-viewer-tools";
  root.setAttribute("aria-label","Viewer tools");
  root.dataset.open = "false";
  root.innerHTML = '<button class="vha-tools-trigger" type="button" aria-label="Open viewer tools" aria-expanded="false" aria-controls="vha-tools-panel" title="Drag to move; click to open">'+svg("tools")+'</button><div class="vha-tools-label" aria-hidden="true">VIEWER TOOLS</div><div class="vha-tools-panel" id="vha-tools-panel" aria-label="Viewer tools menu"><button class="vha-tool-row" type="button" data-tool="fullscreen"><span class="vha-tool-icon">'+svg("fullscreen")+'</span><span>Fullscreen</span></button><button class="vha-tool-row" type="button" data-tool="dark" aria-pressed="false"><span class="vha-tool-icon">'+svg("moon")+'</span><span>Dark Mode</span></button><button class="vha-tool-row" type="button" data-tool="text" aria-pressed="false"><span class="vha-tool-icon">'+svg("text")+'</span><span>Text Size</span></button><button class="vha-tool-row" type="button" data-tool="ui" aria-pressed="false"><span class="vha-tool-icon">'+svg("ui")+'</span><span>UI Toggle</span></button><button class="vha-tool-row" type="button" data-tool="mood" aria-expanded="false"><span class="vha-tool-icon">'+svg("mood")+'</span><span>Match my mood</span></button><div class="vha-mood-box"><label for="vha-mood-description">How are you feeling right now?</label><textarea id="vha-mood-description" maxlength="500" placeholder="Describe it in your own words…"></textarea><div class="vha-mood-presets" aria-label="Choose a feeling"><button type="button" data-mood-preset="calm">Calm</button><button type="button" data-mood-preset="sad">Sad</button><button type="button" data-mood-preset="anxious">Anxious</button><button type="button" data-mood-preset="happy">Happy</button><button type="button" data-mood-preset="angry">Angry</button><button type="button" data-mood-preset="tired">Tired</button><button type="button" data-mood-preset="focused">Focused</button><button type="button" data-mood-preset="hopeful">Hopeful</button></div><button type="button" data-tool="apply-mood">Adapt the site</button><div class="vha-mood-status" role="status" aria-live="polite"></div></div><button class="vha-tool-row" type="button" data-tool="reset-mood"><span class="vha-tool-icon">'+svg("reset")+'</span><span>Reset mood theme</span></button><button class="vha-tool-row" type="button" data-tool="help"><span class="vha-tool-icon">'+svg("help")+'</span><span>Help</span></button><div class="vha-tools-help">VIEWER CONTROLS</div></div>';
  document.body.appendChild(root);

  // Fullscreen opens the project's editorial manuscript: a sequence of designed, navigable chapters.
  let presentationActive = false;
  let slideIndex = 0;
  const manuscriptSlides = [
    {chapter:"PROLOGUE · THE ARCHIVE",kicker:"VERSE AFTER HOURS / FIELD NOTES 001",title:"A BOOKLET<br>OF <em>WHAT REMAINS.</em>",body:"Not a product tour. Not a deck of talking points.<br>A manuscript assembled from the traces we leave behind.",note:"A living document about nature, humanity, memory, and the machine.",visual:"cosmos",mark:"∞"},
    {chapter:"I · BEFORE THE BEGINNING",kicker:"COSMOLOGY / DEEP TIME",title:"BEFORE THERE<br>WAS A <em>WITNESS.</em>",body:"There was no page to turn. No name for the dark. No eye to call the light beautiful.<br><br>Then the universe began to unfold: space, time, energy, matter. The first chapter was written without language, and nothing yet existed to read it.",note:"We begin at the edge of what we can know.",visual:"cosmos",mark:"01"},
    {chapter:"II · THE LONG MAKING",kicker:"MATTER / STARS / ELEMENTS",title:"STARDUST<br>LEARNED TO <em>GATHER.</em>",body:"Stars burned. Elements formed. Worlds cooled. Matter became mountain, ocean, atmosphere, seed.<br><br>The universe did not plan a witness, as far as we can tell. Yet, over immense stretches of time, complexity found ways to endure.",note:"The sacred can begin as wonder, without pretending certainty.",visual:"stars",mark:"02"},
    {chapter:"III · WHEN WATER WAS HERE",kicker:"EARTH / DEEP TIME",title:"WATER<br>REMEMBERS <em>THE WAY.</em>",body:"A river moves through stone. A sea retreats from a shore. Rain enters a crack and returns, season after season.<br><br>Water does not need to remember in order to leave evidence. The shape of the land becomes its testimony.",note:"Absence, too, can leave a record.",visual:"water",mark:"03"},
    {chapter:"IV · THE WORK OF TIME",kicker:"EROSION / PATIENCE WITHOUT INTENTION",title:"STONE BECOMES<br>A <em>GRAIN.</em>",body:"The cliff is worn down. The boulder becomes a pebble. The pebble becomes sand.<br><br>One day, what remains of the mountain may fit between two fingers. Not because the mountain never existed, but because time kept working on it.",note:"Nothing is unchanged by contact. Nothing lasts in the same form.",visual:"stone",mark:"04"},
    {chapter:"V · THE RELICS",kicker:"ARCHAEOLOGY OF THE PRESENT",title:"A GRAIN OF SAND<br>IS A <em>RELIC.</em>",body:"Hold it close enough and it becomes a landscape of its own: fragments of stone, the memory of pressure, the evidence of a world that was here.<br><br>Our messages, photographs, poems, code, and small acts are grains, too. They are not the whole story. They are what the story leaves in our hands.",note:"This website is an archive in motion: not the past itself, but traces that help us approach it.",visual:"sand",mark:"05"},
    {chapter:"VI · THE FIRST WITNESSES",kicker:"LIFE / ATTENTION / MEANING",title:"THE WORLD<br>BEGAN TO <em>LOOK BACK.</em>",body:"Life emerged, changed, and diversified. Eventually, creatures could sense their surroundings; some could remember, learn, cooperate, mourn.<br><br>Human beings began to tell stories about the sky above them and the ground beneath them. We made rituals around birth, death, fire, water, and the unknown.",note:"Meaning is one of the ways we carry what we cannot keep.",visual:"human",mark:"06"},
    {chapter:"VII · THE HOLY QUESTION",kicker:"NATURE · GOD · HUMANITY",title:"WHAT DO WE CALL<br>THE <em>SACRED?</em>",body:"A god. A law of nature. The breath of a forest. The silence before an answer. The fragile fact that anything exists at all.<br><br>We do not have to agree on the name to recognise the responsibility: to approach what we do not fully understand with humility, and to protect what can be harmed.",note:"Let the machine serve life. Let life remember what is sacred.",visual:"sacred",mark:"✧"},
    {chapter:"VIII · THE HUMAN MIRROR",kicker:"FEAR / KNOWLEDGE / SELF-KNOWLEDGE",title:"WE FEAR WHAT<br>WE DON'T WANT <em>TO KNOW.</em>",body:"Sometimes we avoid a truth because knowing it would ask something of us. We hide from questions that might change the way we see ourselves.<br><br>But fear is not always inward. We can also fear the people who build, own, and govern powerful technologies. Their incentives and decisions deserve scrutiny, transparency, and accountability.",note:"Look inward without looking away from power.",visual:"mirror",mark:"08"},
    {chapter:"IX · THE MACHINE",kicker:"TOOLS / INTELLIGENCE / RESPONSIBILITY",title:"A NEW MIRROR.<br>AN OLD <em>QUESTION.</em>",body:"AI is made by people, shaped by data, design, incentives, and decisions. It can help us make, discover, and reconsider. It can also mislead, reproduce harm, and concentrate power.<br><br>Do not worship it. Do not dismiss it without looking. Use it, question it, test it, and ask who is accountable for what it does.",note:"Trust without surrender. Skepticism without shutting the door.",visual:"machine",mark:"09"},
    {chapter:"X · ITERATION",kicker:"A HUMAN AND A TOOL, BUILDING",title:"WE BUILD FROM<br>WHAT CAME <em>BEFORE.</em>",body:"An idea becomes a first attempt. The attempt reveals a gap. The gap becomes a question. The next version carries the trace of every version before it.<br><br>That is how this project is being built: conversation, experiment, error, repair, and another beginning. Not a single perfect act, but a chain of attempts to understand.",note:"The process is part of the artifact.",visual:"iteration",mark:"10"},
    {chapter:"XI · GREEN DREAM",kicker:"A SMALL ISLAND IN THE NOISE",title:"WE PUSH.<br>WE FALL.<br>WE <em>BEGIN AGAIN.</em>",body:"Green Dream is a place to pause inside the noise: a meeting point for poetry, sound, nature, technology, and the unfinished work of being human.<br><br>The site will change. Some things will disappear. Some traces will remain. This booklet is not a final verdict; it is a record of what we are trying to understand right now.",note:"The radio plays on.",visual:"green",mark:"11"},
    {chapter:"EPILOGUE · THE GRAIN",kicker:"END OF THIS PASS / NOT THE END",title:"THE WATER IS GONE.<br>THE GRAIN <em>REMAINS.</em>",body:"Perhaps the grain will return to the sea. Perhaps it will become part of another stone, another shore, another story.<br><br>We are temporary witnesses in a universe that began long before us and will continue beyond us. What we make matters—not because it lasts forever, but because it touches what comes next.",note:"Leave a trace worth finding. Then let it go.",visual:"sand",mark:"∞"}
  ];
  const manuscriptStyle = document.createElement("style");
  manuscriptStyle.id = "vha-manuscript-style";
  manuscriptStyle.textContent = "\n#vha-manuscript{position:fixed;inset:0;z-index:2147483006;display:none;overflow:hidden;background:#080b09;color:#e8e6d8;font-family:Georgia,'Times New Roman',serif}\n#vha-manuscript[aria-hidden=\"false\"]{display:block}#vha-manuscript *{box-sizing:border-box}\n#vha-manuscript .vm-noise{position:absolute;inset:0;pointer-events:none;opacity:.12;background-image:radial-gradient(#e8e6d8 0.5px,transparent .8px);background-size:5px 5px}\n#vha-manuscript .vm-top{position:absolute;z-index:5;top:0;left:0;right:0;display:flex;justify-content:space-between;gap:12px;padding:20px 4vw;border-bottom:1px solid #e8e6d81c;color:#a7ad9c;font:10px/1.3 ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase}\n#vha-manuscript .vm-brand{color:#d8ff8a}\n#vha-manuscript .vm-stage{position:absolute;inset:0;display:grid;grid-template-columns:minmax(0,1.05fr) minmax(260px,.95fr);align-items:center;gap:4vw;padding:100px 9vw;opacity:0;transform:translateX(24px);transition:opacity .3s ease,transform .3s ease;pointer-events:none}\n#vha-manuscript .vm-stage.vm-active{opacity:1;transform:translateX(0);pointer-events:auto}\n#vha-manuscript .vm-copy{position:relative;z-index:2;max-width:760px}\n#vha-manuscript .vm-kicker{margin:0 0 22px;color:#d8ff8a;font:10px/1.5 ui-monospace,monospace;letter-spacing:.16em;text-transform:uppercase}\n#vha-manuscript .vm-chapter{margin:0 0 18px;color:#8f9b8c;font:10px/1.5 ui-monospace,monospace;letter-spacing:.13em;text-transform:uppercase}\n#vha-manuscript .vm-title{margin:0 0 25px;font-size:clamp(36px,6.3vw,92px);font-weight:400;line-height:.91;letter-spacing:-.065em;text-wrap:balance}\n#vha-manuscript .vm-title em{color:#d8ff8a;font-weight:400}\n#vha-manuscript .vm-body{max-width:650px;color:#d0d3c8;font-size:clamp(15px,1.35vw,20px);line-height:1.7}\n#vha-manuscript .vm-note{margin-top:25px;padding-top:13px;border-top:1px solid #d8ff8a4d;color:#aeb99e;font-size:13px;font-style:italic;line-height:1.6}\n#vha-manuscript .vm-art{position:relative;min-height:min(56vh,570px);height:100%;display:grid;place-items:center;overflow:hidden;isolation:isolate}\n#vha-manuscript .vm-orb{position:relative;width:min(34vw,410px);aspect-ratio:1;border-radius:50%;background:radial-gradient(circle at 35% 30%,#e6e5ce 0%,#9fae95 3%,#384c3a 13%,#101a18 38%,#060908 68%);box-shadow:inset -35px -25px 70px #000c,0 0 100px #a6cb6c15}\n#vha-manuscript .vm-orb:before{content:\"\";position:absolute;inset:-15%;border:1px solid #d8ff8a38;border-radius:50%;transform:rotate(-25deg) scaleY(.3)}\n#vha-manuscript .vm-orb:after{content:\"\";position:absolute;inset:12%;border:1px solid #e8e6d81c;border-radius:50%;transform:rotate(45deg) scaleY(.28)}\n#vha-manuscript .vm-mark{position:absolute;z-index:2;color:#e8e6d8;font-size:clamp(100px,19vw,260px);font-weight:400;line-height:1;opacity:.75;text-shadow:0 0 50px #d8ff8a12}\n#vha-manuscript [data-visual=\"water\"] .vm-orb{border-radius:48% 52% 62% 38%;background:radial-gradient(ellipse at 30% 25%,#8caa9b,#294c4b 20%,#0d2424 55%,#060a09 72%);transform:rotate(-18deg) scaleY(.75)}\n#vha-manuscript [data-visual=\"stone\"] .vm-orb,#vha-manuscript [data-visual=\"sand\"] .vm-orb{width:min(28vw,320px);border-radius:42% 58% 54% 46%;background:radial-gradient(circle at 30% 25%,#c2bda0,#706e58 17%,#34392f 45%,#0a0c09 72%);transform:rotate(23deg) scaleY(.72)}\n#vha-manuscript [data-visual=\"sand\"] .vm-orb{width:min(14vw,170px);background:radial-gradient(circle at 30% 25%,#e4d7a7,#9b8b5e 35%,#393426 75%)}\n#vha-manuscript [data-visual=\"sacred\"] .vm-orb,#vha-manuscript [data-visual=\"green\"] .vm-orb{background:radial-gradient(circle at 50% 50%,#d8ff8a 0%,#667c43 3%,#182419 15%,#050806 60%);box-shadow:0 0 100px #d8ff8a18}\n#vha-manuscript [data-visual=\"machine\"] .vm-orb{border-radius:4px;background:repeating-linear-gradient(0deg,#0a100b 0 10px,#253622 11px 12px),repeating-linear-gradient(90deg,transparent 0 20px,#d8ff8a26 21px 22px)}\n#vha-manuscript [data-visual=\"iteration\"] .vm-orb{background:repeating-radial-gradient(circle at 50% 50%,#0a100b 0 18px,#35482e 19px 20px,#0a100b 21px 34px)}\n#vha-manuscript .vm-bottom{position:absolute;z-index:6;bottom:0;left:0;right:0;display:flex;align-items:center;gap:14px;padding:18px 4vw;border-top:1px solid #e8e6d81c;background:#080b09e8}\n#vha-manuscript .vm-progress-track{height:2px;flex:1;background:#ffffff1b}#vha-manuscript .vm-progress-fill{height:100%;width:0;background:#d8ff8a;transition:width .25s}\n#vha-manuscript .vm-counter{min-width:85px;color:#d8ff8a;font:10px ui-monospace,monospace;letter-spacing:.1em}\n#vha-manuscript .vm-bottom button{width:38px;height:36px;border:1px solid #d8ff8a55;background:transparent;color:#e8e6d8;font-size:18px;cursor:pointer}\n#vha-manuscript .vm-bottom button:hover,#vha-manuscript .vm-bottom button:focus-visible{background:#d8ff8a;color:#080b09;outline:2px solid #d8ff8a;outline-offset:2px}\n#vha-manuscript .vm-exit{margin-left:8px!important;font:10px ui-monospace,monospace!important;width:auto!important;padding:0 12px}\n@media(max-width:760px){#vha-manuscript .vm-top{padding:14px 5vw;font-size:8px}#vha-manuscript .vm-stage{grid-template-columns:1fr;grid-template-rows:minmax(0,1fr) 90px;gap:0;padding:76px 7vw 80px;overflow-y:auto;align-content:center}#vha-manuscript .vm-title{font-size:clamp(34px,10vw,64px);margin-bottom:16px}#vha-manuscript .vm-body{font-size:14px;line-height:1.55}#vha-manuscript .vm-note{margin-top:14px;font-size:12px}#vha-manuscript .vm-art{min-height:90px;height:90px}#vha-manuscript .vm-orb{width:90px}#vha-manuscript .vm-mark{font-size:90px}#vha-manuscript .vm-bottom{padding:10px 5vw;gap:8px}#vha-manuscript .vm-counter{min-width:70px;font-size:9px}#vha-manuscript .vm-bottom button{width:34px;height:32px}#vha-manuscript .vm-exit{padding:0 8px!important;margin-left:0!important}}\n@media(max-height:650px) and (min-width:761px){#vha-manuscript .vm-stage{padding-top:72px;padding-bottom:66px}#vha-manuscript .vm-title{font-size:clamp(32px,5vw,64px)}#vha-manuscript .vm-body{font-size:14px;line-height:1.5}#vha-manuscript .vm-art{min-height:250px}}\n@media(prefers-reduced-motion:reduce){#vha-manuscript *{transition:none!important}}\n";
  document.head.appendChild(manuscriptStyle);
  const manuscript = document.createElement("section");
  manuscript.id = "vha-manuscript";
  manuscript.setAttribute("aria-hidden","true");
  manuscript.setAttribute("aria-label","Verse After Hours project manuscript");
  manuscript.innerHTML = '<div class="vm-noise" aria-hidden="true"></div><header class="vm-top"><span class="vm-brand">V/A · VERSE AFTER HOURS</span><span>THE LIVING MANUSCRIPT / 2026</span></header><div class="vm-slides"></div><footer class="vm-bottom"><button type="button" data-vm="prev" aria-label="Previous chapter" title="Previous chapter">←</button><div class="vm-progress-track"><div class="vm-progress-fill"></div></div><span class="vm-counter" aria-live="polite">01 / 13</span><button type="button" data-vm="next" aria-label="Next chapter" title="Next chapter">→</button><button type="button" class="vm-exit" data-vm="exit">CLOSE ✕</button></footer>';
  document.body.appendChild(manuscript);
  const slideContainer = manuscript.querySelector(".vm-slides");
  manuscriptSlides.forEach((slide,index) => {
    const section = document.createElement("article");
    section.className = "vm-stage" + (index===0?" vm-active":"");
    section.setAttribute("aria-label",slide.chapter);
    section.innerHTML = '<div class="vm-copy"><p class="vm-kicker">'+slide.kicker+'</p><p class="vm-chapter">'+slide.chapter+'</p><h1 class="vm-title">'+slide.title+'</h1><div class="vm-body">'+slide.body+'</div><p class="vm-note">'+slide.note+'</p></div><div class="vm-art" data-visual="'+slide.visual+'" aria-hidden="true"><div class="vm-orb"></div><span class="vm-mark">'+slide.mark+'</span></div>';
    slideContainer.appendChild(section);
  });
  const slideCounter=manuscript.querySelector(".vm-counter");
  const slideProgress=manuscript.querySelector(".vm-progress-fill");
  function showManuscriptSlide(next) {
    slideIndex=Math.max(0,Math.min(manuscriptSlides.length-1,next));
    slideContainer.querySelectorAll(".vm-stage").forEach((slide,i)=>slide.classList.toggle("vm-active",i===slideIndex));
    slideCounter.textContent=String(slideIndex+1).padStart(2,"0")+" / "+String(manuscriptSlides.length).padStart(2,"0");
    slideProgress.style.width=((slideIndex+1)/manuscriptSlides.length*100)+"%";
    manuscript.querySelector('[data-vm="prev"]').disabled=slideIndex===0;
    manuscript.querySelector('[data-vm="next"]').disabled=slideIndex===manuscriptSlides.length-1;
  }
  function startPresentation() {
    presentationActive=true;
    showManuscriptSlide(0);
    manuscript.setAttribute("aria-hidden","false");
    document.body.classList.add("vha-presentation-active");
  }
  function stopPresentation() {
    presentationActive=false;
    manuscript.setAttribute("aria-hidden","true");
    document.body.classList.remove("vha-presentation-active");
  }
  manuscript.querySelector('[data-vm="prev"]').addEventListener("click",()=>showManuscriptSlide(slideIndex-1));
  manuscript.querySelector('[data-vm="next"]').addEventListener("click",()=>showManuscriptSlide(slideIndex+1));
  manuscript.querySelector('[data-vm="exit"]').addEventListener("click",async()=>{
    stopPresentation();
    if(document.fullscreenElement){try{await document.exitFullscreen()}catch{}}
  });
  document.addEventListener("fullscreenchange",()=>{if(!document.fullscreenElement&&presentationActive)stopPresentation()});
  document.addEventListener("keydown",e=>{
    if(!presentationActive||e.altKey||e.ctrlKey||e.metaKey)return;
    if(e.target&&(e.target.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)))return;
    if(["ArrowRight","ArrowDown","PageDown"," "].includes(e.key)){e.preventDefault();showManuscriptSlide(slideIndex+1)}
    else if(["ArrowLeft","ArrowUp","PageUp","Backspace"].includes(e.key)){e.preventDefault();showManuscriptSlide(slideIndex-1)}
    else if(e.key==="Home"){e.preventDefault();showManuscriptSlide(0)}
    else if(e.key==="End"){e.preventDefault();showManuscriptSlide(manuscriptSlides.length-1)}
    else if(e.key==="Escape"&&!document.fullscreenElement){stopPresentation()}
  });
  function setMoodTheme(name,colors){
    const [page,surface,textColor,accent]=colors,html=document.documentElement;
    html.style.setProperty("--theme-page",page);html.style.setProperty("--theme-surface",surface);html.style.setProperty("--theme-raised",surface);html.style.setProperty("--theme-text",textColor);html.style.setProperty("--theme-muted",textColor+"b0");html.style.setProperty("--theme-accent",accent);html.style.setProperty("--theme-secondary",accent);html.style.setProperty("--theme-border",accent+"70");html.style.setProperty("--theme-glow",accent+"35");
    html.dataset.vhaMood=name;document.body.style.backgroundColor=page;document.body.style.color=textColor;
    let globalStyle=document.getElementById("vha-mood-global-overrides");
    if(!globalStyle){globalStyle=document.createElement("style");globalStyle.id="vha-mood-global-overrides";document.head.appendChild(globalStyle);}
    globalStyle.textContent=`html[data-vha-mood],html[data-vha-mood] body,html[data-vha-mood] body>*,html[data-vha-mood] body>div,html[data-vha-mood] #app,html[data-vha-mood] #root,html[data-vha-mood] main,html[data-vha-mood] .gd,html[data-vha-mood] .gd-main,html[data-vha-mood] .gd-shell,html[data-vha-mood] .gd-page,html[data-vha-mood] .posts-main,html[data-vha-mood] .posts-content,html[data-vha-mood] .posts-page,html[data-vha-mood] .song-page,html[data-vha-mood] .cv-page,html[data-vha-mood] .cv-shell,html[data-vha-mood] .page-shell,html[data-vha-mood] .site-shell,html[data-vha-mood] .hero,html[data-vha-mood] .gd-hero{background-color:var(--theme-page)!important;background-image:none!important;color:var(--theme-text)!important}html[data-vha-mood] header,html[data-vha-mood] footer,html[data-vha-mood] nav,html[data-vha-mood] section,html[data-vha-mood] article,html[data-vha-mood] aside:not(#vha-viewer-tools),html[data-vha-mood] .gd-nav,html[data-vha-mood] .gd-footer,html[data-vha-mood] .gd-panel,html[data-vha-mood] .gd-card,html[data-vha-mood] .gd-radio,html[data-vha-mood] .gd-move,html[data-vha-mood] .post-card,html[data-vha-mood] .posts-note,html[data-vha-mood] .posts-filters,html[data-vha-mood] .viewer-console,html[data-vha-mood] .song-panel,html[data-vha-mood] .song-player-card,html[data-vha-mood] .cv-card,html[data-vha-mood] .cv-section,html[data-vha-mood] .transmission-card{background-color:var(--theme-surface)!important;background-image:none!important;color:var(--theme-text)!important;border-color:var(--theme-border)!important}html[data-vha-mood] h1,html[data-vha-mood] h2,html[data-vha-mood] h3,html[data-vha-mood] p,html[data-vha-mood] li,html[data-vha-mood] label,html[data-vha-mood] .gd-brand strong,html[data-vha-mood] .gd-brand small{color:var(--theme-text)!important}html[data-vha-mood] a:not(.vha-tools-trigger),html[data-vha-mood] em,html[data-vha-mood] .gd-kicker,html[data-vha-mood] .gd-status,html[data-vha-mood] .post-category{color:var(--theme-accent)!important;border-color:var(--theme-border)!important}html[data-vha-mood] input,html[data-vha-mood] textarea,html[data-vha-mood] select,html[data-vha-mood] [contenteditable=true]{background:var(--theme-surface)!important;background-image:none!important;color:var(--theme-text)!important;border-color:var(--theme-border)!important}
/* Explicitly theme high-specificity components on the CV and shared navigation. */
html[data-vha-mood] .cv-wrap,html[data-vha-mood] .cv-hero,html[data-vha-mood] .cv-section,html[data-vha-mood] .cv-targets,html[data-vha-mood] .cv-floating-nav,html[data-vha-mood] .cv-floating-head,html[data-vha-mood] .cv-contact-panel,html[data-vha-mood] .cv-skills span,html[data-vha-mood] .cv-quicklinks,html[data-vha-mood] .cv-actions,html[data-vha-mood] .cv-actions a,html[data-vha-mood] .cv-actions button,html[data-vha-mood] .cv-floating-links button{background-color:var(--theme-surface)!important;background-image:none!important;color:var(--theme-text)!important;border-color:var(--theme-border)!important}
html[data-vha-mood] .vha-main-nav,html[data-vha-mood] .vha-main-nav>a,html[data-vha-mood] .vha-nav-dropdown,html[data-vha-mood] .vha-nav-dropdown>summary,html[data-vha-mood] .vha-nav-menu,html[data-vha-mood] .vha-nav-menu>a,html[data-vha-mood] .vha-community-button,html[data-vha-mood] .gd-nav,html[data-vha-mood] .gd-nav>a{background-color:var(--theme-surface)!important;background-image:none!important;color:var(--theme-text)!important;border-color:var(--theme-border)!important;box-shadow:none!important}
html[data-vha-mood] .vha-main-nav>a:hover,html[data-vha-mood] .vha-main-nav>a:focus-visible,html[data-vha-mood] .vha-nav-dropdown>summary:hover,html[data-vha-mood] .vha-nav-menu>a:hover,html[data-vha-mood] .vha-community-button:hover,html[data-vha-mood] .cv-floating-links button:hover,html[data-vha-mood] .cv-actions a:hover,html[data-vha-mood] .cv-actions button:hover{background-color:var(--theme-accent)!important;color:var(--theme-page)!important}
html[data-vha-mood] .cv-name span,html[data-vha-mood] .cv-kicker,html[data-vha-mood] .cv-role,html[data-vha-mood] .cv-floating-head strong,html[data-vha-mood] .cv-section h2 em{color:var(--theme-accent)!important}
html[data-vha-mood] .vha-main-nav .active,html[data-vha-mood] .vha-main-nav [aria-current=page]{border-color:var(--theme-accent)!important;color:var(--theme-accent)!important}`;
    try{localStorage.setItem("vha-mood-palette",JSON.stringify({name,colors}));}catch{}
  }
  function resetMoodTheme(){
    const html=document.documentElement;
    ["--theme-page","--theme-surface","--theme-raised","--theme-text","--theme-muted","--theme-accent","--theme-secondary","--theme-border","--theme-glow"].forEach(k=>html.style.removeProperty(k));
    delete html.dataset.vhaMood;document.body.style.removeProperty("background-color");document.body.style.removeProperty("color");document.getElementById("vha-mood-global-overrides")?.remove();
    try{localStorage.removeItem("vha-mood-palette");}catch{}
  }
  try{const saved=JSON.parse(localStorage.getItem("vha-mood-palette")||"null");if(saved?.name&&Array.isArray(saved.colors)&&saved.colors.length===4)setMoodTheme(saved.name,saved.colors);}catch{}
  const trigger = root.querySelector(".vha-tools-trigger");
  const setOpen = open => { root.dataset.open = String(open); trigger.setAttribute("aria-expanded",String(open)); trigger.setAttribute("aria-label",open?"Close viewer tools":"Open viewer tools"); };
  let dragging=false, moved=false, startX=0, startY=0, originX=0, originY=0;
  const clamp=(n,min,max)=>Math.min(Math.max(n,min),max);
  trigger.addEventListener("pointerdown",e=>{
    if(e.button!==0 && e.pointerType!=="touch") return;
    dragging=true;moved=false;startX=e.clientX;startY=e.clientY;
    const rect=root.getBoundingClientRect();originX=rect.left;originY=rect.top;
    trigger.setPointerCapture?.(e.pointerId);
  });
  trigger.addEventListener("pointermove",e=>{
    if(!dragging)return;
    const dx=e.clientX-startX,dy=e.clientY-startY;
    if(Math.abs(dx)>4||Math.abs(dy)>4)moved=true;
    if(!moved)return;
    const x=clamp(originX+dx,0,innerWidth-root.offsetWidth);
    const y=clamp(originY+dy,0,innerHeight-root.offsetHeight);
    root.style.left=x+"px";root.style.top=y+"px";root.style.right="auto";root.style.bottom="auto";root.style.transform="none";
    root.dataset.moved="true";
  });
  const finishDrag=()=>{if(!dragging)return;dragging=false;if(moved){setOpen(false);root.dataset.suppressClick="true";setTimeout(()=>delete root.dataset.suppressClick,0)}};
  trigger.addEventListener("pointerup",finishDrag);trigger.addEventListener("pointercancel",finishDrag);
  trigger.addEventListener("click",e=>{if(root.dataset.suppressClick==="true"){e.preventDefault();e.stopPropagation();return}setOpen(root.dataset.open!=="true")});
  document.addEventListener("keydown",e=>{if(e.key==="Escape")setOpen(false)});
  document.addEventListener("click",e=>{if(!root.contains(e.target))setOpen(false)});
  window.addEventListener("resize",()=>{if(root.dataset.moved==="true"){const rect=root.getBoundingClientRect();root.style.left=clamp(rect.left,0,innerWidth-root.offsetWidth)+"px";root.style.top=clamp(rect.top,0,innerHeight-root.offsetHeight)+"px"}});
  root.querySelectorAll("[data-mood-preset]").forEach(button=>button.addEventListener("click",()=>{const mood=button.dataset.moodPreset;const prompts={calm:"I feel calm and peaceful. Adapt the website to feel serene, spacious, and grounded.",sad:"I feel sad and a little low. Adapt the website to feel gentle, quiet, and comforting.",anxious:"I feel anxious and overwhelmed. Adapt the website to feel steady, soft, and low-stimulation.",happy:"I feel happy and upbeat. Adapt the website to feel warm, bright, and optimistic.",angry:"I feel angry or frustrated. Adapt the website to feel strong, grounded, and controlled.",tired:"I feel tired and drained. Adapt the website to feel restful, muted, and easy on the eyes.",focused:"I feel focused and ready to work. Adapt the website to feel clear, structured, and distraction-free.",hopeful:"I feel hopeful and inspired. Adapt the website to feel fresh, open, and uplifting."};const textarea=root.querySelector("#vha-mood-description");textarea.value=prompts[mood]||"";textarea.focus();root.querySelector(".vha-mood-status").textContent="Prompt ready. Choose Adapt the site to apply this feeling.";root.querySelectorAll("[data-mood-preset]").forEach(b=>b.setAttribute("aria-pressed",String(b===button)));}));
  // Scale actual text-bearing elements rather than only the main wrapper's inherited font size.
  // Many site components define their typography in pixels, so a parent font-size alone has no effect.
  const originalTextSizes = new Map();
  function setViewerTextSize(enabled) {
    if (enabled) {
      const candidates = [...document.body.querySelectorAll("*")].filter(el =>
        !el.closest("#vha-viewer-tools") &&
        [...el.childNodes].some(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim())
      );
      const sizes = candidates.map(el => ({el, size: parseFloat(getComputedStyle(el).fontSize)}))
        .filter(item => Number.isFinite(item.size));
      for (const {el, size} of sizes) {
        if (!originalTextSizes.has(el)) {
          originalTextSizes.set(el, {
            value: el.style.getPropertyValue("font-size"),
            priority: el.style.getPropertyPriority("font-size")
          });
        }
        el.style.setProperty("font-size", (size * 1.12) + "px", "important");
      }
    } else {
      for (const [el, original] of originalTextSizes) {
        if (!el.isConnected) continue;
        if (original.value) el.style.setProperty("font-size", original.value, original.priority);
        else el.style.removeProperty("font-size");
      }
      originalTextSizes.clear();
    }
    document.body.classList.toggle("vha-tools-large-text", enabled);
  }

  root.querySelectorAll("[data-tool]").forEach(button=>button.addEventListener("click",async()=>{
    const tool=button.dataset.tool;
    if(tool==="mood"){const open=root.dataset.moodOpen!=="true";root.dataset.moodOpen=String(open);button.setAttribute("aria-expanded",String(open));if(open)root.querySelector("#vha-mood-description").focus();return}
    if(tool==="apply-mood"){
      const input=root.querySelector("#vha-mood-description").value.trim();
      const status=root.querySelector(".vha-mood-status");
      if(!input){status.textContent="Tell me a little about how you feel first.";return}
      const t=input.toLowerCase();
      const moods=[
        {name:"calm",words:["calm","peaceful","relaxed","serene","grounded","at ease"],colors:["#07110f","#0b1b17","#b8d8c6","#83b9a0"]},
        {name:"sad",words:["sad","down","grief","grieving","lonely","heartbroken","blue","empty"],colors:["#0a0d18","#11182a","#d7deef","#9aaed0"]},
        {name:"anxious",words:["anxious","anxiety","worried","overwhelmed","stressed","panic","uneasy","nervous"],colors:["#111019","#1a1728","#e0d8f4","#b6a4e0"]},
        {name:"happy",words:["happy","joy","joyful","excited","great","delighted","content","cheerful"],colors:["#101007","#1b1a0b","#f5edbd","#e3d46a"]},
        {name:"angry",words:["angry","furious","mad","frustrated","irritated","rage"],colors:["#160b0b","#26100e","#f1d2c7","#ec8067"]},
        {name:"tired",words:["tired","exhausted","sleepy","drained","burnt out","burned out","fatigued"],colors:["#0d1013","#171d22","#d2dce0","#9eafb8"]},
        {name:"focused",words:["focused","productive","determined","motivated","ready to work","concentrate"],colors:["#080f12","#0d1b20","#d0e6e9","#72c4cc"]},
        {name:"hopeful",words:["hopeful","optimistic","inspired","curious","looking forward","encouraged"],colors:["#0b1008","#14200d","#e1efc8","#a8d66b"]}
      ];
      const match=moods.find(m=>m.words.some(word=>t.includes(word)));
      const palette=match||{name:"reflective",colors:["#050906","#080e09","#e8f4df","#d8ff3e"]};
      setMoodTheme(palette.name,palette.colors);
      status.textContent=match?"Theme adapted for a "+match+" mood across the website.":"Applied the default theme; no clear mood keyword was found.";
      return;
    }
    if(tool==="reset-mood"){
      resetMoodTheme();
      root.querySelector("#vha-mood-description").value="";
      root.querySelector(".vha-mood-status").textContent="Default website theme restored across the website.";return;
    }
    if(tool==="fullscreen"){try{if(!document.fullscreenElement){await document.documentElement.requestFullscreen();startPresentation()}else{stopPresentation();await document.exitFullscreen()}}catch{startPresentation();alert("Browser fullscreen is unavailable here. Presentation navigation is still active; use the arrows or Space to move through the page.")}}
    else if(tool==="dark"){const active=document.documentElement.dataset.vhaToolsDark!=="true";document.documentElement.dataset.vhaToolsDark=String(active);document.documentElement.style.setProperty("--theme-page",active?"#020406":"#050906");document.documentElement.style.setProperty("--theme-surface",active?"#03090b":"#080e09");button.setAttribute("aria-pressed",String(active))}
    else if(tool==="text"){const active=!document.body.classList.contains("vha-tools-large-text");setViewerTextSize(active);button.setAttribute("aria-pressed",String(active))}
    else if(tool==="ui"){const active=!document.body.classList.contains("vha-tools-hide-ui");document.body.classList.toggle("vha-tools-hide-ui",active);button.setAttribute("aria-pressed",String(active))}
    else if(tool==="help"){alert("VIEWER TOOLS\\n\\nDrag the floating icon to reposition it.\\nFullscreen: enter presentation mode. Use Right/Down, Page Down, or Space for the next screen; Left/Up or Page Up for the previous screen. Home and End jump to the beginning and end. Use the bottom controls to navigate or exit.\\nDark Mode: switch to a deeper dark palette.\\nText Size: enlarge page text.\\nUI Toggle: temporarily hide site navigation and footer.")}
  }));
})();
