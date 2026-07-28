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

  let cfg = loadConfig();
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

  function announce(source) {
    window.dispatchEvent(new CustomEvent('roulette-lamp-config-change', {
      detail: {
        source: String(source || ''),
        config: { ...cfg }
      }
    }));
  }

  function apply(source = '') {
    const result = lampApi.apply(document, cfg);
    announce(source);
    return result;
  }

  function setConfig(nextConfig, options = {}) {
    cfg = configApi.normalize({ ...cfg, ...(nextConfig || {}) });
    if (options.save) {
      localStorage.setItem(configApi.storageKey, JSON.stringify(cfg));
      localStorage.removeItem(configApi.legacyStorageKey);
    }
    apply(options.source || 'controller');
    return { ...cfg };
  }

  function resetConfig(options = {}) {
    localStorage.removeItem(configApi.storageKey);
    localStorage.removeItem(configApi.legacyStorageKey);
    cfg = configApi.normalize(configApi.defaults);
    apply(options.source || 'reset');
    return { ...cfg };
  }

  function start() {
    if (stopWatching) stopWatching();
    stopWatching = lampApi.watch(document, () => cfg);
    announce('bootstrap');
  }

  window.RouletteLampController = Object.freeze({
    getConfig: () => ({ ...cfg }),
    setConfig,
    resetConfig,
    apply: () => apply('manual'),
    save: () => setConfig(cfg, { save: true, source: 'save' })
  });

  window.addEventListener('storage', event => {
    if (event.key !== configApi.storageKey && event.key !== configApi.legacyStorageKey) return;
    cfg = loadConfig();
    apply('storage');
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
