(function (global) {
  'use strict';

  if (global.__rrAtmosphereEdgeFallbackV1) return;
  global.__rrAtmosphereEdgeFallbackV1 = true;

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

  function clamp(value, minimum, maximum, fallback) {
    const number = Number(value);
    return Math.min(maximum, Math.max(minimum, Number.isFinite(number) ? number : fallback));
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
    const api = global.RouletteLampConfig;
    if (!api) return {};
    const saved = readJson(api.storageKey) || readJson(api.legacyStorageKey);
    return api.normalize(saved || api.defaults);
  }

  function formatValue(value, step) {
    const decimals = String(step).includes('.') ? Math.min(2, String(step).split('.')[1].length) : 0;
    return Number(value).toFixed(decimals);
  }

  function findRoot() {
    return document.querySelector('#duelActive [data-roulette-game],#duel-active [data-roulette-game],[data-roulette-game]');
  }

  function rouletteScreenIsVisible() {
    const screen = document.querySelector('#duelScreen');
    if (!screen || screen.hidden) return false;
    const selectedMode = document.querySelector('#duelModeSelect')?.value;
    return selectedMode === 'roulette' || Boolean(findRoot());
  }

  function ensureSmokeLayers(root) {
    if (!root) return null;
    let smoke = root.querySelector('.rr-smoke');
    if (!smoke) {
      smoke = document.createElement('div');
      smoke.className = 'rr-smoke';
      smoke.setAttribute('aria-hidden', 'true');
      root.prepend(smoke);
    }
    let ambient = smoke.querySelector('.rr-smoke-ambient');
    if (!ambient) {
      ambient = document.createElement('span');
      ambient.className = 'rr-smoke-ambient';
      smoke.append(ambient);
    }
    let lit = smoke.querySelector('.rr-smoke-lit');
    if (!lit) {
      lit = document.createElement('span');
      lit.className = 'rr-smoke-lit';
      smoke.append(lit);
    }
    return { smoke, ambient, lit };
  }

  function synchronizeLitSmoke(lit) {
    if (!lit?.animate) return;
    const duration = Math.max(2, Number(lampConfig.trackSpeed) || 8);
    const travel = Math.max(3, (Number(lampConfig.track) || 7) * 0.72);
    const signature = `${duration}|${travel}`;
    if (lit.__rrFallbackSmokeSignature === signature && lit.__rrFallbackSmokeAnimation?.playState !== 'idle') return;
    lit.__rrFallbackSmokeAnimation?.cancel?.();
    const animation = lit.animate([
      { transform: `translate3d(${-travel}%,0,0) scale(1.04)`, offset: 0 },
      { transform: `translate3d(${travel}%,0,0) scale(1.09)`, offset: 0.5 },
      { transform: `translate3d(${-travel}%,0,0) scale(1.04)`, offset: 1 }
    ], {
      duration: duration * 1000,
      iterations: Infinity,
      easing: 'ease-in-out',
      fill: 'both'
    });
    try { animation.currentTime = Date.now() % (duration * 1000); } catch {}
    lit.__rrFallbackSmokeSignature = signature;
    lit.__rrFallbackSmokeAnimation = animation;
  }

  function applyAtmosphere(root) {
    if (!root) return;
    const layers = ensureSmokeLayers(root);
    const ambientOpacity = Math.min(0.96, atmosphere.smokeDensity * 0.60);
    const litOpacity = Math.min(0.98, atmosphere.smokeLight * 0.62);
    root.style.setProperty('--rr-smoke-ambient-opacity', String(ambientOpacity));
    root.style.setProperty('--rr-smoke-lit-opacity', String(litOpacity));
    root.style.setProperty('--rr-smoke-blur', `${atmosphere.smokeBlur}px`);
    root.style.setProperty('--rr-smoke-speed', `${atmosphere.smokeSpeed}s`);
    synchronizeLitSmoke(layers?.lit);
  }

  function saveLampConfig() {
    const api = global.RouletteLampConfig;
    const lamp = global.RouletteLamp;
    if (!api || !lamp) return;
    lampConfig = api.normalize(lampConfig);
    try { localStorage.setItem(api.storageKey, JSON.stringify(lampConfig)); } catch {}
    global.dispatchEvent(new CustomEvent('rr-lamp-config-change', { detail: lampConfig }));
    lamp.apply(document, lampConfig);
    applyAtmosphere(currentRoot || findRoot());
  }

  function saveAtmosphere() {
    try { localStorage.setItem(atmosphereKey, JSON.stringify(atmosphere)); } catch {}
    applyAtmosphere(currentRoot || findRoot());
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
    const sync = () => {
      const value = readValue();
      input.value = String(value);
      valueElement.textContent = formatValue(value, step);
    };
    input.addEventListener('input', () => {
      const value = Number(input.value);
      if (type === 'lamp') {
        lampConfig = { ...lampConfig, [key]: value };
        saveLampConfig();
      } else {
        atmosphere = { ...atmosphere, [key]: value };
        saveAtmosphere();
      }
      valueElement.textContent = formatValue(value, step);
    });
    sync();
    row.append(labelElement, valueElement, input);
    return { row, sync };
  }

  function buildPanel() {
    const element = document.createElement('section');
    element.className = 'rr-atmosphere-settings rr-atmosphere-portal is-collapsed';
    element.setAttribute('aria-label', 'Scene settings');
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'rr-atmosphere-toggle';
    toggle.textContent = '⚙ Scene Settings';
    const collapsed = (() => {
      try { return localStorage.getItem(collapsedKey) !== '0'; } catch { return true; }
    })();
    element.classList.toggle('is-collapsed', collapsed);
    toggle.setAttribute('aria-expanded', String(!collapsed));
    const body = document.createElement('div');
    body.className = 'rr-atmosphere-body';
    const syncers = [];
    for (const [sectionName, sectionControls] of controls) {
      const heading = document.createElement('div');
      heading.className = 'rr-atmosphere-section-title';
      heading.textContent = sectionName;
      body.append(heading);
      for (const definition of sectionControls) {
        const slider = createSlider(...definition);
        syncers.push(slider.sync);
        body.append(slider.row);
      }
    }
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'rr-atmosphere-reset';
    reset.textContent = 'Reset scene settings';
    reset.addEventListener('click', () => {
      const api = global.RouletteLampConfig;
      if (api) lampConfig = api.normalize(api.defaults);
      atmosphere = { ...defaults };
      saveLampConfig();
      saveAtmosphere();
      syncers.forEach(sync => sync());
    });
    body.append(reset);
    toggle.addEventListener('click', () => {
      const nextCollapsed = !element.classList.contains('is-collapsed');
      element.classList.toggle('is-collapsed', nextCollapsed);
      toggle.setAttribute('aria-expanded', String(!nextCollapsed));
      try { localStorage.setItem(collapsedKey, nextCollapsed ? '1' : '0'); } catch {}
    });
    element.append(toggle, body);
    document.body.append(element);
    return element;
  }

  function mount() {
    if (!rouletteScreenIsVisible()) {
      currentRoot = null;
      panel?.remove();
      panel = null;
      return;
    }
    const root = findRoot();
    currentRoot = root || null;
    if (root) applyAtmosphere(root);
    const existing = document.querySelector('body > .rr-atmosphere-settings');
    if (existing) {
      panel = existing;
      return;
    }
    panel = buildPanel();
  }

  function start() {
    lampConfig = loadLampConfig();
    mount();
    observer = new MutationObserver(mount);
    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['hidden']
    });
    document.addEventListener('change', event => {
      if (event.target?.id === 'duelModeSelect') mount();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  global.addEventListener('pagehide', () => observer?.disconnect(), { once: true });
})(window);
