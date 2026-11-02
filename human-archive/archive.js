(()=>{'use strict';
const search=document.getElementById('ha-search'),year=document.getElementById('ha-year'),category=document.getElementById('ha-category'),list=document.getElementById('ha-list'),count=document.getElementById('ha-count');
let records=[];const expandedCategories=new Set();
const categoryOrder=['Nimic și Ființă','This notion','Dialog monolog','Gânduri','Cântec','Belief','Snob','PERSONAL PROJECTS','Haiku'];
const clean=value=>String(value??'').normalize('NFKC').toLocaleLowerCase().trim();
function makeEntry(record,index){
 let url='';try{const parsed=new URL(record.url);if(parsed.protocol==='https:'&&parsed.hostname==='emanuelstefancu.wordpress.com')url=parsed.href}catch{}if(!url)return null;
 const link=document.createElement('a');link.className='ha-entry';link.href=url;link.target='_blank';link.rel='noopener noreferrer';link.setAttribute('aria-label','Open original record: '+record.title+', '+record.date);
 const top=document.createElement('div');top.className='ha-entry-top';const code=document.createElement('small');code.className='ha-entry-code';code.textContent='HA-'+record.year+'-'+String(record.id).padStart(4,'0');const yr=document.createElement('span');yr.className='ha-entry-year';yr.textContent=record.year;top.append(code,yr);
 const title=document.createElement('strong');title.textContent=record.title;const bottom=document.createElement('div');bottom.className='ha-entry-bottom';const date=document.createElement('small');date.textContent=record.date+' // ORIGINAL RECORD';const action=document.createElement('span');action.textContent='READ ORIGINAL ↗';bottom.append(date,action);link.append(top,title,bottom);link.style.setProperty('--entry-order',String(index));return link;
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
  const response=await fetch('archive-data.json',{credentials:'same-origin',cache:'no-store'});if(!response.ok)throw new Error('Archive index unavailable');const data=await response.json();if(!Array.isArray(data))throw new Error('Invalid archive index');
  records=data.filter(r=>r&&typeof r.title==='string'&&typeof r.year==='string'&&typeof r.date==='string'&&Number.isFinite(Number(r.id))&&typeof r.url==='string'&&Array.isArray(r.categories));
  categoryOrder.filter(name=>records.some(r=>r.categories.includes(name))).forEach(name=>{expandedCategories.add(name);const option=document.createElement('option');option.value=name;option.textContent=name;category.append(option)});render();
 }catch(error){console.error('Human Archive index failed:',error);list.textContent='THE INDEX COULD NOT BE LOADED. THE ORIGINAL WORDPRESS ARCHIVE REMAINS AVAILABLE BELOW.';count.textContent='INDEX OFFLINE';}
}
search.addEventListener('input',render);year.addEventListener('change',render);category.addEventListener('change',render);init();
})();