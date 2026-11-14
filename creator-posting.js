(() => {
if(window.__vhaCreatorPostingLoaded)return;window.__vhaCreatorPostingLoaded=true;
const URL_API='https://oeyxsqocldlovhsmzcjw.supabase.co',KEY='sb_publishable_kuUFxaClmROwgZpGIw6bzg_ddvb521h';
const M=[['THE AWAKENING','01 / THE AWAKENING','the-awakening'],['THE DESCENT','02 / THE DESCENT','the-descent'],['THE RECONNECTION','03 / THE RECONNECTION','the-reconnection'],['THE TRANSFORMATION','04 / THE TRANSFORMATION','the-transformation'],['THE RETURN','05 / THE RETURN','the-return']];
const sharedActions=document.createElement('link');sharedActions.rel='stylesheet';sharedActions.href='/landing-page/editor-ui.css?v=20261027-shared-actions-1';document.head.appendChild(sharedActions);
const css=document.createElement('style');css.textContent=[
'.vha-create-plus{flex:0 0 26px;width:26px;height:26px;min-height:26px;margin-left:auto;padding:0;font-size:18px;line-height:1}',
'.vha-nav-menu .vha-movement-row{display:flex;align-items:center;gap:8px}.vha-nav-menu .vha-movement-row>a:first-child{flex:1;min-width:0}',
'.vha-quick-post{position:fixed;left:18px;bottom:18px;z-index:2147483007;padding:12px 15px;box-shadow:0 5px 20px #0008}.vha-quick-post[hidden],.vha-create-plus[hidden]{display:none!important}',
'.vha-quick-post-overlay{position:fixed;inset:0;z-index:2147483100;background:#030706}',
'.vha-quick-post-frame{display:block;width:100%;height:100%;border:0;background:#050906}',
'.vha-quick-post-close{position:fixed;top:12px;right:16px;z-index:2147483200;padding:10px 13px;border:1px solid #00eaf5a0;background:#031116;color:#e8ffff;font:10px ui-monospace,monospace;letter-spacing:1px;cursor:pointer;box-shadow:0 4px 18px #0009}',
'.vha-quick-post-close:hover,.vha-quick-post-close:focus-visible{background:#00eaf5;color:#031116;outline:2px solid #00eaf5;outline-offset:2px}',
'@media(max-width:560px){.vha-quick-post-close{top:8px;right:8px;padding:9px 10px}}',
'@media(max-width:560px){.vha-quick-post{left:10px;bottom:10px}}'
].join('');document.head.appendChild(css);
const pageCategory=()=>{const b=(document.body.dataset.movement||'').toUpperCase();if(M.some(m=>m[0]===b))return b;const slug=location.pathname.split('/').find(part=>M.some(m=>m[2]===part.toLowerCase()));return slug?M.find(m=>m[2]===slug.toLowerCase())?.[0]||'':''};
let client=null,isCreator=false;
let composerOverlay=null,previousFocus=null,closeInProgress=false;
async function closeStudio(){
  if(!composerOverlay||closeInProgress)return;
  const overlay=composerOverlay,frame=overlay.querySelector('iframe'),close=overlay.querySelector('.vha-quick-post-close');
  closeInProgress=true;close.disabled=true;close.textContent='SAVING DRAFT…';
  const requestId='quick-post-close-'+Date.now()+'-'+Math.random().toString(36).slice(2);
  const saved=await new Promise(resolve=>{
    let finished=false;
    const done=value=>{if(finished)return;finished=true;window.removeEventListener('message',onMessage);clearTimeout(timeout);resolve(value)};
    const onMessage=event=>{
      if(event.origin!==location.origin||event.source!==frame.contentWindow)return;
      if(event.data?.type==='VHA_QUICK_POST_CLOSE_RESULT'&&event.data.requestId===requestId)done(!!event.data.saved);
    };
    const timeout=setTimeout(()=>done(false),20000);
    window.addEventListener('message',onMessage);
    try{frame.contentWindow.postMessage({type:'VHA_QUICK_POST_CLOSE_REQUEST',requestId},location.origin)}catch{done(false)}
  });
  if(!saved){
    closeInProgress=false;close.disabled=false;close.textContent='CLOSE ✕';
    const status=overlay.querySelector('.vha-quick-post-frame');
    if(status)status.contentWindow?.postMessage({type:'VHA_QUICK_POST_CLOSE_FAILED'},location.origin);
    return;
  }
  overlay.remove();composerOverlay=null;closeInProgress=false;document.body.style.overflow='';
  window.removeEventListener('keydown',handleComposerKeydown);
  previousFocus?.focus?.();previousFocus=null;
}
function handleComposerKeydown(event){if(event.key==='Escape'){event.preventDefault();closeStudio();}}
function openStudio(selected=''){
  if(composerOverlay)return;
  previousFocus=document.activeElement;
  const url=new URL('/landing-page/cms/',location.origin);
  url.searchParams.set('new','1');url.searchParams.set('embed','1');
  if(M.some(m=>m[0]===selected))url.searchParams.set('category',selected);
  const overlay=document.createElement('div');
  overlay.className='vha-quick-post-overlay';
  overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','New transmission editor');
  const close=document.createElement('button');
  close.type='button';close.className='vha-quick-post-close';close.textContent='CLOSE ✕';close.setAttribute('aria-label','Close new transmission editor');
  close.addEventListener('click',closeStudio);
  const frame=document.createElement('iframe');
  frame.className='vha-quick-post-frame';frame.title='New Transmission editor';frame.src=url.pathname+url.search;
  frame.setAttribute('allow','clipboard-read; clipboard-write');
  frame.addEventListener('load',()=>{try{frame.contentWindow.addEventListener('keydown',handleComposerKeydown);}catch{}});
  overlay.addEventListener('click',event=>{if(event.target===overlay)closeStudio()});
  overlay.append(close,frame);document.body.appendChild(overlay);composerOverlay=overlay;
  document.body.style.overflow='hidden';window.addEventListener('keydown',handleComposerKeydown);
  close.focus();
}
function addControls(){document.querySelectorAll('.vha-nav-menu').forEach(menu=>{const allLink=[...menu.querySelectorAll('a')].find(x=>x.textContent.toUpperCase().includes('ALL TRANSMISSIONS'));if(allLink&&!allLink.parentElement.classList.contains('vha-movement-row')){const allRow=document.createElement('div');allRow.className='vha-movement-row';allLink.parentNode.insertBefore(allRow,allLink);allRow.appendChild(allLink);const allPlus=document.createElement('button');allPlus.type='button';allPlus.className='vha-create-plus vha-editor-action';allPlus.dataset.actionVariant='subtle';allPlus.textContent='+';allPlus.setAttribute('aria-label','Create a post in any movement');allPlus.title='Create a post';allPlus.hidden=true;allPlus.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();openStudio('')});allRow.appendChild(allPlus)}M.forEach(m=>{const a=[...menu.querySelectorAll('a')].find(x=>x.textContent.toUpperCase().includes(m[0]));if(!a||a.parentElement.classList.contains('vha-movement-row'))return;const row=document.createElement('div');row.className='vha-movement-row';a.parentNode.insertBefore(row,a);row.appendChild(a);const plus=document.createElement('button');plus.type='button';plus.className='vha-create-plus vha-editor-action';plus.dataset.actionVariant='subtle';plus.textContent='+';plus.setAttribute('aria-label','Create post in '+m[0]);plus.title='Create a post in '+m[0];plus.hidden=true;plus.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();openStudio(m[0])});row.appendChild(plus)})});const q=document.createElement('button');q.type='button';q.className='vha-quick-post vha-editor-action';q.dataset.actionVariant='primary';q.hidden=true;q.textContent='+ QUICK POST';document.body.appendChild(q);return q}
const quick=addControls();
/* Every create action opens the same full-featured Owner Studio composer in a same-origin overlay. */
quick.addEventListener('click',event=>{event.preventDefault();openStudio(pageCategory())});
let authBound=false,refreshing=false;
function hasStoredSession(){try{return Boolean(localStorage.getItem('sb-oeyxsqocldlovhsmzcjw-auth-token'))}catch{return false}}
async function ensureSupabase(){if(window.supabase?.createClient)return true;if(!hasStoredSession())return false;return new Promise(resolve=>{const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0';script.async=true;script.crossOrigin='anonymous';script.referrerPolicy='no-referrer';script.onload=()=>resolve(Boolean(window.supabase?.createClient));script.onerror=()=>resolve(false);document.head.appendChild(script)})}
async function refresh(sessionOverride){
 if(refreshing)return;
 refreshing=true;
 try{
  if(!await ensureSupabase()){isCreator=false;return}
  if(!client)client=window.supabase.createClient(URL_API,KEY);
  let session=sessionOverride;
  if(sessionOverride===undefined){const result=await client.auth.getSession();session=result.data?.session;if(result.error)isCreator=false}
  if(!session?.user)isCreator=false;
  else{const {data,error}=await client.from('vha_cms_admins').select('user_id').eq('user_id',session.user.id).maybeSingle();isCreator=!error&&!!data}
  if(!authBound){
   authBound=true;
   client.auth.onAuthStateChange((_event,session)=>{refresh(session)});
  }
 }catch{isCreator=false}
 finally{
  refreshing=false;
  document.querySelectorAll('.vha-create-plus').forEach(b=>b.hidden=!isCreator);
  quick.hidden=!isCreator;
 }
}
refresh();
})();
