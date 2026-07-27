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

      const legacy = JSON.parse(localStorage.getItem(configApi.legacyStorageKey) || 'null');
      if (legacy) return configApi.normalize(legacy);
    } catch {}

    return configApi.normalize(configApi.defaults);
  }

  function start() {
    cfg = loadConfig();
    if (stopWatching) stopWatching();
    stopWatching = lampApi.watch(document, () => cfg);
  }

  window.addEventListener('storage', event => {
    if (event.key !== configApi.storageKey && event.key !== configApi.legacyStorageKey) return;
    cfg = loadConfig();
    lampApi.apply(document, cfg);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
