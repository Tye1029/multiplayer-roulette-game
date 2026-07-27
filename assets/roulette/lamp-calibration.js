(function () {
  'use strict';

  const configApi = window.RouletteLampConfig;
  const lampApi = window.RouletteLamp;
  if (!configApi || !lampApi) {
    throw new Error('Lamp configuration and runtime must load before calibration controls');
  }

  const frame = document.getElementById('game');
  const panel = document.getElementById('panel');
  const toggle = document.getElementById('toggle');
  const rows = document.getElementById('rows');
  const status = document.getElementById('status');
  const saveButton = document.getElementById('save');
  const copyButton = document.getElementById('copy');
  const resetButton = document.getElementById('reset');
  const centerButton = document.getElementById('center');

  function loadConfig() {
    try {
      const saved = JSON.parse(localStorage.getItem(configApi.storageKey) || 'null');
      if (saved) return configApi.normalize(saved);

      const legacy = JSON.parse(localStorage.getItem(configApi.legacyStorageKey) || 'null');
      if (legacy) return configApi.normalize(legacy);
    } catch {}

    return configApi.normalize(configApi.defaults);
  }

  let cfg = loadConfig();
  let stopWatching = null;

  function renderRows() {
    rows.replaceChildren();
    for (const [groupName, controls] of configApi.groups) {
      const heading = document.createElement('div');
      heading.className = 'group';
      heading.textContent = groupName;
      rows.append(heading);

      for (const [key, label, definition] of controls) {
        const row = document.createElement('label');
        row.className = 'row';
        row.dataset.key = key;
        row.innerHTML =
          `<span>${label}</span>` +
          `<input type="range" min="${definition[1]}" max="${definition[2]}" step="${definition[3]}" value="${cfg[key]}" data-k="${key}">` +
          `<output>${cfg[key]}</output>`;
        rows.append(row);
      }
    }
  }

  function frameDocument() {
    try {
      return frame.contentDocument;
    } catch {
      return null;
    }
  }

  function updateStatus(result, changedKey = '') {
    if (!result || !result.mounted) {
      status.textContent = 'Open or start a Russian Roulette game to mount the lamp controls';
      return;
    }

    for (const key of Object.keys(configApi.bindings)) {
      const row = rows.querySelector(`[data-key="${key}"]`);
      if (row) row.classList.toggle('missing', !result.targets[key]);
    }

    status.textContent = changedKey
      ? `${configApi.labels[changedKey]}: ${cfg[changedKey]} — ${result.connectedCount}/${result.totalControls} controls connected`
      : `Connected — modular lamp system active; ${result.connectedCount}/${result.totalControls} controls connected`;
  }

  function apply(changedKey = '') {
    const doc = frameDocument();
    if (!doc) return;
    const result = lampApi.apply(doc, cfg);
    updateStatus(result, changedKey);
  }

  function beginWatching() {
    if (stopWatching) stopWatching();
    const doc = frameDocument();
    if (!doc) return;
    stopWatching = lampApi.watch(doc, () => cfg, result => updateStatus(result));
    apply();
  }

  rows.addEventListener('input', event => {
    const key = event.target.dataset.k;
    if (!key) return;
    cfg[key] = Number(event.target.value);
    event.target.nextElementSibling.value = event.target.value;
    apply(key);
  });

  toggle.addEventListener('click', () => panel.classList.toggle('open'));

  saveButton.addEventListener('click', () => {
    localStorage.setItem(configApi.storageKey, JSON.stringify(cfg));
    status.textContent = 'Calibration saved';
  });

  copyButton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(cfg, null, 2));
      status.textContent = 'Calibration JSON copied';
    } catch {
      status.textContent = 'Clipboard unavailable';
    }
  });

  resetButton.addEventListener('click', () => {
    localStorage.removeItem(configApi.storageKey);
    localStorage.removeItem(configApi.legacyStorageKey);
    location.reload();
  });

  centerButton.addEventListener('click', () => {
    const doc = frameDocument();
    const table = doc?.querySelector('.rr-table');
    const gun = doc?.querySelector('.rr-gun-motion');
    if (!table || !gun) {
      status.textContent = 'Table or gun is not currently mounted';
      return;
    }

    const tableBox = table.getBoundingClientRect();
    const gunBox = gun.getBoundingClientRect();
    cfg.lightX = (gunBox.left + gunBox.width / 2 - tableBox.left) / tableBox.width * 100;
    cfg.lightY = (gunBox.top + gunBox.height / 2 - tableBox.top) / tableBox.height * 100;

    for (const key of ['lightX', 'lightY']) {
      const input = rows.querySelector(`[data-k="${key}"]`);
      input.value = cfg[key];
      input.nextElementSibling.value = cfg[key].toFixed(1);
    }
    apply('lightX');
  });

  frame.addEventListener('load', () => {
    setTimeout(beginWatching, 250);
    setTimeout(apply, 900);
  });

  renderRows();
})();
