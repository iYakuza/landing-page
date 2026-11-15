(()=>{'use strict';
const search=document.getElementById('ha-search'),year=document.getElementById('ha-year'),category=document.getElementById('ha-category'),list=document.getElementById('ha-list'),count=document.getElementById('ha-count'),mediaStatus=document.getElementById('ha-media-status');
let records=[],mediaItems=[],mediaMap=new Map(),mediaByPost=new Map(),mediaReady=false,publicBase='';
let imageViewer=null,imageViewerImage=null,imageViewerCaption=null,imageViewerZoom=null,imageViewerOriginal=null,imageViewerClose=null;
const expandedCategories=new Set();

function syncFavoriteControls(){
 const isFavorite=favoriteRecordIds.has(CHAMBER_RECORD_ID);
 document.querySelectorAll('[data-ha-favorite-id="'+CHAMBER_RECORD_ID+'"]').forEach(button=>{
  button.hidden=!archiveAdmin&&!isFavorite;
  button.disabled=!archiveAdmin;
  button.textContent=isFavorite?'★':'☆';
  button.setAttribute('aria-pressed',String(isFavorite));
  button.setAttribute('aria-label',favoriteSaveError?'Saving the favourite failed. Activate to retry.':(isFavorite?'Fragile Love is an author favourite':'Mark Fragile Love as an author favourite'));
  button.title=favoriteSaveError?'SAVE FAILED — ACTIVATE TO RETRY':(isFavorite?'AUTHOR FAVOURITE':(archiveAdmin?'MARK AS FAVOURITE':''));
  button.classList.toggle('is-error',favoriteSaveError);
  button.classList.toggle('is-saved',isFavorite);
 });
}
async function loadArchiveFavorites(){
 if(!archiveSupabase)return;
 const {data,error}=await archiveSupabase.from('human_archive_favorites').select('record_id');
 if(error){console.warn('Human Archive favourites could not be loaded:',error);return;}
 favoriteRecordIds=new Set((data||[]).map(item=>String(item.record_id)));
}
async function loadRecordStructureOverrides(){
 if(!archiveSupabase)return;
 const {data,error}=await archiveSupabase.from('human_archive_record_structures')
  .select('record_id,prompt_style,lyrics_style,output_text,updated_at')
  .eq('record_id',Number(CHAMBER_RECORD_ID))
  .maybeSingle();
 if(error){console.warn('Human Archive structure could not be loaded:',error);return;}
 if(data)recordStructureOverrides.set(String(data.record_id),data);
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
 }catch(error){
  console.error('Human Archive favourite could not be saved:',error);
  favoriteSaveError=true;
 }finally{
  document.querySelectorAll('[data-ha-favorite-id="'+CHAMBER_RECORD_ID+'"]').forEach(control=>{control.disabled=!archiveAdmin;});
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
  output_text:typeof saved?.output_text==='string'?saved.output_text:defaultRecordOutputText(record)
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
function appendChamberVideoOutput(section,record){
 const allowedHosts=new Set(['www.youtube.com','www.youtube-nocookie.com']);
 const parsed=new DOMParser().parseFromString(String(record.content_html||''),'text/html');
 const iframeSources=[...parsed.querySelectorAll('iframe[src]')].map(frame=>safeExternalUrl(frame.getAttribute('src'),allowedHosts)).filter(Boolean);
 const seen=new Set();
 let count=0;
 iframeSources.forEach(src=>{
  const key=new URL(src).origin+new URL(src).pathname;
  if(seen.has(key))return;
  seen.add(key);
  const frame=document.createElement('iframe');
  frame.className='ha-chamber-video-frame';
  frame.src=src;
  frame.title=record.title+' — video';
  frame.loading='lazy';
  frame.referrerPolicy='strict-origin-when-cross-origin';
  frame.allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
  frame.allowFullscreen=true;
  section.append(frame);count++;
 });
 const videos=mediaReady?uniqueRecordMedia(record,'video/'): [];
 videos.forEach(item=>{
  const figure=makeChamberNode('figure','ha-local-media ha-local-video');
  const video=document.createElement('video');video.controls=true;video.preload='metadata';video.playsInline=true;video.src=localMediaUrl(item);
  video.setAttribute('aria-label','Video: '+mediaTitle(item,record));figure.append(video);
  const caption=makeChamberNode('figcaption','',mediaTitle(item,record));figure.append(caption);section.append(figure);count++;
 });
 if(!count)section.append(makeChamberNode('p','ha-chamber-note','No recovered video output is attached to this record.'));
}
function appendChamberOutput(record,grid,structure){
 const output=makeChamberNode('section','ha-chamber-panel ha-chamber-output');
 output.append(makeChamberNode('h3','ha-chamber-panel-heading','03 // OUTPUT'));
 const textSection=makeChamberNode('section','ha-chamber-output-section');
 textSection.append(makeChamberNode('h4','ha-chamber-output-label','TEXT'));
 textSection.append(makeChamberNode('div','ha-chamber-text',structure.output_text||'No output text has been saved for this record yet.'));
 output.append(textSection);
 const images=uniqueRecordMedia(record,'image/');
 const imageSection=makeChamberNode('section','ha-chamber-output-section');
 imageSection.append(makeChamberNode('h4','ha-chamber-output-label','IMAGE'));
 if(mediaReady&&images.length){
  const gallery=makeChamberNode('div','ha-chamber-media-grid');images.forEach(item=>appendLocalImage(gallery,item,record,new Set()));imageSection.append(gallery);
 }else imageSection.append(makeChamberNode('p','ha-chamber-note',mediaReady?'No recovered image output is attached to this record.':'IMAGE OUTPUT // MEDIA VAULT NOT VERIFIED'));
 output.append(imageSection);
 const audio=uniqueRecordMedia(record,'audio/');
 const audioSection=makeChamberNode('section','ha-chamber-output-section');
 audioSection.append(makeChamberNode('h4','ha-chamber-output-label','AUDIO'));
 if(mediaReady&&audio.length){
  const gallery=makeChamberNode('div','ha-chamber-audio-list');audio.forEach(item=>appendLocalAudio(gallery,item,record,new Set()));audioSection.append(gallery);
 }else audioSection.append(makeChamberNode('p','ha-chamber-note',mediaReady?'No recovered audio output is attached to this record.':'AUDIO OUTPUT // MEDIA VAULT NOT VERIFIED'));
 output.append(audioSection);
 const videoSection=makeChamberNode('section','ha-chamber-output-section');
 videoSection.append(makeChamberNode('h4','ha-chamber-output-label','VIDEO'));
 appendChamberVideoOutput(videoSection,record);output.append(videoSection);
 grid.append(output);
}
function renderRecordStructureView(record,grid,layoutLabel){
 const structure=getRecordStructure(record);
 grid.replaceChildren();
 const prompt=makeChamberNode('section','ha-chamber-panel');
 prompt.append(makeChamberNode('h3','ha-chamber-panel-heading','01 // PROMPT STYLE'));
 prompt.append(makeChamberNode('div','ha-chamber-structure-text',structure.prompt_style||'No prompt style has been saved for this record yet.'));
 grid.append(prompt);
 const lyrics=makeChamberNode('section','ha-chamber-panel');
 lyrics.append(makeChamberNode('h3','ha-chamber-panel-heading','02 // LYRICS STYLE'));
 lyrics.append(makeChamberNode('div','ha-chamber-structure-text',structure.lyrics_style||'No lyrics-style notes have been saved for this record yet.'));
 grid.append(lyrics);
 appendChamberOutput(record,grid,structure);
 layoutLabel.textContent='LAYOUT // SUNO LYRICS + STYLE BREAKDOWN';
}
function renderRecordStructureEditor(record,grid,layoutLabel,status,editButton){
 const structure=getRecordStructure(record);
 grid.replaceChildren();
 layoutLabel.textContent='EDIT MODE // SUNO LYRICS + STYLE BREAKDOWN';
 const fields=[
  ['prompt_style','01 // PROMPT STYLE',structure.prompt_style,'Paste or write the AI / Suno style prompt…'],
  ['lyrics_style','02 // LYRICS STYLE',structure.lyrics_style,'Add lyric instructions, structure, vocal direction or generation notes…'],
  ['output_text','03 // OUTPUT — TEXT',structure.output_text,'Edit the original text output…']
 ];
 const controls={};
 fields.forEach(([key,label,value,placeholder])=>{
  const panel=makeChamberNode('section','ha-chamber-panel ha-chamber-edit-panel');
  panel.append(makeChamberNode('h3','ha-chamber-panel-heading',label));
  const area=document.createElement('textarea');area.className='ha-chamber-editor-field';area.name=key;area.rows=key==='output_text'?14:9;area.value=value;area.placeholder=placeholder;
  panel.append(area);grid.append(panel);controls[key]=area;
 });
 const actions=makeChamberNode('div','ha-chamber-editor-actions');
 const save=makeChamberNode('button','ha-chamber-save','SAVE STRUCTURE');save.type='button';
 const cancel=makeChamberNode('button','ha-chamber-cancel','CANCEL');cancel.type='button';
 actions.append(save,cancel);grid.append(actions);
 cancel.addEventListener('click',()=>{status.textContent='';renderRecordStructureView(record,grid,layoutLabel);});
 save.addEventListener('click',async()=>{
  if(!archiveAdmin||!archiveSupabase||!archiveUserId){status.textContent='ADMIN SESSION REQUIRED';return;}
  save.disabled=true;cancel.disabled=true;save.textContent='SAVING…';status.textContent='Saving your structure…';
  const row={
   record_id:Number(record.id),
   prompt_style:controls.prompt_style.value,
   lyrics_style:controls.lyrics_style.value,
   output_text:controls.output_text.value,
   updated_at:new Date().toISOString(),
   updated_by:archiveUserId
  };
  try{
   const {error}=await archiveSupabase.from('human_archive_record_structures').upsert(row,{onConflict:'record_id'});
   if(error)throw error;
   recordStructureOverrides.set(String(record.id),row);
   status.textContent='STRUCTURE SAVED';
   renderRecordStructureView(record,grid,layoutLabel);
   editButton.hidden=!archiveAdmin;
  }catch(error){
   console.error('Human Archive structure could not be saved:',error);
   status.textContent='SAVE FAILED — '+String(error.message||'PLEASE TRY AGAIN');
   save.disabled=false;cancel.disabled=false;save.textContent='SAVE STRUCTURE';
  }
 });
}
function buildRecordChamber(record){
 const shell=makeChamberNode('div','ha-chamber-shell');
 const header=makeChamberNode('header','ha-chamber-header');
 const topbar=makeChamberNode('div','ha-chamber-topbar');
 topbar.append(makeChamberNode('span','ha-chamber-mark','EGO // HUMAN ARCHIVE'));
 const actions=makeChamberNode('div','ha-chamber-topbar-actions');
 const edit=makeChamberNode('button','ha-chamber-edit','EDIT STRUCTURE');
 edit.type='button';edit.hidden=!archiveAdmin;
 const close=makeChamberNode('button','ha-chamber-close','CLOSE ✕');close.type='button';close.setAttribute('aria-label','Close record chamber');
 actions.append(edit,close);topbar.append(actions);
 const heading=makeChamberNode('div','ha-chamber-heading');
 const meta=makeChamberNode('p','ha-chamber-meta','HA-'+record.year+'-'+String(record.id).padStart(4,'0')+' // '+record.date+' // '+(record.categories||[]).join(' / '));
 const title=makeChamberNode('h2','',record.title);
 heading.append(meta,title);header.append(topbar,heading);
 const main=makeChamberNode('main','ha-chamber-main');
 const shareRow=makeChamberNode('div','ha-chamber-share-row');
 const share=makeChamberNode('div','ha-chamber-share','');
 const shareStatus=makeChamberNode('span','ha-chamber-share-status','');
 appendChamberShareActions(share,record,shareStatus);shareRow.append(share,shareStatus);main.append(shareRow);
 const layoutLabel=makeChamberNode('p','ha-chamber-layout-label','LAYOUT // SUNO LYRICS + STYLE BREAKDOWN');
 main.append(layoutLabel);
 const grid=makeChamberNode('div','ha-chamber-grid');main.append(grid);
 renderRecordStructureView(record,grid,layoutLabel);
 edit.addEventListener('click',()=>renderRecordStructureEditor(record,grid,layoutLabel,shareStatus,edit));
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
 if(String(record.id)!==CHAMBER_RECORD_ID)return;
 const dialog=ensureRecordChamber();
 if(dialog.open)dialog.close();
 dialog.replaceChildren(buildRecordChamber(record));
 recordChamberReturnFocus=trigger||null;
 const url=new URL(window.location.href);url.searchParams.set('record',String(record.id));
 history.replaceState(history.state,'',url.pathname+url.search+url.hash);
 document.body.classList.add('ha-chamber-open');
 try{dialog.showModal();}catch(error){document.body.classList.remove('ha-chamber-open');console.error('Could not open the Human Archive chamber:',error);}
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
 await Promise.all([loadArchiveFavorites(),loadRecordStructureOverrides(),refreshArchiveAdmin()]);
 if(!archiveAuthBound){
  archiveAuthBound=true;
  archiveSupabase.auth.onAuthStateChange((_event,session)=>{
   window.setTimeout(async()=>{
    await refreshArchiveAdmin(session);
    render();
    syncFavoriteControls();
    if(recordChamber?.open){
     const record=records.find(item=>String(item.id)===CHAMBER_RECORD_ID);
     if(record)openArchiveRecordChamber(record,null);
    }
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
 const body=document.createElement('div');body.className='ha-entry-body';const used=new Set();
 if(String(record.id)===CHAMBER_RECORD_ID){
  const quickActions=makeChamberNode('div','ha-entry-quick-actions');
  const chamber=makeChamberNode('button','ha-entry-chamber','ENTER THE CHAMBER ↗');chamber.type='button';chamber.addEventListener('click',()=>openArchiveRecordChamber(record,chamber));
  const favorite=makeChamberNode('button','ha-favorite-toggle','☆');favorite.type='button';favorite.dataset.haFavoriteId=CHAMBER_RECORD_ID;favorite.hidden=!archiveAdmin&&!favoriteRecordIds.has(CHAMBER_RECORD_ID);favorite.setAttribute('aria-pressed',String(favoriteRecordIds.has(CHAMBER_RECORD_ID)));favorite.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();toggleArchiveFavorite(record.id,favorite);});
  quickActions.append(chamber,favorite);
  appendSafeContent(body,record.content_html||'',record,used);
  if(!body.childNodes.length){const message=document.createElement('p');message.textContent='No local text was captured for this entry.';body.append(message);}
  content.append(body);
  // The same recovered attachments are shown inside the full-screen chamber; avoid a second inline copy on the pilot card.
  wrapper.append(link,quickActions,content);
  return wrapper;
 }
 appendSafeContent(body,record.content_html||'',record,used);
 if(!body.childNodes.length){const message=document.createElement('p');message.textContent='No local text was captured for this entry.';body.append(message);}
 content.append(body);
 const gallery=mediaReady?makeAttachmentGallery(record,used):null;if(gallery)content.append(gallery);
 wrapper.append(link,content);return wrapper;
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
search.addEventListener('input',render);year.addEventListener('change',render);category.addEventListener('change',render);init();
})();