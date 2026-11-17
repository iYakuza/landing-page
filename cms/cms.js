(() => {
  'use strict';
  const SUPABASE_URL='https://oeyxsqocldlovhsmzcjw.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY='sb_publishable_kuUFxaClmROwgZPIw6bzg_ddvb521h';
  const client=window.supabase?.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
  const $=id=>document.getElementById(id);
  const loginPanel=$('login-panel'),workspace=$('workspace'),setupNote=$('setup-note');
  const loginForm=$('login-form'),loginMessage=$('login-message');
  const PAGE_SIZE=10;
  let currentUser=null,submissions=[],offset=0,hasMore=false;
  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  function message(element,value,isError=false){if(!element)return;element.textContent=value;element.classList.toggle('error',Boolean(isError));}
  function showLogin(){loginPanel.hidden=false;workspace.hidden=true;setupNote.hidden=false;}
  function showWorkspace(user){loginPanel.hidden=true;workspace.hidden=false;setupNote.hidden=true;$('community-review').hidden=false;$('user-line').textContent='SIGNED IN // '+(user.email||'CMS ADMIN');}
  async function ensureAdmin(user){
    const {data,error}=await client.from('vha_cms_admins').select('user_id').eq('user_id',user.id).maybeSingle();
    if(error||!data){await client.auth.signOut();showLogin();message(loginMessage,'This account has no CMS admin role. An owner must grant access through vha_cms_admins.',true);return false;}
    return true;
  }
  async function loadCommunitySubmissions(reset=true){
    const target=$('community-submissions');if(!target)return;
    if(reset){offset=0;submissions=[];target.innerHTML='<p class="cms-help">Loading recent community submissions…</p>';}
    const {data,error}=await client.from('poetry_submissions').select('id,title,medium,body,byline,media_url,created_at,status').order('created_at',{ascending:false}).range(offset,offset+PAGE_SIZE-1);
    if(error){target.innerHTML='<p class="cms-message error">Could not load community submissions: '+escapeHtml(error.message)+'</p>';return;}
    const items=data||[];submissions=reset?items:submissions.concat(items);offset+=items.length;hasMore=items.length===PAGE_SIZE;
    if(!submissions.length)target.innerHTML='<p class="cms-help">No visitor submissions yet.</p>';
    else target.innerHTML=submissions.map(item=>{
      const media=item.media_url?'<p><a href="'+escapeHtml(item.media_url)+'" target="_blank" rel="noopener noreferrer">OPEN ATTACHED MEDIA ↗</a></p>':'';
      const body=item.body?'<p class="community-submission-body">'+escapeHtml(item.body).replace(/\n/g,'<br>')+'</p>':'';
      const actions=item.status==='pending'?'<div class="community-submission-actions"><button type="button" class="cms-button primary vha-editor-action" data-action-variant="primary" data-submission-action="published" data-submission-id="'+escapeHtml(item.id)+'">APPROVE & PUBLISH</button><button type="button" class="cms-button danger vha-editor-action" data-action-variant="danger" data-submission-action="rejected" data-submission-id="'+escapeHtml(item.id)+'">DECLINE</button></div>':'';
      return '<article class="community-submission"><div class="community-submission-top"><div><p class="gd-kicker">'+escapeHtml(String(item.medium||'').toUpperCase())+' // '+escapeHtml(item.byline||'ANONYMOUS')+'</p><h3>'+escapeHtml(item.title)+'</h3></div><span class="'+(item.status==='published'?'published-label':item.status==='pending'?'draft-label':item.status==='rejected'?'rejected-label':item.status==='failed'?'failed-label':'')+'">'+escapeHtml(String(item.status||'').toUpperCase())+'</span></div>'+body+media+'<small class="cms-help">RECEIVED '+new Date(item.created_at).toLocaleString('en-GB')+'</small>'+actions+'</article>';
    }).join('');
    $('load-more-submissions').hidden=!hasMore;
  }
  $('refresh-submissions')?.addEventListener('click',()=>loadCommunitySubmissions(true));
  $('load-more-submissions')?.addEventListener('click',()=>loadCommunitySubmissions(false));
  $('community-submissions')?.addEventListener('click',async event=>{
    const button=event.target.closest('[data-submission-action]');if(!button)return;
    button.disabled=true;const status=button.dataset.submissionAction,id=button.dataset.submissionId;
    const {error}=await client.from('poetry_submissions').update({status,...(status==='published'?{published_at:new Date().toISOString()}:{})}).eq('id',id);
    if(error){button.disabled=false;alert('Could not update submission: '+error.message);return;}
    await loadCommunitySubmissions(true);
  });
  async function restoreSession(){
    if(!client){showLogin();message(loginMessage,'The admin client could not initialise. Reload the page or contact the site owner.',true);return;}
    const {data:{session}}=await client.auth.getSession();
    if(new URLSearchParams(window.location.hash.slice(1)).get('type')==='recovery'&&session?.user){
      loginPanel.hidden=true;workspace.hidden=true;$('password-reset-panel').hidden=false;$('password-reset-message').textContent='Choose a new password for your account.';return;
    }
    if(session?.user&&await ensureAdmin(session.user)){currentUser=session.user;showWorkspace(currentUser);await loadCommunitySubmissions(true);}
    else showLogin();
  }
  $('forgot-password')?.addEventListener('click',async()=>{
    const email=$('login-email').value.trim();
    if(!email){message(loginMessage,'Enter your account email above first, then request a reset link.',true);$('login-email').focus();return;}
    const button=$('forgot-password');button.disabled=true;message(loginMessage,'REQUESTING PASSWORD RESET…');
    try{const redirectTo=new URL('/landing-page/cms/',window.location.origin).href;const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo});if(error)throw error;message(loginMessage,'If an account exists for that email, a password reset link has been sent. Check your inbox and spam folder.');}
    catch(error){message(loginMessage,error.message||'Could not request a reset link.',true);}
    finally{button.disabled=false;}
  });
  $('password-reset-form')?.addEventListener('submit',async event=>{
    event.preventDefault();const password=$('new-password').value,confirmPassword=$('confirm-password').value;
    if(password.length<8){message($('password-reset-message'),'Use at least 8 characters.',true);return;}
    if(password!==confirmPassword){message($('password-reset-message'),'The passwords do not match.',true);return;}
    const button=event.currentTarget.querySelector('button');button.disabled=true;message($('password-reset-message'),'UPDATING PASSWORD…');
    try{const {error}=await client.auth.updateUser({password});if(error)throw error;await client.auth.signOut();window.history.replaceState({},document.title,window.location.pathname);$('password-reset-panel').hidden=true;showLogin();$('login-password').value='';message(loginMessage,'Password updated. Sign in with your admin account.');}
    catch(error){message($('password-reset-message'),error.message||'Could not update the password. Request a fresh reset link and try again.',true);}
    finally{button.disabled=false;}
  });
  loginForm.addEventListener('submit',async event=>{
    event.preventDefault();message(loginMessage,'AUTHENTICATING…');
    const {data,error}=await client.auth.signInWithPassword({email:$('login-email').value.trim(),password:$('login-password').value});
    if(error){message(loginMessage,error.message,true);return;}
    if(!(await ensureAdmin(data.user)))return;
    currentUser=data.user;showWorkspace(currentUser);message(loginMessage,'');await loadCommunitySubmissions(true);
  });
  $('sign-out').addEventListener('click',async()=>{await client.auth.signOut();currentUser=null;showLogin();message(loginMessage,'Signed out.');});
  client?.auth.onAuthStateChange((_event,session)=>{if(!session){currentUser=null;showLogin();}});
  restoreSession();
})();
