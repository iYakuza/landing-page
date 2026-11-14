(()=>{'use strict';
const search=document.getElementById('ha-search'),year=document.getElementById('ha-year'),category=document.getElementById('ha-category'),list=document.getElementById('ha-list'),count=document.getElementById('ha-count');
let records=[];const expandedCategories=new Set();
const categoryOrder=['Nimic și Ființă','This notion','Dialog monolog','Gânduri','Cântec','Belief','Snob','PERSONAL PROJECTS','Haiku'];
const clean=value=>String(value??'').normalize('NFKC').toLocaleLowerCase().trim();
function appendSafeContent(container,source){
 const doc=new DOMParser().parseFromString(String(source||''),'text/html');
 const allowed=new Set(['P','BR','STRONG','B','EM','I','U','H2','H3','H4','UL','OL','LI','BLOCKQUOTE','HR','PRE','CODE','A']);
 const blocked=new Set(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','IMG','VIDEO','AUDIO','SOURCE','SVG','MATH','FORM','INPUT']);
 function copy(node,parent){
  if(node.nodeType===Node.TEXT_NODE){parent.append(document.createTextNode(node.nodeValue||''));return;}
  if(node.nodeType!==Node.ELEMENT_NODE||blocked.has(node.tagName))return;
  if(!allowed.has(node.tagName)){node.childNodes.forEach(child=>copy(child,parent));return;}
  const el=document.createElement(node.tagName.toLowerCase());
  if(node.tagName==='A'){
   const href=(node.getAttribute('href')||'').trim();
   try{const url=new URL(href);if(url.protocol==='https:'&&url.hostname&&!url.username&&!url.password){el.href=url.href;el.target='_blank';el.rel='noopener noreferrer';}}
   catch{}
  }
  node.childNodes.forEach(child=>copy(child,el));parent.append(el);
 }
 doc.body.childNodes.forEach(node=>copy(node,container));
}
function makeEntry(record,index){
 const wrapper=document.createElement('article');wrapper.className='ha-record-card';
 const content=document.createElement('div');content.className='ha-entry-content';content.id='ha-record-'+record.id;content.hidden=true;
 const link=document.createElement('a');link.className='ha-entry';link.href='#'+content.id;link.setAttribute('aria-controls',content.id);link.setAttribute('aria-expanded','false');link.setAttribute('aria-label','Read local archive record: '+record.title+', '+record.date);
 const top=document.createElement('div');top.className='ha-entry-top';const code=document.createElement('small');code.className='ha-entry-code';code.textContent='HA-'+record.year+'-'+String(record.id).padStart(4,'0');const yr=document.createElement('span');yr.className='ha-entry-year';yr.textContent=record.year;top.append(code,yr);
 const title=document.createElement('strong');title.textContent=record.title;const bottom=document.createElement('div');bottom.className='ha-entry-bottom';const date=document.createElement('small');date.textContent=record.date+' // LOCAL ARCHIVE COPY';const action=document.createElement('span');action.textContent='READ LOCAL TEXT ↓';bottom.append(date,action);link.append(top,title,bottom);link.style.setProperty('--entry-order',String(index));
 link.addEventListener('click',event=>{event.preventDefault();const open=content.hidden;content.hidden=!open;link.setAttribute('aria-expanded',String(open));action.textContent=open?'CLOSE LOCAL TEXT ↑':'READ LOCAL TEXT ↓';});
 const body=document.createElement('div');body.className='ha-entry-body';appendSafeContent(body,record.content_html||'');
 if(!body.childNodes.length){const message=document.createElement('p');message.textContent='No local text was captured for this entry.';body.append(message);}
 content.append(body);
 const sourceUrl=record.url||'';try{const parsed=new URL(sourceUrl);if(parsed.protocol==='https:'&&parsed.hostname==='emanuelstefancu.wordpress.com'){const source=document.createElement('a');source.className='ha-original-source';source.href=parsed.href;source.target='_blank';source.rel='noopener noreferrer';source.textContent='OPEN ORIGINAL WORDPRESS SOURCE ↗';content.append(source);}}catch{}
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
  const entries=document.createElement('div');entries.className='ha-category-entries';entries.hidden=!expandedCategories.has(name);items.forEach((r,i)=>{const card=makeEntry(r,i);if(card)entries.append(card)});toggle.addEventListener('click',()=>{const open=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(open));entries.hidden=!open;marker.textContent=open?'−':'+';if(open)expandedCategories.add(name);else expandedCategories.delete(name)});section.append(entries);fragment.append(section);
 });
 list.append(fragment);
}
async function init(){
 try{
  const [indexResponse,contentResponse]=await Promise.all([
   fetch('archive-data.json',{credentials:'same-origin',cache:'no-store'}),
   fetch('archive-content.json',{credentials:'same-origin',cache:'no-store'})
  ]);
  if(!indexResponse.ok||!contentResponse.ok)throw new Error('Local archive data unavailable');
  const [data,content]=await Promise.all([indexResponse.json(),contentResponse.json()]);
  if(!Array.isArray(data)||!Array.isArray(content.records)||content.record_count!==content.records.length)throw new Error('Invalid local archive data');
  const contentById=new Map(content.records.map(record=>[String(record.id),record]));
  records=data.filter(r=>r&&typeof r.title==='string'&&typeof r.year==='string'&&typeof r.date==='string'&&Number.isFinite(Number(r.id))&&typeof r.url==='string'&&Array.isArray(r.categories))
    .map(r=>({...r,content_html:contentById.get(String(r.id))?.content_html||''}));
  if(records.length!==content.record_count||records.some(r=>!contentById.has(String(r.id))))throw new Error('The local archive is incomplete');
  categoryOrder.filter(name=>records.some(r=>r.categories.includes(name))).forEach(name=>{expandedCategories.add(name);const option=document.createElement('option');option.value=name;option.textContent=name;category.append(option)});render();
 }catch(error){console.error('Human Archive local index failed:',error);list.textContent='THE LOCAL ARCHIVE COULD NOT BE LOADED. PLEASE TRY AGAIN LATER.';count.textContent='LOCAL ARCHIVE OFFLINE';}
}
search.addEventListener('input',render);year.addEventListener('change',render);category.addEventListener('change',render);init();
})();