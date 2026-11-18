(() => {
  'use strict';

  const EMBED_HOSTS = new Set(['www.youtube.com','www.youtube-nocookie.com','youtu.be','open.spotify.com','w.soundcloud.com','player.vimeo.com','vimeo.com','www.tiktok.com','www.instagram.com','www.facebook.com','www.dailymotion.com','www.loom.com','www.ted.com','codepen.io','www.redditmedia.com','www.slideshare.net','www.mixcloud.com','audiomack.com','www.pinterest.com']);
  const IMAGE_HOSTS = new Set(['oeyxsqocldlovhsmzcjw.supabase.co','i0.wp.com','emanuelstefancu.wordpress.com']);
  const MEDIA_HOSTS = new Set(['oeyxsqocldlovhsmzcjw.supabase.co']);
  const TYPES = [
    ['paragraph','Paragraph','Text'],['heading','Heading','Text'],['unordered-list','List','Text'],['ordered-list','Numbered list','Text'],['quote','Quote','Text'],['pullquote','Pullquote','Text'],['verse','Verse','Text'],['preformatted','Preformatted','Text'],['code','Code','Text'],['table','Table','Text'],['details','Details / Accordion','Text'],['markdown','Markdown','Text'],['html','Custom HTML','Text'],['classic','Classic content','Text'],['separator','Separator','Text'],['page-break','Page break','Text'],['more','More / Read more','Text'],
    ['image','Image','Media'],['gallery','Gallery','Media'],['slideshow','Slideshow','Media'],['tiled-gallery','Tiled gallery','Media'],['cover','Cover','Media'],['media-text','Media & text','Media'],['image-compare','Image compare','Media'],['audio','Audio','Media'],['video','Video','Media'],['file','File download','Media'],['playlist','Audio playlist','Media'],['podcast','Podcast player','Media'],['embed','Embed','Media'],['youtube','YouTube','Media'],['spotify','Spotify','Media'],['soundcloud','SoundCloud','Media'],
    ['buttons','Buttons','Design'],['button','Button','Design'],['columns','Columns','Design'],['group','Group','Design'],['row','Row','Design'],['stack','Stack','Design'],['grid','Grid','Design'],['spacer','Spacer','Design'],['social-icons','Social icons','Design'],['icon','Icon','Design'],['timeline','Timeline','Design'],['tabs','Tabs','Design'],['callout','Callout','Design'],['card','Card','Design']
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
    if (node.classList?.contains('ha-pullquote')||node.classList?.contains('wp-block-pullquote')) return 'pullquote'; if (node.classList?.contains('ha-verse')) return 'verse'; if (node.classList?.contains('ha-spacer')) return 'spacer'; if (node.classList?.contains('ha-social-icons')) return 'social-icons'; if (node.classList?.contains('ha-image-compare')) return 'image-compare'; if (node.classList?.contains('ha-embed')||node.classList?.contains('ha-embed-card')) return 'embed'; if (node.classList?.contains('ha-file-block')) return 'file'; if (node.classList?.contains('ha-podcast')) return 'podcast'; if (node.classList?.contains('ha-playlist')) return 'playlist'; if (node.classList?.contains('ha-columns')) return 'columns'; if (node.classList?.contains('ha-group')) return 'group'; if (node.classList?.contains('ha-row')) return 'row'; if (node.classList?.contains('ha-stack')) return 'stack'; if (node.classList?.contains('ha-grid')) return 'grid'; if (node.classList?.contains('ha-cover')) return 'cover'; if (node.classList?.contains('ha-gallery')) return 'gallery'; if (node.classList?.contains('ha-slideshow')) return 'slideshow'; if (node.classList?.contains('ha-tiled-gallery')) return 'tiled-gallery'; if (node.classList?.contains('ha-media-text')) return 'media-text'; if (node.classList?.contains('ha-buttons')) return 'buttons'; if (node.classList?.contains('ha-callout')) return 'callout'; if (node.classList?.contains('ha-card')) return 'card'; if (node.classList?.contains('ha-tabs')) return 'tabs'; if (node.classList?.contains('ha-timeline')) return 'timeline'; if (node.classList?.contains('ha-page-break')) return 'page-break';
    if (tag === 'UL') return 'unordered-list';
    if (tag === 'TABLE') return 'table';
    if (tag === 'DETAILS') return 'details';
    if (tag === 'FIGURE' && node.querySelectorAll('img').length > 1) return 'gallery';
    if (tag === 'FIGURE' && node.querySelector('img')) return 'image';
    if (tag === 'HR') return 'separator';
    if (tag === 'OL') return 'ordered-list';
    if (tag === 'PRE' && node.querySelector('code')) return 'code';
    if (tag === 'BLOCKQUOTE') return 'quote';
    if (tag === 'PRE') return 'preformatted';
    if (tag === 'CODE') return 'code';
    if (tag === 'HR') return 'separator';
    if (tag === 'TABLE') return 'table';
    if (tag === 'DETAILS') return 'details';
    if (tag === 'IMG' || node.querySelector?.('img')) return 'image';
    if (tag === 'AUDIO' || node.querySelector?.('audio')) return 'audio';
    if (tag === 'VIDEO' || node.querySelector?.('video')) return 'video';
    if (tag === 'IFRAME' || node.querySelector?.('iframe')) return 'embed';
    if (tag === 'DIV' || tag === 'SECTION' || tag === 'ASIDE' || tag === 'NAV' || tag === 'ARTICLE') return 'classic';
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
    if (['separator','image','gallery','slideshow','tiled-gallery','cover','media-text','image-compare','audio','video','file','playlist','podcast','embed','youtube','spotify','soundcloud','spacer'].includes(type)) content.contentEditable = 'false';
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
    const templates = {
      heading:'<h2>Heading</h2>', 'unordered-list':'<ul><li>List item</li></ul>', 'ordered-list':'<ol><li>List item</li></ol>',
      quote:'<blockquote><p>Write a quote…</p></blockquote>', pullquote:'<figure class="wp-block-pullquote"><blockquote><p>A thought worth highlighting.</p></blockquote></figure>',
      verse:'<pre class="wp-block-verse">Write verse or poetry…</pre>', preformatted:'<pre>Write preformatted text…</pre>', code:'<pre><code>Write code…</code></pre>',
      separator:'<hr>', 'page-break':'<div class="ha-page-break" data-page-break="true"><span>PAGE BREAK</span></div>', more:'<p><!--more--></p>',
      table:'<table><thead><tr><th>Heading 1</th><th>Heading 2</th></tr></thead><tbody><tr><td>Cell 1</td><td>Cell 2</td></tr></tbody></table>',
      details:'<details open><summary>Click to expand</summary><p>Add the hidden content here.</p></details>',
      markdown:'<pre class="ha-markdown-source"># Markdown\n\nWrite Markdown here…</pre>', html:'<pre class="ha-html-source">&lt;div&gt;Custom HTML&lt;/div&gt;</pre>',
      buttons:'<div class="ha-buttons"><a class="ha-button" href="https://example.com">Button label</a><a class="ha-button" href="https://example.com">Another button</a></div>',
      button:'<p><a class="ha-button" href="https://example.com">Button label</a></p>',
      columns:'<div class="ha-columns"><section><h3>Column one</h3><p>Write here…</p></section><section><h3>Column two</h3><p>Write here…</p></section></div>',
      group:'<section class="ha-group"><h3>Group heading</h3><p>Add blocks or content inside this group…</p></section>',
      row:'<div class="ha-row"><p>First item</p><p>Second item</p></div>', stack:'<div class="ha-stack"><p>First item</p><p>Second item</p></div>',
      grid:'<div class="ha-grid"><section><h3>Item one</h3><p>Content…</p></section><section><h3>Item two</h3><p>Content…</p></section><section><h3>Item three</h3><p>Content…</p></section></div>',
      spacer:'<div class="ha-spacer" contenteditable="false" aria-label="Spacer"></div>',
      'social-icons':'<nav class="ha-social-icons" aria-label="Social links"><a href="https://instagram.com/" rel="noopener noreferrer">Instagram</a><a href="https://youtube.com/" rel="noopener noreferrer">YouTube</a><a href="https://open.spotify.com/" rel="noopener noreferrer">Spotify</a></nav>',
      icon:'<p class="ha-icon-block">✦ <span>Icon label</span></p>', timeline:'<ol class="ha-timeline"><li><strong>Moment one</strong><p>Describe this moment…</p></li><li><strong>Moment two</strong><p>Describe this moment…</p></li></ol>',
      tabs:'<div class="ha-tabs"><section><h3>Tab one</h3><p>Tab content…</p></section><section><h3>Tab two</h3><p>Tab content…</p></section></div>',
      callout:'<aside class="ha-callout"><strong>Note</strong><p>Write an important note…</p></aside>', card:'<article class="ha-card"><h3>Card title</h3><p>Card content…</p></article>',
      'media-text':'<div class="ha-media-text"><div><img src="" alt="" data-media-placeholder="image"><p>Media URL required</p></div><section><h3>Heading</h3><p>Write alongside your media…</p></section></div>',
      'image-compare':'<figure class="ha-image-compare"><p>Add two image URLs using the block settings.</p></figure>',
      playlist:'<div class="ha-playlist"><p>Add audio tracks using the media library.</p></div>', podcast:'<div class="ha-podcast"><p>Add a podcast episode URL.</p></div>'
    };
    return templates[type] || '<p><br></p>';
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
      const promptText = ['image','cover','media-text'].includes(type) ? 'Image URL (archive or WordPress media URL)' :
        ['audio','playlist','podcast'].includes(type) ? 'Audio URL (Human Archive media storage)' :
        type==='video' ? 'Video URL (Human Archive media storage)' :
        type==='file' ? 'File URL (Human Archive media storage)' : type==='gallery'||type==='tiled-gallery' ? 'Image URLs, separated by commas' : type==='image-compare' ? 'Two image URLs, separated by a comma' : 'Paste a YouTube, Spotify, SoundCloud, Vimeo, TikTok, Instagram, Facebook, Dailymotion, Loom, TED, CodePen, Reddit or Mixcloud URL';
      const raw = window.prompt(promptText);
      if (!raw) return;
      let html = '';
      if (['image','cover','media-text'].includes(type)) {
        const src = safeURL(raw,IMAGE_HOSTS);
        if (!src) return window.alert('Use a secure image URL from the archive media library or WordPress media.');
        const alt=window.prompt('Alternative text for this image (optional)','')||'';
        const figure=document.createElement('figure'),image=document.createElement('img'),caption=document.createElement('figcaption');
        image.src=src;image.alt=alt;image.loading='lazy';caption.contentEditable='true';caption.textContent='Image caption';figure.append(image,caption);html=figure.outerHTML;
        if(type==='cover')html='<section class="ha-cover" style="--ha-cover-image:url(&quot;'+src+'&quot;)"><img src="'+src+'" alt="'+alt.replace(/[&<>\"]/g,'')+'"><div class="ha-cover-content"><h2>Cover heading</h2><p>Write over the image…</p></div></section>';
        if(type==='media-text')html='<div class="ha-media-text"><figure><img src="'+src+'" alt="'+alt.replace(/[&<>\"]/g,'')+'"></figure><section><h2>Heading</h2><p>Write alongside your media…</p></section></div>';
      } else if (type==='gallery'||type==='tiled-gallery'||type==='slideshow'||type==='image-compare') {
        const urls=raw.split(',').map(value=>safeURL(value.trim(),IMAGE_HOSTS)).filter(Boolean);
        if(urls.length<(type==='image-compare'?2:1))return window.alert('Add valid image URLs from the archive media library or WordPress media.');
        if(type==='image-compare'&&urls.length>=2)html='<div class="ha-image-compare"><figure><img src="'+urls[0]+'" alt="Before"></figure><figure><img src="'+urls[1]+'" alt="After"></figure></div>';
        else html='<div class="'+(type==='slideshow'?'ha-slideshow':type==='tiled-gallery'?'ha-tiled-gallery':'ha-gallery')+'">'+urls.map((src,index)=>'<figure><img src="'+src+'" alt="" loading="lazy"><figcaption contenteditable="true">Image '+(index+1)+'</figcaption></figure>').join('')+'</div>';
      } else if (type === 'audio' || type === 'video' || type==='playlist' || type==='podcast' || type==='file') {
        const src = safeURL(raw,MEDIA_HOSTS);
        if (!src || !new URL(src).pathname.startsWith('/storage/v1/object/public/vha-post-media/')) return window.alert('Use a secure URL from the Human Archive media library.');
        html = type === 'audio' || type==='playlist' || type==='podcast' ? '<div class="'+(type==='podcast'?'ha-podcast':'ha-audio-block')+'"><audio controls preload="metadata" src="'+src+'"></audio></div>' : type==='file' ? '<p class="ha-file-block"><a href="'+src+'" download>Download file</a></p>' : '<video controls playsinline preload="metadata" src="'+src+'"></video>';
      } else {
        let url;
        try { url = new URL(raw.trim()); } catch { return window.alert('Enter a valid embed URL.'); }
        const host = url.hostname.toLowerCase();
        if (!EMBED_HOSTS.has(host)) return window.alert('That provider is not in the secure embed allowlist. Use the Custom HTML block only for trusted code, or add a link.');
        if (['youtube','spotify','soundcloud'].includes(type) && !((type==='youtube'&&['www.youtube.com','www.youtube-nocookie.com','youtu.be'].includes(host))||(type==='spotify'&&host==='open.spotify.com')||(type==='soundcloud'&&host==='w.soundcloud.com'))) return window.alert('The URL does not match the selected embed block.');
        if (host === 'youtu.be') {
          const id=url.pathname.slice(1).split('/')[0];
          if(!/^[\w-]{6,20}$/.test(id))return window.alert('That YouTube URL is not valid.');
          url=new URL('https://www.youtube-nocookie.com/embed/'+id);
        } else if (host === 'www.youtube.com' && url.pathname === '/watch') {
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
        } else if (host==='vimeo.com') { const id=url.pathname.split('/').filter(Boolean)[0]; if(!/^\\d+$/.test(id||''))return window.alert('That Vimeo URL is not valid.');url=new URL('https://player.vimeo.com/video/'+id); } else if(host==='www.dailymotion.com'&&url.pathname.startsWith('/video/')) { const id=url.pathname.split('/')[2];url=new URL('https://www.dailymotion.com/embed/video/'+id); }
        if(host==='vimeo.com'){const id=url.pathname.split('/').filter(Boolean)[0];if(!/^\\d+$/.test(id||''))return window.alert('That Vimeo URL is not valid.');url=new URL('https://player.vimeo.com/video/'+id);}
        if(host==='www.dailymotion.com'&&url.pathname.startsWith('/video/')){const id=url.pathname.split('/')[2];url=new URL('https://www.dailymotion.com/embed/video/'+id);}
        if(host==='www.loom.com'&&url.pathname.startsWith('/share/')){url=new URL('https://www.loom.com/embed/'+url.pathname.split('/')[2]);}
        if(host==='www.youtube.com'&&url.pathname==='/watch'){const id=url.searchParams.get('v');if(!id||!/[\\w-]{6,20}/.test(id))return window.alert('That YouTube URL is not valid.');url=new URL('https://www.youtube-nocookie.com/embed/'+id);}
        const src=safeURL(url.href,EMBED_HOSTS);
        if(!src)return window.alert('That embed URL is not supported.');
        const iframeHosts=['www.youtube-nocookie.com','open.spotify.com','w.soundcloud.com','player.vimeo.com','www.dailymotion.com','www.loom.com'];
        if(!iframeHosts.includes(new URL(src).hostname)){const link=document.createElement('a');link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';link.className='ha-embed-link';link.textContent='OPEN EMBED — '+url.hostname;html='<div class="ha-embed-card">'+link.outerHTML+'</div>';}
        else html='<figure class="ha-embed"><iframe src="'+src+'" title="Embedded media" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe><figcaption contenteditable="true">Embedded media</figcaption></figure>';
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
      menu = document.createElement('div'); menu.className = 'ha-block-inserter-menu'; menu.setAttribute('role','dialog'); menu.setAttribute('aria-label','Choose a block');
      const search = document.createElement('input'); search.type='search'; search.className='ha-block-search'; search.placeholder='Search all blocks…'; search.setAttribute('aria-label','Search blocks'); menu.append(search);
      const results = document.createElement('div'); results.className='ha-block-results'; menu.append(results);
      function render(filter='') {
        results.replaceChildren(); const q=filter.trim().toLowerCase(); let lastCategory=''; let count=0;
        TYPES.filter(([type,label,category])=>!q||`${type} ${label} ${category}`.toLowerCase().includes(q)).forEach(([type,label,category])=>{
          if(category!==lastCategory){const heading=document.createElement('div');heading.className='ha-block-category';heading.textContent=category;results.append(heading);lastCategory=category;}
          const button=document.createElement('button');button.type='button';button.className='ha-block-option';button.textContent=label;button.setAttribute('role','menuitem');
          button.addEventListener('click',()=>{closeMenu();if(['image','gallery','slideshow','tiled-gallery','cover','audio','video','file','embed','youtube','spotify','soundcloud','podcast','playlist','media-text','image-compare'].includes(type))return insertMedia(type,block);const next=makeBlock(type,defaultHTML(type));if(block)block.after(next);else editor.append(next);wireBlock(next);setSelected(next);focusBlock(next);sync();});
          results.append(button);count++;
        });
        if(!count){const empty=document.createElement('p');empty.className='ha-block-empty';empty.textContent='No matching blocks';results.append(empty);}
      }
      search.addEventListener('input',()=>render(search.value)); render();
      const anchorRect=anchor.getBoundingClientRect(),shellRect=shell.getBoundingClientRect();menu.style.left=Math.max(8,anchorRect.left-shellRect.left)+'px';menu.style.top=(anchorRect.bottom-shellRect.top+5)+'px';anchor.after(menu);search.focus();
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
      TYPES.filter(([key]) => !['image','gallery','slideshow','tiled-gallery','cover','media-text','image-compare','audio','video','file','playlist','podcast','embed','youtube','spotify','soundcloud','separator','spacer'].includes(key)).forEach(([key,label]) => {
        if(key==='heading'){
          [['h1','Heading 1'],['h2','Heading 2'],['h3','Heading 3'],['h4','Heading 4']].forEach(([value,text])=>{const option=document.createElement('option');option.value=value;option.textContent=text;transform.append(option);});
        }else{const option = document.createElement('option'); option.value=key; option.textContent=label; transform.append(option);}
      });
      const currentContent=block.querySelector('[data-ha-block-content]')?.firstElementChild;
      transform.value = /^H[1-4]$/.test(currentContent?.tagName||'') ? currentContent.tagName.toLowerCase() : (['image','audio','video','embed','separator','classic'].includes(type) ? 'paragraph' : type==='heading'?'h2':type);
      transform.addEventListener('change',() => transformBlock(block,transform.value));
      if(['classic','image','gallery','slideshow','tiled-gallery','cover','media-text','image-compare','audio','video','file','playlist','podcast','embed','youtube','spotify','soundcloud','separator','spacer'].includes(type))transform.disabled=true;
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