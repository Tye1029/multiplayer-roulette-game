(() => {
  'use strict';

  const STATE_EVENT = 'safecracker:state';
  const STAGES = 3;
  const DETENT_DEGREES = 36;
  const funnyLosses = [
    'Too slow. Your opponent is already counting the money.',
    'The safe remains safe from you.',
    'You cracked under pressure. The safe did not.',
    'Good news: the lock works perfectly.',
    'Your opponent opened the safe. You opened absolutely nothing.',
    'Maybe try asking the safe politely next time.',
    'You were one click away. Probably.',
    'The vault thanks you for testing its security.'
  ];

  const runtime = {
    game: null,
    selected: 0,
    rotation: 0,
    stageKey: '',
    busy: false,
    dragging: false,
    pointerId: null,
    lastPointerAngle: 0,
    lastDetent: 0,
    audioContext: null,
    serverOffsetMs: 0,
    ticker: 0,
    resultSoundKey: '',
    feedbackTimer: 0
  };

  function modulo(value, size) {
    return ((value % size) + size) % size;
  }

  function circularDeltaDegrees(value) {
    let result = value % 360;
    if (result > 180) result -= 360;
    if (result < -180) result += 360;
    return result;
  }

  function selectedFromRotation(rotation) {
    return modulo(-Math.round(rotation / DETENT_DEGREES), 10);
  }

  function nearestRotationForDigit(digit, aroundRotation) {
    const base = -modulo(Number(digit) || 0, 10) * DETENT_DEGREES;
    const turns = Math.round((aroundRotation - base) / 360);
    return base + turns * 360;
  }

  function stateFor(game = runtime.game) {
    return game?.safecrackerState || {};
  }

  function myState(game = runtime.game) {
    return stateFor(game)?.me || {};
  }

  function opponentState(game = runtime.game) {
    return stateFor(game)?.opponent || {};
  }

  function stageKey(game) {
    const state = stateFor(game);
    return `${game?.gameId || ''}:${state?.me?.stage || 0}`;
  }

  function updateClock(game) {
    const serverNow = Date.parse(String(game?.serverNow || ''));
    if (Number.isFinite(serverNow)) {
      const desired = serverNow - Date.now();
      runtime.serverOffsetMs += (desired - runtime.serverOffsetMs) * 0.45;
    }
  }

  function serverNowMs() {
    return Date.now() + runtime.serverOffsetMs;
  }

  function secondsLeft(game = runtime.game) {
    const endAt = Date.parse(String(stateFor(game)?.endAt || ''));
    if (!Number.isFinite(endAt)) return 75;
    return Math.max(0, Math.ceil((endAt - serverNowMs()) / 1000));
  }

  function formatTimer(seconds) {
    const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
    const minutes = Math.floor(safeSeconds / 60);
    const remainder = String(safeSeconds % 60).padStart(2, '0');
    return `${minutes}:${remainder}`;
  }

  function audioContext() {
    if (runtime.audioContext) return runtime.audioContext;
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return null;
    runtime.audioContext = new AudioCtor();
    return runtime.audioContext;
  }

  function resumeAudio() {
    const context = audioContext();
    if (context?.state === 'suspended') context.resume().catch(() => {});
    return context;
  }

  function tierWeight(tier) {
    if (tier === 'green') return 1;
    if (tier === 'yellow') return 0.74;
    if (tier === 'orange') return 0.46;
    if (tier === 'red') return 0.18;
    return 0.24;
  }

  function knownClickWeight(digit) {
    const attempts = Array.isArray(myState()?.attempts) ? myState().attempts : [];
    const stage = Number(myState()?.stage || 0);
    const stageAttempts = attempts.filter(attempt => Number(attempt.stage || 0) === stage);
    const exact = stageAttempts.find(attempt => Number(attempt.guess) === Number(digit));
    if (exact) return tierWeight(exact.tier);
    if (!stageAttempts.length) return 0.24;
    let best = 0.24;
    for (const attempt of stageAttempts) {
      const distance = Math.min(Math.abs(Number(attempt.guess) - digit), 10 - Math.abs(Number(attempt.guess) - digit));
      const faded = Math.max(0.16, tierWeight(attempt.tier) - distance * 0.14);
      best = Math.max(best, faded);
    }
    return best;
  }

  function playTone(frequency, duration, gainValue, type = 'triangle', delay = 0) {
    const context = resumeAudio();
    if (!context || document.hidden) return;
    const now = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(40, frequency), now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, gainValue), now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(0.025, duration));
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.04);
  }

  function playDetent(digit) {
    const weight = knownClickWeight(digit);
    playTone(170 + digit * 9 + weight * 120, 0.045, 0.018 + weight * 0.045, 'square');
    if (weight > 0.55) playTone(510 + weight * 190, 0.055, 0.008 + weight * 0.018, 'sine', 0.008);
    if (navigator.vibrate && weight > 0.68) navigator.vibrate(weight > 0.9 ? 14 : 8);
  }

  function playFeedback(tier) {
    if (tier === 'green') {
      playTone(160, 0.12, 0.09, 'square');
      playTone(390, 0.19, 0.07, 'triangle', 0.05);
      playTone(620, 0.22, 0.055, 'sine', 0.12);
      navigator.vibrate?.([24, 35, 40]);
      return;
    }
    if (tier === 'yellow') {
      playTone(480, 0.13, 0.055, 'triangle');
      playTone(690, 0.11, 0.035, 'sine', 0.04);
      navigator.vibrate?.(18);
      return;
    }
    if (tier === 'orange') {
      playTone(270, 0.13, 0.045, 'sawtooth');
      navigator.vibrate?.(11);
      return;
    }
    playTone(105, 0.18, 0.055, 'square');
    navigator.vibrate?.(7);
  }

  function playResult(won, tied) {
    const gameId = String(runtime.game?.gameId || '');
    const key = `${gameId}:${won ? 'win' : tied ? 'tie' : 'lose'}`;
    if (!gameId || runtime.resultSoundKey === key) return;
    runtime.resultSoundKey = key;
    if (won) {
      playTone(196, 0.16, 0.075, 'triangle');
      playTone(392, 0.2, 0.065, 'triangle', 0.09);
      playTone(659, 0.3, 0.055, 'sine', 0.19);
    } else if (tied) {
      playTone(220, 0.18, 0.05, 'triangle');
      playTone(220, 0.18, 0.04, 'triangle', 0.22);
    } else {
      playTone(160, 0.16, 0.06, 'sawtooth');
      playTone(92, 0.34, 0.07, 'square', 0.12);
    }
  }

  function playerAvatar(player, fallback = '?') {
    if (player?.avatarUrl) return `<img src="${escapeHtml(player.avatarUrl)}" alt="">`;
    const initial = String(player?.profileInitial || player?.name || fallback).trim().slice(0, 1).toUpperCase() || fallback;
    return `<span>${escapeHtml(initial)}</span>`;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    })[character]);
  }

  function tierLabel(tier) {
    if (tier === 'green') return 'NUMBER LOCKED';
    if (tier === 'yellow') return 'VERY CLOSE';
    if (tier === 'orange') return 'GETTING CLOSER';
    if (tier === 'red') return 'TOO FAR AWAY';
    return 'TURN THE DIAL';
  }

  function progressLights(progress = {}) {
    const stage = Math.max(0, Math.min(STAGES, Number(progress.stage || 0)));
    return Array.from({ length: STAGES }, (_, index) => `<span class="sc-stage-light ${index < stage ? 'locked' : index === stage ? 'active' : ''}">${index + 1}</span>`).join('');
  }

  function attemptRows(attempts = [], currentStage = 0) {
    const rows = attempts.filter(attempt => Number(attempt.stage || 0) === Number(currentStage)).slice(-5).reverse();
    if (!rows.length) return '<div class="sc-attempt-empty">No attempts on this tumbler yet.</div>';
    return rows.map(attempt => `<div class="sc-attempt-row ${escapeHtml(attempt.tier || '')}"><span>${escapeHtml(attempt.guess)}</span><b>${escapeHtml(tierLabel(attempt.tier))}</b></div>`).join('');
  }

  function dialNumbers() {
    return Array.from({ length: 10 }, (_, digit) => {
      const angle = digit * DETENT_DEGREES;
      return `<span class="sc-dial-number" style="--digit-angle:${angle}deg">${digit}</span>`;
    }).join('');
  }

  function funnyLoss(gameId) {
    let hash = 0;
    for (const character of String(gameId || 'safe')) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
    return funnyLosses[Math.abs(hash) % funnyLosses.length];
  }

  function resultOverlay(game) {
    if (game?.status !== 'complete') return '';
    const state = stateFor(game);
    const myUserId = String(game.isCreator ? game.creator?.userId : game.joiner?.userId || '');
    const won = Boolean(game.winnerUserId && String(game.winnerUserId) === myUserId);
    const tied = Boolean(game.tie);
    playResult(won, tied);
    const title = tied ? 'VAULT LOCKDOWN' : won ? 'SAFE CRACKED!' : 'YOU LOSE';
    const message = tied
      ? 'Neither safe opened before time expired. Both wagers were returned.'
      : won
        ? `You opened your safe first and won ${Number(game.payout || 0).toLocaleString('en-US')} Tickets.`
        : funnyLoss(game.gameId);
    const reveal = state.revealedCodes || {};
    const codes = reveal.my || reveal.opponent
      ? `<div class="sc-code-reveal"><span>Your code <b>${escapeHtml(reveal.my || '---')}</b></span><span>Opponent <b>${escapeHtml(reveal.opponent || '---')}</b></span></div>`
      : '';
    return `<div class="sc-result-overlay ${won ? 'win' : tied ? 'tie' : 'lose'}">
      <div class="sc-result-card">
        <div class="sc-result-kicker">SAFE CRACKER</div>
        <h2>${title}</h2>
        <p>${escapeHtml(message)}</p>
        ${codes}
        <div class="sc-result-actions">
          <button class="gold" data-sc-rematch type="button">Rematch</button>
          <button class="secondary" data-sc-new-game type="button">Create a New Game</button>
        </div>
      </div>
    </div>`;
  }

  function render(game) {
    runtime.game = game;
    updateClock(game);
    const mount = document.querySelector('[data-safe-cracker-mount]');
    if (!mount) return;

    const state = stateFor(game);
    const me = myState(game);
    const opponent = opponentState(game);
    const nextStageKey = stageKey(game);
    if (runtime.stageKey !== nextStageKey) {
      runtime.stageKey = nextStageKey;
      runtime.selected = 0;
      runtime.rotation = nearestRotationForDigit(0, runtime.rotation);
      runtime.lastDetent = 0;
      runtime.busy = false;
    }

    const latest = me.lastResult || null;
    const canSubmit = Boolean(game.status === 'playing' && state.canSubmit && !runtime.busy && Number(me.stage || 0) < STAGES);
    const displayTier = latest?.tier || 'idle';
    const displayText = latest ? tierLabel(latest.tier) : game.status === 'countdown' ? 'GET READY' : 'TURN THE DIAL';
    const opponentName = game.isCreator ? game.joiner?.name : game.creator?.name;
    const opponentPlayer = game.isCreator ? game.joiner : game.creator;
    const myPlayer = game.isCreator ? game.creator : game.joiner;

    mount.innerHTML = `<section class="safe-cracker-game" data-sc-game-id="${escapeHtml(game.gameId || '')}" data-sc-status="${escapeHtml(game.status || '')}">
      <div class="sc-topbar">
        <div class="sc-player-card me"><div class="sc-avatar">${playerAvatar(myPlayer, 'Y')}</div><div><small>YOU</small><b>${escapeHtml(myPlayer?.name || 'Player')}</b><div class="sc-progress-lights">${progressLights(me)}</div></div></div>
        <div class="sc-timer" data-sc-timer>${formatTimer(secondsLeft(game))}</div>
        <div class="sc-player-card opponent"><div><small>OPPONENT</small><b>${escapeHtml(opponentName || 'Waiting')}</b><div class="sc-progress-lights">${progressLights(opponent)}</div></div><div class="sc-avatar">${playerAvatar(opponentPlayer, 'O')}</div></div>
      </div>

      <div class="sc-opponent-strip ${escapeHtml(opponent.lastTier || '')}">
        <span>${escapeHtml(opponentName || 'Opponent')}</span>
        <b>${Math.min(STAGES, Number(opponent.stage || 0))} / ${STAGES} tumblers</b>
        <em>${opponent.completed ? 'SAFE OPEN' : opponent.lastTier ? tierLabel(opponent.lastTier) : 'Searching...'}</em>
      </div>

      <div class="sc-safe-shell ${Number(me.stage || 0) >= STAGES ? 'open' : ''}">
        <div class="sc-safe-door">
          <div class="sc-bolts left"><i></i><i></i><i></i></div>
          <div class="sc-bolts right"><i></i><i></i><i></i></div>
          <div class="sc-display ${escapeHtml(displayTier)}" data-sc-display><span>${escapeHtml(displayText)}</span><small>TUMBLER ${Math.min(STAGES, Number(me.stage || 0) + 1)} OF ${STAGES}</small></div>
          <div class="sc-dial-wrap">
            <div class="sc-dial-pointer" aria-hidden="true"></div>
            <div class="sc-dial" role="slider" tabindex="0" aria-label="Safe dial" aria-valuemin="0" aria-valuemax="9" aria-valuenow="${runtime.selected}" data-sc-dial>
              <div class="sc-dial-face" data-sc-dial-face style="transform:rotate(${runtime.rotation}deg)">${dialNumbers()}<div class="sc-dial-hub"></div></div>
            </div>
            <div class="sc-current-number" data-sc-current>${runtime.selected}</div>
          </div>
          <div class="sc-step-controls"><button type="button" data-sc-step="-1" aria-label="Previous number">−</button><button type="button" data-sc-step="1" aria-label="Next number">+</button></div>
          <button class="sc-confirm-button" type="button" data-sc-confirm ${canSubmit ? '' : 'disabled'}><span>${runtime.busy ? 'CHECKING…' : 'CHECK NUMBER'}</span></button>
          <div class="sc-safe-handle"><span></span></div>
        </div>
        <aside class="sc-attempt-panel"><h3>Current tumbler attempts</h3>${attemptRows(me.attempts || [], me.stage || 0)}</aside>
      </div>
      ${resultOverlay(game)}
    </section>`;

    bindControls(mount, game);
    updateTimerOnly();
  }

  function applyDialVisual() {
    const face = document.querySelector('[data-sc-dial-face]');
    const current = document.querySelector('[data-sc-current]');
    const dial = document.querySelector('[data-sc-dial]');
    if (face) face.style.transform = `rotate(${runtime.rotation}deg)`;
    if (current) current.textContent = String(runtime.selected);
    if (dial) dial.setAttribute('aria-valuenow', String(runtime.selected));
  }

  function setSelected(digit, { sound = true } = {}) {
    const next = modulo(Number(digit) || 0, 10);
    runtime.selected = next;
    runtime.rotation = nearestRotationForDigit(next, runtime.rotation);
    runtime.lastDetent = next;
    applyDialVisual();
    if (sound) playDetent(next);
  }

  function pointerAngle(event, element) {
    const rect = element.getBoundingClientRect();
    const x = event.clientX - (rect.left + rect.width / 2);
    const y = event.clientY - (rect.top + rect.height / 2);
    return Math.atan2(y, x) * 180 / Math.PI;
  }

  function bindControls(mount, game) {
    const dial = mount.querySelector('[data-sc-dial]');
    if (dial) {
      dial.addEventListener('pointerdown', event => {
        if (runtime.busy || game.status !== 'playing') return;
        resumeAudio();
        runtime.dragging = true;
        runtime.pointerId = event.pointerId;
        runtime.lastPointerAngle = pointerAngle(event, dial);
        dial.setPointerCapture?.(event.pointerId);
        dial.classList.add('dragging');
        event.preventDefault();
      });
      dial.addEventListener('pointermove', event => {
        if (!runtime.dragging || runtime.pointerId !== event.pointerId) return;
        const angle = pointerAngle(event, dial);
        const delta = circularDeltaDegrees(angle - runtime.lastPointerAngle);
        runtime.lastPointerAngle = angle;
        runtime.rotation += delta;
        const nextDigit = selectedFromRotation(runtime.rotation);
        if (nextDigit !== runtime.lastDetent) {
          runtime.lastDetent = nextDigit;
          runtime.selected = nextDigit;
          playDetent(nextDigit);
        }
        applyDialVisual();
        event.preventDefault();
      });
      const finishDrag = event => {
        if (!runtime.dragging || runtime.pointerId !== event.pointerId) return;
        runtime.dragging = false;
        runtime.pointerId = null;
        dial.classList.remove('dragging');
        runtime.rotation = nearestRotationForDigit(runtime.selected, runtime.rotation);
        applyDialVisual();
        event.preventDefault();
      };
      dial.addEventListener('pointerup', finishDrag);
      dial.addEventListener('pointercancel', finishDrag);
      dial.addEventListener('keydown', event => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
          setSelected(runtime.selected - 1);
          event.preventDefault();
        } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
          setSelected(runtime.selected + 1);
          event.preventDefault();
        }
      });
    }

    mount.querySelectorAll('[data-sc-step]').forEach(button => {
      button.addEventListener('click', () => setSelected(runtime.selected + Number(button.dataset.scStep || 0)));
    });

    mount.querySelector('[data-sc-confirm]')?.addEventListener('click', () => submitGuess(game));
    mount.querySelector('[data-sc-rematch]')?.addEventListener('click', () => window.__safeCrackerBridge?.rematch?.());
    mount.querySelector('[data-sc-new-game]')?.addEventListener('click', () => window.__safeCrackerBridge?.newGame?.());
  }

  async function submitGuess(game) {
    const bridge = window.__safeCrackerBridge;
    const state = stateFor(game);
    if (!bridge?.submit || runtime.busy || game.status !== 'playing' || !state.canSubmit) return;
    runtime.busy = true;
    render(game);
    try {
      const actionId = `sc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const data = await bridge.submit({
        choice: `safecracker:guess:${runtime.selected}`,
        actionId
      });
      const nextGame = data?.game || runtime.game;
      const result = nextGame?.safecrackerState?.me?.lastResult;
      if (result?.at && result.at !== myState(game)?.lastResult?.at) playFeedback(result.tier);
      runtime.busy = false;
      render(nextGame);
      const cooldown = Number(nextGame?.safecrackerState?.cooldownMs || 0);
      if (cooldown > 0) window.setTimeout(() => window.__safeCrackerBridge?.refresh?.(), cooldown + 30);
    } catch (error) {
      runtime.busy = false;
      const display = document.querySelector('[data-sc-display]');
      if (display) {
        display.className = 'sc-display red';
        display.querySelector('span').textContent = String(error?.message || 'Unable to check that number.');
      }
      setTimeout(() => render(runtime.game), 900);
    }
  }

  function updateTimerOnly() {
    const timer = document.querySelector('[data-sc-timer]');
    if (!timer || !runtime.game) return;
    const seconds = secondsLeft(runtime.game);
    timer.textContent = formatTimer(seconds);
    timer.classList.toggle('danger', seconds <= 10 && runtime.game.status === 'playing');
  }

  function startTicker() {
    if (runtime.ticker) return;
    runtime.ticker = window.setInterval(updateTimerOnly, 150);
  }

  window.addEventListener(STATE_EVENT, event => {
    const game = event?.detail?.game;
    if (!game || game.mode !== 'safecracker') return;
    render(game);
    startTicker();
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && runtime.game) {
      updateTimerOnly();
      window.__safeCrackerBridge?.refresh?.();
    }
  });
})();
