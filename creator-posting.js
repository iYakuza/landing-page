(() => {
if(window.__vhaCreatorPostingLoaded)return;window.__vhaCreatorPostingLoaded=true;
const URL_API='https://oeyxsqocldlovhsmzcjw.supabase.co',KEY='sb_publishable_kuUFxaClmROwgZpGIw6bzg_ddvb521h';
const M=[['THE AWAKENING','01 / THE AWAKENING','the-awakening'],['THE DESCENT','02 / THE DESCENT','the-descent'],['THE RECONNECTION','03 / THE RECONNECTION','the-reconnection'],['THE TRANSFORMATION','04 / THE TRANSFORMATION','the-transformation'],['THE RETURN','05 / THE RETURN','the-return']];
const sharedActions=document.createElement('link');sharedActions.rel='stylesheet';sharedActions.href='/landing-page/editor-ui.css?v=20261027-shared-actions-1';document.head.appendChild(sharedActions);
const css=document.createElement('style');css.textContent=[
'.vha-create-plus{flex:0 0 26px;width:26px;height:26px;min-height:26px;margin-left:auto;padding:0;font-size:18px;line-height:1}',
'.vha-nav-menu .vha-movement-row{display:flex;align-items:center;gap:8px}.vha-nav-menu .vha-movement-row>a:first-child{flex:1;min-width:0}',
'.vha-quick-post{position:fixed;left:18px;bottom:18px;z-index:2147483007;padding:12px 15px;box-shadow:0 5px 20px #0008}.vha-quick-post[hidden],.vha-create-plus[hidden]{display:none!important}',
'@media(max-width:560px){.vha-quick-post{left:10px;bottom:10px}}'
].join('');document.head.appendChild(css);
const pageCategory=()=>{const b=(document.body.dataset.movement||'').toUpperCase();if(M.some(m=>m[0]===b))return b;const slug=location.pathname.split('/').find(part=>M.some(m=>m[2]===part.toLowerCase()));return slug?M.find(m=>m[2]===slug.toLowerCase())?.[0]||'':''};
let client=null,isCreator=false;
function openStudio(selected=''){
  const url=new URL('/landing-page/cms/',location.origin);
  url.searchParams.set('new','1');
  if(M.some(m=>m[0]===selected))url.searchParams.set('category',selected);
  location.assign(url.pathname+url.search);
}
function addControls(){document.querySelectorAll('.vha-nav-menu').forEach(menu=>{const allLink=[...menu.querySelectorAll('a')].find(x=>x.textContent.toUpperCase().includes('ALL TRANSMISSIONS'));if(allLink&&!allLink.parentElement.classList.contains('vha-movement-row')){const allRow=document.createElement('div');allRow.className='vha-movement-row';allLink.parentNode.insertBefore(allRow,allLink);allRow.appendChild(allLink);const allPlus=document.createElement('button');allPlus.type='button';allPlus.className='vha-create-plus vha-editor-action';allPlus.dataset.actionVariant='subtle';allPlus.textContent='+';allPlus.setAttribute('aria-label','Create a post in any movement');allPlus.title='Create a post';allPlus.hidden=true;allPlus.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();openStudio('')});allRow.appendChild(allPlus)}M.forEach(m=>{const a=[...menu.querySelectorAll('a')].find(x=>x.textContent.toUpperCase().includes(m[0]));if(!a||a.parentElement.classList.contains('vha-movement-row'))return;const row=document.createElement('div');row.className='vha-movement-row';a.parentNode.insertBefore(row,a);row.appendChild(a);const plus=document.createElement('button');plus.type='button';plus.className='vha-create-plus vha-editor-action';plus.dataset.actionVariant='subtle';plus.textContent='+';plus.setAttribute('aria-label','Create post in '+m[0]);plus.title='Create a post in '+m[0];plus.hidden=true;plus.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();openStudio(m[0])});row.appendChild(plus)})});const q=document.createElement('button');q.type='button';q.className='vha-quick-post vha-editor-action';q.dataset.actionVariant='primary';q.hidden=true;q.textContent='+ QUICK POST';document.body.appendChild(q);return q}
const quick=addControls();
/* Every create action opens the same full-featured Owner Studio composer. */
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
