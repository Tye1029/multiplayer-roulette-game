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
    const base = [38, 58, 44, 62, 40, 55][index % 6];
    if (token === 'left') return Math.max(30, base - 10);
    if (token === 'right') return Math.min(70, base + 10);
    return base;
  }

  function renderHolds(state, playerKey) {
      const player = state.players[playerKey];
      const total = state.sequence.length;
      const firstVisible = Math.max(0, player.promptIndex - 2);
      const lastVisible = Math.min(total - 1, player.promptIndex + 3);
      const holds = state.sequence.slice(firstVisible, lastVisible + 1).map((token, offset) => {
        const index = firstVisible + offset;
        const isCurrent = index === player.promptIndex && state.status === 'racing';
        const classes = ['mr-rock-hold', playerKey === 'opponent' && index >= player.promptIndex ? 'opponent-upcoming' : '', isCurrent ? 'current' : '', index === player.promptIndex - 1 ? 'contact' : '', index === total - 1 ? 'final-hold' : '', index < player.promptIndex ? 'passed' : ''].filter(Boolean).join(' ');
        return `<span class="${classes}" style="--mr-hold-bottom:${196 + index * 74}px;--mr-hold-left:${holdHorizontal(index, token)}%" data-mr-hold-index="${index}" data-mr-outcrop="${index % 4}" aria-hidden="true"><b>${promptLabel(token)}</b></span>`;
      }).join('');
      return holds + `<span class="mr-finish-ledge mr-summit-plateau" style="--mr-summit-bottom:${196 + Math.max(0, total - 1) * 74}px" aria-hidden="true"><i></i><b>SUMMIT</b></span>`;
    }

  function renderClimber(player, playerKey, sequence) {
      const index = Math.min(TOTAL_HOLDS, Math.max(0, player.promptIndex));
      const finished = Boolean(player.finishedAt) || index >= TOTAL_HOLDS || player.animation === 'celebrate';
      const contactIndex = finished ? Math.max(0, TOTAL_HOLDS - 1) : index - 1;
      const previousContactIndex = contactIndex - 1;
      const contactLeft = finished ? 50 : contactIndex >= 0 ? holdHorizontal(contactIndex, sequence[contactIndex]) : 50;
      const previousContactLeft = previousContactIndex >= 0 ? holdHorizontal(previousContactIndex, sequence[previousContactIndex]) : 50;
      const nextContactLeft = finished ? 50 : index < TOTAL_HOLDS ? holdHorizontal(index, sequence[index]) : contactLeft;
      const climberLeft = !finished && contactIndex >= 0 ? contactLeft + (nextContactLeft - contactLeft) * 0.3 : contactLeft;
      const summitApproach = !finished && index === TOTAL_HOLDS - 1;
      const travelDirection = nextContactLeft < contactLeft ? 'left' : 'right';
      const gripBottom = finished ? 272 + Math.max(0, TOTAL_HOLDS - 1) * 74 : contactIndex >= 0 ? 228 + contactIndex * 74 : 76;
      const reachBottom = gripBottom + (summitApproach ? 42 : 0);
      const raceLive = runtime.state?.status === 'racing';
      const startClass = !finished && contactIndex < 0 ? 'standing-start' : '';
      const startPoseClass = !finished && contactIndex < 0 ? (raceLive ? 'start-reaching' : 'start-waiting') : '';
      const readyClass = !finished && contactIndex >= 0 ? 'ready-next' : '';
      return `
        <div class="mr-climber ${playerKey} ${escapeHtml(player.animation)} ${finished ? 'finished standing-on-summit' : ''} ${startClass} ${startPoseClass} ${readyClass} ${summitApproach ? 'summit-reaching' : ''} direction-${travelDirection}" style="--mr-climber-grip-bottom:${reachBottom}px;--mr-climber-left:${climberLeft}%;--mr-previous-climber-left:${previousContactLeft}%" data-mr-animation-key="${escapeHtml(player.lastInput?.at || player.animation)}-${index}" data-mr-contact-index="${contactIndex}" aria-label="${escapeHtml(player.name)} climber">
          <span class="mr-motion-frame mr-motion-frame-0 mr-v44-climber-sprite mr-v45-climber-sprite" aria-hidden="true"></span>
        </div>`;
    }

  // MOUNTAIN_RACE_REALISTIC_CLIMBERS_V32
  function winnerConfetti() {
    return '<div class="mr-winner-confetti" style="--mr-confetti-bottom:' + (272 + 23 * 74) + 'px" aria-hidden="true">' + Array.from({ length: 28 }, (_, index) => '<i style="--mr-confetti-index:' + index + ';--mr-confetti-x:' + ((index * 37) % 100) + '%;--mr-confetti-drift:' + ((index - 10) * 3) + 'px"></i>').join('') + '</div>';
  }

  function renderLane(state, playerKey) {
      const player = state.players[playerKey];
      const total = state.sequence.length;
      const progress = progressOf(player, total);
      const summitView = player.animation === 'celebrate' || Boolean(player.finishedAt) || player.promptIndex >= total;
      const cameraIndex = player.animation === 'celebrate' ? total : Math.max(0, Math.min(total, player.promptIndex));
      const summitReveal = Math.max(0, Math.min(1, (cameraIndex - Math.max(0, total - 5)) / 5));
      const summitBottom = 196 + Math.max(0, total - 1) * 74;
      const scroll = Math.max(0, cameraIndex) * 74;
      const status = player.finishedAt ? 'SUMMIT REACHED' : `${player.promptIndex} / ${total}`;
      const mistakes = player.rejectedInputs;
      return `
        <section class="mr-lane ${playerKey} continuous-mountain ${summitReveal > 0 ? 'summit-approach' : ''} ${summitView ? 'summit-view' : 'cliff-view'}" data-mr-lane-view="${summitView ? 'summit' : summitReveal > 0 ? 'summit-approach' : 'cliff'}" data-mr-summit-reveal="${summitReveal.toFixed(2)}" data-mr-camera-index="${cameraIndex}" aria-label="${escapeHtml(player.name)} climbing lane">
          <header class="mr-player-card">
            <span class="mr-player-badge" aria-hidden="true">${playerKey === 'me' ? 'P1' : 'CPU'}</span>
            <span class="mr-player-copy"><strong>${escapeHtml(player.name)}</strong><small>${mistakes} ${mistakes === 1 ? 'MISTAKE' : 'MISTAKES'}</small></span>
            <span class="mr-player-progress">${status}</span>
          </header>
          <div class="mr-climb-viewport">
            <div class="mr-mountain-wall" style="--mr-wall-scroll:${scroll}px;--mr-wall-height:${Math.max(2600, 580 + total * 74)}px;--mr-summit-bottom:${summitBottom}px;--mr-summit-reveal:${summitReveal}">
              <span class="mr-v44-cliff" aria-hidden="true"></span>
              <span class="mr-v44-start" aria-hidden="true"><i></i></span>
              ${renderHolds(state, playerKey)}
              ${renderClimber(player, playerKey, state.sequence)}
              ${player.animation === 'celebrate' ? winnerConfetti() : ''}
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


  // MOUNTAIN_RACE_STATIC_SCENE_V40
  // Preserve decoded terrain/image nodes and patch only stateful DOM fields.
  function morphMountainNode(current, next) {
    if (!current || !next) return;
    if (current.nodeType !== next.nodeType || (current.nodeType === 1 && current.tagName !== next.tagName)) {
      current.replaceWith(next.cloneNode(true));
      return;
    }
    if (current.nodeType === 3) {
      if (current.nodeValue !== next.nodeValue) current.nodeValue = next.nodeValue;
      return;
    }
    if (current.nodeType !== 1) return;
    const currentElement = current;
    const nextElement = next;
    const currentAnimationKey = currentElement.getAttribute('data-mr-animation-key');
    const nextAnimationKey = nextElement.getAttribute('data-mr-animation-key');
    const animateClimber = currentElement.classList.contains('mr-climber') && currentAnimationKey !== nextAnimationKey;
    const previousClimberRect = animateClimber ? currentElement.getBoundingClientRect() : null;
    // MOUNTAIN_RACE_FLIP_MOTION_V42
    for (const name of currentElement.getAttributeNames()) {
      if (!nextElement.hasAttribute(name)) currentElement.removeAttribute(name);
    }
    for (const attribute of nextElement.attributes) {
      if (currentElement.getAttribute(attribute.name) !== attribute.value) currentElement.setAttribute(attribute.name, attribute.value);
    }
    let index = 0;
    while (index < nextElement.childNodes.length || index < currentElement.childNodes.length) {
      const currentChild = currentElement.childNodes[index];
      const nextChild = nextElement.childNodes[index];
      if (!nextChild) {
        currentChild.remove();
        continue;
      }
      if (!currentChild) {
        currentElement.append(nextChild.cloneNode(true));
        index += 1;
        continue;
      }
      morphMountainNode(currentChild, nextChild);
      index += 1;
    }
    if (animateClimber && previousClimberRect && typeof currentElement.animate === 'function') {
      const nextClimberRect = currentElement.getBoundingClientRect();
      const deltaX = previousClimberRect.left - nextClimberRect.left;
      const deltaY = previousClimberRect.top - nextClimberRect.top;
      const slipping = currentElement.classList.contains('slip');
      const celebrating = currentElement.classList.contains('celebrate');
      const duration = celebrating ? 1050 : slipping ? 620 : 520;
      currentElement.getAnimations().forEach(animation => animation.cancel());
      const keyframes = slipping
        ? [
            { translate: deltaX + 'px ' + deltaY + 'px', rotate: '0deg', offset: 0 },
            { translate: (deltaX + 8) + 'px ' + (deltaY * .52) + 'px', rotate: '6deg', offset: .48 },
            { translate: '0px 0px', rotate: '0deg', offset: 1 }
          ]
        : [
            { translate: deltaX + 'px ' + deltaY + 'px', offset: 0 },
            { translate: (deltaX * .22) + 'px ' + (deltaY * .18 - 5) + 'px', offset: .76 },
            { translate: '0px 0px', offset: 1 }
          ];
      const motion = currentElement.animate(keyframes, {
        duration,
        easing: 'cubic-bezier(.2,.72,.22,1)',
        fill: 'both'
      });
      motion.addEventListener('finish', () => motion.cancel(), { once: true });
      const frame = currentElement.querySelector('.mr-motion-frame-0');
      if (frame) {
        frame.style.animation = 'none';
        void frame.offsetWidth;
        frame.style.removeProperty('animation');
      }
    }
  }

  function render() {
      if (!runtime.root || !runtime.state) return;
      const state = runtime.state;
      const previousGameElement = runtime.root.querySelector(':scope > .mountain-race-game');
      const nextGameMarkup = `
        <div class="mountain-race-game" data-mode="${MODE}" data-status="${state.status}">
          <header class="mr-titlebar">
            <div><p>FIRST TO THE SUMMIT WINS</p><h2>SUMMIT SPRINT</h2></div>
            <div class="mr-race-clock ${remainingSeconds(state) <= 7 && state.status === 'racing' ? 'urgent' : ''}" aria-label="Race time remaining">
              <small>TIME</small><strong>${String(remainingSeconds(state)).padStart(2, '0')}</strong>
            </div>
          </header>
          <main class="mr-race-stage">
            ${renderLane(state, 'me')}
            ${renderLane(state, 'opponent')}
            <span class="mr-v51-center-rope" aria-hidden="true"><i></i></span>
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
      const template = document.createElement('template');
      template.innerHTML = nextGameMarkup.trim();
      const nextGameElement = template.content.firstElementChild;
      if (!nextGameElement) return;
      if (previousGameElement) {
        previousGameElement.className = nextGameElement.className;
        for (const name of previousGameElement.getAttributeNames()) {
          if (name !== 'class' && !nextGameElement.hasAttribute(name)) previousGameElement.removeAttribute(name);
        }
        for (const attribute of nextGameElement.attributes) {
          if (attribute.name !== 'class') previousGameElement.setAttribute(attribute.name, attribute.value);
        }
        morphMountainNode(previousGameElement, nextGameElement);
      } else {
        runtime.root.append(nextGameElement);
      }
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
      setPlayerAnimation(playerKey, `climb-${token}`, 520);
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
      setPlayerAnimation(playerKey, 'slip', 620);
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
    // MOUNTAIN_RACE_GENERATED_ASSETS_V29
    root.setAttribute('data-mountain-race-mount', '');
    root.dataset.mrProfessionalRebuild = '27';
    root.dataset.mrGeneratedAssets = '29';
    root.dataset.mrVisualReboot = '44';
    root.dataset.mrContactLedges = '45';
    root.dataset.mrRuggedTerrain = '46';
    root.dataset.mrFinishStability = '47';
    root.dataset.mrNaturalTerrain = '49';
    root.dataset.mrSummitContact = '50';
    root.dataset.mrSharedMountain = '51';
    root.dataset.mrWinnerSummit = '52';
    root.dataset.mrWinnerCamera = '53';
    root.dataset.mrGroundedAscent = '54';
    root.dataset.mrRouteClarity = '55';
    root.dataset.mrNaturalSummit = '56';
    root.dataset.mrCelebrationContact = '57';
    root.dataset.mrSummitSky = '58';
    root.dataset.mrContinuousSummit = '59';
    root.dataset.mrNaturalWorld = '60';
    root.dataset.mrGroundedWorld = '61';
    root.dataset.mrContinuousScenery = '62';
    root.dataset.mrUnifiedScene = '63';
    // MOUNTAIN_RACE_UNIFIED_SCENE_V63
    // MOUNTAIN_RACE_CONTINUOUS_SCENERY_V62
    // MOUNTAIN_RACE_GROUNDED_WORLD_V61
    // MOUNTAIN_RACE_NATURAL_WORLD_V60
    // MOUNTAIN_RACE_CONTINUOUS_SUMMIT_V59
    // MOUNTAIN_RACE_SUMMIT_SKY_V58
    // MOUNTAIN_RACE_CELEBRATION_CONTACT_V57
    // MOUNTAIN_RACE_NATURAL_SUMMIT_V56
    // MOUNTAIN_RACE_ROUTE_CLARITY_V55
    // MOUNTAIN_RACE_GROUNDED_ASCENT_V54
    // MOUNTAIN_RACE_WINNER_CAMERA_V53
    // MOUNTAIN_RACE_WINNER_SUMMIT_V52
    // MOUNTAIN_RACE_SHARED_MOUNTAIN_V51
    // MOUNTAIN_RACE_SUMMIT_CONTACT_V50
    // MOUNTAIN_RACE_NATURAL_TERRAIN_V49
    // MOUNTAIN_RACE_VISUAL_REBOOT_V44
    // MOUNTAIN_RACE_CONTACT_LEDGES_V45
    // MOUNTAIN_RACE_RUGGED_TERRAIN_V46
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
