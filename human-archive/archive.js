(()=>{'use strict';
const search=document.getElementById('ha-search'),year=document.getElementById('ha-year'),category=document.getElementById('ha-category'),list=document.getElementById('ha-list'),count=document.getElementById('ha-count'),mediaStatus=document.getElementById('ha-media-status');
const newTransmissionButton=document.getElementById('ha-new-transmission'),createTransmissionStatus=document.getElementById('ha-create-status');
const archiveHomeUrl=new URL('./',window.location.href);
let flushActiveChamberAutosave=async()=>true;
let records=[],mediaItems=[],mediaMap=new Map(),mediaByPost=new Map(),mediaReady=false,publicBase='';
let imageViewer=null,imageViewerImage=null,imageViewerCaption=null,imageViewerZoom=null,imageViewerOriginal=null,imageViewerClose=null;
const expandedCategories=new Set();
const categoryOrder=['Nimic și Ființă','This notion','Dialog monolog','Gânduri','Cântec','Belief','Snob','PERSONAL PROJECTS','Haiku'];
const transmissionCategories=['HUMAN ARCHIVE','THE AWAKENING','THE DESCENT','THE RECONNECTION','THE TRANSFORMATION','THE RETURN'];

// Human Archive chamber state and public Supabase configuration.
let chamberRecordId=null;
const SUPABASE_URL='https://oeyxsqocldlovhsmzcjw.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_kuUFxaClmROwgZpGIw6bzg_ddvb521h';
let archiveSupabase=null,archiveAdmin=false,archiveUserId=null,archiveAuthBound=false;
let favoriteRecordIds=new Set(),favoriteSaveError=false,recordStructureOverrides=new Map();
let mediaHashByPath=new Map();
let recordChamber=null,recordChamberReturnFocus=null;

const clean=value=>String(value??'').normalize('NFKC').toLocaleLowerCase().trim();
function slugifyArchiveTitle(value){
 const transliteration={'ß':'ss','ẞ':'ss','æ':'ae','Æ':'ae','œ':'oe','Œ':'oe','ø':'o','Ø':'o','ł':'l','Ł':'l','đ':'d','Đ':'d','ð':'d','Ð':'d','þ':'th','Þ':'th'};
 return String(value||'').replace(/[ßẞæÆœŒøØłŁđĐðÐþÞ]/g,char=>transliteration[char]||char)
  .normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase()
  .replace(/&/g,' and ').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
}
function assignArchiveSlugs(items){
 const used=new Set();
 return items.map(record=>{
  const base=slugifyArchiveTitle(record.title)||('record-'+record.id);
  let slug=base,suffix=2;
  while(used.has(slug)){slug=base+'-'+suffix;suffix++;}
  used.add(slug);
  const dateParts=String(record.date||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const identifier=dateParts?'HA-'+dateParts[1]+'-'+dateParts[2]+dateParts[3]+'-'+slug:'HA-'+record.year+'-'+slug;
  return {...record,slug,archiveIdentifier:identifier};
 });
}


function isWordPressHost(host){
 host=String(host||'').toLowerCase();
 return host==='emanuelstefancu.com'||host==='www.emanuelstefancu.com'||host==='emanuelstefancu.wordpress.com'||host.endsWith('.wordpress.com')||host.endsWith('.wp.com');
}
function urlKey(raw){
 try{
  const url=new URL(String(raw||''),document.baseURI);
  const host=url.hostname.toLowerCase();
  return (isWordPressHost(host)?'wp:':host+':')+url.pathname;
 }catch{return '';}
}
function localMediaUrl(item){
 if(item?.storage==='vha-post-media')return safeExternalUrl(item.url,new Set(['oeyxsqocldlovhsmzcjw.supabase.co']))||'';
 const path=String(item.storage_path||'').split('/').map(part=>encodeURIComponent(part)).join('/');
 return publicBase+path;
}
function getMedia(raw){return mediaMap.get(urlKey(raw))||null;}
function markUsed(item,used){if(item&&used)used.add(String(item.id));}
function appendMissing(parent,label){
 const notice=document.createElement('span');
 notice.className='ha-media-unavailable';
 notice.textContent=label||'Media file is not present in the recovered collection.';
 parent.append(notice);
}
function safeExternalUrl(raw,allowedHosts){
 try{
  const url=new URL(String(raw||''),document.baseURI);
  if(url.protocol!=='https:'||!url.hostname||url.username||url.password||!allowedHosts.has(url.hostname.toLowerCase()))return null;
  return url.href;
 }catch{return null;}
}
function mediaTitle(item,record){
 return String(item.title||record.title||'Archive media').replace(/&nbsp;/g,' ').trim();
}
function ensureImageViewer(){
 if(imageViewer)return;
 imageViewer=document.createElement('dialog');imageViewer.className='ha-image-viewer';imageViewer.setAttribute('aria-label','Archive image viewer');
 const panel=document.createElement('div');panel.className='ha-image-viewer-panel';
 const toolbar=document.createElement('div');toolbar.className='ha-image-viewer-toolbar';
 imageViewerCaption=document.createElement('span');imageViewerCaption.className='ha-image-viewer-caption';
 imageViewerZoom=document.createElement('button');imageViewerZoom.type='button';imageViewerZoom.className='ha-image-viewer-control';imageViewerZoom.textContent='VIEW ORIGINAL SIZE';
 imageViewerOriginal=document.createElement('a');imageViewerOriginal.className='ha-image-viewer-control';imageViewerOriginal.target='_blank';imageViewerOriginal.rel='noopener noreferrer';imageViewerOriginal.textContent='OPEN ORIGINAL FILE ↗';
 imageViewerClose=document.createElement('button');imageViewerClose.type='button';imageViewerClose.className='ha-image-viewer-control ha-image-viewer-close';imageViewerClose.textContent='CLOSE ✕';imageViewerClose.addEventListener('click',()=>imageViewer.close());
 toolbar.append(imageViewerCaption,imageViewerZoom,imageViewerOriginal,imageViewerClose);
 const stage=document.createElement('div');stage.className='ha-image-viewer-stage';
 imageViewerImage=document.createElement('img');imageViewerImage.className='ha-image-viewer-image';imageViewerImage.alt='';imageViewerImage.addEventListener('click',()=>setImageViewerZoom(!imageViewer.classList.contains('is-zoomed')));
 stage.append(imageViewerImage);panel.append(toolbar,stage);imageViewer.append(panel);document.body.append(imageViewer);
 imageViewerZoom.addEventListener('click',()=>setImageViewerZoom(!imageViewer.classList.contains('is-zoomed')));
 imageViewer.addEventListener('click',event=>{if(event.target===imageViewer)imageViewer.close();});
 imageViewer.addEventListener('close',()=>setImageViewerZoom(false));
}
function setImageViewerZoom(zoomed){
 if(!imageViewer)return;
 imageViewer.classList.toggle('is-zoomed',Boolean(zoomed));
 if(imageViewerZoom)imageViewerZoom.textContent=zoomed?'FIT TO SCREEN':'VIEW ORIGINAL SIZE';
}
function openImageSourceViewer(src,label,alt){
 ensureImageViewer();
 imageViewerCaption.textContent=label;
 imageViewerImage.src=src;imageViewerImage.alt=alt||label;
 imageViewerOriginal.href=src;
 setImageViewerZoom(false);
 imageViewer.showModal();
 imageViewerClose.focus();
}
function openImageViewer(item,record){
 const label=mediaTitle(item,record);
 openImageSourceViewer(localMediaUrl(item),label,item.alt_text||label);
}
function bindEgoPortraitViewer(){
 const portraitWrap=document.querySelector('.ha-ego-portrait-wrap');
 const portrait=portraitWrap?.querySelector('.ha-ego-portrait');
 if(!portraitWrap||!portrait)return;
 const open=()=>openImageSourceViewer(portrait.currentSrc||portrait.src,'EGO // MEMORIAL NODE 001',portrait.alt);
 portraitWrap.addEventListener('click',open);
 portraitWrap.addEventListener('keydown',event=>{
  if(event.key==='Enter'||event.key===' '){event.preventDefault();open();}
 });
}
function openRelatedRecord(record){
 search.value=record.title;year.value='';category.value='';
 (record.categories||[]).forEach(name=>expandedCategories.add(name));
 render();
 const target=document.getElementById('ha-record-'+record.id);
 if(target){
  target.hidden=false;
  const control=target.previousElementSibling;
  if(control){control.setAttribute('aria-expanded','true');const action=control.querySelector('.ha-entry-bottom span');if(action)action.textContent='CLOSE LOCAL TEXT ↑';}
  target.scrollIntoView({behavior:'smooth',block:'center'});
 }
}
function makeRelatedRecordButton(record,label){
 const button=document.createElement('button');button.type='button';button.className='ha-related-record-link';
 button.textContent=label||'OPEN RELATED LOCAL RECORD — '+record.title;
 button.setAttribute('aria-label','Open local archive record: '+record.title);
 button.addEventListener('click',()=>openRelatedRecord(record));
 return button;
}
function appendLocalImage(parent,item,record,used){
 const embedded=parent.tagName==='FIGURE';
 const figure=embedded?parent:document.createElement('figure');figure.classList.add('ha-local-media','ha-local-image');
 const img=document.createElement('img');img.src=localMediaUrl(item);img.alt=item.alt_text||mediaTitle(item,record);img.loading='lazy';img.decoding='async';
 const open=document.createElement('button');open.type='button';open.className='ha-image-open';open.setAttribute('aria-label','Open image full screen: '+mediaTitle(item,record));open.title='Open image full screen';open.append(img);
 open.addEventListener('click',()=>openImageViewer(item,record));
 figure.append(open);
 const caption=item.alt_text||mediaTitle(item,record);
 if(caption&&!embedded){const figcaption=document.createElement('figcaption');figcaption.textContent=caption;figure.append(figcaption);}
 if(!embedded)parent.append(figure);markUsed(item,used);
}
function appendLocalAudio(parent,item,record,used){
 const embedded=parent.tagName==='FIGURE';
 const figure=embedded?parent:document.createElement('figure');figure.classList.add('ha-local-media','ha-local-audio');
 if(!embedded){const title=document.createElement('figcaption');title.textContent=mediaTitle(item,record);figure.append(title);}
 const audio=document.createElement('audio');audio.controls=true;audio.preload='metadata';audio.src=localMediaUrl(item);audio.setAttribute('aria-label','Audio: '+mediaTitle(item,record));figure.append(audio);
 if(!embedded)parent.append(figure);markUsed(item,used);
}
function appendLocalVideo(parent,item,record,used){
 const embedded=parent.tagName==='FIGURE';
 const figure=embedded?parent:document.createElement('figure');figure.classList.add('ha-local-media','ha-local-video');
 const video=document.createElement('video');video.controls=true;video.preload='metadata';video.playsInline=true;video.src=localMediaUrl(item);video.setAttribute('aria-label','Video: '+mediaTitle(item,record));figure.append(video);
 if(!embedded){const title=document.createElement('figcaption');title.textContent=mediaTitle(item,record);figure.append(title);parent.append(figure);}
 markUsed(item,used);
}
function appendMediaLink(parent,item,record,used){
 const link=document.createElement('a');link.className='ha-local-media-link';link.href=localMediaUrl(item);link.target='_blank';link.rel='noopener noreferrer';link.textContent='OPEN FILE — '+mediaTitle(item,record);parent.append(link);markUsed(item,used);
}
function appendSafeContent(container,source,record,used){
 const doc=new DOMParser().parseFromString(String(source||''),'text/html');
 const allowed=new Set(['P','BR','STRONG','B','EM','I','U','H2','H3','H4','UL','OL','LI','BLOCKQUOTE','HR','PRE','CODE','A','FIGURE','FIGCAPTION','DIV','SPAN','SMALL','SUP','SUB','TABLE','THEAD','TBODY','TR','TH','TD']);
 const blocked=new Set(['SCRIPT','STYLE','OBJECT','EMBED','SVG','MATH','FORM','INPUT','BUTTON','TEXTAREA','SELECT','OPTION','LINK','META']);
 const iframeHosts=new Set(['www.youtube.com','www.youtube-nocookie.com','open.spotify.com','w.soundcloud.com']);
 const layoutClasses=new Set(['suno-post-layout','suno-text-column','suno-lyrics','suno-notes','suno-style-prompt','suno-learned','suno-chatgpt-learned','suno-label','plain-post-layout','plain-copy','plain-response']);
 function copy(node,parent){
  if(node.nodeType===Node.TEXT_NODE){parent.append(document.createTextNode(node.nodeValue||''));return;}
  if(node.nodeType!==Node.ELEMENT_NODE)return;
  const tag=node.tagName;
  if(blocked.has(tag))return;
  if(tag==='IMG'){
   const item=getMedia(node.getAttribute('src')||node.getAttribute('data-src')||'');
   if(item&&(mediaReady||item.storage==='vha-post-media')){appendLocalImage(parent,item,record,used);}
   else appendMissing(parent,'Image not yet available in the recovered media collection.');
   return;
  }
  if(tag==='AUDIO'||tag==='VIDEO'){
   const item=getMedia(node.getAttribute('src')||'');
   if(item&&(mediaReady||item.storage==='vha-post-media')){if(tag==='AUDIO')appendLocalAudio(parent,item,record,used);else appendLocalVideo(parent,item,record,used);return;}
   const mediaNode=document.createElement(tag.toLowerCase());mediaNode.controls=true;mediaNode.preload='metadata';
   node.childNodes.forEach(child=>copy(child,mediaNode));
   if(mediaNode.childNodes.length){parent.append(mediaNode);return;}
   appendMissing(parent,'Audio/video file not yet available in the recovered media collection.');return;
  }
  if(tag==='SOURCE'){
   const item=getMedia(node.getAttribute('src')||'');
   if(item&&(mediaReady||item.storage==='vha-post-media')&&(parent.tagName==='AUDIO'||parent.tagName==='VIDEO')){
    const source=document.createElement('source');source.src=localMediaUrl(item);source.type=item.mime_type;parent.append(source);markUsed(item,used);
   }
   return;
  }
  if(tag==='IFRAME'){
   try{
    const original=new URL(node.getAttribute('src')||'',document.baseURI);
    const sourceHost=original.hostname.toLowerCase();
    if(isWordPressHost(sourceHost)){
     original.pathname=original.pathname.replace(/\/embed\/?$/,'/');
     const related=records.find(item=>urlKey(item.url)===urlKey(original.href));
     if(related){parent.append(makeRelatedRecordButton(related));return;}
     appendMissing(parent,'The original WordPress embed is not available as a local archive record.');return;
    }
   }catch{}
   const src=safeExternalUrl(node.getAttribute('src'),iframeHosts);
   if(!src){appendMissing(parent,'This embedded media provider is not on the archive allowlist.');return;}
   const frame=document.createElement('iframe');frame.src=src;frame.title=node.getAttribute('title')||('Embedded media in '+record.title);
   frame.loading='lazy';frame.referrerPolicy='strict-origin-when-cross-origin';frame.allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
   frame.allowFullscreen=true;frame.className='ha-archive-embed';parent.append(frame);return;
  }
  if(!allowed.has(tag)){node.childNodes.forEach(child=>copy(child,parent));return;}
  const el=document.createElement(tag.toLowerCase());
  if(tag==='A'){
   const href=node.getAttribute('href')||'';
   const media=getMedia(href);
   if(media&&(mediaReady||media.storage==='vha-post-media')){el.href=localMediaUrl(media);el.target='_blank';el.rel='noopener noreferrer';markUsed(media,used);}
   else{
    try{
     const url=new URL(href,document.baseURI);
     if(isWordPressHost(url.hostname)){
      const related=records.find(item=>urlKey(item.url)===urlKey(url.href));
      if(related){
       const button=makeRelatedRecordButton(related,'');
       node.childNodes.forEach(child=>copy(child,button));
       if(!button.textContent.trim())button.textContent=related.title;
       parent.append(button);
      }else node.childNodes.forEach(child=>copy(child,parent));
      return;
     }
     if(url.protocol==='https:'&&url.hostname&&!url.username&&!url.password){el.href=url.href;el.target='_blank';el.rel='noopener noreferrer';}
    }catch{}
   }
  }
  if(tag==='TD'||tag==='TH'){const span=node.getAttribute('colspan');if(span&&/^\d{1,2}$/.test(span))el.colSpan=Number(span);}
  if(node.hasAttribute('class')){const classes=(node.getAttribute('class')||'').split(/\s+/).filter(name=>layoutClasses.has(name));if(classes.length)el.className=classes.join(' ');}
  node.childNodes.forEach(child=>copy(child,el));parent.append(el);
 }
 doc.body.childNodes.forEach(node=>copy(node,container));
}
function makeAttachmentGallery(record,used){
 const remaining=mediaItems.filter(item=>(item.post_ids||[]).includes(record.id)&&!used.has(String(item.id)));
 if(!remaining.length)return null;
 const section=document.createElement('section');section.className='ha-attachment-gallery';
 const heading=document.createElement('h4');heading.textContent='ATTACHED MEDIA // '+String(remaining.length).padStart(2,'0')+' FILES';section.append(heading);
 const grid=document.createElement('div');grid.className='ha-attachment-grid';
 remaining.forEach(item=>{
  if(item.mime_type.startsWith('image/'))appendLocalImage(grid,item,record,used);
  else if(item.mime_type.startsWith('audio/'))appendLocalAudio(grid,item,record,used);
  else if(item.mime_type.startsWith('video/'))appendLocalVideo(grid,item,record,used);
  else appendMediaLink(grid,item,record,used);
 });
 section.append(grid);return section;
}

function syncFavoriteControls(){
 document.querySelectorAll('[data-ha-favorite-id]').forEach(button=>{
  const id=String(button.dataset.haFavoriteId||''),isFavorite=favoriteRecordIds.has(id),title=records.find(record=>String(record.id)===id)?.title||'record';
  button.hidden=!archiveAdmin;button.disabled=!archiveAdmin;button.textContent=isFavorite?'★':'☆';button.setAttribute('aria-pressed',String(isFavorite));
  button.setAttribute('aria-label',favoriteSaveError?'Saving the favourite failed. Activate to retry.':(isFavorite?'Remove '+title+' as an author favourite':'Mark '+title+' as an author favourite'));
  button.title=favoriteSaveError?'SAVE FAILED — ACTIVATE TO RETRY':(isFavorite?'REMOVE AUTHOR FAVOURITE':(archiveAdmin?'MARK AS FAVOURITE':''));
  button.classList.toggle('is-error',favoriteSaveError);button.classList.toggle('is-saved',isFavorite);
 });
 document.querySelectorAll('[data-ha-favorite-mark]').forEach(mark=>{mark.hidden=!favoriteRecordIds.has(String(mark.dataset.haFavoriteMark||''));});
}
async function loadArchiveFavorites(){
 if(!archiveSupabase)return;
 const {data,error}=await archiveSupabase.from('human_archive_favorites').select('record_id');
 if(error){console.warn('Human Archive favourites could not be loaded:',error);return;}
 favoriteRecordIds=new Set((data||[]).map(item=>String(item.record_id)));
}
async function loadRecordStructureOverrides(){
 if(!archiveSupabase)return;
 const {data,error}=await archiveSupabase.from('human_archive_record_structures').select('record_id,transmission_body,prompt_style,lyrics_style,output_text,output_media,updated_at');
 if(error){console.warn('Human Archive structures could not be loaded:',error);return;}
 recordStructureOverrides=new Map((data||[]).map(item=>[String(item.record_id),item]));
}
async function loadTransmissionRecords(){
 if(!archiveSupabase)return;
 records=records.filter(record=>record.source_type!=='transmission');
 mediaItems=mediaItems.filter(item=>item.storage!=='vha-post-media');
 for(const [key,item] of mediaMap){if(item.storage==='vha-post-media')mediaMap.delete(key);}
 let query=archiveSupabase.from('vha_posts').select('id,archive_record_id,title,slug,category,excerpt,content_html,status,created_at,published_at,media_items,media_url,media_path,media_type,media_width').order('created_at',{ascending:false});
 if(!archiveAdmin)query=query.eq('status','published');
 const {data,error}=await query;
 if(error){console.warn('Database-backed Transmissions could not be loaded into Human Archive:',error);return;}
 const additions=(data||[]).filter(post=>Number.isSafeInteger(Number(post.archive_record_id))&&post.slug).map(post=>{
  const id=Number(post.archive_record_id),stamp=post.published_at||post.created_at||new Date().toISOString();
  const date=String(stamp).slice(0,10),year=date.slice(0,4);
  const sourceItems=Array.isArray(post.media_items)&&post.media_items.length?post.media_items:(post.media_url?[{url:post.media_url,path:post.media_path,type:post.media_type||'audio',name:post.title}]:[]);
  const attached=sourceItems.filter(item=>item&&typeof item.url==='string'&&['image','audio','video'].includes(item.type)).map((item,index)=>({
   id:'transmission-'+post.id+'-'+index,title:item.name||post.title,alt_text:item.name||post.title,
   mime_type:item.type==='image'?'image/unknown':item.type==='video'?'video/unknown':'audio/unknown',
   storage_path:String(item.path||''),source_url:item.url,url:item.url,storage:'vha-post-media',post_ids:[id]
  }));
  return {id,title:post.title,slug:post.slug,archiveIdentifier:'HA-'+year+'-'+String(id).padStart(4,'0'),year,date,url:'',categories:[post.category||'TRANSMISSIONS'],content_html:post.content_html||'',source_type:'transmission',post_id:post.id,status:post.status,excerpt:post.excerpt||'',media_items:attached,created_at:post.created_at,published_at:post.published_at,updated_at:post.updated_at,media_width:post.media_width||100};
 });
 const existingIds=new Set(records.map(record=>String(record.id)));
 const unique=additions.filter(record=>!existingIds.has(String(record.id)));
 unique.forEach(record=>{
  records.push(record);
  record.media_items.forEach(item=>{mediaItems.push(item);if(item.url)mediaMap.set(urlKey(item.url),item);});
  const name=record.categories[0];
  if(!categoryOrder.includes(name))categoryOrder.push(name);
  if(![...category.options].some(option=>option.value===name)){const option=document.createElement('option');option.value=name;option.textContent=name;category.append(option);}
  expandedCategories.add(name);
 });
}
async function refreshArchiveAdmin(sessionOverride){
 if(!archiveSupabase){archiveAdmin=false;archiveUserId=null;return false;}
 let session=sessionOverride;
 if(sessionOverride===undefined){
  const result=await archiveSupabase.auth.getSession();
  if(result.error){archiveAdmin=false;archiveUserId=null;return false;}
  session=result.data?.session;
 }
 if(!session?.user){archiveAdmin=false;archiveUserId=null;return false;}
 const {data,error}=await archiveSupabase.from('vha_cms_admins').select('user_id').eq('user_id',session.user.id).maybeSingle();
 archiveAdmin=!error&&Boolean(data);
 archiveUserId=archiveAdmin?session.user.id:null;
 return archiveAdmin;
}
async function toggleArchiveFavorite(recordId,button){
 const id=String(recordId);
 if(!archiveAdmin||!archiveSupabase||!/^[0-9]+$/.test(id)||button.disabled)return;
 const wasFavorite=favoriteRecordIds.has(id);button.disabled=true;favoriteSaveError=false;
 button.title=wasFavorite?'REMOVING FAVOURITE…':'SAVING FAVOURITE…';
 try{
  const result=wasFavorite?await archiveSupabase.from('human_archive_favorites').delete().eq('record_id',Number(id)):await archiveSupabase.from('human_archive_favorites').insert({record_id:Number(id)});
  if(result.error&&!(result.error.code==='23505'&&!wasFavorite))throw result.error;
  if(wasFavorite)favoriteRecordIds.delete(id);else favoriteRecordIds.add(id);
 }catch(error){console.error('Human Archive favourite could not be saved:',error);favoriteSaveError=true;}
 finally{document.querySelectorAll('[data-ha-favorite-id="'+id+'"]').forEach(control=>{control.disabled=!archiveAdmin;});syncFavoriteControls();}
}
function chamberShareUrl(record){
 return new URL(encodeURIComponent(record.slug),new URL('./',window.location.href)).href;
}
function makeChamberNode(tag,className,text){
 const node=document.createElement(tag);
 if(className)node.className=className;
 if(text!==undefined&&text!==null)node.textContent=String(text);
 return node;
}
async function copyChamberLink(url,status){
 try{
  if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(url);
  else{
   const field=makeChamberNode('textarea','',url);field.setAttribute('readonly','');field.style.position='fixed';field.style.opacity='0';document.body.append(field);field.select();
   const copied=document.execCommand('copy');field.remove();if(!copied)throw new Error('Clipboard access is unavailable');
  }
  status.textContent='LINK COPIED TO CLIPBOARD';
 }catch(error){console.warn('Could not copy Human Archive link:',error);status.textContent='COPY FAILED — USE THE ADDRESS BAR LINK';}
}
function appendChamberShareActions(parent,record,status){
 const url=chamberShareUrl(record),encodedUrl=encodeURIComponent(url),encodedTitle=encodeURIComponent(record.title);
 const nativeShare=makeChamberNode('button','ha-chamber-share-action','↗ SHARE');
 nativeShare.type='button';
 nativeShare.addEventListener('click',async()=>{
  if(navigator.share){
   try{await navigator.share({title:record.title,text:'A record from the Human Archive',url});status.textContent='SHARE SHEET OPENED';return;}
   catch(error){if(error?.name==='AbortError')return;}
  }
  await copyChamberLink(url,status);
 });
 const copy=makeChamberNode('button','ha-chamber-share-action','COPY LINK');
 copy.type='button';copy.addEventListener('click',()=>copyChamberLink(url,status));
 const links=[
  ['FACEBOOK','https://www.facebook.com/sharer/sharer.php?u='+encodedUrl],
  ['X','https://twitter.com/intent/tweet?url='+encodedUrl+'&text='+encodedTitle],
  ['LINKEDIN','https://www.linkedin.com/sharing/share-offsite/?url='+encodedUrl],
  ['WHATSAPP','https://wa.me/?text='+encodedTitle+'%20'+encodedUrl],
  ['EMAIL','mailto:?subject='+encodedTitle+'&body='+encodedUrl]
 ];
 parent.append(nativeShare,copy);
 links.forEach(([label,href])=>{const link=makeChamberNode('a','ha-chamber-share-action',label);link.href=href;link.target='_blank';link.rel='noopener noreferrer';parent.append(link);});
}
function defaultRecordOutputText(record){
 const parsed=new DOMParser().parseFromString(String(record.content_html||''),'text/html');
 parsed.body.querySelectorAll('figure,iframe,img,audio,video,source,object,embed,script,style').forEach(node=>node.remove());
 const read=node=>{
  if(node.nodeType===Node.TEXT_NODE)return node.nodeValue||'';
  if(node.nodeType!==Node.ELEMENT_NODE)return '';
  if(node.tagName==='BR')return '\n';
  const value=[...node.childNodes].map(read).join('');
  return ['P','DIV','LI','H2','H3','H4','BLOCKQUOTE'].includes(node.tagName)?value+'\n\n':value;
 };
 return read(parsed.body).replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
}
function getRecordStructure(record){
 const saved=recordStructureOverrides.get(String(record.id));
 return {
  transmission_body:record.source_type==='transmission'?String(record.content_html||saved?.transmission_body||''):(typeof saved?.transmission_body==='string'?saved.transmission_body:''),
  prompt_style:String(saved?.prompt_style||''),
  lyrics_style:String(saved?.lyrics_style||''),
  output_text:typeof saved?.output_text==='string'?saved.output_text:defaultRecordOutputText(record),
  output_media:saved?.output_media&&typeof saved.output_media==='object'&&!Array.isArray(saved.output_media)?saved.output_media:null
 };
}
function uniqueRecordMedia(record,mimePrefix){
 const items=mediaItems.filter(item=>(item.post_ids||[]).some(id=>String(id)===String(record.id))&&String(item.mime_type||'').startsWith(mimePrefix));
 if(mimePrefix==='audio/')items.sort((a,b)=>Number(clean(b.title)===clean(record.title))-Number(clean(a.title)===clean(record.title)));
 const seen=new Set();
 return items.filter(item=>{
  const path=String(item.storage_path||'');
  const hash=mediaHashByPath.get(path)||'';
  const key=hash?'sha256:'+hash:(path?'path:'+path:'id:'+String(item.id));
  if(seen.has(key))return false;
  seen.add(key);return true;
 });
}
function mediaName(item,record){
 return String(item?.name||item?.title||record.title||'Archive media').replace(/&nbsp;/g,' ').trim();
}
function defaultChamberOutputMedia(record,type){
 const prefix=type==='image'?'image/':type==='audio'?'audio/':'video/';
 const recovered=uniqueRecordMedia(record,prefix).filter(item=>mediaReady||item.storage==='vha-post-media').map(item=>({
  id:'recovered-'+String(item.id),
  name:mediaTitle(item,record),
  url:localMediaUrl(item),
  path:String(item.storage_path||''),
  mime_type:String(item.mime_type||''),
  storage:item.storage==='vha-post-media'?'vha-post-media':'recovered'
 }));
 if(type!=='video')return recovered;
 const allowedHosts=new Set(['www.youtube.com','www.youtube-nocookie.com']);
 const parsed=new DOMParser().parseFromString(String(record.content_html||''),'text/html');
 const seen=new Set();
 const embeds=[...parsed.querySelectorAll('iframe[src]')].map(frame=>safeExternalUrl(frame.getAttribute('src'),allowedHosts)).filter(Boolean).filter(src=>{
  const key=new URL(src).origin+new URL(src).pathname;
  if(seen.has(key))return false;
  seen.add(key);return true;
 }).map((url,index)=>({id:'external-video-'+index,name:record.title+' — embedded video',url,mime_type:'video/embed',storage:'external'}));
 return [...embeds,...recovered];
}
function getRecordOutputMedia(record,structure,type){
 const saved=structure.output_media;
 if(saved&&Object.prototype.hasOwnProperty.call(saved,type)&&Array.isArray(saved[type]))return saved[type];
 return defaultChamberOutputMedia(record,type);
}
function resolveChamberMediaUrl(item,type){
 if(!item||typeof item.url!=='string')return null;
 if(item.storage==='external'){
  return type==='video'?safeExternalUrl(item.url,new Set(['www.youtube.com','www.youtube-nocookie.com'])):null;
 }
 const allowedHost=item.storage==='recovered'?'ioguymqdeuuursizifnn.supabase.co':
  (item.storage==='vha-post-media'?'oeyxsqocldlovhsmzcjw.supabase.co':'');
 if(!allowedHost)return null;
 try{
  const url=new URL(item.url);
  if(url.protocol!=='https:'||url.hostname.toLowerCase()!==allowedHost||url.username||url.password)return null;
  return url.href;
 }catch{return null;}
}
function appendChamberMedia(section,record,type,items){
 if(!items.length){
  const note=!mediaReady&&!(recordStructureOverrides.get(String(record.id))?.output_media?.[type])
   ?'MEDIA VAULT NOT VERIFIED // NO EDITED FILES AVAILABLE':'NO '+type.toUpperCase()+' OUTPUT IS ATTACHED TO THIS RECORD.';
  section.append(makeChamberNode('p','ha-chamber-note',note));
  return;
 }
 const gallery=makeChamberNode('div',type==='audio'?'ha-chamber-audio-list':'ha-chamber-media-grid');
 items.forEach(item=>{
  const src=resolveChamberMediaUrl(item,type);
  if(!src){appendMissing(gallery,'A media item has an invalid or unsupported source URL.');return;}
  const name=mediaName(item,record);
  const figure=makeChamberNode('figure','ha-local-media ha-local-'+type+' ha-chamber-media-item');
  if(type==='image'){
   const img=document.createElement('img');img.src=src;img.alt=name;img.loading='lazy';img.decoding='async';
   const open=makeChamberNode('button','ha-image-open');open.type='button';open.setAttribute('aria-label','Open image full screen: '+name);open.append(img);
   open.addEventListener('click',()=>openImageSourceViewer(src,name,name));
   figure.append(open);
  }else if(type==='audio'){
   const audio=document.createElement('audio');audio.controls=true;audio.preload='metadata';audio.src=src;audio.setAttribute('aria-label','Audio: '+name);figure.append(audio);
  }else if(item.storage==='external'){
   const frame=document.createElement('iframe');frame.className='ha-chamber-video-frame';frame.src=src;frame.title=name;frame.loading='lazy';
   frame.referrerPolicy='strict-origin-when-cross-origin';frame.allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';frame.allowFullscreen=true;figure.append(frame);
  }else{
   const video=document.createElement('video');video.controls=true;video.preload='metadata';video.playsInline=true;video.src=src;video.setAttribute('aria-label','Video: '+name);figure.append(video);
  }
  const caption=makeChamberNode('figcaption','',name);figure.append(caption);gallery.append(figure);
 });
 section.append(gallery);
}
function makeChamberDisclosure(label,className,summaryClass){
 const details=makeChamberNode('details','ha-chamber-disclosure '+(className||''));details.open=true;details.dataset.haDisclosure='true';
 const summary=makeChamberNode('summary',summaryClass||'ha-chamber-panel-heading',label);
 summary.setAttribute('aria-label',label+' — expand or retract');
 const body=makeChamberNode('div','ha-chamber-disclosure-body');
 details.append(summary,body);
 return {details,body};
}
function syncChamberExpandButton(grid,button){
 if(!button)return;
 const disclosures=[...grid.querySelectorAll('details[data-ha-disclosure]')];
 const allOpen=disclosures.length>0&&disclosures.every(item=>item.open);
 button.textContent=allOpen?'SEAL ALL ↑':'UNSEAL ALL ↓';
 button.setAttribute('aria-expanded',String(allOpen));
 button.setAttribute('aria-label',allOpen?'Retract all chamber sections':'Expand all chamber sections');
}
function bindChamberDisclosureControls(grid,button){
 grid.querySelectorAll('details[data-ha-disclosure]').forEach(details=>{
  details.addEventListener('toggle',()=>syncChamberExpandButton(grid,button));
 });
 syncChamberExpandButton(grid,button);
}
function sanitizeTransmissionBody(source){
 const parsed=new DOMParser().parseFromString(String(source||''),'text/html');
 const allowed=new Set(['P','BR','STRONG','B','EM','I','U','H2','H3','BLOCKQUOTE','UL','OL','LI','A','HR','CODE','PRE','DIV','SECTION','ASIDE','DETAILS','SUMMARY']);
 const allowedClasses=new Set(['suno-post-layout','suno-text-column','suno-lyrics','suno-notes','suno-style-prompt','suno-learned','suno-chatgpt-learned','suno-label','plain-post-layout','plain-copy','plain-response']);
 function copy(node,parent){
  if(node.nodeType===Node.TEXT_NODE){parent.append(document.createTextNode(node.nodeValue||''));return;}
  if(node.nodeType!==Node.ELEMENT_NODE)return;
  if(!allowed.has(node.tagName)){node.childNodes.forEach(child=>copy(child,parent));return;}
  const element=document.createElement(node.tagName.toLowerCase());
  if(node.tagName==='A'){
   const raw=(node.getAttribute('href')||'').trim();
   try{const url=new URL(raw);if((url.protocol==='https:'&&url.hostname&&!url.username&&!url.password)||(url.protocol==='mailto:'&&url.pathname)){element.href=url.href;element.target='_blank';element.rel='noopener noreferrer';}}catch{}
  }
  if(node.hasAttribute('class')){
   const classes=(node.getAttribute('class')||'').split(/\s+/).filter(name=>allowedClasses.has(name));
   if(classes.length)element.className=classes.join(' ');
  }
  node.childNodes.forEach(child=>copy(child,element));parent.append(element);
 }
 const fragment=document.createDocumentFragment();
 parsed.body.childNodes.forEach(node=>copy(node,fragment));
 const holder=document.createElement('div');holder.append(fragment);return holder.innerHTML;
}
function makeChamberTransmissionBody(record,grid,structure){
 const panel=makeChamberDisclosure('01 // TRANSMISSION BODY','ha-chamber-panel ha-chamber-transmission-panel','ha-chamber-panel-heading');
 const body=makeChamberNode('div','ha-chamber-transmission-body');
 if(record.source_type==='transmission')appendSafeContent(body,record.content_html||'',record,new Set());
 else body.innerHTML=sanitizeTransmissionBody(structure.transmission_body);
 if(!body.childNodes.length)body.textContent='No transmission body has been saved for this record yet.';
 panel.body.append(body);grid.append(panel.details);
}
function makeChamberTextPanel(record,grid,structure){
 const panel=makeChamberDisclosure('02 // PROMPT STYLE','ha-chamber-panel','ha-chamber-panel-heading');
 panel.body.append(makeChamberNode('div','ha-chamber-structure-text',structure.prompt_style||'No prompt style has been saved for this record yet.'));
 grid.append(panel.details);
 const lyrics=makeChamberDisclosure('03 // LYRICS STYLE','ha-chamber-panel','ha-chamber-panel-heading');
 lyrics.body.append(makeChamberNode('div','ha-chamber-structure-text',structure.lyrics_style||'No lyrics-style notes have been saved for this record yet.'));
 grid.append(lyrics.details);
}
function appendChamberOutputView(record,grid,structure){
 const output=makeChamberDisclosure('04 // OUTPUT','ha-chamber-panel ha-chamber-output','ha-chamber-panel-heading');
 const text=makeChamberDisclosure('TEXT','ha-chamber-output-section ha-chamber-subdisclosure','ha-chamber-output-label');
 text.body.append(makeChamberNode('div','ha-chamber-text',structure.output_text||'No output text has been saved for this record yet.'));
 output.body.append(text.details);
 ['image','audio','video'].forEach(type=>{
  const child=makeChamberDisclosure(type.toUpperCase(),'ha-chamber-output-section ha-chamber-subdisclosure','ha-chamber-output-label');
  appendChamberMedia(child.body,record,type,getRecordOutputMedia(record,structure,type));
  output.body.append(child.details);
 });
 grid.append(output.details);
}
function renderRecordStructureView(record,grid,status,editButton,expandButton){
 const structure=getRecordStructure(record);
 grid.replaceChildren();
 makeChamberTransmissionBody(record,grid,structure);
 makeChamberTextPanel(record,grid,structure);
 appendChamberOutputView(record,grid,structure);
 bindChamberDisclosureControls(grid,expandButton);
 if(editButton)editButton.hidden=!archiveAdmin;
}
function chamberFileMime(file,type){
 const supplied=String(file.type||'').toLowerCase();
 const allowed={
  image:new Set(['image/jpeg','image/png','image/webp','image/gif','image/avif']),
  audio:new Set(['audio/mpeg','audio/mp4','audio/ogg','audio/wav','audio/webm']),
  video:new Set(['video/mp4','video/webm'])
 };
 if(allowed[type].has(supplied))return supplied;
 if(supplied)return null;
 const extension=String(file.name||'').split('.').pop().toLowerCase();
 const fallback={
  image:{jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif',avif:'image/avif'},
  audio:{mp3:'audio/mpeg',m4a:'audio/mp4',mp4:'audio/mp4',wav:'audio/wav',ogg:'audio/ogg',weba:'audio/webm'},
  video:{mp4:'video/mp4',webm:'video/webm'}
 };
 return fallback[type][extension]||null;
}
function chamberUploadToken(){
 try{if(window.crypto?.randomUUID)return window.crypto.randomUUID();}catch{}
 return Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
}
function renderChamberMediaEditor(sectionBody,record,type,items,status,onChange){
 sectionBody.replaceChildren();
 const list=makeChamberNode('div','ha-chamber-media-editor-list');
 const repaint=()=>{
  list.replaceChildren();
  if(!items.length)list.append(makeChamberNode('p','ha-chamber-note','NO '+type.toUpperCase()+' FILES SELECTED.'));
  items.forEach((item,index)=>{
   const row=makeChamberNode('div','ha-chamber-media-editor-item');
   const description=makeChamberNode('span','ha-chamber-media-editor-name',item.name||record.title);
   const state=makeChamberNode('small','ha-chamber-media-editor-state',item.file?'READY TO UPLOAD':(item.storage==='recovered'?'ARCHIVE ORIGINAL':item.storage==='external'?'EMBEDDED VIDEO':'SAVED FILE'));
   const remove=makeChamberNode('button','ha-chamber-media-remove','REMOVE ✕');remove.type='button';
   remove.setAttribute('aria-label','Remove '+(item.name||'media file')+' from '+type.toUpperCase());
   remove.addEventListener('click',()=>{
    items.splice(index,1);
    if(onChange)onChange();
    repaint();
    status.textContent='MEDIA SELECTION UPDATED — SAVE THE CHAMBER TO APPLY IT.';
   });
   row.append(description,state,remove);list.append(row);
  });
 };
 const input=document.createElement('input');input.type='file';input.multiple=true;input.className='ha-chamber-file-input';
 input.accept=type==='image'?'image/jpeg,image/png,image/webp,image/gif,image/avif':
  type==='audio'?'audio/mpeg,audio/mp4,audio/ogg,audio/wav,audio/webm':'video/mp4,video/webm';
 input.setAttribute('aria-label','Choose multiple '+type+' files');
 const uploadLabel=makeChamberNode('label','ha-chamber-upload-label');
 const uploadText=makeChamberNode('span','', 'ADD '+type.toUpperCase()+' FILES +');
 uploadLabel.append(uploadText,input);
 input.addEventListener('change',()=>{
  const files=[...input.files||[]];
  const accepted=files.slice(0,10);
  const rejected=[];
  accepted.forEach(file=>{
   const mime=chamberFileMime(file,type);
   if(!mime){rejected.push(file.name+' (unsupported format)');return;}
   if(file.size>30*1024*1024){rejected.push(file.name+' (over 30 MB)');return;}
   items.push({id:'pending-'+chamberUploadToken(),name:file.name,mime_type:mime,storage:'pending',file});
  });
  if(files.length>10)rejected.push('Only the first 10 files in this selection were checked.');
  if(onChange)onChange();
  status.textContent=rejected.length?'Some files were not added: '+rejected.join('; '):'FILES ADDED — SAVE THE CHAMBER TO UPLOAD.';
  input.value='';
  repaint();
 });
 sectionBody.append(list,uploadLabel);
 repaint();
}
function renderRecordStructureEditor(record,grid,status,editButton,expandButton){
 const structure=getRecordStructure(record);
 const editorMedia={
  image:getRecordOutputMedia(record,structure,'image').map(item=>({...item})),
  audio:getRecordOutputMedia(record,structure,'audio').map(item=>({...item})),
  video:getRecordOutputMedia(record,structure,'video').map(item=>({...item}))
 };
 const mediaTouched={image:false,audio:false,video:false};
 let recordMetadataInputs=null;
 let attachedPostMedia=[];
 let repaintAttachedPostMedia=()=>{};
 let postLayoutControls=null;
 const escapeLayoutText=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
 const layoutParagraphs=value=>String(value||'').split(/\n{2,}/).map(part=>'<p>'+escapeLayoutText(part).replace(/\n/g,'<br>')+'</p>').join('');

 grid.replaceChildren();
 if(record.source_type==='transmission'){
 const metadataDetails=makeChamberDisclosure('00 // RECORD DETAILS','ha-chamber-panel ha-chamber-edit-panel ha-chamber-metadata-panel','ha-chamber-panel-heading');
 const metadataFields=makeChamberNode('div','ha-chamber-metadata-grid');
 const addMetadataField=(labelText,name,value,options={})=>{
  const wrap=makeChamberNode('label','ha-chamber-metadata-field');
  const label=makeChamberNode('span','ha-chamber-metadata-label',labelText);
  const control=document.createElement(options.multiline?'textarea':'input');
  control.className='ha-chamber-editor-field ha-chamber-meta-input';control.name=name;
  if(options.multiline){control.rows=3;control.maxLength=options.maxLength||400;}
  else{control.type='text';control.maxLength=options.maxLength||180;control.autocomplete='off';}
  control.value=String(value??'');if(options.placeholder)control.placeholder=options.placeholder;
  wrap.append(label,control);metadataFields.append(wrap);return control;
 };
 const addMetadataSelect=(labelText,name,value,options)=>{
  const wrap=makeChamberNode('label','ha-chamber-metadata-field');
  const label=makeChamberNode('span','ha-chamber-metadata-label',labelText);
  const control=document.createElement('select');control.className='ha-chamber-editor-field ha-chamber-meta-input';control.name=name;
  options.forEach(([optionValue,optionLabel])=>{const option=document.createElement('option');option.value=optionValue;option.textContent=optionLabel;control.append(option);});
  control.value=String(value??'');wrap.append(label,control);metadataFields.append(wrap);return control;
 };
 const titleInput=addMetadataField('TITLE','title',record.title,{placeholder:'Transmission title',maxLength:180});
 const slugInput=addMetadataField('PUBLIC URL SLUG','slug',record.slug,{placeholder:'lowercase-words-separated-by-hyphens',maxLength:180});
 const currentCategory=(record.categories||[])[0]||'';
 const categoryInput=addMetadataSelect('ARCHIVE / MOVEMENT','category',transmissionCategories.includes(currentCategory)?currentCategory:'',[
  ['','CHOOSE DESTINATION'],...transmissionCategories.map(name=>[name,name])
 ]);
 const excerptInput=addMetadataField('EXCERPT','excerpt',record.excerpt||'',{multiline:true,placeholder:'Short description shown in previews (up to 400 characters)',maxLength:400});
 const mediaWidthWrap=makeChamberNode('label','ha-chamber-metadata-field');
 const mediaWidthLabel=makeChamberNode('span','ha-chamber-metadata-label','MEDIA WIDTH');
 const mediaWidthInput=document.createElement('input');mediaWidthInput.type='range';mediaWidthInput.min='20';mediaWidthInput.max='100';mediaWidthInput.step='5';mediaWidthInput.value=String(Math.max(20,Math.min(100,Number(record.media_width)||100)));mediaWidthInput.className='ha-chamber-editor-field ha-chamber-meta-input';mediaWidthInput.name='media_width';
 const mediaWidthOutput=makeChamberNode('output','ha-chamber-media-width-value',mediaWidthInput.value+'%');
 mediaWidthInput.addEventListener('input',()=>{mediaWidthOutput.textContent=mediaWidthInput.value+'%';});
 mediaWidthWrap.append(mediaWidthLabel,mediaWidthInput,mediaWidthOutput);metadataFields.append(mediaWidthWrap);
 const statusWrap=makeChamberNode('label','ha-chamber-metadata-field');
 const statusLabel=makeChamberNode('span','ha-chamber-metadata-label','PUBLICATION STATUS');
 const statusSelect=document.createElement('select');statusSelect.className='ha-chamber-editor-field ha-chamber-meta-input';statusSelect.name='status';
 [['draft','DRAFT — PRIVATE'],['published','PUBLISHED — PUBLIC']].forEach(([value,label])=>{const option=document.createElement('option');option.value=value;option.textContent=label;statusSelect.append(option);});
 statusSelect.value=record.status==='published'?'published':'draft';
 statusWrap.append(statusLabel,statusSelect);metadataFields.append(statusWrap);
 const statusNote=makeChamberNode('p','ha-chamber-metadata-note','Drafts are private. Published Transmissions appear on the public site. Saving as draft removes a published Transmission from public listings.');
 metadataDetails.body.append(metadataFields,statusNote);
 grid.append(metadataDetails.details);
 recordMetadataInputs={title:titleInput,slug:slugInput,category:categoryInput,excerpt:excerptInput,mediaWidth:mediaWidthInput,status:statusSelect};
 const savedLayoutDoc=new DOMParser().parseFromString(String(record.content_html||''),'text/html');
 const savedSuno=savedLayoutDoc.querySelector('.suno-post-layout');
 const savedPlain=savedLayoutDoc.querySelector('.plain-post-layout');
 const readLayoutText=selector=>{
  const node=savedLayoutDoc.querySelector(selector);if(!node)return '';
  const clone=node.cloneNode(true);clone.querySelectorAll('.suno-label,.suno-collapse-hint').forEach(label=>label.remove());
  return clone.innerText||clone.textContent||'';
 };
 const layoutPanel=makeChamberDisclosure('00.25 // POST PRESENTATION','ha-chamber-panel ha-chamber-edit-panel ha-chamber-layout-panel','ha-chamber-panel-heading');
 const layoutSelect=document.createElement('select');layoutSelect.className='ha-chamber-editor-field ha-chamber-meta-input';
 [['standard','STANDARD ARTICLE'],['plain','PLAIN TEXT + OH, SUN.'],['suno','SUNO LYRICS + STYLE BREAKDOWN']].forEach(([value,label])=>{const option=document.createElement('option');option.value=value;option.textContent=label;layoutSelect.append(option);});
 layoutSelect.value=savedSuno?'suno':savedPlain?'plain':'standard';
 const layoutSelectWrap=makeChamberNode('label','ha-chamber-metadata-field');
 layoutSelectWrap.append(makeChamberNode('span','ha-chamber-metadata-label','PUBLIC POST LAYOUT'),layoutSelect);
 const layoutFields=makeChamberNode('div','ha-chamber-layout-fields');
 const addLayoutField=(label,name,value,group,rows=5)=>{
  const wrap=makeChamberNode('label','ha-chamber-metadata-field ha-chamber-layout-field');
  wrap.dataset.layoutGroup=group;
  wrap.append(makeChamberNode('span','ha-chamber-metadata-label',label));
  const area=document.createElement('textarea');area.className='ha-chamber-editor-field';area.name=name;area.rows=rows;area.value=value||'';
  wrap.append(area);layoutFields.append(wrap);return area;
 };
 const layoutMain=addLayoutField('COLUMN 1 // THE TEXT','layout_main',savedSuno?readLayoutText('.suno-text-column'):savedPlain?readLayoutText('.plain-copy'):(savedLayoutDoc.body.innerText||''),'suno',8);
 const layoutLyrics=addLayoutField('COLUMN 2 // SUNO LYRICS','layout_lyrics',savedLayoutDoc.querySelector('.suno-lyrics pre')?.textContent||'','suno',12);
 const layoutPrompt=addLayoutField('SUNO STYLE PROMPT','layout_prompt',readLayoutText('.suno-style-prompt')||readLayoutText('.suno-notes'),'suno',6);
 const layoutLearned=addLayoutField('WHAT I LEARNED','layout_learned',readLayoutText('.suno-learned'),'suno',4);
 const layoutChatgpt=addLayoutField('WHAT CHATGPT LEARNED','layout_chatgpt',readLayoutText('.suno-chatgpt-learned'),'suno',4);
 const layoutPlain=addLayoutField('PLAIN TEXT','layout_plain',savedPlain?readLayoutText('.plain-copy'):savedSuno?readLayoutText('.suno-text-column'):(savedLayoutDoc.body.innerText||''),'plain',12);
 const syncLayoutControls=()=>{
  layoutFields.querySelectorAll('[data-layout-group]').forEach(field=>{field.hidden=field.dataset.layoutGroup!==layoutSelect.value;});
  if(postLayoutControls?.transmissionDetails)postLayoutControls.transmissionDetails.hidden=layoutSelect.value!=='standard';
 };
 layoutSelect.dataset.previousValue=layoutSelect.value;
 layoutSelect.addEventListener('change',()=>{
  const previous=layoutSelect.dataset.previousValue||'standard';
  if(layoutSelect.value==='standard'&&previous!=='standard'&&postLayoutControls?.transmissionEditor){
   const source=previous==='plain'?layoutPlain.value:layoutMain.value;
   postLayoutControls.transmissionEditor.innerHTML=layoutParagraphs(source);
  }
  layoutSelect.dataset.previousValue=layoutSelect.value;
  syncLayoutControls();status.textContent='POST LAYOUT CHANGED — SAVE THE CHAMBER TO APPLY';
 });
 [layoutMain,layoutLyrics,layoutPrompt,layoutLearned,layoutChatgpt,layoutPlain].forEach(area=>area.addEventListener('input',()=>{status.textContent='POST LAYOUT EDITED — SAVE THE CHAMBER TO APPLY';}));
 layoutPanel.body.append(layoutSelectWrap,layoutFields);grid.append(layoutPanel.details);
 postLayoutControls={select:layoutSelect,fields:{main:layoutMain,lyrics:layoutLyrics,prompt:layoutPrompt,learned:layoutLearned,chatgpt:layoutChatgpt,plain:layoutPlain},transmissionDetails:null,sync:syncLayoutControls};
 syncLayoutControls();
 }
 if(record.source_type==='transmission'){
 attachedPostMedia=(Array.isArray(record.media_items)?record.media_items:[]).map((item,index)=>{
  const mime=String(item.mime_type||'').toLowerCase();
  const type=['image','audio','video'].includes(item.type)?item.type:(mime.startsWith('image/')?'image':mime.startsWith('video/')?'video':'audio');
  return {id:String(item.id||'attached-'+index),name:String(item.title||item.name||record.title),url:String(item.source_url||item.url||''),path:String(item.storage_path||item.path||''),type,mime_type:mime,storage:String(item.storage||'vha-post-media')};
 }).filter(item=>item.url);
 const attachedPanel=makeChamberDisclosure('00.5 // POST ATTACHMENTS','ha-chamber-panel ha-chamber-edit-panel ha-chamber-attached-panel','ha-chamber-panel-heading');
 const attachedList=makeChamberNode('div','ha-chamber-media-editor-list');
 const repaintAttached=()=>{
  attachedList.replaceChildren();
  if(!attachedPostMedia.length)attachedList.append(makeChamberNode('p','ha-chamber-note','NO POST ATTACHMENTS SELECTED.'));
  attachedPostMedia.forEach((item,index)=>{
   const row=makeChamberNode('div','ha-chamber-media-editor-item');
   row.append(makeChamberNode('span','ha-chamber-media-editor-name',item.name||record.title));
   row.append(makeChamberNode('small','ha-chamber-media-editor-state',item.file?'READY TO UPLOAD':item.type.toUpperCase()+' // EXISTING ATTACHMENT'));
   const remove=makeChamberNode('button','ha-chamber-media-remove','REMOVE ✕');remove.type='button';
   remove.setAttribute('aria-label','Remove '+(item.name||'attachment'));
   remove.addEventListener('click',()=>{attachedPostMedia.splice(index,1);repaintAttached();status.textContent='ATTACHMENTS UPDATED — AUTOSAVE PENDING';scheduleDraftAutosave();});
   row.append(remove);attachedList.append(row);
  });
 };
 const attachedInput=document.createElement('input');attachedInput.type='file';attachedInput.multiple=true;attachedInput.className='ha-chamber-file-input';
 attachedInput.accept='image/jpeg,image/png,image/webp,image/gif,image/avif,audio/mpeg,audio/mp4,audio/ogg,audio/wav,audio/webm,video/mp4,video/webm';
 attachedInput.setAttribute('aria-label','Choose post attachments');
 const attachedLabel=makeChamberNode('label','ha-chamber-upload-label');
 attachedLabel.append(makeChamberNode('span','','ADD POST ATTACHMENTS +'),attachedInput);
 attachedInput.addEventListener('change',()=>{
  const files=[...attachedInput.files||[]],rejected=[];
  files.slice(0,10).forEach(file=>{
   const type=file.type.startsWith('image/')?'image':file.type.startsWith('audio/')?'audio':file.type.startsWith('video/')?'video':'';
   const mime=type?chamberFileMime(file,type):null;
   if(!mime){rejected.push(file.name+' (unsupported format)');return;}
   if(file.size>30*1024*1024){rejected.push(file.name+' (over 30 MB)');return;}
   attachedPostMedia.push({id:'pending-'+chamberUploadToken(),name:file.name,type,mime_type:mime,file,storage:'vha-post-media'});
  });
  if(files.length>10)rejected.push('Only the first 10 files were checked.');
  repaintAttached();attachedInput.value='';
  status.textContent=rejected.length?'Some files were not added: '+rejected.join('; '):'ATTACHMENTS ADDED — SAVE THE CHAMBER TO UPLOAD';
 });
 attachedPanel.body.append(attachedList,attachedLabel);grid.append(attachedPanel.details);repaintAttached();repaintAttachedPostMedia=repaintAttached;
 }
 const transmission=makeChamberDisclosure('01 // TRANSMISSION BODY','ha-chamber-panel ha-chamber-edit-panel ha-chamber-transmission-panel','ha-chamber-panel-heading');
 const transmissionTop=makeChamberNode('div','ha-rich-editor-top');
 const transmissionHint=makeChamberNode('span','ha-rich-editor-hint','WRITE, FORMAT AND SHAPE THE ORIGINAL TRANSMISSION');
 const focusButton=makeChamberNode('button','ha-chamber-focus-toggle','T');focusButton.type='button';focusButton.setAttribute('aria-pressed','false');
 transmissionTop.append(transmissionHint,focusButton);
 const toolbar=makeChamberNode('div','ha-rich-toolbar');toolbar.setAttribute('role','toolbar');toolbar.setAttribute('aria-label','Transmission formatting');
 [['B','bold'],['I','italic'],['U','underline'],['H2','formatBlock','h2'],['H3','formatBlock','h3'],['QUOTE','formatBlock','blockquote'],['• LIST','insertUnorderedList'],['1. LIST','insertOrderedList']].forEach(([label,command,value])=>{
  const button=makeChamberNode('button','',label);button.type='button';button.dataset.command=command;if(value)button.dataset.value=value;toolbar.append(button);
 });
 const insertLinkButton=makeChamberNode('button','ha-rich-link','LINK');insertLinkButton.type='button';toolbar.append(insertLinkButton);
 const transmissionEditor=makeChamberNode('div','ha-chamber-editor-field ha-rich-content');transmissionEditor.contentEditable='true';transmissionEditor.setAttribute('role','textbox');transmissionEditor.setAttribute('aria-multiline','true');transmissionEditor.setAttribute('aria-label','Transmission body');transmissionEditor.spellcheck=true;transmissionEditor.dataset.placeholder='Write the transmission body…';transmissionEditor.innerHTML=sanitizeTransmissionBody(record.source_type==='transmission'?(record.content_html||structure.transmission_body):structure.transmission_body);
 transmission.body.append(transmissionTop,toolbar,transmissionEditor);grid.append(transmission.details);
 if(postLayoutControls){postLayoutControls.transmissionDetails=transmission.details;postLayoutControls.transmissionEditor=transmissionEditor;postLayoutControls.sync();}
 const richEditorController=window.VHAEditorUI?.mountRichTextEditor({editor:transmissionEditor,toolbar,focusButton,insertLinkButton,focusClass:'ha-writing-focus',onInvalidLink:message=>{status.textContent=message;}});
 const prompt=makeChamberDisclosure('02 // PROMPT STYLE','ha-chamber-panel ha-chamber-edit-panel','ha-chamber-panel-heading');
 const promptArea=document.createElement('textarea');promptArea.className='ha-chamber-editor-field';promptArea.name='prompt_style';promptArea.rows=9;
 promptArea.value=structure.prompt_style;promptArea.placeholder='Paste or write the AI / Suno style prompt…';prompt.body.append(promptArea);grid.append(prompt.details);
 const lyrics=makeChamberDisclosure('03 // LYRICS STYLE','ha-chamber-panel ha-chamber-edit-panel','ha-chamber-panel-heading');
 const lyricsArea=document.createElement('textarea');lyricsArea.className='ha-chamber-editor-field';lyricsArea.name='lyrics_style';lyricsArea.rows=9;
 lyricsArea.value=structure.lyrics_style;lyricsArea.placeholder='Add lyric instructions, structure, vocal direction or generation notes…';lyrics.body.append(lyricsArea);grid.append(lyrics.details);
 const output=makeChamberDisclosure('04 // OUTPUT','ha-chamber-panel ha-chamber-output ha-chamber-edit-panel','ha-chamber-panel-heading');
 const text=makeChamberDisclosure('TEXT','ha-chamber-output-section ha-chamber-subdisclosure','ha-chamber-output-label');
 const textArea=document.createElement('textarea');textArea.className='ha-chamber-editor-field';textArea.name='output_text';textArea.rows=14;
 textArea.value=structure.output_text;textArea.placeholder='Edit the original text output…';text.body.append(textArea);output.body.append(text.details);
 ['image','audio','video'].forEach(type=>{
  const media=makeChamberDisclosure(type.toUpperCase(),'ha-chamber-output-section ha-chamber-subdisclosure','ha-chamber-output-label');
  const items=editorMedia[type];
  const sectionBody=media.body;
  renderChamberMediaEditor(sectionBody,record,type,items,status,()=>{mediaTouched[type]=true;scheduleDraftAutosave();});
  output.body.append(media.details);
 });
 grid.append(output.details);
 if(record.source_type==='transmission'){
  grid.addEventListener('input',scheduleDraftAutosave);
  grid.addEventListener('change',()=>{updateSaveLabel();scheduleDraftAutosave();});
 }
 const actions=makeChamberNode('div','ha-chamber-editor-actions');
 const save=makeChamberNode('button','ha-chamber-save','SAVE CHAMBER');save.type='button';
 const cancel=makeChamberNode('button','ha-chamber-cancel','CANCEL');cancel.type='button';

 const updateSaveLabel=()=>{if(record.source_type!=='transmission')return;const next=recordMetadataInputs.status.value;save.textContent=next==='published'?(record.status==='published'?'SAVE PUBLISHED TRANSMISSION':'PUBLISH TRANSMISSION'):(record.status==='published'?'UNPUBLISH & SAVE DRAFT':'SAVE DRAFT');};
 recordMetadataInputs?.status?.addEventListener('change',updateSaveLabel);updateSaveLabel();
 // Draft Transmissions are database-backed as the user types. Publication remains an explicit action.
 let draftAutosaveTimer=null,draftAutosaveInFlight=false,draftAutosaveQueued=false,draftAutosaveStopped=false,draftAutosaveFlushing=false,draftAutosaveLastSignature='';
 const draftAutosaveEnabled=record.source_type==='transmission'&&record.status==='draft';
 const deleteDraft=draftAutosaveEnabled?makeChamberNode('button','ha-chamber-delete-draft','DELETE DRAFT'):null;
 if(deleteDraft)deleteDraft.type='button';
 const buildDraftAutosaveState=()=>{
  const metadata={
   title:String(recordMetadataInputs.title.value).trim(),
   slug:String(recordMetadataInputs.slug.value).trim().toLowerCase(),
   category:String(recordMetadataInputs.category.value).trim().toUpperCase(),
   excerpt:String(recordMetadataInputs.excerpt.value).trim(),
   mediaWidth:Math.max(20,Math.min(100,Number(recordMetadataInputs.mediaWidth.value)||100)),
   status:'draft'
  };
  if(!metadata.title||metadata.title.length>180)throw new Error('Title must contain between 1 and 180 characters.');
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(metadata.slug))throw new Error('Use a valid lowercase URL slug with words separated by hyphens.');
  if(!transmissionCategories.includes(metadata.category))throw new Error('Choose Human Archive or one of the five Movements.');
  if(metadata.excerpt.length>400)throw new Error('Excerpt must be 400 characters or fewer.');
  let transmissionBody=sanitizeTransmissionBody(transmissionEditor.innerHTML);
  if(postLayoutControls&&postLayoutControls.select.value!=='standard'){
   transmissionBody=postLayoutControls.select.value==='plain'
    ?'<div class="plain-post-layout"><section class="plain-copy"><p class="suno-label">THE TEXT</p>'+layoutParagraphs(postLayoutControls.fields.plain.value)+'</section><aside class="plain-response"><p class="suno-label">A SMALL RESPONSE</p><h2>Oh, sun.</h2></aside></div>'
    :'<div class="suno-post-layout"><section class="suno-text-column"><p class="suno-label">01 // THE TEXT</p>'+layoutParagraphs(postLayoutControls.fields.main.value)+'</section><details class="suno-lyrics"><summary class="suno-label">02 // SUNO STYLE LYRICS <span class="suno-collapse-hint">CLICK TO EXPAND</span></summary><pre>'+escapeLayoutText(postLayoutControls.fields.lyrics.value)+'</pre></details><aside class="suno-notes"><p class="suno-label">03 // SUNO STYLE PROMPT</p><section class="suno-style-prompt">'+layoutParagraphs(postLayoutControls.fields.prompt.value)+'</section><section class="suno-learned"><p class="suno-label">WHAT I LEARNED</p>'+layoutParagraphs(postLayoutControls.fields.learned.value)+'</section><section class="suno-chatgpt-learned"><p class="suno-label">WHAT CHATGPT LEARNED</p>'+layoutParagraphs(postLayoutControls.fields.chatgpt.value)+'</section></aside></div>';
  }
  const existingOutput=structure.output_media&&typeof structure.output_media==='object'?structure.output_media:{};
  const outputMedia={};
  for(const type of ['image','audio','video']){
   const hasUnuploaded=editorMedia[type].some(item=>item.file&&!item.uploadedDraft);
   outputMedia[type]=hasUnuploaded?(Array.isArray(existingOutput[type])?existingOutput[type]:[]):editorMedia[type].map(item=>{
    const uploaded=item.uploadedDraft||{};
    return {
     id:String(item.id||uploaded.path||item.path||item.url||chamberUploadToken()),name:String(item.name||record.title),
     url:String(uploaded.url||item.url||''),path:String(uploaded.path||item.path||''),
     mime_type:String(uploaded.mime_type||item.mime_type||''),storage:String(uploaded.storage||item.storage||'recovered')
    };
   });
  }
  const mediaItems=attachedPostMedia.map(item=>{
   const uploaded=item.uploadedDraft||{};
   return {url:uploaded.url||item.url,path:uploaded.path||item.path||null,type:item.type,name:item.name};
  }).filter(item=>item.url);
  const row={
   record_id:Number(record.id),transmission_body:transmissionBody,
   prompt_style:promptArea.value,lyrics_style:lyricsArea.value,output_text:textArea.value,
   output_media:outputMedia,updated_at:new Date().toISOString(),updated_by:archiveUserId
  };
  return {metadata,row,mediaItems};
 };
 const uploadPendingDraftMedia=async()=>{
  const uploadedPaths=[];
  const uploadOne=async(item,folder,type)=>{
   if(!item.file||item.uploadedDraft)return;
   const token=chamberUploadToken();
   const safeName=String(item.name||'media').normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(-110)||'media';
   const path='human-archive/'+String(record.id)+'/'+folder+'/'+token+'-'+safeName;
   const {error}=await archiveSupabase.storage.from('vha-post-media').upload(path,item.file,{cacheControl:'3600',contentType:item.mime_type,upsert:false});
   if(error)throw error;
   uploadedPaths.push(path);
   const {data}=archiveSupabase.storage.from('vha-post-media').getPublicUrl(path);
   if(!data?.publicUrl)throw new Error('The uploaded media URL could not be created.');
   item.uploadedDraft={url:data.publicUrl,path,type:type||item.type,name:item.name,mime_type:item.mime_type,storage:'vha-post-media'};
  };
  try{
   for(const item of attachedPostMedia)await uploadOne(item,'attachments',item.type);
   for(const type of ['image','audio','video'])for(const item of editorMedia[type])await uploadOne(item,type,type);
   return uploadedPaths;
  }catch(error){
   if(uploadedPaths.length)await archiveSupabase.storage.from('vha-post-media').remove(uploadedPaths);
   [...attachedPostMedia,...['image','audio','video'].flatMap(type=>editorMedia[type])].forEach(item=>{delete item.uploadedDraft;});
   throw error;
  }
 };
 const runDraftAutosave=async()=>{
  if(!draftAutosaveEnabled||draftAutosaveStopped||!archiveAdmin||!archiveSupabase||!archiveUserId)return true;
  if(draftAutosaveInFlight){draftAutosaveQueued=true;return null;}
  let state,signature,uploadedPaths=[];
  draftAutosaveInFlight=true;
  try{
   uploadedPaths=await uploadPendingDraftMedia();
   state=buildDraftAutosaveState();
   signature=JSON.stringify({metadata:state.metadata,row:{...state.row,updated_at:null,updated_by:null},mediaItems:state.mediaItems});
   if(signature===draftAutosaveLastSignature){
    uploadedPaths.forEach(path=>console.warn('Draft media already represented in the saved record:',path));
    return true;
   }
   status.textContent='SAVING DRAFT…';
   const {data,error}=await archiveSupabase.rpc('save_human_archive_transmission_v4',{
    p_post_id:record.post_id,p_title:state.metadata.title,p_slug:state.metadata.slug,
    p_category:state.metadata.category,p_excerpt:state.metadata.excerpt,p_status:'draft',
    p_transmission_body:state.row.transmission_body,p_prompt_style:state.row.prompt_style,
    p_lyrics_style:state.row.lyrics_style,p_output_text:state.row.output_text,
    p_output_media:state.row.output_media,p_media_items:state.mediaItems
   });
   if(error)throw error;
   const saved=Array.isArray(data)?data[0]:data;
   const {error:mediaWidthError}=await archiveSupabase.from('vha_posts').update({media_width:state.metadata.mediaWidth}).eq('id',record.post_id);
   if(mediaWidthError)console.warn('Transmission media width could not be saved:',mediaWidthError);
   else record.media_width=state.metadata.mediaWidth;
   record.title=state.metadata.title;record.slug=state.metadata.slug;
   record.categories=[state.metadata.category];record.excerpt=state.metadata.excerpt;
   record.content_html=state.row.transmission_body;record.status='draft';
   record.media_items=state.mediaItems.map((item,index)=>({
    id:'transmission-'+record.post_id+'-'+index,title:item.name||record.title,
    alt_text:item.name||record.title,mime_type:item.type+'/unknown',
    storage_path:item.path||'',source_url:item.url,url:item.url,
    storage:'vha-post-media',post_ids:[Number(record.id)]
   }));
   record.updated_at=saved?.updated_at||state.row.updated_at;
   state.row.updated_at=record.updated_at;
   recordStructureOverrides.set(String(record.id),state.row);
   [...attachedPostMedia,...['image','audio','video'].flatMap(type=>editorMedia[type])].forEach(item=>{
    if(item.uploadedDraft){Object.assign(item,item.uploadedDraft);item.file=null;delete item.uploadedDraft;}
   });
   repaintAttachedPostMedia();
   draftAutosaveLastSignature=signature;
   status.textContent=mediaWidthError?'DRAFT SAVED — MEDIA WIDTH UPDATE FAILED':'DRAFT SAVED AUTOMATICALLY';
   return true;
  }catch(error){
   if(uploadedPaths.length)await archiveSupabase.storage.from('vha-post-media').remove(uploadedPaths);
   [...attachedPostMedia,...['image','audio','video'].flatMap(type=>editorMedia[type])].forEach(item=>{delete item.uploadedDraft;});
   console.error('Human Archive draft autosave failed:',error);
   status.textContent='AUTOSAVE FAILED — '+String(error.message||'PLEASE TRY AGAIN');
   return false;
  }finally{
   draftAutosaveInFlight=false;
   if(draftAutosaveQueued&&!draftAutosaveFlushing){draftAutosaveQueued=false;scheduleDraftAutosave(0);}
  }
 };
 const scheduleDraftAutosave=(delay=850)=>{
  if(!draftAutosaveEnabled)return;
  if(draftAutosaveTimer)clearTimeout(draftAutosaveTimer);
  draftAutosaveTimer=setTimeout(()=>{draftAutosaveTimer=null;runDraftAutosave();},delay);
 };
 const flushDraftAutosave=async()=>{
  if(!draftAutosaveEnabled)return true;
  draftAutosaveFlushing=true;
  try{
   for(let attempt=0;attempt<4;attempt++){
    if(draftAutosaveTimer){clearTimeout(draftAutosaveTimer);draftAutosaveTimer=null;}
    while(draftAutosaveInFlight)await new Promise(resolve=>setTimeout(resolve,50));
    draftAutosaveQueued=false;
    const result=await runDraftAutosave();
    while(draftAutosaveInFlight)await new Promise(resolve=>setTimeout(resolve,50));
    if(result===false)return false;
    if(!draftAutosaveQueued&&!draftAutosaveTimer)return true;
   }
   return !draftAutosaveInFlight&&!draftAutosaveQueued&&!draftAutosaveTimer;
  }finally{draftAutosaveFlushing=false;}
 };
 if(draftAutosaveEnabled)flushActiveChamberAutosave=async()=>{
  if(draftAutosaveTimer){clearTimeout(draftAutosaveTimer);draftAutosaveTimer=null;}
  return await flushDraftAutosave();
 };

 if(deleteDraft)actions.append(deleteDraft);
 actions.append(save,cancel);grid.append(actions);
 deleteDraft?.addEventListener('click',async()=>{
  if(!draftAutosaveEnabled||draftAutosaveStopped||!archiveAdmin||!archiveSupabase||!archiveUserId)return;
  if(!window.confirm('Permanently delete this draft Transmission? Its Human Archive record and associated Human Archive attachment files will be removed. This cannot be undone.'))return;
  draftAutosaveStopped=true;
  if(draftAutosaveTimer){clearTimeout(draftAutosaveTimer);draftAutosaveTimer=null;}
  deleteDraft.disabled=true;save.disabled=true;cancel.disabled=true;status.textContent='WAITING FOR ANY ACTIVE DRAFT SAVE…';
  try{
   while(draftAutosaveInFlight)await new Promise(resolve=>setTimeout(resolve,50));
   draftAutosaveQueued=false;
   status.textContent='DELETING DRAFT…';
   const {data,error}=await archiveSupabase.rpc('delete_human_archive_transmission_draft_v1',{p_post_id:record.post_id});
   if(error)throw error;
   const deleted=Array.isArray(data)?data[0]:data;
   if(!deleted||Number(deleted.archive_record_id)!==Number(record.id))throw new Error('The database did not confirm deletion of this exact Archive record.');
   let cleanupWarning=false;
   const paths=Array.isArray(deleted.storage_paths)?deleted.storage_paths.filter(path=>typeof path==='string'&&path.startsWith('human-archive/'+String(record.id)+'/')):[];
   if(paths.length){
    const {error:cleanupError}=await archiveSupabase.storage.from('vha-post-media').remove(paths);
    if(cleanupError){cleanupWarning=true;console.warn('Draft was deleted, but some associated storage files remain:',cleanupError);}
   }
   records=records.filter(item=>String(item.id)!==String(record.id));
   const removedMediaUrls=new Set((record.media_items||[]).map(item=>item.url).filter(Boolean));
   mediaItems=mediaItems.filter(item=>!(item.post_ids||[]).includes(Number(record.id))&&!removedMediaUrls.has(item.url));
   removedMediaUrls.forEach(url=>mediaMap.delete(urlKey(url)));
   recordStructureOverrides.delete(String(record.id));favoriteRecordIds.delete(String(record.id));
   chamberCloseRequestedByUser=true;recordChamber?.close();render();
   setMediaStatus(cleanupWarning?'DRAFT DELETED — SOME STORAGE FILES COULD NOT BE CLEANED UP':'DRAFT DELETED',!cleanupWarning);
  }catch(error){
   draftAutosaveStopped=false;deleteDraft.disabled=false;save.disabled=false;cancel.disabled=false;
   console.error('Human Archive draft could not be deleted:',error);
   status.textContent='DELETE FAILED — '+String(error.message||'PLEASE TRY AGAIN');
   scheduleDraftAutosave(0);
  }
 });
 bindChamberDisclosureControls(grid,expandButton);
 cancel.addEventListener('click',()=>{
  richEditorController?.destroy();
  status.textContent='';
  renderRecordStructureView(record,grid,status,editButton,expandButton);
 });
 save.addEventListener('click',async()=>{
  if(!archiveAdmin||!archiveSupabase||!archiveUserId){status.textContent='ADMIN SESSION REQUIRED';return;}
  if(draftAutosaveTimer){clearTimeout(draftAutosaveTimer);draftAutosaveTimer=null;}
  if(draftAutosaveInFlight){
   status.textContent='WAITING FOR AUTOMATIC DRAFT SAVE…';
   await new Promise(resolve=>{const wait=()=>draftAutosaveInFlight?setTimeout(wait,50):resolve();wait();});
   if(draftAutosaveTimer){clearTimeout(draftAutosaveTimer);draftAutosaveTimer=null;}
  }
  if(record.source_type==='transmission'&&recordMetadataInputs.status.value!==record.status){
   const prompt=recordMetadataInputs.status.value==='published'
    ?'Publish this Transmission? It will become visible on the public site.'
    :'Unpublish this Transmission? It will become a private draft and disappear from public listings.';
   if(!window.confirm(prompt))return;
  }
  save.disabled=true;cancel.disabled=true;save.textContent='SAVING…';status.textContent='PREPARING CHAMBER UPDATE…';
  const uploadedPaths=[];
  const oldStructure=recordStructureOverrides.get(String(record.id))||{};
  const existingOutput=oldStructure.output_media&&typeof oldStructure.output_media==='object'?oldStructure.output_media:{};
  const oldOwnedPaths=['image','audio','video'].flatMap(type=>Array.isArray(existingOutput[type])?existingOutput[type]:[])
   .filter(item=>item&&item.storage==='vha-post-media'&&typeof item.path==='string'&&item.path.startsWith('human-archive/'+String(record.id)+'/'))
   .map(item=>item.path);
  try{
   const savedPostMedia=[];
   for(const item of attachedPostMedia){
    if(item.file){
     status.textContent='UPLOADING POST ATTACHMENT // '+item.name;
     const token=chamberUploadToken();
     const safeName=String(item.name||'media').normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(-110)||'media';
     const path='human-archive/'+String(record.id)+'/attachments/'+token+'-'+safeName;
     const {error:uploadError}=await archiveSupabase.storage.from('vha-post-media').upload(path,item.file,{cacheControl:'3600',contentType:item.mime_type,upsert:false});
     if(uploadError)throw uploadError;
     uploadedPaths.push(path);
     const {data:publicData}=archiveSupabase.storage.from('vha-post-media').getPublicUrl(path);
     if(!publicData?.publicUrl)throw new Error('The attachment URL could not be created.');
     savedPostMedia.push({url:publicData.publicUrl,path,type:item.type,name:item.name});
    }else{
     savedPostMedia.push({url:item.url,path:item.path||null,type:item.type,name:item.name});
    }
   }
   const outputMedia={};
   for(const type of ['image','audio','video']){
    const savedItems=[];
    for(const item of editorMedia[type]){
     if(item.file){
      status.textContent='UPLOADING '+type.toUpperCase()+' // '+item.name;
      const token=chamberUploadToken();
      const safeName=String(item.name||'media').normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(-110)||'media';
      const path='human-archive/'+String(record.id)+'/'+type+'/'+token+'-'+safeName;
      const {error:uploadError}=await archiveSupabase.storage.from('vha-post-media').upload(path,item.file,{
       cacheControl:'3600',contentType:item.mime_type,upsert:false
      });
      if(uploadError)throw uploadError;
      uploadedPaths.push(path);
      const {data:publicData}=archiveSupabase.storage.from('vha-post-media').getPublicUrl(path);
      if(!publicData?.publicUrl)throw new Error('The uploaded file URL could not be created.');
      savedItems.push({id:'upload-'+token,name:item.name,url:publicData.publicUrl,path,mime_type:item.mime_type,storage:'vha-post-media'});
     }else{
      savedItems.push({
       id:String(item.id||item.path||item.url||chamberUploadToken()),
       name:String(item.name||record.title),
       url:String(item.url||''),
       path:typeof item.path==='string'?item.path:'',
       mime_type:String(item.mime_type||''),
       storage:String(item.storage||'recovered')
      });
     }
    }
    if(mediaTouched[type]||Array.isArray(existingOutput[type])||mediaReady)outputMedia[type]=savedItems;
   }
   const row={
    record_id:Number(record.id),
    transmission_body:postLayoutControls&&postLayoutControls.select.value!=='standard'
     ?(postLayoutControls.select.value==='plain'
      ?'<div class="plain-post-layout"><section class="plain-copy"><p class="suno-label">THE TEXT</p>'+layoutParagraphs(postLayoutControls.fields.plain.value)+'</section><aside class="plain-response"><p class="suno-label">A SMALL RESPONSE</p><h2>Oh, sun.</h2></aside></div>'
      :'<div class="suno-post-layout"><section class="suno-text-column"><p class="suno-label">01 // THE TEXT</p>'+layoutParagraphs(postLayoutControls.fields.main.value)+'</section><details class="suno-lyrics"><summary class="suno-label">02 // SUNO STYLE LYRICS <span class="suno-collapse-hint">CLICK TO EXPAND</span></summary><pre>'+escapeLayoutText(postLayoutControls.fields.lyrics.value)+'</pre></details><aside class="suno-notes"><p class="suno-label">03 // SUNO STYLE PROMPT</p><section class="suno-style-prompt">'+layoutParagraphs(postLayoutControls.fields.prompt.value)+'</section><section class="suno-learned"><p class="suno-label">WHAT I LEARNED</p>'+layoutParagraphs(postLayoutControls.fields.learned.value)+'</section><section class="suno-chatgpt-learned"><p class="suno-label">WHAT CHATGPT LEARNED</p>'+layoutParagraphs(postLayoutControls.fields.chatgpt.value)+'</section></aside></div>')
     :sanitizeTransmissionBody(transmissionEditor.innerHTML),
    prompt_style:promptArea.value,
    lyrics_style:lyricsArea.value,
    output_text:textArea.value,
    output_media:outputMedia,
    updated_at:new Date().toISOString(),
    updated_by:archiveUserId
   };
   status.textContent='SAVING CHAMBER STRUCTURE…';
   if(record.source_type==='transmission'){
    const metadata={
     title:String(recordMetadataInputs.title.value).trim(),
     slug:String(recordMetadataInputs.slug.value).trim().toLowerCase(),
     category:String(recordMetadataInputs.category.value).trim().toUpperCase(),
     excerpt:String(recordMetadataInputs.excerpt.value).trim(),
     status:String(recordMetadataInputs.status.value).trim().toLowerCase(),
     mediaWidth:Math.max(20,Math.min(100,Number(recordMetadataInputs.mediaWidth.value)||100))
    };
    if(!metadata.title||metadata.title.length>180)throw new Error('Title must contain between 1 and 180 characters.');
    if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(metadata.slug))throw new Error('Use a valid lowercase URL slug with words separated by hyphens.');
    if(!transmissionCategories.includes(metadata.category))throw new Error('Choose Human Archive or one of the five Movements.');
    if(metadata.excerpt.length>400)throw new Error('Excerpt must be 400 characters or fewer.');
    if(!['draft','published'].includes(metadata.status))throw new Error('Choose a valid publication status.');
    if(metadata.status==='published'&&!row.transmission_body.trim())throw new Error('Add transmission content before publishing.');
    if(metadata.status==='published'&&metadata.category==='UNASSIGNED')throw new Error('Choose a movement category before publishing.');
    const {data:saveResult,error}=await archiveSupabase.rpc('save_human_archive_transmission_v4',{
     p_post_id:record.post_id,p_title:metadata.title,p_slug:metadata.slug,p_category:metadata.category,p_excerpt:metadata.excerpt,p_status:metadata.status,
     p_transmission_body:row.transmission_body,p_prompt_style:row.prompt_style,p_lyrics_style:row.lyrics_style,
     p_output_text:row.output_text,p_output_media:row.output_media,p_media_items:savedPostMedia
    });
    if(error)throw error;
    const saved=Array.isArray(saveResult)?saveResult[0]:saveResult;
    record.title=metadata.title;record.slug=metadata.slug;record.categories=[metadata.category];record.excerpt=metadata.excerpt;record.content_html=row.transmission_body;
    record.media_items=savedPostMedia.map((item,index)=>({id:'transmission-'+record.post_id+'-'+index,title:item.name||record.title,alt_text:item.name||record.title,mime_type:item.type+'/unknown',storage_path:item.path||'',source_url:item.url,url:item.url,storage:'vha-post-media',post_ids:[Number(record.id)]}));
    record.status=metadata.status;record.published_at=saved?.published_at||null;record.updated_at=saved?.updated_at||new Date().toISOString();
    const dateStamp=record.published_at||record.created_at||record.updated_at;record.date=String(dateStamp).slice(0,10);record.year=record.date.slice(0,4);
    if(!categoryOrder.includes(metadata.category))categoryOrder.push(metadata.category);
    if(![...category.options].some(option=>option.value===metadata.category)){
     const option=document.createElement('option');option.value=metadata.category;option.textContent=metadata.category;category.append(option);
    }
   }else{
    const {error}=await archiveSupabase.from('human_archive_record_structures').upsert(row,{onConflict:'record_id'});
    if(error)throw error;
   }
   recordStructureOverrides.set(String(record.id),row);
   const keepPaths=new Set(['image','audio','video'].flatMap(type=>Array.isArray(outputMedia[type])?outputMedia[type]:[])
    .filter(item=>item&&item.storage==='vha-post-media').map(item=>item.path).filter(Boolean));
   const removedPaths=[...new Set(oldOwnedPaths)].filter(path=>!keepPaths.has(path));
   let cleanupWarning=false;
   const {error:mediaWidthError}=await archiveSupabase.from('vha_posts').update({media_width:metadata.mediaWidth}).eq('id',record.post_id);
    if(mediaWidthError){cleanupWarning=true;console.warn('Transmission media width could not be saved:',mediaWidthError);}else record.media_width=metadata.mediaWidth;
    if(removedPaths.length){
    const {error:removeError}=await archiveSupabase.storage.from('vha-post-media').remove(removedPaths);
    if(removeError){cleanupWarning=true;console.warn('Removed chamber media could not be cleaned from storage:',removeError);}
   }
   status.textContent=cleanupWarning?'CHAMBER SAVED — MEDIA WIDTH OR FILE CLEANUP NEEDS ATTENTION':'CHAMBER REDESIGNED // CHANGES SAVED';
   richEditorController?.destroy();
   if(record.source_type==='transmission'){
    const titleNode=recordChamber?.querySelector('.ha-chamber-title');if(titleNode)titleNode.textContent=record.title;
    const metaNode=recordChamber?.querySelector('.ha-chamber-meta');
    if(metaNode)metaNode.textContent='HA-'+record.year+'-'+String(record.id).padStart(4,'0')+' // '+record.date+' // '+record.categories.join(' / ');
    const shareNode=recordChamber?.querySelector('.ha-chamber-share'),shareStatus=recordChamber?.querySelector('.ha-chamber-share-status');
    if(shareNode&&shareStatus){shareNode.replaceChildren();appendChamberShareActions(shareNode,record,shareStatus);}
    const chamberUrl=new URL(archiveHomeUrl.href);chamberUrl.searchParams.set('record',String(record.id));
    history.replaceState(history.state,'',chamberUrl.pathname+chamberUrl.search+chamberUrl.hash);
    render();
   }
   renderRecordStructureView(record,grid,status,editButton,expandButton);
  }catch(error){
   if(uploadedPaths.length){
    const {error:cleanupError}=await archiveSupabase.storage.from('vha-post-media').remove(uploadedPaths);
    if(cleanupError)console.error('New chamber uploads could not be rolled back:',cleanupError);
   }
   console.error('Human Archive chamber could not be saved:',error);
   status.textContent='SAVE FAILED — '+String(error.message||'PLEASE TRY AGAIN');
   save.disabled=false;cancel.disabled=false;save.textContent='SAVE CHAMBER';
  }
 });
}
function buildRecordChamber(record){
 const shell=makeChamberNode('div','ha-chamber-shell');
 const header=makeChamberNode('header','ha-chamber-header');
 const topbar=makeChamberNode('div','ha-chamber-topbar');
 topbar.append(makeChamberNode('span','ha-chamber-mark','EGO // HUMAN ARCHIVE'));
 header.append(topbar);
 const heading=makeChamberNode('div','ha-chamber-heading');
 const meta=makeChamberNode('p','ha-chamber-meta','HA-'+record.year+'-'+String(record.id).padStart(4,'0')+' // '+record.date+' // '+(record.categories||[]).join(' / '));
 heading.append(meta);header.append(heading);
 const titleRow=makeChamberNode('div','ha-chamber-title-row');
 const title=makeChamberNode('h2','ha-chamber-title',record.title);
 const expand=makeChamberNode('button','ha-chamber-expand-all','SEAL ALL ↑');expand.type='button';
 expand.setAttribute('aria-expanded','true');expand.setAttribute('aria-label','Retract all chamber sections');
 titleRow.append(title,expand);
 const main=makeChamberNode('main','ha-chamber-main');
 const shareRow=makeChamberNode('div','ha-chamber-share-row');
 const share=makeChamberNode('div','ha-chamber-share','');
 const shareStatus=makeChamberNode('span','ha-chamber-share-status','');
 appendChamberShareActions(share,record,shareStatus);
 const actions=makeChamberNode('div','ha-chamber-topbar-actions');
 actions.setAttribute('aria-label','Chamber controls');
 const edit=makeChamberNode('button','ha-chamber-edit','REDESIGN CHAMBER');
 edit.type='button';edit.hidden=!archiveAdmin;edit.setAttribute('aria-label','Redesign this archive chamber');
 const close=makeChamberNode('button','ha-chamber-close','CLOSE ✕');close.type='button';close.setAttribute('aria-label','Close record chamber');
 actions.append(edit,close);shareRow.append(share,shareStatus,actions);main.append(shareRow);
 main.append(titleRow);
 const grid=makeChamberNode('div','ha-chamber-grid');main.append(grid);
 renderRecordStructureView(record,grid,shareStatus,edit,expand);
 expand.addEventListener('click',()=>{
  const disclosures=[...grid.querySelectorAll('details[data-ha-disclosure]')];
  const shouldOpen=!disclosures.every(item=>item.open);
  disclosures.forEach(item=>{item.open=shouldOpen;});
  syncChamberExpandButton(grid,expand);
 });
 edit.addEventListener('click',()=>{
  if(!archiveAdmin){shareStatus.textContent='ADMIN ACCESS REQUIRED';return;}
  renderRecordStructureEditor(record,grid,shareStatus,edit,expand);
 });
 close.addEventListener('click',()=>{closeRecordChamberSafely();});
 const footer=makeChamberNode('footer','ha-chamber-footer');
 const source=safeExternalUrl(record.url,new Set(['emanuelstefancu.wordpress.com']));
 if(source){const link=makeChamberNode('a','ha-chamber-source','OPEN ORIGINAL SOURCE ↗');link.href=source;link.target='_blank';link.rel='noopener noreferrer';footer.append(link);}
 footer.append(makeChamberNode('span','ha-chamber-footer-note','NO TRACE IS EVER THE WHOLE PERSON.'));
 main.append(footer);shell.append(header,main);return shell;
}
let chamberCloseRequestedByUser=false;
async function closeRecordChamberSafely(){
 if(!recordChamber?.open){if(window.parent!==window)window.parent.postMessage({type:'VHA_TRANSMISSION_EDITOR_CLOSED'},window.location.origin);return;}
 try{
  const flushed=await flushActiveChamberAutosave();
  if(flushed===false){if(window.parent!==window)window.parent.postMessage({type:'VHA_TRANSMISSION_EDITOR_CLOSE_FAILED'},window.location.origin);return;}
  chamberCloseRequestedByUser=true;recordChamber.close();
 }catch(error){
  console.error('Human Archive chamber could not close safely:',error);
  if(window.parent!==window)window.parent.postMessage({type:'VHA_TRANSMISSION_EDITOR_CLOSE_FAILED'},window.location.origin);
 }
}
function ensureRecordChamber(){
 if(recordChamber)return recordChamber;
 recordChamber=makeChamberNode('dialog','ha-record-chamber');
 recordChamber.setAttribute('aria-label','Human Archive record chamber');
 recordChamber.addEventListener('cancel',event=>{event.preventDefault();closeRecordChamberSafely();});
 recordChamber.addEventListener('click',event=>{if(event.target===recordChamber)closeRecordChamberSafely();});
 recordChamber.addEventListener('close',()=>{
  document.body.classList.remove('ha-chamber-open');
  if(chamberCloseRequestedByUser&&window.parent!==window)window.parent.postMessage({type:'VHA_TRANSMISSION_EDITOR_CLOSED'},window.location.origin);
  chamberCloseRequestedByUser=false;
  history.replaceState(history.state,'',archiveHomeUrl.pathname+archiveHomeUrl.hash);
  if(recordChamberReturnFocus?.isConnected)recordChamberReturnFocus.focus();
  recordChamberReturnFocus=null;
 });
 window.addEventListener('message',event=>{
  if(event.origin!==window.location.origin||event.source!==window.parent||event.data?.type!=='VHA_TRANSMISSION_EDITOR_CLOSE_REQUEST')return;
  closeRecordChamberSafely();
 });
 document.body.append(recordChamber);return recordChamber;
}
function openArchiveRecordChamber(record,trigger,openInEditor=false){
 if(!record||!records.some(item=>String(item.id)===String(record.id)))return;
 const dialog=ensureRecordChamber();if(dialog.open)dialog.close();
 dialog.replaceChildren(buildRecordChamber(record));chamberRecordId=String(record.id);recordChamberReturnFocus=trigger||null;
 const url=new URL(archiveHomeUrl.href);url.searchParams.set('record',String(record.id));history.replaceState(history.state,'',url.pathname+url.search+url.hash);document.body.classList.add('ha-chamber-open');
 try{
  if(archiveAdmin&&openInEditor)dialog.querySelector('.ha-chamber-edit')?.click();
  dialog.showModal();
 }catch(error){document.body.classList.remove('ha-chamber-open');console.error('Could not open the Human Archive chamber:',error);}
}
function openRequestedRecordFromUrl(){
 const params=new URLSearchParams(window.location.search);
 const requestedSlug=params.get('slug');
 const requestedId=params.get('record');
 const record=requestedSlug?records.find(item=>item.slug===requestedSlug):(requestedId&&/^[0-9]+$/.test(requestedId)?records.find(item=>String(item.id)===requestedId):null);
 if(!record)return;
 search.value=record.title;year.value='';category.value='';render();
 const card=list.querySelector('.ha-record-card[data-ha-record-id="'+record.id+'"]');card?.scrollIntoView({behavior:'smooth',block:'center'});openArchiveRecordChamber(record,null);
}
async function createHumanArchiveTransmission(requestedCategory=''){
 if(!archiveAdmin||!archiveSupabase||!archiveUserId){if(createTransmissionStatus)createTransmissionStatus.textContent='ADMIN SESSION REQUIRED';return;}
 const chosenCategory=transmissionCategories.includes(String(requestedCategory||'').trim().toUpperCase())?String(requestedCategory).trim().toUpperCase():'';
 if(newTransmissionButton)newTransmissionButton.disabled=true;
 if(createTransmissionStatus)createTransmissionStatus.textContent='CREATING DRAFT…';
 try{
  const {data,error}=await archiveSupabase.rpc('create_human_archive_transmission');
  if(error)throw error;
  const created=Array.isArray(data)?data[0]:data;
  if(!created?.id||!created?.archive_record_id)throw new Error('The new Transmission could not be confirmed.');
  await loadTransmissionRecords();
  render();syncFavoriteControls();
  const record=records.find(item=>item.source_type==='transmission'&&item.post_id===created.id);
  if(!record)throw new Error('The draft was created, but could not be loaded into the Archive. Refresh the page to find it.');
  record.categories=[chosenCategory];
  openArchiveRecordChamber(record,newTransmissionButton,true);
  if(chosenCategory){const destination=recordChamber?.querySelector('[name="category"]');if(destination){destination.value=chosenCategory;destination.dispatchEvent(new Event('input',{bubbles:true}));}}
  recordChamber?.querySelector('.ha-chamber-editor-field')?.focus({preventScroll:true});
  if(createTransmissionStatus)createTransmissionStatus.textContent='NEW DRAFT READY // HA-'+record.year+'-'+String(record.id).padStart(4,'0');
 }catch(error){
  console.error('Human Archive Transmission could not be created:',error);
  if(createTransmissionStatus)createTransmissionStatus.textContent='CREATE FAILED — '+String(error.message||'PLEASE TRY AGAIN');
 }finally{
  if(newTransmissionButton)newTransmissionButton.disabled=false;
 }
}
async function initArchiveFeatures(){
 const launchParams=new URLSearchParams(window.location.search);
 const launchNewTransmission=launchParams.get('new')==='1';
 const launchCategory=launchParams.get('category')||'';
 if(launchNewTransmission){launchParams.delete('new');launchParams.delete('category');const nextUrl=new URL(window.location.href);nextUrl.search=launchParams.toString();history.replaceState(history.state,'',nextUrl.pathname+nextUrl.search+nextUrl.hash);}
 if(!window.supabase?.createClient){openRequestedRecordFromUrl();return;}
 archiveSupabase=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
 await refreshArchiveAdmin();
 if(newTransmissionButton){newTransmissionButton.hidden=!archiveAdmin;newTransmissionButton.disabled=!archiveAdmin;newTransmissionButton.addEventListener('click',createHumanArchiveTransmission);}
 await Promise.all([loadArchiveFavorites(),loadRecordStructureOverrides(),loadTransmissionRecords()]);
 if(!archiveAuthBound){
  archiveAuthBound=true;
  archiveSupabase.auth.onAuthStateChange((_event,session)=>{
   window.setTimeout(async()=>{
    await refreshArchiveAdmin(session);
    if(newTransmissionButton){newTransmissionButton.hidden=!archiveAdmin;newTransmissionButton.disabled=!archiveAdmin;}
    await loadTransmissionRecords();
    render();
    syncFavoriteControls();
    if(recordChamber?.open){
     const record=records.find(item=>String(item.id)===chamberRecordId);
     if(record)openArchiveRecordChamber(record,null);else recordChamber.close();
    }
   },0);
  });
 }
 render();
 syncFavoriteControls();
 if(launchNewTransmission){await createHumanArchiveTransmission(launchCategory);return;}
 openRequestedRecordFromUrl();
}

function makeFavoriteMark(record){
 const mark=makeChamberNode('span','ha-favorite-mark');mark.dataset.haFavoriteMark=String(record.id);mark.hidden=!favoriteRecordIds.has(String(record.id));mark.setAttribute('aria-hidden','true');
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 40 40');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');
 const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d','M20 1 24.8 14.2 39 15.2 28 24.1 31.5 38 20 30.4 8.5 38 12 24.1 1 15.2 15.2 14.2Z');svg.append(path);mark.append(svg);
 return mark;
}
function makeEntry(record,index){
 const wrapper=document.createElement('article');wrapper.className='ha-record-card';wrapper.dataset.haRecordId=String(record.id);
 const content=document.createElement('div');content.className='ha-entry-content';content.id='ha-record-'+record.id;content.hidden=true;
 const link=document.createElement('button');link.type='button';link.className='ha-entry';link.setAttribute('aria-controls',content.id);link.setAttribute('aria-expanded','false');link.setAttribute('aria-label','Read local archive record: '+record.title+', '+record.date);
 const top=document.createElement('div');top.className='ha-entry-top';const code=document.createElement('small');code.className='ha-entry-code';code.textContent=record.archiveIdentifier;const internalId=document.createElement('small');internalId.className='ha-entry-id';internalId.textContent='ID // '+String(record.id);top.append(code,internalId);
 const title=document.createElement('strong');title.textContent=record.title;const bottom=document.createElement('div');bottom.className='ha-entry-bottom';const date=document.createElement('small');date.textContent=record.date+' // '+(record.source_type==='transmission'?'TRANSMISSION'+(record.status==='draft'?' // DRAFT':''):'LOCAL ARCHIVE COPY');const action=document.createElement('span');action.textContent='READ LOCAL TEXT ↓';bottom.append(date,action);link.append(top,title,bottom);link.style.setProperty('--entry-order',String(index));
 const quickActions=makeChamberNode('div','ha-entry-quick-actions');quickActions.hidden=true;
 const chamber=makeChamberNode('button','ha-entry-chamber','ENTER THE CHAMBER ↗');chamber.type='button';chamber.addEventListener('click',()=>openArchiveRecordChamber(record,chamber));
 const favorite=makeChamberNode('button','ha-favorite-toggle','☆');favorite.type='button';favorite.dataset.haFavoriteId=String(record.id);favorite.hidden=!archiveAdmin;favorite.setAttribute('aria-pressed',String(favoriteRecordIds.has(String(record.id))));favorite.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();toggleArchiveFavorite(record.id,favorite);});
 quickActions.append(chamber,favorite);
 link.addEventListener('click',()=>{const open=content.hidden;content.hidden=!open;link.setAttribute('aria-expanded',String(open));action.textContent=open?'CLOSE LOCAL TEXT ↑':'READ LOCAL TEXT ↓';quickActions.hidden=!open;});
 const body=document.createElement('div');body.className='ha-entry-body';const used=new Set();appendSafeContent(body,record.content_html||'',record,used);
 if(!body.childNodes.length){const message=document.createElement('p');message.textContent='No local text was captured for this entry.';body.append(message);}
 content.append(body);const gallery=makeAttachmentGallery(record,used);if(gallery)content.append(gallery);
 link.append(makeFavoriteMark(record));wrapper.append(link,quickActions,content);
 const source=safeExternalUrl(record.url,new Set(['emanuelstefancu.wordpress.com']));
 if(source){const original=makeChamberNode('a','ha-chamber-source ha-record-source','OPEN ORIGINAL SOURCE ↗');original.href=source;original.target='_blank';original.rel='noopener noreferrer';content.append(original);}
 return wrapper;
}
function render(){
 const query=clean(search.value),selectedYear=year.value,selectedCategory=category.value;
 const filtered=records.filter(r=>(!selectedYear||r.year===selectedYear)&&(!query||[r.title,r.year,r.date,r.id,...(r.categories||[])].some(v=>clean(v).includes(query))));
 const visible=filtered.filter(r=>!selectedCategory||(r.categories||[]).includes(selectedCategory));
 const groups=selectedCategory?[selectedCategory]:categoryOrder.filter(name=>visible.some(r=>(r.categories||[]).includes(name)));
 count.textContent=visible.length+' / '+records.length+' RECORDS';list.replaceChildren();
 if(!visible.length){const empty=document.createElement('p');empty.className='ha-empty';empty.textContent='NO RECORDS MATCH THIS SEARCH. TRY ANOTHER CATEGORY, WORD OR YEAR.';list.append(empty);return;}
 const fragment=document.createDocumentFragment();
 groups.forEach(name=>{
  const items=visible.filter(r=>(r.categories||[]).includes(name)).sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id);if(!items.length)return;
  const section=document.createElement('section');section.className='ha-category-group';section.dataset.category=name;
  const heading=document.createElement('div');heading.className='ha-category-heading';const toggle=document.createElement('button');toggle.type='button';toggle.className='ha-category-toggle';toggle.setAttribute('aria-expanded',String(expandedCategories.has(name)));const h=document.createElement('span');h.className='ha-category-title';h.textContent=name;const marker=document.createElement('span');marker.className='ha-category-marker';marker.setAttribute('aria-hidden','true');marker.textContent=expandedCategories.has(name)?'−':'+';const total=document.createElement('span');total.className='ha-category-total';total.textContent=String(items.length).padStart(2,'0')+' RECORDS';toggle.append(h,marker);heading.append(toggle,total);section.append(heading);
  const entries=document.createElement('div');entries.className='ha-category-entries';entries.hidden=!expandedCategories.has(name);items.forEach((r,i)=>entries.append(makeEntry(r,i)));toggle.addEventListener('click',()=>{const open=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(open));entries.hidden=!open;marker.textContent=open?'−':'+';if(open)expandedCategories.add(name);else expandedCategories.delete(name)});section.append(entries);fragment.append(section);
 });
 list.append(fragment);
}
function setMediaStatus(text,isReady){
 if(!mediaStatus)return;
 mediaStatus.hidden=false;mediaStatus.textContent=text;mediaStatus.classList.toggle('is-ready',Boolean(isReady));
}
async function fetchArchiveJson(path,required=false){
 const attempts=required?3:1;
 let lastError=null;
 for(let attempt=0;attempt<attempts;attempt++){
  try{
   const response=await fetch(path,{credentials:'same-origin',cache:'no-store'});
   if(!response.ok)throw new Error(path+' returned HTTP '+response.status);
   return await response.json();
  }catch(error){
   lastError=error;
   if(!required){console.warn('Optional Human Archive file could not be loaded:',path,error);return null;}
   if(attempt+1<attempts)await new Promise(resolve=>window.setTimeout(resolve,350*(attempt+1)));
  }
 }
 throw new Error('Could not load '+path+' after '+attempts+' attempts: '+(lastError?.message||'Unknown error'));
}
async function init(){
 try{
  const [data,content,manifest,report]=await Promise.all([
   fetchArchiveJson('archive-data.json',true),
   fetchArchiveJson('archive-content.json',true),
   fetchArchiveJson('media-manifest.json'),
   fetchArchiveJson('media-import-report.json')
  ]);
  if(!Array.isArray(data)||!Array.isArray(content.records)||content.record_count!==content.records.length)throw new Error('Invalid local archive data');
  const contentById=new Map(content.records.map(record=>[String(record.id),record]));
  records=assignArchiveSlugs(data.filter(r=>r&&typeof r.title==='string'&&typeof r.year==='string'&&typeof r.date==='string'&&Number.isFinite(Number(r.id))&&typeof r.url==='string'&&Array.isArray(r.categories))
   .map(r=>({...r,content_html:contentById.get(String(r.id))?.content_html||''})));
  if(records.length!==content.record_count||records.some(r=>!contentById.has(String(r.id))))throw new Error('The local archive is incomplete');
  if(manifest&&Array.isArray(manifest.items)&&manifest.item_count===manifest.items.length){
   mediaItems=manifest.items;publicBase=manifest.public_base_url||'';
   const reportSuccesses=Array.isArray(report?.successes)?report.successes:[];
   const successes=new Map(reportSuccesses.filter(x=>x&&x.verified===true).map(x=>[String(x.storage_path),x]));
   mediaHashByPath=new Map([...successes].map(([path,item])=>[path,String(item.sha256||'').toLowerCase()]).filter(([,hash])=>Boolean(hash)));
   mediaReady=Boolean(report&&report.status==='complete'&&report.target_project_ref==='ioguymqdeuuursizifnn'&&report.asset_count===manifest.item_count&&report.successful_count===manifest.item_count&&report.failed_count===0&&successes.size===manifest.item_count&&manifest.bucket==='human-archive-media'&&publicBase.startsWith('https://ioguymqdeuuursizifnn.supabase.co/'));
   if(mediaReady){
    for(const item of mediaItems){
     const keys=[item.source_url,...(item.aliases||[])].map(urlKey).filter(Boolean);
     keys.forEach(key=>mediaMap.set(key,item));
     (item.post_ids||[]).forEach(id=>{if(!mediaByPost.has(id))mediaByPost.set(id,[]);mediaByPost.get(id).push(item);});
    }
    setMediaStatus('MEDIA VAULT VERIFIED // '+manifest.item_count+' FILES // IMAGES, AUDIO, VIDEO AND DOCUMENTS',true);
   }else setMediaStatus('MEDIA RECOVERY IN PROGRESS // TEXT IS AVAILABLE; MEDIA WILL APPEAR AFTER EVERY FILE HAS BEEN VERIFIED',false);
  }else if(manifest)setMediaStatus('MEDIA INVENTORY UNAVAILABLE // LOCAL TEXT REMAINS AVAILABLE',false);
  else setMediaStatus('MEDIA INVENTORY TEMPORARILY UNAVAILABLE // LOCAL TEXT REMAINS AVAILABLE',false);
  categoryOrder.filter(name=>records.some(r=>r.categories.includes(name))).forEach(name=>{expandedCategories.add(name);const option=document.createElement('option');option.value=name;option.textContent=name;category.append(option)});
  render();
  initArchiveFeatures().catch(error=>{console.error('Human Archive interactive features failed:',error);openRequestedRecordFromUrl();});
 }catch(error){console.error('Human Archive local index failed:',error);list.textContent='THE LOCAL ARCHIVE COULD NOT BE LOADED. PLEASE REFRESH IN A MOMENT.';count.textContent='LOCAL ARCHIVE UNAVAILABLE';}
}
bindEgoPortraitViewer();
search.addEventListener('input',render);year.addEventListener('change',render);category.addEventListener('change',render);init();
})();