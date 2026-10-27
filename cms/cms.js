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
  const mediaInput = $('post-media'), mediaPreview = $('media-preview'), mediaMessage = $('media-message');
  const layoutInput = $('post-layout'), mediaWidthInput = $('media-width'), mediaWidthValue = $('media-width-value');
  const sunoFields = $('suno-fields'), plainFields = $('plain-fields');
  let postLayout = 'suno', postMediaWidth = 100;
  let currentUser = null, allPosts = [], editingId = null, slugManuallyEdited = false, statusFilter = 'all', saving = false;
  const POSTS_PAGE_SIZE = 20, SUBMISSIONS_PAGE_SIZE = 10;
  let postsOffset = 0, hasMorePosts = false, communityItems = [], communityOffset = 0, hasMoreCommunity = false, openingPostToken = 0;
  const requestedParams = new URLSearchParams(window.location.search);
  const requestedEditSlug = requestedParams.get('edit');
  const requestedCategory = (requestedParams.get('category') || '').trim().toUpperCase();
  const requestedNewPost = requestedParams.get('new') === '1';
  let mediaUrl = null, mediaPath = null, mediaType = null, originalMediaPath = null;
  const MEDIA_BUCKET = 'vha-post-media';
  const MAX_MEDIA_BYTES = 30 * 1024 * 1024;
  const ALLOWED_MEDIA = new Set(['image/jpeg','image/png','image/webp','image/gif','image/avif','audio/mpeg','audio/mp4','audio/ogg','audio/wav','audio/webm','video/mp4','video/webm','video/quicktime']);
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const slugify = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,180);
  function message(el, text, error=false){el.textContent=text;el.classList.toggle('error',error);}
  function showLogin(){loginPanel.hidden=false;workspace.hidden=true;setupNote.hidden=false;}
  function showWorkspace(user){loginPanel.hidden=true;workspace.hidden=false;setupNote.hidden=true;$('community-review').hidden=false;$('user-line').textContent='SIGNED IN // '+(user.email||'EDITOR');}
  function setStatus(text){$('editor-status').textContent=text;}
  function safeLink(value){
    try{
      const url=new URL(String(value||''));
      if(url.protocol==='https:'&&url.hostname)return url.href;
      if(url.protocol==='mailto:'&&url.pathname)return url.href;
    }catch{}
    return '';
  }
  function cleanHtml(html){
    const doc = new DOMParser().parseFromString(String(html||''),'text/html');
    const allowed = new Set(['P','BR','STRONG','B','EM','I','U','H2','H3','UL','OL','LI','BLOCKQUOTE','A','HR','CODE','PRE','DIV','SECTION','ASIDE','DETAILS','SUMMARY']);
    function clean(node){
      [...node.childNodes].forEach(child=>{
        if(child.nodeType===Node.TEXT_NODE) return;
        if(child.nodeType!==Node.ELEMENT_NODE){child.remove();return;}
        if(!allowed.has(child.tagName)){clean(child);child.replaceWith(...child.childNodes);return;}
        const originalHref=child.tagName==='A'?(child.getAttribute('href')||'').trim():'';
        const originalClass=(child.getAttribute('class')||'').split(/\s+/).filter(name=>['suno-post-layout','suno-text-column','suno-lyrics','suno-notes','suno-learned','suno-label','plain-post-layout','plain-copy','plain-response'].includes(name)).join(' ');
        [...child.attributes].forEach(attr=>child.removeAttribute(attr.name));
        if(originalClass)child.setAttribute('class',originalClass);
        const safeHref=child.tagName==='A'?safeLink(originalHref):'';
        if(child.tagName==='A'&&safeHref){
          child.setAttribute('href',safeHref);child.setAttribute('target','_blank');child.setAttribute('rel','noopener noreferrer');
        }
        clean(child);
      });
    }
    clean(doc.body);return doc.body.innerHTML;
  }
  function renderMediaPreview(){
    mediaPreview.innerHTML='';mediaPreview.hidden=!mediaUrl;$('remove-media').hidden=!mediaUrl;
    if(!mediaUrl)return;
    let el;
    if(mediaType==='image'){el=document.createElement('img');el.alt='Post media preview';}
    else if(mediaType==='video'){el=document.createElement('video');el.controls=true;el.preload='none';}
    else{el=document.createElement('audio');el.controls=true;el.preload='none';}
    el.src=mediaUrl;el.style.width=postMediaWidth+'%';el.style.maxWidth='100%';mediaPreview.appendChild(el);
  }

  function syncLayoutFields(){
    postLayout=layoutInput.value;sunoFields.hidden=postLayout!=='suno';plainFields.hidden=postLayout!=='plain';
    contentEditor.closest('.rich-editor').hidden=postLayout!=='standard';contentEditor.closest('.rich-editor').previousElementSibling.hidden=postLayout!=='standard';
  }
  function htmlToEditorText(container,skipFirstLabel=false){
    if(!container)return '';
    const blocks=[];
    const nodes=Array.from(container.childNodes).filter(node=>!(skipFirstLabel&&node.nodeType===Node.ELEMENT_NODE&&node.classList.contains('suno-label')));
    function read(node){
      if(node.nodeType===Node.TEXT_NODE)return node.nodeValue||'';
      if(node.nodeType!==Node.ELEMENT_NODE)return '';
      if(node.tagName==='BR')return '\n';
      const inner=Array.from(node.childNodes).map(read).join('');
      return ['P','DIV','SECTION','ASIDE','H2','H3','BLOCKQUOTE','LI'].includes(node.tagName)?'\n\n'+inner+'\n\n':inner;
    }
    return nodes.map(read).join('').replace(/\r/g,'').replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').replace(/^\n+|\n+$/g,'');
  }
  function textAsParagraphs(value){return String(value||'').split(/\n{2,}/).map(part=>'<p>'+escapeHtml(part).replace(/\n/g,'<br>')+'</p>').join('');}
  function buildPostContent(){
    if(postLayout==='standard')return contentEditor.innerHTML;
    if(postLayout==='plain')return '<div class="plain-post-layout"><section class="plain-copy"><p class="suno-label">THE TEXT</p>'+textAsParagraphs($('post-plain-text').value)+'</section><aside class="plain-response"><p class="suno-label">A SMALL RESPONSE</p><h2>Oh, sun.</h2></aside></div>';
    return '<div class="suno-post-layout"><section class="suno-text-column"><p class="suno-label">01 // THE TEXT</p>'+textAsParagraphs($('post-main-text').value)+'</section><details class="suno-lyrics"><summary class="suno-label">02 // SUNO.COM LYRICS <span class="suno-collapse-hint">CLICK TO EXPAND</span></summary><pre>'+escapeHtml($('post-lyrics').value)+'</pre></details><aside class="suno-notes"><p class="suno-label">03 // SUNO.COM STYLE</p>'+textAsParagraphs($('post-style-notes').value)+'<section class="suno-learned"><p class="suno-label">WHAT I LEARNED</p>'+textAsParagraphs($('post-learned').value)+'</section></aside></div>';
  }
  layoutInput.addEventListener('change',()=>{syncLayoutFields();setStatus('UNSAVED');});
  mediaWidthInput.addEventListener('input',()=>{postMediaWidth=Number(mediaWidthInput.value)||100;mediaWidthValue.value=postMediaWidth+'%';const media=mediaPreview.firstElementChild;if(media)media.style.width=postMediaWidth+'%';setStatus('UNSAVED');});
  ['post-main-text','post-lyrics','post-style-notes','post-learned','post-plain-text'].forEach(id=>$(id).addEventListener('input',()=>setStatus('UNSAVED')));

  function blankEditor(){
    openingPostToken++;editingId=null;slugManuallyEdited=false;postForm.reset();contentEditor.innerHTML='';postLayout='suno';postMediaWidth=100;layoutInput.value='suno';mediaWidthInput.value='100';mediaWidthValue.value='100%';syncLayoutFields();
    mediaUrl=null;mediaPath=null;mediaType=null;originalMediaPath=null;renderMediaPreview();message(mediaMessage,'');
    $('delete-post').hidden=true;
    $('editor-mode').textContent='NEW TRANSMISSION';setStatus('UNSAVED');message(saveMessage,'');
    $('save-draft').disabled=false;$('publish-post').disabled=false;
    document.querySelectorAll('.manage-item').forEach(x=>x.classList.remove('active'));
  }
  async function openPost(post){
    const token=++openingPostToken;
    message(saveMessage,'LOADING TRANSMISSION…');
    const {data:fullPost,error}=await client.from('vha_posts').select('*').eq('id',post.id).single();
    if(token!==openingPostToken)return;
    if(error||!fullPost){message(saveMessage,error?.message||'Could not load this post.',true);return;}
    post=fullPost;
    editingId=post.id;slugManuallyEdited=true;titleInput.value=post.title||'';slugInput.value=post.slug||'';
    categoryInput.value=post.category||'';excerptInput.value=post.excerpt||'';contentEditor.innerHTML=cleanHtml(post.content_html||'');
    postMediaWidth=Math.max(20,Math.min(100,Number(post.media_width)||100));mediaWidthInput.value=String(postMediaWidth);mediaWidthValue.value=postMediaWidth+'%';
    const savedDoc=new DOMParser().parseFromString(post.content_html||'','text/html');const suno=savedDoc.querySelector('.suno-post-layout'),plain=savedDoc.querySelector('.plain-post-layout');
    if(suno){postLayout='suno';$('post-main-text').value=htmlToEditorText(savedDoc.querySelector('.suno-text-column'),true);$('post-lyrics').value=savedDoc.querySelector('.suno-lyrics pre')?.textContent||'';$('post-style-notes').value=htmlToEditorText(savedDoc.querySelector('.suno-notes'),true);$('post-learned').value=htmlToEditorText(savedDoc.querySelector('.suno-learned'),true); }else if(plain){postLayout='plain';$('post-plain-text').value=htmlToEditorText(savedDoc.querySelector('.plain-copy'),true);}else postLayout='standard';layoutInput.value=postLayout;syncLayoutFields();
    mediaUrl=post.media_url||null;mediaPath=post.media_path||null;mediaType=post.media_type||null;originalMediaPath=post.media_path||null;
    mediaInput.value='';renderMediaPreview();message(mediaMessage,'');$('delete-post').hidden=false;
    $('editor-mode').textContent='EDIT TRANSMISSION';setStatus(post.status==='published'?'PUBLISHED':'DRAFT');
    message(saveMessage,'');renderPosts();
  }
  function renderPosts(){
    const posts=allPosts.filter(p=>statusFilter==='all'||p.status===statusFilter);
    if(!posts.length){managePosts.innerHTML='<p class="cms-help" style="padding:16px">No '+(statusFilter==='all'?'transmissions':statusFilter==='published'?'published posts':'drafts')+' yet. Start a new post.</p>';return;}
    managePosts.innerHTML=posts.map(p=>'<button type="button" class="manage-item '+(p.id===editingId?'active':'')+'" data-id="'+escapeHtml(p.id)+'"><strong>'+escapeHtml(p.title)+'</strong><small><span class="'+(p.status==='draft'?'draft-label':'published-label')+'">'+escapeHtml(p.status.toUpperCase())+'</span> · '+escapeHtml(p.category)+'<br>UPDATED '+new Date(p.updated_at).toLocaleDateString('en-GB')+'</small></button>').join('');
    managePosts.querySelectorAll('[data-id]').forEach(btn=>btn.addEventListener('click',()=>{const post=allPosts.find(p=>p.id===btn.dataset.id);if(post)openPost(post);}));
  }
  async function openRequestedPost(){
    if(requestedEditSlug){
      let post=allPosts.find(item=>item.slug===requestedEditSlug);
      if(!post){
        const {data,error}=await client.from('vha_posts').select('id,title,slug,category,status,updated_at,media_path').eq('slug',requestedEditSlug).maybeSingle();
        if(error){message(saveMessage,error.message,true);return;}
        post=data;
      }
      if(post)openPost(post);
      else message(saveMessage,'The requested post could not be found in the editor. It may have been deleted or is not accessible.',true);
      return;
    }
    if(requestedNewPost && ['THE AWAKENING','THE DESCENT','THE RECONNECTION','THE TRANSFORMATION','THE RETURN'].includes(requestedCategory)){
      blankEditor();
      categoryInput.value=requestedCategory;
      setStatus('NEW POST // '+requestedCategory);
      message(saveMessage,'New transmission for '+requestedCategory+'. Add the title and content, then save or publish.');
    }
  }
  async function loadPosts(reset = true){
    if(reset){postsOffset=0;allPosts=[];}
    managePosts.innerHTML=reset?'<p class="cms-help" style="padding:16px">Loading recent transmissions…</p>':managePosts.innerHTML;
    const start=postsOffset;
    const {data,error}=await client.from('vha_posts').select('id,title,slug,category,status,updated_at,media_path').order('updated_at',{ascending:false}).range(start,start+POSTS_PAGE_SIZE-1);
    if(error){managePosts.innerHTML='<p class="cms-message error" style="padding:16px">'+escapeHtml(error.message)+'</p>';return;}
    const items=data||[];allPosts=reset?items:allPosts.concat(items);postsOffset+=items.length;hasMorePosts=items.length===POSTS_PAGE_SIZE;
    renderPosts();$('load-more-posts').hidden=!hasMorePosts;
  }

  async function loadCommunitySubmissions(reset = true){
    const target=$('community-submissions');if(!target)return;
    if(reset){communityOffset=0;communityItems=[];target.innerHTML='<p class="cms-help">Loading recent community submissions…</p>';}
    const start=communityOffset;
    const {data,error}=await client.from('poetry_submissions').select('id,title,medium,body,byline,media_url,created_at,status').order('created_at',{ascending:false}).range(start,start+SUBMISSIONS_PAGE_SIZE-1);
    if(error){target.innerHTML='<p class="cms-message error">Could not load community submissions: '+escapeHtml(error.message)+'</p>';return;}
    const items=data||[];communityItems=reset?items:communityItems.concat(items);communityOffset+=items.length;hasMoreCommunity=items.length===SUBMISSIONS_PAGE_SIZE;
    if(!communityItems.length){target.innerHTML='<p class="cms-help">No visitor submissions yet.</p>';}
    else target.innerHTML=communityItems.map(item=>{
      const media=item.media_url?'<p><a href="'+escapeHtml(item.media_url)+'" target="_blank" rel="noopener noreferrer">OPEN ATTACHED MEDIA ↗</a></p>':'';
      const body=item.body?'<p class="community-submission-body">'+escapeHtml(item.body).replace(/\n/g,'<br>')+'</p>':'';
      const actions=item.status==='pending'?'<div class="community-submission-actions"><button type="button" class="cms-button primary vha-editor-action" data-action-variant="primary" data-submission-action="published" data-submission-id="'+escapeHtml(item.id)+'">APPROVE & PUBLISH</button><button type="button" class="cms-button danger vha-editor-action" data-action-variant="danger" data-submission-action="failed" data-submission-id="'+escapeHtml(item.id)+'">DECLINE</button></div>':'';
      return '<article class="community-submission"><div class="community-submission-top"><div><p class="gd-kicker">'+escapeHtml(item.medium.toUpperCase())+' // '+escapeHtml(item.byline||'ANONYMOUS')+'</p><h3>'+escapeHtml(item.title)+'</h3></div><span class="'+(item.status==='published'?'published-label':item.status==='pending'?'draft-label':'')+'">'+escapeHtml(item.status.toUpperCase())+'</span></div>'+body+media+'<small class="cms-help">RECEIVED '+new Date(item.created_at).toLocaleString('en-GB')+'</small>'+actions+'</article>';
    }).join('');
    $('load-more-submissions').hidden=!hasMoreCommunity;
  }
  $('refresh-submissions')?.addEventListener('click',()=>loadCommunitySubmissions(true));
  $('load-more-submissions')?.addEventListener('click',()=>loadCommunitySubmissions(false));
  $('load-more-posts')?.addEventListener('click',()=>loadPosts(false));
  $('community-submissions')?.addEventListener('click',async event=>{
    const button=event.target.closest('[data-submission-action]');if(!button)return;
    button.disabled=true;const status=button.dataset.submissionAction,id=button.dataset.submissionId;
    const {error}=await client.from('poetry_submissions').update({status,...(status==='published'?{published_at:new Date().toISOString()}:{})}).eq('id',id);
    if(error){button.disabled=false;alert('Could not update submission: '+error.message);return;}
    await loadCommunitySubmissions();
  });
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
    const resetPanel=$('password-reset-panel');
    if(new URLSearchParams(window.location.hash.slice(1)).get('type')==='recovery' && session?.user){
      $('login-panel').hidden=true;$('workspace').hidden=true;resetPanel.hidden=false;
      $('password-reset-message').textContent='Choose a new password for your account.';
      return;
    }
    if(session?.user&&await ensureAdmin(session.user)){currentUser=session.user;showWorkspace(currentUser);await loadPosts();await loadCommunitySubmissions();openRequestedPost();}else showLogin();
  }
  $('forgot-password')?.addEventListener('click',async()=>{
    const email=$('login-email').value.trim();
    if(!email){message(loginMessage,'Enter your account email above first, then request a reset link.',true);$('login-email').focus();return;}
    const button=$('forgot-password');button.disabled=true;message(loginMessage,'REQUESTING PASSWORD RESET…');
    try{
      const redirectTo=new URL('/landing-page/cms/',window.location.origin).href;
      const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo});
      if(error)throw error;
      message(loginMessage,'If an account exists for that email, a password reset link has been sent. Check your inbox and spam folder.');
    }catch(err){message(loginMessage,err.message||'Could not request a reset link.',true);}
    finally{button.disabled=false;}
  });
  $('password-reset-form')?.addEventListener('submit',async event=>{
    event.preventDefault();
    const password=$('new-password').value,confirmPassword=$('confirm-password').value;
    if(password.length<8){message($('password-reset-message'),'Use at least 8 characters.',true);return;}
    if(password!==confirmPassword){message($('password-reset-message'),'The passwords do not match.',true);return;}
    const button=event.currentTarget.querySelector('button');button.disabled=true;message($('password-reset-message'),'UPDATING PASSWORD…');
    try{
      const {error}=await client.auth.updateUser({password});
      if(error)throw error;
      await client.auth.signOut();
      window.history.replaceState({},document.title,window.location.pathname);
      $('password-reset-panel').hidden=true;showLogin();
      $('login-password').value='';
      message(loginMessage,'Password updated. Sign in with your new password.');
    }catch(err){message($('password-reset-message'),err.message||'Could not update the password. Request a fresh reset link and try again.',true);}
    finally{button.disabled=false;}
  });
  loginForm.addEventListener('submit',async event=>{
    event.preventDefault();message(loginMessage,'AUTHENTICATING…');
    const {data,error}=await client.auth.signInWithPassword({email:$('login-email').value.trim(),password:$('login-password').value});
    if(error){message(loginMessage,error.message,true);return;}
    if(!(await ensureAdmin(data.user)))return;
    currentUser=data.user;showWorkspace(currentUser);message(loginMessage,'');await loadPosts();await loadCommunitySubmissions();openRequestedPost();
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
    const previousSavedMediaPath=editingId?allPosts.find(p=>p.id===editingId)?.media_path||null:null;
    const composedHtml=buildPostContent();
    const payload={title,slug,category,excerpt:excerptInput.value.trim(),content_html:cleanHtml(composedHtml),media_url:mediaUrl,media_path:mediaPath,media_type:mediaType,media_width:postMediaWidth,status};
    if(status==='published'&&!payload.content_html.trim()){message(saveMessage,'Add some content before publishing.',true);return;}
    saving=true;$('save-draft').disabled=true;$('publish-post').disabled=true;message(saveMessage,status==='published'?'PUBLISHING…':'SAVING DRAFT…');
    try{
      let query=client.from('vha_posts');
      const result=editingId?await query.update(payload).eq('id',editingId).select().single():await query.insert(payload).select().single();
      if(result.error)throw result.error;
      editingId=result.data.id;slugManuallyEdited=true;
      if(previousSavedMediaPath&&previousSavedMediaPath!==mediaPath){
        const cleanup=await client.storage.from(MEDIA_BUCKET).remove([previousSavedMediaPath]);
        if(cleanup.error)message(mediaMessage,'Post saved, but the previous media file could not be removed: '+cleanup.error.message,true);
      }
      originalMediaPath=mediaPath;setStatus(status.toUpperCase());$('delete-post').hidden=false;
      if(status==='published'){
        const postUrl=new URL('../posts/',window.location.href);
        postUrl.searchParams.set('post',result.data.slug);
        window.location.assign(postUrl.toString());
        return;
      }
      message(saveMessage,'Draft saved. It remains private.');
      await loadPosts();renderPosts();
    }catch(err){message(saveMessage,err.message||'Could not save this post.',true);}
    finally{saving=false;$('save-draft').disabled=false;$('publish-post').disabled=false;}
  }
  mediaInput.addEventListener('change',async()=>{
    const file=mediaInput.files?.[0];if(!file)return;
    if(!ALLOWED_MEDIA.has(file.type)){message(mediaMessage,'Unsupported media format. Choose an image, supported audio, or video file (MP4, WebM, or MOV).',true);mediaInput.value='';return;}
    if(file.size>MAX_MEDIA_BYTES){message(mediaMessage,'That file exceeds the 30 MB limit.',true);mediaInput.value='';return;}
    const previous={url:mediaUrl,path:mediaPath,type:mediaType};
    mediaInput.disabled=true;message(mediaMessage,'UPLOADING MEDIA…');
    try{
      const safeName=file.name.toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(-100)||'upload';
      const path=currentUser.id+'/'+crypto.randomUUID()+'-'+safeName;
      const {error}=await client.storage.from(MEDIA_BUCKET).upload(path,file,{contentType:file.type,upsert:false,cacheControl:'3600'});
      if(error)throw error;
      const {data}=client.storage.from(MEDIA_BUCKET).getPublicUrl(path);
      mediaUrl=data.publicUrl;mediaPath=path;mediaType=file.type.startsWith('image/')?'image':file.type.startsWith('video/')?'video':'audio';
      renderMediaPreview();message(mediaMessage,'Media uploaded. Save or publish the post to attach it.');setStatus('UNSAVED');
      if(previous.path&&previous.path!==originalMediaPath)await client.storage.from(MEDIA_BUCKET).remove([previous.path]);
    }catch(err){message(mediaMessage,err.message||'Media upload failed.',true);mediaUrl=previous.url;mediaPath=previous.path;mediaType=previous.type;renderMediaPreview();}
    finally{mediaInput.disabled=false;}
  });
  $('remove-media').addEventListener('click',async()=>{
    const path=mediaPath;mediaUrl=null;mediaPath=null;mediaType=null;mediaInput.value='';renderMediaPreview();
    message(mediaMessage,'Media removed from this post. Save changes to confirm.');setStatus('UNSAVED');
    if(path&&path!==originalMediaPath){const {error}=await client.storage.from(MEDIA_BUCKET).remove([path]);if(error)message(mediaMessage,'Removed from the post draft, but uploaded file cleanup failed: '+error.message,true);}
  });
  $('delete-post').addEventListener('click',async()=>{
    if(!editingId||saving)return;
    const post=allPosts.find(p=>p.id===editingId);
    if(!confirm('Permanently delete “'+(post?.title||titleInput.value)+'”? This cannot be undone.'))return;
    saving=true;$('delete-post').disabled=true;$('save-draft').disabled=true;$('publish-post').disabled=true;message(saveMessage,'DELETING POST…');
    try{
      const id=editingId,path=post?.media_path||mediaPath;
      const {error}=await client.from('vha_posts').delete().eq('id',id);if(error)throw error;
      let cleanupError=null;if(path){const removal=await client.storage.from(MEDIA_BUCKET).remove([path]);cleanupError=removal.error;}
      allPosts=allPosts.filter(p=>p.id!==id);blankEditor();renderPosts();
      message(saveMessage,cleanupError?'Post deleted, but media cleanup failed: '+cleanupError.message:'Post deleted.');
    }catch(err){message(saveMessage,err.message||'Could not delete this post.',true);}
    finally{saving=false;$('delete-post').disabled=false;$('save-draft').disabled=false;$('publish-post').disabled=false;}
  });
  client?.auth.onAuthStateChange((_event,session)=>{
    if(!session){currentUser=null;showLogin();}
  });
  restoreSession();
})();