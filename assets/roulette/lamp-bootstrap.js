(function () {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  if (params.has('lampCalibration')) return;

  const configApi = window.RouletteLampConfig;
  const lampApi = window.RouletteLamp;
  if (!configApi || !lampApi) {
    console.error('Lamp bootstrap could not start because its dependencies are missing');
    return;
  }

  let cfg;
  let stopWatching = null;

  function loadConfig() {
    try {
      const saved = JSON.parse(localStorage.getItem(configApi.storageKey) || 'null');
      if (saved) return configApi.normalize(saved);

      // Older calibrations position the full reference photograph, rather than
      // the transparent fixture. Start the new geometry from its fitted defaults.
    } catch {}

    return configApi.normalize(configApi.defaults);
  }

  function applyConfig(nextConfig) {
    cfg = configApi.normalize(nextConfig || loadConfig());
    lampApi.apply(document, cfg);
  }

  function start() {
    cfg = loadConfig();
    if (stopWatching) stopWatching();
    stopWatching = lampApi.watch(document, () => cfg);
  }

  window.addEventListener('storage', event => {
    if (event.key !== configApi.storageKey && event.key !== configApi.legacyStorageKey) return;
    applyConfig(loadConfig());
  });

  window.addEventListener('rr-lamp-config-change', event => {
    applyConfig(event.detail || loadConfig());
  });

  window.RouletteLampBootstrap = Object.freeze({
    reload() { applyConfig(loadConfig()); },
    apply(nextConfig) { applyConfig(nextConfig); },
    current() { return { ...cfg }; }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
