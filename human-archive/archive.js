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

// Human Archive chamber state and public Supabase configuration.
let chamberRecordId=null;
const SUPABASE_URL='https://oeyxsqocldlovhsmzcjw.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_kuUFxaClmROwgZpGIw6bzg_ddvb521h';
let archiveSupabase=null,archiveAdmin=false,archiveUserId=null,archiveAuthBound=false;
let standaloneTransmissionRecordsPromise=null;
let favoriteRecordIds=new Set(),favoriteSaveError=false,recordStructureOverrides=new Map();
let mediaHashByPath=new Map();
let recordChamber=null,recordChamberReturnFocus=null;

const clean=value=>String(value??'').normalize('NFKC').toLocaleLowerCase().trim();
function searchableBody(record){
 const source=getUnifiedRecordHTML(record,getRecordStructure(record));
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
function applyRecordMediaWidth(element,record){
 const width=Math.max(20,Math.min(100,Number(record?.media_width)||100));
 if(width<100){element.style.width=width+'%';element.style.maxWidth='100%';}
}
function appendLocalImage(parent,item,record,used){
 const embedded=parent.tagName==='FIGURE';
 const figure=embedded?parent:document.createElement('figure');figure.classList.add('ha-local-media','ha-local-image');applyRecordMediaWidth(figure,record);
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
 const figure=embedded?parent:document.createElement('figure');figure.classList.add('ha-local-media','ha-local-audio');applyRecordMediaWidth(figure,record);
 if(!embedded){const title=document.createElement('figcaption');title.textContent=mediaTitle(item,record);figure.append(title);}
 const audio=document.createElement('audio');audio.controls=true;audio.preload='metadata';audio.src=localMediaUrl(item);audio.setAttribute('aria-label','Audio: '+mediaTitle(item,record));figure.append(audio);
 if(!embedded)parent.append(figure);markUsed(item,used);
}
function appendLocalVideo(parent,item,record,used){
 const embedded=parent.tagName==='FIGURE';
 const figure=embedded?parent:document.createElement('figure');figure.classList.add('ha-local-media','ha-local-video');applyRecordMediaWidth(figure,record);
 const video=document.createElement('video');video.controls=true;video.preload='metadata';video.playsInline=true;video.src=localMediaUrl(item);video.setAttribute('aria-label','Video: '+mediaTitle(item,record));figure.append(video);
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
 const layoutClasses=new Set(['suno-post-layout','suno-text-column','suno-lyrics','suno-notes','suno-style-prompt','suno-learned','suno-chatgpt-learned','suno-label','plain-post-layout','plain-copy','plain-response','ha-pullquote','ha-verse','ha-button-block','ha-more-block','ha-markdown-source','ha-html-source','ha-buttons','ha-button','ha-columns','ha-group','ha-row','ha-stack','ha-grid','ha-spacer','ha-social-icons','ha-icon-block','ha-timeline','ha-tabs','ha-callout','ha-card','ha-media-text','ha-image-compare','ha-gallery','ha-slideshow','ha-tiled-gallery','ha-cover','ha-embed','ha-embed-youtube','ha-embed-spotify','ha-embed-soundcloud','ha-embed-card','ha-embed-link','ha-file-block','ha-audio-block','ha-podcast','ha-playlist','ha-page-break','wp-block-pullquote','wp-block-verse','wp-block-jetpack-timeline','wp-block-jetpack-timeline-item','timeline-item','timeline-item__bubble','timeline-item__dot']);
 function copy(node,parent){
  if(node.nodeType===Node.TEXT_NODE){parent.append(document.createTextNode(node.nodeValue||''));return;}
  if(node.nodeType!==Node.ELEMENT_NODE)return;
  const tag=node.tagName;
  if(blocked.has(tag))return;
  if(tag==='IMG'){
   const raw=node.getAttribute('src')||node.getAttribute('data-src')||'';
   const item=getMedia(raw);
   if(item&&(mediaReady||item.storage==='vha-post-media')){appendLocalImage(parent,item,record,used);}
   else{
    const src=safeExternalUrl(raw,new Set(['oeyxsqocldlovhsmzcjw.supabase.co','ioguymqdeuuursizifnn.supabase.co','i0.wp.com','emanuelstefancu.wordpress.com']));
    let valid=Boolean(src);
    if(valid){const url=new URL(src);if(url.hostname==='oeyxsqocldlovhsmzcjw.supabase.co')valid=/^\/storage\/v1\/object\/public\/(vha-post-media|poetry-media)\//.test(url.pathname);else if(url.hostname==='ioguymqdeuuursizifnn.supabase.co')valid=/^\/storage\/v1\/object\/public\/human-archive-media\//.test(url.pathname);else valid=url.pathname.includes('/wp-content/uploads/');}
    if(valid){const image=document.createElement('img');image.src=src;image.alt=node.getAttribute('alt')||record.title;image.loading='lazy';image.style.maxWidth='100%';image.style.height='auto';applyRecordMediaWidth(image,record);parent.append(image);}
    else appendMissing(parent,'Image not yet available in the recovered media collection.');
   }
   return;
  }
  if(tag==='AUDIO'||tag==='VIDEO'){
   const raw=node.getAttribute('src')||'';
   const item=getMedia(raw);
   if(item&&(mediaReady||item.storage==='vha-post-media')){if(tag==='AUDIO')appendLocalAudio(parent,item,record,used);else appendLocalVideo(parent,item,record,used);return;}
   const src=safeExternalUrl(raw,new Set(['oeyxsqocldlovhsmzcjw.supabase.co','ioguymqdeuuursizifnn.supabase.co']));
   const mediaUrl=src?new URL(src):null;
   const valid=Boolean(mediaUrl)&&((mediaUrl.hostname==='oeyxsqocldlovhsmzcjw.supabase.co'&&/^\/storage\/v1\/object\/public\/vha-post-media\//.test(mediaUrl.pathname))||(mediaUrl.hostname==='ioguymqdeuuursizifnn.supabase.co'&&/^\/storage\/v1\/object\/public\/human-archive-media\//.test(mediaUrl.pathname)));
   const mediaNode=document.createElement(tag.toLowerCase());mediaNode.controls=true;mediaNode.preload='metadata';applyRecordMediaWidth(mediaNode,record);
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
    const src=safeExternalUrl(raw,new Set(['oeyxsqocldlovhsmzcjw.supabase.co','ioguymqdeuuursizifnn.supabase.co']));
    if(src&&((new URL(src).hostname==='oeyxsqocldlovhsmzcjw.supabase.co'&&/^\/storage\/v1\/object\/public\/vha-post-media\//.test(new URL(src).pathname))||(new URL(src).hostname==='ioguymqdeuuursizifnn.supabase.co'&&/^\/storage\/v1\/object\/public\/human-archive-media\//.test(new URL(src).pathname)))&&(parent.tagName==='AUDIO'||parent.tagName==='VIDEO')){
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
   frame.allowFullscreen=true;frame.className='ha-archive-embed';applyRecordMediaWidth(frame,record);parent.append(frame);return;
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
  const mediaWidth=(node.style?.width||'').trim();
  if(['FIGURE','IMG','AUDIO','VIDEO','IFRAME'].includes(tag)&&/^(?:[2-9]\d|100)%$/.test(mediaWidth)){el.style.width=mediaWidth;el.style.maxWidth='100%';}
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
 let query=archiveSupabase.from('vha_posts').select('id,archive_record_id,title,slug,category,excerpt,content_html,status,created_at,updated_at,published_at,media_items,media_url,media_path,media_type,media_width').order('created_at',{ascending:false});
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
  if(category&&![...category.options].some(option=>option.value===name)){const option=document.createElement('option');option.value=name;option.textContent=name;category.append(option);}
  expandedCategories.add(name);
 });
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
function getRecordStructure(record){
 const saved=recordStructureOverrides.get(String(record.id));
 return {
  transmission_body:typeof saved?.transmission_body==='string'?saved.transmission_body:String(record.content_html||''),
  prompt_style:String(saved?.prompt_style||''),
  lyrics_style:String(saved?.lyrics_style||''),
  output_text:typeof saved?.output_text==='string'?saved.output_text:'',
  output_media:saved?.output_media&&typeof saved.output_media==='object'&&!Array.isArray(saved.output_media)?saved.output_media:null
 };
}
function archiveHasContent(html){
 const parsed=new DOMParser().parseFromString(String(html||''),'text/html');
 return Boolean((parsed.body.textContent||'').trim()||parsed.body.querySelector('img,audio,video,iframe,hr,table,figure,ul,ol'));
}
function archiveSectionHTML(label,html){
 if(!archiveHasContent(html))return '';
 return '<h2>'+String(label).replace(/[&<>"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[char]))+'</h2>'+sanitizeTransmissionBody(html);
}
function flattenArchivePostLayout(html){
 const parsed=new DOMParser().parseFromString(String(html||''),'text/html');
 const suno=parsed.querySelector('.suno-post-layout');
 const plain=parsed.querySelector('.plain-post-layout');
 if(!suno&&!plain)return String(html||'');
 const output=document.createElement('div');
 const extract=(selector)=>{
  const node=parsed.querySelector(selector);
  if(!node)return '';
  const clone=node.cloneNode(true);
  clone.querySelectorAll('.suno-label,.suno-collapse-hint').forEach(item=>item.remove());
  return clone.innerHTML;
 };
 const append=(label,content)=>{if(archiveHasContent(content))output.insertAdjacentHTML('beforeend',archiveSectionHTML(label,content));};
 if(suno){
  append('THE TEXT',extract('.suno-text-column'));
  append('SUNO STYLE LYRICS',extract('.suno-lyrics'));
  append('SUNO STYLE PROMPT',extract('.suno-style-prompt'));
  append('WHAT I LEARNED',extract('.suno-learned'));
  append('WHAT CHATGPT LEARNED',extract('.suno-chatgpt-learned'));
  if(!archiveHasContent(extract('.suno-style-prompt'))){
   const notes=parsed.querySelector('.suno-notes');
   if(notes){const clone=notes.cloneNode(true);clone.querySelectorAll('.suno-label,.suno-collapse-hint,.suno-learned,.suno-chatgpt-learned').forEach(item=>item.remove());append('SUNO STYLE PROMPT',clone.innerHTML);}
  }
 }else{
  append('THE TEXT',extract('.plain-copy'));
  append('A SMALL RESPONSE',extract('.plain-response'));
 }
 return output.innerHTML;
}
function flattenArchiveWrappers(html){
 const parsed=new DOMParser().parseFromString(String(html||''),'text/html');
 const output=document.createElement('div');
 const blockTags=new Set(['P','H1','H2','H3','H4','UL','OL','BLOCKQUOTE','PRE','HR','FIGURE','TABLE','DETAILS','IFRAME','AUDIO','VIDEO','IMG','CODE','DL','DT','DD']);
 const wrapperTags=new Set(['DIV','SECTION','ASIDE','ARTICLE','NAV','MAIN','HEADER','FOOTER']);
 const archiveBlocks=new Set(['ha-pullquote','ha-verse','ha-button-block','ha-more-block','ha-html-source','ha-markdown-source','ha-icon-block','ha-file-block','ha-embed','ha-embed-card','ha-embed-youtube','ha-embed-spotify','ha-embed-soundcloud','ha-podcast','ha-playlist','ha-audio-block','ha-columns','ha-group','ha-row','ha-stack','ha-grid','ha-cover','ha-gallery','ha-slideshow','ha-tiled-gallery','ha-media-text','ha-buttons','ha-callout','ha-card','ha-tabs','ha-timeline','ha-page-break','ha-social-icons','ha-spacer','ha-image-compare']);
 const flatten=(nodes,parent,inheritedAlignment='')=>{
  let inline=[];
  const flush=()=>{
   if(!inline.length)return;
   const paragraph=document.createElement('p');
   if(inheritedAlignment)paragraph.style.textAlign=inheritedAlignment;
   inline.forEach(node=>paragraph.append(node));
   parent.append(paragraph);inline=[];
  };
  [...nodes].forEach(node=>{
   if(node.nodeType===Node.TEXT_NODE){
    const value=node.nodeValue||'';
    if(!value.trim()&&!inline.length)return;
    inline.push(document.createTextNode(value));return;
   }
   if(node.nodeType!==Node.ELEMENT_NODE)return;
   const tag=node.tagName;
   const alignment=(node.style?.textAlign||inheritedAlignment||'').toLowerCase();
   if(node.classList?.contains('wp-block-jetpack-timeline')){
    flush();const timeline=node.cloneNode(true);timeline.classList.add('ha-timeline');parent.append(timeline);return;
   }
   if([...archiveBlocks].some(name=>node.classList?.contains(name))){
    flush();parent.append(node.cloneNode(true));return;
   }
   if(blockTags.has(tag)){
    flush();
    const clone=node.cloneNode(true);
    if(alignment&&['P','H1','H2','H3','H4'].includes(tag)&&!clone.style.textAlign)clone.style.textAlign=alignment;
    parent.append(clone);return;
   }
   if(wrapperTags.has(tag)){
    flush();flatten(node.childNodes,parent,alignment);return;
   }
   inline.push(node.cloneNode(true));
  });
  flush();
 };
 flatten(parsed.body.childNodes,output,'');
 return output.innerHTML;
}
function archiveMediaBlockHTML(item,type,record){
 const src=resolveChamberMediaUrl(item,type);
 if(!src)return '';
 const esc=value=>String(value||'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
 const name=mediaName(item,record),caption='<figcaption>'+esc(name)+'</figcaption>';
 if(type==='image')return '<figure><img src="'+esc(src)+'" alt="'+esc(name)+'" loading="lazy">'+caption+'</figure>';
 if(type==='audio')return '<figure><audio controls preload="metadata" src="'+esc(src)+'"></audio>'+caption+'</figure>';
 if(type==='video'){
  const url=new URL(src);
  if(item.storage==='external'){
   if(url.pathname.startsWith('/embed/'))return '<figure class="ha-embed ha-embed-youtube"><iframe src="'+esc(src)+'" title="'+esc(name)+'" loading="lazy" allowfullscreen></iframe>'+caption+'</figure>';
   return '<p><a href="'+esc(src)+'" target="_blank" rel="noopener noreferrer">OPEN VIDEO — '+esc(name)+'</a></p>';
  }
  return '<figure><video controls preload="metadata" playsinline src="'+esc(src)+'"></video>'+caption+'</figure>';
 }
 return '<p><a href="'+esc(src)+'" target="_blank" rel="noopener noreferrer">'+esc(name)+'</a></p>';
}
function getOwnedBlockMediaPaths(html,recordId){
 const parsed=new DOMParser().parseFromString(String(html||''),'text/html');
 const prefix='human-archive/'+String(recordId)+'/blocks/';
 const paths=new Set();
 parsed.querySelectorAll('[src],a[href]').forEach(node=>{
  const raw=node.getAttribute('src')||node.getAttribute('href')||'';
  try{
   const url=new URL(raw);
   if(url.protocol!=='https:'||url.hostname!=='oeyxsqocldlovhsmzcjw.supabase.co')return;
   const marker='/storage/v1/object/public/vha-post-media/';
   if(!url.pathname.startsWith(marker))return;
   const path=decodeURIComponent(url.pathname.slice(marker.length));
   if(path.startsWith(prefix))paths.add(path);
  }catch{}
 });
 return [...paths];
}
function getUnifiedRecordHTML(record,structure=getRecordStructure(record)){
 const savedBody=String(structure.transmission_body||'');
 const base=archiveHasContent(savedBody)?savedBody:String(record.content_html||'');
 const parts=[flattenArchiveWrappers(flattenArchivePostLayout(sanitizeTransmissionBody(base)))];
 parts.push(archiveSectionHTML('PROMPT STYLE',structure.prompt_style));
 parts.push(archiveSectionHTML('LYRICS STYLE',structure.lyrics_style));
 parts.push(archiveSectionHTML('OUTPUT',structure.output_text));
 const seen=new Set();
 const parsed=new DOMParser().parseFromString(parts.join(''),'text/html');
 parsed.querySelectorAll('[src],a[href]').forEach(node=>{const value=node.getAttribute('src')||node.getAttribute('href');if(value){seen.add(value);const recovered=getMedia(value);if(recovered)seen.add(localMediaUrl(recovered));}});
 ['image','audio','video'].forEach(type=>{
  getRecordOutputMedia(record,structure,type).forEach(item=>{
   const url=String(item?.url||'');
   if(!url||seen.has(url))return;
   const html=archiveMediaBlockHTML(item,type,record);
   if(html){parts.push(html);seen.add(url);}
  });
 });
 (Array.isArray(record.media_items)?record.media_items:[]).forEach(item=>{
  const type=String(item.type||'').toLowerCase();
  if(!['image','audio','video'].includes(type))return;
  const url=String(item.url||item.source_url||'');
  if(!url||seen.has(url))return;
  const html=archiveMediaBlockHTML({...item,url,storage:item.storage||'vha-post-media'},type,record);
  if(html){parts.push(html);seen.add(url);}
 });
 return parts.filter(Boolean).join('')||'<p><br></p>';
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
   const src=safeExternalUrl(node.getAttribute('src'),new Set(['oeyxsqocldlovhsmzcjw.supabase.co','ioguymqdeuuursizifnn.supabase.co','i0.wp.com','emanuelstefancu.wordpress.com']));
   let valid=Boolean(src);
   if(valid){const url=new URL(src);if(url.hostname==='oeyxsqocldlovhsmzcjw.supabase.co')valid=/^\/storage\/v1\/object\/public\/(vha-post-media|poetry-media)\//.test(url.pathname);else if(url.hostname==='ioguymqdeuuursizifnn.supabase.co')valid=/^\/storage\/v1\/object\/public\/human-archive-media\//.test(url.pathname);else valid=url.pathname.includes('/wp-content/uploads/');}
   if(!valid)return;
   element.src=src;element.alt=String(node.getAttribute('alt')||'');element.loading='lazy';element.style.maxWidth='100%';element.style.height='auto';
  }
  if(node.tagName==='AUDIO'||node.tagName==='VIDEO'){
   const rawSrc=node.getAttribute('src')||'';
   if(rawSrc){
    const src=safeExternalUrl(rawSrc,new Set(['oeyxsqocldlovhsmzcjw.supabase.co','ioguymqdeuuursizifnn.supabase.co']));
    if(!src)return;
    const url=new URL(src);
    const valid=(url.hostname==='oeyxsqocldlovhsmzcjw.supabase.co'&&/^\/storage\/v1\/object\/public\/vha-post-media\//.test(url.pathname))||(url.hostname==='ioguymqdeuuursizifnn.supabase.co'&&/^\/storage\/v1\/object\/public\/human-archive-media\//.test(url.pathname));
    if(!valid)return;
    element.src=src;
   }else if(!node.querySelector('source'))return;
   element.controls=true;element.preload='metadata';
   if(node.tagName==='VIDEO')element.playsInline=true;
  }
  if(node.tagName==='SOURCE'){
   const src=safeExternalUrl(node.getAttribute('src'),new Set(['oeyxsqocldlovhsmzcjw.supabase.co','ioguymqdeuuursizifnn.supabase.co']));
   if(!src)return;
   const url=new URL(src);
   const valid=(url.hostname==='oeyxsqocldlovhsmzcjw.supabase.co'&&/^\/storage\/v1\/object\/public\/vha-post-media\//.test(url.pathname))||(url.hostname==='ioguymqdeuuursizifnn.supabase.co'&&/^\/storage\/v1\/object\/public\/human-archive-media\//.test(url.pathname));
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
  const alignment=(node.style?.textAlign||'').toLowerCase();
  if(['left','center','right','justify'].includes(alignment))element.style.textAlign=alignment;
  const mediaWidth=(node.style?.width||'').trim();
  if(['FIGURE','IMG','AUDIO','VIDEO','IFRAME'].includes(node.tagName)&&/^(?:[2-9]\d|100)%$/.test(mediaWidth)){element.style.width=mediaWidth;element.style.maxWidth='100%';}
  node.childNodes.forEach(child=>copy(child,element));parent.append(element);
 }
 const fragment=document.createDocumentFragment();
 parsed.body.childNodes.forEach(node=>copy(node,fragment));
 const holder=document.createElement('div');holder.append(fragment);return holder.innerHTML;
}
function renderRecordStructureView(record,grid,status,editButton,expandButton){
 const structure=getRecordStructure(record);
 grid.classList.remove('ha-chamber-unified-editor');
 grid.classList.add('ha-chamber-unified');
 grid.replaceChildren();
 const body=makeChamberNode('div','ha-chamber-transmission-body ha-chamber-unified-content');
 appendSafeContent(body,getUnifiedRecordHTML(record,structure),record,new Set());
 if(!body.childNodes.length)body.textContent='No content has been saved for this record yet.';
 grid.append(body);
 if(editButton)editButton.hidden=!archiveAdmin;
 if(expandButton){expandButton.hidden=true;expandButton.setAttribute('aria-expanded','true');}
}
function chamberUploadToken(){
 try{if(window.crypto?.randomUUID)return window.crypto.randomUUID();}catch{}
 return Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
}
function renderRecordStructureEditor(record,grid,status,editButton,expandButton,readOnly=false){
 if(!archiveAdmin&&!readOnly){status.textContent='ADMIN ACCESS REQUIRED';return;}
 const structure=getRecordStructure(record);
 const uploadedPaths=[],uploadedAssets=[];
 let slugManuallyEdited=false;
 grid.classList.add('ha-chamber-unified','ha-chamber-unified-editor');
 grid.replaceChildren();
 const metadata=makeChamberNode('div','ha-chamber-document-settings');
 const metadataFields=makeChamberNode('div','ha-chamber-metadata-grid');
 const addField=(labelText,name,value,options={})=>{
  const wrap=makeChamberNode('label','ha-chamber-metadata-field');
  wrap.append(makeChamberNode('span','ha-chamber-metadata-label',labelText));
  const control=document.createElement(options.multiline?'textarea':'input');
  control.className='ha-chamber-editor-field ha-chamber-meta-input';control.name=name;
  if(options.multiline){control.rows=2;control.maxLength=options.maxLength||400;}
  else{control.type='text';control.maxLength=options.maxLength||180;control.autocomplete='off';}
  control.value=String(value??'');if(options.placeholder)control.placeholder=options.placeholder;
  wrap.append(control);metadataFields.append(wrap);return control;
 };
 const addSelect=(labelText,name,value,options)=>{
  const wrap=makeChamberNode('label','ha-chamber-metadata-field');
  wrap.append(makeChamberNode('span','ha-chamber-metadata-label',labelText));
  const control=document.createElement('select');control.className='ha-chamber-editor-field ha-chamber-meta-input';control.name=name;
  options.forEach(([v,label])=>{const option=document.createElement('option');option.value=v;option.textContent=label;control.append(option);});
  control.value=String(value??'');wrap.append(control);metadataFields.append(wrap);return control;
 };
 const titleInput=addField('TITLE','title',record.title,{placeholder:'Transmission title'});
 const slugInput=addField('PUBLIC URL SLUG','slug',record.slug,{placeholder:'lowercase-words-separated-by-hyphens'});
 const categories=[...new Set([...transmissionCategories,...(record.categories||[])])];
 const categoryInput=addSelect('ARCHIVE / MOVEMENT','category',(record.categories||[])[0]||'',[
  ['','CHOOSE DESTINATION'],...categories.map(name=>[name,name])
 ]);
 const excerptInput=addField('EXCERPT','excerpt',record.excerpt||'',{multiline:true,placeholder:'Short description shown in previews',maxLength:400});
 const widthWrap=makeChamberNode('label','ha-chamber-metadata-field');
 widthWrap.append(makeChamberNode('span','ha-chamber-metadata-label','MEDIA WIDTH'));
 const mediaWidthInput=document.createElement('input');mediaWidthInput.type='range';mediaWidthInput.min='20';mediaWidthInput.max='100';mediaWidthInput.step='5';mediaWidthInput.value=String(Math.max(20,Math.min(100,Number(record.media_width)||100)));mediaWidthInput.name='media_width';mediaWidthInput.className='ha-chamber-editor-field ha-chamber-meta-input';
 const widthOutput=makeChamberNode('output','ha-chamber-media-width-value',mediaWidthInput.value+'%');
 mediaWidthInput.addEventListener('input',()=>{widthOutput.textContent=mediaWidthInput.value+'%';canvas?.style.setProperty('--ha-media-width',mediaWidthInput.value+'%');});
 widthWrap.append(mediaWidthInput,widthOutput);metadataFields.append(widthWrap);
 const statusInput=addSelect('PUBLICATION STATUS','status',record.status==='published'?'published':'draft',[
  ['draft','DRAFT — PRIVATE'],['published','PUBLISHED — PUBLIC']
 ]);
 if(record.source_type!=='transmission')[titleInput,slugInput,categoryInput,excerptInput,mediaWidthInput,statusInput].forEach(control=>{control.disabled=true;});
 metadata.append(metadataFields);grid.append(metadata);
 if(record.source_type==='transmission'&&record.isNew){
  slugInput.addEventListener('input',()=>{slugManuallyEdited=true;});
  titleInput.addEventListener('input',()=>{
   if(slugManuallyEdited)return;
   slugInput.value=String(titleInput.value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,180);
  });
 }
 const toolbar=makeChamberNode('div','ha-rich-toolbar');toolbar.setAttribute('role','toolbar');toolbar.setAttribute('aria-label','Text formatting');
 const tools=[['B','bold'],['I','italic'],['U','underline'],['S','strikeThrough'],['P','formatBlock','p'],['H1','formatBlock','h1'],['H2','formatBlock','h2'],['H3','formatBlock','h3'],['H4','formatBlock','h4'],['QUOTE','formatBlock','blockquote'],['• LIST','insertUnorderedList'],['1. LIST','insertOrderedList'],['LEFT','justifyLeft'],['CENTER','justifyCenter'],['RIGHT','justifyRight'],['JUSTIFY','justifyFull'],['UNDO','undo'],['REDO','redo'],['CLEAR','removeFormat']];
 tools.forEach(([label,command,value])=>{const button=makeChamberNode('button','',label);button.type='button';button.dataset.command=command;if(value)button.dataset.value=value;button.title=label;toolbar.append(button);});
 const insertLinkButton=makeChamberNode('button','ha-rich-link','LINK');insertLinkButton.type='button';toolbar.append(insertLinkButton);
 const unlinkButton=makeChamberNode('button','','UNLINK');unlinkButton.type='button';unlinkButton.dataset.command='unlink';toolbar.append(unlinkButton);
 const focusButton=makeChamberNode('button','ha-chamber-focus-toggle','FOCUS');focusButton.type='button';focusButton.setAttribute('aria-pressed','false');
 const canvas=makeChamberNode('div','ha-chamber-editor-field ha-rich-content ha-chamber-unified-canvas');
 canvas.contentEditable=readOnly?'false':'true';canvas.setAttribute('role','textbox');canvas.setAttribute('aria-multiline','true');canvas.setAttribute('aria-label','Human Archive content');canvas.spellcheck=true;
 canvas.dataset.placeholder='Write your archive entry. Use Add block or / to insert any block…';
 canvas.innerHTML=sanitizeTransmissionBody(getUnifiedRecordHTML(record,structure));
 canvas.style.setProperty('--ha-media-width',mediaWidthInput.value+'%');
 grid.append(focusButton,toolbar,canvas);
 const blockMediaMime=(file,type)=>{
  const mime=String(file.type||'').toLowerCase();
  const accepted={image:['image/jpeg','image/png','image/webp','image/gif','image/avif'],audio:['audio/mpeg','audio/mp4','audio/ogg','audio/wav','audio/webm'],video:['video/mp4','video/webm'],file:['image/jpeg','image/png','image/webp','image/gif','image/avif','audio/mpeg','audio/mp4','audio/ogg','audio/wav','audio/webm','video/mp4','video/webm']};
  if(accepted[type]?.includes(mime))return mime;
  if(mime)return null;
  const ext=String(file.name||'').split('.').pop().toLowerCase();
  const byExt={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif',avif:'image/avif',mp3:'audio/mpeg',m4a:'audio/mp4',mp4:'video/mp4',wav:'audio/wav',ogg:'audio/ogg',weba:'audio/webm',webm:type==='video'?'video/webm':'audio/webm'};
  const inferred=byExt[ext]||'';return accepted[type]?.includes(inferred)?inferred:null;
 };
 const uploadBlockMedia=async(files,type)=>{
  if(!archiveAdmin||!archiveSupabase||!archiveUserId)throw new Error('An active CMS admin session is required to upload media.');
  const acceptedType=['image','gallery','slideshow','tiled-gallery','cover','media-text','image-compare'].includes(type)?'image':['audio','playlist','podcast'].includes(type)?'audio':type==='video'?'video':'file';
  const assets=[],operationPaths=[];
  try{
   for(const file of files){
    const mime=blockMediaMime(file,acceptedType);
    if(!mime)throw new Error(file.name+' has an unsupported file format.');
    if(file.size>30*1024*1024)throw new Error(file.name+' exceeds the 30 MB upload limit.');
    const token=chamberUploadToken();
    const safeName=String(file.name||'media').normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(-110)||'media';
    const folder=mime.startsWith('image/')?'image':mime.startsWith('audio/')?'audio':mime.startsWith('video/')?'video':'files';
    const path='human-archive/'+String(record.id)+'/blocks/'+folder+'/'+token+'-'+safeName;
    const {error}=await archiveSupabase.storage.from('vha-post-media').upload(path,file,{cacheControl:'3600',contentType:mime,upsert:false});
    if(error)throw error;
    uploadedPaths.push(path);operationPaths.push(path);
    const {data}=archiveSupabase.storage.from('vha-post-media').getPublicUrl(path);
    if(!data?.publicUrl)throw new Error('The uploaded media URL could not be created.');
    const asset={url:data.publicUrl,path,name:file.name,mime_type:mime,type:folder,storage:'vha-post-media'};
    assets.push(asset);uploadedAssets.push(asset);
   }
  }catch(error){
   if(operationPaths.length){const {error:cleanupError}=await archiveSupabase.storage.from('vha-post-media').remove(operationPaths);if(cleanupError)console.warn('Partial block upload cleanup failed:',cleanupError);}
   operationPaths.forEach(path=>{const index=uploadedPaths.indexOf(path);if(index>=0)uploadedPaths.splice(index,1);});
   assets.forEach(asset=>{const index=uploadedAssets.indexOf(asset);if(index>=0)uploadedAssets.splice(index,1);});throw error;
  }
  status.textContent=assets.length+' MEDIA FILE'+(assets.length===1?'':'S')+' UPLOADED — SAVE TO KEEP CHANGES.';
  return assets;
 };
 const getBlockMediaLibrary=type=>{
  const desired=['image','gallery','slideshow','tiled-gallery','cover','media-text','image-compare'].includes(type)?'image':['audio','playlist','podcast'].includes(type)?'audio':type==='video'?'video':'';
  const source=records.flatMap(item=>{
   const itemStructure=getRecordStructure(item);
   return [...['image','audio','video'].flatMap(kind=>getRecordOutputMedia(item,itemStructure,kind).map(media=>({...media,type:kind}))),...(Array.isArray(item.media_items)?item.media_items:[])];
  }).concat(uploadedAssets);
  const seen=new Set();
  return source.filter(item=>{
   const itemType=String(item.type||item.mime_type||'').toLowerCase(),url=item.url||item.source_url;
   const matches=!desired||itemType===desired||itemType.startsWith(desired+'/');
   if(!matches||!url||seen.has(url))return false;seen.add(url);return true;
  }).map(item=>({url:item.url||item.source_url,path:item.path||item.storage_path||'',name:item.name||item.title||record.title,mime_type:item.mime_type||item.type||''}));
 };
 const cleanupBlockMediaUploads=async(keepContent='')=>{
  if(!uploadedPaths.length)return;
  const keep=uploadedPaths.filter(path=>String(keepContent||'').includes(path));
  const remove=uploadedPaths.filter(path=>!keep.includes(path));
  record.blockMediaPaths=[...new Set([...(record.blockMediaPaths||[]),...keep])];
  if(remove.length&&archiveSupabase){const {error}=await archiveSupabase.storage.from('vha-post-media').remove(remove);if(error)console.warn('Unreferenced block media could not be cleaned up:',error);}
  uploadedPaths.splice(0);uploadedAssets.splice(0);
 };
 const blockEditorController=readOnly?null:window.VHABlockEditor?.mountBlockEditor({
  editor:canvas,onUpload:uploadBlockMedia,getMediaLibrary:getBlockMediaLibrary,
  onChange:()=>{if(record.source_type==='transmission'&&record.status==='draft')scheduleDraftAutosave?.();}
 });
 const richEditorController=readOnly?null:window.VHAEditorUI?.mountRichTextEditor({
  editor:canvas,editors:[canvas],toolbar,focusButton,insertLinkButton,focusClass:'ha-writing-focus',
  onChange:()=>{status.textContent='CONTENT EDITED — SAVE THE CHAMBER TO APPLY';scheduleDraftAutosave?.();},
  onInvalidLink:message=>{status.textContent=message;}
 });
 const getBody=()=>sanitizeTransmissionBody(blockEditorController?blockEditorController.getHTML():canvas.innerHTML);
 const getText=()=>blockEditorController?blockEditorController.getText():(canvas.innerText||'');
 if(readOnly){grid.classList.add('ha-chamber-read-only');canvas.contentEditable='false';return;}
 const actions=makeChamberNode('div','ha-chamber-editor-actions');
 const save=makeChamberNode('button','ha-chamber-save','SAVE CHAMBER');save.type='button';
 const cancel=makeChamberNode('button','ha-chamber-cancel','CANCEL');cancel.type='button';
 actions.append(save,cancel);grid.append(actions);
 const getMetadata=()=>{
  const metadata={title:String(titleInput.value).trim(),slug:String(slugInput.value).trim().toLowerCase(),category:String(categoryInput.value).trim().toUpperCase(),excerpt:String(excerptInput.value).trim(),mediaWidth:Math.max(20,Math.min(100,Number(mediaWidthInput.value)||100)),status:String(statusInput.value).trim().toLowerCase()};
  if(!metadata.title||metadata.title.length>180)throw new Error('Title must contain between 1 and 180 characters.');
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(metadata.slug))throw new Error('Use a valid lowercase URL slug with words separated by hyphens.');
  if(!transmissionCategories.includes(metadata.category))throw new Error('Choose Human Archive or one of the five Movements.');
  if(metadata.excerpt.length>400)throw new Error('Excerpt must be 400 characters or fewer.');
  if(!['draft','published'].includes(metadata.status))throw new Error('Choose a valid publication status.');
  return metadata;
 };
 const updateSaveLabel=()=>{
  if(record.source_type!=='transmission')return;
  const next=statusInput.value;
  save.textContent=next==='published'?(record.status==='published'?'SAVE PUBLISHED TRANSMISSION':'PUBLISH TRANSMISSION'):(record.status==='published'?'UNPUBLISH & SAVE DRAFT':'SAVE DRAFT');
 };
 statusInput.addEventListener('change',updateSaveLabel);updateSaveLabel();
 let draftAutosaveTimer=null,draftAutosaveInFlight=false,draftAutosaveQueued=false,draftAutosaveStopped=false,draftAutosaveFlushing=false,draftAutosaveConflict=false,draftAutosaveLastSignature='';
 const draftAutosaveEnabled=record.source_type==='transmission'&&record.status==='draft'&&!record.isNew;
 const deleteDraft=draftAutosaveEnabled?makeChamberNode('button','ha-chamber-delete-draft','DELETE DRAFT'):null;
 if(deleteDraft)deleteDraft.type='button';
 const existingPostMedia=(body=getBody())=> (Array.isArray(record.media_items)?record.media_items:[]).map(item=>({
  url:String(item.url||item.source_url||''),path:String(item.path||item.storage_path||''),
  type:String(item.type||'audio'),name:String(item.name||item.title||record.title)
 })).filter(item=>{
  const source=(Array.isArray(record.media_items)?record.media_items:[]).find(candidate=>String(candidate.url||candidate.source_url||'')===item.url);
  const candidates=[item.url,item.path,source?.source_url,source?.storage_path,source?localMediaUrl(source):''].filter(Boolean);
  return candidates.some(value=>String(body||'').includes(value));
 });
 const buildDraftAutosaveState=()=>{
  const metadata=getMetadata();metadata.status='draft';
  const body=getBody();
  if(!getText().trim()&&!archiveHasContent(body))throw new Error('Add content before saving this draft.');
  const row={record_id:Number(record.id),transmission_body:body,prompt_style:'',lyrics_style:'',output_text:'',output_media:{image:[],audio:[],video:[]},updated_at:new Date().toISOString(),updated_by:archiveUserId};
  return {metadata,row,mediaItems:existingPostMedia(body)};
 };
 const runDraftAutosave=async()=>{
  if(draftAutosaveConflict)return false;
  if(!draftAutosaveEnabled||draftAutosaveStopped||!archiveAdmin||!archiveSupabase||!archiveUserId)return true;
  if(draftAutosaveInFlight){draftAutosaveQueued=true;return null;}
  let state,signature;draftAutosaveInFlight=true;
  try{
   state=buildDraftAutosaveState();
   signature=JSON.stringify({metadata:state.metadata,row:{...state.row,updated_at:null,updated_by:null},mediaItems:state.mediaItems});
   if(signature===draftAutosaveLastSignature)return true;
   status.textContent='SAVING DRAFT…';
   const {data,error}=await archiveSupabase.rpc('save_human_archive_transmission_v5',{
    p_post_id:record.post_id,p_title:state.metadata.title,p_slug:state.metadata.slug,p_category:state.metadata.category,p_excerpt:state.metadata.excerpt,p_status:'draft',
    p_transmission_body:state.row.transmission_body,p_prompt_style:'',p_lyrics_style:'',p_output_text:'',p_output_media:state.row.output_media,
    p_media_items:state.mediaItems,p_media_width:state.metadata.mediaWidth,p_expected_updated_at:record.updated_at
   });
   if(error)throw error;
   const saved=Array.isArray(data)?data[0]:data;
   record.media_width=state.metadata.mediaWidth;record.title=state.metadata.title;record.slug=state.metadata.slug;record.categories=[state.metadata.category];record.excerpt=state.metadata.excerpt;record.media_items=state.mediaItems;
   const removedBlockPaths=[...new Set([...getOwnedBlockMediaPaths(record.content_html,record.id).filter(path=>!state.row.transmission_body.includes(path)),...(record.blockMediaPaths||[]).filter(path=>!state.row.transmission_body.includes(path))])];
   if(removedBlockPaths.length){const {error:removeError}=await archiveSupabase.storage.from('vha-post-media').remove(removedBlockPaths);if(removeError)console.warn('Removed draft block media could not be cleaned up:',removeError);}
   record.blockMediaPaths=(record.blockMediaPaths||[]).filter(path=>state.row.transmission_body.includes(path));
   record.content_html=state.row.transmission_body;record.status='draft';record.updated_at=saved?.updated_at||state.row.updated_at;state.row.updated_at=record.updated_at;
   recordStructureOverrides.set(String(record.id),state.row);
   await cleanupBlockMediaUploads(state.row.transmission_body);
   draftAutosaveLastSignature=signature;status.textContent='DRAFT SAVED AUTOMATICALLY';return true;
  }catch(error){
   console.error('Human Archive draft autosave failed:',error);
   if(error?.code==='40001'){chamberSaveConflict=true;draftAutosaveConflict=true;status.textContent='EDIT CONFLICT — THIS TRANSMISSION CHANGED IN ANOTHER TAB. RELOAD BEFORE CONTINUING.';}
   else status.textContent='AUTOSAVE FAILED — '+String(error.message||'PLEASE TRY AGAIN');
   return false;
  }finally{draftAutosaveInFlight=false;if(draftAutosaveQueued&&!draftAutosaveFlushing){draftAutosaveQueued=false;scheduleDraftAutosave(0);}}
 };
 const scheduleDraftAutosave=(delay=850)=>{
  if(!draftAutosaveEnabled||draftAutosaveConflict||draftAutosaveStopped)return;
  if(draftAutosaveTimer)clearTimeout(draftAutosaveTimer);
  draftAutosaveTimer=setTimeout(()=>{draftAutosaveTimer=null;runDraftAutosave();},delay);
 };
 metadata.addEventListener('input',()=>scheduleDraftAutosave());
 metadata.addEventListener('change',()=>{updateSaveLabel();scheduleDraftAutosave();});
 const flushDraftAutosave=async()=>{
  if(draftAutosaveConflict)return false;if(!draftAutosaveEnabled)return true;
  draftAutosaveFlushing=true;
  try{
   for(let attempt=0;attempt<4;attempt++){
    if(draftAutosaveTimer){clearTimeout(draftAutosaveTimer);draftAutosaveTimer=null;}
    while(draftAutosaveInFlight)await new Promise(resolve=>setTimeout(resolve,50));
    draftAutosaveQueued=false;const result=await runDraftAutosave();
    while(draftAutosaveInFlight)await new Promise(resolve=>setTimeout(resolve,50));
    if(result===false)return false;if(!draftAutosaveQueued&&!draftAutosaveTimer)return true;
   }
   return !draftAutosaveInFlight&&!draftAutosaveQueued&&!draftAutosaveTimer;
  }finally{draftAutosaveFlushing=false;}
 };
 if(draftAutosaveEnabled)flushActiveChamberAutosave=async()=>{if(draftAutosaveTimer){clearTimeout(draftAutosaveTimer);draftAutosaveTimer=null;}return await flushDraftAutosave();};
 if(deleteDraft)actions.prepend(deleteDraft);
 deleteDraft?.addEventListener('click',async()=>{
  if(!draftAutosaveEnabled||draftAutosaveStopped||!archiveAdmin||!archiveSupabase||!archiveUserId)return;
  if(!window.confirm('Permanently delete this draft Transmission? Its Human Archive record and associated attachment files will be removed. This cannot be undone.'))return;
  draftAutosaveStopped=true;if(draftAutosaveTimer){clearTimeout(draftAutosaveTimer);draftAutosaveTimer=null;}
  deleteDraft.disabled=true;save.disabled=true;cancel.disabled=true;status.textContent='WAITING FOR ANY ACTIVE DRAFT SAVE…';
  try{
   while(draftAutosaveInFlight)await new Promise(resolve=>setTimeout(resolve,50));
   status.textContent='DELETING DRAFT…';
   const {data,error}=await archiveSupabase.rpc('delete_human_archive_transmission_draft_v1',{p_post_id:record.post_id});
   if(error)throw error;
   const deleted=Array.isArray(data)?data[0]:data;
   if(!deleted||Number(deleted.archive_record_id)!==Number(record.id))throw new Error('The database did not confirm deletion of this exact Archive record.');
   const paths=[...new Set([...(Array.isArray(deleted.storage_paths)?deleted.storage_paths.filter(path=>typeof path==='string'&&path.startsWith('human-archive/'+String(record.id)+'/')):[]),...getOwnedBlockMediaPaths(record.content_html,record.id),...(record.blockMediaPaths||[])])];
   if(paths.length){const {error:cleanupError}=await archiveSupabase.storage.from('vha-post-media').remove(paths);if(cleanupError)console.warn('Some draft files could not be cleaned up:',cleanupError);}
   await cleanupBlockMediaUploads('');
   records=records.filter(item=>String(item.id)!==String(record.id));recordStructureOverrides.delete(String(record.id));favoriteRecordIds.delete(String(record.id));
   chamberCloseRequestedByUser=true;recordChamber?.close();render();setMediaStatus('DRAFT DELETED',true);
  }catch(error){
   draftAutosaveStopped=false;deleteDraft.disabled=false;save.disabled=false;cancel.disabled=false;
   console.error('Human Archive draft could not be deleted:',error);status.textContent='DELETE FAILED — '+String(error.message||'PLEASE TRY AGAIN');scheduleDraftAutosave(0);
  }
 });
 cancel.addEventListener('click',async()=>{
  if(draftAutosaveTimer){clearTimeout(draftAutosaveTimer);draftAutosaveTimer=null;}
  if(draftAutosaveEnabled&&draftAutosaveInFlight)await flushDraftAutosave();
  await cleanupBlockMediaUploads('');
  if(chamberSaveConflict){
   const discard=window.confirm('This tab has unsaved changes that conflict with a newer version. Discard this tab’s changes and return to the read-only chamber?');
   if(!discard)return;chamberSaveConflict=false;flushActiveChamberAutosave=async()=>true;
  }
  blockEditorController?.destroy();richEditorController?.destroy();flushActiveChamberAutosave=async()=>true;status.textContent='';
  renderRecordStructureView(record,grid,status,editButton,expandButton);
 });
 save.addEventListener('click',async()=>{
  if(!archiveAdmin||!archiveSupabase||!archiveUserId){status.textContent='ADMIN SESSION REQUIRED';return;}
  if(draftAutosaveTimer){clearTimeout(draftAutosaveTimer);draftAutosaveTimer=null;}
  if(draftAutosaveInFlight){status.textContent='WAITING FOR AUTOMATIC DRAFT SAVE…';await new Promise(resolve=>{const wait=()=>draftAutosaveInFlight?setTimeout(wait,50):resolve();wait();});}
  if(record.source_type==='transmission'&&record.post_id&&statusInput.value!==record.status){
   const prompt=statusInput.value==='published'?'Publish this Transmission? It will become visible on the public site.':'Unpublish this Transmission? It will become a private draft and disappear from public listings.';
   if(!window.confirm(prompt))return;
  }
  save.disabled=true;cancel.disabled=true;save.textContent='SAVING…';status.textContent='PREPARING BLOCK DOCUMENT…';
  const oldStructure=recordStructureOverrides.get(String(record.id))||{};
  const body=getBody();
  try{
   let metadata=record.source_type==='transmission'?getMetadata():null;
   if(metadata?.status==='published'&&!getText().trim()&&!archiveHasContent(body))throw new Error('Add transmission content before publishing.');
   if(metadata?.status==='published'&&!metadata.category)throw new Error('Choose a movement category before publishing.');
   if(record.source_type==='transmission'&&!record.post_id){
    status.textContent='CREATING TRANSMISSION…';
    const {data:createResult,error:createError}=await archiveSupabase.rpc('create_human_archive_transmission_v3',{
     p_title:metadata.title,p_slug:metadata.slug,p_category:metadata.category,p_excerpt:metadata.excerpt,p_status:'draft',
     p_transmission_body:body,p_prompt_style:'',p_lyrics_style:'',p_output_text:'',p_output_media:{image:[],audio:[],video:[]},p_media_items:[],p_media_width:metadata.mediaWidth
    });
    if(createError)throw createError;
    const created=Array.isArray(createResult)?createResult[0]:createResult;
    if(!created?.post_id||!created?.archive_record_id||!created?.slug||!created?.updated_at)throw new Error('The Transmission record could not be confirmed.');
    record.id=Number(created.archive_record_id);record.post_id=created.post_id;record.updated_at=created.updated_at;
    record.title=metadata.title;record.slug=String(created.slug);record.categories=[metadata.category];record.excerpt=metadata.excerpt;
    record.status='draft';record.media_width=metadata.mediaWidth;record.created_at=new Date().toISOString();record.date=record.created_at.slice(0,10);record.year=record.date.slice(0,4);
    record.archiveIdentifier='HA-'+record.year+'-'+String(record.id).padStart(4,'0');record.isNew=false;chamberRecordId=String(record.id);
   }
   const row={record_id:Number(record.id),transmission_body:body,prompt_style:'',lyrics_style:'',output_text:'',output_media:{image:[],audio:[],video:[]},updated_at:new Date().toISOString(),updated_by:archiveUserId};
   const mediaItemsToSave=existingPostMedia(body);
   if(record.source_type==='transmission'){
    metadata=getMetadata();
    if(metadata.status==='published'&&!getText().trim()&&!archiveHasContent(body))throw new Error('Add transmission content before publishing.');
    const {data:saveResult,error}=await archiveSupabase.rpc('save_human_archive_transmission_v5',{
     p_post_id:record.post_id,p_title:metadata.title,p_slug:metadata.slug,p_category:metadata.category,p_excerpt:metadata.excerpt,p_status:metadata.status,
     p_transmission_body:row.transmission_body,p_prompt_style:'',p_lyrics_style:'',p_output_text:'',p_output_media:row.output_media,
     p_media_items:mediaItemsToSave,p_media_width:metadata.mediaWidth,p_expected_updated_at:record.updated_at
    });
    if(error)throw error;
    const saved=Array.isArray(saveResult)?saveResult[0]:saveResult;
    record.title=metadata.title;record.slug=metadata.slug;record.categories=[metadata.category];record.excerpt=metadata.excerpt;record.status=metadata.status;
    record.media_width=metadata.mediaWidth;record.media_items=mediaItemsToSave;record.published_at=saved?.published_at||null;record.updated_at=saved?.updated_at||row.updated_at;row.updated_at=record.updated_at;
    const stamp=record.published_at||record.created_at||record.updated_at;record.date=String(stamp).slice(0,10);record.year=record.date.slice(0,4);
   }else{
    const {data:structureResult,error}=await archiveSupabase.rpc('save_human_archive_record_structure_v1',{
     p_record_id:Number(record.id),p_expected_updated_at:oldStructure.updated_at||null,
     p_transmission_body:row.transmission_body,p_prompt_style:'',p_lyrics_style:'',p_output_text:'',p_output_media:row.output_media
    });
    if(error)throw error;
    const saved=Array.isArray(structureResult)?structureResult[0]:structureResult;row.updated_at=saved?.updated_at||row.updated_at;
   }
   const previousBody=String(record.content_html||'');
   const removedBlockPaths=[...new Set([...getOwnedBlockMediaPaths(previousBody,record.id).filter(path=>!row.transmission_body.includes(path)),...(record.blockMediaPaths||[]).filter(path=>!row.transmission_body.includes(path))])];
   if(removedBlockPaths.length){const {error:removeError}=await archiveSupabase.storage.from('vha-post-media').remove(removedBlockPaths);if(removeError)console.warn('Removed block media could not be cleaned from storage:',removeError);}
   record.blockMediaPaths=(record.blockMediaPaths||[]).filter(path=>row.transmission_body.includes(path));
   record.content_html=row.transmission_body;recordStructureOverrides.set(String(record.id),row);
   if(draftAutosaveEnabled){
    if(record.status==='published'){draftAutosaveStopped=true;flushActiveChamberAutosave=async()=>true;}
    else{
     const autosaveState=buildDraftAutosaveState();
     draftAutosaveLastSignature=JSON.stringify({metadata:autosaveState.metadata,row:{...autosaveState.row,updated_at:null,updated_by:null},mediaItems:autosaveState.mediaItems});
    }
   }
   await cleanupBlockMediaUploads(row.transmission_body);
   const oldMediaPaths=['image','audio','video'].flatMap(type=>Array.isArray(oldStructure.output_media?.[type])?oldStructure.output_media[type]:[])
    .filter(item=>item&&item.storage==='vha-post-media'&&typeof item.path==='string'&&item.path.startsWith('human-archive/'+String(record.id)+'/'))
    .filter(item=>!row.transmission_body.includes(item.path)&&!row.transmission_body.includes(String(item.url||''))).map(item=>item.path);
   if(oldMediaPaths.length){const {error:removeError}=await archiveSupabase.storage.from('vha-post-media').remove([...new Set(oldMediaPaths)]);if(removeError)console.warn('Removed block media could not be cleaned from storage:',removeError);}
   if(!records.some(item=>String(item.id)===String(record.id))){
    records.push(record);if(!categoryOrder.includes(record.categories[0]))categoryOrder.push(record.categories[0]);
    if(category&&![...category.options].some(option=>option.value===record.categories[0])){const option=document.createElement('option');option.value=record.categories[0];option.textContent=record.categories[0];category.append(option);}
   }
   status.textContent='BLOCK DOCUMENT SAVED';
   blockEditorController?.destroy();richEditorController?.destroy();
   if(record.source_type==='transmission'){
    const titleNode=recordChamber?.querySelector('.ha-chamber-title');if(titleNode)titleNode.textContent=record.title;
    const metaNode=recordChamber?.querySelector('.ha-chamber-meta');
    if(metaNode)metaNode.textContent='HA-'+record.year+'-'+String(record.id).padStart(4,'0')+' // '+record.date+' // '+record.categories.join(' / ');
    const shareNode=recordChamber?.querySelector('.ha-chamber-share'),shareStatus=recordChamber?.querySelector('.ha-chamber-share-status');
    if(shareNode&&shareStatus){shareNode.replaceChildren();appendChamberShareActions(shareNode,record,shareStatus);}
    if(hasArchiveIndex){const url=new URL(archiveHomeUrl.href);url.searchParams.set('record',String(record.id));history.replaceState(history.state,'',url.pathname+url.search+url.hash);render();}
   }
   if(hasArchiveIndex&&record.source_type!=='transmission')render();
   renderRecordStructureView(record,grid,status,editButton,expandButton);
  }catch(error){
   console.error('Human Archive block document could not be saved:',error);
   if(error?.code==='40001')chamberSaveConflict=true;
   status.textContent=error?.code==='40001'?'EDIT CONFLICT — THIS RECORD CHANGED IN ANOTHER TAB. RELOAD BEFORE CONTINUING.':'SAVE FAILED — '+String(error.message||'PLEASE TRY AGAIN');
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
 titleRow.append(title);
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
 const grid=makeChamberNode('div','ha-chamber-grid ha-chamber-unified');main.append(grid);
 renderRecordStructureView(record,grid,shareStatus,edit,null);
 edit.addEventListener('click',()=>{
  if(!archiveAdmin){shareStatus.textContent='ADMIN ACCESS REQUIRED';return;}
  renderRecordStructureEditor(record,grid,shareStatus,edit,null);
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
 recordChamber.addEventListener('click',event=>{if(event.target===recordChamber)closeRecordChamberSafely();});
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
  if(archiveAdmin&&openInEditor)dialog.querySelector('.ha-chamber-edit')?.click();
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
function createHumanArchiveTransmission(trigger){
 if(recordChamber?.open){recordChamber.focus();return;}
 if(!archiveAdmin||!archiveSupabase||!archiveUserId){if(createTransmissionStatus)createTransmissionStatus.textContent='ADMIN SESSION REQUIRED';return;}
 const temporaryId=Date.now();
 const now=new Date().toISOString();
 const record={
  id:temporaryId,post_id:null,source_type:'transmission',title:'',slug:'untitled-transmission',
  categories:[],excerpt:'',content_html:'',status:'new',media_items:[],media_width:100,
  created_at:now,updated_at:now,published_at:null,date:now.slice(0,10),year:now.slice(0,4),
  url:'',archiveIdentifier:'UNSAVED TRANSMISSION',isNew:true
 };
 openArchiveRecordChamber(record,trigger||newTransmissionButton,true);
 if(createTransmissionStatus)createTransmissionStatus.textContent='NEW TRANSMISSION // UNSAVED';
 recordChamber?.querySelector('[name="title"]')?.focus({preventScroll:true});
}
async function initArchiveFeatures(){
 if(!window.supabase?.createClient)throw new Error('Supabase is unavailable; the Transmission editor cannot start.');
 archiveSupabase=window.__vhaSupabaseClient||window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
 window.__vhaSupabaseClient=archiveSupabase;
 await refreshArchiveAdmin();
 if(newTransmissionButton){newTransmissionButton.hidden=!archiveAdmin;newTransmissionButton.disabled=!archiveAdmin;newTransmissionButton.addEventListener('click',createHumanArchiveTransmission);}
 if(hasArchiveIndex)await Promise.all([loadArchiveFavorites(),loadRecordStructureOverrides(),loadTransmissionRecords()]);
 if(!archiveAuthBound){
  archiveAuthBound=true;
  archiveSupabase.auth.onAuthStateChange((_event,session)=>{
   window.setTimeout(async()=>{
    await refreshArchiveAdmin(session);
    if(newTransmissionButton){newTransmissionButton.hidden=!archiveAdmin;newTransmissionButton.disabled=!archiveAdmin;}
    if(hasArchiveIndex){
     await loadTransmissionRecords();
     render();
     syncFavoriteControls();
    }
    // Refresh permissions without rebuilding an open chamber or discarding editor state.
    const chamberEditButton=recordChamber?.querySelector('.ha-chamber-edit');
    if(chamberEditButton)chamberEditButton.hidden=!archiveAdmin;
   },0);
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
 const body=document.createElement('div');body.className='ha-entry-body';const used=new Set();appendSafeContent(body,getUnifiedRecordHTML(record,getRecordStructure(record)),record,used);
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
     const keys=[item.source_url,...(item.aliases||[]),localMediaUrl(item)].map(urlKey).filter(Boolean);
     keys.forEach(key=>mediaMap.set(key,item));
     (item.post_ids||[]).forEach(id=>{if(!mediaByPost.has(id))mediaByPost.set(id,[]);mediaByPost.get(id).push(item);});
    }
    setMediaStatus('MEDIA VAULT VERIFIED // '+manifest.item_count+' FILES // IMAGES, AUDIO, VIDEO AND DOCUMENTS',true);
   }else setMediaStatus('MEDIA RECOVERY IN PROGRESS // TEXT IS AVAILABLE; MEDIA WILL APPEAR AFTER EVERY FILE HAS BEEN VERIFIED',false);
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
  if(!archiveAdmin||!archiveSupabase||!archiveUserId){
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
  if(event.detail?.edit&&!archiveAdmin)throw new Error('CMS ADMIN ACCESS COULD NOT BE CONFIRMED. PLEASE SIGN IN AGAIN.');
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