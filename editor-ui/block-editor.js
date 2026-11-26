(() => {
  'use strict';

  const EMBED_HOSTS = new Set(['www.youtube.com','www.youtube-nocookie.com','youtu.be','youtube.com','open.spotify.com','w.soundcloud.com','soundcloud.com','player.vimeo.com','vimeo.com','www.tiktok.com','www.instagram.com','www.facebook.com','www.dailymotion.com','www.loom.com','www.ted.com','codepen.io','www.redditmedia.com','www.slideshare.net','www.mixcloud.com','audiomack.com','www.pinterest.com']);
  const IMAGE_HOSTS = new Set();
  const MEDIA_HOSTS = new Set();
  const TYPES = [
    ['paragraph','Paragraph','Text'],['heading','Heading','Text'],['unordered-list','List','Text'],['ordered-list','Numbered list','Text'],['quote','Quote','Text'],['pullquote','Pullquote','Text'],['verse','Verse','Text'],['preformatted','Preformatted','Text'],['code','Code','Text'],['table','Table','Text'],['details','Details / Accordion','Text'],['markdown','Markdown','Text'],['html','Custom HTML','Text'],['classic','Classic content','Text'],['separator','Separator','Text'],['page-break','Page break','Text'],['more','More / Read more','Text'],
    ['image','Image','Media'],['gallery','Gallery','Media'],['slideshow','Slideshow','Media'],['tiled-gallery','Tiled gallery','Media'],['cover','Cover','Media'],['media-text','Media & text','Media'],['image-compare','Image compare','Media'],['audio','Audio','Media'],['video','Video','Media'],['file','File download','Media'],['playlist','Audio playlist','Media'],['podcast','Podcast player','Media'],['embed','Embed','Media'],['youtube','YouTube','Media'],['spotify','Spotify','Media'],['soundcloud','SoundCloud','Media'],
    ['buttons','Buttons','Design'],['button','Button','Design'],['columns','Columns','Design'],['group','Group','Design'],['row','Row','Design'],['stack','Stack','Design'],['grid','Grid','Design'],['spacer','Spacer','Design'],['social-icons','Social icons','Design'],['icon','Icon','Design'],['timeline','Timeline','Design'],['tabs','Tabs','Design'],['callout','Callout','Design'],['card','Card','Design']
  ];
  let inserterMenuSequence = 0;

  function safeURL(value, hosts) {
    try {
      const url = new URL(String(value || '').trim());
      if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || !hosts.has(url.hostname.toLowerCase())) return '';
      return url.href;
    } catch { return ''; }
  }


  function safeEditorMediaURL(value, hosts, mediaBasePath) {
    const raw = String(value || '').trim();
    const basePathValue = String(mediaBasePath || '/landing-page'); const basePath = basePathValue.endsWith('/') ? basePathValue.slice(0, -1) : basePathValue;
    try {
      if (raw.startsWith('media/') && !raw.includes('..') && !raw.includes('?') && !raw.includes('#') && !raw.includes(String.fromCharCode(92))) return new URL(basePath + '/' + raw, window.location.origin).href;
      const url = new URL(raw, window.location.href);
      if (url.protocol === 'blob:' && url.origin === window.location.origin) return url.href;
      if (url.origin === window.location.origin && url.pathname.startsWith(basePath + '/media/') &&
          !url.pathname.includes('..') && !url.search && !url.hash) return url.href;
    } catch {}
    return safeURL(raw, hosts);
  }

  function blockType(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return 'paragraph';
    const tag = node.tagName;
    if (/^H[1-4]$/.test(tag)) return 'heading';
    if (node.classList?.contains('ha-pullquote')||node.classList?.contains('wp-block-pullquote')) return 'pullquote'; if (node.classList?.contains('wp-block-verse')) return 'verse'; if (node.classList?.contains('ha-button-block')) return 'button'; if (node.classList?.contains('ha-more-block')) return 'more'; if (node.classList?.contains('ha-html-source')) return 'html'; if (node.classList?.contains('ha-markdown-source')) return 'markdown'; if (node.classList?.contains('ha-icon-block')) return 'icon'; if (node.classList?.contains('ha-file-block')) return 'file'; if (node.classList?.contains('ha-verse')) return 'verse'; if (node.classList?.contains('ha-spacer')) return 'spacer'; if (node.classList?.contains('ha-social-icons')) return 'social-icons'; if (node.classList?.contains('ha-image-compare')) return 'image-compare'; if (node.classList?.contains('ha-embed-youtube')) return 'youtube'; if (node.classList?.contains('ha-embed-spotify')) return 'spotify'; if (node.classList?.contains('ha-embed-soundcloud')) return 'soundcloud'; if (node.classList?.contains('ha-embed')||node.classList?.contains('ha-embed-card')) return 'embed'; if (node.classList?.contains('ha-podcast')) return 'podcast'; if (node.classList?.contains('ha-playlist')||(node.classList?.contains('ha-audio-block')&&node.querySelectorAll('audio').length>1)) return 'playlist'; if (node.classList?.contains('ha-columns')) return 'columns'; if (node.classList?.contains('ha-group')) return 'group'; if (node.classList?.contains('ha-row')) return 'row'; if (node.classList?.contains('ha-stack')) return 'stack'; if (node.classList?.contains('ha-grid')) return 'grid'; if (node.classList?.contains('ha-cover')) return 'cover'; if (node.classList?.contains('ha-gallery')) return 'gallery'; if (node.classList?.contains('ha-slideshow')) return 'slideshow'; if (node.classList?.contains('ha-tiled-gallery')) return 'tiled-gallery'; if (node.classList?.contains('ha-media-text')) return 'media-text'; if (node.classList?.contains('ha-buttons')) return 'buttons'; if (node.classList?.contains('ha-callout')) return 'callout'; if (node.classList?.contains('ha-card')) return 'card'; if (node.classList?.contains('ha-tabs')) return 'tabs'; if (node.classList?.contains('ha-timeline')) return 'timeline'; if (node.classList?.contains('ha-page-break')) return 'page-break';
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
    if (tag === 'IFRAME' || node.querySelector?.('iframe')) {
      const frame = tag === 'IFRAME' ? node : node.querySelector('iframe');
      const src = frame?.getAttribute('src') || '';
      let host = '';
      try { host = new URL(src, window.location.href).hostname.toLowerCase(); } catch {}
      if (host === 'open.spotify.com') return 'spotify';
      if (['soundcloud.com','www.soundcloud.com','w.soundcloud.com'].includes(host)) return 'soundcloud';
      if (['youtube.com','www.youtube.com','youtube-nocookie.com','www.youtube-nocookie.com','youtu.be'].includes(host)) return 'youtube';
      return 'embed';
    }
    if (tag === 'DIV' || tag === 'SECTION' || tag === 'ASIDE' || tag === 'NAV' || tag === 'ARTICLE') return 'classic';
    return 'paragraph';
  }


  function appendMarkdownToken(parent, value, kind) {
    if (!value) return;
    if (!kind) {
      parent.append(document.createTextNode(value));
      return;
    }
    const token = document.createElement('span');
    token.className = 'ha-md-' + kind;
    token.textContent = value;
    parent.append(token);
  }

  function isMarkdownSectionLabel(value) {
    return /^(?:intro|verse(?:\s+\d+)?|pre[- ]?chorus|chorus|post[- ]?chorus|bridge|outro|hook|refrain|instrumental|interlude|breakdown|spoken|solo|coda|ending|tag)(?:\b|\s|[–—:])/i.test(String(value || '').trim());
  }

  function appendMarkdownInline(parent, source) {
    const pattern = /(\[[^\]\n]*\]|\x60[^\x60\n]+\x60|\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|_[^_\n]+_|https?:\/\/[^\s]+)/g;
    let last = 0;
    let match;
    while ((match = pattern.exec(source))) {
      appendMarkdownToken(parent, source.slice(last, match.index));
      const token = match[0];
      if (token[0] === '[' && token[token.length - 1] === ']') {
        const label = token.slice(1, -1);
        appendMarkdownToken(parent, '[', 'bracket');
        appendMarkdownToken(parent, label, isMarkdownSectionLabel(label) ? 'section-label' : 'stage-direction');
        appendMarkdownToken(parent, ']', 'bracket');
      } else if (token.startsWith('\x60')) {
        appendMarkdownToken(parent, '\x60', 'syntax-marker');
        appendMarkdownToken(parent, token.slice(1, -1), 'inline-code');
        appendMarkdownToken(parent, '\x60', 'syntax-marker');
      } else if (token.startsWith('**') || token.startsWith('__')) {
        const marker = token.slice(0, 2);
        appendMarkdownToken(parent, marker, 'syntax-marker');
        appendMarkdownToken(parent, token.slice(2, -2), 'strong');
        appendMarkdownToken(parent, marker, 'syntax-marker');
      } else if (token.startsWith('*') || token.startsWith('_')) {
        const marker = token[0];
        appendMarkdownToken(parent, marker, 'syntax-marker');
        appendMarkdownToken(parent, token.slice(1, -1), 'emphasis');
        appendMarkdownToken(parent, marker, 'syntax-marker');
      } else {
        appendMarkdownToken(parent, token, 'link');
      }
      last = match.index + token.length;
    }
    appendMarkdownToken(parent, source.slice(last));
  }

  function appendMarkdownCodeLine(parent, source) {
    const pattern = /(\/\/.*$|\/\*.*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\x60[^\x60]*\x60|\b\d+(?:\.\d+)?\b|[$A-Za-z_][\w$]*|[\{\}\(\)\[\].,;:+*\/=<>!-])/g;
    const keywords = /^(?:async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|export|extends|false|finally|for|from|function|if|import|in|instanceof|let|new|null|of|return|static|super|switch|this|throw|true|try|typeof|var|void|while|yield)$/;
    let last = 0;
    let match;
    while ((match = pattern.exec(source))) {
      appendMarkdownToken(parent, source.slice(last, match.index));
      const token = match[0];
      const next = source.slice(match.index + token.length).match(/^\s*(.)/)?.[1] || '';
      let kind = '';
      if (token.startsWith('//') || token.startsWith('/*')) kind = 'code-comment';
      else if (/^(["'\x60])/.test(token)) kind = 'code-string';
      else if (/^\d/.test(token)) kind = 'code-number';
      else if (keywords.test(token)) kind = 'code-keyword';
      else if (/^[A-Za-z_$]/.test(token) && next === '(') kind = 'code-function';
      else if (/^[\{\}\(\)\[\].,;:+*\/=<>!-]+$/.test(token)) kind = 'code-punctuation';
      else if (/^[A-Za-z_$]/.test(token)) kind = 'code-identifier';
      appendMarkdownToken(parent, token, kind);
      last = match.index + token.length;
    }
    appendMarkdownToken(parent, source.slice(last));
  }

  function highlightMarkdown(source) {
    const fragment = document.createDocumentFragment();
    const lines = String(source ?? '').replace(/\r\n?/g, '\n').split('\n');
    let inCodeFence = false;
    lines.forEach((line, index) => {
      if (index) fragment.append(document.createTextNode('\n'));
      if (/^\s*(?:\x60{3,}|~{3,})/.test(line)) {
        const fence = line.match(/^(\s*)(?:\x60{3,}|~{3,})(.*)$/);
        appendMarkdownToken(fragment, fence?.[1] || '');
        appendMarkdownToken(fragment, line.trim().slice(0, 3), 'code-fence');
        appendMarkdownToken(fragment, fence?.[2] || '', 'code-language');
        inCodeFence = !inCodeFence;
        return;
      }
      if (inCodeFence) {
        appendMarkdownCodeLine(fragment, line);
        return;
      }
      const bracketLine = line.match(/^(\s*)(\[)([^\]\n]+)(\])(\s*)$/);
      if (bracketLine) {
        appendMarkdownToken(fragment, bracketLine[1]);
        appendMarkdownToken(fragment, bracketLine[2], 'bracket');
        appendMarkdownToken(fragment, bracketLine[3], isMarkdownSectionLabel(bracketLine[3]) ? 'section-label' : 'stage-direction');
        appendMarkdownToken(fragment, bracketLine[4], 'bracket');
        appendMarkdownToken(fragment, bracketLine[5]);
        return;
      }
      const heading = line.match(/^(\s{0,3})(#{1,6})(\s+)(.*)$/);
      if (heading) {
        appendMarkdownToken(fragment, heading[1]);
        appendMarkdownToken(fragment, heading[2], 'syntax-marker');
        appendMarkdownToken(fragment, heading[3]);
        appendMarkdownToken(fragment, heading[4], 'heading');
        return;
      }
      const quote = line.match(/^(\s*)(>+)(\s?)(.*)$/);
      if (quote) {
        appendMarkdownToken(fragment, quote[1]);
        appendMarkdownToken(fragment, quote[2], 'syntax-marker');
        appendMarkdownToken(fragment, quote[3]);
        appendMarkdownInline(fragment, quote[4]);
        return;
      }
      const list = line.match(/^(\s*)([-*+]|\d+[.)])(\s+)(.*)$/);
      if (list) {
        appendMarkdownToken(fragment, list[1]);
        appendMarkdownToken(fragment, list[2], 'list-marker');
        appendMarkdownToken(fragment, list[3]);
        appendMarkdownInline(fragment, list[4]);
        return;
      }
      if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
        appendMarkdownToken(fragment, line, 'syntax-marker');
        return;
      }
      appendMarkdownInline(fragment, line);
    });
    return fragment;
  }

  function normalizeMarkdownColor(value, fallback = '#e5ece8') {
    const color = String(value || '').trim();
    return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
  }

  function createMarkdownEditor(source = '', textColor = '#e5ece8') {
    const shell = document.createElement('div');
    shell.className = 'ha-markdown-editor';
    shell.style.setProperty('--ha-md-base-color', normalizeMarkdownColor(textColor));
    const highlighted = document.createElement('pre');
    highlighted.className = 'ha-markdown-highlight';
    highlighted.setAttribute('aria-hidden', 'true');
    const code = document.createElement('code');
    highlighted.append(code);
    const input = document.createElement('textarea');
    input.className = 'ha-markdown-input';
    input.setAttribute('aria-label', 'Markdown source editor');
    input.setAttribute('spellcheck', 'false');
    input.setAttribute('autocapitalize', 'off');
    input.setAttribute('autocomplete', 'off');
    input.spellcheck = false;
    input.wrap = 'soft';
    input.value = String(source ?? '');
    input.defaultValue = input.value;
    input.rows = Math.max(6, Math.min(20, input.value.split('\n').length + 1));

    const repaint = () => {
      code.replaceChildren(highlightMarkdown(input.value));
      const height = Math.min(480, Math.max(176, input.scrollHeight || 176));
      shell.style.height = height + 'px';
      highlighted.scrollTop = input.scrollTop;
      highlighted.scrollLeft = input.scrollLeft;
    };
    input.addEventListener('input', () => {
      if (input.defaultValue !== input.value) input.defaultValue = input.value;
      repaint();
    });
    input.addEventListener('scroll', () => {
      highlighted.scrollTop = input.scrollTop;
      highlighted.scrollLeft = input.scrollLeft;
    }, { passive: true });
    input.addEventListener('keydown', event => {
      if (event.key !== 'Tab' || event.shiftKey || event.isComposing) return;
      event.preventDefault();
      input.setRangeText('  ', input.selectionStart, input.selectionEnd, 'end');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    shell.append(highlighted, input);
    repaint();
    return shell;
  }

  function makeBlock(type, html) {
    const block = document.createElement('section');
    block.className = 'ha-editor-block';
    block.dataset.haBlock = type;
    block.setAttribute('data-ha-editor-block','');

    const controls = document.createElement('div');
    controls.className = 'ha-editor-block-controls';
    controls.innerHTML = '<span class="ha-editor-block-grip" aria-hidden="true">⠿</span><button type="button" class="ha-editor-block-name" title="Rename block" aria-label="Rename block"></button><div class="ha-editor-block-actions"></div>';

    const content = document.createElement('div');
    content.className = 'ha-editor-block-content';
    content.dataset.haBlockContent = '';
    content.innerHTML = html;
    if (type === 'markdown') {
      const sourceNode = content.querySelector('.ha-markdown-source') || content.querySelector('pre');
      const source = sourceNode?.textContent ?? content.textContent ?? '';
      const textColor = normalizeMarkdownColor(sourceNode?.getAttribute('data-ha-text-color'));
      content.replaceChildren(createMarkdownEditor(source, textColor));
      content.contentEditable = 'false';
    } else if (['separator','image','gallery','slideshow','tiled-gallery','image-compare','audio','video','playlist','podcast','embed','youtube','spotify','soundcloud','spacer','columns'].includes(type)) content.contentEditable = 'false';
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
      separator:'<hr>', 'page-break':'<div class="ha-page-break" data-page-break="true"><span>PAGE BREAK</span></div>', more:'<div class="ha-more-block"><hr></div>',
      table:'<table><thead><tr><th>Heading 1</th><th>Heading 2</th></tr></thead><tbody><tr><td>Cell 1</td><td>Cell 2</td></tr></tbody></table>',
      details:'<details open><summary>Click to expand</summary><p>Add the hidden content here.</p></details>',
      markdown:'<pre class="ha-markdown-source"># Markdown\n\nWrite Markdown here…</pre>', html:'<pre class="ha-html-source">&lt;div&gt;Custom HTML&lt;/div&gt;</pre>',
      buttons:'<div class="ha-buttons"><a class="ha-button" href="https://example.com">Button label</a><a class="ha-button" href="https://example.com">Another button</a></div>',
      button:'<p class="ha-button-block"><a class="ha-button" href="https://example.com">Button label</a></p>',
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

  function mountBlockEditor({ editor, onChange = () => {}, onUpload = null, getMediaLibrary = () => [], readOnly = false, showTopbar = true, mediaBasePath = '' } = {}) {
    if (!(editor instanceof HTMLElement)) throw new TypeError('A block editor canvas is required.');
    if (editor.dataset.haBlockEditorMounted === 'true') return editor.__haBlockEditor || null;
    editor.dataset.haBlockEditorMounted = 'true';
    ['height','min-height','max-height','width','overflow','resize'].forEach(property=>editor.style.removeProperty(property));
    editor.classList.add('ha-block-editor-canvas');
    editor.setAttribute('role','region');
    editor.setAttribute('aria-label',editor.getAttribute('aria-label') || 'Block editor canvas');
    editor.contentEditable = 'false';

    const shell = document.createElement('div');
    shell.className = 'ha-block-editor-shell';
    let topbar = null;
    let addTop = null;
    let addMediaTop = null;
    let addColumnTop = null;
    if(showTopbar){
      topbar = document.createElement('div');
      topbar.className = 'ha-block-editor-topbar';
      const actions = document.createElement('div');
      actions.className = 'ha-block-editor-topbar-actions';
      addTop = document.createElement('button');
      addTop.type = 'button'; addTop.className = 'ha-editor-inserter';
      addTop.innerHTML = '<span aria-hidden="true">＋</span> Add block';
      addMediaTop = document.createElement('button');
      addMediaTop.type = 'button'; addMediaTop.className = 'ha-editor-inserter ha-editor-inserter-media';
      addMediaTop.innerHTML = '<span aria-hidden="true">▧</span> Add media';
      addColumnTop = document.createElement('button');
      addColumnTop.type = 'button'; addColumnTop.className = 'ha-editor-inserter ha-editor-inserter-columns';
      addColumnTop.innerHTML = '<span aria-hidden="true">▥</span> Add columns';
      const hint = document.createElement('span');
      hint.className = 'ha-block-editor-hint';
      hint.textContent = 'Every piece of content is a block';
      actions.append(addTop,addMediaTop,addColumnTop);
      topbar.append(actions,hint);
    }
    editor.parentNode.insertBefore(shell,editor);
    if(topbar)shell.append(topbar,editor);else shell.append(editor);

    let selected = null;
    let draggingBlock = null;
    let menu = null;
    let addCanvasColumnButton = null;
    let syncing = false;
    const listeners = new AbortController();

    const labelFor = type => TYPES.find(item => item[0] === type)?.[1] || 'Classic';
    const displayBlockName = block => String(block?.dataset.haBlockName || '').trim() || labelFor(block?.dataset.haBlock || 'paragraph');
    const refreshBlockName = block => {
      const name=block.querySelector(':scope > .ha-editor-block-controls > .ha-editor-block-name');
      if(name){const value=displayBlockName(block);name.textContent=value;name.title='Rename block';name.setAttribute('aria-label','Rename block: '+value);}
    };
    const blocks = (container = editor) => [...(container?.children || [])].filter(node => node.matches?.('[data-ha-editor-block]'));
    const allBlocks = (container = editor) => [...container.querySelectorAll('[data-ha-editor-block]')];
    const contentFor = block => block?.querySelector(':scope > .ha-editor-block-content');

    function updateColumnCount(columns) {
      const count=[...columns.children].filter(node=>node.classList.contains('ha-editor-column')).length;
      columns.style.setProperty('--ha-column-count',String(Math.max(1,count)));
    }

    function buildEditorColumn(source, columns, ownerBlock) {
      const column=document.createElement('section');
      const retainedClasses=source?[...source.classList].filter(name=>name!=='ha-editor-column'):[];
      column.classList.add('ha-editor-column',...retainedClasses);
      const stack=document.createElement('div');
      stack.className='ha-editor-column-blocks';
      const nodes=source?[...source.childNodes].map(normalizeNode).filter(Boolean):[];
      if(!nodes.length){const empty=document.createElement('p');empty.innerHTML='<br>';nodes.push(empty);}
      nodes.forEach(node=>{
        const nested=makeBlock(blockType(node),node.outerHTML||'<p><br></p>');
        stack.append(nested);
        wireBlock(nested);
      });
      column.append(stack);
      wireEditorColumn(column,columns,ownerBlock);
      return column;
    }

    function wireEditorColumn(column, columns, ownerBlock) {
      const stack=column.querySelector(':scope > .ha-editor-column-blocks');
      if(!stack)return;
      let add=column.querySelector(':scope > .ha-editor-add-column');
      if(!add){
        add=document.createElement('button');
        add.type='button';
        add.className='ha-editor-add-column';
        add.textContent='+';
        column.append(add);
      }
      add.title='Add a column after this column';
      add.setAttribute('aria-label','Add a column after this column');
      add.dataset.haColumnInserter='true';
      add.onclick=event=>{
        event.preventDefault();
        event.stopPropagation();
        const next=buildEditorColumn(null,columns,ownerBlock);
        columns.insertBefore(next,column.nextSibling);
        updateColumnCount(columns);
        sync();
        const firstBlock=blocks(next.querySelector('.ha-editor-column-blocks'))[0];
        if(firstBlock)focusBlock(firstBlock);
      };
      stack.ondragover=event=>{
        if(event.dataTransfer?.types.includes('text/plain'))event.preventDefault();
      };
      stack.ondrop=event=>{
        if(event.target.closest('[data-ha-editor-block]')||!event.dataTransfer?.types.includes('text/plain'))return;
        event.preventDefault();
        const dragging=allBlocks().find(node=>node.classList.contains('is-dragging'));
        if(dragging&&!dragging.contains(ownerBlock)&&dragging!==ownerBlock){
          stack.append(dragging);
          sync();
        }
      };
      blocks(stack).forEach(wireBlock);
    }

    function wireColumns(block) {
      const content=contentFor(block);
      if(!content)return;
      let columns=content.querySelector(':scope > .ha-columns');
      if(!columns){
        const existing=document.createElement('div');
        existing.className='ha-columns';
        const first=document.createElement('section');
        first.innerHTML=content.innerHTML||'<p><br></p>';
        const second=document.createElement('section');
        second.innerHTML='<p><br></p>';
        existing.append(first,second);
        content.replaceChildren(existing);
        columns=existing;
      }
      if(!columns.classList.contains('ha-editor-columns-layout')){
        let sources=[...columns.children].filter(node=>node.tagName==='SECTION');
        if(!sources.length){
          const first=document.createElement('section');
          first.innerHTML=columns.innerHTML||'<p><br></p>';
          sources=[first];
        }
        if(sources.length===1)sources.push(document.createElement('section'));
        columns.classList.add('ha-editor-columns-layout');
        columns.replaceChildren(...sources.map(source=>buildEditorColumn(source,columns,block)));
      }else{
        [...columns.children].filter(node=>node.classList.contains('ha-editor-column')).forEach(column=>wireEditorColumn(column,columns,block));
      }
      updateColumnCount(columns);
    }

    function setSelected(block) {
      if (selected) selected.classList.remove('is-selected');
      selected = block || null;
      if (selected) selected.classList.add('is-selected');
    }

    function sync() {
      if (syncing) return;
      syncing = true;
      updateCanvasColumnControl();
      editor.dispatchEvent(new CustomEvent('ha-block-change',{bubbles:true}));
      onChange();
      syncing = false;
    }

    function closeMenu() {
      menu?.remove(); menu = null;
    }

    function insertMedia(type, block) {
      const fileTypes=['image','gallery','slideshow','tiled-gallery','cover','media-text','image-compare','audio','video','file','playlist','podcast'];
      if(fileTypes.includes(type)){
        if(typeof onUpload!=='function')return window.alert('Media uploads are not available in this editor session.');
        const dialog=document.createElement('div');dialog.className='ha-media-picker';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label','Add '+labelFor(type));
        const panel=document.createElement('div');panel.className='ha-media-picker-panel';
        const heading=document.createElement('h3');heading.textContent='ADD '+labelFor(type).toUpperCase();panel.append(heading);
        const help=document.createElement('p');help.textContent='Upload files from your device or reuse media already attached to this record.';panel.append(help);
        const input=document.createElement('input');input.type='file';input.accept=type==='image'||type==='gallery'||type==='slideshow'||type==='tiled-gallery'||type==='cover'||type==='media-text'||type==='image-compare'?'image/jpeg,image/png,image/webp,image/gif,image/avif':type==='audio'||type==='playlist'||type==='podcast'?'audio/mpeg,audio/mp4,audio/ogg,audio/wav,audio/webm':type==='video'?'video/mp4,video/webm':'image/jpeg,image/png,image/webp,image/gif,image/avif,audio/mpeg,audio/mp4,audio/ogg,audio/wav,audio/webm,video/mp4,video/webm';
        input.multiple=['gallery','slideshow','tiled-gallery','image-compare','playlist'].includes(type);input.className='ha-media-picker-input';input.setAttribute('aria-label','Choose media files');panel.append(input);
        const options=document.createElement('div');options.className='ha-media-picker-options';
        const altLabel=document.createElement('label');altLabel.textContent='Alternative text';const alt=document.createElement('input');alt.type='text';alt.placeholder='Describe the image';altLabel.append(alt);
        const captionLabel=document.createElement('label');captionLabel.textContent='Caption';const caption=document.createElement('input');caption.type='text';caption.placeholder='Optional caption';captionLabel.append(caption);
        if(['image','cover','media-text','gallery','slideshow','tiled-gallery','image-compare'].includes(type)){options.append(altLabel,captionLabel);panel.append(options);}
        const library=Array.isArray(getMediaLibrary(type))?getMediaLibrary(type):[];
        let librarySelect=null;
        if(library.length){
          const libraryLabel=document.createElement('label');libraryLabel.className='ha-media-picker-library-label';libraryLabel.textContent='THIS RECORD’S MEDIA LIBRARY';
          librarySelect=document.createElement('select');librarySelect.multiple=['gallery','slideshow','tiled-gallery','image-compare','playlist'].includes(type);librarySelect.size=Math.min(5,library.length);
          library.forEach((item,index)=>{
             const option=document.createElement('option');option.value=String(index);
             const detail=item.available===false?'NOT RECOVERED · '+(item.mime_type||item.type||'media'):(item.mime_type||item.type||'media');
             option.textContent=(item.name||'Media file')+' · '+detail;
             option.disabled=item.available===false;
             librarySelect.append(option);
           });
          libraryLabel.append(librarySelect);panel.append(libraryLabel);
        }
        const status=document.createElement('p');status.className='ha-media-picker-status';status.setAttribute('aria-live','polite');panel.append(status);
        const actions=document.createElement('div');actions.className='ha-media-picker-actions';
        const upload=document.createElement('button');upload.type='button';upload.textContent='UPLOAD & INSERT';upload.disabled=true;
        const reuse=document.createElement('button');reuse.type='button';reuse.textContent='USE SELECTED';reuse.disabled=!librarySelect||!library.some(item=>item.available!==false);
         librarySelect?.addEventListener('change',()=>{
           reuse.disabled=![...librarySelect.selectedOptions].some(option=>!option.disabled);
         });
        const cancel=document.createElement('button');cancel.type='button';cancel.textContent='CANCEL';actions.append(upload,reuse,cancel);panel.append(actions);dialog.append(panel);shell.append(dialog);
        const close=()=>dialog.remove();
        input.addEventListener('change',()=>{upload.disabled=!input.files?.length;status.textContent='';});
        input.addEventListener('cancel',event=>{
         event.stopPropagation();
         upload.disabled=!input.files?.length;
         status.textContent='FILE SELECTION UNCHANGED — THE CHAMBER REMAINS OPEN.';
        });
        cancel.addEventListener('click',close);
        dialog.addEventListener('click',event=>{if(event.target===dialog)close();});
        const build=(assets)=>{
          if(!assets.length)return window.alert('Choose at least one media item.');
          if(type==='image-compare'&&assets.length!==2)return window.alert('Choose exactly two images for an image comparison.');
          let html='';
          const safe=assets.filter(item=>item&&item.url).map(item=>({url:String(item.url),name:String(item.name||''),mime_type:String(item.mime_type||''),alt:alt.value.trim(),caption:caption.value.trim()}));
          if(!safe.length)return window.alert('The selected media has no usable URL.');
          const esc=value=>String(value||'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
          const figure=(item,index)=>'<figure><img src="'+esc(item.url)+'" alt="'+esc(item.alt||item.name)+'" loading="lazy"><figcaption contenteditable="true">'+esc(item.caption||item.name||('Image '+(index+1)))+'</figcaption></figure>';
          if(['image','cover','media-text'].includes(type)){
            const item=safe[0];
            if(type==='cover')html='<section class="ha-cover" style="--ha-cover-image:url(&quot;'+esc(item.url)+'&quot;)"><img src="'+esc(item.url)+'" alt="'+esc(item.alt||item.name)+'"><div class="ha-cover-content"><h2>Cover heading</h2><p>Write over the image…</p></div></section>';
            else if(type==='media-text')html='<div class="ha-media-text"><figure><img src="'+esc(item.url)+'" alt="'+esc(item.alt||item.name)+'" loading="lazy"><figcaption contenteditable="true">'+esc(item.caption)+'</figcaption></figure><section><h2>Heading</h2><p>Write alongside your media…</p></section></div>';
            else html=figure(item,0);
          }else if(['gallery','slideshow','tiled-gallery','image-compare'].includes(type)){
            if(type==='image-compare')html='<div class="ha-image-compare">'+safe.map((item,index)=>figure(item,index)).join('')+'</div>';
            else html='<div class="'+(type==='slideshow'?'ha-slideshow':type==='tiled-gallery'?'ha-tiled-gallery':'ha-gallery')+'">'+safe.map(figure).join('')+'</div>';
          }else if(type==='video'){
            const item=safe[0];html='<figure><video controls playsinline preload="metadata" src="'+esc(item.url)+'"></video><figcaption contenteditable="true">'+esc(item.caption||item.name)+'</figcaption></figure>';
          }else if(type==='file'){
            const item=safe[0];html='<p class="ha-file-block"><a href="'+esc(item.url)+'" download>'+esc(item.name||'Download file')+'</a></p>';
          }else{
            html='<div class="'+(type==='podcast'?'ha-podcast':type==='playlist'?'ha-playlist':'ha-audio-block')+'">'+safe.map(item=>'<figure><audio controls preload="metadata" src="'+esc(item.url)+'"></audio><figcaption contenteditable="true">'+esc(item.name)+'</figcaption></figure>').join('')+'</div>';
          }
          const next=makeBlock(type,html);if(block)block.after(next);else editor.append(next);wireBlock(next);setSelected(next);focusBlock(next);sync();close();
        };
        upload.addEventListener('click',async()=>{
          const files=[...input.files||[]];if(!files.length)return;
          upload.disabled=true;reuse.disabled=true;status.textContent='UPLOADING MEDIA…';
          try{const assets=await onUpload(files,type);build(assets||[]);}
          catch(error){status.textContent='UPLOAD FAILED — '+String(error?.message||'PLEASE TRY AGAIN');upload.disabled=false;reuse.disabled=!librarySelect;}
        });
        reuse.addEventListener('click',()=>{
          if(!librarySelect)return;
          const chosen=[...librarySelect.selectedOptions].map(option=>library[Number(option.value)]).filter(Boolean);
          if(!chosen.length)return window.alert('Select media from the library first.');
          build(chosen);
        });
        return;
      }
      const raw=window.prompt('Paste a YouTube, Spotify, SoundCloud, Vimeo, TikTok, Instagram, Facebook, Dailymotion, Loom, TED, CodePen, Reddit or Mixcloud URL');
      if(!raw)return;
      let url;try{url=new URL(raw.trim());}catch{return window.alert('Enter a valid embed URL.');}
      const host=url.hostname.toLowerCase();
      if(!EMBED_HOSTS.has(host))return window.alert('That provider is not in the secure embed allowlist.');
      if(['youtube','spotify','soundcloud'].includes(type)&&!((type==='youtube'&&['www.youtube.com','youtube.com','www.youtube-nocookie.com','youtu.be'].includes(host))||(type==='spotify'&&host==='open.spotify.com')||(type==='soundcloud'&&['w.soundcloud.com','soundcloud.com'].includes(host))))return window.alert('The URL does not match the selected embed block.');
      if(host==='youtu.be'){const id=url.pathname.slice(1).split('/')[0];if(!/^[\w-]{6,20}$/.test(id))return window.alert('That YouTube URL is not valid.');url=new URL('https://www.youtube-nocookie.com/embed/'+id);}
      else if(['www.youtube.com','youtube.com'].includes(host)&&url.pathname==='/watch'){const id=url.searchParams.get('v');if(!id||!/[\w-]{6,20}/.test(id))return window.alert('That YouTube URL is not valid.');url=new URL('https://www.youtube-nocookie.com/embed/'+id);}
      else if(['www.youtube.com','youtube.com'].includes(host)&&url.pathname.startsWith('/shorts/')){const id=url.pathname.split('/')[2];if(!/^[\w-]{6,20}$/.test(id))return window.alert('That YouTube URL is not valid.');url=new URL('https://www.youtube-nocookie.com/embed/'+id);}
      else if(host==='open.spotify.com'&&!url.pathname.includes('/embed/'))url.pathname='/embed'+url.pathname;
      else if(host==='soundcloud.com')url=new URL('https://w.soundcloud.com/player/?url='+encodeURIComponent(url.href));
      else if(host==='vimeo.com'){const id=url.pathname.split('/').filter(Boolean)[0];if(!/^\d+$/.test(id||''))return window.alert('That Vimeo URL is not valid.');url=new URL('https://player.vimeo.com/video/'+id);}
      else if(host==='www.dailymotion.com'&&url.pathname.startsWith('/video/')){const id=url.pathname.split('/')[2];url=new URL('https://www.dailymotion.com/embed/video/'+id);}
      else if(host==='www.loom.com'&&url.pathname.startsWith('/share/'))url=new URL('https://www.loom.com/embed/'+url.pathname.split('/')[2]);
      const src=safeURL(url.href,EMBED_HOSTS);if(!src)return window.alert('That embed URL is not supported.');
      const iframeHosts=['www.youtube-nocookie.com','open.spotify.com','w.soundcloud.com','player.vimeo.com','www.dailymotion.com','www.loom.com'];
      let html;
      if(!iframeHosts.includes(new URL(src).hostname)){const link=document.createElement('a');link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';link.className='ha-embed-link';link.textContent='OPEN EMBED — '+url.hostname;html='<div class="ha-embed-card">'+link.outerHTML+'</div>';}
      else html='<figure class="ha-embed ha-embed-'+type+'"><iframe src="'+src+'" title="Embedded media" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe><figcaption contenteditable="true">Embedded media</figcaption></figure>';
      const next=makeBlock(type,html);if(block)block.after(next);else editor.append(next);wireBlock(next);setSelected(next);focusBlock(next);sync();
    }

    function focusBlock(block) {
      const ownContent=contentFor(block);
      const markdownInput=ownContent?.querySelector('.ha-markdown-input');
      const target=markdownInput || (ownContent?.contentEditable==='true'?ownContent:ownContent?.querySelector('[data-ha-block-content][contenteditable="true"]'));
      if (!target) return;
      target.focus();
      if(target.tagName==='TEXTAREA'){
        target.setSelectionRange(target.value.length,target.value.length);
        return;
      }
      const editableBlocks=target.querySelectorAll('p,h1,h2,h3,h4,li,pre,blockquote');
      const caretTarget=editableBlocks[editableBlocks.length-1]||target;
      const range = document.createRange();
      range.selectNodeContents(caretTarget);
      range.collapse(false);
      const selection = window.getSelection();
      selection.removeAllRanges(); selection.addRange(range);
    }

    function createMenu(anchor, block, pointer = null, initialFilter = '') {
      closeMenu();
      menu = document.createElement('div'); menu.className = 'ha-block-inserter-menu'; menu.setAttribute('role','dialog'); menu.setAttribute('aria-label','Choose a block');
      const search = document.createElement('input'); search.type='search'; search.className='ha-block-search'; search.placeholder='Search all blocks…'; search.setAttribute('aria-label','Search blocks'); menu.append(search);
      const results = document.createElement('div'); results.className='ha-block-results'; menu.append(results);
      const menuInstance=++inserterMenuSequence;
      function render(filter='') {
        results.replaceChildren();
        const q=filter.trim().toLowerCase();
        const grouped=new Map();
        TYPES.filter(([type,label,category])=>!q||(type+' '+label+' '+category).toLowerCase().includes(q)).forEach(item=>{
          const category=item[2];
          if(!grouped.has(category))grouped.set(category,[]);
          grouped.get(category).push(item);
        });
        let count=0;
        for(const [category,items] of grouped){
          const group=document.createElement('section');
          group.className='ha-block-category-group';
          const heading=document.createElement('button');
          heading.type='button';heading.className='ha-block-category';
          heading.textContent=category;
          heading.setAttribute('aria-expanded','true');
          const categoryItems=document.createElement('div');
          categoryItems.className='ha-block-category-items';
          categoryItems.id='ha-block-category-'+menuInstance+'-'+category.toLowerCase().replace(/[^a-z0-9]+/g,'-');
          heading.setAttribute('aria-controls',categoryItems.id);
          heading.addEventListener('click',()=>{
            const expanded=heading.getAttribute('aria-expanded')==='true';
            heading.setAttribute('aria-expanded',String(!expanded));
            categoryItems.hidden=expanded;
          });
          group.append(heading,categoryItems);
          for(const [type,label] of items){
            const button=document.createElement('button');button.type='button';button.className='ha-block-option';button.textContent=label;button.setAttribute('role','menuitem');
            button.addEventListener('click',()=>{closeMenu();if(['image','gallery','slideshow','tiled-gallery','cover','audio','video','file','embed','youtube','spotify','soundcloud','podcast','playlist','media-text','image-compare'].includes(type))return insertMedia(type,block);const next=makeBlock(type,defaultHTML(type));if(block)block.after(next);else editor.append(next);wireBlock(next);setSelected(next);focusBlock(next);sync();});
            categoryItems.append(button);count++;
          }
          results.append(group);
        }
        if(!count){const empty=document.createElement('p');empty.className='ha-block-empty';empty.textContent='No matching blocks';results.append(empty);}
      }
      search.addEventListener('input',()=>render(search.value));
      search.value=String(initialFilter||'');
      render(search.value);
      const anchorRect=anchor.getBoundingClientRect(),shellRect=shell.getBoundingClientRect();
      const usePointer=pointer?.valid!==false&&Number.isFinite(pointer?.x)&&Number.isFinite(pointer?.y);
      const x=usePointer?pointer.x:anchorRect.left;
      const y=usePointer?pointer.y:anchorRect.bottom;
      menu.style.left=(x-shellRect.left+shell.scrollLeft)+'px';
      menu.style.top=(y-shellRect.top+shell.scrollTop)+'px';
      shell.append(menu);search.focus();
    }

    function addBlockControls(block) {
      const type = block.dataset.haBlock || 'paragraph';
      refreshBlockName(block);
      const blockName = block.querySelector(':scope > .ha-editor-block-controls > .ha-editor-block-name');
      blockName?.addEventListener('click',()=>{
        const next=window.prompt('Rename block',displayBlockName(block));
        if(next===null)return;
        const value=String(next).replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,80);
        if(value)block.dataset.haBlockName=value;else delete block.dataset.haBlockName;
        refreshBlockName(block);
        sync();
      });
      const grip = block.querySelector(':scope > .ha-editor-block-controls > .ha-editor-block-grip');
      if(grip)grip.draggable=true;
      const actions = block.querySelector(':scope > .ha-editor-block-controls > .ha-editor-block-actions');
      if(!actions)return;
      actions.replaceChildren();
      const transform = document.createElement('select');
      transform.className = 'ha-editor-block-transform';
      transform.setAttribute('aria-label','Transform block');
      TYPES.filter(([key]) => !['image','gallery','slideshow','tiled-gallery','cover','media-text','image-compare','audio','video','file','playlist','podcast','embed','youtube','spotify','soundcloud','separator','spacer'].includes(key)).forEach(([key,label]) => {
        if(key==='heading'){
          [['h1','Heading 1'],['h2','Heading 2'],['h3','Heading 3'],['h4','Heading 4']].forEach(([value,text])=>{const option=document.createElement('option');option.value=value;option.textContent=text;transform.append(option);});
        }else{const option = document.createElement('option'); option.value=key; option.textContent=label; transform.append(option);}
      });
      const currentContent=contentFor(block)?.firstElementChild;
      transform.value = /^H[1-4]$/.test(currentContent?.tagName||'') ? currentContent.tagName.toLowerCase() : (['image','audio','video','embed','separator','classic'].includes(type) ? 'paragraph' : type==='heading'?'h2':type);
      transform.addEventListener('change',() => transformBlock(block,transform.value));
      if(['classic','image','gallery','slideshow','tiled-gallery','cover','media-text','image-compare','audio','video','file','playlist','podcast','embed','youtube','spotify','soundcloud','separator','spacer'].includes(type))transform.disabled=true;
      actions.append(transform);

      if(type==='markdown'){
        const colourLabel=document.createElement('label');
        colourLabel.className='ha-markdown-color-control';
        colourLabel.title='Change Markdown text colour';
        colourLabel.setAttribute('aria-label','Change Markdown text colour');
        const colour=document.createElement('input');
        colour.type='color';
        colour.className='ha-markdown-color-picker';
        colour.value=normalizeMarkdownColor(contentFor(block)?.querySelector('.ha-markdown-editor')?.style.getPropertyValue('--ha-md-base-color'));
        colour.setAttribute('aria-label','Markdown text colour');
        colour.title='Markdown text colour';
        colour.addEventListener('input',()=>{
          const markdownEditor=contentFor(block)?.querySelector('.ha-markdown-editor');
          if(markdownEditor)markdownEditor.style.setProperty('--ha-md-base-color',normalizeMarkdownColor(colour.value));
          sync();
        });
        colourLabel.append(colour);
        actions.append(colourLabel);
      }

      const up = document.createElement('button'); up.type='button'; up.textContent='↑'; up.title='Move block up'; up.setAttribute('aria-label','Move block up');
      up.addEventListener('click',() => { const siblings=blocks(block.parentElement),index=siblings.indexOf(block),previous=siblings[index-1];if(previous){block.parentNode.insertBefore(block,previous);sync();} });
      const down = document.createElement('button'); down.type='button'; down.textContent='↓'; down.title='Move block down'; down.setAttribute('aria-label','Move block down');
      down.addEventListener('click',() => { const siblings=blocks(block.parentElement),index=siblings.indexOf(block),next=siblings[index+1];if(next){block.parentNode.insertBefore(next,block);sync();} });
      const duplicate = document.createElement('button'); duplicate.type='button'; duplicate.textContent='＋'; duplicate.title='Duplicate block'; duplicate.setAttribute('aria-label','Duplicate block');
      duplicate.addEventListener('click',() => {
        const copy=block.cloneNode(true);
        const markdownValue=block.querySelector('.ha-markdown-input')?.value;
        if(markdownValue!==undefined){
          const markdownEditor=block.querySelector('.ha-markdown-editor');
          const markdownColor=normalizeMarkdownColor(markdownEditor?.style.getPropertyValue('--ha-md-base-color'));
          const copiedContent=contentFor(copy);
          copiedContent?.querySelector(':scope > .ha-markdown-editor')?.replaceWith(createMarkdownEditor(markdownValue,markdownColor));
        }
        [copy,...copy.querySelectorAll('[data-ha-editor-block]')].forEach(node=>{delete node.dataset.haEditorWired;});
        block.after(copy);wireBlock(copy);setSelected(copy);sync();
      });
      const remove = document.createElement('button'); remove.type='button'; remove.textContent='×'; remove.title='Delete block'; remove.setAttribute('aria-label','Delete block');
      remove.addEventListener('click',() => {
        const parent=block.parentElement;
        const siblings=blocks(parent);
        const next=siblings[siblings.indexOf(block)+1]||siblings[siblings.indexOf(block)-1]||null;
        block.remove();
        if(!blocks(parent).length){const empty=makeBlock('paragraph','<p><br></p>');parent.append(empty);wireBlock(empty);setSelected(empty);}
        else setSelected(next);
        sync();
      });
      [up,down,duplicate,remove].forEach(button=>actions.append(button));
      block.querySelector(':scope > .ha-editor-block-footer > .ha-editor-add-after').addEventListener('click',event=>createMenu(event.currentTarget,block,{x:event.clientX,y:event.clientY,valid:event.detail!==0}));
    }

    function transformBlock(block,type) {
      const current=contentFor(block);
      const first=current?.firstElementChild;
      const plain=document.createElement('span');
      plain.textContent=current?.querySelector('.ha-markdown-input')?.value ?? current?.textContent ?? '';
      const inlineHTML=first&&['P','H1','H2','H3','H4'].includes(first.tagName)?first.innerHTML:plain.innerHTML;
      const quoteHTML=first?.tagName==='BLOCKQUOTE'?first.innerHTML:'<p>'+inlineHTML+'</p>';
      let html=inlineHTML;
      if(/^h[1-4]$/.test(type)) html='<'+type+'>'+inlineHTML+'</'+type+'>';
      else if(type==='paragraph') html='<p>'+inlineHTML+'</p>';
      else if(type==='quote') html='<blockquote>'+quoteHTML+'</blockquote>';
      else if(type==='preformatted'||type==='code') html=type==='code'?'<pre><code>'+plain.innerHTML+'</code></pre>':'<pre>'+plain.innerHTML+'</pre>';
      else if(type==='unordered-list') html='<ul><li>'+plain.innerHTML+'</li></ul>';
      else if(type==='ordered-list') html='<ol><li>'+plain.innerHTML+'</li></ol>';
      if(type==='columns')html=defaultHTML('columns');
      const next=makeBlock(/^h[1-4]$/.test(type)?'heading':type,html);
      if(block.dataset.haBlockName)next.dataset.haBlockName=block.dataset.haBlockName;
      block.replaceWith(next); wireBlock(next); setSelected(next); focusBlock(next); sync();
    }

    function wireBlock(block) {
      if(!block||block.dataset.haEditorWired==='true')return;
      block.dataset.haEditorWired='true';
      const storedName=contentFor(block)?.firstElementChild?.getAttribute('data-ha-block-name');
      if(storedName&&!block.dataset.haBlockName)block.dataset.haBlockName=String(storedName).trim().slice(0,80);
      if(block.dataset.haBlock==='columns')wireColumns(block);
      addBlockControls(block);
      block.addEventListener('focusin',event=>{if(event.target.closest?.('[data-ha-editor-block]')===block)setSelected(block);});
      block.addEventListener('click',event=>{
        if(event.target.closest?.('[data-ha-editor-block]')!==block)return;
        if(!event.target.closest('button,select'))setSelected(block);
      });
      block.addEventListener('dragstart',event=>{
        if(event.target.closest?.('[data-ha-editor-block]')!==block)return;
        draggingBlock=block;
        block.classList.add('is-dragging');
        event.dataTransfer?.setData('text/plain','ha-block');
      });
      block.addEventListener('dragend',event=>{
        if(event.target.closest?.('[data-ha-editor-block]')!==block)return;
        block.classList.remove('is-dragging');
        draggingBlock=null;
        allBlocks().forEach(node=>node.classList.remove('is-drop-before','is-drop-after'));
      });
      block.addEventListener('dragover',event=>{
        if(event.target.closest?.('[data-ha-editor-block]')!==block||!event.dataTransfer?.types.includes('text/plain'))return;
        event.preventDefault();
        if(!draggingBlock||draggingBlock===block||draggingBlock.contains(block))return;
        const rect=block.getBoundingClientRect();
        const after=event.clientY>=rect.top+rect.height/2;
        block.classList.toggle('is-drop-after',after);
        block.classList.toggle('is-drop-before',!after);
      });
      block.addEventListener('dragleave',event=>{
        if(!block.contains(event.relatedTarget))block.classList.remove('is-drop-before','is-drop-after');
      });
      block.addEventListener('drop',event=>{
        if(event.target.closest?.('[data-ha-editor-block]')!==block||!event.dataTransfer?.types.includes('text/plain'))return;
        event.preventDefault();
        const dragging=draggingBlock||allBlocks().find(node=>node.classList.contains('is-dragging'));
        if(dragging&&dragging!==block&&!dragging.contains(block)){
          const rect=block.getBoundingClientRect();
          const after=event.clientY>=rect.top+rect.height/2;
          const reference=after?block.nextSibling:block;
          const alreadyThere=dragging.parentNode===block.parentNode&&(after?dragging===reference:dragging.nextSibling===block);
          if(!alreadyThere){block.parentNode.insertBefore(dragging,reference);sync();}
        }
        allBlocks().forEach(node=>node.classList.remove('is-drop-before','is-drop-after'));
      });
      const content=contentFor(block);
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
                 if(hosts){
                   const safe=safeEditorMediaURL(value,hosts,mediaBasePath);
                   let valid=Boolean(safe);
                   if(valid&&['AUDIO','VIDEO','SOURCE'].includes(node.tagName)){
                     const url=new URL(safe,window.location.href);
                     const mediaBaseValue=String(mediaBasePath || '/landing-page'); const normalizedMediaBase=mediaBaseValue.endsWith('/') ? mediaBaseValue.slice(0,-1) : mediaBaseValue; valid=(url.protocol==='blob:'&&url.origin===window.location.origin)||(url.origin===window.location.origin&&url.pathname.startsWith(normalizedMediaBase+'/media/'));
                   }
                   if(valid)node.setAttribute('src',safe);else node.removeAttribute(attribute.name);
                 }
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
          if(first){const type=blockType(first);block.dataset.haBlock=type;refreshBlockName(block);}
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

    addTop?.addEventListener('click',event=>createMenu(addTop,null,{x:event.clientX,y:event.clientY,valid:event.detail!==0}));
    addMediaTop?.addEventListener('click',event=>createMenu(addMediaTop,null,{x:event.clientX,y:event.clientY,valid:event.detail!==0},'Media'));
    addColumnTop?.addEventListener('click',addCanvasColumn);
    shell.addEventListener('keydown',event=>{if(event.key==='Escape'&&menu){event.preventDefault();closeMenu();(addTop||editor).focus();}});
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
      if(topbar)topbar.hidden=true;
      allBlocks().forEach(block=>{
        block.querySelector(':scope > .ha-editor-block-controls')?.remove();
        block.querySelector(':scope > .ha-editor-block-footer')?.remove();
        const content=contentFor(block);
        if(content){
          content.contentEditable='false';
          content.querySelectorAll('textarea,input').forEach(control=>{control.readOnly=true;});
        }
      });
      editor.querySelectorAll('.ha-editor-add-column').forEach(button=>button.remove());
    } else {
      editor.addEventListener('input',sync);
    }

    function serializeContent(content, ownerBlock=null) {
      const markdownInput=content.querySelector(':scope > .ha-markdown-editor > .ha-markdown-input');
      if(markdownInput){
        const holder=document.createElement('div');
        const source=document.createElement('pre');
        source.className='ha-markdown-source';
        source.textContent=markdownInput.value;
        const markdownColor=normalizeMarkdownColor(content.querySelector(':scope > .ha-markdown-editor')?.style.getPropertyValue('--ha-md-base-color'));
        source.setAttribute('data-ha-text-color',markdownColor);
        holder.append(source);
        const name=String(ownerBlock?.dataset.haBlockName||'').replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,80);
        if(name)source.setAttribute('data-ha-block-name',name);
        return holder.innerHTML;
      }
      const clone=content.cloneNode(true);
      const applyBlockName=(target,block)=>{
        const root=target?.firstElementChild;
        if(!root)return;
        const name=String(block?.dataset.haBlockName||'').replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,80);
        if(name)root.setAttribute('data-ha-block-name',name);
        else root.removeAttribute('data-ha-block-name');
      };
      [...clone.querySelectorAll('[data-ha-editor-block]')].reverse().forEach(wrapper=>{
        const nestedContent=wrapper.querySelector(':scope > .ha-editor-block-content');
        const fragment=document.createDocumentFragment();
        if(nestedContent){applyBlockName(nestedContent,wrapper);[...nestedContent.childNodes].forEach(node=>fragment.append(node.cloneNode(true)));}
        wrapper.replaceWith(fragment);
      });
      applyBlockName(clone,ownerBlock);
      clone.querySelectorAll('.ha-editor-add-column,.ha-editor-block-controls,.ha-editor-block-footer').forEach(node=>node.remove());
      clone.querySelectorAll('.ha-editor-column-blocks').forEach(stack=>stack.replaceWith(...stack.childNodes));
      clone.querySelectorAll('.ha-editor-column').forEach(column=>column.classList.remove('ha-editor-column'));
      clone.querySelectorAll('.ha-editor-columns-layout').forEach(columns=>columns.classList.remove('ha-editor-columns-layout'));
      clone.querySelectorAll('.ha-columns').forEach(columns=>{
        columns.style.removeProperty('--ha-column-count');
        if(!columns.getAttribute('style')?.trim())columns.removeAttribute('style');
      });
      clone.querySelectorAll('[contenteditable]').forEach(node=>node.removeAttribute('contenteditable'));
      return clone.innerHTML;
    }

    function updateCanvasColumnControl() {
      if (!addCanvasColumnButton) return;
      const rootBlocks = blocks();
      const hasRootColumns = rootBlocks.length === 1 && rootBlocks[0].dataset.haBlock === 'columns';
      addCanvasColumnButton.hidden = readOnly || hasRootColumns;
    }

    function addCanvasColumn() {
      const rootBlocks = blocks();
      if (rootBlocks.length === 1 && rootBlocks[0].dataset.haBlock === 'columns') {
        const owner = rootBlocks[0];
        const columns = contentFor(owner)?.querySelector(':scope > .ha-columns');
        if (!columns) return;
        const previous = [...columns.children].filter(node => node.classList.contains('ha-editor-column')).at(-1);
        const next = buildEditorColumn(null, columns, owner);
        if (previous) previous.after(next);
        else columns.append(next);
        updateColumnCount(columns);
        sync();
        const first = blocks(next.querySelector(':scope > .ha-editor-column-blocks'))[0];
        if (first) focusBlock(first);
        return;
      }

      const contentHTML = rootBlocks
        .map(block => serializeContent(contentFor(block),block))
        .filter(Boolean)
        .join('');
      const initialColumn = contentHTML || '<p><br></p>';
      const layoutHTML = '<div class="ha-columns"><section>' + initialColumn + '</section><section><p><br></p></section></div>';
      const columnsBlock = makeBlock('columns', layoutHTML);
      editor.replaceChildren(columnsBlock);
      wireBlock(columnsBlock);
      setSelected(columnsBlock);

      const columns = contentFor(columnsBlock)?.querySelector(':scope > .ha-columns');
      updateColumnCount(columns);
      sync();
      const secondColumn = [...(columns?.children || [])].find(node => node.classList.contains('ha-editor-column'));
      const first = blocks(secondColumn?.querySelector(':scope > .ha-editor-column-blocks'))[0];
      if (first) focusBlock(first);
    }

    if (!readOnly) {
      addCanvasColumnButton = document.createElement('button');
      addCanvasColumnButton.type = 'button';
      addCanvasColumnButton.className = 'ha-editor-add-canvas-column';
      addCanvasColumnButton.textContent = '+';
      addCanvasColumnButton.title = 'Split the block stream into columns';
      addCanvasColumnButton.setAttribute('aria-label', 'Split the block stream into columns');
      addCanvasColumnButton.addEventListener('click', addCanvasColumn);
      shell.append(addCanvasColumnButton);
    }
    updateCanvasColumnControl();

    const api = {
      getHTML() {
        const holder=document.createElement('div');
        blocks().forEach(block=>{
          const content=contentFor(block);
          if(content){const wrapper=document.createElement('div');wrapper.innerHTML=serializeContent(content,block);holder.append(...wrapper.childNodes);}
        });
        return holder.innerHTML;
      },
      getBlocks() {
        return blocks().map((block,index)=>{
          const content=contentFor(block);
          return content ? {
            id:block.dataset.haBlockId || 'block-'+String(index+1).padStart(3,'0'),
            type:block.dataset.haBlock || 'classic',
            name:displayBlockName(block),
            html:serializeContent(content,block)
          } : null;
        }).filter(Boolean);
      },
      getText() {
        return blocks().map(block=>{
          const content=contentFor(block);
          if(!content)return '';
          const parsed=document.createElement('div');
          parsed.innerHTML=serializeContent(content,block);
          const text=parsed.innerText||parsed.textContent||'';
          return text.trim()||(parsed.querySelector('img,audio,video,iframe')?'media':'');
        }).filter(Boolean).join('\\n\\n');
      },
      replaceHTML(html) { this.destroy(); editor.innerHTML=String(html||'<p><br></p>'); return mountBlockEditor({editor,onChange,onUpload,getMediaLibrary,readOnly,showTopbar,mediaBasePath}); },
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