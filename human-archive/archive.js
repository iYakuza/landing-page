(()=>{'use strict';
  const search=document.getElementById('ha-search');
  const year=document.getElementById('ha-year');
  const list=document.getElementById('ha-list');
  const count=document.getElementById('ha-count');
  let records=[];
  const clean=value=>String(value??'').normalize('NFKC').toLocaleLowerCase().trim();
  function render(){
    const query=clean(search.value),selectedYear=year.value;
    const filtered=records.filter(record=>
      (!selectedYear||record.year===selectedYear)&&
      (!query||[record.title,record.year,record.date,record.id].some(value=>clean(value).includes(query)))
    ).slice().reverse();
    count.textContent=filtered.length+' / '+records.length+' RECORDS';
    list.replaceChildren();
    if(!filtered.length){
      const empty=document.createElement('p');
      empty.className='ha-empty';
      empty.textContent='NO RECORDS MATCH THIS SEARCH. TRY ANOTHER WORD OR YEAR.';
      list.append(empty);return;
    }
    const fragment=document.createDocumentFragment();
    filtered.forEach((record,index)=>{
      const url=(()=>{try{const parsed=new URL(record.url);return parsed.protocol==='https:'&&parsed.hostname==='emanuelstefancu.wordpress.com'?parsed.href:''}catch{return ''}})();
      if(!url)return;
      const link=document.createElement('a');
      link.className='ha-entry';
      link.href=url;link.target='_blank';link.rel='noopener noreferrer';
      link.setAttribute('aria-label','Open original record: '+record.title+', '+record.date);
      const top=document.createElement('div');top.className='ha-entry-top';
      const code=document.createElement('small');code.className='ha-entry-code';
      code.textContent='HA-'+record.year+'-'+String(record.id).padStart(4,'0');
      const yearMark=document.createElement('span');yearMark.className='ha-entry-year';yearMark.textContent=record.year;
      top.append(code,yearMark);
      const title=document.createElement('strong');title.textContent=record.title;
      const bottom=document.createElement('div');bottom.className='ha-entry-bottom';
      const date=document.createElement('small');date.textContent=record.date+' // ORIGINAL RECORD';
      const action=document.createElement('span');action.textContent='READ ORIGINAL ↗';
      bottom.append(date,action);link.append(top,title,bottom);
      link.style.setProperty('--entry-order',String(index));
      fragment.append(link);
    });
    list.append(fragment);
  }
  async function init(){
    try{
      const response=await fetch('archive-data.json',{credentials:'same-origin'});
      if(!response.ok)throw new Error('Archive index unavailable');
      const data=await response.json();
      if(!Array.isArray(data))throw new Error('Archive index format is invalid');
      records=data.filter(record=>record&&typeof record.title==='string'&&typeof record.year==='string'&&typeof record.date==='string'&&Number.isFinite(Number(record.id))&&typeof record.url==='string');
      render();
    }catch(error){
      console.error('Human Archive index failed:',error);
      list.textContent='THE INDEX COULD NOT BE LOADED. THE ORIGINAL WORDPRESS ARCHIVE REMAINS AVAILABLE BELOW.';
      count.textContent='INDEX OFFLINE';
    }
  }
  search.addEventListener('input',render);
  year.addEventListener('change',render);
  init();
})();