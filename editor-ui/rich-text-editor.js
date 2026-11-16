(() => {
  'use strict';

  function mountRichTextEditor({
    editor,
    toolbar,
    focusButton,
    insertLinkButton,
    onChange = () => {},
    onInvalidLink = () => {},
    focusClass = 'cms-writing-focus'
  } = {}) {
    if (!(editor instanceof HTMLElement) || !(toolbar instanceof HTMLElement) || !(focusButton instanceof HTMLElement)) {
      throw new TypeError('The rich-text editor requires an editor, toolbar, and focus button.');
    }

    toolbar.querySelectorAll('[data-command]').forEach(button => {
      button.addEventListener('click', () => {
        editor.focus();
        const command = button.dataset.command;
        if (command === 'formatBlock') {
          document.execCommand(command, false, '<' + button.dataset.value + '>');
        } else {
          document.execCommand(command, false, null);
        }
        onChange();
      });
    });

    insertLinkButton?.addEventListener('click', () => {
      editor.focus();
      const url = window.prompt('Enter an https:// or mailto: link');
      if (url && /^(https?:\/\/|mailto:)/i.test(url.trim())) {
        document.execCommand('createLink', false, url.trim());
        onChange();
      } else if (url) {
        onInvalidLink('Only https:// and mailto: links are allowed.');
      }
    });

    editor.addEventListener('input', onChange);

    let toolbarDrag = null;
    let toolbarWasDragged = false;

    function setWritingFocus(active) {
      document.body.classList.toggle(focusClass, active);
      focusButton.setAttribute('aria-pressed', String(active));
      focusButton.setAttribute('aria-label', active ? 'Exit focused writing mode' : 'Open focused writing mode');
      focusButton.title = active ? 'Return to the full post editor' : 'Focused writing mode';
      focusButton.textContent = active ? 'EXIT FOCUS' : 'T';
      if (active) window.requestAnimationFrame(() => editor.focus());
    }

    focusButton.addEventListener('click', () => {
      setWritingFocus(!document.body.classList.contains(focusClass));
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && document.body.classList.contains(focusClass)) {
        event.preventDefault();
        setWritingFocus(false);
        focusButton.focus();
      }
    });

    const chain = document.createElement('span');
    chain.className = 'toolbar-invisible-chain';
    chain.dataset.toolbarDrag = '';
    chain.setAttribute('aria-label', 'Drag the invisible toolbar chain to move all formatting buttons');
    chain.setAttribute('role', 'separator');
    chain.setAttribute('tabindex', '0');
    chain.title = 'Drag here to move the complete formatting toolbar';
    toolbar.prepend(chain);

    chain.addEventListener('keydown', event => {
      if (!document.body.classList.contains(focusClass)) return;
      const step = event.shiftKey ? 24 : 8;
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      const rect = toolbar.getBoundingClientRect();
      toolbar.style.transform = 'none';
      toolbar.style.left = (rect.left + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0)) + 'px';
      toolbar.style.top = (rect.top + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0)) + 'px';
    });

    toolbar.addEventListener('pointerdown', event => {
      if (!document.body.classList.contains(focusClass)) return;
      const onChain = event.target.closest('[data-toolbar-drag]');
      const onButton = event.target.closest('button');
      if (!onChain && !onButton) return;
      const rect = toolbar.getBoundingClientRect();
      toolbarDrag = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        left: rect.left,
        top: rect.top,
        started: Boolean(onChain)
      };
      toolbarWasDragged = false;
      if (onChain) {
        event.preventDefault();
        toolbar.setPointerCapture?.(event.pointerId);
      }
    });

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
    });

    const finishToolbarDrag = event => {
      if (!toolbarDrag || toolbarDrag.id !== event.pointerId) return;
      const dragged = toolbarWasDragged;
      toolbarDrag = null;
      if (dragged) {
        toolbar.dataset.suppressClick = 'true';
        window.setTimeout(() => { delete toolbar.dataset.suppressClick; }, 0);
      }
    };
    document.addEventListener('pointerup', finishToolbarDrag);
    document.addEventListener('pointercancel', finishToolbarDrag);
    toolbar.addEventListener('click', event => {
      if (toolbar.dataset.suppressClick === 'true') {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);

    return {
      setFocus: setWritingFocus,
      destroy() {
        document.body.classList.remove(focusClass);
      }
    };
  }

  window.VHAEditorUI = Object.freeze({ mountRichTextEditor });
})();
