(() => {
  const dialog = document.getElementById("cv-contact-dialog");
  const form = document.getElementById("cv-contact-form");
  if (!dialog || !form) return;
  const openButton = document.querySelector(".cv-contact-open");
  const closeButton = dialog.querySelector(".cv-contact-close");
  const status = document.getElementById("cv-contact-status");
  const submit = form.querySelector('button[type="submit"]');
  const fileInput = document.getElementById("cv-contact-files");
  const endpoint = "https://oeyxsqocldlovhsmzcjw.supabase.co/functions/v1/contact-about-role";
  const allowed = new Set(["application/pdf","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document","text/plain","image/png","image/jpeg","application/vnd.ms-excel","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]);
  const embedded = window.parent !== window;
  const hostDoc = embedded ? window.parent.document : document;
  let previousFocus = null;
  const nav = document.getElementById("cv-floating-nav");
  if (nav) {
    const navStyle = hostDoc.createElement("style");
    navStyle.textContent = `
      .cv-floating-nav{position:fixed;left:18px;top:38%;z-index:2147482999;width:154px;background:rgba(5,9,6,.96);border:1px solid #b6e83388;box-shadow:0 12px 38px #0009;color:#e9f2e8;font:10px monospace;letter-spacing:.6px;box-sizing:border-box;backdrop-filter:blur(10px);touch-action:pan-y}
      .cv-floating-head{display:flex;align-items:center;gap:7px;padding:9px 8px;background:#101a11;border-bottom:1px solid #b6e83355;cursor:move;user-select:none;touch-action:none}
      .cv-floating-grip{color:#b6e833;font-size:15px;cursor:move}.cv-floating-head strong{flex:1;color:#b6e833;font-weight:normal;letter-spacing:1.4px}
      .cv-floating-collapse{width:22px;height:22px;padding:0;background:transparent;border:1px solid #b6e83366;color:#d8ff3e;font:16px monospace;cursor:pointer}
      .cv-floating-links{display:grid;gap:2px;padding:6px}
      .cv-floating-links button{display:block;width:100%;text-align:left;background:transparent;border:1px solid transparent;color:#c0cbbd;padding:8px 7px;font:9px monospace;letter-spacing:.5px;cursor:pointer}
      .cv-floating-links button:hover,.cv-floating-links button:focus-visible{color:#071007;background:#b6e833;border-color:#b6e833;outline:none}
      .cv-floating-nav.is-collapsed .cv-floating-links{display:none}
      @media(max-width:650px){.cv-floating-nav{left:8px;top:auto;bottom:12px;width:138px}.cv-floating-head{padding:7px}.cv-floating-links{padding:4px}.cv-floating-links button{padding:7px 6px}}
    `;
    hostDoc.head.appendChild(navStyle);
    hostDoc.body.appendChild(nav);
    const collapse = nav.querySelector(".cv-floating-collapse");
    collapse?.addEventListener("click", () => {
      const closed = nav.classList.toggle("is-collapsed");
      collapse.textContent = closed ? "+" : "−";
      collapse.setAttribute("aria-expanded", String(!closed));
      collapse.setAttribute("aria-label", closed ? "Expand navigation" : "Collapse navigation");
    });
    nav.querySelectorAll("[data-cv-target]").forEach(button => button.addEventListener("click", () => {
      const targetId = button.getAttribute("data-cv-target");
      const target = document.getElementById(targetId);
      if (target) {
        if (embedded) {
          const frame = hostDoc.querySelector('iframe.gd-cv-frame');
          const frameTop = frame ? frame.getBoundingClientRect().top + hostDoc.defaultView.scrollY : 0;
          const targetTop = frameTop + target.getBoundingClientRect().top;
          hostDoc.defaultView.scrollTo({top:Math.max(0,targetTop-18),behavior:"smooth"});
        } else {
          target.scrollIntoView({behavior:"smooth",block:"start"});
        }
      }
    }));
    const handle = nav.querySelector("#cv-floating-drag");
    let drag = null;
    handle?.addEventListener("pointerdown", event => {
      if (event.target.closest("button")) return;
      const rect = nav.getBoundingClientRect();
      drag = {x:event.clientX,y:event.clientY,left:rect.left,top:rect.top};
      nav.style.left = rect.left + "px";
      nav.style.top = rect.top + "px";
      nav.style.right = "auto";
      nav.style.bottom = "auto";
      handle.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    });
    handle?.addEventListener("pointermove", event => {
      if (!drag) return;
      const left = Math.max(0, Math.min(hostDoc.documentElement.clientWidth-nav.offsetWidth, drag.left+event.clientX-drag.x));
      const top = Math.max(0, Math.min(hostDoc.documentElement.clientHeight-nav.offsetHeight, drag.top+event.clientY-drag.y));
      nav.style.left = left + "px"; nav.style.top = top + "px";
    });
    const stopDrag = () => { drag = null; };
    handle?.addEventListener("pointerup",stopDrag);
    handle?.addEventListener("pointercancel",stopDrag);
  }

  // In the embedded CV, put the modal in the top-level page so fixed positioning
  // follows the actual browser viewport rather than the tall iframe document.
  if (embedded) {
    const modalStyle = hostDoc.createElement("style");
    modalStyle.textContent = `
      .cv-contact-dialog{position:fixed;inset:0;z-index:2147483000;display:none;align-items:center;justify-content:center;padding:12px;background:rgba(0,0,0,.78);backdrop-filter:blur(8px);box-sizing:border-box}
      .cv-contact-dialog.is-open{display:flex}
      .cv-contact-panel{position:relative;width:min(680px,100%);max-height:calc(100vh - 24px);overflow:auto;background:#081009;color:#e9f2e8;border:1px solid #b6e833;box-shadow:0 25px 90px #000b;padding:clamp(16px,2.4vw,26px);box-sizing:border-box}
      .cv-contact-panel h2{font-size:clamp(23px,3vw,32px);line-height:1;margin:4px 44px 8px 0;letter-spacing:-.04em}
      .cv-contact-panel h2 em{font-style:normal;color:#b6e833}
      .cv-contact-panel p{font-size:11px;line-height:1.5;color:#aebbad;margin:7px 0}
      .cv-contact-close{position:absolute;right:16px;top:16px;width:32px;height:32px;background:transparent;border:1px solid #b6e83366;color:#d8ff3e;font-size:24px;cursor:pointer}
      .cv-contact-form{display:grid;grid-template-columns:1fr 1fr;gap:10px 12px;margin-top:14px}
      .cv-contact-field{display:flex;flex-direction:column;gap:4px;min-width:0}
      .cv-contact-field.full{grid-column:1/-1}
      .cv-contact-field label{font:10px monospace;letter-spacing:.8px;color:#b6e833}
      .cv-contact-field input,.cv-contact-field textarea{width:100%;box-sizing:border-box;border:1px solid #b6e83355;background:#050906;color:#e9f2e8;padding:9px 10px;font:13px/1.4 inherit;min-height:36px;border-radius:0}
      .cv-contact-field textarea{min-height:86px;resize:vertical}
      .cv-contact-field input:focus,.cv-contact-field textarea:focus{outline:2px solid #b6e833;outline-offset:1px}
      .cv-contact-field input[type=file]{font:11px monospace}
      .cv-contact-hint{font:10px/1.6 monospace!important;color:#91a18e!important;margin:0}
      .cv-contact-submit{grid-column:1/-1;display:flex;gap:12px;align-items:center;flex-wrap:wrap}
      .cv-contact-submit button{background:#b6e833;color:#071007;border:1px solid #b6e833;padding:10px 14px;font:bold 10px monospace;letter-spacing:.8px;cursor:pointer}
      .cv-contact-submit button:disabled{opacity:.6;cursor:wait}
      .cv-contact-status{font-size:11px!important;color:#d8ff3e!important;margin:0}
      .cv-contact-honeypot{position:absolute!important;left:-10000px!important;width:1px!important;height:1px!important;overflow:hidden!important}
      @media(max-width:560px){.cv-contact-form{grid-template-columns:1fr;gap:9px}.cv-contact-field.full,.cv-contact-submit{grid-column:1}.cv-contact-panel{padding:16px}.cv-contact-panel h2{font-size:24px;margin-right:35px}.cv-contact-panel textarea{min-height:72px}.cv-contact-hint{font-size:9px!important}}
    `;
    hostDoc.head.appendChild(modalStyle);
    hostDoc.body.appendChild(dialog);
  }
  function openDialog(){previousFocus=hostDoc.activeElement;dialog.classList.add("is-open");hostDoc.body.style.overflow="hidden";hostDoc.getElementById("cv-contact-name")?.focus();}
  function closeDialog(){dialog.classList.remove("is-open");hostDoc.body.style.overflow="";previousFocus?.focus?.();}
  openButton?.addEventListener("click",openDialog);
  closeButton?.addEventListener("click",closeDialog);
  dialog.addEventListener("click",e=>{if(e.target===dialog)closeDialog();});
  // Escape is handled only while focus is inside this dialog; no page-wide keystroke listener.
  dialog.addEventListener("keydown",e=>{if(e.key==="Escape"&&dialog.classList.contains("is-open"))closeDialog();});
  fileInput?.addEventListener("change",()=>{
    const files=[...(fileInput.files||[])],total=files.reduce((s,f)=>s+f.size,0);
    const invalid=files.find(f=>!allowed.has(f.type)||f.size>5*1024*1024);
    if(files.length>5||total>10*1024*1024||invalid){fileInput.value="";status.textContent=invalid?"Unsupported file type or file over 5 MB. Use PDF, DOC/DOCX, TXT, PNG/JPG, or XLS/XLSX.":"Choose up to 5 files, 10 MB total.";}else status.textContent="";
  });
  function encodeFile(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve({filename:file.name,type:file.type,content:String(reader.result).split(",")[1]});reader.onerror=()=>reject(new Error("Could not read an attachment."));reader.readAsDataURL(file);});}
  form.addEventListener("submit",async event=>{
    event.preventDefault();status.textContent="";
    const files=[...(fileInput.files||[])],total=files.reduce((s,f)=>s+f.size,0);
    if(files.length>5||total>10*1024*1024||files.some(f=>!allowed.has(f.type)||f.size>5*1024*1024)){status.textContent="Please check attachment types and size limits.";return;}
    submit.disabled=true;submit.textContent="SENDING…";
    try{
      const payload={name:form.elements.name.value.trim(),email:form.elements.email.value.trim(),subject:form.elements.subject.value.trim()||form.dataset.defaultSubject||"Contact about a role",message:form.elements.message.value.trim(),website:form.elements.website.value.trim(),attachments:await Promise.all(files.map(encodeFile))};
      const response=await fetch(endpoint,{method:"POST",mode:"cors",credentials:"omit",redirect:"error",referrerPolicy:"no-referrer",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const result=await response.json().catch(()=>({}));
      if(!response.ok||!result.ok)throw new Error("SEND_FAILED");
      form.reset();status.textContent="Message sent. Thank you — I’ll be in touch.";
    }catch{status.textContent="The message could not be sent. Please check your connection and try again.";}
    finally{submit.disabled=false;submit.textContent="SEND MESSAGE ↗";}
  });
})();