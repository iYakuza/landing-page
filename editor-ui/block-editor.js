(() => {
  'use strict';

  const EMBED_HOSTS = new Set(['www.youtube.com','www.youtube-nocookie.com','open.spotify.com','w.soundcloud.com']);
  const IMAGE_HOSTS = new Set(['oeyxsqocldlovhsmzcjw.supabase.co','i0.wp.com','emanuelstefancu.wordpress.com']);
  const MEDIA_HOSTS = new Set(['oeyxsqocldlovhsmzcjw.supabase.co']);
  const TYPES = [
    ['paragraph','Paragraph'],['heading','Heading'],['unordered-list','Unordered list'],['ordered-list','Ordered list'],['quote','Quote'],
    ['preformatted','Preformatted'],['code','Code'],['separator','Separator'],
    ['image','Image'],['audio','Audio'],['video','Video'],['embed','Embed']
  ];

  function safeURL(value, hosts) {
    try {
      const url = new URL(String(value || '').trim());
      if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || !hosts.has(url.hostname.toLowerCase())) return '';
      if (url.hostname.toLowerCase() === 'oeyxsqocldlovhsmzcjw.supabase.co' &&
          !/^\/storage\/v1\/object\/public\/(vha-post-media|poetry-media)\//.test(url.pathname)) return '';
      return url.href;
    } catch { return ''; }
  }

  function blockType(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return 'paragraph';
    const tag = node.tagName;
    if (/^H[1-4]$/.test(tag)) return 'heading';
    if (tag === 'DIV' || tag === 'SECTION' || tag === 'ASIDE') return 'classic';
    if (tag === 'UL') return 'unordered-list';
    if (tag === 'OL') return 'ordered-list';
    if (tag === 'PRE' && node.querySelector('code')) return 'code';
    if (tag === 'BLOCKQUOTE') return 'quote';
    if (tag === 'PRE') return 'preformatted';
    if (tag === 'CODE') return 'code';
    if (tag === 'HR') return 'separator';
    if (tag === 'IMG' || node.querySelector?.('img')) return 'image';
    if (tag === 'AUDIO' || node.querySelector?.('audio')) return 'audio';
    if (tag === 'VIDEO' || node.querySelector?.('video')) return 'video';
    if (tag === 'IFRAME' || node.querySelector?.('iframe')) return 'embed';
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
    if (['separator','image','audio','video','embed'].includes(type)) content.contentEditable = 'false';
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
      case 'preformatted': return '<pre>Write preformatted text…</pre>';
      case 'code': return '<pre><code>Write code…</code></pre>';
      case 'separator': return '<hr>';
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
      const promptText = type === 'image' ? 'Image URL (archive media URL)' :
        type === 'audio' ? 'Audio URL (Human Archive media storage)' :
        type === 'video' ? 'Video URL (Human Archive media storage)' : 'YouTube, Spotify or SoundCloud embed URL';
      const raw = window.prompt(promptText);
      if (!raw) return;
      let html = '';
      if (type === 'image') {
        const src = safeURL(raw,IMAGE_HOSTS);
        if (!src) return window.alert('Use a secure image URL from the archive media library or WordPress media.');
        html = '<figure><img src="'+src+'" alt="" loading="lazy"><figcaption contenteditable="true">Image caption</figcaption></figure>';
      } else if (type === 'audio' || type === 'video') {
        const src = safeURL(raw,MEDIA_HOSTS);
        if (!src) return window.alert('Use a secure URL from the Human Archive media library.');
        html = type === 'audio' ? '<audio controls preload="metadata" src="'+src+'"></audio>' : '<video controls playsinline preload="metadata" src="'+src+'"></video>';
      } else {
        let url;
        try { url = new URL(raw.trim()); } catch { return window.alert('Enter a valid embed URL.'); }
        const host = url.hostname.toLowerCase();
        if (!EMBED_HOSTS.has(host)) return window.alert('Supported embeds: YouTube, Spotify and SoundCloud.');
        if (host === 'www.youtube.com' && url.pathname === '/watch') {
          const id = url.searchParams.get('v');
          if (!id || !/^[\w-]{6,20}$/.test(id)) return window.alert('That YouTube URL is not valid.');
          url = new URL('https://www.youtube-nocookie.com/embed/'+id);
        } else if (host === 'www.youtube.com' && url.pathname.startsWith('/shorts/')) {
          const id = url.pathname.split('/')[2];
          if (!/^[\w-]{6,20}$/.test(id)) return window.alert('That YouTube URL is not valid.');
          url = new URL('https://www.youtube-nocookie.com/embed/'+id);
        } else if (host === 'open.spotify.com' && !url.pathname.includes('/embed/')) {
          url.pathname = '/embed'+url.pathname;
        } else if (host === 'w.soundcloud.com' && !url.pathname.startsWith('/player/')) {
          return window.alert('Use a SoundCloud player embed URL.');
        }
        const src = safeURL(url.href,EMBED_HOSTS);
        if (!src) return window.alert('That embed URL is not supported.');
        html = '<iframe src="'+src+'" title="Embedded media" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>';
      }
      const next = makeBlock(type,html);
      if(block)block.after(next);else editor.append(next);
      wireBlock(next);
      setSelected(next);
      focusBlock(next);
      sync();
    }

    function focusBlock(block) {
      const target = block?.querySelector('[data-ha-block-content][contenteditable="true"]');
      if (!target) return;
      target.focus();
      const range = document.createRange();
      range.selectNodeContents(target);
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
          if (['image','audio','video','embed'].includes(type)) return insertMedia(type,block);
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
      TYPES.filter(([key]) => !['image','audio','video','embed','separator'].includes(key)).forEach(([key,label]) => {
        if(key==='heading'){
          [['h1','Heading 1'],['h2','Heading 2'],['h3','Heading 3'],['h4','Heading 4']].forEach(([value,text])=>{const option=document.createElement('option');option.value=value;option.textContent=text;transform.append(option);});
        }else{const option = document.createElement('option'); option.value=key; option.textContent=label; transform.append(option);}
      });
      const currentContent=block.querySelector('[data-ha-block-content]')?.firstElementChild;
      transform.value = /^H[1-4]$/.test(currentContent?.tagName||'') ? currentContent.tagName.toLowerCase() : (['image','audio','video','embed','separator','classic'].includes(type) ? 'paragraph' : type==='heading'?'h2':type);
      transform.addEventListener('change',() => transformBlock(block,transform.value));
      if(['classic','image','audio','video','embed','separator'].includes(type))transform.disabled=true;
      actions.append(transform);

      const up = document.createElement('button'); up.type='button'; up.textContent='↑'; up.title='Move block up';
      up.addEventListener('click',() => { if(block.previousElementSibling){block.parentNode.insertBefore(block,block.previousElementSibling);sync();} });
      const down = document.createElement('button'); down.type='button'; down.textContent='↓'; down.title='Move block down';
      down.addEventListener('click',() => { if(block.nextElementSibling){block.parentNode.insertBefore(block.nextElementSibling,block);sync();} });
      const duplicate = document.createElement('button'); duplicate.type='button'; duplicate.textContent='＋'; duplicate.title='Duplicate block';
      duplicate.addEventListener('click',() => { const copy=block.cloneNode(true); block.after(copy); wireBlock(copy); setSelected(copy); sync(); });
      const remove = document.createElement('button'); remove.type='button'; remove.textContent='×'; remove.title='Delete block';
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
      const text=current?.innerHTML || '<br>';
      let html=text;
      if(type==='heading') html='<h2>'+text+'</h2>';
      else if(type==='paragraph') html='<p>'+text+'</p>';
      else if(type==='quote') html='<blockquote><p>'+text+'</p></blockquote>';
      else if(type==='preformatted'||type==='code') html=type==='code'?'<pre><code>'+current.textContent+'</code></pre>':'<pre>'+current.textContent+'</pre>';
      else if(type==='unordered-list') html='<ul><li>'+current.textContent+'</li></ul>';
      else if(type==='ordered-list') html='<ol><li>'+current.textContent+'</li></ol>';
      const next=makeBlock(type,html);
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
              split.forEach(node=>{const next=makeBlock(blockType(node),node.outerHTML);anchor.after(next);wireBlock(next);anchor=next;});
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
      getText() { return blocks().map(block=>block.querySelector('[data-ha-block-content]')?.innerText||'').join('\n\n'); },
      replaceHTML(html) { this.destroy(); editor.innerHTML=String(html||'<p><br></p>'); return mountBlockEditor({editor,onChange,readOnly}); },
      focus() { focusBlock(selected||blocks()[0]); },
      destroy() {
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