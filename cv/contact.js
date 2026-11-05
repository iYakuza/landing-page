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
      .cv-floating-nav{position:fixed;left:18px;top:38%;z-index:2147482999;width:154px;background:rgba(5,9,6,.96);border:1px solid #00eaf588;box-shadow:0 12px 38px #0009;color:#e9f2e8;font:10px monospace;letter-spacing:.6px;box-sizing:border-box;backdrop-filter:blur(10px);touch-action:pan-y}
      .cv-floating-head{display:flex;align-items:center;gap:7px;padding:9px 8px;background:#101a11;border-bottom:1px solid #00eaf555;cursor:move;user-select:none;touch-action:none}
      .cv-floating-grip{color:#00eaf5;font-size:15px;cursor:move}.cv-floating-head strong{flex:1;color:#00eaf5;font-weight:normal;letter-spacing:1.4px}
      .cv-floating-collapse{width:22px;height:22px;padding:0;background:transparent;border:1px solid #00eaf566;color:#e9ed00;font:16px monospace;cursor:pointer}
      .cv-floating-links{display:grid;gap:2px;padding:6px}
      .cv-floating-links button{display:block;width:100%;text-align:left;background:transparent;border:1px solid transparent;color:#c0cbbd;padding:8px 7px;font:9px monospace;letter-spacing:.5px;cursor:pointer}
      .cv-floating-links button:hover,.cv-floating-links button:focus-visible{color:#031116;background:#00eaf5;border-color:#00eaf5;outline:none}
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
  {
    const modalStyle = hostDoc.createElement("style");
    modalStyle.textContent = `
      .cv-contact-dialog{position:fixed;inset:0;z-index:2147483000;display:none;align-items:center;justify-content:center;padding:clamp(12px,3vw,30px);background:rgba(1,8,11,.86);backdrop-filter:blur(12px) brightness(.65);box-sizing:border-box}
      .cv-contact-dialog.is-open{display:flex}
      .cv-contact-panel{position:relative;width:min(720px,100%);max-height:min(880px,calc(100dvh - 32px));overflow:auto;background:linear-gradient(145deg,rgba(7,28,36,.99),rgba(3,17,22,.99));color:#dce9e9;border:1px solid rgba(0,234,245,.55);box-shadow:0 28px 100px rgba(0,0,0,.72),0 0 42px rgba(0,234,245,.08);padding:clamp(22px,3.2vw,38px);box-sizing:border-box}
      .cv-contact-panel:before{content:"";position:absolute;left:0;right:0;top:0;height:2px;background:linear-gradient(90deg,transparent,#00eaf5 18%,#e9ed00 78%,transparent)}
      .cv-contact-panel .gd-kicker{display:flex;align-items:center;gap:8px;margin:0 42px 14px 0;color:#00eaf5;font:700 clamp(6px,1.05vw,8px)/1.5 ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:clamp(.2px,.12vw,1px);white-space:nowrap}
      .cv-contact-panel .gd-kicker:after{content:"";height:1px;flex:1;background:linear-gradient(90deg,rgba(0,234,245,.55),transparent)}
      .cv-contact-panel>p:not(.gd-kicker){max-width:560px;font-size:12px;line-height:1.8;color:#a9c0c4;margin:12px 0 20px}
      .cv-contact-panel h2{font-size:clamp(30px,5vw,48px);line-height:.98;margin:0 52px 10px 0;letter-spacing:-.055em;font-weight:800}
      .cv-contact-panel h2 em{font-style:normal;color:#00eaf5}
      .cv-contact-panel h2 em{font-style:normal;color:#00eaf5}
      .cv-contact-panel p{font-size:11px;line-height:1.5;color:#a9c0c4;margin:7px 0}
      .cv-contact-close{position:absolute;right:20px;top:20px;width:36px;height:36px;background:rgba(0,234,245,.04);border:1px solid rgba(0,234,245,.35);color:#00eaf5;font-size:24px;cursor:pointer;transition:background .18s,border-color .18s}
      .cv-contact-close:hover{background:rgba(0,234,245,.12);border-color:#00eaf5}
      .cv-contact-form{display:grid;grid-template-columns:1fr 1fr;gap:14px 16px;margin-top:20px;padding-top:20px;border-top:1px solid rgba(0,234,245,.2)}
      .cv-contact-field{display:flex;flex-direction:column;gap:4px;min-width:0}
      .cv-contact-field.full{grid-column:1/-1}
      .cv-contact-field label{font:700 9px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:1.2px;color:#00eaf5}
      .cv-contact-field input,.cv-contact-field textarea{width:100%;box-sizing:border-box;border:1px solid rgba(0,234,245,.28);background:rgba(1,10,14,.72);color:#e9f2e8;padding:12px 13px;font:13px/1.5 Arial,Helvetica,sans-serif;min-height:44px;border-radius:0;transition:border-color .18s,box-shadow .18s}
      .cv-contact-field textarea{min-height:86px;resize:vertical}
      .cv-contact-field input:focus,.cv-contact-field textarea:focus{outline:0;border-color:#00eaf5;box-shadow:0 0 0 2px rgba(0,234,245,.13)}
      .cv-contact-field input[type=file]{font:11px monospace}
      .cv-contact-hint{font:10px/1.6 monospace!important;color:#8aa6ac!important;margin:0}
      .cv-contact-submit{grid-column:1/-1;display:flex;gap:12px;align-items:center;flex-wrap:wrap}
      .cv-contact-submit button{background:#00eaf5;color:#031116;border:1px solid #00eaf5;padding:13px 18px;font:800 9px ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:1.1px;cursor:pointer;transition:background .18s,color .18s,box-shadow .18s}
      .cv-contact-submit button:hover{background:#e9ed00;border-color:#e9ed00;box-shadow:0 0 22px rgba(233,237,0,.16)}
      .cv-contact-submit button:disabled{opacity:.6;cursor:wait}
      .cv-contact-status{font-size:11px!important;color:#e9ed00!important;margin:0}
      .cv-contact-honeypot{position:absolute!important;left:-10000px!important;width:1px!important;height:1px!important;overflow:hidden!important}
      @media(max-width:560px){.cv-contact-form{grid-template-columns:1fr;gap:12px}.cv-contact-field.full,.cv-contact-submit{grid-column:1}.cv-contact-panel{padding:22px 17px}.cv-contact-panel .gd-kicker{font-size:6px;letter-spacing:.25px;gap:5px;margin:0 38px 12px 0}.cv-contact-panel h2{font-size:clamp(28px,9vw,38px);margin-right:38px}.cv-contact-panel>p:not(.gd-kicker){font-size:11px}.cv-contact-panel textarea{min-height:90px}.cv-contact-hint{font-size:9px!important}.cv-contact-close{right:14px;top:14px;width:32px;height:32px}}
    `;
    hostDoc.head.appendChild(modalStyle);
    if (embedded) hostDoc.body.appendChild(dialog);
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
      const messageParts=[form.elements.message.value.trim()];const referenceUrl=form.elements.url?.value.trim();if(referenceUrl)messageParts.push("Reference URL: "+referenceUrl);const payload={name:form.elements.name.value.trim(),email:form.elements.email.value.trim(),subject:form.elements.subject.value.trim()||form.dataset.defaultSubject||"Contact about a role",message:messageParts.filter(Boolean).join("\n\n"),website:form.elements.website.value.trim(),attachments:await Promise.all(files.map(encodeFile))};
      const response=await fetch(endpoint,{method:"POST",mode:"cors",credentials:"omit",redirect:"error",referrerPolicy:"no-referrer",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const result=await response.json().catch(()=>({}));
      if(!response.ok||!result.ok)throw new Error("SEND_FAILED");
      form.reset();status.textContent="Message sent. Thank you — I’ll be in touch.";
    }catch{status.textContent="The message could not be sent. Please check your connection and try again.";}
    finally{submit.disabled=false;submit.textContent="SEND MESSAGE ↗";}
  });
})();