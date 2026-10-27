(() => {
  if (!new URLSearchParams(location.search).has('embed') || window.parent === window) return;
  let lastHeight = 0;
  function reportHeight() {
    const root = document.querySelector('.cv-page');
    if (!root) return;
    const height = Math.ceil(Math.max(root.scrollHeight, root.getBoundingClientRect().height, document.documentElement.scrollHeight));
    if (height !== lastHeight) {
      lastHeight = height;
      window.parent.postMessage({ type: 'cv-embed-height', height }, window.location.origin);
    }
  }
  reportHeight();
  if ('ResizeObserver' in window) new ResizeObserver(reportHeight).observe(document.querySelector('.cv-page'));
  window.addEventListener('load', reportHeight);
  window.addEventListener('resize', reportHeight);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(reportHeight);
})();