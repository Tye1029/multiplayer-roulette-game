(() => {
  'use strict';

  /* MOUNTAIN_RACE_VISUAL_FOUNDATION_V13 */
  // MOUNTAIN_RACE_VISUAL_REBUILD_V14
  // MOUNTAIN_RACE_DAYLIGHT_TERRAIN_V15
  // MOUNTAIN_RACE_RASTER_CLIFF_V16
  // MOUNTAIN_RACE_ENVIRONMENT_POLISH_V17
  // MOUNTAIN_RACE_CONCEPT_TARGET_V18
  // MOUNTAIN_RACE_CONCEPT_DETAIL_V19
  // MOUNTAIN_RACE_SCREENSHOT_BASE_V20
  // MOUNTAIN_RACE_REFERENCE_ATLAS_V21

  // MOUNTAIN_RACE_VISIBLE_GAMEPLAY_V1
  // MOUNTAIN_RACE_LOAD_PERFORMANCE_V1
  // MOUNTAIN_RACE_STATE_SYNC_V1
  // MOUNTAIN_RACE_AUTHORITATIVE_ORDER_V2
  // MOUNTAIN_RACE_RELIABLE_INPUTS_V3
  // MOUNTAIN_RACE_LOW_LATENCY_INPUTS_V4
  // MOUNTAIN_RACE_INSTANT_INPUT_QUEUE_V5
  // MOUNTAIN_RACE_CONTINUOUS_SYNC_V6
  // MOUNTAIN_RACE_STARTUP_COMPLETION_V7
  // MOUNTAIN_RACE_INPUT_REBASE_V8

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
    lastOpponentInputAt: '',
    pendingInput: null,
    pendingActionId: '',
    renderKey: '',
    syncNotice: '',
    resultRevealGameId: '',
    resultRevealReady: false,
    resultRevealTimer: 0,
    botWakeTimer: 0,
    botWakeInFlight: false,
    inputQueue: [],
    inputSequence: 0,
    inputFlushTimer: 0,
    inputBatchInFlight: [],
    inputQueueBlocked: false
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
    return directionGlyphV18(value);
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

  function meaningfulRenderKey(game) {
    const publicState = game?.mountainraceState || {};
    const me = publicState.me || {};
    const opponent = publicState.opponent || {};
    return JSON.stringify([
      game?.gameId || '',
      game?.status || '',
      publicState.revision ?? '',
      publicState.stepsTotal ?? '',
      Boolean(publicState.canSubmit),
      Array.isArray(publicState.prompts) ? publicState.prompts.join(',') : '',
      me.promptIndex ?? 0,
      me.rejectedInputs ?? 0,
      me.lastInput?.at || '',
      me.lastInput?.correct ?? '',
      opponent.promptIndex ?? 0,
      opponent.rejectedInputs ?? 0,
      opponent.lastInput?.at || '',
      opponent.lastInput?.correct ?? '',
      publicState.winnerId || '',
      Boolean(publicState.viewerWon),
      Boolean(publicState.tie)
    ]);
  }

  function lifecycleRank(status) {
    return ({ waiting: 0, ready: 1, countdown: 2, playing: 3, complete: 4, cancelled: 4 })[String(status || 'waiting')] ?? 0;
  }

  function snapshotVersion(game) {
    return {
      statusRank: lifecycleRank(game?.status),
      gameRevision: Math.max(-1, Number(game?.revision ?? -1)),
      stateRevision: Math.max(-1, Number(game?.mountainraceState?.revision ?? -1)),
      roundId: String(game?.mountainraceState?.roundId || '')
    };
  }

  function compareSnapshotVersions(accepted, incoming) {
    const sameRound = !accepted?.roundId || !incoming?.roundId || accepted.roundId === incoming.roundId;
    if (!sameRound) return -1;
    if (incoming.stateRevision !== accepted.stateRevision) return incoming.stateRevision - accepted.stateRevision;
    if (incoming.statusRank !== accepted.statusRank) return incoming.statusRank - accepted.statusRank;
    if (incoming.gameRevision !== accepted.gameRevision) return incoming.gameRevision - accepted.gameRevision;
    return 0;
  }

  function acceptsSnapshot(game) {
    if (!runtime.game || String(runtime.game.gameId || '') !== String(game?.gameId || '')) return true;
    const accepted = snapshotVersion(runtime.game);
    const incoming = snapshotVersion(game);
    const differentRound = Boolean(accepted.roundId && incoming.roundId && accepted.roundId !== incoming.roundId);
    const stale = differentRound && incoming.statusRank <= accepted.statusRank;
    if (stale) {
      window.__mountainRaceRejectedSnapshots = Number(window.__mountainRaceRejectedSnapshots || 0) + 1;
      return false;
    }
    return true;
  }

  function finishPendingAction(actionId = '') {
    if (actionId && runtime.pendingActionId && actionId !== runtime.pendingActionId) return false;
    runtime.busy = false;
    runtime.pendingInput = null;
    runtime.pendingActionId = '';
    return true;
  }

  function restoreAcceptedBoard() {
    const mount = document.querySelector('[data-mountain-race-mount]');
    if (!mount || !runtime.game) return;
    runtime.root = mount;
    if (!mount.querySelector('.mountain-race-game')) render();
  }

  function scheduleResultReveal(previousGame, game) {
    const id = String(game?.gameId || '');
    if (String(game?.status || '') !== 'complete') {
      if (runtime.resultRevealTimer) window.clearTimeout(runtime.resultRevealTimer);
      runtime.resultRevealTimer = 0;
      runtime.resultRevealGameId = id;
      runtime.resultRevealReady = false;
      return;
    }
    if (runtime.resultRevealGameId === id && (runtime.resultRevealReady || runtime.resultRevealTimer)) return;
    if (runtime.resultRevealTimer) window.clearTimeout(runtime.resultRevealTimer);
    runtime.resultRevealGameId = id;
    const transitionedFromRace = Boolean(previousGame && String(previousGame.gameId || '') === id && String(previousGame.status || '') !== 'complete');
    if (!transitionedFromRace) {
      runtime.resultRevealReady = true;
      runtime.resultRevealTimer = 0;
      return;
    }
    runtime.resultRevealReady = false;
    runtime.resultRevealTimer = window.setTimeout(() => {
      runtime.resultRevealTimer = 0;
      if (runtime.game?.gameId !== id || runtime.game?.status !== 'complete') return;
      runtime.resultRevealReady = true;
      render();
    }, 2600); // MOUNTAIN_RACE_SHARED_MOUNTAIN_V51: keep either summit winner visible before results
  }

  function secondsLeft() {
    const publicState = state();
    if (runtime.game?.status === 'complete' || publicState.completedAt) return 0;
    const endAt = Date.parse(String(publicState.endAt || ''));
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

  function inputTimestamp(input) {
    const parsed = Date.parse(String(input?.at || ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function newerInput(previousInput, incomingInput) {
    if (!previousInput) return incomingInput || null;
    if (!incomingInput) return previousInput || null;
    const previousTime = inputTimestamp(previousInput);
    const incomingTime = inputTimestamp(incomingInput);
    if (incomingTime !== previousTime) return incomingTime > previousTime ? incomingInput : previousInput;
    return String(incomingInput.at || '') >= String(previousInput.at || '') ? incomingInput : previousInput;
  }

  function authoritativeSlip(previousPlayer = {}, incomingPlayer = {}, previousRevision = -1, incomingRevision = -1) {
    const previousIndex = Math.max(0, Math.trunc(Number(previousPlayer.promptIndex) || 0));
    const incomingIndex = Math.max(0, Math.trunc(Number(incomingPlayer.promptIndex) || 0));
    if (incomingIndex >= previousIndex || Number(incomingRevision) < Number(previousRevision)) return false;

    const incomingInput = incomingPlayer.lastInput;
    if (!incomingInput || incomingInput.correct !== false) return false;
    const incomingTime = inputTimestamp(incomingInput);
    const previousTime = inputTimestamp(previousPlayer.lastInput);
    return incomingTime > previousTime;
  }

  function mergePlayerProgress(previousPlayer = {}, incomingPlayer = {}, options = {}) {
    const previousIndex = Math.max(0, Math.trunc(Number(previousPlayer.promptIndex) || 0));
    const incomingIndex = Math.max(0, Math.trunc(Number(incomingPlayer.promptIndex) || 0));
    const allowBackward = Boolean(options.allowBackward);
    const promptIndex = allowBackward ? incomingIndex : Math.max(previousIndex, incomingIndex);
    return {
      ...previousPlayer,
      ...incomingPlayer,
      promptIndex,
      acceptedInputs: Math.max(
        Math.max(0, Math.trunc(Number(previousPlayer.acceptedInputs) || 0)),
        Math.max(0, Math.trunc(Number(incomingPlayer.acceptedInputs) || 0))
      ),
      rejectedInputs: Math.max(
        Math.max(0, Math.trunc(Number(previousPlayer.rejectedInputs) || 0)),
        Math.max(0, Math.trunc(Number(incomingPlayer.rejectedInputs) || 0))
      ),
      progress: allowBackward
        ? Math.max(0, Number(incomingPlayer.progress) || 0)
        : Math.max(Number(previousPlayer.progress) || 0, Number(incomingPlayer.progress) || 0),
      lastInput: newerInput(previousPlayer.lastInput, incomingPlayer.lastInput),
      finishedAt: incomingPlayer.finishedAt || previousPlayer.finishedAt || null
    };
  }

  function mergeMountainRaceGame(previousGame, incomingGame) {
    if (!previousGame || String(previousGame.gameId || '') !== String(incomingGame?.gameId || '')) return incomingGame;
    const previousState = previousGame.mountainraceState || {};
    const incomingState = incomingGame?.mountainraceState || {};
    const previousRound = String(previousState.roundId || '');
    const incomingRound = String(incomingState.roundId || '');
    if (previousRound && incomingRound && previousRound !== incomingRound) return incomingGame;

    const previousMeIndex = Math.max(0, Math.trunc(Number(previousState.me?.promptIndex) || 0));
    const incomingMeIndex = Math.max(0, Math.trunc(Number(incomingState.me?.promptIndex) || 0));
    const previousStateRevision = Math.max(-1, Number(previousState.revision ?? -1));
    const incomingStateRevision = Math.max(-1, Number(incomingState.revision ?? -1));
    const ownSlip = authoritativeSlip(previousState.me, incomingState.me, previousStateRevision, incomingStateRevision);
    const opponentSlip = authoritativeSlip(previousState.opponent, incomingState.opponent, previousStateRevision, incomingStateRevision);
    const incomingOwnsRunway = ownSlip
      || incomingMeIndex > previousMeIndex
      || (incomingMeIndex === previousMeIndex && incomingStateRevision >= previousStateRevision);
    const previousStatusRank = lifecycleRank(previousGame.status);
    const incomingStatusRank = lifecycleRank(incomingGame?.status);
    const incomingOwnsLifecycle = incomingStatusRank >= previousStatusRank;
    const previousSeconds = Number(previousState.secondsLeft);
    const incomingSeconds = Number(incomingState.secondsLeft);
    const secondsLeft = Number.isFinite(previousSeconds) && Number.isFinite(incomingSeconds)
      ? Math.min(previousSeconds, incomingSeconds)
      : Number.isFinite(incomingSeconds) ? incomingSeconds : previousSeconds;

    const mergedState = {
      ...previousState,
      ...incomingState,
      revision: Math.max(previousStateRevision, incomingStateRevision),
      secondsLeft,
      prompts: incomingOwnsRunway
        ? (Array.isArray(incomingState.prompts) ? incomingState.prompts : [])
        : (Array.isArray(previousState.prompts) ? previousState.prompts : []),
      inputPrompts: incomingOwnsRunway
        ? (Array.isArray(incomingState.inputPrompts) ? incomingState.inputPrompts : incomingState.prompts || [])
        : (Array.isArray(previousState.inputPrompts) ? previousState.inputPrompts : previousState.prompts || []),
      me: mergePlayerProgress(previousState.me, incomingState.me, { allowBackward: ownSlip }),
      opponent: mergePlayerProgress(previousState.opponent, incomingState.opponent, { allowBackward: opponentSlip }),
      completedAt: incomingState.completedAt || previousState.completedAt || null,
      winnerUserId: incomingOwnsLifecycle
        ? String(incomingState.winnerUserId || previousState.winnerUserId || '')
        : String(previousState.winnerUserId || incomingState.winnerUserId || ''),
      viewerWon: incomingOwnsLifecycle ? Boolean(incomingState.viewerWon) : Boolean(previousState.viewerWon),
      tie: incomingOwnsLifecycle ? Boolean(incomingState.tie) : Boolean(previousState.tie)
    };

    return {
      ...previousGame,
      ...incomingGame,
      status: incomingOwnsLifecycle ? incomingGame.status : previousGame.status,
      revision: Math.max(Number(previousGame.revision) || 0, Number(incomingGame?.revision) || 0),
      mountainraceState: mergedState
    };
  }

  function optimisticPresentation(publicState, prompts, total) {
    const authoritativeMe = player(publicState.me, 'YOU', 'YOU');
    const roundId = String(publicState.roundId || '');
    const pending = runtime.inputQueue
      .filter(item => item.roundId === roundId && item.fromIndex >= authoritativeMe.promptIndex)
      .sort((a, b) => a.order - b.order);
    if (!pending.length) {
      return { authoritativeMe, me: authoritativeMe, prompts, animation: '', tone: '', queueDepth: 0, blocked: false };
    }

    const me = { ...authoritativeMe };
    let consumedPrompts = 0;
    let last = null;
    let blocked = false;
    for (const item of pending) {
      if (item.fromIndex !== me.promptIndex) break;
      const currentExpected = prompts[consumedPrompts] || '';
      if (!currentExpected || item.expected !== currentExpected) {
        blocked = true;
        break;
      }
      const correct = item.token === item.expected;
      last = item;
      me.lastInput = { control: item.token, correct, at: item.at };
      if (correct) {
        me.promptIndex = Math.min(Math.max(0, total - 1), me.promptIndex + 1);
        consumedPrompts += 1;
      } else {
        me.promptIndex = Math.max(0, me.promptIndex - 1);
        me.rejectedInputs += 1;
        blocked = true;
        break;
      }
    }

    return {
      authoritativeMe,
      me,
      prompts: blocked ? [] : prompts.slice(consumedPrompts),
      animation: last ? (last.correct ? `climb-${last.token}` : 'slip') : '',
      tone: last ? (last.correct ? 'correct' : 'wrong') : '',
      queueDepth: pending.length,
      blocked
    };
  }

  function holdLeft(index) {
    return [38, 58, 44, 62, 40, 55][index % 6];
  }

  function renderHolds(currentIndex, total, prompts, reveal, side) {
      const promptMap = new Map();
      prompts.forEach((token, offset) => promptMap.set(currentIndex + offset, control(token)));
      const firstVisible = Math.max(0, currentIndex - 2);
      const lastVisible = Math.min(total - 1, currentIndex + 3);
      const holds = Array.from({ length: Math.max(0, lastVisible - firstVisible + 1) }, (_, offset) => {
        const index = firstVisible + offset;
        const known = reveal ? promptMap.get(index) : '';
        const classes = [
          'mr-rock-hold',
          side === 'opponent' && index >= currentIndex ? 'opponent-upcoming' : '',
          index === currentIndex ? 'current' : '',
          index === currentIndex - 1 ? 'contact' : '',
          index === total - 1 ? 'final-hold' : '',
          index < currentIndex ? 'passed' : '',
          known ? 'known' : 'unknown',
          known ? `direction-${known}` : ''
        ].filter(Boolean).join(' ');
        return `<span class="${classes}" style="--mr-hold-bottom:${196 + index * 74}px;--mr-hold-left:${holdLeft(index)}%" data-mr-hold-index="${index}" data-mr-outcrop="${index % 4}" aria-hidden="true"><b>${known ? symbol(known) : ''}</b></span>`;
      }).join('');
      return holds + `<span class="mr-finish-ledge mr-summit-plateau" style="--mr-summit-bottom:${196 + Math.max(0, total - 1) * 74}px" aria-hidden="true"><i></i><b>SUMMIT</b></span>`;
    }

  function animationClass(raw, previousAt, isWinner) {
    if (isWinner) return 'celebrate';
    const last = raw?.lastInput;
    if (!last?.at || last.at === previousAt) return 'waiting';
    return last.correct ? `climb-${control(last.control)}` : 'slip';
  }

  function renderClimber(raw, side, animation, total) {
      const index = Math.max(0, Number(raw.promptIndex) || 0);
      const finished = Boolean(raw.finishedAt) || index >= Number(total || 0) || animation === 'celebrate';
      const contactIndex = finished ? Math.max(0, total - 1) : index - 1;
      const previousContactIndex = contactIndex - 1;
      const contactLeft = finished ? 50 : contactIndex >= 0 ? holdLeft(contactIndex) : 50;
      const previousContactLeft = previousContactIndex >= 0 ? holdLeft(previousContactIndex) : 50;
      const nextContactLeft = finished ? 50 : index < Number(total || 0) ? holdLeft(index) : contactLeft;
      const climberLeft = !finished && contactIndex >= 0 ? contactLeft + (nextContactLeft - contactLeft) * 0.3 : contactLeft;
      const summitApproach = !finished && index === Number(total || 0) - 1;
      const travelDirection = nextContactLeft < contactLeft ? 'left' : 'right';
      const gripBottom = finished ? 272 + Math.max(0, Number(total || 0) - 1) * 74 : contactIndex >= 0 ? 228 + contactIndex * 74 : 76;
      const reachBottom = gripBottom + (summitApproach ? 42 : 0);
      const finishClass = finished ? 'finished standing-on-summit' : '';
      const raceLive = runtime.game?.status === 'playing';
      const startClass = !finished && contactIndex < 0 ? 'standing-start' : '';
      const startPoseClass = !finished && contactIndex < 0 ? (raceLive ? 'start-reaching' : 'start-waiting') : '';
      const readyClass = !finished && contactIndex >= 0 ? 'ready-next' : '';
      return `
        <div class="mr-climber ${side} ${animation} ${finishClass} ${startClass} ${startPoseClass} ${readyClass} ${summitApproach ? 'summit-reaching' : ''} direction-${travelDirection}" style="--mr-climber-grip-bottom:${reachBottom}px;--mr-climber-left:${climberLeft}%;--mr-previous-climber-left:${previousContactLeft}%" data-mr-animation-key="${escapeHtml(raw.lastInput?.at || animation)}-${index}" data-mr-contact-index="${contactIndex}" data-mr-finished="${finished ? '1' : '0'}" aria-label="${escapeHtml(raw.name)} climber">
          <span class="mr-motion-frame mr-motion-frame-0 mr-v44-climber-sprite mr-v45-climber-sprite" aria-hidden="true"></span>
        </div>`;
    }

  // MOUNTAIN_RACE_FINISH_STABILITY_V47
  function winnerConfetti() {
    return '<div class="mr-winner-confetti" style="--mr-confetti-bottom:' + (272 + 23 * 74) + 'px" aria-hidden="true">' + Array.from({ length: 28 }, (_, index) => '<i style="--mr-confetti-index:' + index + ';--mr-confetti-x:' + ((index * 37) % 100) + '%;--mr-confetti-drift:' + ((index - 10) * 3) + 'px"></i>').join('') + '</div>';
  }

  function renderLane(rawPlayer, side, total, prompts, reveal, animation) {
      const p = player(rawPlayer, side === 'me' ? 'YOU' : 'OPPONENT', side === 'me' ? 'YOU' : rawPlayer?.isBot ? 'CPU' : 'P2');
      const summitView = animation === 'celebrate' || Boolean(p.finishedAt) || p.promptIndex >= total;
      const cameraIndex = animation === 'celebrate' ? total : Math.max(0, Math.min(total, p.promptIndex));
      const summitReveal = Math.max(0, Math.min(1, (cameraIndex - Math.max(0, total - 5)) / 5));
      const summitBottom = 196 + Math.max(0, total - 1) * 74;
      const scroll = Math.max(0, cameraIndex) * 74;
      const progress = total ? Math.min(1, p.promptIndex / total) : 0;
      return `
        <section class="mr-lane ${side} continuous-mountain ${summitReveal > 0 ? 'summit-approach' : ''} ${summitView ? 'summit-view' : 'cliff-view'}" data-mr-lane-view="${summitView ? 'summit' : summitReveal > 0 ? 'summit-approach' : 'cliff'}" data-mr-summit-reveal="${summitReveal.toFixed(2)}" data-mr-camera-index="${cameraIndex}" aria-label="${escapeHtml(p.name)} climbing lane">
          <header class="mr-player-card">
            <span class="mr-player-badge" aria-hidden="true">${escapeHtml(p.badge)}</span>
            <span class="mr-player-copy"><strong>${escapeHtml(p.name)}</strong><small>${p.rejectedInputs} ${p.rejectedInputs === 1 ? 'MISTAKE' : 'MISTAKES'}</small></span>
            <span class="mr-player-progress">${p.finishedAt ? 'SUMMIT REACHED' : `${p.promptIndex} / ${total}`}</span>
          </header>
          <div class="mr-climb-viewport">
            <div class="mr-mountain-wall" style="--mr-wall-scroll:${scroll}px;--mr-wall-height:${Math.max(2600, 580 + total * 74)}px;--mr-summit-bottom:${summitBottom}px;--mr-summit-reveal:${summitReveal}">
              <span class="mr-v44-cliff" aria-hidden="true"></span>
              <span class="mr-v44-start" aria-hidden="true"><i></i></span>
              ${renderHolds(p.promptIndex, total, prompts, reveal, side)}
              ${renderClimber(p, side, animation, total)}
              ${animation === 'celebrate' ? winnerConfetti() : ''}
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
    if (runtime.syncNotice) return runtime.syncNotice;
    if (runtime.game?.status === 'complete' && !runtime.resultRevealReady) return 'Summit confirmed — finishing the climb!';
    if (runtime.inputQueue.length) {
      if (runtime.inputQueueBlocked) return 'Wrong direction queued — confirming the slip before the next arrow.';
      const count = runtime.inputQueue.length;
      return `${count} ${count === 1 ? 'move' : 'moves'} queued — keep pressing the highlighted arrows!`;
    }
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
    if (runtime.game?.status !== 'complete' || !runtime.resultRevealReady) return '';
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

  function rasterRandomV16(seed) {
    let value = Number(seed) >>> 0;
    return () => {
      value ^= value << 13;
      value ^= value >>> 17;
      value ^= value << 5;
      return (value >>> 0) / 4294967296;
    };
  }

  function createMountainRasterV16() {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 1280;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return '';
    const random = rasterRandomV16(0x16c11ff);

    const base = ctx.createLinearGradient(0, 0, canvas.width, 0);
    base.addColorStop(0, '#4a2d1b');
    base.addColorStop(.16, '#755038');
    base.addColorStop(.47, '#a07552');
    base.addColorStop(.68, '#805a3d');
    base.addColorStop(1, '#392216');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let index = 0; index < 1250; index += 1) {
      const x = random() * canvas.width;
      const y = random() * canvas.height;
      const width = 3 + random() * 34;
      const height = 2 + random() * 26;
      const light = random() > .61;
      const alpha = .018 + random() * .055;
      ctx.fillStyle = light
        ? `rgba(239,196,139,${alpha})`
        : `rgba(32,17,9,${alpha + .01})`;
      ctx.beginPath();
      ctx.ellipse(x, y, width, height, random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }

    const faceShade = ctx.createLinearGradient(0, 0, canvas.width, 0);
    faceShade.addColorStop(0, 'rgba(28,15,8,.38)');
    faceShade.addColorStop(.23, 'rgba(255,224,174,.05)');
    faceShade.addColorStop(.55, 'rgba(255,226,177,.09)');
    faceShade.addColorStop(1, 'rgba(25,13,7,.45)');
    ctx.fillStyle = faceShade;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let crack = 0; crack < 58; crack += 1) {
      let x = 12 + random() * (canvas.width - 24);
      let y = 12 + random() * (canvas.height - 24);
      let angle = -.8 + random() * 1.6;
      const points = [[x, y]];
      const steps = 3 + Math.floor(random() * 8);
      for (let step = 0; step < steps; step += 1) {
        angle += -.42 + random() * .84;
        const distance = 7 + random() * 16;
        x += Math.cos(angle) * distance;
        y += Math.abs(Math.sin(angle)) * distance * .72 + (-2 + random() * 5);
        points.push([x, y]);
      }
      ctx.strokeStyle = `rgba(24,12,6,${.48 + random() * .32})`;
      ctx.lineWidth = random() > .76 ? 2.2 : 1.15;
      ctx.beginPath();
      points.forEach(([px, py], pointIndex) => pointIndex ? ctx.lineTo(px, py) : ctx.moveTo(px, py));
      ctx.stroke();
      ctx.strokeStyle = 'rgba(230,183,124,.13)';
      ctx.lineWidth = .8;
      ctx.translate(1, -1);
      ctx.beginPath();
      points.forEach(([px, py], pointIndex) => pointIndex ? ctx.lineTo(px, py) : ctx.moveTo(px, py));
      ctx.stroke();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    for (let ledge = 0; ledge < 17; ledge += 1) {
      let x = -18 + random() * 220;
      const y = 30 + random() * 1210;
      const length = 60 + random() * 150;
      ctx.strokeStyle = `rgba(26,13,7,${.48 + random() * .22})`;
      ctx.lineWidth = 2 + random() * 2.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      while (x < length) {
        x += 11 + random() * 22;
        ctx.lineTo(x, y - 6 + random() * 12);
      }
      ctx.stroke();
    }

    return canvas.toDataURL('image/png');
  }

  function createHoldSpriteV16() {
    const tileWidth = 96;
    const tileHeight = 72;
    const canvas = document.createElement('canvas');
    canvas.width = tileWidth * 6;
    canvas.height = tileHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    const random = rasterRandomV16(0x51a6d00d);

    for (let tile = 0; tile < 6; tile += 1) {
      const offset = tile * tileWidth;
      const centerX = offset + tileWidth / 2;
      const centerY = 36;
      const points = [];
      const pointCount = 8 + Math.floor(random() * 4);
      for (let point = 0; point < pointCount; point += 1) {
        const angle = Math.PI * 2 * point / pointCount + (-.12 + random() * .24);
        const radiusX = 28 + random() * 12;
        const radiusY = 18 + random() * 9;
        points.push([
          centerX + Math.cos(angle) * radiusX,
          centerY + Math.sin(angle) * radiusY
        ]);
      }

      const path = new Path2D();
      points.forEach(([x, y], pointIndex) => pointIndex ? path.lineTo(x, y) : path.moveTo(x, y));
      path.closePath();

      ctx.save();
      ctx.translate(3, 6);
      ctx.shadowColor = 'rgba(20,10,5,.72)';
      ctx.shadowBlur = 5;
      ctx.fillStyle = 'rgba(24,12,6,.74)';
      ctx.fill(path);
      ctx.restore();

      const rockGradient = ctx.createLinearGradient(offset + 20, 12, offset + 76, 62);
      rockGradient.addColorStop(0, tile % 2 ? '#d0a16e' : '#bd8b5b');
      rockGradient.addColorStop(.45, tile % 3 ? '#875938' : '#976743');
      rockGradient.addColorStop(1, '#3d2415');
      ctx.fillStyle = rockGradient;
      ctx.fill(path);

      ctx.save();
      ctx.clip(path);
      for (let grain = 0; grain < 58; grain += 1) {
        const x = offset + 12 + random() * 72;
        const y = 11 + random() * 50;
        const size = .7 + random() * 2.2;
        ctx.fillStyle = random() > .58
          ? `rgba(238,197,143,${.05 + random() * .13})`
          : `rgba(39,21,11,${.05 + random() * .16})`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(35,18,9,.56)';
      ctx.lineWidth = 1.2;
      for (let line = 0; line < 3; line += 1) {
        const x = offset + 29 + random() * 34;
        const y = 21 + random() * 22;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 7 + random() * 14, y + 7 + random() * 10);
        ctx.stroke();
      }
      ctx.restore();

      ctx.strokeStyle = 'rgba(246,216,171,.52)';
      ctx.lineWidth = 1.15;
      ctx.stroke(path);
    }

    return canvas.toDataURL('image/png');
  }

  function ensureMountainRaceRasterAssetsV16(root) {
    let assets = window.__mountainRaceRasterAssetsV16;
    if (!assets) {
      try {
        assets = {
          mountain: createMountainRasterV16(),
          holds: createHoldSpriteV16()
        };
      } catch (error) {
        console.warn('Summit Sprint raster texture fallback:', error);
        assets = { mountain: '', holds: '' };
      }
      window.__mountainRaceRasterAssetsV16 = assets;
    }
    if (assets.mountain) root.style.setProperty('--mr-mountain-raster-v16', `url("${assets.mountain}")`);
    if (assets.holds) root.style.setProperty('--mr-hold-sprite-v16', `url("${assets.holds}")`);
    root.dataset.mrRasterTexture = '16';
  }

  function environmentRandomV17(seed) {
    let value = Number(seed) >>> 0;
    return () => {
      value = Math.imul(value ^ (value >>> 15), 1 | value);
      value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  function createMountainDetailRasterV17() {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 1280;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    const random = environmentRandomV17(0x17a11f3);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let band = 0; band < 92; band += 1) {
      const y = random() * canvas.height;
      const startX = -30 + random() * 180;
      const length = 90 + random() * 240;
      const slope = -8 + random() * 16;
      ctx.strokeStyle = random() > .56
        ? `rgba(255,224,177,${.028 + random() * .055})`
        : `rgba(35,18,9,${.035 + random() * .08})`;
      ctx.lineWidth = .6 + random() * 1.7;
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.bezierCurveTo(
        startX + length * .3,
        y + slope + (-5 + random() * 10),
        startX + length * .68,
        y + slope + (-6 + random() * 12),
        startX + length,
        y + slope
      );
      ctx.stroke();
    }

    for (let chip = 0; chip < 380; chip += 1) {
      const x = random() * canvas.width;
      const y = random() * canvas.height;
      const width = 1 + random() * 8;
      const height = .8 + random() * 5;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-.8 + random() * 1.6);
      ctx.fillStyle = random() > .5
        ? `rgba(247,207,151,${.025 + random() * .09})`
        : `rgba(26,13,7,${.03 + random() * .11})`;
      ctx.fillRect(-width / 2, -height / 2, width, height);
      ctx.restore();
    }

    for (let pocket = 0; pocket < 34; pocket += 1) {
      const x = 16 + random() * (canvas.width - 32);
      const y = 20 + random() * (canvas.height - 40);
      const radius = 7 + random() * 24;
      const shadow = ctx.createRadialGradient(x - radius * .35, y - radius * .3, 0, x, y, radius);
      shadow.addColorStop(0, 'rgba(238,188,127,.08)');
      shadow.addColorStop(.45, 'rgba(86,47,25,.06)');
      shadow.addColorStop(1, 'rgba(26,13,7,0)');
      ctx.fillStyle = shadow;
      ctx.beginPath();
      ctx.ellipse(x, y, radius, radius * (.45 + random() * .35), random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let lichen = 0; lichen < 210; lichen += 1) {
      const x = random() * canvas.width;
      const y = random() * canvas.height;
      const size = .6 + random() * 2.4;
      ctx.fillStyle = random() > .52
        ? `rgba(126,139,73,${.025 + random() * .065})`
        : `rgba(176,155,91,${.02 + random() * .05})`;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    const light = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    light.addColorStop(0, 'rgba(255,232,191,.18)');
    light.addColorStop(.34, 'rgba(255,219,166,.035)');
    light.addColorStop(.72, 'rgba(56,29,14,.03)');
    light.addColorStop(1, 'rgba(28,14,7,.22)');
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    return canvas.toDataURL('image/png');
  }

  function createGrassTextureV17() {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    const random = environmentRandomV17(0x17c6a55);

    const soil = ctx.createLinearGradient(0, 28, 0, canvas.height);
    soil.addColorStop(0, 'rgba(99,72,39,.12)');
    soil.addColorStop(1, 'rgba(45,28,15,.42)');
    ctx.fillStyle = soil;
    ctx.fillRect(0, 30, canvas.width, canvas.height - 30);

    for (let stone = 0; stone < 180; stone += 1) {
      const x = random() * canvas.width;
      const y = 42 + random() * 48;
      const size = .6 + random() * 2.8;
      ctx.fillStyle = random() > .5
        ? `rgba(193,156,101,${.1 + random() * .16})`
        : `rgba(45,27,14,${.1 + random() * .18})`;
      ctx.beginPath();
      ctx.ellipse(x, y, size * 1.4, size, random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.lineCap = 'round';
    for (let blade = 0; blade < 760; blade += 1) {
      const x = random() * canvas.width;
      const baseY = 44 + random() * 14;
      const height = 8 + random() * 30;
      const lean = -7 + random() * 14;
      const palette = random();
      ctx.strokeStyle = palette > .72
        ? `rgba(155,194,85,${.42 + random() * .35})`
        : palette > .36
          ? `rgba(81,138,52,${.42 + random() * .38})`
          : `rgba(47,101,40,${.38 + random() * .34})`;
      ctx.lineWidth = .65 + random() * 1.25;
      ctx.beginPath();
      ctx.moveTo(x, baseY);
      ctx.quadraticCurveTo(x + lean * .45, baseY - height * .55, x + lean, baseY - height);
      ctx.stroke();
    }

    return canvas.toDataURL('image/png');
  }

  function ensureMountainRaceEnvironmentV17(root) {
    let assets = window.__mountainRaceEnvironmentV17;
    if (!assets) {
      try {
        assets = {
          mountainDetail: createMountainDetailRasterV17(),
          grass: createGrassTextureV17()
        };
      } catch (error) {
        console.warn('Summit Sprint environment texture fallback:', error);
        assets = { mountainDetail: '', grass: '' };
      }
      window.__mountainRaceEnvironmentV17 = assets;
    }

    if (assets.mountainDetail) root.style.setProperty('--mr-mountain-detail-v17', `url("${assets.mountainDetail}")`);
    if (assets.grass) root.style.setProperty('--mr-grass-texture-v17', `url("${assets.grass}")`);

    const world = root.querySelector(':scope > .mr-world-layer');
    if (world && !world.querySelector(':scope > .mr-environment-v17')) {
      world.insertAdjacentHTML('beforeend', `
        <div class="mr-environment-v17" aria-hidden="true">
          <span class="mr-sun-v17"></span>
          <span class="mr-cloud-bank-v17 far"></span>
          <span class="mr-cloud-bank-v17 near"></span>
          <span class="mr-wind-v17"><i></i><i></i><i></i><i></i><i></i><i></i></span>
        </div>`);
    }
    root.dataset.mrEnvironment = '17';
  }

  function directionGlyphV18(value) {
    const token = control(value);
    const paths = {
      up: 'M16 3 29 16h-8v13H11V16H3Z',
      right: 'M29 16 16 29v-8H3V11h13V3Z',
      down: 'M16 29 3 16h8V3h10v13h8Z',
      left: 'M3 16 16 3v8h13v10H16v8Z'
    };
    return `<svg class="mr-direction-glyph-v18 direction-${token}" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path class="mr-glyph-shadow-v18" d="${paths[token]}"></path><path class="mr-glyph-face-v18" d="${paths[token]}"></path><path class="mr-glyph-shine-v18" d="M8 10.5 16 5l8 5.5" pathLength="1"></path></svg>`;
  }

  function ensureConceptTargetV18(root) {
    root.dataset.mrConceptTarget = '18';
    const world = root.querySelector(':scope > .mr-world-layer');
    if (world && !world.querySelector(':scope > .mr-concept-depth-v18')) {
      world.insertAdjacentHTML('beforeend', `
        <div class="mr-concept-depth-v18" aria-hidden="true">
          <span class="mr-range-v18 far"></span>
          <span class="mr-range-v18 near"></span>
          <span class="mr-valley-haze-v18"></span>
        </div>`);
    }
  }

  function detailRandomV19(seed) {
    let value = Number(seed) >>> 0;
    return () => {
      value ^= value << 13;
      value ^= value >>> 17;
      value ^= value << 5;
      return (value >>> 0) / 4294967296;
    };
  }

  function createCliffTextureV19() {
    const canvas = document.createElement('canvas');
    canvas.width = 384;
    canvas.height = 1536;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return '';
    const random = detailRandomV19(0x19c11ff);

    const base = ctx.createLinearGradient(0, 0, canvas.width, 0);
    base.addColorStop(0, '#4d311c');
    base.addColorStop(.12, '#6d472b');
    base.addColorStop(.34, '#8d6241');
    base.addColorStop(.56, '#a2754e');
    base.addColorStop(.78, '#7e5537');
    base.addColorStop(1, '#3e2516');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let wash = 0; wash < 8; wash += 1) {
      const y = (canvas.height / 8) * wash;
      const fade = ctx.createLinearGradient(0, y, 0, y + canvas.height / 7);
      fade.addColorStop(0, `rgba(255,227,178,${0.05 + random() * 0.03})`);
      fade.addColorStop(.45, 'rgba(255,227,178,0)');
      fade.addColorStop(1, `rgba(28,15,9,${0.08 + random() * 0.05})`);
      ctx.fillStyle = fade;
      ctx.fillRect(0, y, canvas.width, canvas.height / 7);
    }

    for (let grain = 0; grain < 2400; grain += 1) {
      const x = random() * canvas.width;
      const y = random() * canvas.height;
      const width = 1.8 + random() * 28;
      const height = 1.8 + random() * 22;
      const alpha = 0.012 + random() * 0.06;
      ctx.fillStyle = random() > .52
        ? `rgba(234,192,142,${alpha})`
        : `rgba(32,18,10,${alpha + 0.012})`;
      ctx.beginPath();
      ctx.ellipse(x, y, width, height, random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let seam = 0; seam < 110; seam += 1) {
      let x = -30 + random() * (canvas.width + 60);
      let y = 16 + random() * (canvas.height - 32);
      let angle = -0.6 + random() * 1.2;
      const points = [[x, y]];
      const steps = 4 + Math.floor(random() * 8);
      for (let step = 0; step < steps; step += 1) {
        angle += -0.28 + random() * 0.56;
        const distance = 12 + random() * 26;
        x += Math.cos(angle) * distance;
        y += Math.sin(angle) * distance * 0.4 + (-3 + random() * 6);
        points.push([x, y]);
      }
      ctx.strokeStyle = `rgba(26,14,8,${0.24 + random() * 0.28})`;
      ctx.lineWidth = 1 + random() * 2.4;
      ctx.beginPath();
      points.forEach(([px, py], idx) => idx ? ctx.lineTo(px, py) : ctx.moveTo(px, py));
      ctx.stroke();
      ctx.strokeStyle = 'rgba(244,209,164,.12)';
      ctx.lineWidth = .8;
      ctx.beginPath();
      points.forEach(([px, py], idx) => idx ? ctx.lineTo(px + 1, py - 1) : ctx.moveTo(px + 1, py - 1));
      ctx.stroke();
    }

    ctx.lineCap = 'round';
    for (let ledge = 0; ledge < 42; ledge += 1) {
      const y = 34 + random() * (canvas.height - 68);
      const startX = -40 + random() * 220;
      const length = 120 + random() * 230;
      ctx.strokeStyle = `rgba(36,19,11,${0.34 + random() * 0.22})`;
      ctx.lineWidth = 2 + random() * 3;
      ctx.beginPath();
      ctx.moveTo(startX, y);
      let cursor = startX;
      while (cursor < startX + length) {
        cursor += 18 + random() * 38;
        ctx.lineTo(cursor, y - 8 + random() * 16);
      }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(248,214,164,.10)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(startX, y - 2);
      cursor = startX;
      while (cursor < startX + length) {
        cursor += 18 + random() * 38;
        ctx.lineTo(cursor, y - 10 + random() * 16);
      }
      ctx.stroke();
    }

    for (let pocket = 0; pocket < 58; pocket += 1) {
      const x = 18 + random() * (canvas.width - 36);
      const y = 18 + random() * (canvas.height - 36);
      const radiusX = 8 + random() * 22;
      const radiusY = 5 + random() * 13;
      const rot = random() * Math.PI;
      const pocketShade = ctx.createRadialGradient(x - radiusX * .3, y - radiusY * .28, 0, x, y, radiusX * 1.3);
      pocketShade.addColorStop(0, 'rgba(255,232,193,.08)');
      pocketShade.addColorStop(.45, 'rgba(106,63,37,.06)');
      pocketShade.addColorStop(1, 'rgba(21,11,7,0)');
      ctx.fillStyle = pocketShade;
      ctx.beginPath();
      ctx.ellipse(x, y, radiusX, radiusY, rot, 0, Math.PI * 2);
      ctx.fill();
    }

    const sun = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    sun.addColorStop(0, 'rgba(255,236,195,.22)');
    sun.addColorStop(.18, 'rgba(255,226,175,.08)');
    sun.addColorStop(.52, 'rgba(117,71,42,.03)');
    sun.addColorStop(1, 'rgba(25,14,8,.24)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    return canvas.toDataURL('image/png');
  }

  function createGrassTextureV19() {
    const canvas = document.createElement('canvas');
    canvas.width = 768;
    canvas.height = 180;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    const random = detailRandomV19(0x19a5511);

    const soil = ctx.createLinearGradient(0, 42, 0, canvas.height);
    soil.addColorStop(0, 'rgba(132,95,58,.24)');
    soil.addColorStop(.34, 'rgba(98,67,36,.34)');
    soil.addColorStop(1, 'rgba(42,26,14,.56)');
    ctx.fillStyle = soil;
    ctx.fillRect(0, 34, canvas.width, canvas.height - 34);

    for (let pebble = 0; pebble < 260; pebble += 1) {
      const x = random() * canvas.width;
      const y = 60 + random() * 100;
      const size = .8 + random() * 3.2;
      ctx.fillStyle = random() > .5
        ? `rgba(210,169,114,${0.09 + random() * 0.17})`
        : `rgba(52,31,18,${0.08 + random() * 0.18})`;
      ctx.beginPath();
      ctx.ellipse(x, y, size * 1.5, size, random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.lineCap = 'round';
    for (let blade = 0; blade < 1280; blade += 1) {
      const x = random() * canvas.width;
      const baseY = 58 + random() * 12;
      const height = 12 + random() * 44;
      const lean = -10 + random() * 20;
      const palette = random();
      ctx.strokeStyle = palette > .74
        ? `rgba(169,215,95,${0.42 + random() * 0.28})`
        : palette > .34
          ? `rgba(88,149,58,${0.42 + random() * 0.34})`
          : `rgba(43,104,39,${0.40 + random() * 0.32})`;
      ctx.lineWidth = 0.7 + random() * 1.45;
      ctx.beginPath();
      ctx.moveTo(x, baseY);
      ctx.quadraticCurveTo(x + lean * .45, baseY - height * .58, x + lean, baseY - height);
      ctx.stroke();
    }

    const topLight = ctx.createLinearGradient(0, 0, 0, 82);
    topLight.addColorStop(0, 'rgba(255,247,208,.24)');
    topLight.addColorStop(1, 'rgba(255,247,208,0)');
    ctx.fillStyle = topLight;
    ctx.fillRect(0, 0, canvas.width, 82);

    return canvas.toDataURL('image/png');
  }

  function createLedgeSpriteV19() {
    const tileWidth = 112;
    const tileHeight = 72;
    const canvas = document.createElement('canvas');
    canvas.width = tileWidth * 6;
    canvas.height = tileHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    const random = detailRandomV19(0x19ddd221);

    for (let tile = 0; tile < 6; tile += 1) {
      const offset = tile * tileWidth;
      const centerX = offset + tileWidth / 2;
      const centerY = 36;
      const points = [];
      const pointCount = 9 + Math.floor(random() * 3);
      for (let point = 0; point < pointCount; point += 1) {
        const angle = Math.PI * 2 * point / pointCount + (-.13 + random() * .26);
        const radiusX = 28 + random() * 18;
        const radiusY = 16 + random() * 10;
        points.push([
          centerX + Math.cos(angle) * radiusX,
          centerY + Math.sin(angle) * radiusY
        ]);
      }

      const path = new Path2D();
      points.forEach(([x, y], index) => index ? path.lineTo(x, y) : path.moveTo(x, y));
      path.closePath();

      ctx.save();
      ctx.translate(4, 7);
      ctx.shadowColor = 'rgba(22,11,6,.62)';
      ctx.shadowBlur = 6;
      ctx.fillStyle = 'rgba(24,12,6,.58)';
      ctx.fill(path);
      ctx.restore();

      const face = ctx.createLinearGradient(offset + 18, 8, offset + 86, 56);
      face.addColorStop(0, tile % 2 ? '#d7a677' : '#c99362');
      face.addColorStop(.42, tile % 3 ? '#9b6842' : '#a9744a');
      face.addColorStop(1, '#4a2d1a');
      ctx.fillStyle = face;
      ctx.fill(path);

      ctx.save();
      ctx.clip(path);
      for (let fleck = 0; fleck < 66; fleck += 1) {
        const x = offset + 12 + random() * 86;
        const y = 8 + random() * 54;
        const size = .7 + random() * 2.4;
        ctx.fillStyle = random() > .56
          ? `rgba(248,217,171,${0.05 + random() * 0.16})`
          : `rgba(44,24,12,${0.05 + random() * 0.16})`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.strokeStyle = 'rgba(52,29,15,.48)';
      ctx.lineWidth = 1.25;
      for (let crack = 0; crack < 4; crack += 1) {
        const x = offset + 26 + random() * 48;
        const y = 18 + random() * 18;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 8 + random() * 16, y + 8 + random() * 10);
        ctx.stroke();
      }
      ctx.restore();

      ctx.strokeStyle = 'rgba(254,225,180,.52)';
      ctx.lineWidth = 1.15;
      ctx.stroke(path);
    }

    return canvas.toDataURL('image/png');
  }

  function ensureConceptDetailV19(root) {
    let assets = window.__mountainRaceConceptDetailV19;
    if (!assets) {
      try {
        assets = {
          cliff: createCliffTextureV19(),
          grass: createGrassTextureV19(),
          ledges: createLedgeSpriteV19()
        };
      } catch (error) {
        console.warn('Summit Sprint concept detail texture fallback:', error);
        assets = { cliff: '', grass: '', ledges: '' };
      }
      window.__mountainRaceConceptDetailV19 = assets;
    }

    if (assets.cliff) root.style.setProperty('--mr-cliff-detail-v19', `url("${assets.cliff}")`);
    if (assets.grass) root.style.setProperty('--mr-grass-detail-v19', `url("${assets.grass}")`);
    if (assets.ledges) root.style.setProperty('--mr-ledge-sprite-v19', `url("${assets.ledges}")`);
    root.dataset.mrConceptDetail = '19';
  }

  const MOUNTAIN_RACE_WORLD_V14 = "<div class=\"mr-world-layer\" aria-hidden=\"true\">\n          <span class=\"mr-world-moon\"></span>\n          <span class=\"mr-world-stars\"></span>\n          <span class=\"mr-world-range mr-world-range-far\"></span>\n          <span class=\"mr-world-range mr-world-range-mid\"></span>\n          <span class=\"mr-world-cloud mr-world-cloud-a\"></span>\n          <span class=\"mr-world-cloud mr-world-cloud-b\"></span>\n          <span class=\"mr-world-snow mr-world-snow-far\"></span>\n          <span class=\"mr-world-snow mr-world-snow-near\"></span>\n          <span class=\"mr-world-vignette\"></span>\n        </div>";

  function ensureMountainRaceWorld(root) {
    let world = root.querySelector(':scope > .mr-world-layer');
    if (!world) {
      root.insertAdjacentHTML('afterbegin', MOUNTAIN_RACE_WORLD_V14);
      world = root.querySelector(':scope > .mr-world-layer');
    }
    root.dataset.mrVisualStable = '14';
    return world;
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
    const publicState = state();
    const root = document.querySelector('[data-mountain-race-mount]');
    if (!root || runtime.game?.mode !== MODE) return;
    runtime.root = root;
    // MOUNTAIN_RACE_VISUAL_RESTART_V25
    root.dataset.mrVisualRestart = '25';
    delete root.dataset.mrCorrectedReferenceReady;
    delete root.dataset.mrCorrectedReference;
    root.style.removeProperty('--mr-v24-left-cliff');
    root.style.removeProperty('--mr-v24-right-cliff');
    root.style.removeProperty('--mr-v24-grass');
    root.style.removeProperty('--mr-v24-holds');
    // MOUNTAIN_RACE_ROCKY_REBUILD_V26
    // V26 is the active Summit Sprint terrain. Keep older markers/functions in the
    // generated bundle only for regression compatibility; their presentation
    // selectors are disabled by removing the V25 dataset.
    delete root.dataset.mrVisualRestart;
    root.dataset.mrRockyRebuild = '26';
    // MOUNTAIN_RACE_PROFESSIONAL_REBUILD_V27
    // V27 owns the complete Summit Sprint environment presentation. Older visual
    // datasets may still be populated by historical compatibility helpers, but
    // only this V27 dataset is used by the final presentation selectors.
    root.dataset.mrProfessionalRebuild = '27';
    // MOUNTAIN_RACE_GENERATED_ASSETS_V29
    // V29 replaces every legacy terrain layer with committed high-resolution PNGs.
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
    const total = Math.max(8, Math.min(80, Math.trunc(Number(publicState.stepsTotal) || 24)));
    const rawRunway = Array.isArray(publicState.inputPrompts) && publicState.inputPrompts.length ? publicState.inputPrompts : publicState.prompts;
    const authoritativePrompts = Array.isArray(rawRunway) ? rawRunway.map(control) : [];
    const presentation = optimisticPresentation(publicState, authoritativePrompts, total);
    const prompts = presentation.prompts.slice(0, 4);
    const authoritativeMe = presentation.authoritativeMe;
    const me = presentation.me;
    const opponent = player(publicState.opponent, 'OPPONENT', publicState.opponent?.isBot ? 'CPU' : 'P2');
    const meAnimation = presentation.animation || animationClass(authoritativeMe, runtime.lastMyInputAt, publicState.viewerWon && runtime.game.status === 'complete');
    const opponentAnimation = animationClass(opponent, runtime.lastOpponentInputAt, !publicState.viewerWon && !publicState.tie && runtime.game.status === 'complete');
    if (authoritativeMe.lastInput?.at) runtime.lastMyInputAt = authoritativeMe.lastInput.at;
    if (opponent.lastInput?.at) runtime.lastOpponentInputAt = opponent.lastInput.at;
    const controlsEnabled = runtime.game.status === 'playing' && publicState.canSubmit && prompts.length > 0 && !presentation.blocked && !runtime.inputQueueBlocked;
    const tone = presentation.tone || (authoritativeMe.lastInput ? (authoritativeMe.lastInput.correct ? 'correct' : 'wrong') : 'neutral');

    ensureMountainRaceWorld(root);
    void 0; // V44 retired generated raster canvases
    void 0; // V44 retired decorative environment layers
    void 0; // V44 retired legacy concept layers
    void 0; // V44 retired runtime canvas textures
    root.dataset.mrScreenshotBase = '20';
    void 0; // V25 retired ensureReferenceAtlasV21(root);
    void 0; // V25 retired ensureReferenceRebuildV22(root);
    void 0; // V25 retired ensureFullCliffV23(root);
    void 0; // V25 retired ensureCorrectedReferenceV24(root);
    const previousGameElement = root.querySelector(':scope > .mountain-race-game');
    const nextGameMarkup = `
      <div class="mountain-race-game" data-mode="${MODE}" data-status="${escapeHtml(runtime.game.status)}" data-authoritative="1">
        <header class="mr-titlebar">
          <div class="mr-expedition-heading">
            <p>ALPINE EXPEDITION · ROUTE 24</p>
            <div class="mr-title-lockup"><span class="mr-expedition-mark" aria-hidden="true"><i></i></span><h2>SUMMIT SPRINT</h2></div>
            <small class="mr-expedition-meta">NORTH FACE · 24 HOLDS · LIVE ASCENT</small>
          </div>
          <div class="mr-race-clock ${secondsLeft() <= 7 && runtime.game.status === 'playing' ? 'urgent' : ''}"><small>TIME</small><strong data-mr-clock>${String(secondsLeft()).padStart(2, '0')}</strong></div>
        </header>
        <main class="mr-race-stage">
          <div class="mr-stage-ridge" aria-hidden="true"><span class="mr-ridge-beacon"></span><span class="mr-ridge-label">SUMMIT</span><i></i></div>
          ${renderLane(me, 'me', total, prompts, true, meAnimation)}
          ${renderLane(opponent, 'opponent', total, [], false, opponentAnimation)}
          <span class="mr-v51-center-rope" aria-hidden="true"><i></i></span>
        </main>
        <div class="mr-control-terrain" aria-hidden="true">
          <span class="me" style="--mr-control-world-shift:${Math.max(0, me.promptIndex - 1) * 42}px"></span>
          <span class="opponent" style="--mr-control-world-shift:${Math.max(0, opponent.promptIndex - 1) * 42}px"></span>
        </div>
        <section class="mr-command-deck" aria-label="Climbing controls">
          <div class="mr-next-moves">
            <span class="mr-prompt-label">YOUR NEXT MOVES</span>
            <div class="mr-prompt-sequence">${promptQueue(prompts)}</div>
            <p class="mr-status ${tone}" data-mr-status>${escapeHtml(statusText(publicState))}</p>
          </div>
          <div class="mr-direction-pad" aria-label="Direction pad">
            ${CONTROLS.map(token => `<button type="button" class="mr-control mr-control-${token}" data-mr-network-input="${token}" data-mr-displayed-expected="${escapeHtml(presentation.prompts[0] || '')}" data-mr-displayed-index="${Math.max(0, Math.trunc(Number(presentation.me?.promptIndex) || 0))}" data-mr-displayed-round="${escapeHtml(publicState.roundId || '')}" ${controlsEnabled ? '' : 'disabled'}><b>${symbol(token)}</b><small>${token.toUpperCase()}</small></button>`).join('')}
          </div>
        </section>
        ${countdownOverlay()}
        ${resultOverlay(publicState, me, total)}
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
      root.append(nextGameElement);
    }
  }

  function scheduleBotWake() {
    if (runtime.botWakeTimer || runtime.botWakeInFlight || runtime.game?.status !== 'playing') return;
    runtime.botWakeTimer = window.setTimeout(async () => {
      runtime.botWakeTimer = 0;
      const bridge = window.__mountainRaceBridge;
      if (!bridge?.refresh || runtime.game?.status !== 'playing') return;
      runtime.botWakeInFlight = true;
      try {
        await bridge.refresh();
      } catch {
        // Normal focused polling will retry without delaying the confirmed player move.
      } finally {
        runtime.botWakeInFlight = false;
      }
    }, 0);
  }

  function syncPendingCompatibility() {
    const first = runtime.inputQueue[0] || null;
    runtime.pendingInput = first ? {
      token: first.token,
      expected: first.expected,
      correct: first.correct,
      fromIndex: first.fromIndex,
      at: first.at
    } : null;
    runtime.pendingActionId = first?.actionId || '';
    runtime.busy = false;
  }

  function clearInputQueue() {
    if (runtime.inputFlushTimer) window.clearTimeout(runtime.inputFlushTimer);
    runtime.inputFlushTimer = 0;
    runtime.inputQueue = [];
    runtime.inputBatchInFlight = [];
    runtime.inputQueueBlocked = false;
    syncPendingCompatibility();
  }

  function scheduleInputFlush(immediate = false) {
    if (runtime.inputFlushTimer) window.clearTimeout(runtime.inputFlushTimer);
    runtime.inputFlushTimer = window.setTimeout(() => {
      runtime.inputFlushTimer = 0;
      flushInputQueue();
    }, immediate ? 0 : 90);
  }

  function rebaseInputQueueAgainstGame(game) {
    const publicState = game?.mountainraceState || {};
    const roundId = String(publicState.roundId || '');
    const startIndex = Math.max(0, Math.trunc(Number(publicState.me?.promptIndex) || 0));
    const rawRunway = Array.isArray(publicState.inputPrompts) && publicState.inputPrompts.length
      ? publicState.inputPrompts
      : publicState.prompts;
    const runway = Array.isArray(rawRunway) ? rawRunway.map(control) : [];
    const ordered = runtime.inputQueue.slice().sort((a, b) => a.order - b.order);
    const kept = [];
    let expectedIndex = startIndex;
    let blocked = false;
    let dropped = 0;

    for (const item of ordered) {
      const expected = runway[expectedIndex - startIndex] || '';
      const valid = !blocked
        && item.roundId === roundId
        && item.fromIndex === expectedIndex
        && Boolean(expected)
        && item.expected === expected;
      if (!valid) {
        dropped += 1;
        continue;
      }

      kept.push(item);
      if (item.token === expected) expectedIndex += 1;
      else blocked = true;
    }

    runtime.inputQueue = kept;
    if (dropped) {
      window.__mountainRaceQueueRebases = Number(window.__mountainRaceQueueRebases || 0) + dropped;
    }
    return dropped;
  }

  async function flushInputQueue() {
    if (runtime.inputBatchInFlight.length || runtime.game?.status !== 'playing') return;
    const batch = runtime.inputQueue.filter(item => item.status === 'queued').slice(0, 8);
    if (!batch.length) return;
    const bridge = window.__mountainRaceBridge;
    if (!bridge?.submit) return;

    batch.forEach(item => { item.status = 'sending'; });
    runtime.inputBatchInFlight = batch.map(item => item.actionId);
    syncPendingCompatibility();

    try {
      const data = await bridge.submit({
        choice: 'mountainrace:batch',
        inputBatch: batch.map(item => ({
          control: item.token,
          expectedControl: item.expected,
          expectedPromptIndex: item.fromIndex,
          actionId: item.actionId
        }))
      });

      const confirmed = new Set(Array.isArray(data?.confirmedActionIds) ? data.confirmedActionIds.map(String) : []);
      const ignored = new Set(Array.isArray(data?.ignoredActionIds) ? data.ignoredActionIds.map(String) : []);
      const authoritativeIndex = Math.max(0, Math.trunc(Number(data?.game?.mountainraceState?.me?.promptIndex) || 0));
      for (const item of batch) {
        if (!confirmed.has(item.actionId) && item.correct && item.fromIndex < authoritativeIndex) confirmed.add(item.actionId);
      }

      runtime.inputQueue = runtime.inputQueue.filter(item => !confirmed.has(item.actionId) && !ignored.has(item.actionId));
      for (const item of runtime.inputQueue) {
        if (runtime.inputBatchInFlight.includes(item.actionId)) item.status = 'queued';
      }
      runtime.inputBatchInFlight = [];
      const rebased = data?.game ? rebaseInputQueueAgainstGame(data.game) : 0;
      runtime.inputQueueBlocked = runtime.inputQueue.some(item => !item.correct);
      runtime.syncNotice = ignored.size || rebased
        ? 'Course re-aligned — no extra mistake was counted. Keep climbing from the highlighted arrow.'
        : '';
      syncPendingCompatibility();

      if (data?.game) adopt(data.game, { source: 'input-rebase-response' });
      else window.__mountainRaceBridge?.refresh?.();
      if (runtime.inputQueue.some(item => item.status === 'queued')) scheduleInputFlush(true);
      else render();
    } catch (error) {
      for (const item of runtime.inputQueue) {
        if (runtime.inputBatchInFlight.includes(item.actionId)) item.status = 'queued';
      }
      runtime.inputBatchInFlight = [];
      runtime.syncNotice = String(error?.message || 'Unable to confirm those queued moves. Retrying safely…');
      syncPendingCompatibility();
      render();
      scheduleInputFlush(false);
    }
  }

  async function submit(rawToken, displayed = null) {
    const publicState = state();
    const bridge = window.__mountainRaceBridge;
    if (!bridge?.submit || runtime.game?.status !== 'playing' || !publicState.canSubmit || runtime.inputQueueBlocked) return;
    // MOUNTAIN_RACE_CONFIRMED_LIGHTWEIGHT_V43
    // Correct moves remain bufferable while earlier actions are in flight.

    const total = Math.max(8, Math.min(80, Math.trunc(Number(publicState.stepsTotal) || 24)));
    const rawRunway = Array.isArray(publicState.inputPrompts) && publicState.inputPrompts.length
      ? publicState.inputPrompts
      : publicState.prompts;
    const authoritativePrompts = Array.isArray(rawRunway) ? rawRunway.map(control) : [];
    const presentation = optimisticPresentation(publicState, authoritativePrompts, total);
    if (!presentation.prompts.length || presentation.blocked) return;

    const currentExpected = presentation.prompts[0];
    const currentIndex = Math.max(0, Math.trunc(Number(presentation.me?.promptIndex) || 0));
    const currentRound = String(publicState.roundId || '');
    const displayedExpectedRaw = String(displayed?.expected || '').toLowerCase();
    const displayedExpected = CONTROLS.includes(displayedExpectedRaw) ? displayedExpectedRaw : '';
    const displayedIndex = Number(displayed?.promptIndex);
    const displayedRound = String(displayed?.roundId || '');
    const hasDisplayedSnapshot = Boolean(displayed && displayedExpected && Number.isFinite(displayedIndex) && displayedIndex >= 0 && displayedRound);

    if (displayed && (!hasDisplayedSnapshot
      || displayedRound !== currentRound
      || Math.trunc(displayedIndex) !== currentIndex
      || displayedExpected !== currentExpected)) {
      window.__mountainRaceVisualRebases = Number(window.__mountainRaceVisualRebases || 0) + 1;
      runtime.syncNotice = 'The arrow refreshed during that tap. No mistake counted — use the highlighted arrow.';
      render();
      bridge.refresh?.();
      return;
    }

    const token = control(rawToken);
    const expected = hasDisplayedSnapshot ? displayedExpected : currentExpected;
    const fromIndex = hasDisplayedSnapshot ? Math.trunc(displayedIndex) : currentIndex;
    const actionId = `mrq-${Date.now()}-${++runtime.inputSequence}-${Math.random().toString(36).slice(2, 8)}`;
    const item = {
      token,
      expected,
      correct: token === expected,
      fromIndex,
      actionId,
      roundId: currentRound,
      at: `pending-${actionId}`,
      order: runtime.inputSequence,
      status: 'queued'
    };
    runtime.inputQueue.push(item);
    runtime.inputQueueBlocked = !item.correct;
    runtime.syncNotice = '';
    syncPendingCompatibility();
    if (navigator.vibrate) navigator.vibrate(item.correct ? 12 : [22, 30, 22]);
    render();

    const queuedCount = runtime.inputQueue.filter(entry => entry.status === 'queued').length;
    scheduleInputFlush(true);
  }

  function onPointerDown(event) {
    const input = event.target.closest('[data-mr-network-input]');
    if (input && runtime.root?.contains(input) && !input.disabled) {
      event.preventDefault();
      submit(input.dataset.mrNetworkInput, {
        expected: input.dataset.mrDisplayedExpected || '',
        promptIndex: input.dataset.mrDisplayedIndex,
        roundId: input.dataset.mrDisplayedRound || ''
      });
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

  function adopt(game, options = {}) {
    if (!game || game.mode !== MODE) return false;
    const previousGame = runtime.game;
    const gameChanged = Boolean(previousGame && String(previousGame.gameId || '') !== String(game.gameId || ''));
    const resolvingPending = Boolean(options.actionResolved
      && (!runtime.pendingActionId || !options.actionId || options.actionId === runtime.pendingActionId));

    if (!gameChanged && !acceptsSnapshot(game)) {
      if (resolvingPending) {
        finishPendingAction(options.actionId || '');
        runtime.syncNotice = options.ignoreReason === 'prompt-changed'
          ? 'The course advanced while that move was traveling. Follow the highlighted direction.'
          : '';
        render();
      }
      restoreAcceptedBoard();
      startTicker();
      return false;
    }

    if (gameChanged) {
      clearInputQueue();
      runtime.syncNotice = '';
      runtime.renderKey = '';
      if (runtime.resultRevealTimer) window.clearTimeout(runtime.resultRevealTimer);
      runtime.resultRevealTimer = 0;
      runtime.resultRevealGameId = '';
      runtime.resultRevealReady = false;
    }

    const mergedGame = previousGame && !gameChanged ? mergeMountainRaceGame(previousGame, game) : game;
    const nextRenderKey = meaningfulRenderKey(mergedGame);
    const hadPending = Boolean(runtime.inputQueue.length || runtime.busy);
    const sameMeaningfulState = Boolean(previousGame?.gameId === mergedGame.gameId
      && runtime.renderKey === nextRenderKey
      && !hadPending
      && !resolvingPending);
    const confirmedInputAt = mergedGame.mountainraceState?.me?.lastInput?.at || '';
    if (runtime.pendingInput && confirmedInputAt) runtime.lastMyInputAt = confirmedInputAt;
    runtime.game = mergedGame;
    updateServerClock(mergedGame);
    scheduleResultReveal(previousGame, mergedGame);
    if (String(mergedGame.status || '') === 'complete') window.__mountainRacePauseCompletedPolling?.(mergedGame);
    if (String(mergedGame.status || '') !== 'playing' && runtime.inputQueue.length) clearInputQueue();

    if (resolvingPending) {
      finishPendingAction(options.actionId || '');
      runtime.syncNotice = options.ignoreReason === 'prompt-changed'
        ? 'The course advanced while that move was traveling. Follow the highlighted direction.'
        : options.ignoredAction
          ? 'That duplicate move was ignored. The highlighted direction is current.'
          : '';
    }

    if (sameMeaningfulState && runtime.root?.isConnected) {
      updateClock();
      startTicker();
      return true;
    }
    runtime.renderKey = nextRenderKey;
    render();
    startTicker();
    return true;
  }

  window.addEventListener(STATE_EVENT, event => adopt(event?.detail?.game, { source: 'state-event' }));
  document.addEventListener('pointerdown', onPointerDown, { passive: false });
  window.addEventListener('keydown', onKeyDown, { passive: false });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && runtime.game) window.__mountainRaceBridge?.refresh?.();
  });

  window.MountainRaceMultiplayer = Object.freeze({ adopt, render, submit, acceptsSnapshot, snapshotVersion, compareSnapshotVersions, scheduleBotWake, flushInputQueue, clearInputQueue, mergeMountainRaceGame, authoritativeSlip, rebaseInputQueueAgainstGame });
})();


// MOUNTAIN_RACE_REFERENCE_ATLAS_V21
// The approved concept image is kept as a build artifact. The browser crops it once
// into PNG data URLs so the live game uses clean mountain/grass PNG layers while
// climbers, arrows and authoritative gameplay remain independent DOM layers.
function ensureReferenceAtlasV21(root) {
  if (!root) return;
  root.dataset.mrReferenceAtlas = '21';

  const installAtlas = atlas => {
    if (!atlas || !root?.style) return;
    root.style.setProperty('--mr-v21-left-cliff', 'url("' + atlas.leftCliff + '")');
    root.style.setProperty('--mr-v21-right-cliff', 'url("' + atlas.rightCliff + '")');
    root.style.setProperty('--mr-v21-grass-strip', 'url("' + atlas.grass + '")');
    root.style.setProperty('--mr-v21-rock-texture', 'url("' + atlas.rock + '")');
    root.dataset.mrReferenceAtlasReady = '1';
  };

  if (window.__mountainRaceReferenceAtlasV21) {
    installAtlas(window.__mountainRaceReferenceAtlasV21);
    return;
  }

  if (!window.__mountainRaceReferenceAtlasV21Promise) {
    window.__mountainRaceReferenceAtlasV21Promise = new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => {
        try {
          const W = image.naturalWidth || image.width;
          const H = image.naturalHeight || image.height;
          if (!W || !H) throw new Error('reference image has no dimensions');

          const pngCrop = (nx, ny, nw, nh, outW, outH, options = {}) => {
            const canvas = document.createElement('canvas');
            canvas.width = outW;
            canvas.height = outH;
            const ctx = canvas.getContext('2d', { alpha: true });
            if (!ctx) throw new Error('canvas 2d context unavailable');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            const sx = Math.round(nx * W);
            const sy = Math.round(ny * H);
            const sw = Math.max(1, Math.round(nw * W));
            const sh = Math.max(1, Math.round(nh * H));

            if (options.tileMirror) {
              const tileW = Math.max(64, Math.round(outW / 6));
              for (let x = 0, index = 0; x < outW; x += tileW, index += 1) {
                ctx.save();
                if (index % 2) {
                  ctx.translate(x + tileW, 0);
                  ctx.scale(-1, 1);
                  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, tileW + 2, outH);
                } else {
                  ctx.drawImage(image, sx, sy, sw, sh, x, 0, tileW + 2, outH);
                }
                ctx.restore();
              }
            } else {
              ctx.drawImage(image, sx, sy, sw, sh, 0, 0, outW, outH);
            }

            if (options.light) {
              const light = ctx.createLinearGradient(0, 0, outW, outH);
              light.addColorStop(0, 'rgba(255,236,194,.12)');
              light.addColorStop(.42, 'rgba(255,236,194,0)');
              light.addColorStop(1, 'rgba(7,10,8,.18)');
              ctx.fillStyle = light;
              ctx.fillRect(0, 0, outW, outH);
            }
            return canvas.toDataURL('image/png');
          };

          // Normalized crops are based on the approved 896 x 1536 reference.
          // The clean cliff ranges intentionally stop above the reference climbers/UI.
          const atlas = {
            leftCliff: pngCrop(70 / 896, 120 / 1536, 290 / 896, 730 / 1536, 512, 1536, { light: true }),
            rightCliff: pngCrop(530 / 896, 120 / 1536, 290 / 896, 730 / 1536, 512, 1536, { light: true }),
            // Narrow edge crop contains grass/earth but excludes the baked climber.
            grass: pngCrop(108 / 896, 958 / 1536, 88 / 896, 116 / 1536, 768, 184, { tileMirror: true, light: true }),
            rock: pngCrop(188 / 896, 284 / 1536, 178 / 896, 250 / 1536, 512, 512, { light: true })
          };
          window.__mountainRaceReferenceAtlasV21 = atlas;
          resolve(atlas);
        } catch (error) {
          reject(error);
        }
      };
      image.onerror = () => reject(new Error('reference image failed to load'));
      image.src = 'assets/mountain-race/images/summit-sprint-reference-v21.jpg?reference=21';
    }).catch(error => {
      console.warn('[Summit Sprint V21] PNG atlas fallback active:', error);
      return null;
    });
  }

  window.__mountainRaceReferenceAtlasV21Promise.then(installAtlas);
}


// MOUNTAIN_RACE_REFERENCE_REBUILD_V22
// Rebuild the approved concept art as crisp, aspect-correct PNG terrain tiles.
// V21 stretched one tall crop across the complete scrolling wall; V22 instead
// stacks square photographic rock sections, preserving detail at phone scale.
function ensureReferenceRebuildV22(root) {
  if (!root) return;
  root.dataset.mrReferenceRebuild = '22';

  const install = atlas => {
    if (!atlas || !root?.style) return;
    root.style.setProperty('--mr-v22-left-terrain', 'url("' + atlas.leftTerrain + '")');
    root.style.setProperty('--mr-v22-right-terrain', 'url("' + atlas.rightTerrain + '")');
    root.style.setProperty('--mr-v22-grass', 'url("' + atlas.grass + '")');
    root.dataset.mrReferenceRebuildReady = '1';
  };

  if (window.__mountainRaceReferenceRebuildV22) {
    install(window.__mountainRaceReferenceRebuildV22);
    return;
  }

  if (!window.__mountainRaceReferenceRebuildV22Promise) {
    window.__mountainRaceReferenceRebuildV22Promise = new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => {
        try {
          const W = image.naturalWidth || image.width;
          const H = image.naturalHeight || image.height;
          if (!W || !H) throw new Error('reference image has no dimensions');

          // Coordinate helpers are normalized from the approved 896x1536 concept,
          // but scale against the real source dimensions at runtime.
          const sx = value => Math.round((value / 896) * W);
          const sy = value => Math.round((value / 1536) * H);
          const sw = value => Math.max(1, Math.round((value / 896) * W));
          const sh = value => Math.max(1, Math.round((value / 1536) * H));

          const makeTerrain = (side = 'left') => {
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 2048;
            const ctx = canvas.getContext('2d', { alpha: false });
            if (!ctx) throw new Error('terrain canvas unavailable');

            const leftX = 70;
            const rightX = 530;
            const x = side === 'left' ? leftX : rightX;
            const otherX = side === 'left' ? rightX : leftX;
            const crops = [
              [x, 150, 290, 290, false],
              [x, 430, 290, 290, true],
              [otherX, 205, 290, 290, side === 'left'],
              [x, 555, 290, 290, side !== 'left']
            ];

            ctx.fillStyle = '#75634c';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.filter = 'brightness(1.20) contrast(1.08) saturate(.88)';

            crops.forEach(([cx, cy, cw, ch, mirror], index) => {
              const dy = index * 512;
              ctx.save();
              if (mirror) {
                ctx.translate(512, 0);
                ctx.scale(-1, 1);
                ctx.drawImage(image, sx(cx), sy(cy), sw(cw), sh(ch), 0, dy, 512, 512);
              } else {
                ctx.drawImage(image, sx(cx), sy(cy), sw(cw), sh(ch), 0, dy, 512, 512);
              }
              ctx.restore();
            });
            ctx.filter = 'none';

            // Directional daylight and localized crevice depth without blackening
            // the entire cliff face.
            const sun = ctx.createLinearGradient(0, 0, 512, 2048);
            sun.addColorStop(0, 'rgba(255,238,197,.19)');
            sun.addColorStop(.28, 'rgba(255,232,188,.045)');
            sun.addColorStop(.72, 'rgba(20,18,14,.025)');
            sun.addColorStop(1, 'rgba(8,9,7,.13)');
            ctx.fillStyle = sun;
            ctx.fillRect(0, 0, 512, 2048);

            const rim = ctx.createLinearGradient(0, 0, 512, 0);
            rim.addColorStop(0, 'rgba(20,19,15,.18)');
            rim.addColorStop(.08, 'rgba(0,0,0,0)');
            rim.addColorStop(.88, 'rgba(0,0,0,0)');
            rim.addColorStop(1, 'rgba(8,9,7,.24)');
            ctx.fillStyle = rim;
            ctx.fillRect(0, 0, 512, 2048);

            return canvas.toDataURL('image/png');
          };

          const makeGrass = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 768;
            canvas.height = 190;
            const ctx = canvas.getContext('2d', { alpha: false });
            if (!ctx) throw new Error('grass canvas unavailable');

            // Clean strips from both platforms avoid the baked climbers while keeping
            // the real grass, dirt and small flowers from the approved reference.
            const strips = [
              [104, 930, 82, 150],
              [318, 930, 42, 150],
              [530, 930, 72, 150],
              [720, 930, 70, 150]
            ];
            ctx.fillStyle = '#4b3d2b';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.filter = 'brightness(1.08) contrast(1.05) saturate(.88)';

            const tileW = 96;
            for (let x = 0, i = 0; x < canvas.width; x += tileW, i += 1) {
              const strip = strips[i % strips.length];
              ctx.save();
              if (i % 2) {
                ctx.translate(x + tileW, 0);
                ctx.scale(-1, 1);
                ctx.drawImage(image, sx(strip[0]), sy(strip[1]), sw(strip[2]), sh(strip[3]), 0, 0, tileW + 1, canvas.height);
              } else {
                ctx.drawImage(image, sx(strip[0]), sy(strip[1]), sw(strip[2]), sh(strip[3]), x, 0, tileW + 1, canvas.height);
              }
              ctx.restore();
            }
            ctx.filter = 'none';

            const light = ctx.createLinearGradient(0, 0, 0, canvas.height);
            light.addColorStop(0, 'rgba(255,239,194,.16)');
            light.addColorStop(.42, 'rgba(255,239,194,0)');
            light.addColorStop(1, 'rgba(16,14,10,.13)');
            ctx.fillStyle = light;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            return canvas.toDataURL('image/png');
          };

          const atlas = {
            leftTerrain: makeTerrain('left'),
            rightTerrain: makeTerrain('right'),
            grass: makeGrass()
          };
          window.__mountainRaceReferenceRebuildV22 = atlas;
          resolve(atlas);
        } catch (error) {
          reject(error);
        }
      };
      image.onerror = () => reject(new Error('V22 reference image failed to load'));
      image.src = 'assets/mountain-race/images/summit-sprint-reference-v21.jpg?reference=22';
    }).catch(error => {
      console.warn('[Summit Sprint V22] reference terrain fallback active:', error);
      return null;
    });
  }

  window.__mountainRaceReferenceRebuildV22Promise.then(install);
}


// MOUNTAIN_RACE_FULL_CLIFF_V23
// Use the complete approved V21 reference cliff instead of slicing/repeating it.
// The browser converts that already-committed photographic source into two full
// PNG lane plates plus a dedicated grass PNG. Gameplay remains live DOM above it.
function ensureFullCliffV23(root) {
  if (!root) return;
  root.dataset.mrFullCliff = '23';

  const install = atlas => {
    if (!atlas || !root?.style) return;
    root.style.setProperty('--mr-v23-left-cliff', 'url("' + atlas.left + '")');
    root.style.setProperty('--mr-v23-right-cliff', 'url("' + atlas.right + '")');
    root.style.setProperty('--mr-v23-grass', 'url("' + atlas.grass + '")');
    root.dataset.mrFullCliffReady = '1';
  };

  if (window.__mountainRaceFullCliffV23) {
    install(window.__mountainRaceFullCliffV23);
    return;
  }

  if (!window.__mountainRaceFullCliffV23Promise) {
    window.__mountainRaceFullCliffV23Promise = new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => {
        try {
          const sourceW = image.naturalWidth || image.width;
          const sourceH = image.naturalHeight || image.height;
          if (!sourceW || !sourceH) throw new Error('reference cliff has no dimensions');

          const drawCover = (ctx, outW, outH, mirror = false) => {
            const sourceRatio = sourceW / sourceH;
            const targetRatio = outW / outH;
            let sx = 0;
            let sy = 0;
            let sw = sourceW;
            let sh = sourceH;
            if (sourceRatio > targetRatio) {
              sw = Math.max(1, Math.round(sourceH * targetRatio));
              sx = Math.round((sourceW - sw) / 2);
            } else if (sourceRatio < targetRatio) {
              sh = Math.max(1, Math.round(sourceW / targetRatio));
              sy = Math.round((sourceH - sh) / 2);
            }
            ctx.save();
            if (mirror) {
              ctx.translate(outW, 0);
              ctx.scale(-1, 1);
            }
            ctx.drawImage(image, sx, sy, sw, sh, 0, 0, outW, outH);
            ctx.restore();
          };

          const makeCliff = mirror => {
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 1536;
            const ctx = canvas.getContext('2d', { alpha: false });
            if (!ctx) throw new Error('full cliff canvas unavailable');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            drawCover(ctx, canvas.width, canvas.height, mirror);

            // Warm top-left daylight with restrained crevice depth. This preserves
            // the actual photographed rock rather than tinting it into flat brown.
            const sunlight = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
            sunlight.addColorStop(0, 'rgba(255,236,190,.12)');
            sunlight.addColorStop(.34, 'rgba(255,236,190,.025)');
            sunlight.addColorStop(.72, 'rgba(15,14,11,.015)');
            sunlight.addColorStop(1, 'rgba(7,8,7,.07)');
            ctx.fillStyle = sunlight;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const edgeDepth = ctx.createLinearGradient(0, 0, canvas.width, 0);
            edgeDepth.addColorStop(0, 'rgba(5,7,6,.12)');
            edgeDepth.addColorStop(.08, 'rgba(0,0,0,0)');
            edgeDepth.addColorStop(.90, 'rgba(0,0,0,0)');
            edgeDepth.addColorStop(1, 'rgba(4,6,5,.18)');
            ctx.fillStyle = edgeDepth;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            return canvas.toDataURL('image/png');
          };

          const makeGrass = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 768;
            canvas.height = 184;
            const ctx = canvas.getContext('2d', { alpha: false });
            if (!ctx) throw new Error('grass canvas unavailable');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            // The approved cliff source contains a clean grass/earth band at its
            // lower edge. Use the complete band rather than cloning narrow strips.
            const cropY = Math.max(0, Math.round(sourceH * .82));
            const cropH = Math.max(1, sourceH - cropY);
            ctx.drawImage(image, 0, cropY, sourceW, cropH, 0, 0, canvas.width, canvas.height);

            const light = ctx.createLinearGradient(0, 0, 0, canvas.height);
            light.addColorStop(0, 'rgba(255,239,195,.13)');
            light.addColorStop(.45, 'rgba(255,239,195,0)');
            light.addColorStop(1, 'rgba(8,10,7,.10)');
            ctx.fillStyle = light;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            return canvas.toDataURL('image/png');
          };

          const atlas = {
            left: makeCliff(false),
            right: makeCliff(true),
            grass: makeGrass()
          };
          window.__mountainRaceFullCliffV23 = atlas;
          resolve(atlas);
        } catch (error) {
          reject(error);
        }
      };
      image.onerror = () => reject(new Error('V23 full cliff reference failed to load'));
      image.src = 'assets/mountain-race/images/summit-sprint-reference-v21.jpg?fullcliff=23';
    }).catch(error => {
      console.warn('[Summit Sprint V23] full cliff fallback active:', error);
      return null;
    });
  }

  window.__mountainRaceFullCliffV23Promise.then(install);
}


// MOUNTAIN_RACE_CORRECTED_REFERENCE_V24
// V23 sampled the center of the complete reference frame, so each narrow lane
// contained both cliffs/chasm and was then stretched. V24 crops the real left
// and right cliff faces independently, preserves their native ~1:3 proportions,
// stacks two sharp photographic sections to fill the long scrolling wall, and
// derives the grass and route ledges from their actual locations in the reference.
function ensureCorrectedReferenceV24(root) {
  if (!root) return;
  root.dataset.mrCorrectedReference = '24';

  const install = atlas => {
    if (!atlas || !root?.style) return;
    root.style.setProperty('--mr-v24-left-cliff', 'url("' + atlas.left + '")');
    root.style.setProperty('--mr-v24-right-cliff', 'url("' + atlas.right + '")');
    root.style.setProperty('--mr-v24-grass', 'url("' + atlas.grass + '")');
    root.style.setProperty('--mr-v24-holds', 'url("' + atlas.holds + '")');
    root.dataset.mrCorrectedReferenceReady = '1';
  };

  if (window.__mountainRaceCorrectedReferenceV24) {
    install(window.__mountainRaceCorrectedReferenceV24);
    return;
  }

  if (!window.__mountainRaceCorrectedReferenceV24Promise) {
    window.__mountainRaceCorrectedReferenceV24Promise = new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => {
        try {
          const sourceW = image.naturalWidth || image.width;
          const sourceH = image.naturalHeight || image.height;
          if (!sourceW || !sourceH) throw new Error('corrected reference has no dimensions');

          // Coordinates were measured on the approved 955 x 1647 reference.
          // Ratios make the same crop work if the build source is resized.
          const sx = value => (value / 955) * sourceW;
          const sy = value => (value / 1647) * sourceH;
          const leftRect = { x: sx(105), y: sy(125), w: sx(290), h: sy(870) };
          const rightRect = { x: sx(555), y: sy(125), w: sx(290), h: sy(870) };

          const drawCrop = (ctx, rect, dx, dy, dw, dh, mirror = false) => {
            ctx.save();
            if (mirror) {
              ctx.translate(dx + dw, dy);
              ctx.scale(-1, 1);
              ctx.drawImage(image, rect.x, rect.y, rect.w, rect.h, 0, 0, dw, dh);
            } else {
              ctx.drawImage(image, rect.x, rect.y, rect.w, rect.h, dx, dy, dw, dh);
            }
            ctx.restore();
          };

          const makeCliff = (firstRect, secondRect, mirrorSecond) => {
            const canvas = document.createElement('canvas');
            canvas.width = 320;
            canvas.height = 1920;
            const ctx = canvas.getContext('2d', { alpha: false });
            if (!ctx) throw new Error('corrected cliff canvas unavailable');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            // Each original 290x870 crop is ~1:3. It is scaled proportionally to
            // 320x960 and stacked, instead of stretching one short crop to 1700px.
            drawCrop(ctx, firstRect, 0, 0, 320, 960, false);
            drawCrop(ctx, secondRect, 0, 960, 320, 960, mirrorSecond);

            // Hide the join with a narrow geological fracture rather than blur.
            const seamY = 960;
            ctx.beginPath();
            for (let x = 0; x <= canvas.width; x += 10) {
              const y = seamY + Math.sin(x * 0.082) * 4 + Math.sin(x * 0.029 + 1.7) * 3;
              if (x === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
            ctx.strokeStyle = 'rgba(20,17,12,.42)';
            ctx.lineWidth = 2.2;
            ctx.stroke();
            ctx.translate(0, 2);
            ctx.strokeStyle = 'rgba(223,190,132,.10)';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.setTransform(1, 0, 0, 1, 0, 0);

            const daylight = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
            daylight.addColorStop(0, 'rgba(255,239,199,.10)');
            daylight.addColorStop(.30, 'rgba(255,239,199,.018)');
            daylight.addColorStop(.76, 'rgba(7,9,8,0)');
            daylight.addColorStop(1, 'rgba(5,7,6,.055)');
            ctx.fillStyle = daylight;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            return canvas.toDataURL('image/png');
          };

          const grassRects = [
            [95, 1060, 150, 150],
            [720, 1060, 150, 150],
            [35, 1055, 150, 150],
            [770, 1025, 150, 150]
          ];
          const rockRects = [
            [220, 310, 150, 150],
            [600, 320, 150, 150],
            [200, 640, 150, 150],
            [560, 670, 150, 150]
          ];

          const makeGrass = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 768;
            canvas.height = 190;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('corrected grass canvas unavailable');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            ctx.save();
            ctx.beginPath();
            const points = [
              [16,48],[36,27],[80,14],[130,8],[190,11],[248,5],[310,10],[376,4],
              [444,9],[512,5],[580,10],[644,6],[705,16],[748,40],[746,98],[724,130],
              [682,154],[620,171],[549,182],[465,188],[380,188],[292,184],[211,175],
              [140,161],[78,142],[36,116]
            ];
            points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
            ctx.closePath();
            ctx.clip();

            for (let i = 0; i < 4; i += 1) {
              const [rx, ry, rw, rh] = rockRects[i];
              ctx.drawImage(image, sx(rx), sy(ry), sx(rw), sy(rh), i * 192, 62, 194, 128);
              const [gx, gy, gw, gh] = grassRects[i];
              ctx.drawImage(image, sx(gx), sy(gy), sx(gw), sy(gh), i * 192, 0, 194, 92);
            }

            const sun = ctx.createLinearGradient(0, 0, 0, canvas.height);
            sun.addColorStop(0, 'rgba(255,241,197,.14)');
            sun.addColorStop(.36, 'rgba(255,241,197,.02)');
            sun.addColorStop(1, 'rgba(5,8,5,.08)');
            ctx.fillStyle = sun;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.restore();
            return canvas.toDataURL('image/png');
          };

          const holdRects = [
            [205,165,155,80],
            [245,310,155,85],
            [210,490,170,95],
            [255,745,165,95],
            [520,170,160,85],
            [505,460,185,100]
          ];

          const makeHolds = () => {
            const tileW = 160;
            const tileH = 96;
            const canvas = document.createElement('canvas');
            canvas.width = tileW * holdRects.length;
            canvas.height = tileH;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('corrected hold canvas unavailable');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            holdRects.forEach(([rx, ry, rw, rh], index) => {
              const ox = index * tileW;
              ctx.save();
              ctx.translate(ox, 0);
              ctx.beginPath();
              ctx.moveTo(8, 42);
              ctx.lineTo(18, 25);
              ctx.lineTo(43, 13);
              ctx.lineTo(78, 8);
              ctx.lineTo(119, 12);
              ctx.lineTo(148, 28);
              ctx.lineTo(156, 48);
              ctx.lineTo(147, 68);
              ctx.lineTo(124, 83);
              ctx.lineTo(85, 90);
              ctx.lineTo(49, 86);
              ctx.lineTo(22, 70);
              ctx.closePath();
              ctx.clip();
              ctx.drawImage(image, sx(rx), sy(ry), sx(rw), sy(rh), 0, 0, tileW, tileH);
              ctx.restore();
            });
            return canvas.toDataURL('image/png');
          };

          const atlas = {
            left: makeCliff(leftRect, rightRect, true),
            right: makeCliff(rightRect, leftRect, true),
            grass: makeGrass(),
            holds: makeHolds()
          };
          window.__mountainRaceCorrectedReferenceV24 = atlas;
          resolve(atlas);
        } catch (error) {
          reject(error);
        }
      };
      image.onerror = () => reject(new Error('V24 approved reference failed to load'));
      image.src = 'assets/mountain-race/images/summit-sprint-reference-v21.jpg?corrected=24';
    }).catch(error => {
      console.warn('[Summit Sprint V24] corrected reference fallback active:', error);
      return null;
    });
  }

  window.__mountainRaceCorrectedReferenceV24Promise.then(install);
}
