(() => {
  if (window.__vaBackTopReady) return;
  window.__vaBackTopReady = true;
  const init = () => {
    document.querySelectorAll('.posts-back-top').forEach(node => node.remove());
    let button = document.querySelector('.va-back-top');
    if (!button) {
      button = document.createElement('button');
      button.className = 'va-back-top';
      button.type = 'button';
      button.setAttribute('aria-label', 'Back to top');
      button.textContent = '↑';
      document.body.appendChild(button);
    }
    button.addEventListener('click', () => {
      window.scrollTo({
        top: 0,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
      });
    });
    const style = document.createElement('style');
    style.textContent = `
      .va-back-top{position:fixed;right:20px;bottom:18px;z-index:2147483001;width:42px;height:42px;border:1px solid #00eaf5;background:rgba(0,12,17,.9);color:#00eaf5;font:22px/1 ui-monospace,Consolas,monospace;cursor:pointer;clip-path:polygon(0 0,calc(100% - 9px) 0,100% 9px,100% 100%,9px 100%,0 calc(100% - 9px));box-shadow:0 0 18px rgba(0,234,245,.12);transition:opacity .2s,transform .2s}
      .va-back-top[hidden]{display:none!important}
      .va-back-top:hover,.va-back-top:focus-visible{background:#00eaf5;color:#001015;outline:2px solid #f0f500;outline-offset:2px}
      @media(max-width:600px){.va-back-top{right:14px;bottom:14px;width:40px;height:40px}}
    `;
    document.head.appendChild(style);
    const update = () => { button.hidden = window.scrollY < 280; };
    window.addEventListener('scroll', update, { passive: true });
    update();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();