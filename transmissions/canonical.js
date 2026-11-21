// Keep the archive on one canonical URL before relative assets are requested.
(() => {
  const path = window.location.pathname;
  const normalizedPath = path.replace(/\/{2,}/g, "/");

  if (normalizedPath !== path) {
    window.location.replace(normalizedPath + window.location.search + window.location.hash);
  }
})();
