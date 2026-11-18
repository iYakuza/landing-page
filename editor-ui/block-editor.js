(() => {
  'use strict';

  const EMBED_HOSTS = new Set(['www.youtube.com','www.youtube-nocookie.com','youtu.be','open.spotify.com','w.soundcloud.com','player.vimeo.com','vimeo.com','www.tiktok.com','www.instagram.com','www.facebook.com','www.dailymotion.com','www.x.com','platform.twitter.com','www.google.com']);
  const IMAGE_HOSTS = new Set(['oeyxsqocldlovhsmzcjw.supabase.co','i0.wp.com','emanuelstefancu.wordpress.com']);
  const MEDIA_HOSTS = new Set(['oeyxsqocldlovhsmzcjw.supabase.co']);
  const TYPES = [
    ['paragraph','Paragraph'],['heading','Heading'],['unordered-list','List'],['ordered-list','Numbered list'],
    ['quote','Quote'],['pullquote','Pullquote'],['verse','Verse'],['preformatted','Preformatted'],['code','Code'],
    ['details','Details / Accordion'],['table','Table'],['buttons','Buttons'],['columns','Columns'],['group','Group'],
    ['row','Row'],['stack','Stack'],['spacer','Spacer'],['separator','Separator'],
    ['image','Image'],['gallery','Gallery'],['cover','Cover'],['audio','Audio'],['video','Video'],
    ['file','File download'],['embed','Embed'],['html','Custom HTML']
  ];

  function safeURL(value, hosts) {
    try {
      const url = new URL(String(value || '').trim());
      const host=url.hostname.toLowerCase();
      const allowed=hosts.has(host)||[...hosts].some(entry=>entry.startsWith('*.')&&host.endsWith(entry.slice(1)));
      if (url.protocol !== 'https:' || !host || url.username || url.password || !allowed) return '';
      if (url.hostname.toLowerCase() === 'oeyxsqocldlovhsmzcjw.supabase.co' &&
          !/^\/storage\/v1\/object\/public\/(vha-post-media|poetry-media)\//.test(url.pathname)) return '';
      return url.href;
    } catch { return ''; }
  }

  function blockType(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return 'paragraph';
    const tag=node.tagName;
    if (/^H[1-4]$/.test(tag)) return 'heading';
    if (tag==='DIV'||tag==='SECTION'||tag==='ASIDE') return 'classic';
    if(tag==='UL')return 'unordered-list'; if(tag==='OL')return 'ordered-list';
    if(tag==='PRE'&&node.querySelector('code'))return 'code'; if(tag==='PRE')return 'preformatted';
    if(tag==='BLOCKQUOTE')return 'quote'; if(tag==='HR')return 'separator';
    if(tag==='FIGURE'&&node.querySelector('iframe'))return 'embed';
    if(tag==='FIGURE'&&node.querySelector('img'))return 'image';
    if(tag==='IMG'||node.querySelector?.('img'))return 'image';
    if(tag==='AUDIO'||node.querySelector?.('audio'))return 'audio';
    if(tag==='VIDEO'||node.querySelector?.('video'))return 'video';
    if(tag==='IFRAME'||node.querySelector?.('iframe'))return 'embed';
    if(tag==='TABLE')return 'table'; if(tag==='DETAILS')return 'details';
    if(tag==='BUTTON'||node.querySelector?.('a.ha-editor-button'))return 'buttons';
    return 'paragraph';
  }

  function makeBlock(type, html) {
    const block = document.createElement('section');
    block.className = 'ha-editor-block';
    block.dataset.haBlock = type;
    block.setAttribute('data-ha-editor-block','');

    const controls = document.createElement('div');
    controls.className = 'ha-editor-block-controls';
    controls.innerHTML = '<span class="ha-editor-block-grip" aria-hidden="true">⠿</span><span class="ha-editor-block-name"></span><div class="ha-editor-block-actions"></div>';

    const content = document.createElement('div');
    content.className = 'ha-editor-block-content';
    content.dataset.haBlockContent = '';
    content.innerHTML = html;
    if (['separator','image','gallery','cover','audio','video','file','embed','spacer'].includes(type)) content.contentEditable = 'false';
    else content.contentEditable = 'true';

    const footer = document.createElement('div');
    footer.className = 'ha-editor-block-footer';
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'ha-editor-add-after';
    add.textContent = '+';
    add.title = 'Insert block after';
    add.setAttribute('aria-label','Insert block after this block');
    footer.append(add);

    block.append(controls,content,footer);
    return block;
  }

  function defaultHTML(type) {
    switch(type) {
      case 'heading': return '<h2>Heading</h2>';
      case 'unordered-list': return '<ul><li>List item</li></ul>';
      case 'ordered-list': return '<ol><li>List item</li></ol>';
      case 'quote': return '<blockquote><p>Write a quote…</p></blockquote>';
      case 'pullquote': return '<figure class="wp-block-pullquote"><blockquote><p>Write a featured quotation…</p></blockquote><figcaption>Source</figcaption></figure>';
      case 'verse': return '<pre class="wp-block-verse">Write verse…</pre>';
      case 'preformatted': return '<pre>Write preformatted text…</pre>';
      case 'code': return '<pre><code>Write code…</code></pre>';
      case 'details': return '<details><summary>Details heading</summary><p>Additional content…</p></details>';
      case 'table': return '<table><thead><tr><th>Heading</th><th>Heading</th></tr></thead><tbody><tr><td>Cell</td><td>Cell</td></tr></tbody></table>';
      case 'buttons': return '<p><a class="ha-editor-button" href="https://example.com">Button text</a></p>';
      case 'columns': return '<div class="wp-block-columns"><div class="wp-block-column"><p>Column one…</p></div><div class="wp-block-column"><p>Column two…</p></div></div>';
      case 'group': return '<div class="wp-block-group"><p>Group content…</p></div>';
      case 'row': return '<div class="wp-block-group is-layout-flex"><p>First item</p><p>Second item</p></div>';
      case 'stack': return '<div class="wp-block-group is-layout-flow"><p>First item</p><p>Second item</p></div>';
      case 'spacer': return '<div class="wp-block-spacer" style="height:48px" aria-hidden="true"></div>';
      case 'separator': return '<hr>';
      case 'html': return '<pre><code>Paste safe HTML in the code editor…</code></pre>';
      default: return '<p><br></p>';
    }
  }

  function mountBlockEditor({ editor, onChange = () => {}, readOnly = false } = {}) {
    if (!(editor instanceof HTMLElement)) throw new TypeError('A block editor canvas is required.');
    if (editor.dataset.haBlockEditorMounted === 'true') return editor.__haBlockEditor || null;
    editor.dataset.haBlockEditorMounted = 'true';
    editor.classList.add('ha-block-editor-canvas');
    editor.setAttribute('role','region');
    editor.setAttribute('aria-label',editor.getAttribute('aria-label') || 'Block editor canvas');
    editor.contentEditable = 'false';

    const shell = document.createElement('div');
    shell.className = 'ha-block-editor-shell';
    const topbar = document.createElement('div');
    topbar.className = 'ha-block-editor-topbar';
    const addTop = document.createElement('button');
    addTop.type = 'button'; addTop.className = 'ha-editor-inserter';
    addTop.innerHTML = '<span aria-hidden="true">＋</span> Add block';
    const hint = document.createElement('span');
    hint.className = 'ha-block-editor-hint';
    hint.textContent = 'Type / to insert a block';
    topbar.append(addTop,hint);
    editor.parentNode.insertBefore(shell,editor);
    shell.append(topbar,editor);

    let selected = null;
    let menu = null;
    let syncing = false;
    const listeners = new AbortController();

    const labelFor = type => TYPES.find(item => item[0] === type)?.[1] || 'Classic';
    const blocks = () => [...editor.querySelectorAll(':scope > [data-ha-editor-block]')];

    function setSelected(block) {
      if (selected) selected.classList.remove('is-selected');
      selected = block || null;
      if (selected) selected.classList.add('is-selected');
    }

    function sync() {
      if (syncing) return;
      syncing = true;
      editor.dispatchEvent(new CustomEvent('ha-block-change',{bubbles:true}));
      onChange();
      syncing = false;
    }

    function closeMenu() {
      menu?.remove(); menu = null;
    }

    function insertMedia(type, block) {
      const ask=label=>window.prompt(label);
      const imageHosts=new Set([...IMAGE_HOSTS,'*.files.wordpress.com','*.wp.com']);
      const mediaHosts=new Set([...MEDIA_HOSTS,'*.files.wordpress.com']);
      const raw=ask(type==='html'?'Paste HTML to insert (unsafe elements and attributes are removed)':type==='gallery'?'Image URLs (one per line or comma-separated)':type==='cover'?'Cover image URL':type==='image'?'Image URL':type==='audio'?'Audio file URL':type==='video'?'Video file URL':type==='file'?'File download URL':'Paste a YouTube, Spotify, SoundCloud, Vimeo, TikTok, Instagram, Facebook or Dailymotion URL');
      if(!raw)return;
      let html='';
      if(type==='html'){
        const parsed=new DOMParser().parseFromString(raw,'text/html');
        parsed.querySelectorAll('script,style,object,embed,form,input,button,textarea,select,option,svg,math,link,meta').forEach(node=>node.remove());
        const allowed=new Set(['P','BR','STRONG','B','EM','I','U','S','DEL','H1','H2','H3','H4','UL','OL','LI','BLOCKQUOTE','HR','PRE','CODE','A','FIGURE','FIGCAPTION','IMG','AUDIO','VIDEO','SOURCE','IFRAME','TABLE','THEAD','TBODY','TR','TH','TD','DETAILS','SUMMARY','DIV','SPAN']);
        parsed.body.querySelectorAll('*').forEach(node=>{
          if(!allowed.has(node.tagName)){node.replaceWith(...node.childNodes);return;}
          [...node.attributes].forEach(attr=>{
            const name=attr.name.toLowerCase();
            if(name.startsWith('on')||['srcdoc','srcset','contenteditable'].includes(name))node.removeAttribute(attr.name);
            else if(name==='href'){try{const u=new URL(attr.value);if(!((u.protocol==='https:'&&u.hostname&&!u.username&&!u.password)||(u.protocol==='mailto:'&&u.pathname)))node.removeAttribute(attr.name);}catch{node.removeAttribute(attr.name);}}
            else if(name==='src'){const hosts=node.tagName==='IMG'?new Set([...IMAGE_HOSTS,'*.files.wordpress.com','*.wp.com']):['AUDIO','VIDEO','SOURCE'].includes(node.tagName)?mediaHosts:node.tagName==='IFRAME'?EMBED_HOSTS:null;const safe=hosts&&safeURL(attr.value,hosts);if(safe)node.setAttribute('src',safe);else node.removeAttribute(attr.name);}
            else if(!['alt','title','class','width','height','controls','preload','target','rel','allow','allowfullscreen','loading','style'].includes(name))node.removeAttribute(attr.name);
          });
        });
        html=parsed.body.innerHTML;
        if(!html.trim())return window.alert('No supported HTML elements were found.');
      } else if(['image','gallery','cover'].includes(type)){
        const urls=(type==='gallery'?raw.split(/[\n,]+/):[raw]).map(value=>safeURL(value,imageHosts)).filter(Boolean);
        if(!urls.length)return window.alert('Use a secure image URL from the archive media library or a supported WordPress media host.');
        const figures=urls.map((src,index)=>{
          const alt=window.prompt('Alternative text for image '+(index+1)+' (optional)','')||'';
          const figure=document.createElement('figure'),img=document.createElement('img');
          img.src=src;img.alt=alt;img.loading='lazy';figure.append(img);
          if(type!=='cover'){const caption=document.createElement('figcaption');caption.textContent=window.prompt('Caption for image '+(index+1)+' (optional)','')||'';if(caption.textContent)figure.append(caption);}
          return figure.outerHTML;
        });
        html=type==='gallery'?'<div class="wp-block-gallery">'+figures.join('')+'</div>':type==='cover'?'<div class="wp-block-cover" style="background-image:url(&quot;'+urls[0]+'&quot;)"><img src="'+urls[0]+'" alt=""><p class="wp-block-cover-text">Write title…</p></div>':figures[0];
      } else if(['audio','video','file'].includes(type)){
        const src=safeURL(raw,mediaHosts);
        if(!src)return window.alert('Use a secure URL from the Human Archive media library or a supported WordPress media host.');
        if(new URL(src).hostname==='oeyxsqocldlovhsmzcjw.supabase.co'&&type!=='file'&&!new URL(src).pathname.startsWith('/storage/v1/object/public/vha-post-media/'))return window.alert('That file is outside the Human Archive media bucket.');
        if(type==='audio')html='<figure class="wp-block-audio"><audio controls preload="metadata" src="'+src+'"></audio></figure>';
        else if(type==='video')html='<figure class="wp-block-video"><video controls playsinline preload="metadata" src="'+src+'"></video></figure>';
        else html='<div class="wp-block-file"><a href="'+src+'" target="_blank" rel="noopener noreferrer">Download file</a></div>';
      } else {
        let url;try{url=new URL(raw.trim());}catch{return window.alert('Enter a valid embed URL.');}
        const host=url.hostname.toLowerCase();
        if(host==='youtu.be'){const id=url.pathname.slice(1).split('/')[0];if(!/^[\w-]{6,20}$/.test(id))return window.alert('Invalid YouTube URL.');url=new URL('https://www.youtube-nocookie.com/embed/'+id);}
        else if(host==='www.youtube.com'&&url.pathname==='/watch'){const id=url.searchParams.get('v');if(!id||!/^[\w-]{6,20}$/.test(id))return window.alert('Invalid YouTube URL.');url=new URL('https://www.youtube-nocookie.com/embed/'+id);}
        else if(host==='www.youtube.com'&&url.pathname.startsWith('/shorts/')){const id=url.pathname.split('/')[2];if(!/^[\w-]{6,20}$/.test(id))return window.alert('Invalid YouTube URL.');url=new URL('https://www.youtube-nocookie.com/embed/'+id);}
        else if(host==='open.spotify.com'&&!url.pathname.startsWith('/embed/'))url.pathname='/embed'+url.pathname;
        else if(host==='soundcloud.com'||host==='www.soundcloud.com'){url=new URL('https://w.soundcloud.com/player/?url='+encodeURIComponent(url.href));}
        else if(host==='vimeo.com'){const id=url.pathname.split('/').filter(Boolean)[0];if(!/^\d+$/.test(id||''))return window.alert('Invalid Vimeo URL.');url=new URL('https://player.vimeo.com/video/'+id);}
        else if(host==='www.dailymotion.com'){const id=url.pathname.match(/video\/([a-zA-Z0-9]+)/)?.[1];if(!id)return window.alert('Invalid Dailymotion URL.');url=new URL('https://www.dailymotion.com/embed/video/'+id);}
        else if(host==='www.tiktok.com'&&!url.pathname.startsWith('/embed/'))return window.alert('Use the TikTok embed URL copied from Share → Embed.');
        else if(host==='www.instagram.com'&&!url.pathname.endsWith('/embed/'))url.pathname=url.pathname.replace(/\/$/,'')+'/embed/';
        else if(host==='www.x.com'||host==='twitter.com'){const match=url.pathname.split('/');const status=match.indexOf('status');const id=status>=0?match[status+1]:'';if(!/^\\d+$/.test(id||''))return window.alert('Open a specific X post URL to embed it.');url=new URL('https://platform.twitter.com/embed/Tweet.html?id='+id);}
        const src=safeURL(url.href,EMBED_HOSTS);
        if(!src)return window.alert('That embed URL is not supported.');
        html='<figure class="wp-block-embed"><iframe src="'+src+'" title="Embedded media" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></figure>';
      }
      const next=makeBlock(type,html);if(block)block.after(next);else editor.append(next);
      wireBlock(next);setSelected(next);focusBlock(next);sync();
    }

    function focusBlock(block) {
      const target = block?.querySelector('[data-ha-block-content][contenteditable="true"]');
      if (!target) return;
      target.focus();
      const editableBlocks=target.querySelectorAll('p,h1,h2,h3,h4,li,pre,blockquote');
      const caretTarget=editableBlocks[editableBlocks.length-1]||target;
      const range = document.createRange();
      range.selectNodeContents(caretTarget);
      range.collapse(false);
      const selection = window.getSelection();
      selection.removeAllRanges(); selection.addRange(range);
    }

    function createMenu(anchor, block) {
      closeMenu();
      menu = document.createElement('div');
      menu.className = 'ha-block-inserter-menu';
      menu.setAttribute('role','menu');
      TYPES.forEach(([type,label]) => {
        const button = document.createElement('button');
        button.type = 'button'; button.textContent = label; button.setAttribute('role','menuitem');
        button.addEventListener('click',() => {
          closeMenu();
          if (['image','gallery','cover','audio','video','file','embed','html'].includes(type)) return insertMedia(type,block);
          const next = makeBlock(type,defaultHTML(type));
          if (block) block.after(next); else editor.append(next);
          wireBlock(next);setSelected(next); focusBlock(next); sync();
        });
        menu.append(button);
      });
      const anchorRect=anchor.getBoundingClientRect(),shellRect=shell.getBoundingClientRect();
      menu.style.left=Math.max(8,anchorRect.left-shellRect.left)+'px';
      menu.style.top=(anchorRect.bottom-shellRect.top+5)+'px';
      anchor.after(menu);
    }

    function addBlockControls(block) {
      const type = block.dataset.haBlock || 'paragraph';
      block.querySelector('.ha-editor-block-name').textContent = labelFor(type);
      const grip = block.querySelector('.ha-editor-block-grip');
      if(grip)grip.draggable=true;
      const actions = block.querySelector('.ha-editor-block-actions');
      actions.replaceChildren();
      const transform = document.createElement('select');
      transform.className = 'ha-editor-block-transform';
      transform.setAttribute('aria-label','Transform block');
      TYPES.filter(([key]) => !['image','gallery','cover','audio','video','file','embed','separator','spacer'].includes(key)).forEach(([key,label]) => {
        if(key==='heading'){
          [['h1','Heading 1'],['h2','Heading 2'],['h3','Heading 3'],['h4','Heading 4']].forEach(([value,text])=>{const option=document.createElement('option');option.value=value;option.textContent=text;transform.append(option);});
        }else{const option = document.createElement('option'); option.value=key; option.textContent=label; transform.append(option);}
      });
      const currentContent=block.querySelector('[data-ha-block-content]')?.firstElementChild;
      transform.value = /^H[1-4]$/.test(currentContent?.tagName||'') ? currentContent.tagName.toLowerCase() : (['image','gallery','cover','audio','video','file','embed','separator','spacer','classic'].includes(type) ? 'paragraph' : type==='heading'?'h2':type);
      transform.addEventListener('change',() => transformBlock(block,transform.value));
      if(['classic','image','gallery','cover','audio','video','file','embed','separator','spacer'].includes(type))transform.disabled=true;
      actions.append(transform);

      const up = document.createElement('button'); up.type='button'; up.textContent='↑'; up.title='Move block up'; up.setAttribute('aria-label','Move block up');
      up.addEventListener('click',() => { if(block.previousElementSibling){block.parentNode.insertBefore(block,block.previousElementSibling);sync();} });
      const down = document.createElement('button'); down.type='button'; down.textContent='↓'; down.title='Move block down'; down.setAttribute('aria-label','Move block down');
      down.addEventListener('click',() => { if(block.nextElementSibling){block.parentNode.insertBefore(block.nextElementSibling,block);sync();} });
      const duplicate = document.createElement('button'); duplicate.type='button'; duplicate.textContent='＋'; duplicate.title='Duplicate block'; duplicate.setAttribute('aria-label','Duplicate block');
      duplicate.addEventListener('click',() => { const copy=block.cloneNode(true); block.after(copy); wireBlock(copy); setSelected(copy); sync(); });
      const remove = document.createElement('button'); remove.type='button'; remove.textContent='×'; remove.title='Delete block'; remove.setAttribute('aria-label','Delete block');
      remove.addEventListener('click',() => {
        const next=block.nextElementSibling||block.previousElementSibling;
        block.remove();
        if (!blocks().length){const empty=makeBlock('paragraph','<p><br></p>');editor.append(empty);wireBlock(empty);setSelected(empty);}
        else setSelected(next); sync();
      });
      [up,down,duplicate,remove].forEach(button=>actions.append(button));
      block.querySelector('.ha-editor-add-after').addEventListener('click',event=>createMenu(event.currentTarget,block));
    }

    function transformBlock(block,type) {
      const current=block.querySelector('[data-ha-block-content]');
      const first=current?.firstElementChild;
      const plain=document.createElement('span');plain.textContent=current?.textContent||'';
      const inlineHTML=first&&['P','H1','H2','H3','H4'].includes(first.tagName)?first.innerHTML:plain.innerHTML;
      const quoteHTML=first?.tagName==='BLOCKQUOTE'?first.innerHTML:'<p>'+inlineHTML+'</p>';
      let html=inlineHTML;
      if(/^h[1-4]$/.test(type)) html='<'+type+'>'+inlineHTML+'</'+type+'>';
      else if(type==='paragraph') html='<p>'+inlineHTML+'</p>';
      else if(type==='quote') html='<blockquote>'+quoteHTML+'</blockquote>';
      else if(type==='preformatted'||type==='code') html=type==='code'?'<pre><code>'+plain.innerHTML+'</code></pre>':'<pre>'+plain.innerHTML+'</pre>';
      else if(type==='unordered-list') html='<ul><li>'+plain.innerHTML+'</li></ul>';
      else if(type==='ordered-list') html='<ol><li>'+plain.innerHTML+'</li></ol>';
      const next=makeBlock(/^h[1-4]$/.test(type)?'heading':type,html);
      block.replaceWith(next); wireBlock(next); setSelected(next); focusBlock(next); sync();
    }

    function wireBlock(block) {
      addBlockControls(block);
      block.addEventListener('focusin',()=>setSelected(block));
      block.addEventListener('click',event=>{ if(!event.target.closest('button,select'))setSelected(block); });
      block.addEventListener('dragstart',event=>{block.classList.add('is-dragging');event.dataTransfer?.setData('text/plain','ha-block');});
      block.addEventListener('dragend',()=>block.classList.remove('is-dragging'));
      block.addEventListener('dragover',event=>{if(event.dataTransfer?.types.includes('text/plain'))event.preventDefault();});
      block.addEventListener('drop',event=>{
        if(!event.dataTransfer?.types.includes('text/plain'))return;
        event.preventDefault();
        const dragging=editor.querySelector('.is-dragging');
        if(dragging&&dragging!==block){const rect=block.getBoundingClientRect();block.parentNode.insertBefore(dragging,event.clientY<rect.top+rect.height/2?block:block.nextSibling);sync();}
      });
      const content=block.querySelector('[data-ha-block-content]');
      if(content && content.contentEditable==='true') {
        content.addEventListener('paste',event=>{
          const html=event.clipboardData?.getData('text/html');
          if(!html)return;
          event.preventDefault();
          const pasted=new DOMParser().parseFromString(html,'text/html');
          pasted.querySelectorAll('script,style,object,embed,form,input,button,textarea,select,option,svg,math').forEach(node=>node.remove());
          pasted.querySelectorAll('*').forEach(node=>{
            [...node.attributes].forEach(attribute=>{
              const name=attribute.name.toLowerCase(),value=attribute.value||'';
              if(name.startsWith('on')||name==='srcdoc'||name==='srcset'||name==='contenteditable')node.removeAttribute(attribute.name);
              else if(name==='style'&&!/text-align\s*:\s*(left|center|right|justify)/i.test(value))node.removeAttribute(attribute.name);
              else if(name==='href'){
                try{const url=new URL(value);if(!((url.protocol==='https:'&&url.hostname&&!url.username&&!url.password)||(url.protocol==='mailto:'&&url.pathname)))node.removeAttribute(attribute.name);}catch{node.removeAttribute(attribute.name);}
              }else if(name==='src'){
                const hosts=node.tagName==='IMG'?IMAGE_HOSTS:['AUDIO','VIDEO','SOURCE'].includes(node.tagName)?MEDIA_HOSTS:node.tagName==='IFRAME'?EMBED_HOSTS:null;
                if(hosts){const safe=safeURL(value,hosts);const valid=safe&&(!['AUDIO','VIDEO','SOURCE'].includes(node.tagName)||new URL(safe).pathname.startsWith('/storage/v1/object/public/vha-post-media/'));if(valid)node.setAttribute('src',safe);else node.removeAttribute(attribute.name);}
                else node.removeAttribute(attribute.name);
              }
            });
            if(node.tagName==='IFRAME'){
              const url=new URL(node.getAttribute('src')||'https://invalid.local');
              const valid=(url.hostname.includes('youtube')&&url.pathname.startsWith('/embed/'))||(url.hostname==='open.spotify.com'&&url.pathname.startsWith('/embed/'))||(url.hostname==='w.soundcloud.com'&&url.pathname.startsWith('/player/'));
              if(!valid)node.remove();
            }
          });
          document.execCommand('insertHTML',false,pasted.body.innerHTML);
          sync();
        });
        content.addEventListener('input',()=>{
          const first=content.firstElementChild;
          if(first){const type=blockType(first);block.dataset.haBlock=type;block.querySelector('.ha-editor-block-name').textContent=labelFor(type);}
          sync();
        });
        content.addEventListener('keydown',event=>{
          if(event.key==='/' && !event.shiftKey && !event.ctrlKey && !event.metaKey && content.textContent.trim()==='') {
            event.preventDefault(); createMenu(content,block); return;
          }
          if(event.key==='Enter' && !event.shiftKey && !event.isComposing && !event.defaultPrevented &&
             !['PRE','CODE','LI'].includes(event.target.closest('li,pre,code')?.tagName||'')) {
            event.preventDefault();
            document.execCommand('insertParagraph');
            const split=[...content.children];
            if(split.length>1){
              const first=split.shift();content.replaceChildren(first);
              let anchor=block;
              split.forEach(node=>{let nextType=blockType(node),nextHTML=node.outerHTML;if((block.dataset.haBlock==='heading'&&nextType==='heading')||(block.dataset.haBlock==='quote'&&nextType==='quote')||(nextType==='classic'&&!node.classList.contains('suno-post-layout')&&!node.classList.contains('plain-post-layout'))){nextType='paragraph';nextHTML='<p>'+node.innerHTML+'</p>';}const next=makeBlock(nextType,nextHTML);anchor.after(next);wireBlock(next);anchor=next;});
              setSelected(anchor);focusBlock(anchor);
            }else{
              const next=makeBlock('paragraph','<p><br></p>');block.after(next);wireBlock(next);setSelected(next);focusBlock(next);
            }
            sync();
          } else if(event.key==='Enter' && event.shiftKey && !event.isComposing) {
            event.preventDefault(); document.execCommand('insertLineBreak'); sync();
          }
        });
      }
    }

    function normalizeNode(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        if (!node.nodeValue.trim()) return null;
        const p=document.createElement('p');p.textContent=node.nodeValue;return p;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return null;
      return node;
    }

    const original = [...editor.childNodes].map(normalizeNode).filter(Boolean);
    editor.replaceChildren();
    if (!original.length) original.push(document.createElement('p'));
    original.forEach(node=>{
      const type=blockType(node);
      const block=makeBlock(type,node.outerHTML || '<p><br></p>');
      editor.append(block); wireBlock(block);
    });

    addTop.addEventListener('click',()=>createMenu(addTop,null));
    shell.addEventListener('keydown',event=>{if(event.key==='Escape'&&menu){event.preventDefault();closeMenu();addTop.focus();}});
    document.addEventListener('pointerdown',event=>{if(menu&&!shell.contains(event.target))closeMenu();},{signal:listeners.signal});
    editor.addEventListener('focusin',event=>{
      const block=event.target.closest('[data-ha-editor-block]');
      if(block)setSelected(block);
    });
    editor.addEventListener('click',event=>{
      if(event.target===editor) setSelected(null);
    });

    if (readOnly) {
      shell.classList.add('is-read-only');
      topbar.hidden=true;
      blocks().forEach(block=>{
        block.querySelector('.ha-editor-block-controls')?.remove();
        block.querySelector('.ha-editor-block-footer')?.remove();
        const content=block.querySelector('[data-ha-block-content]');
        if(content)content.contentEditable='false';
      });
    } else {
      editor.addEventListener('input',sync);
    }

    const api = {
      getHTML() {
        const holder=document.createElement('div');
        blocks().forEach(block=>{
          const content=block.querySelector('[data-ha-block-content]');
          if(content){const clone=content.cloneNode(true);holder.append(...clone.childNodes);}
        });
        return holder.innerHTML;
      },
      getText() { return blocks().map(block=>{const content=block.querySelector('[data-ha-block-content]');const text=content?.innerText||'';return text.trim()|| (content?.querySelector('img,audio,video,iframe')?'media':'');}).filter(Boolean).join('\n\n'); },
      replaceHTML(html) { this.destroy(); editor.innerHTML=String(html||'<p><br></p>'); return mountBlockEditor({editor,onChange,readOnly}); },
      focus() { focusBlock(selected||blocks()[0]); },
      destroy() {
        listeners.abort();closeMenu();
        const html=this.getHTML();
        shell.replaceWith(editor);
        editor.classList.remove('ha-block-editor-canvas');
        delete editor.dataset.haBlockEditorMounted;
        editor.removeAttribute('role');
        editor.contentEditable='true';
        editor.innerHTML=html;
        delete editor.__haBlockEditor;
      }
    };
    editor.__haBlockEditor=api;
    return api;
  }

  window.VHABlockEditor = Object.freeze({ mountBlockEditor });
})();