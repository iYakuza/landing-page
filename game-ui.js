/* Shared site entry point. The Crystal runtime owns navigation and tools. */
(() => {
  if (window.__vhaCrystalBootstrap) return;
  window.__vhaCrystalBootstrap = true;
  const script = document.createElement("script");
  script.src = "/landing-page/shared/crystal/crystal-loader.js?v=20261106-creator-workshop-star-1";
  script.async = false;
  document.head.appendChild(script);
})();