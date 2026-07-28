(function (global) {
  'use strict';

  const configApi = global.RouletteLampConfig;
  const lampApi = global.RouletteLamp;
  if (!configApi || !lampApi) return;

  const atmosphereKey = 'rrAtmosphereSettingsV1';
  const collapsedKey = 'rrAtmosphereSettingsCollapsedV1';
  const defaults = Object.freeze({
    smokeDensity: 1.05,
    smokeLight: 1.12,
    smokeBlur: 9,
    smokeSpeed: 12
  });

  const controls = Object.freeze([
    ['Lighting', [
      ['lamp', 'strength', 'Light brightness', 0.05, 1.25, 0.01],
      ['lamp', 'spreadX', 'Light width', 20, 120, 1],
      ['lamp', 'spreadY', 'Light depth', 20, 140, 1],
      ['lamp', 'wallDark', 'Room darkness', 0, 0.92, 0.01],
      ['lamp', 'track', 'Light movement', 0, 20, 0.25]
    ]],
    ['Smoke', [
      ['smoke', 'smokeDensity', 'Smoke density', 0, 1.6, 0.01],
      ['smoke', 'smokeLight', 'Light through smoke', 0, 1.6, 0.01],
      ['smoke', 'smokeBlur', 'Smoke softness', 2, 22, 1],
      ['smoke', 'smokeSpeed', 'Smoke drift speed', 5, 26, 0.5]
    ]]
  ]);

  let atmosphere = loadAtmosphere();
  let lampConfig = loadLampConfig();
  let panel = null;
  let currentRoot = null;
  let observer = null;

  function readJson(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
  }

  function readCollapsed() {
    try { return localStorage.getItem(collapsedKey) !== '0'; } catch { return true; }
  }

  function loadAtmosphere() {
    const saved = readJson(atmosphereKey) || {};
    return {
      smokeDensity: clamp(saved.smokeDensity, 0, 1.6, defaults.smokeDensity),
      smokeLight: clamp(saved.smokeLight, 0, 1.6, defaults.smokeLight),
      smokeBlur: clamp(saved.smokeBlur, 2, 22, defaults.smokeBlur),
      smokeSpeed: clamp(saved.smokeSpeed, 5, 26, defaults.smokeSpeed)
    };
  }

  function loadLampConfig() {
    const saved = readJson(configApi.storageKey) || readJson(configApi.legacyStorageKey);
    return configApi.normalize(saved || configApi.defaults);
  }

  function clamp(value, minimum, maximum, fallback) {
    const number = Number(value);
    return Math.min(maximum, Math.max(minimum, Number.isFinite(number) ? number : fallback));
  }

  function formatValue(value, step) {
    const decimals = String(step).includes('.') ? Math.min(2, String(step).split('.')[1].length) : 0;
    return Number(value).toFixed(decimals);
  }

  function saveLampConfig() {
    lampConfig = configApi.normalize(lampConfig);
    try { localStorage.setItem(configApi.storageKey, JSON.stringify(lampConfig)); } catch {}
    global.dispatchEvent(new CustomEvent('rr-lamp-config-change', { detail: lampConfig }));
    lampApi.apply(document, lampConfig);
  }

  function saveAtmosphere() {
    try { localStorage.setItem(atmosphereKey, JSON.stringify(atmosphere)); } catch {}
    applyAtmosphere(currentRoot || findRoot());
  }

  function applyAtmosphere(root) {
    if (!root) return;
    const ambientOpacity = Math.min(0.96, atmosphere.smokeDensity * 0.60);
    const litOpacity = Math.min(0.98, atmosphere.smokeLight * 0.62);
    root.style.setProperty('--rr-smoke-density', String(atmosphere.smokeDensity));
    root.style.setProperty('--rr-smoke-light', String(atmosphere.smokeLight));
    root.style.setProperty('--rr-smoke-ambient-opacity', String(ambientOpacity));
    root.style.setProperty('--rr-smoke-lit-opacity', String(litOpacity));
    root.style.setProperty('--rr-smoke-blur', `${atmosphere.smokeBlur}px`);
    root.style.setProperty('--rr-smoke-speed', `${atmosphere.smokeSpeed}s`);
  }

  function findRoot() {
    return document.querySelector('#duelActive [data-roulette-game],#duel-active [data-roulette-game],[data-roulette-game]');
  }

  function createSlider(type, key, label, minimum, maximum, step) {
    const row = document.createElement('div');
    row.className = 'rr-atmosphere-row';

    const labelElement = document.createElement('label');
    labelElement.textContent = label;

    const valueElement = document.createElement('span');
    valueElement.className = 'rr-atmosphere-value';

    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(minimum);
    input.max = String(maximum);
    input.step = String(step);
    input.setAttribute('aria-label', label);

    const readValue = () => type === 'lamp' ? lampConfig[key] : atmosphere[key];
    const syncDisplay = () => {
      input.value = String(readValue());
      valueElement.textContent = formatValue(readValue(), step);
    };

    input.addEventListener('input', () => {
      const value = Number(input.value);
      if (type === 'lamp') {
        lampConfig = configApi.normalize({ ...lampConfig, [key]: value });
        saveLampConfig();
      } else {
        atmosphere = { ...atmosphere, [key]: value };
        saveAtmosphere();
      }
      valueElement.textContent = formatValue(value, step);
    });

    syncDisplay();
    row.append(labelElement, valueElement, input);
    return { row, syncDisplay };
  }

  function buildPanel() {
    const element = document.createElement('section');
    element.className = 'rr-atmosphere-settings rr-atmosphere-portal';
    element.setAttribute('aria-label', 'Scene settings');

    let collapsed = readCollapsed();
    if (collapsed) element.classList.add('is-collapsed');

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'rr-atmosphere-toggle';
    toggle.textContent = '⚙ Scene Settings';
    toggle.setAttribute('aria-expanded', String(!collapsed));

    const body = document.createElement('div');
    body.className = 'rr-atmosphere-body';
    const displaySync = [];

    for (const [sectionName, sectionControls] of controls) {
      const heading = document.createElement('div');
      heading.className = 'rr-atmosphere-section-title';
      heading.textContent = sectionName;
      body.append(heading);
      for (const definition of sectionControls) {
        const slider = createSlider(...definition);
        displaySync.push(slider.syncDisplay);
        body.append(slider.row);
      }
    }

    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'rr-atmosphere-reset';
    reset.textContent = 'Reset scene settings';
    reset.addEventListener('click', () => {
      lampConfig = configApi.normalize({
        ...lampConfig,
        strength: configApi.defaults.strength,
        spreadX: configApi.defaults.spreadX,
        spreadY: configApi.defaults.spreadY,
        wallDark: configApi.defaults.wallDark,
        track: configApi.defaults.track
      });
      atmosphere = { ...defaults };
      saveLampConfig();
      saveAtmosphere();
      for (const sync of displaySync) sync();
    });
    body.append(reset);

    toggle.addEventListener('click', () => {
      collapsed = !collapsed;
      element.classList.toggle('is-collapsed', collapsed);
      toggle.setAttribute('aria-expanded', String(!collapsed));
      try { localStorage.setItem(collapsedKey, collapsed ? '1' : '0'); } catch {}
    });

    element.append(toggle, body);
    document.body.append(element);
    return element;
  }

  function mount() {
    const root = findRoot();
    if (!root) {
      currentRoot = null;
      panel?.remove();
      panel = null;
      return;
    }

    currentRoot = root;
    applyAtmosphere(root);
    if (panel?.isConnected && panel.parentElement === document.body) return;
    panel?.remove();
    panel = buildPanel();
  }

  function start() {
    mount();
    observer = new MutationObserver(mount);
    observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
  }

  global.addEventListener('storage', event => {
    if (event.key === atmosphereKey) {
      atmosphere = loadAtmosphere();
      applyAtmosphere(findRoot());
    }
    if (event.key === configApi.storageKey || event.key === configApi.legacyStorageKey) {
      lampConfig = loadLampConfig();
    }
  });

  global.RouletteAtmosphereSettings = Object.freeze({
    defaults,
    open() {
      mount();
      panel?.classList.remove('is-collapsed');
      panel?.querySelector('.rr-atmosphere-toggle')?.setAttribute('aria-expanded', 'true');
      try { localStorage.setItem(collapsedKey, '0'); } catch {}
    },
    apply: mount,
    values() { return { lamp: { ...lampConfig }, smoke: { ...atmosphere } }; }
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  global.addEventListener('pagehide', () => observer?.disconnect(), { once: true });
})(window);
