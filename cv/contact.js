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
  let previousFocus = null;
  function openDialog(){previousFocus=document.activeElement;dialog.classList.add("is-open");document.body.style.overflow="hidden";document.getElementById("cv-contact-name")?.focus();}
  function closeDialog(){dialog.classList.remove("is-open");document.body.style.overflow="";previousFocus?.focus?.();}
  openButton?.addEventListener("click",openDialog);
  closeButton?.addEventListener("click",closeDialog);
  dialog.addEventListener("click",e=>{if(e.target===dialog)closeDialog();});
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&dialog.classList.contains("is-open"))closeDialog();});
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