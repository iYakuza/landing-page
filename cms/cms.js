(() => {
  const SUPABASE_URL = 'https://oeyxsqocldlovhsmzcjw.supabase.co';
  // Supabase publishable key: intentionally public; database RLS protects all writes.
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_kuUFxaClmROwgZpGIw6bzg_ddvb521h';
  const client = window.supabase?.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  const $ = id => document.getElementById(id);
  const loginPanel = $('login-panel'), workspace = $('workspace'), setupNote = $('setup-note');
  const loginForm = $('login-form'), loginMessage = $('login-message');
  const postForm = $('post-form'), managePosts = $('manage-posts'), saveMessage = $('save-message');
  const titleInput = $('post-title'), slugInput = $('post-slug'), categoryInput = $('post-category');
  const excerptInput = $('post-excerpt'), contentEditor = $('post-content');
  let currentUser = null, allPosts = [], editingId = null, slugManuallyEdited = false, statusFilter = 'all', saving = false;
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const slugify = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,180);
  function message(el, text, error=false){el.textContent=text;el.classList.toggle('error',error);}
  function showLogin(){loginPanel.hidden=false;workspace.hidden=true;setupNote.hidden=false;}
  function showWorkspace(user){loginPanel.hidden=true;workspace.hidden=false;setupNote.hidden=true;$('user-line').textContent='SIGNED IN // '+(user.email||'EDITOR');}
  function setStatus(text){$('editor-status').textContent=text;}
  function cleanHtml(html){
    const doc = new DOMParser().parseFromString(String(html||''),'text/html');
    const allowed = new Set(['P','BR','STRONG','B','EM','I','U','H2','H3','UL','OL','LI','BLOCKQUOTE','A','HR','CODE','PRE']);
    function clean(node){
      [...node.childNodes].forEach(child=>{
        if(child.nodeType===Node.TEXT_NODE) return;
        if(child.nodeType!==Node.ELEMENT_NODE){child.remove();return;}
        if(!allowed.has(child.tagName)){child.replaceWith(...child.childNodes);return;}
        const originalHref=child.tagName==='A'?(child.getAttribute('href')||'').trim():'';
        [...child.attributes].forEach(attr=>child.removeAttribute(attr.name));
        if(child.tagName==='A'&&/^(https?:|mailto:)/i.test(originalHref)){
          child.setAttribute('href',originalHref);child.setAttribute('target','_blank');child.setAttribute('rel','noopener noreferrer');
        }
        clean(child);
      });
    }
    clean(doc.body);return doc.body.innerHTML;
  }
  function blankEditor(){
    editingId=null;slugManuallyEdited=false;postForm.reset();contentEditor.innerHTML='';
    $('editor-mode').textContent='NEW TRANSMISSION';setStatus('UNSAVED');message(saveMessage,'');
    $('save-draft').disabled=false;$('publish-post').disabled=false;
    document.querySelectorAll('.manage-item').forEach(x=>x.classList.remove('active'));
  }
  function openPost(post){
    editingId=post.id;slugManuallyEdited=true;titleInput.value=post.title||'';slugInput.value=post.slug||'';
    categoryInput.value=post.category||'';excerptInput.value=post.excerpt||'';contentEditor.innerHTML=cleanHtml(post.content_html||'');
    $('editor-mode').textContent='EDIT TRANSMISSION';setStatus(post.status==='published'?'PUBLISHED':'DRAFT');
    message(saveMessage,'');renderPosts();
  }
  function renderPosts(){
    const posts=allPosts.filter(p=>statusFilter==='all'||p.status===statusFilter);
    if(!posts.length){managePosts.innerHTML='<p class="cms-help" style="padding:16px">No '+(statusFilter==='all'?'transmissions':statusFilter==='published'?'published posts':'drafts')+' yet. Start a new post.</p>';return;}
    managePosts.innerHTML=posts.map(p=>'<button type="button" class="manage-item '+(p.id===editingId?'active':'')+'" data-id="'+escapeHtml(p.id)+'"><strong>'+escapeHtml(p.title)+'</strong><small><span class="'+(p.status==='draft'?'draft-label':'published-label')+'">'+escapeHtml(p.status.toUpperCase())+'</span> · '+escapeHtml(p.category)+'<br>UPDATED '+new Date(p.updated_at).toLocaleDateString('en-GB')+'</small></button>').join('');
    managePosts.querySelectorAll('[data-id]').forEach(btn=>btn.addEventListener('click',()=>{const post=allPosts.find(p=>p.id===btn.dataset.id);if(post)openPost(post);}));
  }
  async function loadPosts(){
    managePosts.innerHTML='<p class="cms-help" style="padding:16px">Scanning transmissions…</p>';
    const {data,error}=await client.from('vha_posts').select('*').order('updated_at',{ascending:false});
    if(error){managePosts.innerHTML='<p class="cms-message error" style="padding:16px">'+escapeHtml(error.message)+'</p>';return;}
    allPosts=data||[];renderPosts();
  }
  async function ensureAdmin(user){
    const {data,error}=await client.from('vha_cms_admins').select('user_id').eq('user_id',user.id).maybeSingle();
    if(error||!data){
      await client.auth.signOut();showLogin();
      message(loginMessage,'This account has no CMS editor access. An owner must add its user UUID to vha_cms_admins.',true);
      return false;
    }
    return true;
  }
  async function restoreSession(){
    if(!client){showLogin();message(loginMessage,'The publishing client could not initialise. Reload the page or contact the site owner.',true);return;}
    const {data:{session}}=await client.auth.getSession();
    if(session?.user&&await ensureAdmin(session.user)){currentUser=session.user;showWorkspace(currentUser);await loadPosts();}else showLogin();
  }
  loginForm.addEventListener('submit',async event=>{
    event.preventDefault();message(loginMessage,'AUTHENTICATING…');
    const {data,error}=await client.auth.signInWithPassword({email:$('login-email').value.trim(),password:$('login-password').value});
    if(error){message(loginMessage,error.message,true);return;}
    if(!(await ensureAdmin(data.user)))return;
    currentUser=data.user;showWorkspace(currentUser);message(loginMessage,'');await loadPosts();
  });
  $('sign-out').addEventListener('click',async()=>{await client.auth.signOut();currentUser=null;showLogin();message(loginMessage,'Signed out.');});
  $('new-post').addEventListener('click',blankEditor);
  $('refresh-posts').addEventListener('click',loadPosts);
  document.querySelectorAll('[data-status-filter]').forEach(btn=>btn.addEventListener('click',()=>{statusFilter=btn.dataset.statusFilter;document.querySelectorAll('[data-status-filter]').forEach(b=>b.classList.toggle('selected',b===btn));renderPosts();}));
  titleInput.addEventListener('input',()=>{if(!slugManuallyEdited)slugInput.value=slugify(titleInput.value);});
  slugInput.addEventListener('input',()=>{slugManuallyEdited=true;slugInput.value=slugify(slugInput.value);});
  document.querySelectorAll('.rich-toolbar [data-command]').forEach(btn=>btn.addEventListener('click',()=>{
    contentEditor.focus();const cmd=btn.dataset.command;
    if(cmd==='formatBlock')document.execCommand(cmd,false,'<'+btn.dataset.value+'>');else document.execCommand(cmd,false,null);
    setStatus('UNSAVED');
  }));
  $('insert-link').addEventListener('click',()=>{contentEditor.focus();const url=prompt('Enter an https:// or mailto: link');if(url&&/^(https?:\/\/|mailto:)/i.test(url.trim()))document.execCommand('createLink',false,url.trim());else if(url)message(saveMessage,'Only https:// and mailto: links are allowed.',true);});
  contentEditor.addEventListener('input',()=>setStatus('UNSAVED'));
  postForm.addEventListener('submit',event=>{event.preventDefault();savePost('published');});
  $('save-draft').addEventListener('click',()=>savePost('draft'));
  async function savePost(status){
    if(saving||!currentUser)return;
    const title=titleInput.value.trim(),slug=slugify(slugInput.value),category=categoryInput.value.trim().toUpperCase();
    if(!title||!slug||!category){message(saveMessage,'Title, URL slug, and category are required.',true);return;}
    if(!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)){message(saveMessage,'Use a valid lowercase URL slug.',true);return;}
    const payload={title,slug,category,excerpt:excerptInput.value.trim(),content_html:cleanHtml(contentEditor.innerHTML),status};
    if(status==='published'&&!payload.content_html.trim()){message(saveMessage,'Add some content before publishing.',true);return;}
    saving=true;$('save-draft').disabled=true;$('publish-post').disabled=true;message(saveMessage,status==='published'?'PUBLISHING…':'SAVING DRAFT…');
    try{
      let query=client.from('vha_posts');
      const result=editingId?await query.update(payload).eq('id',editingId).select().single():await query.insert(payload).select().single();
      if(result.error)throw result.error;
      editingId=result.data.id;slugManuallyEdited=true;setStatus(status.toUpperCase());message(saveMessage,status==='published'?'Published. It is now visible in the public archive.':'Draft saved. It remains private.');
      await loadPosts();renderPosts();
    }catch(err){message(saveMessage,err.message||'Could not save this post.',true);}
    finally{saving=false;$('save-draft').disabled=false;$('publish-post').disabled=false;}
  }
  client?.auth.onAuthStateChange((_event,session)=>{
    if(!session){currentUser=null;showLogin();}
  });
  restoreSession();
})();