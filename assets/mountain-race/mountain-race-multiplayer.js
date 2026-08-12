(() => {
  'use strict';

  const MODE = 'mountainrace';
  const STATE_EVENT = 'mountainrace:state';
  const CONTROLS = Object.freeze(['up', 'left', 'right', 'down']);
  const KEY_MAP = Object.freeze({
    ArrowUp: 'up', ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'down',
    w: 'up', W: 'up', a: 'left', A: 'left', d: 'right', D: 'right', s: 'down', S: 'down'
  });

  const runtime = {
    game: null,
    root: null,
    busy: false,
    serverOffsetMs: 0,
    ticker: 0,
    lastMyInputAt: '',
    lastOpponentInputAt: ''
  };

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function control(value) {
    const token = String(value || '').toLowerCase();
    return CONTROLS.includes(token) ? token : 'up';
  }

  function symbol(value) {
    return { up: '▲', left: '◀', right: '▶', down: '▼' }[control(value)];
  }

  function updateServerClock(game) {
    const serverNow = Date.parse(String(game?.serverNow || ''));
    if (!Number.isFinite(serverNow)) return;
    const desired = serverNow - Date.now();
    runtime.serverOffsetMs += (desired - runtime.serverOffsetMs) * 0.5;
  }

  function serverNowMs() {
    return Date.now() + runtime.serverOffsetMs;
  }

  function state() {
    return runtime.game?.mountainraceState || {};
  }

  function secondsLeft() {
    const endAt = Date.parse(String(state().endAt || ''));
    return Number.isFinite(endAt) ? Math.max(0, Math.ceil((endAt - serverNowMs()) / 1000)) : 30;
  }

  function countdownValue() {
    const startAt = Date.parse(String(state().startAt || runtime.game?.startAt || ''));
    return Number.isFinite(startAt) ? Math.max(0, Math.ceil((startAt - serverNowMs()) / 1000)) : 0;
  }

  function player(raw = {}, fallbackName = 'CLIMBER', fallbackBadge = 'P2') {
    return {
      playerId: String(raw.playerId || ''),
      name: String(raw.name || fallbackName),
      badge: String(raw.badge || fallbackBadge),
      isBot: Boolean(raw.isBot),
      promptIndex: Math.max(0, Math.trunc(Number(raw.promptIndex) || 0)),
      rejectedInputs: Math.max(0, Math.trunc(Number(raw.rejectedInputs) || 0)),
      lastInput: raw.lastInput && typeof raw.lastInput === 'object' ? raw.lastInput : null,
      finishedAt: raw.finishedAt || null
    };
  }

  function holdLeft(index) {
    return [24, 62, 38, 70, 31, 57][index % 6];
  }

  function renderHolds(currentIndex, total, prompts, reveal) {
    const promptMap = new Map();
    prompts.forEach((token, offset) => promptMap.set(currentIndex + offset, control(token)));
    return Array.from({ length: total }, (_, index) => {
      const known = reveal ? promptMap.get(index) : '';
      const classes = [
        'mr-rock-hold',
        index === currentIndex ? 'current' : '',
        index < currentIndex ? 'passed' : '',
        index > currentIndex + 5 ? 'distant' : '',
        known ? 'known' : 'unknown'
      ].filter(Boolean).join(' ');
      return `<span class="${classes}" style="--mr-hold-bottom:${86 + index * 58}px;--mr-hold-left:${holdLeft(index)}%" aria-hidden="true"><b>${known ? symbol(known) : '•'}</b></span>`;
    }).join('') + `<span class="mr-finish-ledge" style="--mr-summit-bottom:${86 + total * 58}px" aria-hidden="true"><i></i><b>SUMMIT</b></span>`;
  }

  function animationClass(raw, previousAt, isWinner) {
    if (isWinner) return 'celebrate';
    const last = raw?.lastInput;
    if (!last?.at || last.at === previousAt) return 'waiting';
    return last.correct ? `climb-${control(last.control)}` : 'slip';
  }

  function renderClimber(raw, side, animation) {
    const bottom = 62 + Math.max(0, Number(raw.promptIndex) || 0) * 58;
    return `
      <div class="mr-climber ${side} ${animation} direction-${control(raw.lastInput?.control)}" style="--mr-climber-bottom:${bottom}px" aria-label="${escapeHtml(raw.name)} climber">
        <span class="mr-arm left-arm"></span><span class="mr-arm right-arm"></span>
        <span class="mr-climber-head"></span><span class="mr-climber-body"></span>
        <span class="mr-leg left-leg"></span><span class="mr-leg right-leg"></span>
      </div>`;
  }

  function renderLane(rawPlayer, side, total, prompts, reveal, animation) {
    const p = player(rawPlayer, side === 'me' ? 'YOU' : 'OPPONENT', side === 'me' ? 'YOU' : rawPlayer?.isBot ? 'CPU' : 'P2');
    const scroll = Math.max(0, p.promptIndex - 3) * 58;
    const progress = total ? Math.min(1, p.promptIndex / total) : 0;
    return `
      <section class="mr-lane ${side}" aria-label="${escapeHtml(p.name)} climbing lane">
        <header class="mr-player-card">
          <span class="mr-player-badge" aria-hidden="true">${escapeHtml(p.badge)}</span>
          <span class="mr-player-copy"><strong>${escapeHtml(p.name)}</strong><small>${p.rejectedInputs} ${p.rejectedInputs === 1 ? 'MISTAKE' : 'MISTAKES'}</small></span>
          <span class="mr-player-progress">${p.finishedAt ? 'SUMMIT REACHED' : `${p.promptIndex} / ${total}`}</span>
        </header>
        <div class="mr-climb-viewport">
          <div class="mr-mountain-wall" style="--mr-wall-scroll:${scroll}px">
            ${renderHolds(p.promptIndex, total, prompts, reveal)}
            ${renderClimber(p, side, animation)}
          </div>
          <div class="mr-altitude-meter" aria-hidden="true"><i style="--mr-altitude:${progress}"></i></div>
        </div>
      </section>`;
  }

  function promptQueue(prompts) {
    if (!prompts.length) return '<span class="mr-queue-complete">SYNCING NEXT HOLD…</span>';
    return prompts.map((token, index) => `
      <span class="mr-prompt ${index === 0 ? 'active' : ''}"><b>${symbol(token)}</b><small>${index === 0 ? 'NOW' : `+${index}`}</small></span>`).join('');
  }

  function statusText(publicState) {
    if (runtime.busy) return 'Checking that hold…';
    if (runtime.game?.status === 'countdown') return 'Get ready. The race begins at GO!';
    if (runtime.game?.status === 'complete') {
      if (publicState.tie) return 'Both climbers finished at the same height.';
      return publicState.viewerWon ? 'You reached the summit first!' : `${publicState.opponent?.name || 'Your opponent'} won the climb.`;
    }
    const last = publicState.me?.lastInput;
    if (!last) return 'Follow the highlighted direction. Wrong inputs cost one hold.';
    return last.correct ? 'Correct move. Keep climbing!' : 'Wrong direction. You slipped back one hold.';
  }

  function resultOverlay(publicState, me, total) {
    if (runtime.game?.status !== 'complete') return '';
    const winnerText = publicState.tie
      ? 'THE RACE ENDED IN A TIE'
      : publicState.viewerWon
        ? 'YOU REACHED THE SUMMIT FIRST!'
        : `${String(publicState.opponent?.name || 'YOUR OPPONENT').toUpperCase()} WON THE RACE`;
    return `
      <div class="mr-overlay complete">
        <div class="mr-overlay-card result ${publicState.viewerWon ? 'win' : publicState.tie ? 'tie' : 'loss'}">
          <span class="mr-eyebrow">RACE COMPLETE</span>
          <h1>${escapeHtml(winnerText)}</h1>
          <p>You climbed ${me.promptIndex} of ${total} holds with ${me.rejectedInputs} mistakes.</p>
          <div class="mr-result-actions">
            <button type="button" class="mr-start-button" data-mr-rematch>REMATCH</button>
            <button type="button" class="mr-start-button secondary" data-mr-new-game>NEW GAME</button>
          </div>
        </div>
      </div>`;
  }

  function countdownOverlay() {
    if (runtime.game?.status !== 'countdown') return '';
    const value = countdownValue();
    return `<div class="mr-overlay countdown"><div class="mr-countdown-number" data-mr-countdown>${value > 0 ? value : 'GO!'}</div></div>`;
  }

  function render() {
    const publicState = state();
    const root = document.querySelector('[data-mountain-race-mount]');
    if (!root || runtime.game?.mode !== MODE) return;
    runtime.root = root;
    const total = Math.max(8, Math.min(80, Math.trunc(Number(publicState.stepsTotal) || 24)));
    const prompts = Array.isArray(publicState.prompts) ? publicState.prompts.map(control).slice(0, 4) : [];
    const me = player(publicState.me, 'YOU', 'YOU');
    const opponent = player(publicState.opponent, 'OPPONENT', publicState.opponent?.isBot ? 'CPU' : 'P2');
    const meAnimation = animationClass(me, runtime.lastMyInputAt, publicState.viewerWon && runtime.game.status === 'complete');
    const opponentAnimation = animationClass(opponent, runtime.lastOpponentInputAt, !publicState.viewerWon && !publicState.tie && runtime.game.status === 'complete');
    if (me.lastInput?.at) runtime.lastMyInputAt = me.lastInput.at;
    if (opponent.lastInput?.at) runtime.lastOpponentInputAt = opponent.lastInput.at;
    const controlsEnabled = runtime.game.status === 'playing' && publicState.canSubmit && !runtime.busy;
    const tone = me.lastInput ? (me.lastInput.correct ? 'correct' : 'wrong') : 'neutral';

    root.innerHTML = `
      <div class="mountain-race-game" data-mode="${MODE}" data-status="${escapeHtml(runtime.game.status)}" data-authoritative="1">
        <header class="mr-titlebar">
          <div><p>FIRST TO THE SUMMIT WINS</p><h2>SUMMIT SPRINT</h2></div>
          <div class="mr-race-clock ${secondsLeft() <= 7 && runtime.game.status === 'playing' ? 'urgent' : ''}"><small>TIME</small><strong data-mr-clock>${String(secondsLeft()).padStart(2, '0')}</strong></div>
        </header>
        <main class="mr-race-stage">
          ${renderLane(me, 'me', total, prompts, true, meAnimation)}
          ${renderLane(opponent, 'opponent', total, [], false, opponentAnimation)}
        </main>
        <section class="mr-command-deck" aria-label="Climbing controls">
          <div class="mr-next-moves">
            <span class="mr-prompt-label">YOUR NEXT MOVES</span>
            <div class="mr-prompt-sequence">${promptQueue(prompts)}</div>
            <p class="mr-status ${tone}" data-mr-status>${escapeHtml(statusText(publicState))}</p>
          </div>
          <div class="mr-direction-pad" aria-label="Direction pad">
            ${CONTROLS.map(token => `<button type="button" class="mr-control mr-control-${token}" data-mr-network-input="${token}" ${controlsEnabled ? '' : 'disabled'}><b>${symbol(token)}</b><small>${token.toUpperCase()}</small></button>`).join('')}
          </div>
        </section>
        ${countdownOverlay()}
        ${resultOverlay(publicState, me, total)}
      </div>`;
  }

  async function submit(rawToken) {
    const publicState = state();
    const bridge = window.__mountainRaceBridge;
    if (!bridge?.submit || runtime.busy || runtime.game?.status !== 'playing' || !publicState.canSubmit) return;
    runtime.busy = true;
    render();
    try {
      const token = control(rawToken);
      const actionId = `mr-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const data = await bridge.submit({ choice: `mountainrace:input:${token}`, actionId });
      runtime.busy = false;
      if (data?.game) adopt(data.game);
      else bridge.refresh?.();
    } catch (error) {
      runtime.busy = false;
      const status = runtime.root?.querySelector('[data-mr-status]');
      if (status) {
        status.className = 'mr-status wrong';
        status.textContent = String(error?.message || 'Unable to submit that move.');
      }
      render();
    }
  }

  function onPointerDown(event) {
    const input = event.target.closest('[data-mr-network-input]');
    if (input && runtime.root?.contains(input) && !input.disabled) {
      event.preventDefault();
      submit(input.dataset.mrNetworkInput);
      return;
    }
    if (event.target.closest('[data-mr-rematch]')) {
      event.preventDefault();
      window.__mountainRaceBridge?.rematch?.();
      return;
    }
    if (event.target.closest('[data-mr-new-game]')) {
      event.preventDefault();
      window.__mountainRaceBridge?.newGame?.();
    }
  }

  function onKeyDown(event) {
    const token = KEY_MAP[event.key];
    if (!token || event.repeat || runtime.game?.status !== 'playing') return;
    event.preventDefault();
    submit(token);
  }

  function updateClock() {
    const clock = runtime.root?.querySelector('[data-mr-clock]');
    if (clock && runtime.game?.status === 'playing') clock.textContent = String(secondsLeft()).padStart(2, '0');
    const countdown = runtime.root?.querySelector('[data-mr-countdown]');
    if (countdown && runtime.game?.status === 'countdown') {
      const value = countdownValue();
      countdown.textContent = value > 0 ? String(value) : 'GO!';
    }
  }

  function startTicker() {
    if (runtime.ticker) return;
    runtime.ticker = window.setInterval(updateClock, 120);
  }

  function adopt(game) {
    if (!game || game.mode !== MODE) return;
    runtime.game = game;
    runtime.busy = false;
    updateServerClock(game);
    render();
    startTicker();
  }

  window.addEventListener(STATE_EVENT, event => adopt(event?.detail?.game));
  document.addEventListener('pointerdown', onPointerDown, { passive: false });
  window.addEventListener('keydown', onKeyDown, { passive: false });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && runtime.game) window.__mountainRaceBridge?.refresh?.();
  });

  window.MountainRaceMultiplayer = Object.freeze({ adopt, render, submit });
})();
