(()=>{'use strict';
const search=document.getElementById('ha-search'),year=document.getElementById('ha-year'),category=document.getElementById('ha-category'),list=document.getElementById('ha-list'),count=document.getElementById('ha-count'),mediaStatus=document.getElementById('ha-media-status');
let records=[],mediaItems=[],mediaMap=new Map(),mediaByPost=new Map(),mediaReady=false,publicBase='';
let imageViewer=null,imageViewerImage=null,imageViewerCaption=null,imageViewerZoom=null,imageViewerOriginal=null,imageViewerClose=null;
const expandedCategories=new Set();
const categoryOrder=['Nimic și Ființă','This notion','Dialog monolog','Gânduri','Cântec','Belief','Snob','PERSONAL PROJECTS','Haiku'];

// Human Archive chamber state and public Supabase configuration.
let chamberRecordId=null;
const SUPABASE_URL='https://oeyxsqocldlovhsmzcjw.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_kuUFxaClmROwgZpGIw6bzg_ddvb521h';
let archiveSupabase=null,archiveAdmin=false,archiveUserId=null,archiveAuthBound=false;
let favoriteRecordIds=new Set(),favoriteSaveError=false,recordStructureOverrides=new Map();
let mediaHashByPath=new Map();
let recordChamber=null,recordChamberReturnFocus=null;

const clean=value=>String(value??'').normalize('NFKC').toLocaleLowerCase().trim();

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
 function copy(node,parent){
  if(node.nodeType===Node.TEXT_NODE){parent.append(document.createTextNode(node.nodeValue||''));return;}
  if(node.nodeType!==Node.ELEMENT_NODE)return;
  const tag=node.tagName;
  if(blocked.has(tag))return;
  if(tag==='IMG'){
   const item=getMedia(node.getAttribute('src')||node.getAttribute('data-src')||'');
   if(item&&mediaReady){appendLocalImage(parent,item,record,used);}
   else appendMissing(parent,'Image not yet available in the recovered media collection.');
   return;
  }
  if(tag==='AUDIO'||tag==='VIDEO'){
   const item=getMedia(node.getAttribute('src')||'');
   if(item&&mediaReady){if(tag==='AUDIO')appendLocalAudio(parent,item,record,used);else appendLocalVideo(parent,item,record,used);return;}
   const mediaNode=document.createElement(tag.toLowerCase());mediaNode.controls=true;mediaNode.preload='metadata';
   node.childNodes.forEach(child=>copy(child,mediaNode));
   if(mediaNode.childNodes.length){parent.append(mediaNode);return;}
   appendMissing(parent,'Audio/video file not yet available in the recovered media collection.');return;
  }
  if(tag==='SOURCE'){
   const item=getMedia(node.getAttribute('src')||'');
   if(item&&mediaReady&&(parent.tagName==='AUDIO'||parent.tagName==='VIDEO')){
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
   if(media&&mediaReady){el.href=localMediaUrl(media);el.target='_blank';el.rel='noopener noreferrer';markUsed(media,used);}
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
 const {data,error}=await archiveSupabase.from('human_archive_record_structures').select('record_id,prompt_style,lyrics_style,output_text,output_media,updated_at');
 if(error){console.warn('Human Archive structures could not be loaded:',error);return;}
 recordStructureOverrides=new Map((data||[]).map(item=>[String(item.record_id),item]));
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
 const url=new URL(window.location.href);
 url.searchParams.set('record',String(record.id));
 return url.href;
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
 const recovered=mediaReady?uniqueRecordMedia(record,prefix).map(item=>({
  id:'recovered-'+String(item.id),
  name:mediaTitle(item,record),
  url:localMediaUrl(item),
  path:String(item.storage_path||''),
  mime_type:String(item.mime_type||''),
  storage:'recovered'
 })): [];
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
function makeChamberTextPanel(record,grid,structure){
 const panel=makeChamberDisclosure('01 // PROMPT STYLE','ha-chamber-panel','ha-chamber-panel-heading');
 panel.body.append(makeChamberNode('div','ha-chamber-structure-text',structure.prompt_style||'No prompt style has been saved for this record yet.'));
 grid.append(panel.details);
 const lyrics=makeChamberDisclosure('02 // LYRICS STYLE','ha-chamber-panel','ha-chamber-panel-heading');
 lyrics.body.append(makeChamberNode('div','ha-chamber-structure-text',structure.lyrics_style||'No lyrics-style notes have been saved for this record yet.'));
 grid.append(lyrics.details);
}
function appendChamberOutputView(record,grid,structure){
 const output=makeChamberDisclosure('03 // OUTPUT','ha-chamber-panel ha-chamber-output','ha-chamber-panel-heading');
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
function renderChamberMediaEditor(sectionBody,record,type,items,status){
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
 grid.replaceChildren();
 const prompt=makeChamberDisclosure('01 // PROMPT STYLE','ha-chamber-panel ha-chamber-edit-panel','ha-chamber-panel-heading');
 const promptArea=document.createElement('textarea');promptArea.className='ha-chamber-editor-field';promptArea.name='prompt_style';promptArea.rows=9;
 promptArea.value=structure.prompt_style;promptArea.placeholder='Paste or write the AI / Suno style prompt…';prompt.body.append(promptArea);grid.append(prompt.details);
 const lyrics=makeChamberDisclosure('02 // LYRICS STYLE','ha-chamber-panel ha-chamber-edit-panel','ha-chamber-panel-heading');
 const lyricsArea=document.createElement('textarea');lyricsArea.className='ha-chamber-editor-field';lyricsArea.name='lyrics_style';lyricsArea.rows=9;
 lyricsArea.value=structure.lyrics_style;lyricsArea.placeholder='Add lyric instructions, structure, vocal direction or generation notes…';lyrics.body.append(lyricsArea);grid.append(lyrics.details);
 const output=makeChamberDisclosure('03 // OUTPUT','ha-chamber-panel ha-chamber-output ha-chamber-edit-panel','ha-chamber-panel-heading');
 const text=makeChamberDisclosure('TEXT','ha-chamber-output-section ha-chamber-subdisclosure','ha-chamber-output-label');
 const textArea=document.createElement('textarea');textArea.className='ha-chamber-editor-field';textArea.name='output_text';textArea.rows=14;
 textArea.value=structure.output_text;textArea.placeholder='Edit the original text output…';text.body.append(textArea);output.body.append(text.details);
 ['image','audio','video'].forEach(type=>{
  const media=makeChamberDisclosure(type.toUpperCase(),'ha-chamber-output-section ha-chamber-subdisclosure','ha-chamber-output-label');
  const items=editorMedia[type];
  const markTouched=()=>{
   mediaTouched[type]=true;
  };
  const sectionBody=media.body;
  renderChamberMediaEditor(sectionBody,record,type,items,status);
  // Changes are marked by the file-input and remove controls in the section.
  sectionBody.addEventListener('click',event=>{
   if(event.target.closest('.ha-chamber-media-remove'))markTouched();
  });
  sectionBody.addEventListener('change',event=>{
   if(event.target.matches('.ha-chamber-file-input'))markTouched();
  });
  output.body.append(media.details);
 });
 grid.append(output.details);
 const actions=makeChamberNode('div','ha-chamber-editor-actions');
 const save=makeChamberNode('button','ha-chamber-save','SAVE CHAMBER');save.type='button';
 const cancel=makeChamberNode('button','ha-chamber-cancel','CANCEL');cancel.type='button';
 actions.append(save,cancel);grid.append(actions);
 bindChamberDisclosureControls(grid,expandButton);
 cancel.addEventListener('click',()=>{
  status.textContent='';
  renderRecordStructureView(record,grid,status,editButton,expandButton);
 });
 save.addEventListener('click',async()=>{
  if(!archiveAdmin||!archiveSupabase||!archiveUserId){status.textContent='ADMIN SESSION REQUIRED';return;}
  save.disabled=true;cancel.disabled=true;save.textContent='SAVING…';status.textContent='PREPARING CHAMBER UPDATE…';
  const uploadedPaths=[];
  const oldStructure=recordStructureOverrides.get(String(record.id))||{};
  const existingOutput=oldStructure.output_media&&typeof oldStructure.output_media==='object'?oldStructure.output_media:{};
  const oldOwnedPaths=['image','audio','video'].flatMap(type=>Array.isArray(existingOutput[type])?existingOutput[type]:[])
   .filter(item=>item&&item.storage==='vha-post-media'&&typeof item.path==='string'&&item.path.startsWith('human-archive/'+String(record.id)+'/'))
   .map(item=>item.path);
  try{
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
    prompt_style:promptArea.value,
    lyrics_style:lyricsArea.value,
    output_text:textArea.value,
    output_media:outputMedia,
    updated_at:new Date().toISOString(),
    updated_by:archiveUserId
   };
   status.textContent='SAVING CHAMBER STRUCTURE…';
   const {error}=await archiveSupabase.from('human_archive_record_structures').upsert(row,{onConflict:'record_id'});
   if(error)throw error;
   recordStructureOverrides.set(String(record.id),row);
   const keepPaths=new Set(['image','audio','video'].flatMap(type=>Array.isArray(outputMedia[type])?outputMedia[type]:[])
    .filter(item=>item&&item.storage==='vha-post-media').map(item=>item.path).filter(Boolean));
   const removedPaths=[...new Set(oldOwnedPaths)].filter(path=>!keepPaths.has(path));
   let cleanupWarning=false;
   if(removedPaths.length){
    const {error:removeError}=await archiveSupabase.storage.from('vha-post-media').remove(removedPaths);
    if(removeError){cleanupWarning=true;console.warn('Removed chamber media could not be cleaned from storage:',removeError);}
   }
   status.textContent=cleanupWarning?'CHAMBER SAVED — SOME REMOVED FILES COULD NOT BE CLEANED UP':'CHAMBER REDESIGNED // CHANGES SAVED';
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
 const titleRow=makeChamberNode('div','ha-chamber-title-row');
 const title=makeChamberNode('h2','',record.title);
 const expand=makeChamberNode('button','ha-chamber-expand-all','SEAL ALL ↑');expand.type='button';
 expand.setAttribute('aria-expanded','true');expand.setAttribute('aria-label','Retract all chamber sections');
 titleRow.append(title,expand);heading.append(meta,titleRow);header.append(heading);
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
 close.addEventListener('click',()=>recordChamber.close());
 const footer=makeChamberNode('footer','ha-chamber-footer');
 const source=safeExternalUrl(record.url,new Set(['emanuelstefancu.wordpress.com']));
 if(source){const link=makeChamberNode('a','ha-chamber-source','OPEN ORIGINAL SOURCE ↗');link.href=source;link.target='_blank';link.rel='noopener noreferrer';footer.append(link);}
 footer.append(makeChamberNode('span','ha-chamber-footer-note','NO TRACE IS EVER THE WHOLE PERSON.'));
 main.append(footer);shell.append(header,main);return shell;
}
function ensureRecordChamber(){
 if(recordChamber)return recordChamber;
 recordChamber=makeChamberNode('dialog','ha-record-chamber');
 recordChamber.setAttribute('aria-label','Human Archive record chamber');
 recordChamber.addEventListener('click',event=>{if(event.target===recordChamber)recordChamber.close();});
 recordChamber.addEventListener('close',()=>{
  document.body.classList.remove('ha-chamber-open');
  const url=new URL(window.location.href);url.searchParams.delete('record');
  history.replaceState(history.state,'',url.pathname+(url.search?url.search:'')+url.hash);
  if(recordChamberReturnFocus?.isConnected)recordChamberReturnFocus.focus();
  recordChamberReturnFocus=null;
 });
 document.body.append(recordChamber);return recordChamber;
}
function openArchiveRecordChamber(record,trigger){
 if(!record||!records.some(item=>String(item.id)===String(record.id)))return;
 const dialog=ensureRecordChamber();if(dialog.open)dialog.close();
 dialog.replaceChildren(buildRecordChamber(record));chamberRecordId=String(record.id);recordChamberReturnFocus=trigger||null;
 const url=new URL(window.location.href);url.searchParams.set('record',String(record.id));history.replaceState(history.state,'',url.pathname+url.search+url.hash);document.body.classList.add('ha-chamber-open');
 try{dialog.showModal();}catch(error){document.body.classList.remove('ha-chamber-open');console.error('Could not open the Human Archive chamber:',error);}
}
function openRequestedRecordFromUrl(){
 const requested=new URLSearchParams(window.location.search).get('record');
 if(!requested||!/^[0-9]+$/.test(requested))return;
 const record=records.find(item=>String(item.id)===requested);if(!record)return;
 search.value=record.title;year.value='';category.value='';render();
 const card=list.querySelector('.ha-record-card[data-ha-record-id="'+requested+'"]');card?.scrollIntoView({behavior:'smooth',block:'center'});openArchiveRecordChamber(record,null);
}
async function initArchiveFeatures(){
 if(!window.supabase?.createClient){openRequestedRecordFromUrl();return;}
 archiveSupabase=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
 await Promise.all([loadArchiveFavorites(),loadRecordStructureOverrides(),refreshArchiveAdmin()]);
 if(!archiveAuthBound){
  archiveAuthBound=true;
  archiveSupabase.auth.onAuthStateChange((_event,session)=>{
   window.setTimeout(async()=>{
    await refreshArchiveAdmin(session);
    render();
    syncFavoriteControls();
    if(recordChamber?.open){
     const record=records.find(item=>String(item.id)===chamberRecordId);
     if(record)openArchiveRecordChamber(record,null);
    }
   },0);
  });
 }
 render();
 syncFavoriteControls();
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
 const top=document.createElement('div');top.className='ha-entry-top';const code=document.createElement('small');code.className='ha-entry-code';code.textContent='HA-'+record.year+'-'+String(record.id).padStart(4,'0');const yr=document.createElement('span');yr.className='ha-entry-year';yr.textContent=record.year;top.append(code,yr);
 const title=document.createElement('strong');title.textContent=record.title;const bottom=document.createElement('div');bottom.className='ha-entry-bottom';const date=document.createElement('small');date.textContent=record.date+' // LOCAL ARCHIVE COPY';const action=document.createElement('span');action.textContent='READ LOCAL TEXT ↓';bottom.append(date,action);link.append(top,title,bottom);link.style.setProperty('--entry-order',String(index));
 const quickActions=makeChamberNode('div','ha-entry-quick-actions');quickActions.hidden=true;
 const chamber=makeChamberNode('button','ha-entry-chamber','ENTER THE CHAMBER ↗');chamber.type='button';chamber.addEventListener('click',()=>openArchiveRecordChamber(record,chamber));
 const favorite=makeChamberNode('button','ha-favorite-toggle','☆');favorite.type='button';favorite.dataset.haFavoriteId=String(record.id);favorite.hidden=!archiveAdmin;favorite.setAttribute('aria-pressed',String(favoriteRecordIds.has(String(record.id))));favorite.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();toggleArchiveFavorite(record.id,favorite);});
 quickActions.append(chamber,favorite);
 link.addEventListener('click',()=>{const open=content.hidden;content.hidden=!open;link.setAttribute('aria-expanded',String(open));action.textContent=open?'CLOSE LOCAL TEXT ↑':'READ LOCAL TEXT ↓';quickActions.hidden=!open;});
 const body=document.createElement('div');body.className='ha-entry-body';const used=new Set();appendSafeContent(body,record.content_html||'',record,used);
 if(!body.childNodes.length){const message=document.createElement('p');message.textContent='No local text was captured for this entry.';body.append(message);}
 content.append(body);const gallery=mediaReady?makeAttachmentGallery(record,used):null;if(gallery)content.append(gallery);
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
  records=data.filter(r=>r&&typeof r.title==='string'&&typeof r.year==='string'&&typeof r.date==='string'&&Number.isFinite(Number(r.id))&&typeof r.url==='string'&&Array.isArray(r.categories))
   .map(r=>({...r,content_html:contentById.get(String(r.id))?.content_html||''}));
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