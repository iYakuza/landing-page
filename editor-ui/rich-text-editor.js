(() => {
  'use strict';

  function mountRichTextEditor({
    editor,
    editors = [],
    toolbar,
    focusButton,
    insertLinkButton,
    onChange = () => {},
    onInvalidLink = () => {},
    focusClass = 'cms-writing-focus',
    draggableToolbar = true
  } = {}) {
    const targets = [...new Set([editor, ...editors].filter(item => item instanceof HTMLElement))];
    if (!targets.length || !(toolbar instanceof HTMLElement) || !(focusButton instanceof HTMLElement)) {
      throw new TypeError('The rich-text editor requires at least one editor, a toolbar, and a focus button.');
    }
    let activeEditor = targets[0].querySelector('[data-ha-block-content][contenteditable="true"]') || targets[0];
    const listeners = new AbortController();
    const signal = listeners.signal;
    targets.forEach(target => {
      target.addEventListener('focusin', event => { activeEditor = event.target.closest('[data-ha-block-content]') || target; }, { signal });
      target.addEventListener('input', onChange, { signal });
      target.addEventListener('keydown', event => {
        if (event.target.closest('[data-ha-block-content]')) return;
        if (event.key !== 'Enter' || event.isComposing || event.defaultPrevented) return;
        event.preventDefault();
        document.execCommand(event.shiftKey ? 'insertLineBreak' : 'insertParagraph', false, null);
        onChange();
      }, { signal });
    });

    toolbar.addEventListener('mousedown', event => {
      if (event.target.closest('button')) event.preventDefault();
    }, { signal });

    toolbar.querySelectorAll('[data-command]').forEach(button => {
      button.addEventListener('click', () => {
        activeEditor.focus();
        const command = button.dataset.command;
        if (command === 'formatBlock') {
          document.execCommand(command, false, '<' + button.dataset.value + '>');
        } else {
          document.execCommand(command, false, null);
        }
        onChange();
      }, { signal });
    });

    insertLinkButton?.addEventListener('click', () => {
      activeEditor.focus();
      const url = window.prompt('Enter an https:// or mailto: link');
      if (url && /^(https?:\/\/|mailto:)/i.test(url.trim())) {
        document.execCommand('createLink', false, url.trim());
        onChange();
      } else if (url) {
        onInvalidLink('Only https:// and mailto: links are allowed.');
      }
    }, { signal });

    let toolbarDrag = null;
    let toolbarWasDragged = false;

    function setWritingFocus(active) {
      document.body.classList.toggle(focusClass, active);
      focusButton.setAttribute('aria-pressed', String(active));
      focusButton.setAttribute('aria-label', active ? 'Exit focused writing mode' : 'Open focused writing mode');
      focusButton.title = active ? 'Return to the full post editor' : 'Focused writing mode';
      focusButton.textContent = active ? 'EXIT FOCUS' : 'T';
      if (active) window.requestAnimationFrame(() => activeEditor.focus());
    }

    focusButton.addEventListener('click', () => {
      setWritingFocus(!document.body.classList.contains(focusClass));
    }, { signal });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && document.body.classList.contains(focusClass)) {
        event.preventDefault();
        setWritingFocus(false);
        focusButton.focus();
      }
    }, { signal });

    let chain = null;
    if(draggableToolbar){
     const chain = document.createElement('span');
     chain.className = 'toolbar-invisible-chain';
     chain.dataset.toolbarDrag = '';
     chain.setAttribute('aria-label', 'Drag the invisible toolbar chain to move all formatting buttons');
     chain.setAttribute('role', 'separator');
     chain.setAttribute('tabindex', '0');
     chain.title = 'Drag here to move the complete formatting toolbar';
     toolbar.prepend(chain);
 
     chain.addEventListener('keydown', event => {
       const step = event.shiftKey ? 24 : 8;
       if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
       event.preventDefault();
       const rect = toolbar.getBoundingClientRect();
       toolbar.style.transform = 'none';
       toolbar.style.left = (rect.left + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0)) + 'px';
       toolbar.style.top = (rect.top + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0)) + 'px';
     }, { signal });
 
     toolbar.addEventListener('pointerdown', event => {
       const onChain = event.target.closest('[data-toolbar-drag]');
       if (!onChain) return;
       const rect = toolbar.getBoundingClientRect();
       toolbarDrag = {
         id: event.pointerId,
         x: event.clientX,
         y: event.clientY,
         left: rect.left,
         top: rect.top,
         started: true
       };
       toolbarWasDragged = false;
       event.preventDefault();
       toolbar.setPointerCapture?.(event.pointerId);
     }, { signal });
 
     document.addEventListener('pointermove', event => {
       if (!toolbarDrag || toolbarDrag.id !== event.pointerId) return;
       const dx = event.clientX - toolbarDrag.x;
       const dy = event.clientY - toolbarDrag.y;
       if (!toolbarDrag.started && Math.hypot(dx, dy) < 5) return;
       toolbarDrag.started = true;
       toolbarWasDragged = true;
       event.preventDefault();
       toolbar.style.transform = 'none';
       const maxLeft = Math.max(8, window.innerWidth - toolbar.offsetWidth - 8);
       const maxTop = Math.max(8, window.innerHeight - toolbar.offsetHeight - 8);
       toolbar.style.left = Math.max(8, Math.min(maxLeft, toolbarDrag.left + dx)) + 'px';
       toolbar.style.top = Math.max(8, Math.min(maxTop, toolbarDrag.top + dy)) + 'px';
     }, { signal });
 
     const finishToolbarDrag = event => {
       if (!toolbarDrag || toolbarDrag.id !== event.pointerId) return;
       const dragged = toolbarWasDragged;
       toolbarDrag = null;
       if (dragged) {
         toolbar.dataset.suppressClick = 'true';
         window.setTimeout(() => { delete toolbar.dataset.suppressClick; }, 0);
       }
     };
     document.addEventListener('pointerup', finishToolbarDrag, { signal });
     document.addEventListener('pointercancel', finishToolbarDrag, { signal });
     toolbar.addEventListener('click', event => {
       if (toolbar.dataset.suppressClick === 'true') {
         event.preventDefault();
         event.stopImmediatePropagation();
       }
     }, { capture: true, signal });
    }

    return {
      setFocus: setWritingFocus,
      destroy() {
        setWritingFocus(false);
        listeners.abort();
        chain?.remove();
        toolbar.style.removeProperty('left');
        toolbar.style.removeProperty('top');
        toolbar.style.removeProperty('transform');
        toolbar.style.removeProperty('position');
      }
    };
  }

  window.VHAEditorUI = Object.freeze({ mountRichTextEditor });
})();
