(() => {
  'use strict';

  const MODE = 'mountainrace';
  const CONTROL_TOKENS = Object.freeze(['up', 'left', 'right', 'down']);
  const TOTAL_HOLDS = 24;
  const RACE_DURATION_MS = 30_000;
  const COUNTDOWN_SECONDS = 3;
  const BOT_ERROR_RATE = 0.08;
  const KEY_TO_CONTROL = Object.freeze({
    ArrowUp: 'up',
    ArrowLeft: 'left',
    ArrowRight: 'right',
    ArrowDown: 'down',
    w: 'up',
    W: 'up',
    a: 'left',
    A: 'left',
    d: 'right',
    D: 'right',
    s: 'down',
    S: 'down'
  });

  const runtime = {
    mounted: false,
    root: null,
    state: null,
    countdownTimer: 0,
    clockTimer: 0,
    botTimer: 0,
    lastInputAt: 0,
    animationTimer: 0,
    onPointerDown: null,
    onKeyDown: null
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

  function promptName(token) {
    return normalizePrompt(token).toUpperCase();
  }

  function randomControl(exclude = '') {
    const choices = CONTROL_TOKENS.filter(token => token !== exclude);
    return choices[Math.floor(Math.random() * choices.length)] || 'up';
  }

  function createSequence(length = TOTAL_HOLDS) {
    const total = Math.max(8, Math.min(80, Math.trunc(Number(length) || TOTAL_HOLDS)));
    const sequence = [];
    for (let index = 0; index < total; index += 1) {
      const previous = sequence[index - 1] || '';
      const beforePrevious = sequence[index - 2] || '';
      let token = randomControl();
      if (token === previous && token === beforePrevious) token = randomControl(token);
      sequence.push(token);
    }
    return sequence;
  }

  function createPlayer(id, name) {
    return {
      id,
      name,
      promptIndex: 0,
      acceptedInputs: 0,
      rejectedInputs: 0,
      lastInput: null,
      animation: 'waiting',
      finishedAt: null
    };
  }

  function createPrototypeState() {
    return {
      mode: MODE,
      status: 'ready',
      sequence: createSequence(TOTAL_HOLDS),
      players: {
        me: createPlayer('local-player', 'YOU'),
        opponent: createPlayer('normal-bot', 'MOUNTAIN BOT')
      },
      countdown: COUNTDOWN_SECONDS,
      startedAt: null,
      endsAt: null,
      millisecondsLeft: RACE_DURATION_MS,
      winner: null,
      message: 'Press START RACE when you are ready.',
      messageTone: 'neutral'
    };
  }

  function progressOf(player, sequenceLength) {
    return sequenceLength > 0 ? clamp(player.promptIndex / sequenceLength, 0, 1) : 0;
  }

  function remainingSeconds(state) {
    return Math.max(0, Math.ceil((Number(state.millisecondsLeft) || 0) / 1000));
  }

  function clearTimers() {
    window.clearInterval(runtime.countdownTimer);
    window.clearInterval(runtime.clockTimer);
    window.clearTimeout(runtime.botTimer);
    window.clearTimeout(runtime.animationTimer);
    runtime.countdownTimer = 0;
    runtime.clockTimer = 0;
    runtime.botTimer = 0;
    runtime.animationTimer = 0;
  }

  function setPlayerAnimation(playerKey, animation, duration = 280) {
    const player = runtime.state?.players?.[playerKey];
    if (!player) return;
    player.animation = animation;
    window.clearTimeout(runtime.animationTimer);
    runtime.animationTimer = window.setTimeout(() => {
      if (!runtime.state?.players?.[playerKey]) return;
      runtime.state.players[playerKey].animation = runtime.state.status === 'complete' && runtime.state.winner === playerKey
        ? 'celebrate'
        : 'waiting';
      render();
    }, duration);
  }

  function holdHorizontal(index, token) {
    const base = [24, 62, 38, 70, 31, 57][index % 6];
    if (token === 'left') return Math.max(17, base - 10);
    if (token === 'right') return Math.min(83, base + 10);
    return base;
  }

  function renderHolds(state, playerKey) {
    const player = state.players[playerKey];
    const total = state.sequence.length;
    const holds = state.sequence.map((token, index) => {
      const isCurrent = index === player.promptIndex && state.status === 'racing';
      const isPassed = index < player.promptIndex;
      const isFuture = index > player.promptIndex + 5;
      const classes = [
        'mr-rock-hold',
        isCurrent ? 'current' : '',
        isPassed ? 'passed' : '',
        isFuture ? 'distant' : ''
      ].filter(Boolean).join(' ');
      const bottom = 86 + index * 58;
      const left = holdHorizontal(index, token);
      return `<span class="${classes}" style="--mr-hold-bottom:${bottom}px;--mr-hold-left:${left}%" aria-hidden="true"><b>${promptLabel(token)}</b></span>`;
    }).join('');

    const summitBottom = 86 + total * 58;
    return `${holds}<span class="mr-finish-ledge" style="--mr-summit-bottom:${summitBottom}px" aria-hidden="true"><i></i><b>SUMMIT</b></span>`;
  }

  function renderClimber(player, playerKey) {
    const index = Math.min(TOTAL_HOLDS, Math.max(0, player.promptIndex));
    const bottom = 62 + index * 58;
    const latestToken = normalizePrompt(player.lastInput?.control || 'up');
    return `
      <div class="mr-climber ${playerKey} ${escapeHtml(player.animation)} direction-${latestToken}" style="--mr-climber-bottom:${bottom}px" aria-label="${escapeHtml(player.name)} climber">
        <span class="mr-arm left-arm"></span>
        <span class="mr-arm right-arm"></span>
        <span class="mr-climber-head"></span>
        <span class="mr-climber-body"></span>
        <span class="mr-leg left-leg"></span>
        <span class="mr-leg right-leg"></span>
      </div>`;
  }

  function renderLane(state, playerKey) {
    const player = state.players[playerKey];
    const total = state.sequence.length;
    const progress = progressOf(player, total);
    const progressPercent = Math.round(progress * 100);
    const scroll = Math.max(0, player.promptIndex - 3) * 58;
    const status = player.finishedAt ? 'SUMMIT REACHED' : `${player.promptIndex} / ${total}`;
    const mistakes = player.rejectedInputs;

    return `
      <section class="mr-lane ${playerKey}" aria-label="${escapeHtml(player.name)} climbing lane">
        <header class="mr-player-card">
          <span class="mr-player-badge" aria-hidden="true">${playerKey === 'me' ? 'P1' : 'CPU'}</span>
          <span class="mr-player-copy">
            <strong>${escapeHtml(player.name)}</strong>
            <small>${mistakes} ${mistakes === 1 ? 'MISTAKE' : 'MISTAKES'}</small>
          </span>
          <span class="mr-player-progress">${status}</span>
        </header>
        <div class="mr-climb-viewport">
          <div class="mr-mountain-wall" style="--mr-wall-scroll:${scroll}px">
            ${renderHolds(state, playerKey)}
            ${renderClimber(player, playerKey)}
          </div>
          <div class="mr-altitude-meter" aria-hidden="true"><i style="--mr-altitude:${progress}"></i></div>
        </div>
      </section>`;
  }

  function visiblePrompts(state) {
    const player = state.players.me;
    const start = Math.min(state.sequence.length, Math.max(0, player.promptIndex));
    return state.sequence.slice(start, start + 4);
  }

  function renderPromptQueue(state) {
    const prompts = visiblePrompts(state);
    if (!prompts.length) return '<span class="mr-queue-complete">SUMMIT REACHED</span>';
    return prompts.map((token, index) => `
      <span class="mr-prompt ${index === 0 ? 'active' : ''}" aria-label="${promptName(token)}${index === 0 ? ', current move' : ''}">
        <b>${promptLabel(token)}</b>
        <small>${index === 0 ? 'NOW' : `+${index}`}</small>
      </span>`).join('');
  }

  function renderControlButton(token) {
    return `
      <button type="button" class="mr-control mr-control-${token}" data-mr-input="${token}" aria-label="Press ${promptName(token)}" ${runtime.state?.status === 'racing' ? '' : 'disabled'}>
        <b>${promptLabel(token)}</b>
        <small>${promptName(token)}</small>
      </button>`;
  }

  function renderOverlay(state) {
    if (state.status === 'ready') {
      return `
        <div class="mr-overlay ready" data-mr-overlay>
          <div class="mr-overlay-card">
            <span class="mr-eyebrow">LOCAL GAMEPLAY PROTOTYPE</span>
            <h1>SUMMIT SPRINT</h1>
            <p>Hit each direction in order. A wrong input makes you slip back one hold. Reach the summit before the bot.</p>
            <button type="button" class="mr-start-button" data-mr-start>START RACE</button>
            <small>Arrow keys, WASD, or the on-screen controls</small>
          </div>
        </div>`;
    }

    if (state.status === 'countdown') {
      return `
        <div class="mr-overlay countdown" data-mr-overlay>
          <div class="mr-countdown-number">${state.countdown > 0 ? state.countdown : 'GO!'}</div>
        </div>`;
    }

    if (state.status === 'complete') {
      const winnerText = state.winner === 'me'
        ? 'YOU REACHED THE SUMMIT FIRST!'
        : state.winner === 'opponent'
          ? 'THE BOT REACHED THE SUMMIT FIRST'
          : 'THE RACE ENDED IN A TIE';
      return `
        <div class="mr-overlay complete" data-mr-overlay>
          <div class="mr-overlay-card result ${state.winner === 'me' ? 'win' : state.winner === 'opponent' ? 'loss' : 'tie'}">
            <span class="mr-eyebrow">RACE COMPLETE</span>
            <h1>${winnerText}</h1>
            <p>You climbed ${state.players.me.promptIndex} of ${state.sequence.length} holds with ${state.players.me.rejectedInputs} mistakes.</p>
            <button type="button" class="mr-start-button" data-mr-restart>RACE AGAIN</button>
          </div>
        </div>`;
    }

    return '';
  }

  function render() {
    if (!runtime.root || !runtime.state) return;
    const state = runtime.state;
    runtime.root.innerHTML = `
      <div class="mountain-race-game" data-mode="${MODE}" data-status="${state.status}">
        <header class="mr-titlebar">
          <div>
            <p>FIRST TO THE SUMMIT WINS</p>
            <h2>SUMMIT SPRINT</h2>
          </div>
          <div class="mr-race-clock ${remainingSeconds(state) <= 7 && state.status === 'racing' ? 'urgent' : ''}" aria-label="Race time remaining">
            <small>TIME</small>
            <strong>${String(remainingSeconds(state)).padStart(2, '0')}</strong>
          </div>
        </header>

        <main class="mr-race-stage">
          ${renderLane(state, 'me')}
          ${renderLane(state, 'opponent')}
        </main>

        <section class="mr-command-deck" aria-label="Climbing controls">
          <div class="mr-next-moves">
            <span class="mr-prompt-label">YOUR NEXT MOVES</span>
            <div class="mr-prompt-sequence">${renderPromptQueue(state)}</div>
            <p class="mr-status ${escapeHtml(state.messageTone)}" data-mr-status>${escapeHtml(state.message)}</p>
          </div>
          <div class="mr-direction-pad" aria-label="Direction pad">
            ${renderControlButton('up')}
            ${renderControlButton('left')}
            ${renderControlButton('down')}
            ${renderControlButton('right')}
          </div>
        </section>

        ${renderOverlay(state)}
      </div>`;
  }

  function announce(message, tone = 'neutral') {
    if (!runtime.state) return;
    runtime.state.message = message;
    runtime.state.messageTone = tone;
  }

  function finishRace(winner, reason) {
    if (!runtime.state || runtime.state.status === 'complete') return;
    runtime.state.status = 'complete';
    runtime.state.winner = winner;
    announce(reason, winner === 'me' ? 'correct' : winner === 'opponent' ? 'wrong' : 'neutral');
    clearTimers();
    if (winner === 'me') setPlayerAnimation('me', 'celebrate', 1200);
    if (winner === 'opponent') setPlayerAnimation('opponent', 'celebrate', 1200);
    render();
  }

  function resolveTimeout() {
    if (!runtime.state || runtime.state.status !== 'racing') return;
    const me = runtime.state.players.me.promptIndex;
    const opponent = runtime.state.players.opponent.promptIndex;
    if (me > opponent) finishRace('me', 'Time expired. You were higher on the mountain.');
    else if (opponent > me) finishRace('opponent', 'Time expired. The bot was higher on the mountain.');
    else finishRace('tie', 'Time expired with both climbers at the same height.');
  }

  function scheduleBotMove() {
    window.clearTimeout(runtime.botTimer);
    if (!runtime.state || runtime.state.status !== 'racing') return;
    const delay = 430 + Math.floor(Math.random() * 260);
    runtime.botTimer = window.setTimeout(() => {
      if (!runtime.state || runtime.state.status !== 'racing') return;
      const player = runtime.state.players.opponent;
      const expected = runtime.state.sequence[player.promptIndex];
      const token = Math.random() < BOT_ERROR_RATE ? randomControl(expected) : expected;
      applyInput('opponent', token, true);
      scheduleBotMove();
    }, delay);
  }

  function applyInput(playerKey, rawToken, isBot = false) {
    const state = runtime.state;
    if (!state || state.status !== 'racing') return;
    const player = state.players[playerKey];
    if (!player || player.finishedAt) return;

    const token = normalizePrompt(rawToken);
    const expected = normalizePrompt(state.sequence[player.promptIndex]);
    const correct = token === expected;
    const now = Date.now();

    if (correct) {
      player.promptIndex = Math.min(state.sequence.length, player.promptIndex + 1);
      player.acceptedInputs += 1;
      player.lastInput = { control: token, expected, correct: true, at: now };
      setPlayerAnimation(playerKey, `climb-${token}`, 250);
      if (!isBot) {
        announce(`${promptName(token)} — clean move! Keep climbing.`, 'correct');
        navigator.vibrate?.(18);
      }
      if (player.promptIndex >= state.sequence.length) {
        player.finishedAt = now;
        finishRace(playerKey, playerKey === 'me' ? 'You reached the summit first!' : 'The bot reached the summit first.');
        return;
      }
    } else {
      player.promptIndex = Math.max(0, player.promptIndex - 1);
      player.rejectedInputs += 1;
      player.lastInput = { control: token, expected, correct: false, at: now };
      setPlayerAnimation(playerKey, 'slip', 420);
      if (!isBot) {
        announce(`${promptName(token)} was wrong. You slipped back one hold.`, 'wrong');
        navigator.vibrate?.([35, 35, 65]);
      }
    }

    render();
  }

  function submitLocalInput(rawToken) {
    const now = performance.now();
    if (now - runtime.lastInputAt < 85) return;
    runtime.lastInputAt = now;
    applyInput('me', rawToken, false);
  }

  function startClock() {
    window.clearInterval(runtime.clockTimer);
    runtime.clockTimer = window.setInterval(() => {
      const state = runtime.state;
      if (!state || state.status !== 'racing') return;
      state.millisecondsLeft = Math.max(0, state.endsAt - Date.now());
      if (state.millisecondsLeft <= 0) {
        resolveTimeout();
        return;
      }
      render();
    }, 200);
  }

  function beginRace() {
    clearTimers();
    runtime.state = createPrototypeState();
    runtime.state.status = 'countdown';
    runtime.state.countdown = COUNTDOWN_SECONDS;
    runtime.state.message = 'Get ready to climb.';
    render();

    runtime.countdownTimer = window.setInterval(() => {
      if (!runtime.state || runtime.state.status !== 'countdown') return;
      runtime.state.countdown -= 1;
      if (runtime.state.countdown < 0) {
        window.clearInterval(runtime.countdownTimer);
        runtime.countdownTimer = 0;
        const now = Date.now();
        runtime.state.status = 'racing';
        runtime.state.startedAt = now;
        runtime.state.endsAt = now + RACE_DURATION_MS;
        runtime.state.millisecondsLeft = RACE_DURATION_MS;
        announce('Follow the glowing hold. Wrong moves cost one position.', 'neutral');
        render();
        startClock();
        scheduleBotMove();
        return;
      }
      render();
    }, 760);
  }

  function onPointerDown(event) {
    const start = event.target.closest('[data-mr-start], [data-mr-restart]');
    if (start && runtime.root?.contains(start)) {
      event.preventDefault();
      beginRace();
      return;
    }

    const button = event.target.closest('[data-mr-input]');
    if (!button || !runtime.root?.contains(button) || button.disabled) return;
    event.preventDefault();
    submitLocalInput(button.dataset.mrInput);
  }

  function onKeyDown(event) {
    if (!runtime.mounted || !runtime.root || runtime.state?.status !== 'racing') return;
    const token = KEY_TO_CONTROL[event.key];
    if (!token || event.repeat) return;
    event.preventDefault();
    submitLocalInput(token);
  }

  function mount(root, options = {}) {
    if (!(root instanceof Element)) throw new TypeError('Summit Sprint requires a valid mount element.');
    unmount();
    runtime.root = root;
    runtime.state = options.state || createPrototypeState();
    runtime.mounted = true;
    runtime.onPointerDown = onPointerDown;
    runtime.onKeyDown = onKeyDown;
    root.addEventListener('pointerdown', runtime.onPointerDown);
    window.addEventListener('keydown', runtime.onKeyDown, { passive: false });
    render();
  }

  function update(game = {}) {
    if (!runtime.mounted || !runtime.root) return;
    if (game?.state) runtime.state = game.state;
    render();
  }

  function unmount() {
    clearTimers();
    if (runtime.root && runtime.onPointerDown) runtime.root.removeEventListener('pointerdown', runtime.onPointerDown);
    if (runtime.onKeyDown) window.removeEventListener('keydown', runtime.onKeyDown);
    runtime.mounted = false;
    runtime.root = null;
    runtime.state = null;
    runtime.onPointerDown = null;
    runtime.onKeyDown = null;
  }

  window.MountainRaceGame = Object.freeze({
    mode: MODE,
    controls: CONTROL_TOKENS,
    mount,
    update,
    unmount,
    startPrototype: beginRace
  });

  window.addEventListener('DOMContentLoaded', () => {
    const demo = document.querySelector('[data-mountain-race-demo]');
    if (demo) mount(demo);
  }, { once: true });
})();
