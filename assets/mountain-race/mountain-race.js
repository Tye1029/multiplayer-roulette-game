(() => {
  'use strict';

  const MODE = 'mountainrace';
  const CONTROL_TOKENS = Object.freeze(['up', 'left', 'right', 'down']);

  const runtime = {
    mounted: false,
    root: null,
    game: null
  };

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, Number(value) || 0));
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function normalizePrompt(token) {
    const normalized = String(token || '').trim().toLowerCase();
    return CONTROL_TOKENS.includes(normalized) ? normalized : 'up';
  }

  function promptLabel(token) {
    return {
      up: '▲',
      left: '◀',
      right: '▶',
      down: '▼'
    }[normalizePrompt(token)];
  }

  function normalizePlayer(player = {}) {
    return {
      name: String(player.name || 'Climber'),
      progress: clamp(player.progress, 0, 1),
      promptIndex: Math.max(0, Math.trunc(Number(player.promptIndex) || 0)),
      finished: Boolean(player.finished)
    };
  }

  function renderLane(player, side) {
    const normalized = normalizePlayer(player);
    const progressPercent = Math.round(normalized.progress * 100);
    return `
      <section class="mr-lane ${side}" aria-label="${escapeHtml(normalized.name)} climbing lane">
        <header class="mr-player-card">
          <strong>${escapeHtml(normalized.name)}</strong>
          <span>${normalized.finished ? 'SUMMIT REACHED' : `${progressPercent}%`}</span>
        </header>
        <div class="mr-mountain-track" aria-hidden="true">
          <div class="mr-climber" style="--mr-progress:${normalized.progress}">
            <span class="mr-climber-body"></span>
          </div>
        </div>
      </section>`;
  }

  function render(game = {}) {
    if (!runtime.root) return;

    const state = game.state || {};
    const prompts = Array.isArray(state.prompts) ? state.prompts : ['up', 'left', 'right'];
    const activeIndex = Math.max(0, Math.trunc(Number(state.myPromptIndex) || 0));
    const visiblePrompts = prompts.slice(activeIndex, activeIndex + 4);

    runtime.root.innerHTML = `
      <div class="mountain-race-game" data-mode="${MODE}">
        <header class="mr-titlebar">
          <p>FIRST TO THE SUMMIT WINS</p>
          <h2>SUMMIT SPRINT</h2>
        </header>

        <main class="mr-race-stage">
          ${renderLane(state.me || game.creator || {}, 'me')}
          ${renderLane(state.opponent || game.joiner || {}, 'opponent')}
          <div class="mr-summit-flag" aria-hidden="true"></div>
        </main>

        <section class="mr-prompt-panel" aria-label="Climbing controls">
          <span class="mr-prompt-label">NEXT MOVES</span>
          <div class="mr-prompt-sequence">
            ${visiblePrompts.map((token, index) => `
              <button
                type="button"
                class="mr-prompt ${index === 0 ? 'active' : ''}"
                data-mr-input="${normalizePrompt(token)}"
                aria-label="${normalizePrompt(token)}"
                ${index === 0 ? '' : 'tabindex="-1"'}
              >${promptLabel(token)}</button>`).join('')}
          </div>
          <p class="mr-status" data-mr-status>Waiting for authoritative race state.</p>
        </section>
      </div>`;
  }

  function onClick(event) {
    const button = event.target.closest('[data-mr-input]');
    if (!button || !runtime.root?.contains(button)) return;

    const token = normalizePrompt(button.dataset.mrInput);
    runtime.root.dispatchEvent(new CustomEvent('mountainrace:input', {
      bubbles: true,
      detail: { token }
    }));
  }

  function mount(root, game = {}) {
    if (!(root instanceof Element)) throw new TypeError('Summit Sprint requires a valid mount element.');
    unmount();
    runtime.root = root;
    runtime.game = game;
    runtime.mounted = true;
    root.addEventListener('click', onClick);
    render(game);
  }

  function update(game = {}) {
    runtime.game = game;
    if (runtime.mounted) render(game);
  }

  function unmount() {
    if (runtime.root) runtime.root.removeEventListener('click', onClick);
    runtime.mounted = false;
    runtime.root = null;
    runtime.game = null;
  }

  window.MountainRaceGame = Object.freeze({
    mode: MODE,
    controls: CONTROL_TOKENS,
    mount,
    update,
    unmount
  });
})();
