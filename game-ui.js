/* Shared site entry point. The Crystal runtime owns navigation and tools. */
(() => {
  if (window.__vhaCrystalBootstrap) return;
  window.__vhaCrystalBootstrap = true;
  const script = document.createElement("script");
  script.src = "/landing-page/shared/crystal/crystal-loader.js?v=20261106-star-patterns-header-inline-7";
  script.async = false;
  document.head.appendChild(script);
})();