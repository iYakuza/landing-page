(()=>{'use strict';
const search=document.getElementById('ha-search'),year=document.getElementById('ha-year'),category=document.getElementById('ha-category'),list=document.getElementById('ha-list'),count=document.getElementById('ha-count'),mediaStatus=document.getElementById('ha-media-status');
let records=[],mediaItems=[],mediaMap=new Map(),mediaByPost=new Map(),mediaReady=false,publicBase='';
let imageViewer=null,imageViewerImage=null,imageViewerCaption=null,imageViewerZoom=null,imageViewerOriginal=null,imageViewerClose=null;
const expandedCategories=new Set();
const CHAMBER_RECORD_ID='589';
const SUPABASE_URL='https://oeyxsqocldlovhsmzcjw.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_kuUFxaClmROwgZpGIw6bzg_ddvb521h';
let archiveSupabase=null,archiveAdmin=false,archiveAuthBound=false;
let favoriteRecordIds=new Set(),favoriteSaveError=false,recordChamber=null,recordChamberReturnFocus=null;
const categoryOrder=['Nimic și Ființă','This notion','Dialog monolog','Gânduri','Cântec','Belief','Snob','PERSONAL PROJECTS','Haiku'];
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
function openImageViewer(item,record){
 ensureImageViewer();
 const src=localMediaUrl(item),label=mediaTitle(item,record),alt=item.alt_text||label;
 imageViewerCaption.textContent=label;
 imageViewerImage.src=src;imageViewerImage.alt=alt;
 imageViewerOriginal.href=src;
 setImageViewerZoom(false);
 imageViewer.showModal();
 imageViewerClose.focus();
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
 const isFavorite=favoriteRecordIds.has(CHAMBER_RECORD_ID);
 document.querySelectorAll('[data-ha-favorite-id="'+CHAMBER_RECORD_ID+'"]').forEach(button=>{
  button.hidden=!archiveAdmin;
  button.textContent=isFavorite?'★':'☆';
  button.setAttribute('aria-pressed',String(isFavorite));
  button.setAttribute('aria-label',favoriteSaveError?'Saving the favourite failed. Activate to retry.':(isFavorite?'Remove Fragile Love from author favourites':'Mark Fragile Love as an author favourite'));
  button.title=favoriteSaveError?'SAVE FAILED — ACTIVATE TO RETRY':(isFavorite?'REMOVE FROM FAVOURITES':'MARK AS FAVOURITE');
  button.classList.toggle('is-error',favoriteSaveError);
 });
 document.querySelectorAll('[data-ha-favorite-mark="'+CHAMBER_RECORD_ID+'"]').forEach(mark=>{
  mark.hidden=archiveAdmin||!isFavorite;
 });
}
async function loadArchiveFavorites(){
 if(!archiveSupabase)return;
 const {data,error}=await archiveSupabase.from('human_archive_favorites').select('record_id');
 if(error){console.warn('Human Archive favourites could not be loaded:',error);return;}
 favoriteRecordIds=new Set((data||[]).map(item=>String(item.record_id)));
}
async function refreshArchiveAdmin(sessionOverride){
 if(!archiveSupabase){archiveAdmin=false;return false;}
 let session=sessionOverride;
 if(sessionOverride===undefined){
  const result=await archiveSupabase.auth.getSession();
  if(result.error){archiveAdmin=false;return false;}
  session=result.data?.session;
 }
 if(!session?.user){archiveAdmin=false;return false;}
 const {data,error}=await archiveSupabase.from('vha_cms_admins').select('user_id').eq('user_id',session.user.id).maybeSingle();
 archiveAdmin=!error&&Boolean(data);
 return archiveAdmin;
}
async function toggleArchiveFavorite(recordId,button){
 if(!archiveAdmin||!archiveSupabase||String(recordId)!==CHAMBER_RECORD_ID||button.disabled)return;
 const wasFavorite=favoriteRecordIds.has(CHAMBER_RECORD_ID);
 button.disabled=true;
 favoriteSaveError=false;
 button.title=wasFavorite?'REMOVING FAVOURITE…':'SAVING FAVOURITE…';
 try{
  const result=wasFavorite
   ?await archiveSupabase.from('human_archive_favorites').delete().eq('record_id',Number(CHAMBER_RECORD_ID))
   :await archiveSupabase.from('human_archive_favorites').insert({record_id:Number(CHAMBER_RECORD_ID)});
  if(result.error&&!(result.error.code==='23505'&&!wasFavorite))throw result.error;
  if(wasFavorite)favoriteRecordIds.delete(CHAMBER_RECORD_ID);else favoriteRecordIds.add(CHAMBER_RECORD_ID);
  syncFavoriteControls();
 }catch(error){
  console.error('Human Archive favourite could not be saved:',error);
  favoriteSaveError=true;
 }finally{
  document.querySelectorAll('[data-ha-favorite-id="'+CHAMBER_RECORD_ID+'"]').forEach(control=>{control.disabled=false;});
  syncFavoriteControls();
 }
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
function appendChamberText(output,record){
 const parsed=new DOMParser().parseFromString(String(record.content_html||''),'text/html');
 parsed.body.querySelectorAll('figure,iframe,img,audio,video,source,object,embed').forEach(node=>node.remove());
 const body=makeChamberNode('div','ha-chamber-text ha-entry-body');
 const used=new Set();
 appendSafeContent(body,parsed.body.innerHTML,record,used);
 if(!body.childNodes.length)body.append(makeChamberNode('p','ha-chamber-note','No text was captured for this record.'));
 output.append(body);
}
function appendChamberOutput(record,body){
 const output=makeChamberNode('section','ha-chamber-panel ha-chamber-output');
 const heading=makeChamberNode('h3','ha-chamber-panel-heading','03 // OUTPUT');
 output.append(heading);
 const textSection=makeChamberNode('section','ha-chamber-output-section');
 textSection.append(makeChamberNode('h4','ha-chamber-output-label','TEXT'));
 appendChamberText(textSection,record);output.append(textSection);
 const relatedMedia=mediaItems.filter(item=>(item.post_ids||[]).some(id=>String(id)===String(record.id)));
 const images=relatedMedia.filter(item=>String(item.mime_type||'').startsWith('image/'));
 const audio=relatedMedia.filter(item=>String(item.mime_type||'').startsWith('audio/'));
 const imageSection=makeChamberNode('section','ha-chamber-output-section');
 imageSection.append(makeChamberNode('h4','ha-chamber-output-label','IMAGE'));
 if(mediaReady&&images.length){const gallery=makeChamberNode('div','ha-chamber-media-grid');images.forEach(item=>appendLocalImage(gallery,item,record,new Set()));imageSection.append(gallery);}
 else imageSection.append(makeChamberNode('p','ha-chamber-note',mediaReady?'No recovered image output is attached to this record.':'IMAGE OUTPUT // MEDIA VAULT NOT VERIFIED'));
 output.append(imageSection);
 const audioSection=makeChamberNode('section','ha-chamber-output-section');
 audioSection.append(makeChamberNode('h4','ha-chamber-output-label','AUDIO'));
 if(mediaReady&&audio.length){const gallery=makeChamberNode('div','ha-chamber-audio-list');audio.forEach(item=>appendLocalAudio(gallery,item,record,new Set()));audioSection.append(gallery);}
 else audioSection.append(makeChamberNode('p','ha-chamber-note',mediaReady?'No recovered audio output is attached to this record.':'AUDIO OUTPUT // MEDIA VAULT NOT VERIFIED'));
 output.append(audioSection);
 body.append(output);
}
function buildRecordChamber(record){
 const shell=makeChamberNode('div','ha-chamber-shell');
 const header=makeChamberNode('header','ha-chamber-header');
 const topbar=makeChamberNode('div','ha-chamber-topbar');
 topbar.append(makeChamberNode('span','ha-chamber-mark','EGO // HUMAN ARCHIVE'));
 const close=makeChamberNode('button','ha-chamber-close','CLOSE ✕');close.type='button';close.setAttribute('aria-label','Close record chamber');close.addEventListener('click',()=>recordChamber.close());topbar.append(close);
 const heading=makeChamberNode('div','ha-chamber-heading');
 const meta=makeChamberNode('p','ha-chamber-meta','HA-'+record.year+'-'+String(record.id).padStart(4,'0')+' // '+record.date+' // '+(record.categories||[]).join(' / '));
 const title=makeChamberNode('h2','',record.title);
 heading.append(meta,title);
 header.append(topbar,heading);
 const main=makeChamberNode('main','ha-chamber-main');
 const shareRow=makeChamberNode('div','ha-chamber-share-row');
 const share=makeChamberNode('div','ha-chamber-share','');
 const shareStatus=makeChamberNode('span','ha-chamber-share-status','');
 appendChamberShareActions(share,record,shareStatus);shareRow.append(share,shareStatus);main.append(shareRow);
 const layoutLabel=makeChamberNode('p','ha-chamber-layout-label','LAYOUT // SUNO LYRICS + STYLE BREAKDOWN');
 main.append(layoutLabel);
 const grid=makeChamberNode('div','ha-chamber-grid');
 const prompt=makeChamberNode('section','ha-chamber-panel');
 prompt.append(makeChamberNode('h3','ha-chamber-panel-heading','01 // PROMPT STYLE'));
 prompt.append(makeChamberNode('p','ha-chamber-note','SOURCE NOTE // The recovered 2021 archive record contains no separate AI or Suno style prompt. This field is intentionally left unreconstructed.'));
 grid.append(prompt);
 const lyrics=makeChamberNode('section','ha-chamber-panel');
 lyrics.append(makeChamberNode('h3','ha-chamber-panel-heading','02 // LYRICS STYLE'));
 lyrics.append(makeChamberNode('p','ha-chamber-note','SOURCE NOTE // No separate lyric-generation instruction sheet was preserved with this record. The original poem is presented verbatim under OUTPUT // TEXT.'));
 grid.append(lyrics);
 appendChamberOutput(record,grid);
 const footer=makeChamberNode('footer','ha-chamber-footer');
 const source=safeExternalUrl(record.url,new Set(['emanuelstefancu.wordpress.com']));
 if(source){const link=makeChamberNode('a','ha-chamber-source','OPEN ORIGINAL SOURCE ↗');link.href=source;link.target='_blank';link.rel='noopener noreferrer';footer.append(link);}
 footer.append(makeChamberNode('span','ha-chamber-footer-note','NO TRACE IS EVER THE WHOLE PERSON.'));
 main.append(grid,footer);shell.append(header,main);return shell;
}
function ensureRecordChamber(){
 if(recordChamber)return recordChamber;
 recordChamber=makeChamberNode('dialog','ha-record-chamber');
 recordChamber.setAttribute('aria-label','Human Archive record chamber');
 recordChamber.addEventListener('click',event=>{if(event.target===recordChamber)recordChamber.close();});
 recordChamber.addEventListener('close',()=>{
  const url=new URL(window.location.href);url.searchParams.delete('record');
  history.replaceState(history.state,'',url.pathname+(url.search?url.search:'')+url.hash);
  if(recordChamberReturnFocus?.isConnected)recordChamberReturnFocus.focus();
  recordChamberReturnFocus=null;
 });
 document.body.append(recordChamber);return recordChamber;
}
function openArchiveRecordChamber(record,trigger){
 if(String(record.id)!==CHAMBER_RECORD_ID)return;
 const dialog=ensureRecordChamber();
 if(dialog.open)dialog.close();
 dialog.replaceChildren(buildRecordChamber(record));
 recordChamberReturnFocus=trigger||null;
 const url=new URL(window.location.href);url.searchParams.set('record',String(record.id));
 history.replaceState(history.state,'',url.pathname+url.search+url.hash);
 try{dialog.showModal();}catch(error){console.error('Could not open the Human Archive chamber:',error);}
}
function openRequestedRecordFromUrl(){
 const requested=new URLSearchParams(window.location.search).get('record');
 if(requested!==CHAMBER_RECORD_ID)return;
 const record=records.find(item=>String(item.id)===CHAMBER_RECORD_ID);
 if(!record)return;
 search.value=record.title;year.value='';category.value='';render();
 const card=list.querySelector('.ha-record-card[data-ha-record-id="'+CHAMBER_RECORD_ID+'"]');
 card?.scrollIntoView({behavior:'smooth',block:'center'});
 openArchiveRecordChamber(record,null);
}
async function initArchiveFeatures(){
 if(!window.supabase?.createClient){openRequestedRecordFromUrl();return;}
 archiveSupabase=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
 await Promise.all([loadArchiveFavorites(),refreshArchiveAdmin()]);
 if(!archiveAuthBound){
  archiveAuthBound=true;
  archiveSupabase.auth.onAuthStateChange((_event,session)=>{
   window.setTimeout(async()=>{
    await refreshArchiveAdmin(session);
    render();
   },0);
  });
 }
 render();
 syncFavoriteControls();
 openRequestedRecordFromUrl();
}

function makeEntry(record,index){
 const wrapper=document.createElement('article');wrapper.className='ha-record-card';wrapper.dataset.haRecordId=String(record.id);
 const content=document.createElement('div');content.className='ha-entry-content';content.id='ha-record-'+record.id;content.hidden=true;
 const link=document.createElement('button');link.type='button';link.className='ha-entry';link.setAttribute('aria-controls',content.id);link.setAttribute('aria-expanded','false');link.setAttribute('aria-label','Read local archive record: '+record.title+', '+record.date);
 const top=document.createElement('div');top.className='ha-entry-top';const code=document.createElement('small');code.className='ha-entry-code';code.textContent='HA-'+record.year+'-'+String(record.id).padStart(4,'0');const yr=document.createElement('span');yr.className='ha-entry-year';yr.textContent=record.year;top.append(code,yr);
 const title=document.createElement('strong');title.textContent=record.title;const bottom=document.createElement('div');bottom.className='ha-entry-bottom';const date=document.createElement('small');date.textContent=record.date+' // LOCAL ARCHIVE COPY';const action=document.createElement('span');action.textContent='READ LOCAL TEXT ↓';bottom.append(date,action);link.append(top,title,bottom);link.style.setProperty('--entry-order',String(index));
 link.addEventListener('click',()=>{const open=content.hidden;content.hidden=!open;link.setAttribute('aria-expanded',String(open));action.textContent=open?'CLOSE LOCAL TEXT ↑':'READ LOCAL TEXT ↓';});
 const controls=[];
 if(String(record.id)===CHAMBER_RECORD_ID){
  const favorite=makeChamberNode('button','ha-favorite-toggle','☆');favorite.type='button';favorite.dataset.haFavoriteId=CHAMBER_RECORD_ID;favorite.hidden=!archiveAdmin;favorite.setAttribute('aria-pressed',String(favoriteRecordIds.has(CHAMBER_RECORD_ID)));favorite.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();toggleArchiveFavorite(record.id,favorite);});controls.push(favorite);
  const mark=makeChamberNode('span','ha-favorite-mark','★ AUTHOR’S FAVOURITE');mark.dataset.haFavoriteMark=CHAMBER_RECORD_ID;mark.hidden=true;controls.push(mark);
 }
 const body=document.createElement('div');body.className='ha-entry-body';const used=new Set();
 if(String(record.id)===CHAMBER_RECORD_ID){
  const entryActions=makeChamberNode('div','ha-entry-actions');
  if(archiveAdmin){const edit=makeChamberNode('a','ha-entry-edit','EDIT ORIGINAL ↗');edit.href='https://emanuelstefancu.wordpress.com/wp-admin/post.php?post=589&action=edit';edit.target='_blank';edit.rel='noopener noreferrer';entryActions.append(edit);}
  const chamber=makeChamberNode('button','ha-entry-chamber','ENTER THE CHAMBER ↗');chamber.type='button';chamber.addEventListener('click',()=>openArchiveRecordChamber(record,chamber));entryActions.append(chamber);
  content.append(entryActions);
 }
 appendSafeContent(body,record.content_html||'',record,used);
 if(!body.childNodes.length){const message=document.createElement('p');message.textContent='No local text was captured for this entry.';body.append(message);}
 content.append(body);
 const gallery=mediaReady?makeAttachmentGallery(record,used):null;if(gallery)content.append(gallery);
 wrapper.append(link,...controls,content);return wrapper;
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
async function init(){
 try{
  const [indexResponse,contentResponse,manifestResponse,reportResponse]=await Promise.all([
   fetch('archive-data.json',{credentials:'same-origin',cache:'no-store'}),
   fetch('archive-content.json',{credentials:'same-origin',cache:'no-store'}),
   fetch('media-manifest.json',{credentials:'same-origin',cache:'no-store'}),
   fetch('media-import-report.json',{credentials:'same-origin',cache:'no-store'}).catch(()=>null)
  ]);
  if(!indexResponse.ok||!contentResponse.ok)throw new Error('Local archive data unavailable');
  const [data,content]=await Promise.all([indexResponse.json(),contentResponse.json()]);
  if(!Array.isArray(data)||!Array.isArray(content.records)||content.record_count!==content.records.length)throw new Error('Invalid local archive data');
  const contentById=new Map(content.records.map(record=>[String(record.id),record]));
  records=data.filter(r=>r&&typeof r.title==='string'&&typeof r.year==='string'&&typeof r.date==='string'&&Number.isFinite(Number(r.id))&&typeof r.url==='string'&&Array.isArray(r.categories))
   .map(r=>({...r,content_html:contentById.get(String(r.id))?.content_html||''}));
  if(records.length!==content.record_count||records.some(r=>!contentById.has(String(r.id))))throw new Error('The local archive is incomplete');
  if(manifestResponse.ok){
   const manifest=await manifestResponse.json();
   const report=reportResponse&&reportResponse.ok?await reportResponse.json():null;
   if(Array.isArray(manifest.items)&&manifest.item_count===manifest.items.length){
    mediaItems=manifest.items;publicBase=manifest.public_base_url||'';
    const successes=new Map((report?.successes||[]).filter(x=>x&&x.verified===true).map(x=>[String(x.storage_path),x]));
    mediaReady=Boolean(report&&report.status==='complete'&&report.target_project_ref==='ioguymqdeuuursizifnn'&&report.asset_count===manifest.item_count&&report.successful_count===manifest.item_count&&report.failed_count===0&&successes.size===manifest.item_count&&manifest.bucket==='human-archive-media'&&publicBase.startsWith('https://ioguymqdeuuursizifnn.supabase.co/'));
    if(mediaReady){
     for(const item of mediaItems){
      const keys=[item.source_url,...(item.aliases||[])].map(urlKey).filter(Boolean);
      keys.forEach(key=>mediaMap.set(key,item));
      (item.post_ids||[]).forEach(id=>{if(!mediaByPost.has(id))mediaByPost.set(id,[]);mediaByPost.get(id).push(item);});
     }
     setMediaStatus('MEDIA VAULT VERIFIED // '+manifest.item_count+' FILES // IMAGES, AUDIO, VIDEO AND DOCUMENTS',true);
    }else setMediaStatus('MEDIA RECOVERY IN PROGRESS // TEXT IS AVAILABLE; MEDIA WILL APPEAR AFTER EVERY FILE HAS BEEN VERIFIED',false);
   }else setMediaStatus('MEDIA INVENTORY UNAVAILABLE // LOCAL TEXT REMAINS AVAILABLE',false);
  }else setMediaStatus('MEDIA INVENTORY NOT YET DEPLOYED // LOCAL TEXT REMAINS AVAILABLE',false);
  categoryOrder.filter(name=>records.some(r=>r.categories.includes(name))).forEach(name=>{expandedCategories.add(name);const option=document.createElement('option');option.value=name;option.textContent=name;category.append(option)});
  render();
  initArchiveFeatures().catch(error=>{console.error('Human Archive interactive features failed:',error);openRequestedRecordFromUrl();});
 }catch(error){console.error('Human Archive local index failed:',error);list.textContent='THE LOCAL ARCHIVE COULD NOT BE LOADED. PLEASE TRY AGAIN LATER.';count.textContent='LOCAL ARCHIVE OFFLINE';}
}
search.addEventListener('input',render);year.addEventListener('change',render);category.addEventListener('change',render);init();
})();