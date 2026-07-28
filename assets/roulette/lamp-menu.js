(function () {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  if (params.has('lampCalibration')) return;

  const configApi = window.RouletteLampConfig;
  const controller = window.RouletteLampController;
  if (!configApi || !controller) {
    console.error('Lighting menu could not start because the lamp controller is unavailable');
    return;
  }

  const menuId = 'rrLightingMenu';
  const toggleId = 'rrLightingMenuToggle';
  let cfg = controller.getConfig();

  function createButton(text, className = '') {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = text;
    if (className) button.className = className;
    return button;
  }

  function formatValue(value, step) {
    const decimals = String(step).includes('.') ? Math.min(3, String(step).split('.')[1].length) : 0;
    return Number(value).toFixed(decimals);
  }

  function mount() {
    if (document.getElementById(menuId)) return;

    const toggle = createButton('LIGHTING');
    toggle.id = toggleId;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', menuId);

    const panel = document.createElement('section');
    panel.id = menuId;
    panel.setAttribute('aria-label', 'Lighting calibration controls');
    panel.innerHTML =
      '<header><strong>LIGHTING CALIBRATION</strong><button type="button" data-action="close" aria-label="Close lighting menu">×</button></header>' +
      '<div class="rr-lighting-menu-rows"></div>' +
      '<div class="rr-lighting-menu-actions"></div>' +
      '<p class="rr-lighting-menu-status" role="status">Live preview ready</p>';

    const rows = panel.querySelector('.rr-lighting-menu-rows');
    for (const [groupName, controls] of configApi.groups) {
      const heading = document.createElement('div');
      heading.className = 'rr-lighting-menu-group';
      heading.textContent = groupName;
      rows.append(heading);

      for (const [key, label, definition] of controls) {
        const row = document.createElement('label');
        row.className = 'rr-lighting-menu-row';
        row.dataset.key = key;

        const name = document.createElement('span');
        name.textContent = label;

        const input = document.createElement('input');
        input.type = 'range';
        input.min = String(definition[1]);
        input.max = String(definition[2]);
        input.step = String(definition[3]);
        input.value = String(cfg[key]);
        input.dataset.key = key;

        const output = document.createElement('output');
        output.value = formatValue(cfg[key], definition[3]);
        output.textContent = output.value;

        row.append(name, input, output);
        rows.append(row);
      }
    }

    const actions = panel.querySelector('.rr-lighting-menu-actions');
    for (const [label, action] of [
      ['Save', 'save'],
      ['Copy JSON', 'copy'],
      ['Reset', 'reset']
    ]) {
      const button = createButton(label);
      button.dataset.action = action;
      actions.append(button);
    }

    const status = panel.querySelector('.rr-lighting-menu-status');
    const setStatus = message => { status.textContent = message; };

    function setOpen(open) {
      panel.classList.toggle('open', Boolean(open));
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    function syncInputs(nextConfig) {
      cfg = configApi.normalize(nextConfig || controller.getConfig());
      for (const [, controls] of configApi.groups) {
        for (const [key, , definition] of controls) {
          const input = rows.querySelector(`input[data-key="${key}"]`);
          if (!input) continue;
          input.value = String(cfg[key]);
          const output = input.nextElementSibling;
          output.value = formatValue(cfg[key], definition[3]);
          output.textContent = output.value;
        }
      }
    }

    toggle.addEventListener('click', () => setOpen(!panel.classList.contains('open')));

    panel.addEventListener('input', event => {
      const input = event.target.closest('input[data-key]');
      if (!input) return;
      const key = input.dataset.key;
      cfg[key] = Number(input.value);
      const definition = configApi.definitions[key];
      const output = input.nextElementSibling;
      output.value = formatValue(cfg[key], definition[3]);
      output.textContent = output.value;
      cfg = controller.setConfig(cfg, { source: 'lighting-menu' });
      setStatus(`${configApi.labels[key]}: ${output.value}`);
    });

    panel.addEventListener('click', async event => {
      const action = event.target.closest('[data-action]')?.dataset.action;
      if (!action) return;

      if (action === 'close') {
        setOpen(false);
        return;
      }
      if (action === 'save') {
        cfg = controller.setConfig(cfg, { save: true, source: 'lighting-menu-save' });
        setStatus('Lighting calibration saved');
        return;
      }
      if (action === 'reset') {
        cfg = controller.resetConfig({ source: 'lighting-menu-reset' });
        syncInputs(cfg);
        setStatus('Lighting calibration reset to defaults');
        return;
      }
      if (action === 'copy') {
        try {
          await navigator.clipboard.writeText(JSON.stringify(cfg, null, 2));
          setStatus('Lighting JSON copied');
        } catch {
          setStatus('Clipboard unavailable');
        }
      }
    });

    window.addEventListener('roulette-lamp-config-change', event => {
      if (event.detail?.source === 'lighting-menu') return;
      syncInputs(event.detail?.config);
    });

    document.body.append(toggle, panel);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }
})();
