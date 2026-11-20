(()=>{'use strict';
const search=document.getElementById('ha-search'),year=document.getElementById('ha-year'),category=document.getElementById('ha-category'),list=document.getElementById('ha-list'),count=document.getElementById('ha-count'),mediaStatus=document.getElementById('ha-media-status');
const newTransmissionButton=document.getElementById('ha-new-transmission'),createTransmissionStatus=document.getElementById('ha-create-status');
const hasArchiveIndex=Boolean(search&&year&&category&&list&&count);
const archiveHomeUrl=new URL('/landing-page/human-archive/',window.location.origin);
let chamberSaveConflict=false;
let flushActiveChamberAutosave=async()=>true;
let records=[],mediaItems=[],mediaMap=new Map(),mediaByPost=new Map(),mediaReady=false,publicBase='';
let imageViewer=null,imageViewerImage=null,imageViewerCaption=null,imageViewerZoom=null,imageViewerOriginal=null,imageViewerClose=null;
const expandedCategories=new Set();
const categoryOrder=['Nimic și Ființă','This notion','Dialog monolog','Gânduri','Cântec','Belief','Snob','PERSONAL PROJECTS','Haiku'];
const transmissionCategories=['HUMAN ARCHIVE','THE AWAKENING','THE DESCENT','THE RECONNECTION','THE TRANSFORMATION','THE RETURN'];

// Human Archive chamber state and GitHub-backed persistence.
let chamberRecordId=null;
let archiveAdmin=false,archiveUserId=null,archiveAuthBound=false,archiveWriteReady=true,archivePublicHeadSha=null;
let standaloneTransmissionRecordsPromise=null;
let favoriteRecordIds=new Set(),favoriteSaveError=false,recordStructureOverrides=new Map(),privateMediaUrlToPath=new Map();
let mediaHashByPath=new Map();
let recordChamber=null,recordChamberReturnFocus=null;

const clean=value=>String(value??'').normalize('NFKC').toLocaleLowerCase().trim();
function searchableBody(record){
 const source=String(record.content_html||'');
 if(record._searchBodySource!==source){
  const parsed=new DOMParser().parseFromString(source,'text/html');
  record._searchBodySource=source;
  record._searchBodyText=parsed.body.textContent||'';
 }
 return record._searchBodyText||'';
}
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
 const storage=String(item?.storage||'');
 const storedPath=String(item?.storage_path||item?.path||'');
 if(storage==='github-public'&&storedPath.startsWith('media/'))return '/landing-page/'+storedPath.split('/').map(encodeURIComponent).join('/');
 if(storage==='github-private'&&String(item?.url||'').startsWith('blob:'))return item.url;
 const recordId=(item?.post_ids||[]).map(value=>String(value).trim()).find(value=>/^[0-9]+$/.test(value));
 const filename=storedPath.split('/').pop();
 if(!recordId||!filename)return '';
 return '/landing-page/media/human-archive/HA-'+recordId.padStart(4,'0')+'/'+encodeURIComponent(filename);
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
function safeArchiveMediaUrl(raw,allowedHosts){
 const rawValue=String(raw||'');if(rawValue.startsWith('blob:')&&privateMediaUrlToPath.has(rawValue))return rawValue;
 const remote=safeExternalUrl(raw,allowedHosts);if(remote)return remote;
 try{const url=new URL(String(raw||''),document.baseURI);if(url.protocol==='https:'&&url.origin===window.location.origin&&url.pathname.startsWith('/landing-page/'))return url.href;}catch{}
 return null;
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
  if(control){control.setAttribute('aria-expanded','true');const action=control.querySelector('.ha-entry-bottom span');if(action)action.textContent='EXIT NICHE ↑';}
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
 const audio=document.createElement('audio');audio.controls=true;audio.preload='none';audio.src=localMediaUrl(item);audio.setAttribute('aria-label','Audio: '+mediaTitle(item,record));figure.append(audio);
 if(!embedded)parent.append(figure);markUsed(item,used);
}
function appendLocalVideo(parent,item,record,used){
 const embedded=parent.tagName==='FIGURE';
 const figure=embedded?parent:document.createElement('figure');figure.classList.add('ha-local-media','ha-local-video');
 const video=document.createElement('video');video.controls=true;video.preload='none';video.playsInline=true;video.src=localMediaUrl(item);video.setAttribute('aria-label','Video: '+mediaTitle(item,record));figure.append(video);
 if(!embedded){const title=document.createElement('figcaption');title.textContent=mediaTitle(item,record);figure.append(title);parent.append(figure);}
 markUsed(item,used);
}
function appendMediaLink(parent,item,record,used){
 const link=document.createElement('a');link.className='ha-local-media-link';link.href=localMediaUrl(item);link.target='_blank';link.rel='noopener noreferrer';link.textContent='OPEN FILE — '+mediaTitle(item,record);parent.append(link);markUsed(item,used);
}
function appendSafeContent(container,source,record,used){
 const doc=new DOMParser().parseFromString(String(source||''),'text/html');
 const allowed=new Set(['P','BR','STRONG','B','EM','I','U','S','STRIKE','DEL','H1','H2','H3','H4','UL','OL','LI','BLOCKQUOTE','HR','PRE','CODE','A','FIGURE','FIGCAPTION','DIV','SECTION','ASIDE','DETAILS','SUMMARY','SPAN','SMALL','SUP','SUB','TABLE','THEAD','TBODY','TR','TH','TD','NAV','ARTICLE','MARK']);
 const blocked=new Set(['SCRIPT','STYLE','OBJECT','EMBED','SVG','MATH','FORM','INPUT','BUTTON','TEXTAREA','SELECT','OPTION','LINK','META']);
 const iframeHosts=new Set(['www.youtube.com','www.youtube-nocookie.com','open.spotify.com','w.soundcloud.com','player.vimeo.com','www.dailymotion.com','www.loom.com']);
 const layoutClasses=new Set(['suno-post-layout','suno-text-column','suno-lyrics','suno-notes','suno-style-prompt','suno-learned','suno-chatgpt-learned','suno-label','plain-post-layout','plain-copy','plain-response','ha-pullquote','ha-verse','ha-button-block','ha-more-block','ha-markdown-source','ha-html-source','ha-buttons','ha-button','ha-columns','ha-group','ha-row','ha-stack','ha-grid','ha-spacer','ha-social-icons','ha-icon-block','ha-timeline','ha-tabs','ha-callout','ha-card','ha-media-text','ha-image-compare','ha-gallery','ha-slideshow','ha-tiled-gallery','ha-cover','ha-embed','ha-embed-youtube','ha-embed-spotify','ha-embed-soundcloud','ha-embed-card','ha-embed-link','ha-file-block','ha-audio-block','ha-podcast','ha-playlist','ha-page-break','wp-block-pullquote','wp-block-verse']);
 function copy(node,parent){
  if(node.nodeType===Node.TEXT_NODE){parent.append(document.createTextNode(node.nodeValue||''));return;}
  if(node.nodeType!==Node.ELEMENT_NODE)return;
  const tag=node.tagName;
  if(blocked.has(tag))return;
  const blockName=String(node.getAttribute('data-ha-block-name')||'').replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,80);
  if(blockName&&!node.classList?.contains('ha-columns')){
   const wrapper=makeChamberNode('div','ha-chamber-saved-block');
   wrapper.append(makeChamberNode('div','ha-chamber-saved-block-name',blockName));
   const content=node.cloneNode(true);content.removeAttribute('data-ha-block-name');
   copy(content,wrapper);parent.append(wrapper);return;
  }
  if(tag==='IMG'){
   const raw=node.getAttribute('src')||node.getAttribute('data-src')||'';
   const item=getMedia(raw);
   if(item&&(mediaReady||item.storage==='vha-post-media')){appendLocalImage(parent,item,record,used);}
   else{
    const src=safeArchiveMediaUrl(raw,new Set(['oeyxsqocldlovhsmzcjw.supabase.co','ioguymqdeuuursizifnn.supabase.co','i0.wp.com','emanuelstefancu.wordpress.com']));
    let valid=Boolean(src);
    if(valid){
     if(String(src).startsWith('blob:'))valid=privateMediaUrlToPath.has(rawSrc);
     else{
      const url=new URL(src);
      if(url.hostname==='oeyxsqocldlovhsmzcjw.supabase.co')valid=/^\/storage\/v1\/object\/public\/(vha-post-media|poetry-media)\//.test(url.pathname);
      else if(url.hostname==='ioguymqdeuuursizifnn.supabase.co')valid=/^\/storage\/v1\/object\/public\/human-archive-media\//.test(url.pathname);
      else if(url.origin===window.location.origin)valid=url.pathname.startsWith('/landing-page/');
      else valid=url.pathname.includes('/wp-content/uploads/');
     }
    }
    if(valid){const image=document.createElement('img');image.src=src;image.alt=node.getAttribute('alt')||record.title;image.loading='lazy';image.style.maxWidth='100%';image.style.height='auto';parent.append(image);}
    else appendMissing(parent,'Image not yet available in the recovered media collection.');
   }
   return;
  }
  if(tag==='AUDIO'||tag==='VIDEO'){
   const raw=node.getAttribute('src')||'';
   const item=getMedia(raw);
   if(item&&(mediaReady||item.storage==='vha-post-media')){if(tag==='AUDIO')appendLocalAudio(parent,item,record,used);else appendLocalVideo(parent,item,record,used);return;}
   const src=safeArchiveMediaUrl(raw,new Set(['oeyxsqocldlovhsmzcjw.supabase.co','ioguymqdeuuursizifnn.supabase.co']));
   const valid=Boolean(src)&&(()=>{const url=new URL(src);return url.hostname==='oeyxsqocldlovhsmzcjw.supabase.co'?/^\/storage\/v1\/object\/public\/(vha-post-media|poetry-media)\//.test(url.pathname):url.hostname==='ioguymqdeuuursizifnn.supabase.co'?/^\/storage\/v1\/object\/public\/human-archive-media\//.test(url.pathname):url.origin===window.location.origin&&url.pathname.startsWith('/landing-page/');})();
   const mediaNode=document.createElement(tag.toLowerCase());mediaNode.controls=true;mediaNode.preload='none';
   if(valid)mediaNode.src=src;
   if(tag==='VIDEO')mediaNode.playsInline=true;
   node.childNodes.forEach(child=>copy(child,mediaNode));
   if(valid||mediaNode.childNodes.length){parent.append(mediaNode);return;}
   appendMissing(parent,'Audio/video file not yet available in the recovered media collection.');return;
  }
  if(tag==='SOURCE'){
   const raw=node.getAttribute('src')||'';
   const item=getMedia(raw);
   if(item&&(mediaReady||item.storage==='vha-post-media')&&(parent.tagName==='AUDIO'||parent.tagName==='VIDEO')){
    const source=document.createElement('source');source.src=localMediaUrl(item);source.type=item.mime_type;parent.append(source);markUsed(item,used);
   }else{
    const src=safeExternalUrl(raw,new Set(['oeyxsqocldlovhsmzcjw.supabase.co']));
    if(src&&/^\/storage\/v1\/object\/public\/vha-post-media\//.test(new URL(src).pathname)&&(parent.tagName==='AUDIO'||parent.tagName==='VIDEO')){
     const source=document.createElement('source');source.src=src;source.type=node.getAttribute('type')||'';parent.append(source);
    }
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
  const alignment=(node.style?.textAlign||'').toLowerCase();
  if(['left','center','right','justify'].includes(alignment))el.style.textAlign=alignment;
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
 if(!archiveAdmin||!window.VHACMSStore){favoriteRecordIds=new Set();return;}
 try{favoriteRecordIds=new Set(await window.VHACMSStore.getFavorites());}
 catch(error){console.warn('Private Human Archive favourites could not be loaded:',error);}
}

async function loadRecordStructureOverrides(){
 // The canonical Human Archive JSON already contains the complete editor_structures array.
 // The standalone editor launcher also needs to hydrate it when no archive index has run.
 if(recordStructureOverrides.size)return recordStructureOverrides;
 const collection=await fetchArchiveJson('../content/human-archive.json',true);
 if(!collection||!Array.isArray(collection.editor_structures))throw new Error('The canonical Human Archive editor structures are unavailable.');
 recordStructureOverrides=new Map(collection.editor_structures.map(item=>[String(item.record_id),item]));
 return recordStructureOverrides;
}

async function loadTransmissionRecords(){
 const collection=await fetchArchiveJson('../content/transmissions.json',true);
 if(!collection||!Array.isArray(collection.records))throw new Error('The canonical Transmissions collection is unavailable.');
 records=records.filter(record=>record.source_type!=='transmission');
 mediaItems=mediaItems.filter(item=>item.storage!=='github-public');
 for(const [key,item] of mediaMap){if(item.storage==='github-public')mediaMap.delete(key);}
 const additions=collection.records.filter(post=>post&&post.status==='published'&&Number.isSafeInteger(Number(post.archive_record_id))&&post.slug).map(post=>{
  const id=Number(post.archive_record_id),stamp=post.published_at||post.created_at||new Date().toISOString();
  const date=String(stamp).slice(0,10),year=date.slice(0,4);
  const sourceItems=Array.isArray(post.media_items)?post.media_items:(post.media_url?[{url:post.media_url,path:post.media_path,type:post.media_type||'audio',name:post.title}]:[]);
  const attached=sourceItems.filter(item=>item&&item.status!=='pending_recovery'&&typeof(item.src||item.url)==='string'&&['image','audio','video'].includes(item.type)).map((item,index)=>{
   const relative=String(item.src||item.url||item.path||'');
   const publicUrl=relative.startsWith('http')?relative:('/landing-page/'+relative.replace(/^\/+/, ''));
   return {id:'transmission-'+post.id+'-'+index,title:item.name||post.title,alt_text:item.name||post.title,
    mime_type:item.type==='image'?'image/unknown':item.type==='video'?'video/unknown':'audio/unknown',
    storage_path:String(item.path||item.src||item.url||''),source_url:item.source_url||publicUrl,url:publicUrl,
    storage:'github-public',post_ids:[id]};
  });
  const content=String(post.content_html||'').replace(/(["'])((?:media\/transmissions)\/[^"']+)\1/g,(match,quote,path)=>quote+'/landing-page/'+path.replace(/^\/+/, '')+quote);
  return {id,title:post.title,slug:post.slug,archiveIdentifier:'HA-'+year+'-'+String(id).padStart(4,'0'),year,date,url:'',categories:[post.category||'TRANSMISSIONS'],content_html:content,source_type:'transmission',post_id:post.id,status:'published',excerpt:post.excerpt||'',media_items:attached,created_at:post.created_at,published_at:post.published_at,updated_at:post.updated_at,media_width:post.media_width||100};
 });
 additions.forEach(record=>{
  records.push(record);
  record.media_items.forEach(item=>{mediaItems.push(item);if(item.url)mediaMap.set(urlKey(item.url),item);});
  const name=record.categories[0];
  if(!categoryOrder.includes(name))categoryOrder.push(name);
  if(category&&![...category.options].some(option=>option.value===name)){const option=document.createElement('option');option.value=name;option.textContent=name;category.append(option);}
  expandedCategories.add(name);
 });
 if(archiveAdmin&&window.VHACMSStore){
  try{
   const drafts=await window.VHACMSStore.listDrafts();
   for(const draft of drafts){
    const id=Number(draft.record_id);
    if(!Number.isSafeInteger(id)||!draft.post_id)continue;
    const privateAssets=await window.VHACMSStore.getDraftMediaFiles(draft.draft_id);
    const urlByPath=new Map(privateAssets.map(asset=>[asset.path,asset.url]));
    privateAssets.forEach(asset=>privateMediaUrlToPath.set(asset.url,asset.path));
    const hydrate=item=>{
     if(!item||typeof item!=='object')return item;
     const path=String(item.path||'');
     const url=urlByPath.get(path)||item.url||path;
     return {...item,url,src:url,storage:item.storage||'github-private'};
    };
    const content=draft.content||{};
    const body=String(content.transmission_body||'').replace(/cms-data\/v1\/media\/drafts\/[^\s"'<>)]*/g,match=>urlByPath.get(match)||match);
    const blocks=(content.blocks||[]).map(block=>({...block,html:String(block.html||'').replace(/cms-data\/v1\/media\/drafts\/[^\s"'<>)]*/g,match=>urlByPath.get(match)||match)}));
    const structure={record_id:id,transmission_body:body,prompt_style:content.prompt_style||'',lyrics_style:content.lyrics_style||'',output_text:content.output_text||'',
     output_media:Object.fromEntries(['image','audio','video'].map(kind=>[kind,(content.output_media?.[kind]||[]).map(hydrate)])),blocks,updated_at:draft.updated_at};
    recordStructureOverrides.set(String(id),structure);
    const stamp=draft.created_at||new Date().toISOString(),date=String(stamp).slice(0,10);
    const hadPublishedRecord=records.some(item=>item.source_type==='transmission'&&item.post_id===draft.post_id);
    if(hadPublishedRecord)records=records.filter(item=>!(item.source_type==='transmission'&&item.post_id===draft.post_id));
    const record={id,title:draft.metadata?.title||'Untitled Transmission',slug:draft.metadata?.slug||'untitled-transmission',
     archiveIdentifier:'HA-'+date.slice(0,4)+'-'+String(id).padStart(4,'0'),year:date.slice(0,4),date,url:'',
     categories:[draft.metadata?.category||'UNASSIGNED'],content_html:body,source_type:'transmission',post_id:draft.post_id,draft_id:draft.draft_id,
     status:hadPublishedRecord?'published':'draft',excerpt:draft.metadata?.excerpt||'',media_items:(content.media_items||[]).map(hydrate),created_at:draft.created_at,
     updated_at:draft.updated_at,published_at:null,media_width:draft.metadata?.media_width||100,isDraft:true,isNew:draft.source==='new',_editOfPublished:hadPublishedRecord,draft_source:draft.source,_repoCommitSha:draft._repoCommitSha,_draftData:draft};
    records.push(record);
    record.media_items.forEach(item=>{if(item.url){mediaItems.push({...item,post_ids:[id],storage:'github-private'});mediaMap.set(urlKey(item.url),item);}});
    if(record.categories[0]&&!categoryOrder.includes(record.categories[0]))categoryOrder.push(record.categories[0]);
   }
  }catch(error){console.warn('Private Transmission drafts could not be loaded:',error);}
 }
}

async function ensureStandaloneTransmissionRecords(){
 if(hasArchiveIndex)return;
 if(!standaloneTransmissionRecordsPromise){
  standaloneTransmissionRecordsPromise=Promise.all([loadRecordStructureOverrides(),loadTransmissionRecords()])
   .catch(error=>{standaloneTransmissionRecordsPromise=null;throw error;});
 }
 await standaloneTransmissionRecordsPromise;
}
async function refreshArchiveAdmin(sessionOverride){
 if(!window.VHAGitHub){archiveAdmin=false;archiveUserId=null;return false;}
 try{
  const session=sessionOverride===undefined?await window.VHAGitHub.restoreSession():sessionOverride;
  const user=session?.user||null;
  archiveAdmin=Boolean(user&&String(user.login||'').toLowerCase()==='iyakuza');
  archiveUserId=archiveAdmin?String(user.login):null;
 }catch(error){archiveAdmin=false;archiveUserId=null;}
 return archiveAdmin;
}

async function toggleArchiveFavorite(recordId,button){
 const id=String(recordId);
 if(!archiveAdmin||!window.VHACMSStore||!/^[0-9]+$/.test(id)||button.disabled)return;
 const wasFavorite=favoriteRecordIds.has(id);button.disabled=true;favoriteSaveError=false;
 button.title=wasFavorite?'REMOVING FAVOURITE…':'SAVING FAVOURITE…';
 try{
  await window.VHACMSStore.setFavorite(id,!wasFavorite);
  if(wasFavorite)favoriteRecordIds.delete(id);else favoriteRecordIds.add(id);
 }catch(error){console.error('Human Archive favourite could not be saved:',error);favoriteSaveError=true;}
 finally{document.querySelectorAll('[data-ha-favorite-id="'+id+'"]').forEach(control=>{control.disabled=!archiveAdmin;});syncFavoriteControls();}
}

function chamberShareUrl(record){
 return new URL(encodeURIComponent(record.slug),archiveHomeUrl).href;
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
  output_media:saved?.output_media&&typeof saved.output_media==='object'&&!Array.isArray(saved.output_media)?saved.output_media:null,
  blocks:Array.isArray(saved?.blocks)?saved.blocks:[]
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
 const raw=String(source??'');
 const parsed=new DOMParser().parseFromString(raw,'text/html');
 // Legacy archive fields may contain plain text rather than HTML. Convert their
 // actual newline structure into paragraphs and line breaks before sanitizing.
 if(!parsed.body.children.length&&/[\r\n]/.test(raw)){
  const fragment=document.createDocumentFragment();
  raw.replace(/\r\n?/g,'\n').split(/\n{2,}/).forEach(paragraph=>{
   const block=document.createElement('p');
   paragraph.split('\n').forEach((line,index)=>{
    if(index)block.append(document.createElement('br'));
    block.append(document.createTextNode(line));
   });
   fragment.append(block);
  });
  const holder=document.createElement('div');holder.append(fragment);return holder.innerHTML;
 }
 const allowed=new Set(['P','BR','STRONG','B','EM','I','U','S','STRIKE','DEL','H1','H2','H3','H4','BLOCKQUOTE','UL','OL','LI','A','HR','CODE','PRE','DIV','SECTION','ASIDE','DETAILS','SUMMARY','FIGURE','FIGCAPTION','IMG','AUDIO','VIDEO','SOURCE','IFRAME','TABLE','THEAD','TBODY','TR','TH','TD','NAV','ARTICLE','MARK','SMALL','SPAN']);
 const allowedClasses=new Set(['suno-post-layout','suno-text-column','suno-lyrics','suno-notes','suno-style-prompt','suno-learned','suno-chatgpt-learned','suno-label','plain-post-layout','plain-copy','plain-response','ha-pullquote','ha-verse','ha-button-block','ha-more-block','ha-markdown-source','ha-html-source','ha-buttons','ha-button','ha-columns','ha-group','ha-row','ha-stack','ha-grid','ha-spacer','ha-social-icons','ha-icon-block','ha-timeline','ha-tabs','ha-callout','ha-card','ha-media-text','ha-image-compare','ha-gallery','ha-slideshow','ha-tiled-gallery','ha-cover','ha-embed','ha-embed-youtube','ha-embed-spotify','ha-embed-soundcloud','ha-embed-card','ha-embed-link','ha-file-block','ha-audio-block','ha-podcast','ha-playlist','ha-page-break','wp-block-pullquote','wp-block-verse']);
 function copy(node,parent){
  if(node.nodeType===Node.TEXT_NODE){parent.append(document.createTextNode(node.nodeValue||''));return;}
  if(node.nodeType!==Node.ELEMENT_NODE)return;
  if(node.hasAttribute('data-ha-editor-block')){
   const content=node.querySelector('[data-ha-block-content]');
   if(content)content.childNodes.forEach(child=>copy(child,parent));
   return;
  }
  if(node.hasAttribute('data-ha-block-content')){node.childNodes.forEach(child=>copy(child,parent));return;}
  if(!allowed.has(node.tagName)){node.childNodes.forEach(child=>copy(child,parent));return;}
  const element=document.createElement(node.tagName.toLowerCase());
  if(node.tagName==='IMG'){
   const rawSrc=node.getAttribute('src')||'';
   const media=getMedia(rawSrc);
   const src=media&&mediaReady?localMediaUrl(media):safeArchiveMediaUrl(rawSrc,new Set(['oeyxsqocldlovhsmzcjw.supabase.co','ioguymqdeuuursizifnn.supabase.co','i0.wp.com','emanuelstefancu.wordpress.com']));
   let valid=Boolean(src);
    if(valid&&String(src).startsWith('blob:'))valid=privateMediaUrlToPath.has(rawSrc);
   if(valid){const url=new URL(src);if(url.hostname==='oeyxsqocldlovhsmzcjw.supabase.co')valid=/^\/storage\/v1\/object\/public\/(vha-post-media|poetry-media)\//.test(url.pathname);else if(url.hostname==='ioguymqdeuuursizifnn.supabase.co')valid=/^\/storage\/v1\/object\/public\/human-archive-media\//.test(url.pathname);else if(url.origin===window.location.origin)valid=url.pathname.startsWith('/landing-page/');else valid=url.pathname.includes('/wp-content/uploads/');}
   if(!valid)return;
   element.src=src;element.alt=String(node.getAttribute('alt')||'');element.loading='lazy';element.style.maxWidth='100%';element.style.height='auto';
  }
  if(node.tagName==='AUDIO'||node.tagName==='VIDEO'){
   const rawSrc=node.getAttribute('src')||'';
   if(rawSrc){
    const media=getMedia(rawSrc);
    const src=media&&mediaReady?localMediaUrl(media):safeArchiveMediaUrl(rawSrc,new Set(['oeyxsqocldlovhsmzcjw.supabase.co','ioguymqdeuuursizifnn.supabase.co']));
     let valid=Boolean(src);
     if(valid){
      if(String(src).startsWith('blob:'))valid=privateMediaUrlToPath.has(rawSrc);
      else{
       const url=new URL(src);
       valid=url.hostname==='oeyxsqocldlovhsmzcjw.supabase.co'?/^\/storage\/v1\/object\/public\/(vha-post-media|poetry-media)\//.test(url.pathname):
        url.hostname==='ioguymqdeuuursizifnn.supabase.co'?/^\/storage\/v1\/object\/public\/human-archive-media\//.test(url.pathname):
        url.origin===window.location.origin&&url.pathname.startsWith('/landing-page/');
      }
     }
     if(!valid)return;
    element.src=src;
   }else if(!node.querySelector('source'))return;
   element.controls=true;element.preload='none';
   if(node.tagName==='VIDEO')element.playsInline=true;
  }
  if(node.tagName==='SOURCE'){
   const rawSrc=node.getAttribute('src')||'';
   const media=getMedia(rawSrc);
   const src=media&&mediaReady?localMediaUrl(media):safeArchiveMediaUrl(rawSrc,new Set(['oeyxsqocldlovhsmzcjw.supabase.co','ioguymqdeuuursizifnn.supabase.co']));
    let valid=Boolean(src);
    if(valid){
     if(String(src).startsWith('blob:'))valid=privateMediaUrlToPath.has(rawSrc);
     else{
      const url=new URL(src);
      valid=url.hostname==='oeyxsqocldlovhsmzcjw.supabase.co'?/^\/storage\/v1\/object\/public\/(vha-post-media|poetry-media)\//.test(url.pathname):
       url.hostname==='ioguymqdeuuursizifnn.supabase.co'?/^\/storage\/v1\/object\/public\/human-archive-media\//.test(url.pathname):
       url.origin===window.location.origin&&url.pathname.startsWith('/landing-page/');
     }
    }
    if(!valid)return;
   element.src=src;element.type=String(node.getAttribute('type')||'');
  }
  if(node.tagName==='IFRAME'){
   const src=safeExternalUrl(node.getAttribute('src'),new Set(['www.youtube.com','www.youtube-nocookie.com','open.spotify.com','w.soundcloud.com','player.vimeo.com','www.dailymotion.com','www.loom.com']));
   if(!src)return;
   const url=new URL(src),host=url.hostname.toLowerCase();
   if((host.includes('youtube')&&!url.pathname.startsWith('/embed/'))||(host==='open.spotify.com'&&!url.pathname.startsWith('/embed/'))||(host==='w.soundcloud.com'&&!url.pathname.startsWith('/player/'))||(host==='player.vimeo.com'&&!url.pathname.startsWith('/video/'))||(host==='www.dailymotion.com'&&!url.pathname.startsWith('/embed/video/'))||(host==='www.loom.com'&&!url.pathname.startsWith('/embed/')))return;
   element.src=src;element.title=String(node.getAttribute('title')||'Embedded media');element.loading='lazy';element.referrerPolicy='strict-origin-when-cross-origin';element.allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';element.allowFullscreen=true;
  }
  if(node.tagName==='A'){
   const raw=(node.getAttribute('href')||'').trim();
   try{const url=new URL(raw);if((url.protocol==='https:'&&url.hostname&&!url.username&&!url.password)||(url.protocol==='mailto:'&&url.pathname)){element.href=url.href;element.target='_blank';element.rel='noopener noreferrer';}}catch{}
  }
  if(node.hasAttribute('class')){
   const classes=(node.getAttribute('class')||'').split(/\s+/).filter(name=>allowedClasses.has(name));
   if(classes.length)element.className=classes.join(' ');
  }
  const blockName=String(node.getAttribute('data-ha-block-name')||'').replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,80);
  if(blockName)element.setAttribute('data-ha-block-name',blockName);
  const alignment=(node.style?.textAlign||'').toLowerCase();
  if(['left','center','right','justify'].includes(alignment))element.style.textAlign=alignment;
  node.childNodes.forEach(child=>copy(child,element));parent.append(element);
 }
 const fragment=document.createDocumentFragment();
 parsed.body.childNodes.forEach(node=>copy(node,fragment));
 const holder=document.createElement('div');holder.append(fragment);return holder.innerHTML;
}
function clearChamberFormattingToolbar(){
 const toolbar=recordChamber?.querySelector(':scope > .ha-rich-toolbar');
 toolbar?.remove();
 recordChamber?.querySelector('.ha-chamber-delete-draft')?.remove();
 recordChamber?.classList.remove('has-floating-formatting-toolbar');
}
function renderRecordStructureView(record,grid,status,editButton,expandButton,closeButton){
 clearChamberFormattingToolbar();
 grid.classList.remove('ha-chamber-grid-editor');
 const titleNode=recordChamber?.querySelector('.ha-chamber-title');
 if(titleNode)titleNode.textContent=record.title||'';
 const structure=getRecordStructure(record);
 grid.replaceChildren();
 const body=makeChamberNode('div','ha-chamber-blocks-view');
 const savedBlocks=Array.isArray(structure.blocks)?structure.blocks:[];
 const html=savedBlocks.length?savedBlocks.map(block=>{
  const source=String(block?.html||'');
  const name=String(block?.name||'').replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,80);
  if(!name||String(block?.type||'').toLowerCase()==='columns')return source;
  const parsed=new DOMParser().parseFromString(source,'text/html');
  if(parsed.body.firstElementChild&&!parsed.body.firstElementChild.hasAttribute('data-ha-block-name'))parsed.body.firstElementChild.setAttribute('data-ha-block-name',name);
  return parsed.body.innerHTML;
 }).join(''):
  [structure.transmission_body,structure.prompt_style,structure.lyrics_style,structure.output_text,record.content_html].filter(value=>String(value||'').trim()).join('');
 if(html)appendSafeContent(body,html,record,new Set());
 else body.append(makeChamberNode('p','ha-chamber-note','NO CONTENT BLOCKS HAVE BEEN ADDED TO THIS RECORD.'));
 const savedColumns=body.querySelectorAll('.ha-columns');
 if(savedColumns.length)body.classList.add('ha-chamber-blocks-view-wide');
 savedColumns.forEach(columns=>{
  const count=[...columns.children].filter(node=>node.tagName==='SECTION').length;
  if(count)columns.style.setProperty('--ha-saved-column-count',String(count));
 });
 grid.append(body);
 if(editButton){
  editButton.hidden=!archiveAdmin||!archiveWriteReady;editButton.disabled=false;editButton.textContent='REDESIGN CHAMBER';
  editButton.setAttribute('aria-label','Redesign this archive chamber');
  editButton.onclick=async()=>{
   if(!archiveAdmin||!archiveWriteReady||!window.VHACMSStore){status.textContent='GITHUB OWNER SESSION REQUIRED';return;}
   editButton.disabled=true;
   try{
    if(record.source_type==='transmission'&&record.status==='published'&&!record.draft_id){
     status.textContent='CREATING PRIVATE EDIT DRAFT…';
     const draft=await window.VHACMSStore.createEditDraft(record.post_id);
     record.draft_id=draft.draft_id;record._draftData=draft;record._repoCommitSha=draft._repoCommitSha;
     record._editOfPublished=true;record.isNew=false;record.draft_source='existing';record.status='published';
     record.title=draft.metadata.title;record.slug=draft.metadata.slug;record.categories=[draft.metadata.category];
     record.excerpt=draft.metadata.excerpt;record.media_width=draft.metadata.media_width;
     record.content_html=draft.content.transmission_body||record.content_html;
     recordStructureOverrides.set(String(record.id),{
      record_id:Number(record.id),transmission_body:draft.content.transmission_body||record.content_html,
      prompt_style:draft.content.prompt_style||'',lyrics_style:draft.content.lyrics_style||'',output_text:draft.content.output_text||'',
      output_media:draft.content.output_media||{},blocks:draft.content.blocks||[],updated_at:draft.updated_at
     });
    }
    renderRecordStructureEditor(record,grid,status,editButton,expandButton,closeButton);
   }catch(error){
    console.error('Private edit draft could not be created:',error);
    status.textContent='EDITOR COULD NOT OPEN — '+String(error.message||'PLEASE TRY AGAIN');
    editButton.disabled=false;
   }
  };
 }
 if(closeButton){
  closeButton.className='ha-chamber-close';closeButton.textContent='CLOSE ✕';closeButton.disabled=false;
  closeButton.setAttribute('aria-label','Close record chamber');
  closeButton.onclick=()=>{closeRecordChamberSafely();};
 }
 if(expandButton)expandButton.hidden=true;
}

function chamberUploadToken(){
 try{if(window.crypto?.randomUUID)return window.crypto.randomUUID();}catch{}
 return Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
}
function renderRecordStructureEditor(record,grid,status,editButton,expandButton,closeButton,readOnly=false){
 record._publicCommitSha=record._publicCommitSha||archivePublicHeadSha;
 grid.classList.add('ha-chamber-grid-editor');
 const structure=getRecordStructure(record);
 const initialRecordSnapshot=JSON.parse(JSON.stringify(record));
 const initialStructureSnapshot=JSON.parse(JSON.stringify(structure));
  const initialDraftSnapshot=record._draftData?JSON.parse(JSON.stringify(record._draftData)):null;
 const editorMedia={
  image:getRecordOutputMedia(record,structure,'image').map(item=>({...item})),
  audio:getRecordOutputMedia(record,structure,'audio').map(item=>({...item})),
  video:getRecordOutputMedia(record,structure,'video').map(item=>({...item}))
 };
 const mediaTouched={image:false,audio:false,video:false};
 let recordMetadataInputs=null;
 let slugManuallyEdited=false;
 let attachedPostMedia=(Array.isArray(record.media_items)?record.media_items:[]).map((item,index)=>{
  const mime=String(item.mime_type||'').toLowerCase();
  const type=['image','audio','video'].includes(item.type)?item.type:(mime.startsWith('image/')?'image':mime.startsWith('video/')?'video':'audio');
  return {id:String(item.id||'attached-'+index),name:String(item.title||item.name||record.title),url:String(item.source_url||item.url||''),path:String(item.storage_path||item.path||''),type,mime_type:mime,storage:String(item.storage||'vha-post-media')};
 }).filter(item=>item.url);
 const blockMediaUploadedPaths=[];
 const blockMediaUploadedAssets=[];
 let repaintAttachedPostMedia=()=>{};

 grid.replaceChildren();
 const metadataDetails=makeChamberDisclosure('00 // RECORD DETAILS','ha-chamber-panel ha-chamber-edit-panel ha-chamber-metadata-panel','ha-chamber-panel-heading');
 metadataDetails.details.open=false;
 if(expandButton)expandButton.hidden=true;
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
 const currentCategory=(record.categories||[])[0]||(record.source_type==='transmission'?'THE TRANSFORMATION':'');
 const categoryInputWrap=makeChamberNode('label','ha-chamber-metadata-field');
 const categoryInputLabel=makeChamberNode('span','ha-chamber-metadata-label','ARCHIVE / MOVEMENT');
 const categoryInput=document.createElement('select');
 categoryInput.className='ha-chamber-editor-field ha-chamber-meta-input';categoryInput.name='category';
 const archiveCategoryGroup=document.createElement('optgroup');archiveCategoryGroup.label='HUMAN ARCHIVE';
 const movementGroup=document.createElement('optgroup');movementGroup.label='TRANSMISSIONS';
 const addedCategoryValues=new Set();
 const appendUniqueCategory=(group,name,label=name)=>{
  const key=String(name).normalize('NFKC').trim().toLocaleUpperCase();
  if(!key||addedCategoryValues.has(key))return;
  addedCategoryValues.add(key);
  const option=document.createElement('option');option.value=name;option.textContent=label;group.append(option);
 };
 categoryOrder.forEach(name=>appendUniqueCategory(archiveCategoryGroup,name));
 transmissionCategories.filter(name=>name!=='HUMAN ARCHIVE').forEach(name=>appendUniqueCategory(movementGroup,name));
 if(currentCategory==='HUMAN ARCHIVE')appendUniqueCategory(movementGroup,'HUMAN ARCHIVE','HUMAN ARCHIVE — LEGACY');
 categoryInput.append(archiveCategoryGroup,movementGroup);
 categoryInput.value=categoryOrder.includes(currentCategory)||transmissionCategories.includes(currentCategory)?currentCategory:categoryOrder[0];
 categoryInputWrap.append(categoryInputLabel,categoryInput);metadataFields.append(categoryInputWrap);
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
 statusSelect.value=record.source_type==='transmission'?(record.status==='published'?'published':'draft'):'published';
 statusWrap.append(statusLabel,statusSelect);metadataFields.append(statusWrap);
 const statusNote=makeChamberNode('p','ha-chamber-metadata-note',record.source_type==='transmission'?'Drafts are private. Published Transmissions appear on the public site. Saving as draft removes a published Transmission from public listings.':'This legacy record remains anchored to its original archive source. Its content is edited as one ordered block stream.');
 if(record.source_type!=='transmission'){
  [titleInput,slugInput,categoryInput,excerptInput,mediaWidthInput,statusSelect].forEach(control=>{control.disabled=true;});
 }
 metadataDetails.body.append(metadataFields,statusNote);
 grid.append(metadataDetails.details);
 recordMetadataInputs={title:titleInput,slug:slugInput,category:categoryInput,excerpt:excerptInput,mediaWidth:mediaWidthInput,status:statusSelect};
 if(record.source_type==='transmission'){
  slugInput.addEventListener('input',()=>{slugManuallyEdited=true;});
  titleInput.addEventListener('input',()=>{
   const title=String(titleInput.value||'');
   const titleNode=recordChamber?.querySelector('.ha-chamber-title');
   if(titleNode)titleNode.textContent=title;
   if(!slugManuallyEdited){
    slugInput.value=title.normalize('NFKD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,180);
   }
  });
 }
 const focusButton=makeChamberNode('button','ha-chamber-focus-toggle','T');focusButton.type='button';focusButton.setAttribute('aria-pressed','false');
 const toolbar=makeChamberNode('div','ha-rich-toolbar');toolbar.setAttribute('role','toolbar');toolbar.setAttribute('aria-label','Block formatting tools');
 const addToolbarCategory=(name,tools)=>{
  const heading=makeChamberNode('span','ha-rich-toolbar-category',name);heading.setAttribute('role','presentation');toolbar.append(heading);
  tools.forEach(([label,command,value])=>{
   const button=makeChamberNode('button','',label);button.type='button';button.draggable=false;
   button.dataset.command=command;if(value)button.dataset.value=value;button.title=label;toolbar.append(button);
  });
 };
 addToolbarCategory('TEXT',[['B','bold'],['I','italic'],['U','underline'],['S','strikeThrough']]);
 addToolbarCategory('BLOCKS',[['P','formatBlock','p'],['H1','formatBlock','h1'],['H2','formatBlock','h2'],['H3','formatBlock','h3'],['H4','formatBlock','h4'],['QUOTE','formatBlock','blockquote']]);
 addToolbarCategory('LISTS',[['• LIST','insertUnorderedList'],['1. LIST','insertOrderedList']]);
 addToolbarCategory('ALIGNMENT',[['LEFT','justifyLeft'],['CENTER','justifyCenter'],['RIGHT','justifyRight'],['JUSTIFY','justifyFull']]);
 addToolbarCategory('HISTORY',[['UNDO','undo'],['REDO','redo'],['CLEAR','removeFormat']]);
 addToolbarCategory('LINKS',[]);
 const insertLinkButton=makeChamberNode('button','ha-rich-link','LINK');insertLinkButton.type='button';insertLinkButton.draggable=false;toolbar.append(insertLinkButton);
 const unlinkButton=makeChamberNode('button','','UNLINK');unlinkButton.type='button';unlinkButton.draggable=false;unlinkButton.dataset.command='unlink';toolbar.append(unlinkButton);
 addToolbarCategory('MODE',[]);
 focusButton.draggable=false;toolbar.append(focusButton);
 toolbar.addEventListener('dragstart',event=>event.preventDefault());
 const transmissionEditor=makeChamberNode('div','ha-chamber-editor-field ha-rich-content');transmissionEditor.contentEditable=readOnly?'false':'true';transmissionEditor.setAttribute('role','textbox');transmissionEditor.setAttribute('aria-multiline','true');transmissionEditor.setAttribute('aria-label','Archive blocks');transmissionEditor.spellcheck=true;transmissionEditor.dataset.placeholder='Start writing or add a block…';
 const savedBlocks=Array.isArray(structure.blocks)?structure.blocks:[];
 const legacyHTML=[structure.transmission_body,structure.prompt_style,structure.lyrics_style,structure.output_text].filter(value=>String(value||'').trim()).join('');
 const initialBlockHTML=savedBlocks.length?savedBlocks.map(block=>String(block?.html||'')).join(''):(legacyHTML||record.content_html||'');
 transmissionEditor.innerHTML=sanitizeTransmissionBody(initialBlockHTML);
 const editorTop=makeChamberNode('div','ha-rich-editor-top');
 editorTop.append(makeChamberNode('span','ha-rich-editor-hint','ONE CANVAS // EVERY PIECE OF CONTENT IS A BLOCK'));
 grid.append(editorTop,transmissionEditor);
 const toolbarHost=recordChamber||grid.closest('.ha-record-chamber');
 toolbarHost?.append(toolbar);
 toolbarHost?.classList.add('has-floating-formatting-toolbar');
 toolbar.querySelectorAll('button').forEach(button=>{button.draggable=false;});
 toolbar.addEventListener('pointerdown',event=>{if(event.target.closest('button'))event.stopPropagation();});
 const promptArea=makeChamberNode('div','ha-legacy-hidden-field');promptArea.innerHTML='';
 const lyricsArea=makeChamberNode('div','ha-legacy-hidden-field');lyricsArea.innerHTML='';
 const textArea=makeChamberNode('div','ha-legacy-hidden-field');textArea.innerHTML='';
 const blockMediaMime=(file,type)=>{
  const mime=String(file.type||'').toLowerCase();
  const accepted={
   image:['image/jpeg','image/png','image/webp','image/gif','image/avif'],
   audio:['audio/mpeg','audio/mp4','audio/ogg','audio/wav','audio/webm'],
   video:['video/mp4','video/webm'],
   file:['image/jpeg','image/png','image/webp','image/gif','image/avif','audio/mpeg','audio/mp4','audio/ogg','audio/wav','audio/webm','video/mp4','video/webm']
  };
  if(accepted[type]?.includes(mime))return mime;
  if(mime)return null;
  const ext=String(file.name||'').split('.').pop().toLowerCase();
  const byExt={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif',avif:'image/avif',mp3:'audio/mpeg',m4a:'audio/mp4',wav:'audio/wav',ogg:'audio/ogg',weba:'audio/webm',mp4:'video/mp4',webm:'video/webm',};
  const inferred=byExt[ext]||'';return accepted[type]?.includes(inferred)?inferred:null;
 };
 const uploadBlockMedia=async(files,type)=>{
  if(!archiveAdmin||!window.VHACMSStore||!archiveUserId)throw new Error('An active GitHub CMS owner session is required to upload media.');
  const acceptedType=type==='image'||type==='gallery'||type==='slideshow'||type==='tiled-gallery'||type==='cover'||type==='media-text'||type==='image-compare'?'image':type==='audio'||type==='playlist'||type==='podcast'?'audio':type==='video'?'video':'file';
  const assets=[];
  for(const file of files){
   const mime=blockMediaMime(file,acceptedType);
   if(!mime)throw new Error(file.name+' has an unsupported file format.');
   if(file.size>30*1024*1024)throw new Error(file.name+' exceeds the 30 MB upload limit.');
   const folder=mime.startsWith('image/')?'image':mime.startsWith('audio/')?'audio':mime.startsWith('video/')?'video':'files';
   let asset;
   if(record.source_type==='transmission'){
    if(!record.draft_id)throw new Error('The private Transmission draft has not been initialized.');
    const uploaded=await window.VHACMSStore.uploadDraftMedia(record.draft_id,[file],'blocks-'+folder,record._repoCommitSha);
    const path=uploaded[0].path,url=URL.createObjectURL(file);
    privateMediaUrlToPath.set(url,path);record._repoCommitSha=uploaded[0].commitSha;
    asset={url,path,name:file.name,mime_type:mime,type:folder,storage:'github-private'};
   }else{
    const uploaded=await window.VHACMSStore.uploadPublicMedia(record.id,[file],'blocks-'+folder,record._publicCommitSha||archivePublicHeadSha);
    const item=uploaded[0];record._publicCommitSha=item.commitSha;
    asset={url:item.url,path:item.path,name:file.name,mime_type:mime,type:folder,storage:'github-public'};
   }
   blockMediaUploadedPaths.push(asset.path);assets.push(asset);blockMediaUploadedAssets.push(asset);
  }
  status.textContent=assets.length+' MEDIA FILE'+(assets.length===1?'':'S')+' UPLOADED — SAVE TO KEEP CHANGES.';
  return assets;
 };

const getBlockMediaLibrary=type=>{
  const desired=type==='image'||type==='gallery'||type==='slideshow'||type==='tiled-gallery'||type==='cover'||type==='media-text'||type==='image-compare'?'image':type==='audio'||type==='playlist'||type==='podcast'?'audio':type==='video'?'video':'';
  const archiveAssets=records.flatMap(archiveRecord=>{
   const archiveStructure=getRecordStructure(archiveRecord);
   return [...['image','audio','video'].flatMap(kind=>getRecordOutputMedia(archiveRecord,archiveStructure,kind).map(item=>({...item,type:kind}))),...(Array.isArray(archiveRecord.media_items)?archiveRecord.media_items:[])];
  });
  const source=[...archiveAssets,...['image','audio','video'].flatMap(kind=>editorMedia[kind].map(item=>({...item,type:kind}))),...attachedPostMedia,...blockMediaUploadedAssets];
  const seen=new Set();
  return source.filter(item=>{
   const itemType=String(item.type||item.mime_type||'').toLowerCase();
   const matches=!desired||itemType===desired||itemType.startsWith(desired+'/')||(desired==='image'&&itemType.startsWith('image/'))||(desired==='audio'&&itemType.startsWith('audio/'))||(desired==='video'&&itemType.startsWith('video/'));
   const url=item.uploadedDraft?.url||item.url||item.source_url;
   if(!matches||!url||seen.has(url))return false;seen.add(url);return true;
  }).map(item=>({url:item.uploadedDraft?.url||item.url||item.source_url,path:item.uploadedDraft?.path||item.path||item.storage_path,name:item.name||item.title||record.title,mime_type:item.mime_type||item.type||''}));
 };
 const cleanupBlockMediaUploads=async(keepContent='')=>{
  if(!blockMediaUploadedPaths.length)return;
  const paths=blockMediaUploadedPaths.splice(0);
  const assets=blockMediaUploadedAssets.splice(0);
  const keep=assets.filter(item=>String(keepContent||'').includes(item.url)||String(keepContent||'').includes(item.path));
  const remove=paths.filter(path=>!keep.some(item=>item.path===path));
  const privatePaths=remove.filter(path=>path.startsWith('cms-data/v1/media/drafts/'));
  const publicPaths=remove.filter(path=>path.startsWith('media/human-archive/HA-'));
  try{
   if(privatePaths.length){const result=await window.VHACMSStore.deleteDraftMedia(record.draft_id,privatePaths,record._repoCommitSha);record._repoCommitSha=result.commitSha||record._repoCommitSha;}
   if(publicPaths.length){const result=await window.VHACMSStore.deletePublicMedia(record.id,publicPaths,record._publicCommitSha);record._publicCommitSha=result.commitSha||record._publicCommitSha;}
  }catch(error){console.warn('Unreferenced media could not be cleaned up:',error);}
 };

const blockEditorControllers=readOnly?[]:[transmissionEditor].map(editor=>window.VHABlockEditor?.mountBlockEditor({editor,showTopbar:false,onUpload:uploadBlockMedia,getMediaLibrary:getBlockMediaLibrary,onChange:()=>{if(record.source_type==='transmission'&&record.status==='draft')scheduleDraftAutosave?.();}})).filter(Boolean);
 const getEditorHTML=()=>transmissionEditor.__haBlockEditor?.getHTML()||transmissionEditor.innerHTML;
 const getEditorBlocks=()=>{
  const current=transmissionEditor.__haBlockEditor?.getBlocks?.();
  const source=Array.isArray(current)?current:(getEditorHTML().trim()?[{id:'block-001',type:'classic',html:getEditorHTML()}]:[]);
  return source.map((block,index)=>({id:String(block.id||'block-'+String(index+1).padStart(3,'0')),type:String(block.type||'classic'),html:sanitizeTransmissionBody(block.html||'')})).filter(block=>block.html.trim());
 };
 const richEditorController=readOnly?null:window.VHAEditorUI?.mountRichTextEditor({editor:transmissionEditor,editors:[transmissionEditor],toolbar,focusButton,insertLinkButton,draggableToolbar:false,focusClass:'ha-writing-focus',onInvalidLink:message=>{status.textContent=message;}});

 if(readOnly){
  grid.classList.add('ha-chamber-read-only');
  grid.querySelectorAll('input,textarea').forEach(control=>{control.readOnly=true;control.disabled=control.type==='file'||control.type==='range';});
  grid.querySelectorAll('select,button').forEach(control=>{control.disabled=true;});
  grid.querySelectorAll('[contenteditable="true"]').forEach(control=>{control.contentEditable='false';});
  grid.querySelectorAll('.ha-chamber-upload-label,.ha-chamber-media-remove').forEach(control=>{control.hidden=true;});
  if(editButton)editButton.hidden=!archiveAdmin||!archiveWriteReady;
  clearChamberFormattingToolbar();
  bindChamberDisclosureControls(grid,expandButton);
  return;
 }
 const save=closeButton;
 if(!save)throw new Error('The chamber save control is unavailable.');
 save.className='ha-chamber-close ha-chamber-save';save.type='button';save.disabled=false;save.textContent='SAVE CHAMBER';
 save.setAttribute('aria-label','Save chamber changes');
 if(editButton){
  editButton.className='ha-chamber-edit';editButton.hidden=false;editButton.disabled=false;editButton.textContent='DISCARD';
  editButton.setAttribute('aria-label','Discard editor changes');
 }

 const getCurrentTransmissionText=()=>transmissionEditor.__haBlockEditor?.getText()||transmissionEditor.innerText||'';
 const updateSaveLabel=()=>{save.textContent='SAVE CHAMBER';};
 recordMetadataInputs?.status?.addEventListener('change',updateSaveLabel);updateSaveLabel();
 // Draft Transmissions are database-backed as the user types. Publication remains an explicit action.
 let draftAutosaveTimer=null,draftAutosaveInFlight=false,draftAutosaveQueued=false,draftAutosaveStopped=false,draftAutosaveFlushing=false,draftAutosaveConflict=false,draftAutosaveLastSignature='';
 const draftAutosaveEnabled=record.source_type==='transmission'&&Boolean(record.draft_id);
 const deleteDraft=draftAutosaveEnabled?makeChamberNode('button','ha-chamber-delete-draft','DELETE DRAFT'):null;
 if(deleteDraft){
  deleteDraft.type='button';
  recordChamber?.querySelector('.ha-chamber-topbar-actions')?.append(deleteDraft);
 }
 const serializePrivateMediaRefs=value=>{
  let output=String(value||'');
  for(const [url,path] of privateMediaUrlToPath)output=output.split(url).join(path);
  return output;
 };
 const persistMediaItem=item=>{
  const uploaded=item.uploadedDraft||{};
  const path=String(uploaded.path||item.path||privateMediaUrlToPath.get(item.url)||'');
  const privateRef=path.startsWith('cms-data/v1/media/drafts/');
  return {
   id:String(item.id||path||item.url||chamberUploadToken()),
   name:String(item.name||record.title||'Media'),
   url:privateRef?path:String(uploaded.url||item.url||''),
   path,
   type:String(item.type||uploaded.type||'file'),
   mime_type:String(uploaded.mime_type||item.mime_type||''),
   storage:String(uploaded.storage||item.storage||(privateRef?'github-private':'github-public'))
  };
 };
 const buildDraftAutosaveState=()=>{
  const metadata={
   title:String(recordMetadataInputs.title.value).trim(),
   slug:String(recordMetadataInputs.slug.value).trim().toLowerCase(),
   category:String(recordMetadataInputs.category.value).trim().toUpperCase(),
   excerpt:String(recordMetadataInputs.excerpt.value).trim(),
   media_width:Math.max(20,Math.min(100,Number(recordMetadataInputs.mediaWidth.value)||100))
  };
  if(metadata.title.length>180)throw new Error('Title must contain 180 characters or fewer.');
  if(metadata.slug&&!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(metadata.slug))throw new Error('Use a valid lowercase URL slug with words separated by hyphens.');
  if(metadata.excerpt.length>400)throw new Error('Excerpt must be 400 characters or fewer.');
  const editorBody=sanitizeTransmissionBody(getEditorHTML());
  const editorBlocks=getEditorBlocks();
  const body=serializePrivateMediaRefs(editorBody);
  const blocks=editorBlocks.map(block=>({...block,html:serializePrivateMediaRefs(block.html)}));
  const outputMedia={};
  for(const kind of ['image','audio','video'])outputMedia[kind]=editorMedia[kind].map(persistMediaItem);
  const mediaItems=attachedPostMedia.map(persistMediaItem).filter(item=>item.url);
  const row={
   record_id:Number(record.id),transmission_body:body,
   prompt_style:'',lyrics_style:'',output_text:'',
   output_media:outputMedia,blocks,updated_at:new Date().toISOString()
  };
  return {metadata,row,mediaItems,blocks,editorBody,editorBlocks};
 };
 const uploadPendingDraftMedia=async()=>{
  const uploadedPaths=[];
  const uploadOne=async(item,folder,type)=>{
   if(!item.file||item.uploadedDraft)return;
   if(!record.draft_id)throw new Error('The private Transmission draft has not been initialized.');
   const uploaded=await window.VHACMSStore.uploadDraftMedia(record.draft_id,[item.file],folder,record._repoCommitSha);
   const path=uploaded[0].path,url=URL.createObjectURL(item.file);
   privateMediaUrlToPath.set(url,path);
   record._repoCommitSha=uploaded[0].commitSha;
   uploadedPaths.push(path);
   item.uploadedDraft={url,path,type:type||item.type,name:item.name,mime_type:item.mime_type,storage:'github-private'};
  };
  try{
   for(const item of attachedPostMedia)await uploadOne(item,'attachments',item.type);
   for(const kind of ['image','audio','video'])for(const item of editorMedia[kind])await uploadOne(item,kind,kind);
   return uploadedPaths;
  }catch(error){
   if(uploadedPaths.length&&!draftSaved){
    try{const result=await window.VHACMSStore.deleteDraftMedia(record.draft_id,uploadedPaths,record._repoCommitSha);record._repoCommitSha=result.commitSha||record._repoCommitSha;}catch(cleanupError){console.warn('Failed private uploads were retained for later cleanup:',cleanupError);}
   }
   [...attachedPostMedia,...['image','audio','video'].flatMap(kind=>editorMedia[kind])].forEach(item=>{if(item.uploadedDraft){privateMediaUrlToPath.delete(item.uploadedDraft.url);delete item.uploadedDraft;}});
   throw error;
  }
 };
 const runDraftAutosave=async()=>{
  if(draftAutosaveConflict)return false;
  if(!draftAutosaveEnabled||draftAutosaveStopped||!archiveAdmin||!window.VHACMSStore||!archiveUserId)return true;
  if(draftAutosaveInFlight){draftAutosaveQueued=true;return null;}
  let state,signature,uploadedPaths=[],draftSaved=false;
  draftAutosaveInFlight=true;
  try{
   uploadedPaths=await uploadPendingDraftMedia();
   state=buildDraftAutosaveState();
   signature=JSON.stringify({metadata:state.metadata,row:{...state.row,updated_at:null},mediaItems:state.mediaItems,blocks:state.blocks});
   if(signature===draftAutosaveLastSignature)return true;
   status.textContent='SAVING PRIVATE DRAFT…';
   const current=await window.VHACMSStore.getDraft(record.draft_id);
   if(!current)throw new Error('The private draft could not be found. Reload the editor before continuing.');
   const next={
    ...current,revision:Number(current.revision||0),
    metadata:state.metadata,
    content:{
     transmission_body:state.row.transmission_body,
     prompt_style:state.row.prompt_style,lyrics_style:state.row.lyrics_style,output_text:state.row.output_text,
     output_media:state.row.output_media,blocks:state.blocks,media_items:state.mediaItems
    }
   };
   const saved=await window.VHACMSStore.saveDraft(next,record._repoCommitSha||current._repoCommitSha);
   record._repoCommitSha=saved.commitSha;record.updated_at=saved.draft.updated_at;record.draft_revision=saved.draft.revision;record._draftData=saved.draft;
   record.media_width=state.metadata.media_width;
   record.title=state.metadata.title;record.slug=state.metadata.slug;
   record.categories=state.metadata.category?[state.metadata.category]:[];
   record.excerpt=state.metadata.excerpt;record.content_html=state.editorBody;record.status=record._editOfPublished?'published':'draft';
   record.media_items=attachedPostMedia.map(item=>({
    id:'transmission-'+record.post_id+'-'+String(item.name||'attachment'),
    title:item.name||record.title,alt_text:item.name||record.title,
    mime_type:item.mime_type||'application/octet-stream',storage_path:item.uploadedDraft?.path||item.path||'',
    source_url:item.uploadedDraft?.url||item.url,url:item.uploadedDraft?.url||item.url,
    storage:item.uploadedDraft?.storage||item.storage||'github-private',post_ids:[Number(record.id)]
   }));
   const liveOutput=Object.fromEntries(['image','audio','video'].map(kind=>[kind,editorMedia[kind].map(item=>({
    ...item,url:item.uploadedDraft?.url||item.url,path:item.uploadedDraft?.path||item.path,
    storage:item.uploadedDraft?.storage||item.storage||'github-private'
   }))]));
   recordStructureOverrides.set(String(record.id),{
    record_id:Number(record.id),transmission_body:state.editorBody,
    prompt_style:'',lyrics_style:'',output_text:'',output_media:liveOutput,
    blocks:state.editorBlocks,updated_at:record.updated_at
   });
   await cleanupBlockMediaUploads(state.editorBody+'\n'+state.editorBlocks.map(block=>block.html||'').join('\n'));
   [...attachedPostMedia,...['image','audio','video'].flatMap(kind=>editorMedia[kind])].forEach(item=>{
    if(item.uploadedDraft){Object.assign(item,item.uploadedDraft);item.file=null;delete item.uploadedDraft;}
   });
   repaintAttachedPostMedia();
   draftAutosaveLastSignature=signature;
   status.textContent='DRAFT SAVED AUTOMATICALLY';
   return true;
  }catch(error){
   if(uploadedPaths.length){
    try{const result=await window.VHACMSStore.deleteDraftMedia(record.draft_id,uploadedPaths,record._repoCommitSha);record._repoCommitSha=result.commitSha||record._repoCommitSha;}catch(cleanupError){console.warn('Failed draft uploads could not be cleaned up:',cleanupError);}
   }
   console.error('Human Archive draft autosave failed:',error);
   if(error?.code==='EDIT_CONFLICT'||error?.status===409){
    chamberSaveConflict=true;draftAutosaveConflict=true;
    status.textContent='EDIT CONFLICT — THE PRIVATE CMS REPOSITORY CHANGED. RELOAD BEFORE CONTINUING.';
   }else status.textContent='AUTOSAVE FAILED — '+String(error.message||'PLEASE TRY AGAIN');
   return false;
  }finally{
   draftAutosaveInFlight=false;
   if(draftAutosaveQueued&&!draftAutosaveFlushing){draftAutosaveQueued=false;scheduleDraftAutosave(0);}
  }
 };
 const scheduleDraftAutosave=(delay=850)=>{
  if(!draftAutosaveEnabled||draftAutosaveConflict)return;
  if(draftAutosaveTimer)clearTimeout(draftAutosaveTimer);
  draftAutosaveTimer=setTimeout(()=>{draftAutosaveTimer=null;runDraftAutosave();},delay);
 };
 if(!readOnly&&record.source_type==='transmission'){
  grid.addEventListener('input',scheduleDraftAutosave);
  grid.addEventListener('change',()=>{updateSaveLabel();scheduleDraftAutosave();});
 }
 const flushDraftAutosave=async()=>{
  if(draftAutosaveConflict)return false;
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

 deleteDraft?.addEventListener('click',async()=>{
  if(!draftAutosaveEnabled||draftAutosaveStopped||!archiveAdmin||!window.VHACMSStore)return;
  if(!window.confirm('Permanently delete this private draft and its private media? This cannot be undone.'))return;
  draftAutosaveStopped=true;
  if(draftAutosaveTimer){clearTimeout(draftAutosaveTimer);draftAutosaveTimer=null;}
  deleteDraft.disabled=true;save.disabled=true;editButton.disabled=true;status.textContent='WAITING FOR ANY ACTIVE DRAFT SAVE…';
  try{
   while(draftAutosaveInFlight)await new Promise(resolve=>setTimeout(resolve,50));
   draftAutosaveQueued=false;
   status.textContent='DELETING PRIVATE DRAFT…';
   await window.VHACMSStore.deleteDraft(record.draft_id,record._repoCommitSha);
   records=records.filter(item=>String(item.id)!==String(record.id));
   recordStructureOverrides.delete(String(record.id));
   await loadTransmissionRecords();
   blockEditorControllers.forEach(controller=>controller.destroy());
   richEditorController?.destroy();clearChamberFormattingToolbar();
   chamberCloseRequestedByUser=true;recordChamber?.close();if(hasArchiveIndex)render();
   setMediaStatus('PRIVATE DRAFT DELETED',true);
  }catch(error){
   draftAutosaveStopped=false;deleteDraft.disabled=false;save.disabled=false;editButton.disabled=false;
   console.error('Private draft could not be deleted:',error);
   status.textContent='DELETE FAILED — '+String(error.message||'PLEASE TRY AGAIN');
   scheduleDraftAutosave(0);
  }
 });
 bindChamberDisclosureControls(grid,expandButton);
 const destroyEditor=()=>{
  blockEditorControllers.forEach(controller=>controller.destroy());
  richEditorController?.destroy();
  clearChamberFormattingToolbar();
 };
 const waitForDraftSave=async()=>{
  while(draftAutosaveInFlight)await new Promise(resolve=>setTimeout(resolve,50));
 };
 const discardChanges=async()=>{
  if(editButton.disabled)return;
  editButton.disabled=true;save.disabled=true;if(deleteDraft)deleteDraft.disabled=true;
  status.textContent='DISCARDING CHANGES…';
  try{
   draftAutosaveStopped=true;
   if(draftAutosaveTimer){clearTimeout(draftAutosaveTimer);draftAutosaveTimer=null;}
   await waitForDraftSave();
   await cleanupBlockMediaUploads('');
   if(record.source_type==='transmission'&&record.draft_id){
    if(record.isNew||record._editOfPublished){
     await window.VHACMSStore.deleteDraft(record.draft_id,record._repoCommitSha);
     await loadTransmissionRecords();
     const original=records.find(item=>item.source_type==='transmission'&&item.post_id===record.post_id);
     if(original)Object.assign(record,original);
     else records=records.filter(item=>String(item.id)!==String(record.id));
     if(record.isNew&&createTransmissionStatus)createTransmissionStatus.textContent='NEW TRANSMISSION // DISCARDED';
    }else if(initialDraftSnapshot){
     const collectPaths=draft=>{
      const paths=[];
      const content=draft?.content||{};
      (content.media_items||[]).forEach(item=>{if(item?.path)paths.push(item.path);});
      Object.values(content.output_media||{}).forEach(items=>(Array.isArray(items)?items:[]).forEach(item=>{if(item?.path)paths.push(item.path);}));
      const html=[content.transmission_body||'',...(content.blocks||[]).map(block=>block.html||'')].join('\n');
      for(const match of html.matchAll(/cms-data\/v1\/media\/drafts\/[^\s"'<>)]*/g))paths.push(match[0]);
      return [...new Set(paths.filter(path=>path.startsWith('cms-data/v1/media/drafts/')))];
     };
     const latest=await window.VHACMSStore.getDraft(record.draft_id);
     const originalPaths=new Set(collectPaths(initialDraftSnapshot));
     const removePaths=collectPaths(latest).filter(path=>!originalPaths.has(path));
     if(removePaths.length){
      const removed=await window.VHACMSStore.deleteDraftMedia(record.draft_id,removePaths,record._repoCommitSha);
      record._repoCommitSha=removed.commitSha||record._repoCommitSha;
     }
     const restore={...initialDraftSnapshot};delete restore._path;delete restore._sha;delete restore._repoCommitSha;
     const restored=await window.VHACMSStore.saveDraft(restore,record._repoCommitSha);
     Object.assign(record,initialRecordSnapshot);
     record._repoCommitSha=restored.commitSha;record._draftData=restored.draft;
     recordStructureOverrides.set(String(record.id),initialStructureSnapshot);
    }
   }else{
    Object.assign(record,initialRecordSnapshot);
    recordStructureOverrides.set(String(record.id),initialStructureSnapshot);
   }
   destroyEditor();
   status.textContent='EDITOR CHANGES DISCARDED';
   if(hasArchiveIndex)render();
   renderRecordStructureView(record,grid,status,editButton,expandButton,closeButton);
  }catch(error){
   console.error('Human Archive editor changes could not be discarded:',error);
   draftAutosaveStopped=false;editButton.disabled=false;save.disabled=false;if(deleteDraft)deleteDraft.disabled=false;
   status.textContent='DISCARD FAILED — '+String(error.message||'PLEASE TRY AGAIN');
  }
 };
 if(editButton)editButton.onclick=discardChanges;
 
 save.onclick=async()=>{
  if(!archiveAdmin||!archiveWriteReady||!archiveUserId||!window.VHACMSStore){status.textContent='GITHUB EDITOR MIGRATION IS NOT YET ENABLED';return;}
  if(draftAutosaveTimer){clearTimeout(draftAutosaveTimer);draftAutosaveTimer=null;}
  if(draftAutosaveInFlight){
   status.textContent='WAITING FOR AUTOMATIC DRAFT SAVE…';
   await new Promise(resolve=>{const wait=()=>draftAutosaveInFlight?setTimeout(wait,50):resolve();wait();});
   if(draftAutosaveTimer){clearTimeout(draftAutosaveTimer);draftAutosaveTimer=null;}
  }
  if(record.source_type==='transmission'&&record.post_id&&recordMetadataInputs.status.value!==record.status){
   const prompt=recordMetadataInputs.status.value==='published'
    ?'Publish this Transmission? It will become visible on the public site.'
    :'Unpublish this Transmission? It will become a private draft and disappear from public listings.';
   if(!window.confirm(prompt))return;
  }
  save.disabled=true;editButton.disabled=true;if(deleteDraft)deleteDraft.disabled=true;save.textContent='SAVING…';status.textContent='PREPARING CHAMBER UPDATE…';
  const uploadedPublicPaths=[];
  let publicStructureSaved=false;
  const oldStructure=recordStructureOverrides.get(String(record.id))||{};
  const oldOutput=oldStructure.output_media&&typeof oldStructure.output_media==='object'?oldStructure.output_media:{};
  const oldOwnedPaths=['image','audio','video'].flatMap(kind=>Array.isArray(oldOutput[kind])?oldOutput[kind]:[])
   .filter(item=>item&&item.storage==='github-public'&&typeof item.path==='string'&&item.path.startsWith('media/human-archive/HA-'+String(record.id).padStart(4,'0')+'/'))
   .map(item=>item.path);
  try{
   if(record.source_type==='transmission'){
    const flushed=await flushDraftAutosave();
    if(flushed===false||draftAutosaveConflict||chamberSaveConflict)throw new Error('The private draft changed in another session. Reload before continuing.');
    const state=buildDraftAutosaveState();
    const metadata={
     title:state.metadata.title,slug:state.metadata.slug,category:state.metadata.category,
     excerpt:state.metadata.excerpt,status:String(recordMetadataInputs.status.value).trim().toLowerCase(),
     media_width:state.metadata.media_width
    };
    if(!metadata.title||metadata.title.length>180)throw new Error('Title must contain between 1 and 180 characters.');
    if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(metadata.slug))throw new Error('Use a valid lowercase URL slug with words separated by hyphens.');
    if(!transmissionCategories.includes(metadata.category))throw new Error('Choose Human Archive or one of the five Movements.');
    if(metadata.excerpt.length>400)throw new Error('Excerpt must be 400 characters or fewer.');
    if(!['draft','published'].includes(metadata.status))throw new Error('Choose a valid publication status.');
    if(metadata.status==='published'&&!getCurrentTransmissionText().trim())throw new Error('Add transmission content before publishing.');
    const current=await window.VHACMSStore.getDraft(record.draft_id);
    if(!current)throw new Error('The private draft could not be found. Reload before continuing.');
    const draftToSave={
     ...current,metadata,
     content:{
      transmission_body:state.row.transmission_body,
      prompt_style:state.row.prompt_style,lyrics_style:state.row.lyrics_style,output_text:state.row.output_text,
      output_media:state.row.output_media,blocks:state.blocks,media_items:state.mediaItems
     }
    };
    const saved=await window.VHACMSStore.saveDraft(draftToSave,record._repoCommitSha||current._repoCommitSha);
    record._repoCommitSha=saved.commitSha;record._draftData=saved.draft;record.updated_at=saved.draft.updated_at;
    if(metadata.status==='published'){
     status.textContent='PUBLISHING TRANSMISSION TO THE PUBLIC REPOSITORY…';
     const published=await window.VHACMSStore.publishDraft(record.draft_id);
     const post=published.post;
     record.title=post.title;record.slug=post.slug;record.categories=[post.category];record.excerpt=post.excerpt||'';
     const makePublicUrl=value=>{
      const raw=String(value||'');
      return raw.startsWith('http')||raw.startsWith('blob:')?raw:('/landing-page/'+raw.replace(/^\/+/, ''));
     };
     const rewriteHtml=html=>String(html||'').replace(/(["'])((?:media\/transmissions)\/[^"']+)\1/g,(match,quote,path)=>quote+'/landing-page/'+path.replace(/^\/+/, '')+quote);
     record.content_html=rewriteHtml(post.content_html);
     record.media_items=(post.media_items||[]).map((item,index)=>({
      id:'transmission-'+post.id+'-'+index,title:item.name||post.title,alt_text:item.name||post.title,
      mime_type:item.type==='image'?'image/unknown':item.type==='video'?'video/unknown':'audio/unknown',
      storage_path:item.path||item.src||item.url||'',source_url:item.source_url||makePublicUrl(item.url||item.src||item.path),
      url:makePublicUrl(item.url||item.src||item.path),storage:'github-public',post_ids:[Number(record.id)]
     }));
     record.status='published';record.published_at=post.published_at;record.updated_at=post.updated_at;
     record.media_width=post.media_width||100;record.draft_id=null;record._draftData=null;record._repoCommitSha=null;
     record.isNew=false;record._editOfPublished=false;record._publicCommitSha=published.commitSha;
     const publicStructure=await window.VHACMSStore.getPublicStructure(record.id);
     if(publicStructure){
      const output=Object.fromEntries(['image','audio','video'].map(kind=>[kind,(publicStructure.output_media?.[kind]||[]).map(item=>({...item,url:makePublicUrl(item.url||item.path)}))]));
      recordStructureOverrides.set(String(record.id),{...publicStructure,transmission_body:rewriteHtml(publicStructure.transmission_body),blocks:(publicStructure.blocks||[]).map(block=>({...block,html:rewriteHtml(block.html)})),output_media:output});
     }
     status.textContent='TRANSMISSION PUBLISHED // CHANGES COMMITTED';
    }else{
     if(record._editOfPublished){
      status.textContent='REMOVING PUBLIC VERSION…';
      const unpublished=await window.VHACMSStore.unpublishDraft(record.draft_id);
      record._repoCommitSha=unpublished.privateCommitSha;
      record._editOfPublished=false;
      record._draftData=await window.VHACMSStore.getDraft(record.draft_id);
     }
     record.title=metadata.title;record.slug=metadata.slug;record.categories=metadata.category?[metadata.category]:[];
     record.excerpt=metadata.excerpt;record.media_width=metadata.media_width;record.status='draft';
     record.content_html=state.editorBody;record.updated_at=record._draftData?.updated_at||record.updated_at;
     const liveOutput=Object.fromEntries(['image','audio','video'].map(kind=>[kind,editorMedia[kind].map(item=>({
      ...item,url:item.uploadedDraft?.url||item.url,path:item.uploadedDraft?.path||item.path,
      storage:item.uploadedDraft?.storage||item.storage||'github-private'
     }))]));
     recordStructureOverrides.set(String(record.id),{
      record_id:Number(record.id),transmission_body:state.editorBody,
      prompt_style:'',lyrics_style:'',output_text:'',output_media:liveOutput,
      blocks:state.editorBlocks,updated_at:record.updated_at
     });
     status.textContent='DRAFT SAVED PRIVATELY';
    }
    if(!categoryOrder.includes(metadata.category))categoryOrder.push(metadata.category);
    if(category&&![...category.options].some(option=>option.value===metadata.category)){
     const option=document.createElement('option');option.value=metadata.category;option.textContent=metadata.category;category.append(option);
    }
   }else{
    const outputMedia={};
    for(const kind of ['image','audio','video']){
     const savedItems=[];
     for(const item of editorMedia[kind]){
      if(item.file){
       status.textContent='UPLOADING '+kind.toUpperCase()+' TO GITHUB…';
       const uploaded=await window.VHACMSStore.uploadPublicMedia(record.id,[item.file],kind,record._publicCommitSha||archivePublicHeadSha);
       const media=uploaded[0];uploadedPublicPaths.push(media.path);record._publicCommitSha=media.commitSha;
       savedItems.push({id:'upload-'+chamberUploadToken(),name:item.name,url:media.url,path:media.path,mime_type:media.mime_type,storage:'github-public'});
       item.url=media.url;item.path=media.path;item.storage='github-public';item.file=null;
      }else{
       savedItems.push({
        id:String(item.id||item.path||item.url||chamberUploadToken()),name:String(item.name||record.title),
        url:String(item.url||''),path:String(item.path||''),mime_type:String(item.mime_type||''),
        storage:String(item.storage||'recovered')
       });
      }
     }
     if(mediaTouched[kind]||Array.isArray(oldOutput[kind])||mediaReady)outputMedia[kind]=savedItems;
    }
    const body=sanitizeTransmissionBody(getEditorHTML());
    const blocks=getEditorBlocks();
    const row={record_id:Number(record.id),transmission_body:body,prompt_style:'',lyrics_style:'',output_text:'',output_media:outputMedia,blocks,updated_at:new Date().toISOString()};
    status.textContent='SAVING HUMAN ARCHIVE STRUCTURE TO GITHUB…';
    const saved=await window.VHACMSStore.savePublicStructure(record.id,row,record._publicCommitSha||archivePublicHeadSha);
    publicStructureSaved=true;record._publicCommitSha=saved.commitSha;
    recordStructureOverrides.set(String(record.id),row);
    await cleanupBlockMediaUploads(body+'\n'+blocks.map(block=>block.html||'').join('\n'));
    const keepPaths=new Set(['image','audio','video'].flatMap(kind=>Array.isArray(outputMedia[kind])?outputMedia[kind]:[])
     .filter(item=>item&&item.storage==='github-public').map(item=>item.path).filter(Boolean));
    const removedPaths=[...new Set(oldOwnedPaths)].filter(path=>!keepPaths.has(path));
    let cleanupWarning=false;
    if(removedPaths.length){
     try{const removed=await window.VHACMSStore.deletePublicMedia(record.id,removedPaths,record._publicCommitSha);record._publicCommitSha=removed.commitSha||record._publicCommitSha;}
     catch(error){cleanupWarning=true;console.warn('Removed chamber media could not be cleaned from GitHub:',error);}
    }
    status.textContent=cleanupWarning?'CHAMBER SAVED — UNUSED MEDIA CLEANUP NEEDS ATTENTION':'CHAMBER REDESIGNED // CHANGES SAVED';
   }
   blockEditorControllers.forEach(controller=>controller.destroy());
   richEditorController?.destroy();
   if(record.source_type==='transmission'){
    const titleNode=recordChamber?.querySelector('.ha-chamber-title');if(titleNode)titleNode.textContent=record.title;
    const metaNode=recordChamber?.querySelector('.ha-chamber-meta');
    if(metaNode)metaNode.textContent='HA-'+record.year+'-'+String(record.id).padStart(4,'0')+' // '+record.date+' // '+record.categories.join(' / ');
    const shareNode=recordChamber?.querySelector('.ha-chamber-share'),shareStatus=recordChamber?.querySelector('.ha-chamber-share-status');
    if(shareNode&&shareStatus){shareNode.replaceChildren();appendChamberShareActions(shareNode,record,shareStatus);}
    if(hasArchiveIndex){
     const chamberUrl=new URL(archiveHomeUrl.href);chamberUrl.searchParams.set('record',String(record.id));
     history.replaceState(history.state,'',chamberUrl.pathname+chamberUrl.search+chamberUrl.hash);
     render();
    }
   }
   renderRecordStructureView(record,grid,status,editButton,expandButton,closeButton);
  }catch(error){
   if(uploadedPublicPaths.length&&!publicStructureSaved){
    try{const removed=await window.VHACMSStore.deletePublicMedia(record.id,uploadedPublicPaths,record._publicCommitSha);record._publicCommitSha=removed.commitSha||record._publicCommitSha;}
    catch(cleanupError){console.warn('New public media could not be rolled back:',cleanupError);}
   }
   console.error('Human Archive chamber could not be saved:',error);
   if(error?.code==='EDIT_CONFLICT'||error?.status===409)chamberSaveConflict=true;
   status.textContent=chamberSaveConflict?'EDIT CONFLICT — RELOAD BEFORE CONTINUING.':'SAVE FAILED — '+String(error.message||'PLEASE TRY AGAIN');
   save.disabled=false;editButton.disabled=false;if(deleteDraft)deleteDraft.disabled=false;save.textContent='SAVE CHAMBER';
  }
 };

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
 edit.type='button';edit.hidden=!archiveAdmin||!archiveWriteReady;edit.setAttribute('aria-label','Redesign this archive chamber');
 const close=makeChamberNode('button','ha-chamber-close','CLOSE ✕');
 close.type='button';close.setAttribute('aria-label','Close record chamber');
 actions.append(edit,close);
 shareRow.append(share,shareStatus,actions);main.append(shareRow);
 main.append(titleRow);
 const grid=makeChamberNode('div','ha-chamber-grid');main.append(grid);
 renderRecordStructureView(record,grid,shareStatus,edit,expand,close);
 expand.addEventListener('click',()=>{
  const disclosures=[...grid.querySelectorAll('details[data-ha-disclosure]')];
  const shouldOpen=!disclosures.every(item=>item.open);
  disclosures.forEach(item=>{item.open=shouldOpen;});
  syncChamberExpandButton(grid,expand);
 });
 // The view renderer assigns the shared REDESIGN / CLOSE actions.
 const footer=makeChamberNode('footer','ha-chamber-footer');
 const source=safeExternalUrl(record.url,new Set(['emanuelstefancu.wordpress.com']));
 if(source){const link=makeChamberNode('a','ha-chamber-source','OPEN ORIGINAL SOURCE ↗');link.href=source;link.target='_blank';link.rel='noopener noreferrer';footer.append(link);}
 footer.append(makeChamberNode('span','ha-chamber-footer-note','NO TRACE IS EVER THE WHOLE PERSON.'));
 main.append(footer);shell.append(header,main);return shell;
}
let chamberCloseRequestedByUser=false;
async function closeRecordChamberSafely(){
 if(!recordChamber?.open){if(window.parent!==window)window.parent.postMessage({type:'VHA_TRANSMISSION_EDITOR_CLOSED'},window.location.origin);return;}
 if(chamberSaveConflict){
  const discard=window.confirm('A newer version was saved in another tab. This tab has unsaved changes that cannot be merged safely. Close this chamber and discard this tab’s changes?');
  if(!discard){if(window.parent!==window)window.parent.postMessage({type:'VHA_TRANSMISSION_EDITOR_CLOSE_FAILED'},window.location.origin);return;}
  chamberCloseRequestedByUser=true;recordChamber.close();return;
 }
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
 let backdropPointerStart=null;
 recordChamber.addEventListener('pointerdown',event=>{
  backdropPointerStart=event.isPrimary&&event.target===recordChamber
   ?{id:event.pointerId,x:event.clientX,y:event.clientY}:null;
 });
 recordChamber.addEventListener('pointerup',event=>{
  const start=backdropPointerStart;backdropPointerStart=null;
  if(!start||start.id!==event.pointerId||event.target!==recordChamber)return;
  if(Math.hypot(event.clientX-start.x,event.clientY-start.y)>8)return;
  closeRecordChamberSafely();
 });
 recordChamber.addEventListener('pointercancel',event=>{
  if(backdropPointerStart?.id===event.pointerId)backdropPointerStart=null;
 });
 recordChamber.addEventListener('close',()=>{
  document.body.classList.remove('ha-chamber-open');
  if(chamberCloseRequestedByUser&&window.parent!==window)window.parent.postMessage({type:'VHA_TRANSMISSION_EDITOR_CLOSED'},window.location.origin);
  chamberCloseRequestedByUser=false;
  if(hasArchiveIndex)history.replaceState(history.state,'',archiveHomeUrl.pathname+archiveHomeUrl.hash);
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
 if(!record||(!record.isNew&&!records.some(item=>String(item.id)===String(record.id))))return;
 chamberSaveConflict=false;
 const dialog=ensureRecordChamber();if(dialog.open)dialog.close();
 dialog.replaceChildren(buildRecordChamber(record));chamberRecordId=String(record.id);recordChamberReturnFocus=trigger||null;
 if(hasArchiveIndex&&!record.isNew){const url=new URL(archiveHomeUrl.href);url.searchParams.set('record',String(record.id));history.replaceState(history.state,'',url.pathname+url.search+url.hash);}document.body.classList.add('ha-chamber-open');
 try{
  dialog.showModal();
  if(openInEditor){
   if(!archiveAdmin||!archiveWriteReady||!archiveUserId)throw new Error('GITHUB OWNER SESSION REQUIRED');
   const grid=dialog.querySelector('.ha-chamber-grid');
   const status=dialog.querySelector('.ha-chamber-share-status');
   const editButton=dialog.querySelector('.ha-chamber-edit');
   const expandButton=dialog.querySelector('.ha-chamber-expand-all');
   const saveButton=dialog.querySelector('.ha-chamber-close');
   if(!grid||!status||!editButton||!saveButton)throw new Error('The new Transmission editor controls could not be initialized.');
   renderRecordStructureEditor(record,grid,status,editButton,expandButton,saveButton);
   editButton.className='ha-chamber-edit';editButton.hidden=false;editButton.disabled=false;
   editButton.textContent='DISCARD';editButton.setAttribute('aria-label','Discard editor changes');
   saveButton.className='ha-chamber-close ha-chamber-save';saveButton.disabled=false;
   saveButton.textContent='SAVE CHAMBER';saveButton.setAttribute('aria-label','Save chamber changes');
  }
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
async function createHumanArchiveTransmission(trigger){
 if(recordChamber?.open){recordChamber.focus();return;}
 if(!archiveAdmin||!archiveWriteReady||!window.VHACMSStore||!archiveUserId){
  if(createTransmissionStatus)createTransmissionStatus.textContent='GITHUB OWNER SESSION REQUIRED';return;
 }
 if(createTransmissionStatus)createTransmissionStatus.textContent='CREATING PRIVATE TRANSMISSION DRAFT…';
 try{
  const draft=await window.VHACMSStore.createDraft({
   title:'Untitled Transmission',slug:'untitled-transmission',category:'THE TRANSFORMATION',excerpt:'',media_width:100
  });
  const now=draft.created_at||new Date().toISOString(),date=String(now).slice(0,10);
  const record={
   id:Number(draft.record_id),post_id:draft.post_id,draft_id:draft.draft_id,
   source_type:'transmission',title:draft.metadata.title,slug:draft.metadata.slug,
   categories:[draft.metadata.category],excerpt:draft.metadata.excerpt||'',
   content_html:draft.content.transmission_body||'',status:'draft',media_items:[],
   media_width:draft.metadata.media_width||100,created_at:now,updated_at:draft.updated_at,
   published_at:null,date,year:date.slice(0,4),url:'',
   archiveIdentifier:'HA-'+date.slice(0,4)+'-'+String(draft.record_id).padStart(4,'0'),
   isNew:true,_repoCommitSha:draft._repoCommitSha,_draftData:draft,_publicCommitSha:archivePublicHeadSha
  };
  record.draft_id=draft.draft_id;
  records=records.filter(item=>String(item.id)!==String(record.id));
  records.push(record);
  recordStructureOverrides.set(String(record.id),{
   record_id:record.id,transmission_body:'',prompt_style:'',lyrics_style:'',output_text:'',
   output_media:{image:[],audio:[],video:[]},blocks:[],updated_at:draft.updated_at
  });
  if(hasArchiveIndex){if(!categoryOrder.includes(record.categories[0]))categoryOrder.push(record.categories[0]);render();}
  openArchiveRecordChamber(record,trigger||newTransmissionButton,true);
  if(createTransmissionStatus)createTransmissionStatus.textContent='NEW TRANSMISSION // PRIVATE DRAFT CREATED';
  recordChamber?.querySelector('[name="title"]')?.focus({preventScroll:true});
 }catch(error){
  console.error('A private Transmission draft could not be created:',error);
  if(createTransmissionStatus)createTransmissionStatus.textContent='DRAFT CREATION FAILED — '+String(error.message||'INITIALIZE THE PRIVATE SEQUENCE IN ADMIN FIRST');
 }
}
async function initArchiveFeatures(){
 if(!window.VHAGitHub||!window.VHACMSStore)throw new Error('The GitHub CMS modules are unavailable.');
 await refreshArchiveAdmin();
 archivePublicHeadSha=archiveAdmin?await window.VHAGitHub.getBranchHead('public'):null;
 if(newTransmissionButton){
  newTransmissionButton.hidden=!archiveAdmin||!archiveWriteReady;
  newTransmissionButton.disabled=!archiveAdmin||!archiveWriteReady;
  if(!newTransmissionButton.dataset.githubHandlerBound){
   newTransmissionButton.dataset.githubHandlerBound='true';
   newTransmissionButton.addEventListener('click',createHumanArchiveTransmission);
  }
 }
 if(hasArchiveIndex)await Promise.all([loadArchiveFavorites(),loadRecordStructureOverrides(),loadTransmissionRecords()]);
 if(!archiveAuthBound){
  archiveAuthBound=true;
  window.VHAGitHub.onAuthStateChange(async(_event,session)=>{
   await refreshArchiveAdmin(session);
   archivePublicHeadSha=archiveAdmin?await window.VHAGitHub.getBranchHead('public'):null;
   if(newTransmissionButton){newTransmissionButton.hidden=!archiveAdmin||!archiveWriteReady;newTransmissionButton.disabled=!archiveAdmin||!archiveWriteReady;}
   if(hasArchiveIndex){
    await loadArchiveFavorites();
    await loadTransmissionRecords();
    render();
    syncFavoriteControls();
   }
   const chamberEditButton=recordChamber?.querySelector('.ha-chamber-edit');
   if(chamberEditButton)chamberEditButton.hidden=!archiveAdmin||!archiveWriteReady;
  });
 }
 if(hasArchiveIndex){
  render();
  syncFavoriteControls();
  openRequestedRecordFromUrl();
 }
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
 const top=document.createElement('div');top.className='ha-entry-top';const code=document.createElement('small');code.className='ha-entry-code';code.textContent=record.archiveIdentifier;top.append(code);
 const internalId=document.createElement('small');internalId.className='ha-entry-id';internalId.textContent='ID // '+String(record.id);const bottom=document.createElement('div');bottom.className='ha-entry-bottom';const action=document.createElement('span');action.textContent='ACCESS NICHE ↓';bottom.append(internalId,action);link.append(top,bottom);link.style.setProperty('--entry-order',String(index));
 const quickActions=makeChamberNode('div','ha-entry-quick-actions');quickActions.hidden=true;
 const chamber=makeChamberNode('button','ha-entry-chamber','ENTER THE CHAMBER ↗');chamber.type='button';chamber.addEventListener('click',()=>openArchiveRecordChamber(record,chamber));
 const favorite=makeChamberNode('button','ha-favorite-toggle','☆');favorite.type='button';favorite.dataset.haFavoriteId=String(record.id);favorite.hidden=!archiveAdmin;favorite.setAttribute('aria-pressed',String(favoriteRecordIds.has(String(record.id))));favorite.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();toggleArchiveFavorite(record.id,favorite);});
 quickActions.append(chamber,favorite);
 link.addEventListener('click',()=>{const open=content.hidden;content.hidden=!open;link.setAttribute('aria-expanded',String(open));action.textContent=open?'EXIT NICHE ↑':'ACCESS NICHE ↓';quickActions.hidden=!open;});
 const body=document.createElement('div');body.className='ha-entry-body';const used=new Set();appendSafeContent(body,record.content_html||'',record,used);
 if(!body.childNodes.length){const message=document.createElement('p');message.textContent='No local text was captured for this entry.';body.append(message);}
 content.append(body);const gallery=makeAttachmentGallery(record,used);if(gallery)content.append(gallery);
 link.append(makeFavoriteMark(record));wrapper.append(link,quickActions,content);
 const source=safeExternalUrl(record.url,new Set(['emanuelstefancu.wordpress.com']));
 if(source){const original=makeChamberNode('a','ha-chamber-source ha-record-source','OPEN ORIGINAL SOURCE ↗');original.href=source;original.target='_blank';original.rel='noopener noreferrer';content.append(original);}
 return wrapper;
}
function render(){
 if(!hasArchiveIndex)return;
 const query=clean(search.value),selectedYear=year.value,selectedCategory=category.value;
 const filtered=records.filter(r=>(!selectedYear||r.year===selectedYear)&&(!query||[r.title,r.excerpt,r.year,r.date,r.id,...(r.categories||[]),searchableBody(r)].some(v=>clean(v).includes(query))));
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
  const collection=await fetchArchiveJson('../content/human-archive.json',true);
  if(!collection||!Array.isArray(collection.records)||collection.record_count!==collection.records.length||!collection.media_manifest||!collection.editor_structures)throw new Error('Invalid canonical Human Archive collection');
  const manifest=collection.media_manifest;
  recordStructureOverrides=new Map(collection.editor_structures.map(item=>[String(item.record_id),item]));
  const data=collection.records.map(item=>({...item,canonical_id:item.id,id:Number(item.legacy_id)}));
  records=assignArchiveSlugs(data.filter(r=>r&&typeof r.title==='string'&&typeof r.year==='string'&&typeof r.date==='string'&&Number.isSafeInteger(r.id)&&typeof r.url==='string'&&Array.isArray(r.categories)));
  if(records.length!==collection.record_count)throw new Error('The canonical Human Archive collection is incomplete');
  if(manifest&&Array.isArray(manifest.items)&&manifest.item_count===manifest.items.length){
   mediaItems=manifest.items.filter(item=>item&&item.source_type!=='external-inline-reference'&&Array.isArray(item.post_ids)&&item.post_ids.length&&String(item.storage_path||'').split('/').pop());
   mediaHashByPath.clear();mediaReady=mediaItems.length>0;
   if(mediaReady){
    for(const item of mediaItems){
     const keys=[item.source_url,...(item.aliases||[])].map(urlKey).filter(Boolean);
     keys.forEach(key=>mediaMap.set(key,item));
     (item.post_ids||[]).forEach(id=>{if(!mediaByPost.has(id))mediaByPost.set(id,[]);mediaByPost.get(id).push(item);});
    }
    const externalCount=manifest.items.length-mediaItems.length;
    setMediaStatus('GITHUB MEDIA VERIFIED // '+mediaItems.length+' LOCAL FILES // '+externalCount+' EXTERNAL REFERENCES NOT MIRRORED',true);
   }else setMediaStatus('MEDIA INVENTORY UNAVAILABLE // LOCAL TEXT REMAINS AVAILABLE',false);
  }else if(manifest)setMediaStatus('MEDIA INVENTORY UNAVAILABLE // LOCAL TEXT REMAINS AVAILABLE',false);
  else setMediaStatus('MEDIA INVENTORY TEMPORARILY UNAVAILABLE // LOCAL TEXT REMAINS AVAILABLE',false);
  categoryOrder.filter(name=>records.some(r=>r.categories.includes(name))).forEach(name=>{expandedCategories.add(name);const option=document.createElement('option');option.value=name;option.textContent=name;category.append(option)});
  render();
  try{await initArchiveFeatures();}
  catch(error){console.error('Human Archive interactive features failed:',error);openRequestedRecordFromUrl();}
 }catch(error){console.error('Human Archive local index failed:',error);list.textContent='THE LOCAL ARCHIVE COULD NOT BE LOADED. PLEASE REFRESH IN A MOMENT.';count.textContent='LOCAL ARCHIVE UNAVAILABLE';}
}
window.__vhaArchiveChamberControllerLoaded=true;
window.addEventListener('VHA_OPEN_NEW_TRANSMISSION',async event=>{
 try{
  await window.__vhaArchiveChamberReady;
  if(!archiveAdmin||!archiveWriteReady||!archiveUserId){
   console.warn('New Transmission was requested without an active archive administrator session.');
   return;
  }
  createHumanArchiveTransmission(event.detail?.trigger||null);
 }catch(error){console.error('The shared Transmission editor could not open:',error);}
});
window.addEventListener('VHA_OPEN_EXISTING_TRANSMISSION',async event=>{
 const slug=String(event.detail?.slug||'').trim();
 const trigger=event.detail?.trigger||null;
 try{
  await window.__vhaArchiveChamberReady;
  await ensureStandaloneTransmissionRecords();
  const record=records.find(item=>item.source_type==='transmission'&&item.slug===slug);
  if(!record)throw new Error('This Transmission is unavailable. It may have been unpublished or removed.');
  if(event.detail?.edit&&(!archiveAdmin||!archiveWriteReady||!window.VHACMSStore))throw new Error('GITHUB OWNER SESSION REQUIRED.');
  if(event.detail?.edit&&record.source_type==='transmission'&&record.status==='published'&&!record.draft_id){
   const draft=await window.VHACMSStore.createEditDraft(record.post_id);
   record.draft_id=draft.draft_id;record._draftData=draft;record._repoCommitSha=draft._repoCommitSha;
   record._editOfPublished=true;record.isNew=false;record.draft_source='existing';record.status='published';
   record.title=draft.metadata.title;record.slug=draft.metadata.slug;record.categories=[draft.metadata.category];
   record.excerpt=draft.metadata.excerpt;record.media_width=draft.metadata.media_width;
   record.content_html=draft.content.transmission_body||record.content_html;
   recordStructureOverrides.set(String(record.id),{
    record_id:Number(record.id),transmission_body:draft.content.transmission_body||record.content_html,
    prompt_style:draft.content.prompt_style||'',lyrics_style:draft.content.lyrics_style||'',output_text:draft.content.output_text||'',
    output_media:draft.content.output_media||{},blocks:draft.content.blocks||[],updated_at:draft.updated_at
   });
  }
  openArchiveRecordChamber(record,trigger,Boolean(event.detail?.edit));
 }catch(error){
  console.error('The shared Transmission chamber could not be opened:',error);
  window.dispatchEvent(new CustomEvent('VHA_TRANSMISSION_CHAMBER_ERROR',{detail:{message:String(error?.message||'The chamber could not be opened.'),trigger}}));
 }
});
if(hasArchiveIndex){
 bindEgoPortraitViewer();
 search.addEventListener('input',render);year.addEventListener('change',render);category.addEventListener('change',render);
 window.__vhaArchiveChamberReady=init();
}else{
 window.__vhaArchiveChamberReady=initArchiveFeatures();
}
})();