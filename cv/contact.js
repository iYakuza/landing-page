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

  // In the embedded CV, put the modal in the top-level page so fixed positioning
  // follows the actual browser viewport rather than the tall iframe document.
  if (embedded) {
    const modalStyle = hostDoc.createElement("style");
    modalStyle.textContent = `
      .cv-contact-dialog{position:fixed;inset:0;z-index:2147483000;display:none;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,.78);backdrop-filter:blur(8px);box-sizing:border-box}
      .cv-contact-dialog.is-open{display:flex}
      .cv-contact-panel{position:relative;width:min(680px,100%);max-height:min(90vh,900px);overflow:auto;background:#081009;color:#e9f2e8;border:1px solid #b6e833;box-shadow:0 25px 90px #000b;padding:clamp(20px,4vw,38px);box-sizing:border-box}
      .cv-contact-panel h2{font-size:clamp(26px,5vw,42px);line-height:1;margin:8px 44px 12px 0;letter-spacing:-.04em}
      .cv-contact-panel h2 em{font-style:normal;color:#b6e833}
      .cv-contact-panel p{font-size:12px;line-height:1.7;color:#aebbad}
      .cv-contact-close{position:absolute;right:16px;top:16px;width:38px;height:38px;background:transparent;border:1px solid #b6e83366;color:#d8ff3e;font-size:24px;cursor:pointer}
      .cv-contact-form{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:22px}
      .cv-contact-field{display:flex;flex-direction:column;gap:7px;min-width:0}
      .cv-contact-field.full{grid-column:1/-1}
      .cv-contact-field label{font:10px monospace;letter-spacing:.8px;color:#b6e833}
      .cv-contact-field input,.cv-contact-field textarea{width:100%;box-sizing:border-box;border:1px solid #b6e83355;background:#050906;color:#e9f2e8;padding:12px;font:13px inherit;min-height:44px;border-radius:0}
      .cv-contact-field textarea{min-height:130px;resize:vertical}
      .cv-contact-field input:focus,.cv-contact-field textarea:focus{outline:2px solid #b6e833;outline-offset:1px}
      .cv-contact-field input[type=file]{font:11px monospace}
      .cv-contact-hint{font:10px/1.6 monospace!important;color:#91a18e!important;margin:0}
      .cv-contact-submit{grid-column:1/-1;display:flex;gap:12px;align-items:center;flex-wrap:wrap}
      .cv-contact-submit button{background:#b6e833;color:#071007;border:1px solid #b6e833;padding:14px 18px;font:bold 11px monospace;letter-spacing:.8px;cursor:pointer}
      .cv-contact-submit button:disabled{opacity:.6;cursor:wait}
      .cv-contact-status{font-size:11px!important;color:#d8ff3e!important;margin:0}
      .cv-contact-honeypot{position:absolute!important;left:-10000px!important;width:1px!important;height:1px!important;overflow:hidden!important}
      @media(max-width:560px){.cv-contact-form{grid-template-columns:1fr}.cv-contact-field.full,.cv-contact-submit{grid-column:1}.cv-contact-panel{padding:22px}}
    `;
    hostDoc.head.appendChild(modalStyle);
    hostDoc.body.appendChild(dialog);
  }
  function openDialog(){previousFocus=hostDoc.activeElement;dialog.classList.add("is-open");hostDoc.body.style.overflow="hidden";hostDoc.getElementById("cv-contact-name")?.focus();}
  function closeDialog(){dialog.classList.remove("is-open");hostDoc.body.style.overflow="";previousFocus?.focus?.();}
  openButton?.addEventListener("click",openDialog);
  closeButton?.addEventListener("click",closeDialog);
  dialog.addEventListener("click",e=>{if(e.target===dialog)closeDialog();});
  hostDoc.addEventListener("keydown",e=>{if(e.key==="Escape"&&dialog.classList.contains("is-open"))closeDialog();});
  fileInput?.addEventListener("change",()=>{
    const files=[...(fileInput.files||[])],total=files.reduce((s,f)=>s+f.size,0);
    const invalid=files.find(f=>!allowed.has(f.type)||f.size>5*1024*1024);
    if(files.length>5||total>10*1024*1024||invalid){fileInput.value="";status.textContent=invalid?"Unsupported file type or file over 5 MB. Use PDF, DOC/DOCX, TXT, PNG/JPG, or XLS/XLSX.":"Choose up to 5 files, 10 MB total.";}else status.textContent="";
  });
  function encodeFile(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve({filename:file.name,content:String(reader.result).split(",")[1]});reader.onerror=()=>reject(new Error("Could not read an attachment."));reader.readAsDataURL(file);});}
  form.addEventListener("submit",async event=>{
    event.preventDefault();status.textContent="";
    const files=[...(fileInput.files||[])],total=files.reduce((s,f)=>s+f.size,0);
    if(files.length>5||total>10*1024*1024||files.some(f=>!allowed.has(f.type)||f.size>5*1024*1024)){status.textContent="Please check attachment types and size limits.";return;}
    submit.disabled=true;submit.textContent="SENDING…";
    try{
      const payload={name:form.elements.name.value.trim(),email:form.elements.email.value.trim(),subject:form.elements.subject.value.trim()||"Contact about a role",message:form.elements.message.value.trim(),website:form.elements.website.value.trim(),attachments:await Promise.all(files.map(encodeFile))};
      const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const result=await response.json().catch(()=>({}));
      if(!response.ok||!result.ok)throw new Error(result.error||"The message could not be sent.");
      form.reset();status.textContent="Message sent. Thank you — I’ll be in touch.";
    }catch(error){status.textContent=error.message||"Something went wrong. Please try again.";}
    finally{submit.disabled=false;submit.textContent="SEND MESSAGE ↗";}
  });
})();