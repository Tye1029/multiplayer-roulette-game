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
    feedbackTimer: 0,

    // SAFE_CRACKER_LATCH_SEQUENCE_V1_RUNTIME

    latchGameId: '',

    latchStage: 0,
    feedbackGameId: '',
    feedbackResult: null,
    feedbackResultAtMs: 0,
    feedbackResultKey: '',
    feedbackFresh: false,
    dialSettleAnimation: null,
    lastDragDirection: 0,
    countdownSoundKey: '',
    visualGameId: '',
    visualStatus: '',
    countdownPortalGameId: '',
    resultPortalGameId: '',
    resultPortalTimer: 0,
    resultSequenceStartedAt: 0,
    resultSequenceAudioKey: '',
    resultPortalFocusTimer: 0,
    countdownProgressKey: '',
    countdownProgressRank: -1,
    countdownProgressLabel: '',
    cooldownGameId: '',
    cooldownUntilMs: 0,
    cooldownReleaseTimer: 0,
    pendingDragGame: null
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
    if (game?.status === 'complete') return 0;
    if (['waiting', 'ready'].includes(String(game?.status || ''))) return 60;
    const endAt = Date.parse(String(stateFor(game)?.endAt || ''));
    if (!Number.isFinite(endAt)) return 60;
    return Math.max(0, Math.ceil((endAt - serverNowMs()) / 1000));
  }

  // SAFE_CRACKER_START_COUNTDOWN_START
  function safeCrackerStartCountdownLabel(game = runtime.game) {
    const startMs = Date.parse(String(game?.startAt || ''));
    if (!Number.isFinite(startMs)) return '';
    const now = serverNowMs();
    const remaining = startMs - now;
    if (game?.status === 'countdown') {
      if (remaining > 2000) return '3';
      if (remaining > 1000) return '2';
      if (remaining > 0) return '1';
      return 'GO!';
    }
    if (game?.status === 'playing' && now < startMs + 500) return 'GO!';
    return '';
  }
  // SAFE_CRACKER_START_COUNTDOWN_END

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

  // SAFE_CRACKER_FEEDBACK_LATCH_START
  function submittedFeedbackKey(result) {
    if (!result || typeof result !== 'object') return '';
    return [Number(result.stage || 0), Number(result.guess || 0), String(result.tier || ''), String(result.at || '')].join(':');
  }

  function adoptSubmittedFeedback(game) {
    const gameId = String(game?.gameId || '');
    if (runtime.feedbackGameId !== gameId) {
      runtime.feedbackGameId = gameId;
      runtime.feedbackResult = null;
      runtime.feedbackResultAtMs = 0;
      runtime.feedbackResultKey = '';
      runtime.feedbackFresh = false;
    }
    const candidate = game?.safecrackerState?.me?.lastResult;
    if (!candidate || !candidate.tier || !candidate.at) return false;
    const candidateAtMs = Date.parse(String(candidate.at || '')) || 0;
    const candidateKey = submittedFeedbackKey(candidate);
    if (runtime.feedbackResult) {
      if (candidateAtMs < runtime.feedbackResultAtMs) return false;
      if (candidateAtMs === runtime.feedbackResultAtMs && candidateKey === runtime.feedbackResultKey) return false;
      const currentStage = Number(runtime.feedbackResult.stage || 0);
      const candidateStage = Number(candidate.stage || 0);
      if (candidateStage < currentStage && candidateAtMs <= runtime.feedbackResultAtMs) return false;
    }
    runtime.feedbackResult = { ...candidate };
    runtime.feedbackResultAtMs = candidateAtMs;
    runtime.feedbackResultKey = candidateKey;
    runtime.feedbackFresh = true;
    return true;
  }
  // SAFE_CRACKER_FEEDBACK_LATCH_END

  // SAFE_CRACKER_HUD_V3_START
  function feedbackMeter(tier = '') {
    const order = ['red', 'orange', 'yellow', 'green'];
    const level = order.indexOf(String(tier || ''));
    return '<div class="sc-feedback-meter" aria-hidden="true">' + order.map((value, index) => '<i class="' + value + (index <= level ? ' lit' : '') + (value === tier ? ' active' : '') + '"></i>').join('') + '</div>';
  }

  function progressLights(progress = {}) {
    const stage = Math.max(0, Math.min(STAGES, Number(progress.stage || 0)));
    return Array.from({ length: STAGES }, (_, index) => {
      const state = index < stage ? 'locked' : index === stage && stage < STAGES ? 'active' : 'pending';
      const label = state === 'locked' ? 'SEALED' : state === 'active' ? 'ACTIVE' : 'LOCKED';
      return '<span class="sc-stage-light ' + state + '" aria-label="Tumbler ' + (index + 1) + ': ' + label + '"><i class="sc-stage-bolt"></i><b>' + (index + 1) + '</b><em>' + label + '</em></span>';
    }).join('');
  }
  // SAFE_CRACKER_HUD_V3_END

  function attemptRows(attempts = [], currentStage = 0) {
    const rows = attempts.filter(attempt => Number(attempt.stage || 0) === Number(currentStage)).slice(-5).reverse();
    if (!rows.length) return '<div class="sc-attempt-empty">No attempts on this tumbler yet.</div>';
    return rows.map(attempt => `<div class="sc-attempt-row ${escapeHtml(attempt.tier || '')}"><span>${escapeHtml(attempt.guess)}</span><b>${escapeHtml(tierLabel(attempt.tier))}</b></div>`).join('');
  }

  function dialNumbers() {
    return Array.from({ length: 10 }, (_, digit) => {
      const angle = digit * DETENT_DEGREES;
      return `<span class="sc-dial-number${digit === runtime.selected ? ' selected' : ''}" data-sc-digit="${digit}" style="--digit-angle:${angle}deg"><span>${digit}</span></span>`;
    }).join('');
  }

  function funnyLoss(gameId) {
    let hash = 0;
    for (const character of String(gameId || 'safe')) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
    return funnyLosses[Math.abs(hash) % funnyLosses.length];
  }

  // SAFE_CRACKER_SEQUENCE_V4_START
  function playCountdownBeat(label, game = runtime.game) {
    const cleanLabel = String(label || '');
    const key = String(game?.gameId || '') + ':' + cleanLabel;
    if (!cleanLabel || runtime.countdownSoundKey === key) return;
    runtime.countdownSoundKey = key;
    if (cleanLabel === 'GO!') {
      playTone(112, .12, .065, 'square');
      playTone(330, .18, .052, 'triangle', .045);
      playTone(660, .22, .035, 'sine', .105);
      navigator.vibrate?.([18, 22, 34]);
      return;
    }
    const step = Math.max(1, Math.min(3, Number(cleanLabel) || 1));
    playTone(104 + step * 18, .09, .048, 'square');
    playTone(46 + step * 5, .13, .04, 'triangle', .018);
    navigator.vibrate?.(10 + step * 2);
  }

  function resultVaultMechanism() {
    return '<div class="sc-result-vault" aria-hidden="true">' +
      '<div class="sc-result-vault-well"><i></i></div>' +
      '<div class="sc-result-door">' +
        '<div class="sc-result-door-rim"></div>' +
        '<div class="sc-result-door-bolts"><i></i><i></i><i></i><i></i></div>' +
        '<div class="sc-result-door-wheel"><i></i><i></i><i></i></div>' +
        '<div class="sc-result-door-signal"></div>' +
      '</div>' +
      '<div class="sc-result-vault-light"></div>' +
    '</div>';
  }
  // SAFE_CRACKER_SEQUENCE_V4_END

  // SAFE_CRACKER_VISUAL_STABILITY_V5_START
  function lockedCode(progress = {}) {
    const attempts = Array.isArray(progress?.attempts) ? progress.attempts : [];
    const solved = new Map();
    for (const attempt of attempts) {
      if (!(attempt?.correct || String(attempt?.tier || '') === 'green')) continue;
      const stage = Math.max(0, Math.min(STAGES - 1, Number(attempt.stage || 0)));
      solved.set(stage, Math.max(0, Math.min(9, Number(attempt.guess || 0))));
    }
    const slots = Array.from({ length: STAGES }, (_, index) => solved.has(index)
      ? '<span class="known" aria-label="Tumbler ' + (index + 1) + ' locked at ' + solved.get(index) + '">' + solved.get(index) + '</span>'
      : '<span aria-label="Tumbler ' + (index + 1) + ' not locked">•</span>').join('');
    return '<div class="sc-known-code"><small>LOCKED CODE</small><div>' + slots + '</div></div>';
  }
  // SAFE_CRACKER_VISUAL_STABILITY_V5_END

  // SAFE_CRACKER_VIEWPORT_FIT_V7_START
  function mountCountdownPortal(game, mount) {
    const active = String(game?.status || '') === 'countdown';
    const fresh = mount?.querySelector('[data-sc-start-countdown]') || null;
    const existing = document.querySelector('body > [data-sc-start-countdown][data-sc-countdown-portal]');
    if (!active || !fresh) {
      existing?.remove();
      runtime.countdownPortalGameId = '';
      return;
    }
    const gameId = String(game?.gameId || '');
    const syncCountdown = (target, source) => {
      target.dataset.scCountdownLabel = source.dataset.scCountdownLabel || '';
      const sourceValue = source.querySelector('[data-sc-countdown-value]');
      const targetValue = target.querySelector('[data-sc-countdown-value]');
      if (sourceValue && targetValue) {
        targetValue.textContent = sourceValue.textContent;
        targetValue.className = sourceValue.className;
      }
      const sourceStatus = source.querySelector('[data-sc-countdown-status]');
      const targetStatus = target.querySelector('[data-sc-countdown-status]');
      if (sourceStatus && targetStatus) targetStatus.textContent = sourceStatus.textContent;
    };
    if (existing) {
      syncCountdown(existing, fresh);
      fresh.remove();
      runtime.countdownPortalGameId = gameId;
      return;
    }
    fresh.setAttribute('data-sc-countdown-portal', '');
    document.body.appendChild(fresh);
    runtime.countdownPortalGameId = gameId;
  }
  // SAFE_CRACKER_VIEWPORT_FIT_V7_END

  // SAFE_CRACKER_RESULT_FLOW_V5_START
  // SAFE_CRACKER_FINAL_POLISH_V6_START
  function playSafeCrackerResultSequence(game, won, tied) {
    const gameId = String(game?.gameId || '');
    const key = gameId + ':' + (won ? 'win' : tied ? 'tie' : 'lose');
    if (!gameId || runtime.resultSequenceAudioKey === key) return;
    runtime.resultSequenceAudioKey = key;
    if (won) {
      playTone(76, .12, .065, 'square', .05);
      playTone(112, .1, .052, 'square', .17);
      playTone(178, .28, .03, 'sawtooth', .31);
      playTone(286, .38, .035, 'triangle', .47);
      playTone(440, .46, .032, 'sine', .56);
      navigator.vibrate?.([18, 38, 18, 62, 34]);
      window.setTimeout(() => playResult(true, false), 480);
      return;
    }
    if (tied) {
      playTone(138, .17, .045, 'square', .05);
      playTone(210, .24, .026, 'triangle', .16);
      navigator.vibrate?.([14, 42, 14]);
      window.setTimeout(() => playResult(false, true), 160);
      return;
    }
    playTone(92, .16, .052, 'square', .04);
    playTone(62, .31, .05, 'sawtooth', .15);
    navigator.vibrate?.([24, 30, 16]);
    window.setTimeout(() => playResult(false, false), 150);
  }

  function revealSafeCrackerResultPortal(portal, won) {
    if (!portal?.isConnected) return;
    portal.classList.remove('sc-result-portal-pending');
    portal.classList.add('sc-result-portal-ready');
    portal.setAttribute('role', 'dialog');
    portal.setAttribute('aria-modal', 'true');
    portal.setAttribute('aria-label', won ? 'Safe Cracker win result' : 'Safe Cracker result');
    document.body.classList.add('sc-result-portal-open');
    document.body.classList.toggle('sc-result-win-open', Boolean(won));
    const card = portal.querySelector('.sc-result-card');
    if (!card) return;
    card.setAttribute('tabindex', '-1');
    if (runtime.resultPortalFocusTimer) window.clearTimeout(runtime.resultPortalFocusTimer);
    runtime.resultPortalFocusTimer = window.setTimeout(() => {
      try { card.focus({ preventScroll: true }); } catch { card.focus(); }
      runtime.resultPortalFocusTimer = 0;
    }, 70);
  }

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const portal = document.querySelector('body > [data-sc-result-sequence][data-sc-result-portal].sc-result-portal-ready');
    if (!portal) return;
    portal.querySelector('.duel-end-screen-close')?.click();
  }, true);

  const safeCrackerResultPortalObserver = new MutationObserver(() => {
    const portal = document.querySelector('body > [data-sc-result-sequence][data-sc-result-portal]');
    if (!portal) return;
    const mount = document.querySelector('[data-safe-cracker-mount]');
    if (!mount || !mount.isConnected) {
      clearSafeCrackerResultPortal();
      return;
    }
    const hiddenHost = mount.closest('[hidden], [aria-hidden="true"]');
    const style = window.getComputedStyle(mount);
    if (hiddenHost || style.display === 'none' || style.visibility === 'hidden') clearSafeCrackerResultPortal();
  });
  safeCrackerResultPortalObserver.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'aria-hidden'] });
  // SAFE_CRACKER_FINAL_POLISH_V6_END

  function clearSafeCrackerResultPortal() {
    if (runtime.resultPortalTimer) window.clearTimeout(runtime.resultPortalTimer);
    if (runtime.resultPortalFocusTimer) window.clearTimeout(runtime.resultPortalFocusTimer);
    runtime.resultPortalTimer = 0;
    runtime.resultPortalFocusTimer = 0;
    document.querySelector('body > [data-sc-result-sequence][data-sc-result-portal]')?.remove();
    document.body.classList.remove('sc-result-portal-open', 'sc-result-win-open');
    runtime.resultPortalGameId = '';
    runtime.resultSequenceStartedAt = 0;
  }

  function mountSafeCrackerResultPortal(game, mount) {
    const complete = String(game?.status || '') === 'complete';
    const fresh = mount?.querySelector('[data-sc-result-sequence]') || null;
    const existing = document.querySelector('body > [data-sc-result-sequence][data-sc-result-portal]');
    if (!complete) {
      clearSafeCrackerResultPortal();
      return;
    }
    if (!fresh) return;
    const gameId = String(game?.gameId || '');
    const myUserId = String(game?.isCreator ? game?.creator?.userId : game?.joiner?.userId || '');
    const won = Boolean(game?.winnerUserId && String(game.winnerUserId) === myUserId);
    const tied = Boolean(game?.tie);
    const sameSequence = runtime.resultPortalGameId === gameId && runtime.resultSequenceStartedAt > 0;
    if (!sameSequence) {
      runtime.resultPortalGameId = gameId;
      runtime.resultSequenceStartedAt = performance.now();
      playSafeCrackerResultSequence(game, won, tied);
    }
    const elapsed = Math.max(0, performance.now() - runtime.resultSequenceStartedAt);
    const shell = mount?.querySelector('.sc-safe-shell');
    if (shell) {
      shell.classList.add(won ? 'sc-gameplay-win' : tied ? 'sc-gameplay-tie' : 'sc-gameplay-lose');
      shell.style.setProperty('--sc-result-animation-delay', '-' + Math.min(elapsed, 1200) + 'ms');
    }
    if (existing) {
      fresh.remove();
      if (existing.classList.contains('sc-result-portal-ready')) { document.body.classList.add('sc-result-portal-open'); document.body.classList.toggle('sc-result-win-open', existing.classList.contains('win')); }
      return;
    }
    fresh.setAttribute('data-sc-result-portal', '');
    fresh.setAttribute('data-sc-result-game-id', gameId);
    fresh.setAttribute('aria-live', 'polite');
    fresh.classList.add('sc-result-portal-pending');
    document.body.appendChild(fresh);
    const reducedMotion = Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
    const revealDelay = reducedMotion ? 0 : won ? 1180 : tied ? 420 : 520;
    const remaining = Math.max(0, revealDelay - elapsed);
    if (runtime.resultPortalTimer) window.clearTimeout(runtime.resultPortalTimer);
    runtime.resultPortalTimer = window.setTimeout(() => {
      revealSafeCrackerResultPortal(fresh, won);
      runtime.resultPortalTimer = 0;
    }, remaining);
  }
  // SAFE_CRACKER_RESULT_FLOW_V5_END

  // SAFE_CRACKER_VIDEO_CORRECTION_V8_START
  function safeCrackerCountdownRank(label) {
    if (label === '3') return 0;
    if (label === '2') return 1;
    if (label === '1') return 2;
    if (label === 'GO!') return 3;
    return -1;
  }

  function safeCrackerMonotonicCountdownLabel(game = runtime.game) {
    const gameId = String(game?.gameId || '');
    const startAt = String(game?.startAt || stateFor(game)?.startAt || '');
    const key = gameId + ':' + startAt;
    const status = String(game?.status || '');
    if (runtime.countdownProgressKey !== key) {
      runtime.countdownProgressKey = key;
      runtime.countdownProgressRank = -1;
      runtime.countdownProgressLabel = '';
    }
    if (status !== 'countdown' && status !== 'playing') {
      runtime.countdownProgressRank = -1;
      runtime.countdownProgressLabel = '';
      return '';
    }
    const proposed = safeCrackerStartCountdownLabel(game);
    if (!proposed) {
      if (status === 'countdown' && runtime.countdownProgressLabel) return runtime.countdownProgressLabel;
      if (status === 'playing') {
        runtime.countdownProgressRank = 4;
        runtime.countdownProgressLabel = '';
      }
      return '';
    }
    const proposedRank = safeCrackerCountdownRank(proposed);
    if (proposedRank < runtime.countdownProgressRank) return runtime.countdownProgressLabel;
    runtime.countdownProgressRank = proposedRank;
    runtime.countdownProgressLabel = proposed;
    return proposed;
  }
  // SAFE_CRACKER_VIDEO_CORRECTION_V8_END

  // SAFE_CRACKER_INPUT_CONTINUITY_V9_START
  function safeCrackerResetLocalCooldown() {
    if (runtime.cooldownReleaseTimer) window.clearTimeout(runtime.cooldownReleaseTimer);
    runtime.cooldownReleaseTimer = 0;
    runtime.cooldownGameId = '';
    runtime.cooldownUntilMs = 0;
  }

  function safeCrackerLocalCooldownReleased(game = runtime.game) {
    const gameId = String(game?.gameId || '');
    return Boolean(
      gameId &&
      runtime.cooldownGameId === gameId &&
      runtime.cooldownUntilMs > 0 &&
      Date.now() >= runtime.cooldownUntilMs
    );
  }

  function safeCrackerCooldownActive(game = runtime.game) {
    const gameId = String(game?.gameId || '');
    if (gameId && runtime.cooldownGameId === gameId && runtime.cooldownUntilMs > 0) {
      return Date.now() < runtime.cooldownUntilMs;
    }
    return Number(stateFor(game)?.cooldownMs || 0) > 0;
  }

  function safeCrackerCanSubmit(game = runtime.game) {
    const state = stateFor(game);
    const me = myState(game);
    const serverReady = Boolean(state?.canSubmit);
    const locallyReleased = safeCrackerLocalCooldownReleased(game);
    return Boolean(
      game?.status === 'playing' &&
      !runtime.busy &&
      Number(me?.stage || 0) < STAGES &&
      (serverReady || locallyReleased)
    );
  }

  function safeCrackerUpdateConfirmControl() {
    const button = document.querySelector('[data-sc-confirm]');
    if (!button || !runtime.game) return;
    const game = runtime.game;
    const available = safeCrackerCanSubmit(game);
    const cooling = safeCrackerCooldownActive(game);
    const label = button.querySelector('span');
    button.disabled = !available;
    button.classList.toggle('busy', runtime.busy);
    if (!label) return;
    label.textContent = runtime.busy
      ? 'CHECKING…'
      : game.status === 'countdown'
        ? 'LOCKED'
        : game.status === 'complete'
          ? 'COMPLETE'
          : cooling
            ? 'CHECK NUMBER'
            : available
              ? 'CHECK NUMBER'
              : 'WAITING';
  }

  function safeCrackerArmLocalCooldown(game, cooldownMs) {
    const gameId = String(game?.gameId || '');
    if (!gameId) return;
    if (runtime.cooldownReleaseTimer) window.clearTimeout(runtime.cooldownReleaseTimer);
    const remaining = Math.max(0, Number(cooldownMs || 0));
    runtime.cooldownGameId = gameId;
    runtime.cooldownUntilMs = Date.now() + remaining + 90;
    runtime.cooldownReleaseTimer = window.setTimeout(() => {
      runtime.cooldownReleaseTimer = 0;
      if (runtime.cooldownGameId !== gameId) return;
      safeCrackerUpdateConfirmControl();
      // Refresh in the background for opponent progress, but local input no longer
      // waits for this request to finish before becoming usable again.
      window.__safeCrackerBridge?.refresh?.();
    }, remaining + 95);
  }
  // SAFE_CRACKER_INPUT_CONTINUITY_V9_END

  function resultOverlay(game) {
    if (game?.status !== 'complete') return '';
    const state = stateFor(game);
    const myUserId = String(game.isCreator ? game.creator?.userId : game.joiner?.userId || '');
    const won = Boolean(game.winnerUserId && String(game.winnerUserId) === myUserId);
    const tied = Boolean(game.tie);
    // Result audio is synchronized with the physical safe-opening sequence.
    const resultClass = won ? 'win' : tied ? 'tie' : 'lose';
    const title = tied ? 'VAULT LOCKDOWN' : won ? 'SAFE CRACKED!' : 'YOU LOSE';
    const accessLabel = tied ? 'SEQUENCE EXPIRED' : won ? 'ACCESS GRANTED' : 'ACCESS DENIED';
    const message = tied
      ? 'Neither safe opened before time expired. Both wagers were returned.'
      : won
        ? `You opened your safe first and won ${Number(game.payout || 0).toLocaleString('en-US')} Chips.`
        : funnyLoss(game.gameId);
    const reveal = state.revealedCodes || {};
    const me = game.isCreator ? game.creator : game.joiner;
    const opponent = game.isCreator ? game.joiner : game.creator;
    const comparisonCard = (label, player, progress, code, winner) => {
      const digits = /^[0-9]{3}$/.test(String(code || '')) ? String(code).split('') : ['—','—','—'];
      const stage = Math.max(0, Math.min(STAGES, Number(progress?.stage || 0)));
      const attempts = Math.max(0, Number(progress?.attemptCount || 0));
      return '<section class="sc-result-player' + (winner ? ' winner' : '') + '">' +
        '<div class="sc-result-player-label">' + label + (winner ? '<em>WINNER</em>' : '') + '</div>' +
        '<h3>' + escapeHtml(player?.name || 'Player') + '</h3>' +
        '<div class="sc-result-code" aria-label="' + label + ' code ' + escapeHtml(code || 'unavailable') + '">' + digits.map(digit => '<b>' + digit + '</b>').join('') + '</div>' +
        '<dl><div><dt>Locks opened</dt><dd>' + stage + ' / ' + STAGES + '</dd></div><div><dt>Attempts</dt><dd>' + attempts + '</dd></div></dl></section>';
    };
    const codes = '<div class="sc-code-reveal">' +
      comparisonCard('YOUR SAFE', me, state.me, reveal.my, won && !tied) +
      comparisonCard('OPPONENT', opponent, state.opponent, reveal.opponent, !won && !tied && Boolean(game.winnerUserId)) + '</div>';
    return '<div class="sc-result-overlay ' + resultClass + '" data-sc-result-sequence>' +
      '<div class="sc-result-card">' +
        resultVaultMechanism() +
        '<div class="sc-result-content">' +
          '<div class="sc-result-heading">' +
          '<div class="sc-result-seal" aria-hidden="true"><svg viewBox="0 0 64 64"><rect x="9" y="6" width="46" height="52" rx="5"/><circle cx="32" cy="30" r="13"/><circle cx="32" cy="30" r="4"/><path d="M32 17v9m0 8v9M19 30h9m8 0h9M15 14v6m0 26v5"/></svg></div>' +
          '<div class="sc-result-kicker">SAFE CRACKER · ' + accessLabel + '</div>' +
          '<h2>' + title + '</h2>' +
          '<p>' + escapeHtml(message) + '</p>' +
          '</div><div class="sc-result-summary"><div class="sc-result-summary-title">THE VAULT REPORT <span>FINAL COMBINATIONS</span></div>' +
          codes +
          '</div>' +
          '<div class="sc-result-actions">' +
            '<button class="gold" data-sc-rematch type="button">Rematch</button>' +
            '<button class="secondary" data-sc-new-game type="button">Create a New Game</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  // SAFE_CRACKER_LATCH_SEQUENCE_V1_HELPER
  function safeCrackerLatchMount(latchClass = '') {
    return `<span class="sc-latch-mount"><b class="sc-latch-spine" aria-hidden="true"></b><em class="sc-latch-screw" aria-hidden="true"></em><i class="${latchClass}"></i></span>`;
  }

  function safeCrackerStaticLatchBank(side) {
    return `<div class="sc-bolts ${side}" data-sc-mounted-latches="true">${safeCrackerLatchMount()}${safeCrackerLatchMount()}${safeCrackerLatchMount()}</div>`;
  }

  function safeCrackerLatchBank(game, me) {
    const latchGameId = String(game?.gameId || '');
    const latchStage = Math.max(0, Math.min(STAGES, Number(me?.stage || 0)));
    const releasingLatch = runtime.latchGameId === latchGameId && latchStage > runtime.latchStage
      ? latchStage
      : 0;
    runtime.latchGameId = latchGameId;
    runtime.latchStage = latchStage;
    const latchClass = index => [
      latchStage >= index ? 'sc-latch-released' : '',
      releasingLatch === index ? 'sc-latch-releasing' : ''
    ].filter(Boolean).join(' ');
    return `<div class="sc-bolts right" data-sc-latch-stage="${latchStage}" data-sc-mounted-latches="true">${safeCrackerLatchMount(latchClass(1))}${safeCrackerLatchMount(latchClass(2))}${safeCrackerLatchMount(latchClass(3))}</div>`;
  }

  // SAFE_CRACKER_RENDER_STABILITY_V1_START
  function safeCrackerReplaceMarkup(element, markup) {
    if (!element || !markup) return element;
    const template = document.createElement('template');
    template.innerHTML = String(markup).trim();
    const replacement = template.content.firstElementChild;
    if (!replacement) return element;
    element.replaceWith(replacement);
    return replacement;
  }

  function safeCrackerSetText(element, value) {
    if (!element) return;
    const next = String(value ?? '');
    if (element.textContent !== next) element.textContent = next;
  }

  function safeCrackerUpdateMountedBoard(game) {
    const mount = document.querySelector('[data-safe-cracker-mount]');
    const root = mount?.firstElementChild?.matches?.('.safe-cracker-game')
      ? mount.firstElementChild
      : mount?.querySelector?.('.safe-cracker-game');
    const gameId = String(game?.gameId || '');
    const mountedGameId = String(root?.dataset?.scGameId || '');
    const status = String(game?.status || '');
    const mountedStatus = String(root?.dataset?.scStatus || '');

    // Keep the already-painted, decoded dial and display DOM only while the same
    // active board remains in the playing lifecycle. Countdown and terminal
    // transitions still receive a clean full render and fresh event bindings.
    if (!root || !gameId || mountedGameId !== gameId || status !== 'playing' || mountedStatus !== 'playing') return false;

    const me = myState(game);
    const opponent = opponentState(game);
    const stage = Math.max(0, Math.min(STAGES, Number(me?.stage || 0)));
    const latest = runtime.feedbackResult || me?.lastResult || null;
    const displayTier = String(latest?.tier || 'idle');
    const displayText = latest ? tierLabel(latest.tier) : 'TURN THE DIAL';
    const attemptCount = Number(me?.attemptCount || 0);

    root.dataset.scStatus = status;
    root.classList.add('sc-stable-render');

    const meLights = root.querySelector('.sc-player-card.me .sc-progress-lights');
    if (meLights) meLights.innerHTML = progressLights(me);
    const opponentLights = root.querySelector('.sc-player-card.opponent .sc-progress-lights');
    if (opponentLights) opponentLights.innerHTML = progressLights(opponent);

    const playerCopy = root.querySelector('.sc-player-card.me .sc-player-copy');
    const existingCode = playerCopy?.querySelector('.sc-known-code');
    if (existingCode) {
      safeCrackerReplaceMarkup(existingCode, lockedCode(me));
    } else {
      playerCopy?.querySelector('.sc-progress-lights')?.insertAdjacentHTML('beforebegin', lockedCode(me));
    }

    const display = root.querySelector('[data-sc-display]');
    if (display) {
      for (const tier of ['idle', 'red', 'orange', 'yellow', 'green', 'fresh']) display.classList.remove(tier);
      display.classList.add(displayTier);
      if (runtime.feedbackFresh) {
        void display.offsetWidth;
        display.classList.add('fresh');
      }
      safeCrackerSetText(display.querySelector('.sc-display-status'), displayText);
      safeCrackerSetText(display.querySelector('.sc-display-meta small'), 'TUMBLER ' + Math.min(STAGES, stage + 1) + ' OF ' + STAGES);
      safeCrackerSetText(display.querySelector('.sc-display-meta b'), attemptCount + ' ' + (attemptCount === 1 ? 'ATTEMPT' : 'ATTEMPTS'));
      const meter = display.querySelector('.sc-feedback-meter');
      if (meter) safeCrackerReplaceMarkup(meter, feedbackMeter(displayTier));
    }

    const previousLatchStage = runtime.latchGameId === gameId
      ? Math.max(0, Math.min(STAGES, Number(runtime.latchStage || 0)))
      : 0;
    const releasingLatch = stage > previousLatchStage ? stage : 0;
    root.querySelectorAll('.sc-bolts.right .sc-latch-mount > i').forEach((latch, index) => {
      const latchNumber = index + 1;
      latch.classList.remove('sc-latch-releasing');
      latch.classList.toggle('sc-latch-released', stage >= latchNumber);
      if (releasingLatch === latchNumber) {
        void latch.offsetWidth;
        latch.classList.add('sc-latch-releasing');
      }
    });
    runtime.latchGameId = gameId;
    runtime.latchStage = stage;

    root.querySelector('.sc-safe-shell')?.classList.toggle('open', stage >= STAGES);

    const attemptPanel = root.querySelector('.sc-attempt-panel');
    if (attemptPanel) {
      safeCrackerSetText(attemptPanel.querySelector('h3 span'), 'TUMBLER ' + Math.min(STAGES, stage + 1) + ' LOG');
      safeCrackerSetText(attemptPanel.querySelector('h3 b'), attemptCount + ' TOTAL');
      const attemptList = attemptPanel.querySelector('.sc-attempt-list');
      if (attemptList) attemptList.innerHTML = attemptRows(me?.attempts || [], stage);
    }

    applyDialVisual();
    safeCrackerUpdateConfirmControl();
    return true;
  }
  // SAFE_CRACKER_RENDER_STABILITY_V1_END

  function render(game) {
    const incomingGameId = String(game?.gameId || '');
    if (runtime.cooldownGameId && runtime.cooldownGameId !== incomingGameId) safeCrackerResetLocalCooldown();
    if (game?.status === 'complete') safeCrackerResetLocalCooldown();
    runtime.game = game;
    adoptSubmittedFeedback(game);
    updateClock(game);
    const mount = document.querySelector('[data-safe-cracker-mount]');
    if (!mount) return;

    const state = stateFor(game);
    const me = myState(game);
    const opponent = opponentState(game);
    const nextStageKey = stageKey(game);
    const stageChanged = runtime.stageKey !== nextStageKey;
    const visualGameId = String(game?.gameId || '');
    const visualStatus = String(game?.status || '');
    const stableVisual = runtime.visualGameId === visualGameId && runtime.visualStatus === visualStatus;
    runtime.visualGameId = visualGameId;
    runtime.visualStatus = visualStatus;
    if (stageChanged) {
      runtime.stageKey = nextStageKey;
      runtime.selected = 0;
      runtime.rotation = nearestRotationForDigit(0, runtime.rotation);
      runtime.lastDetent = 0;
      runtime.busy = false;
    }

    const latest = runtime.feedbackResult || null;
    const feedbackFresh = Boolean(runtime.feedbackFresh);
    const canSubmit = safeCrackerCanSubmit(game);
    const cooldownActive = safeCrackerCooldownActive(game);
    const confirmLabel = runtime.busy
      ? 'CHECKING…'
      : game.status === 'countdown'
        ? 'LOCKED'
        : game.status === 'complete'
          ? 'COMPLETE'
          : cooldownActive
            ? 'CHECK NUMBER'
            : canSubmit
              ? 'CHECK NUMBER'
              : 'WAITING';
    const displayTier = latest?.tier || 'idle';
    const displayText = latest ? tierLabel(latest.tier) : game.status === 'countdown' ? 'GET READY' : game.status === 'ready' ? 'READY TO CRACK' : game.status === 'waiting' ? 'AWAITING RIVAL' : 'TURN THE DIAL';
    const startCountdownLabel = safeCrackerMonotonicCountdownLabel(game);
    const opponentName = game.isCreator ? game.joiner?.name : game.creator?.name;
    const opponentPlayer = game.isCreator ? game.joiner : game.creator;
    const myPlayer = game.isCreator ? game.creator : game.joiner;

    const reusedMountedBoard = safeCrackerUpdateMountedBoard(game);
    if (!reusedMountedBoard) mount.innerHTML = `<section class="safe-cracker-game${stableVisual ? ' sc-stable-render' : ''}" data-sc-game-id="${escapeHtml(game.gameId || '')}" data-sc-status="${escapeHtml(game.status || '')}">
      ${startCountdownLabel ? `<div class="sc-start-countdown-overlay" data-sc-start-countdown data-sc-countdown-label="${escapeHtml(startCountdownLabel)}">
        <div class="sc-countdown-vault" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><div class="sc-countdown-ring"></div></div>
        <div class="sc-countdown-copy"><small>VAULT SEQUENCE</small><span data-sc-countdown-value class="${startCountdownLabel === 'GO!' ? 'go' : ''}">${escapeHtml(startCountdownLabel)}</span><b data-sc-countdown-status>${startCountdownLabel === 'GO!' ? 'DIAL ACTIVE' : 'LOCKS ENGAGING'}</b></div>
      </div>` : ''}
      <header class="sc-command-bar"><div><small>XAN DUELS</small><h2>SAFE CRACKER</h2></div><div class="sc-prize"><small>PRIZE POT</small><b>${Math.max(0, Number(game.pot || game.wager || 0)).toLocaleString()} Chips</b></div></header>
      <section class="sc-instructions" aria-label="How to play"><div><small>VAULT BREAK-IN</small><b>Three locks. Sixty seconds.</b></div><ol><li><i>1</i><span><b>Turn the dial</b><small>Choose a number</small></span></li><li><i>2</i><span><b>Check the lights</b><small>Decide which direction to go!</small></span></li><li><i>3</i><span><b>Unlock all three</b><small>First safe open wins</small></span></li></ol></section>
      <div class="sc-topbar">
        <div class="sc-player-card me"><div class="sc-avatar">${playerAvatar(myPlayer, 'Y')}</div><div class="sc-player-copy"><small>YOU</small><b>${escapeHtml(myPlayer?.name || 'Player')}</b>${lockedCode(me)}<div class="sc-progress-lights">${progressLights(me)}</div></div></div>
        <div class="sc-timer" data-sc-timer>${formatTimer(secondsLeft(game))}</div>
        <div class="sc-player-card opponent"><div class="sc-player-copy"><small>OPPONENT</small><b>${escapeHtml(opponentName || 'Waiting')}</b><div class="sc-progress-lights">${progressLights(opponent)}</div></div><div class="sc-avatar">${playerAvatar(opponentPlayer, 'O')}</div></div>
      </div>

      <div class="sc-safe-shell ${Number(me.stage || 0) >= STAGES ? 'open' : ''}">
        <div class="sc-safe-door">
          <div class="sc-door-screws" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
          ${safeCrackerStaticLatchBank('left')}
          ${safeCrackerLatchBank(game, me)}
          <div class="sc-display ${escapeHtml(displayTier)}${feedbackFresh ? ' fresh' : ''}" data-sc-display>
            <div class="sc-display-bezel" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
            <div class="sc-display-glass">
              <span class="sc-display-status">${escapeHtml(displayText)}</span>
              <div class="sc-display-meta"><small>TUMBLER ${Math.min(STAGES, Number(me.stage || 0) + 1)} OF ${STAGES}</small><b>${Number(me.attemptCount || 0)} ${Number(me.attemptCount || 0) === 1 ? 'ATTEMPT' : 'ATTEMPTS'}</b></div>
              ${feedbackMeter(displayTier)}
            </div>
          </div>
          <div class="sc-dial-wrap">
            <div class="sc-dial-pointer" aria-hidden="true"></div>
            <div class="sc-dial" role="slider" tabindex="${game.status === 'playing' ? 0 : -1}" aria-disabled="${game.status !== 'playing'}" aria-label="Safe dial" aria-valuemin="0" aria-valuemax="9" aria-valuenow="${runtime.selected}" data-sc-dial>
              <div class="sc-dial-face" data-sc-dial-face style="transform:rotate(${runtime.rotation}deg)"><img class="sc-dial-reference-plate" src="/assets/safe-cracker/textures/dial-reference-face-v7.svg?dial=7&layout=7" alt="" aria-hidden="true" draggable="false">${dialNumbers()}<div class="sc-dial-hub"></div></div>
            </div>
            <div class="sc-current-number" data-sc-current>${runtime.selected}</div>
          </div>
          <div class="sc-step-controls"><button type="button" data-sc-step="-1" ${game.status === 'playing' ? '' : 'disabled'} aria-label="Previous number">−</button><button type="button" data-sc-step="1" ${game.status === 'playing' ? '' : 'disabled'} aria-label="Next number">+</button></div>
          <button class="sc-confirm-button" type="button" data-sc-confirm ${canSubmit ? '' : 'disabled'}><span>${confirmLabel}</span></button>
          <div class="sc-safe-handle"><span></span></div>
        </div>
      </div>
      <aside class="sc-tip-bar"><b>TIP</b><span>Red → orange → yellow → green. Use the lights to decide your next move.</span></aside>
      ${resultOverlay(game)}
    </section>`;

    runtime.feedbackFresh = false;
    mountCountdownPortal(game, mount);
    if (!reusedMountedBoard) bindControls(mount, game);
    mountSafeCrackerResultPortal(game, mount);
    updateTimerOnly();
  }

  // SAFE_CRACKER_DIAL_PHYSICS_V2_START
  function cancelDialSettle() {
    const animation = runtime.dialSettleAnimation;
    runtime.dialSettleAnimation = null;
    try { animation?.cancel?.(); } catch {}
    document.querySelector('[data-sc-dial-face]')?.classList.remove('settling');
  }

  function animateDialSettle(fromRotation, toRotation, direction = 0) {
    const face = document.querySelector('[data-sc-dial-face]');
    if (!face || !Number.isFinite(fromRotation) || !Number.isFinite(toRotation)) return;
    cancelDialSettle();
    face.style.transform = `rotate(${toRotation}deg)`;
    if (Math.abs(toRotation - fromRotation) < .05 || typeof face.animate !== 'function' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const travel = toRotation - fromRotation;
    const motionDirection = Number(direction) || Math.sign(travel) || 1;
    const overshoot = motionDirection * Math.min(5.5, Math.max(2, Math.abs(travel) * .12));
    face.classList.add('settling');
    const animation = face.animate([
      { transform: `rotate(${fromRotation}deg)`, offset: 0 },
      { transform: `rotate(${toRotation + overshoot}deg)`, offset: .72 },
      { transform: `rotate(${toRotation}deg)`, offset: 1 }
    ], { duration: 240, easing: 'cubic-bezier(.18,.78,.22,1)' });
    runtime.dialSettleAnimation = animation;
    const cleanup = () => {
      if (runtime.dialSettleAnimation === animation) runtime.dialSettleAnimation = null;
      face.classList.remove('settling');
      face.style.transform = `rotate(${toRotation}deg)`;
    };
    animation.addEventListener('finish', cleanup, { once: true });
    animation.addEventListener('cancel', cleanup, { once: true });
  }
  // SAFE_CRACKER_DIAL_PHYSICS_V2_END
  function applyDialVisual() {
    const face = document.querySelector('[data-sc-dial-face]');
    const current = document.querySelector('[data-sc-current]');
    const dial = document.querySelector('[data-sc-dial]');
    if (face) face.style.transform = `rotate(${runtime.rotation}deg)`;
    if (current) current.textContent = String(runtime.selected);
    document.querySelectorAll('[data-sc-digit]').forEach(number => {
      number.classList.toggle('selected', Number(number.dataset.scDigit) === Number(runtime.selected));
    });
    if (dial) {
      dial.setAttribute('aria-valuenow', String(runtime.selected));
      dial.setAttribute('aria-valuetext', `Number ${runtime.selected}`);
    }
  }

  function setSelected(digit, { sound = true } = {}) {
    const next = modulo(Number(digit) || 0, 10);
    const previousRotation = runtime.rotation;
    runtime.selected = next;
    runtime.rotation = nearestRotationForDigit(next, runtime.rotation);
    runtime.lastDetent = next;
    applyDialVisual();
    animateDialSettle(previousRotation, runtime.rotation, Math.sign(runtime.rotation - previousRotation));
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
        cancelDialSettle();
        runtime.lastDragDirection = 0;
        runtime.dragging = true;
        // SAFE_CRACKER_DIAL_ACTIVITY_V16_START
        const safeCrackerDialInteractionStartedAt = Date.now();
        window.__safeCrackerDialInteractionV16 = {
          gameId: String(game?.gameId || runtime.game?.gameId || ''),
          pointerId: event.pointerId,
          active: true,
          pointerDown: true,
          startedAt: safeCrackerDialInteractionStartedAt,
          lastActivityAt: safeCrackerDialInteractionStartedAt,
          releasedAt: 0,
          expiresAt: safeCrackerDialInteractionStartedAt + 12000
        };
        window.__safeCrackerDialInteractionStarts =
          Number(window.__safeCrackerDialInteractionStarts || 0) + 1;
        // SAFE_CRACKER_DIAL_ACTIVITY_V16_END
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
        if (
          window.__safeCrackerDialInteractionV16 &&
          String(window.__safeCrackerDialInteractionV16.gameId || '') === String(game?.gameId || '')
        ) {
          const safeCrackerDialActivityAt = Date.now();
          window.__safeCrackerDialInteractionV16.active = true;
          window.__safeCrackerDialInteractionV16.pointerDown = true;
          window.__safeCrackerDialInteractionV16.lastActivityAt = safeCrackerDialActivityAt;
          window.__safeCrackerDialInteractionV16.expiresAt = safeCrackerDialActivityAt + 12000;
        }
        if (Math.abs(delta) > .08) runtime.lastDragDirection = Math.sign(delta);
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
        const safeCrackerDialInteraction = window.__safeCrackerDialInteractionV16;
        if (
          safeCrackerDialInteraction &&
          String(safeCrackerDialInteraction.gameId || '') === String(game?.gameId || '')
        ) {
          const safeCrackerDialReleasedAt = Date.now();
          safeCrackerDialInteraction.active = false;
          safeCrackerDialInteraction.pointerDown = false;
          safeCrackerDialInteraction.releasedAt = safeCrackerDialReleasedAt;
          safeCrackerDialInteraction.lastActivityAt = safeCrackerDialReleasedAt;
          safeCrackerDialInteraction.expiresAt = safeCrackerDialReleasedAt + 2500;
        }
        runtime.pointerId = null;
        dial.classList.remove('dragging');
        const releasedRotation = runtime.rotation;
        runtime.rotation = nearestRotationForDigit(runtime.selected, runtime.rotation);
        applyDialVisual();
        animateDialSettle(releasedRotation, runtime.rotation, runtime.lastDragDirection);
        runtime.lastDragDirection = 0;
        const pendingGame = runtime.pendingDragGame;
        runtime.pendingDragGame = null;
        if (pendingGame) render(pendingGame);
        event.preventDefault();
      };
      dial.addEventListener('pointerup', finishDrag);
      dial.addEventListener('pointercancel', finishDrag);
      dial.addEventListener('keydown', event => {
        if (runtime.game?.status !== 'playing') return;
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
    mount.querySelector('[data-sc-rematch]')?.addEventListener('click', () => { clearSafeCrackerResultPortal(); window.__safeCrackerBridge?.rematch?.(); });
    mount.querySelector('[data-sc-new-game]')?.addEventListener('click', () => { clearSafeCrackerResultPortal(); window.__safeCrackerBridge?.newGame?.(); });
  }

  async function submitGuess(game) {
    const bridge = window.__safeCrackerBridge;
    const activeGame = runtime.game || game;
    if (!bridge?.submit || runtime.busy || !safeCrackerCanSubmit(activeGame)) return;
    runtime.busy = true;
    const confirmButton = document.querySelector('[data-sc-confirm]');
    if (confirmButton) {
      confirmButton.disabled = true;
      confirmButton.classList.add('busy');
      const confirmLabel = confirmButton.querySelector('span');
      if (confirmLabel) confirmLabel.textContent = 'CHECKING…';
    }
    try {
      const actionId = `sc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const data = await bridge.submit({
        choice: `safecracker:guess:${runtime.selected}`,
        actionId
      });
      const nextGame = data?.game || runtime.game || activeGame;
      const resultChanged = adoptSubmittedFeedback(nextGame);
      const result = runtime.feedbackResult;
      if (resultChanged && result?.tier) playFeedback(result.tier);
      runtime.busy = false;
      safeCrackerArmLocalCooldown(nextGame, Number(nextGame?.safecrackerState?.cooldownMs || 0));
      render(nextGame);
      safeCrackerUpdateConfirmControl();
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
    if (!runtime.game) return;
    const timer = document.querySelector('[data-sc-timer]');
    if (timer) {
      const seconds = secondsLeft(runtime.game);
      timer.textContent = formatTimer(seconds);
      timer.classList.toggle('danger', seconds <= 10 && runtime.game.status === 'playing');
    }
    const countdown = document.querySelector('[data-sc-start-countdown]');
    if (countdown) {
      const label = safeCrackerMonotonicCountdownLabel(runtime.game);
      if (!label) countdown.remove();
      else {
        playCountdownBeat(label, runtime.game);
        countdown.dataset.scCountdownLabel = label;
        const text = countdown.querySelector('[data-sc-countdown-value]');
        const status = countdown.querySelector('[data-sc-countdown-status]');
        if (status) status.textContent = label === 'GO!' ? 'DIAL ACTIVE' : 'LOCKS ENGAGING';
        if (text && text.textContent !== label) {
          text.textContent = label;
          text.className = label === 'GO!' ? 'go' : '';
          text.style.animation = 'none';
          void text.offsetWidth;
          text.style.animation = '';
        }
      }
    }
  }

  function startTicker() {
    if (runtime.ticker) return;
    runtime.ticker = window.setInterval(updateTimerOnly, 150);
  }

  window.addEventListener(STATE_EVENT, event => {
    const game = event?.detail?.game;
    if (!game || game.mode !== 'safecracker') return;
    if (runtime.dragging) {
      runtime.pendingDragGame = game;
      runtime.game = game;
      updateClock(game);
      startTicker();
      return;
    }
    render(game);
    startTicker();
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && runtime.game) {
      updateTimerOnly();
      window.__safeCrackerBridge?.refresh?.();
    }
  });
  // SAFE_CRACKER_AUDIO_PASS_V10_START
  function safeCrackerAudioBus(context) {
    if (runtime.safeCrackerAudioBus?.context === context) return runtime.safeCrackerAudioBus.input;
    const input = context.createGain();
    const compressor = context.createDynamicsCompressor();
    input.gain.value = 0.72;
    compressor.threshold.value = -20;
    compressor.knee.value = 18;
    compressor.ratio.value = 5;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.18;
    input.connect(compressor);
    compressor.connect(context.destination);
    runtime.safeCrackerAudioBus = { context, input, compressor };
    return input;
  }

  function safeCrackerNoiseBuffer(context) {
    if (runtime.safeCrackerNoiseBuffer?.sampleRate === context.sampleRate) return runtime.safeCrackerNoiseBuffer;
    const length = Math.max(1, Math.floor(context.sampleRate * 0.5));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) data[index] = Math.random() * 2 - 1;
    runtime.safeCrackerNoiseBuffer = buffer;
    return buffer;
  }

  function safeCrackerPlayTone(frequency, duration, gainValue, type = 'triangle', delay = 0, options = {}) {
    const context = resumeAudio();
    if (!context || document.hidden) return;
    const startAt = context.currentTime + Math.max(0, Number(delay) || 0);
    const length = Math.max(0.025, Number(duration) || 0.05);
    const attack = Math.min(length * 0.45, Math.max(0.002, Number(options.attack) || 0.005));
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(40, Number(frequency) || 40), startAt);
    if (Number.isFinite(options.endFrequency)) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, options.endFrequency), startAt + length);
    }
    if (Number.isFinite(options.detune)) oscillator.detune.setValueAtTime(options.detune, startAt);
    filter.type = options.filterType || 'lowpass';
    filter.frequency.setValueAtTime(Math.max(80, Number(options.filterFrequency) || 6400), startAt);
    filter.Q.setValueAtTime(Math.max(0.0001, Number(options.q) || 0.7), startAt);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, Number(gainValue) || 0.0002), startAt + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + length);
    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(safeCrackerAudioBus(context));
    oscillator.start(startAt);
    oscillator.stop(startAt + length + 0.04);
  }

  function safeCrackerPlayNoise(duration, gainValue, delay = 0, options = {}) {
    const context = resumeAudio();
    if (!context || document.hidden) return;
    const startAt = context.currentTime + Math.max(0, Number(delay) || 0);
    const length = Math.max(0.012, Number(duration) || 0.03);
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = safeCrackerNoiseBuffer(context);
    filter.type = options.filterType || 'bandpass';
    filter.frequency.setValueAtTime(Math.max(80, Number(options.frequency) || 1800), startAt);
    if (Number.isFinite(options.endFrequency)) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(80, options.endFrequency), startAt + length);
    }
    filter.Q.setValueAtTime(Math.max(0.0001, Number(options.q) || 1.1), startAt);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, Number(gainValue) || 0.0002), startAt + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + length);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(safeCrackerAudioBus(context));
    source.start(startAt);
    source.stop(startAt + length + 0.02);
  }

  function safeCrackerHaptic(pattern) {
    if (document.hidden || typeof navigator.vibrate !== 'function') return;
    const now = performance.now();
    if (now - Number(runtime.safeCrackerLastHapticAt || 0) < 28) return;
    runtime.safeCrackerLastHapticAt = now;
    try { navigator.vibrate(pattern); } catch {}
  }

  function safeCrackerPlayMetalTick(pitch = 240, strength = 1, delay = 0) {
    const amount = Math.max(0.25, Math.min(1.25, Number(strength) || 1));
    safeCrackerPlayNoise(0.024, 0.012 * amount, delay, { frequency: 1350 + pitch * 2.2, q: 1.4 });
    safeCrackerPlayTone(pitch, 0.038, 0.021 * amount, 'square', delay, {
      endFrequency: Math.max(70, pitch * 0.72),
      filterFrequency: 2400 + pitch * 2,
      q: 1.8
    });
    safeCrackerPlayTone(pitch * 2.36, 0.052, 0.007 * amount, 'triangle', delay + 0.004, {
      endFrequency: pitch * 1.84,
      filterFrequency: 5200,
      q: 2.2
    });
  }

  function safeCrackerPlayDetent(digit) {
    const weight = knownClickWeight(digit);
    const pitch = 188 + Number(digit || 0) * 3 + weight * 58;
    safeCrackerPlayMetalTick(pitch, 0.72 + weight * 0.32);
    if (weight > 0.54) {
      safeCrackerPlayTone(480 + weight * 210, 0.048, 0.004 + weight * 0.009, 'sine', 0.008, {
        endFrequency: 430 + weight * 180,
        filterFrequency: 3600
      });
    }
    safeCrackerHaptic(weight > 0.9 ? 9 : weight > 0.64 ? 6 : 3);
  }

  function safeCrackerPlaySubmit() {
    safeCrackerPlayNoise(0.035, 0.016, 0, { frequency: 1650, q: 0.9 });
    safeCrackerPlayTone(146, 0.075, 0.034, 'square', 0, { endFrequency: 104, filterFrequency: 2100, q: 1.2 });
    safeCrackerPlayTone(310, 0.055, 0.012, 'triangle', 0.018, { endFrequency: 248, filterFrequency: 3400 });
    safeCrackerHaptic(9);
  }

  function safeCrackerPlayTumblerLock() {
    safeCrackerPlayMetalTick(218, 1.08, 0);
    safeCrackerPlayNoise(0.11, 0.018, 0.045, { frequency: 780, endFrequency: 410, q: 0.65 });
    safeCrackerPlayTone(112, 0.14, 0.041, 'square', 0.052, { endFrequency: 78, filterFrequency: 1250, q: 1.1 });
    safeCrackerPlayMetalTick(286, 0.86, 0.15);
    safeCrackerPlayTone(440, 0.16, 0.018, 'sine', 0.19, { endFrequency: 522, filterFrequency: 4200 });
    safeCrackerHaptic([13, 24, 22]);
  }

  function safeCrackerPlayFeedback(tier) {
    if (tier === 'green') {
      safeCrackerPlayTumblerLock();
      return;
    }
    if (tier === 'yellow') {
      safeCrackerPlayMetalTick(334, 0.85, 0);
      safeCrackerPlayMetalTick(402, 0.7, 0.075);
      safeCrackerPlayTone(610, 0.12, 0.018, 'sine', 0.11, { endFrequency: 684, filterFrequency: 4600 });
      safeCrackerHaptic([7, 28, 10]);
      return;
    }
    if (tier === 'orange') {
      safeCrackerPlayMetalTick(248, 0.7, 0);
      safeCrackerPlayTone(292, 0.095, 0.017, 'triangle', 0.065, { endFrequency: 244, filterFrequency: 2600 });
      safeCrackerHaptic(7);
      return;
    }
    safeCrackerPlayNoise(0.07, 0.014, 0, { frequency: 540, q: 0.72 });
    safeCrackerPlayTone(112, 0.16, 0.035, 'square', 0, { endFrequency: 76, filterFrequency: 980, q: 0.8 });
    safeCrackerHaptic(5);
  }

  function safeCrackerPlayButton(kind = 'secondary') {
    if (kind === 'primary') {
      safeCrackerPlayMetalTick(274, 0.76, 0);
      safeCrackerPlayTone(392, 0.07, 0.01, 'triangle', 0.025, { endFrequency: 438, filterFrequency: 3600 });
      safeCrackerHaptic(7);
      return;
    }
    safeCrackerPlayMetalTick(212, 0.52, 0);
    safeCrackerHaptic(4);
  }

  function safeCrackerPlayCountdownLabel(label) {
    const normalized = String(label || '').trim().toUpperCase();
    const gameId = String(runtime.game?.gameId || '');
    if (!gameId || !normalized) return;
    const key = gameId + ':' + normalized;
    if (runtime.safeCrackerCountdownAudioKey === key) return;
    runtime.safeCrackerCountdownAudioKey = key;
    const number = Number(normalized);
    if (Number.isFinite(number) && number >= 1 && number <= 3) {
      const pitch = 154 + (3 - number) * 34;
      safeCrackerPlayMetalTick(pitch, 0.72, 0);
      safeCrackerPlayTone(72, 0.11, 0.018, 'sine', 0, { endFrequency: 58, filterFrequency: 520 });
      safeCrackerHaptic(number === 1 ? 10 : 6);
      return;
    }
    if (normalized.includes('CRACK') || normalized.includes('GO') || normalized.includes('START')) {
      safeCrackerPlayNoise(0.05, 0.017, 0, { frequency: 1900, q: 1.1 });
      safeCrackerPlayTone(126, 0.12, 0.035, 'square', 0, { endFrequency: 176, filterFrequency: 1900 });
      safeCrackerPlayTone(420, 0.13, 0.018, 'triangle', 0.055, { endFrequency: 560, filterFrequency: 4400 });
      safeCrackerHaptic([9, 26, 13]);
    }
  }

  function safeCrackerScanCountdown() {
    const value = document.querySelector('[data-sc-countdown-value]');
    if (!value) return;
    safeCrackerPlayCountdownLabel(value.textContent);
  }

  function safeCrackerUpdateUrgency() {
    const game = runtime.game;
    if (!game || game.status !== 'playing') {
      runtime.safeCrackerUrgencyKey = '';
      return;
    }
    const seconds = secondsLeft(game);
    if (seconds > 10 || seconds <= 0) {
      if (seconds > 10) runtime.safeCrackerUrgencyKey = '';
      return;
    }
    const key = String(game.gameId || '') + ':' + seconds;
    if (runtime.safeCrackerUrgencyKey === key) return;
    runtime.safeCrackerUrgencyKey = key;
    const urgent = seconds <= 5;
    safeCrackerPlayTone(urgent ? 184 + (5 - seconds) * 18 : 132, 0.045, urgent ? 0.018 : 0.011, 'square', 0, {
      endFrequency: urgent ? 152 + (5 - seconds) * 15 : 108,
      filterFrequency: urgent ? 2200 : 1350,
      q: 1.15
    });
    safeCrackerPlayNoise(0.018, urgent ? 0.008 : 0.0045, 0, { frequency: urgent ? 2100 : 1200, q: 1.3 });
    if (seconds <= 3) {
      safeCrackerPlayTone(urgent ? 268 : 210, 0.032, 0.009, 'triangle', 0.07, { endFrequency: 232, filterFrequency: 2900 });
      safeCrackerHaptic(seconds === 1 ? 11 : 6);
    }
  }

  function safeCrackerPlaySafeOpen() {
    safeCrackerPlayMetalTick(168, 1.08, 0.025);
    safeCrackerPlayMetalTick(196, 1.04, 0.15);
    safeCrackerPlayNoise(0.34, 0.025, 0.24, { frequency: 980, endFrequency: 320, q: 0.55 });
    safeCrackerPlayTone(84, 0.38, 0.047, 'sawtooth', 0.26, { endFrequency: 54, filterFrequency: 880, q: 0.72 });
    safeCrackerPlayNoise(0.16, 0.024, 0.61, { frequency: 410, q: 0.65 });
    safeCrackerPlayTone(62, 0.22, 0.052, 'square', 0.63, { endFrequency: 46, filterFrequency: 620, q: 0.7 });
    safeCrackerPlayTone(286, 0.42, 0.018, 'triangle', 0.72, { endFrequency: 392, filterFrequency: 3200 });
    safeCrackerPlayTone(568, 0.48, 0.014, 'sine', 0.82, { endFrequency: 710, filterFrequency: 5200 });
  }

  function safeCrackerPlayResult(won, tied) {
    const gameId = String(runtime.game?.gameId || '');
    const key = gameId + ':' + (won ? 'win' : tied ? 'tie' : 'lose');
    if (!gameId || runtime.resultSoundKey === key) return;
    runtime.resultSoundKey = key;
    if (won) {
      safeCrackerPlayTone(196, 0.18, 0.032, 'triangle', 0, { endFrequency: 220, filterFrequency: 3000 });
      safeCrackerPlayTone(294, 0.22, 0.028, 'triangle', 0.08, { endFrequency: 330, filterFrequency: 3400 });
      safeCrackerPlayTone(440, 0.28, 0.026, 'sine', 0.17, { endFrequency: 494, filterFrequency: 4600 });
      safeCrackerPlayTone(659, 0.42, 0.022, 'sine', 0.27, { endFrequency: 784, filterFrequency: 6000 });
      return;
    }
    if (tied) {
      safeCrackerPlayMetalTick(174, 0.62, 0);
      safeCrackerPlayTone(220, 0.18, 0.024, 'triangle', 0.06, { endFrequency: 196, filterFrequency: 2300 });
      safeCrackerPlayTone(174, 0.22, 0.021, 'triangle', 0.24, { endFrequency: 154, filterFrequency: 1900 });
      return;
    }
    safeCrackerPlayNoise(0.1, 0.015, 0, { frequency: 460, q: 0.7 });
    safeCrackerPlayTone(146, 0.18, 0.032, 'sawtooth', 0, { endFrequency: 104, filterFrequency: 1200 });
    safeCrackerPlayTone(82, 0.42, 0.043, 'square', 0.12, { endFrequency: 48, filterFrequency: 720, q: 0.65 });
  }

  function safeCrackerPlayResultSequence(game, won, tied) {
    const gameId = String(game?.gameId || '');
    const key = gameId + ':' + (won ? 'win' : tied ? 'tie' : 'lose');
    if (!gameId || runtime.resultSequenceAudioKey === key) return;
    runtime.resultSequenceAudioKey = key;
    if (won) {
      safeCrackerPlaySafeOpen();
      safeCrackerHaptic([14, 28, 14, 54, 28]);
      window.setTimeout(() => playResult(true, false), 820);
      return;
    }
    if (tied) {
      safeCrackerPlayMetalTick(154, 0.82, 0.04);
      safeCrackerPlayMetalTick(142, 0.72, 0.2);
      safeCrackerPlayTone(104, 0.26, 0.028, 'square', 0.28, { endFrequency: 72, filterFrequency: 980 });
      safeCrackerHaptic([9, 34, 9]);
      window.setTimeout(() => playResult(false, true), 310);
      return;
    }
    safeCrackerPlayNoise(0.25, 0.016, 0.04, { frequency: 620, endFrequency: 260, q: 0.55 });
    safeCrackerPlayTone(72, 0.3, 0.035, 'square', 0.08, { endFrequency: 49, filterFrequency: 650 });
    safeCrackerPlayMetalTick(126, 0.64, 0.31);
    safeCrackerHaptic([16, 30, 12]);
    window.setTimeout(() => playResult(false, false), 380);
  }

  const safeCrackerSubmitGuessWithAudio = submitGuess;
  submitGuess = async function safeCrackerSubmitGuessAudioWrapper(game) {
    const activeGame = runtime.game || game;
    const state = stateFor(activeGame);
    const canSubmit = typeof safeCrackerCanSubmit === 'function'
      ? safeCrackerCanSubmit(activeGame)
      : Boolean(activeGame?.status === 'playing' && state?.canSubmit && !runtime.busy);
    if (!canSubmit) return safeCrackerSubmitGuessWithAudio(game);
    safeCrackerPlaySubmit();
    const result = await safeCrackerSubmitGuessWithAudio(game);
    window.requestAnimationFrame(() => {
      const display = document.querySelector('[data-sc-display]');
      const text = String(display?.querySelector('span')?.textContent || '').trim().toUpperCase();
      const normalRed = text === 'TOO FAR AWAY';
      if (display?.classList.contains('red') && text && !normalRed) {
        safeCrackerPlayNoise(0.055, 0.012, 0, { frequency: 720, q: 0.8 });
        safeCrackerPlayTone(96, 0.16, 0.028, 'square', 0, { endFrequency: 62, filterFrequency: 820 });
        safeCrackerHaptic([8, 26, 8]);
      }
    });
    return result;
  };

  const safeCrackerTimerWithAudio = updateTimerOnly;
  updateTimerOnly = function safeCrackerTimerAudioWrapper() {
    const result = safeCrackerTimerWithAudio();
    safeCrackerUpdateUrgency();
    return result;
  };

  playTone = safeCrackerPlayTone;
  playDetent = safeCrackerPlayDetent;
  playFeedback = safeCrackerPlayFeedback;
  playResult = safeCrackerPlayResult;
  if (typeof playSafeCrackerResultSequence === 'function') playSafeCrackerResultSequence = safeCrackerPlayResultSequence;

  document.addEventListener('click', event => {
    const button = event.target?.closest?.('button');
    if (!button || button.disabled || button.matches('[data-sc-step], [data-sc-confirm]')) return;
    const safeScope = button.closest('[data-safe-cracker-mount], [data-sc-result-portal], .sth-game[data-mode="safecracker"], [data-sc-start-countdown]');
    if (!safeScope) return;
    safeCrackerPlayButton(button.matches('.gold, [data-sc-rematch], [data-sc-new-game]') ? 'primary' : 'secondary');
  }, true);

  const safeCrackerCountdownObserver = new MutationObserver(() => {
    if (runtime.safeCrackerCountdownScanQueued) return;
    runtime.safeCrackerCountdownScanQueued = true;
    window.requestAnimationFrame(() => {
      runtime.safeCrackerCountdownScanQueued = false;
      safeCrackerScanCountdown();
    });
  });
  safeCrackerCountdownObserver.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  window.addEventListener(STATE_EVENT, event => {
    const game = event?.detail?.game;
    if (!game || game.mode !== 'safecracker') return;
    if (game.status !== 'countdown') runtime.safeCrackerCountdownAudioKey = '';
    window.requestAnimationFrame(safeCrackerScanCountdown);
  });
  // SAFE_CRACKER_AUDIO_PASS_V10_END

  // SAFE_CRACKER_SAMPLE_MIX_V11_START
  const SAFE_CRACKER_SAMPLE_MANIFEST = Object.freeze({
    submitLatch: '/assets/safe-cracker/audio-data/submit-latch.b64',
    tumblerLock: '/assets/safe-cracker/audio-data/tumbler-lock.b64',
    safeUnlock: '/assets/safe-cracker/audio-data/safe-unlock.b64',
    boltMechanism: '/assets/safe-cracker/audio-data/safe-bolt-mechanism.b64',
    safeDoorOpen: '/assets/safe-cracker/audio-data/safe-door-open.b64',
    safeDoorLockdown: '/assets/safe-cracker/audio-data/safe-door-lockdown.b64'
  });

  function safeCrackerBase64Bytes(source) {
    const clean = String(source || '').replace(/\\s+/g, '');
    const binary = window.atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes.buffer;
  }

  function safeCrackerLoadSample(name) {
    const url = SAFE_CRACKER_SAMPLE_MANIFEST[name];
    const context = audioContext();
    if (!url || !context) return Promise.resolve(null);
    runtime.safeCrackerSampleBuffers ||= Object.create(null);
    runtime.safeCrackerSamplePromises ||= Object.create(null);
    if (runtime.safeCrackerSampleBuffers[name]) return Promise.resolve(runtime.safeCrackerSampleBuffers[name]);
    if (runtime.safeCrackerSamplePromises[name]) return runtime.safeCrackerSamplePromises[name];
    const promise = fetch(url, { cache: 'force-cache' })
      .then(response => {
        if (!response.ok) throw new Error('Sample request failed: ' + name);
        return response.text();
      })
      .then(encoded => context.decodeAudioData(safeCrackerBase64Bytes(encoded).slice(0)))
      .then(buffer => {
        runtime.safeCrackerSampleBuffers[name] = buffer;
        return buffer;
      })
      .catch(() => null)
      .finally(() => { delete runtime.safeCrackerSamplePromises[name]; });
    runtime.safeCrackerSamplePromises[name] = promise;
    return promise;
  }

  function safeCrackerPrimeSamples() {
    for (const name of Object.keys(SAFE_CRACKER_SAMPLE_MANIFEST)) safeCrackerLoadSample(name);
  }

  function safeCrackerPlaySample(name, options = {}) {
    const context = resumeAudio();
    const buffer = runtime.safeCrackerSampleBuffers?.[name];
    if (!context || !buffer || document.hidden) {
      safeCrackerLoadSample(name);
      return false;
    }
    const delay = Math.max(0, Number(options.delay) || 0);
    const startAt = context.currentTime + delay;
    const source = context.createBufferSource();
    const gain = context.createGain();
    const highpass = context.createBiquadFilter();
    const lowpass = context.createBiquadFilter();
    source.buffer = buffer;
    source.playbackRate.setValueAtTime(Math.max(0.72, Math.min(1.28, Number(options.playbackRate) || 1)), startAt);
    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(Math.max(20, Number(options.highpass) || 35), startAt);
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(Math.max(800, Number(options.lowpass) || 12000), startAt);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, Number(options.gain) || 0.18), startAt + 0.012);
    const releaseAt = startAt + Math.max(0.08, buffer.duration / Math.max(0.72, Number(options.playbackRate) || 1) - 0.05);
    gain.gain.setValueAtTime(Math.max(0.0002, Number(options.gain) || 0.18), Math.max(startAt + 0.013, releaseAt - 0.07));
    gain.gain.exponentialRampToValueAtTime(0.0001, releaseAt + 0.05);
    source.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(safeCrackerAudioBus(context));
    source.start(startAt);
    return true;
  }

  const safeCrackerSubmitSynth = safeCrackerPlaySubmit;
  safeCrackerPlaySubmit = function safeCrackerPlaySubmitSampleMix() {
    safeCrackerSubmitSynth();
    safeCrackerPlaySample('submitLatch', { gain: 0.18, playbackRate: 1.06, highpass: 105, lowpass: 7200 });
  };

  const safeCrackerTumblerSynth = safeCrackerPlayTumblerLock;
  safeCrackerPlayTumblerLock = function safeCrackerPlayTumblerSampleMix() {
    safeCrackerTumblerSynth();
    safeCrackerPlaySample('tumblerLock', { gain: 0.24, playbackRate: 1.03, highpass: 80, lowpass: 8500 });
  };

  const safeCrackerOpenSynth = safeCrackerPlaySafeOpen;
  safeCrackerPlaySafeOpen = function safeCrackerPlaySafeOpenSampleMix() {
    const unlock = safeCrackerPlaySample('safeUnlock', { gain: 0.27, delay: 0.01, highpass: 42, lowpass: 9300 });
    const bolts = safeCrackerPlaySample('boltMechanism', { gain: 0.19, delay: 0.16, playbackRate: 0.96, highpass: 52, lowpass: 7600 });
    const door = safeCrackerPlaySample('safeDoorOpen', { gain: 0.25, delay: 0.46, playbackRate: 0.97, highpass: 36, lowpass: 9200 });
    if (!unlock && !bolts && !door) {
      safeCrackerOpenSynth();
      return;
    }
    safeCrackerPlayTone(286, 0.4, 0.012, 'triangle', 0.76, { endFrequency: 386, filterFrequency: 3100 });
    safeCrackerPlayTone(568, 0.46, 0.009, 'sine', 0.86, { endFrequency: 704, filterFrequency: 5100 });
  };

  const safeCrackerResultSequenceSynth = safeCrackerPlayResultSequence;
  safeCrackerPlayResultSequence = function safeCrackerPlayResultSequenceSampleMix(game, won, tied) {
    const gameId = String(game?.gameId || '');
    const key = gameId + ':' + (won ? 'win' : tied ? 'tie' : 'lose');
    if (gameId && runtime.safeCrackerSampleResultKey !== key) {
      runtime.safeCrackerSampleResultKey = key;
      if (tied) {
        safeCrackerPlaySample('safeDoorLockdown', { gain: 0.14, delay: 0.04, playbackRate: 0.91, highpass: 34, lowpass: 5600 });
      } else if (!won) {
        safeCrackerPlaySample('safeDoorLockdown', { gain: 0.2, delay: 0.02, playbackRate: 1.02, highpass: 34, lowpass: 6900 });
      }
    }
    return safeCrackerResultSequenceSynth(game, won, tied);
  };
  if (typeof playSafeCrackerResultSequence === 'function') playSafeCrackerResultSequence = safeCrackerPlayResultSequence;

  document.addEventListener('pointerdown', safeCrackerPrimeSamples, { capture: true, once: true });
  document.addEventListener('keydown', safeCrackerPrimeSamples, { capture: true, once: true });
  window.addEventListener(STATE_EVENT, event => {
    if (event?.detail?.game?.mode === 'safecracker') safeCrackerPrimeSamples();
  });
  // SAFE_CRACKER_SAMPLE_MIX_V11_END

  // SAFE_CRACKER_RECORDED_SOUNDS_V13_START
  const SAFE_CRACKER_RECORDED_SOUNDS = Object.freeze({
    intro: Object.freeze([
      '/assets/safe-cracker/audio-data-v2/intro-sequence-1.b64',
      '/assets/safe-cracker/audio-data-v2/intro-sequence-2.b64',
      '/assets/safe-cracker/audio-data-v2/intro-sequence-3.b64',
      '/assets/safe-cracker/audio-data-v2/intro-sequence-4.b64'
    ]),
    dialA: '/assets/safe-cracker/audio-data-v2/dial-detent-a.b64',
    dialB: '/assets/safe-cracker/audio-data-v2/dial-detent-b.b64',
    submit: '/assets/safe-cracker/audio-data-v2/submit-mechanism.b64',
    incorrect: '/assets/safe-cracker/audio-data-v2/incorrect-number.b64',
    latchOpen: '/assets/safe-cracker/audio-data-v2/correct-latch-open.b64',
    safeOpen: Object.freeze([
      '/assets/safe-cracker/audio-data-v2/final-vault-open-1.b64',
      '/assets/safe-cracker/audio-data-v2/final-vault-open-2.b64',
      '/assets/safe-cracker/audio-data-v2/final-vault-open-3.b64'
    ]),
    ambience: Object.freeze([
      '/assets/safe-cracker/audio-data-v2/vault-ambience-loop-1.b64',
      '/assets/safe-cracker/audio-data-v2/vault-ambience-loop-2.b64',
      '/assets/safe-cracker/audio-data-v2/vault-ambience-loop-3.b64',
      '/assets/safe-cracker/audio-data-v2/vault-ambience-loop-4.b64'
    ])
  });

  function safeCrackerRecordedBytes(text) {
    const clean = String(text || '').replace(/\s+/g, '');
    const binary = window.atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes.buffer;
  }

  function safeCrackerLoadRecordedSound(name) {
    const sourceLocation = SAFE_CRACKER_RECORDED_SOUNDS[name];
    const context = audioContext();
    if (!sourceLocation || !context) return Promise.resolve(null);
    const urls = Array.isArray(sourceLocation) ? sourceLocation : [sourceLocation];
    runtime.safeCrackerRecordedBuffers ||= Object.create(null);
    runtime.safeCrackerRecordedPromises ||= Object.create(null);
    if (runtime.safeCrackerRecordedBuffers[name]) return Promise.resolve(runtime.safeCrackerRecordedBuffers[name]);
    if (runtime.safeCrackerRecordedPromises[name]) return runtime.safeCrackerRecordedPromises[name];
    const promise = Promise.all(urls.map(url =>
      fetch(url + '?recorded=13', { cache: 'force-cache' }).then(response => {
        if (!response.ok) throw new Error('Recorded Safe Cracker sound request failed: ' + name + ' at ' + url);
        return response.text();
      })
    ))
      .then(parts => context.decodeAudioData(safeCrackerRecordedBytes(parts.join(''))))
      .then(buffer => {
        runtime.safeCrackerRecordedBuffers[name] = buffer;
        return buffer;
      })
      .catch(error => {
        console.warn('[Safe Cracker audio] Failed to load ' + name, error);
        return null;
      })
      .finally(() => { delete runtime.safeCrackerRecordedPromises[name]; });
    runtime.safeCrackerRecordedPromises[name] = promise;
    return promise;
  }

  function safeCrackerPrimeRecordedSounds() {
    for (const name of Object.keys(SAFE_CRACKER_RECORDED_SOUNDS)) safeCrackerLoadRecordedSound(name);
  }

  function safeCrackerUnlockRecordedAudio() {
    const context = resumeAudio();
    if (!context) return;
    try {
      const source = context.createBufferSource();
      source.buffer = context.createBuffer(1, 1, context.sampleRate || 44100);
      source.connect(context.destination);
      source.start(0);
    } catch {}
    safeCrackerPrimeRecordedSounds();
  }

  function safeCrackerPlayRecordedSound(name, options = {}) {
    const context = resumeAudio();
    const buffer = runtime.safeCrackerRecordedBuffers?.[name];
    if (!context || !buffer || document.hidden) {
      safeCrackerLoadRecordedSound(name);
      return false;
    }
    const delay = Math.max(0, Number(options.delay) || 0);
    const startAt = context.currentTime + delay;
    const playbackRate = Math.max(0.78, Math.min(1.24, Number(options.playbackRate) || 1));
    const targetGain = Math.max(0.0002, Number(options.gain) || 0.2);
    const source = context.createBufferSource();
    const highpass = context.createBiquadFilter();
    const lowpass = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = buffer;
    source.playbackRate.setValueAtTime(playbackRate, startAt);
    source.loop = Boolean(options.loop);
    if (source.loop && buffer.duration > 0.3) {
      source.loopStart = Math.min(0.04, buffer.duration * 0.05);
      source.loopEnd = Math.max(source.loopStart + 0.1, buffer.duration - Math.min(0.04, buffer.duration * 0.05));
    }
    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(Math.max(20, Number(options.highpass) || 35), startAt);
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(Math.max(500, Number(options.lowpass) || 12000), startAt);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(targetGain, startAt + Math.max(0.006, Number(options.attack) || 0.014));
    if (!source.loop) {
      const duration = buffer.duration / playbackRate;
      const release = Math.min(0.14, Math.max(0.035, duration * 0.1));
      gain.gain.setValueAtTime(targetGain, Math.max(startAt + 0.02, startAt + duration - release));
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration + 0.018);
    }
    source.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(safeCrackerAudioBus(context));
    source.start(startAt);
    return { source, gain, context };
  }

  function safeCrackerRecordedModeActive() {
    const game = runtime.game;
    return Boolean(
      !document.hidden &&
      game?.mode === 'safecracker' &&
      game?.status !== 'complete' &&
      document.querySelector('[data-safe-cracker-mount] .safe-cracker-game')
    );
  }

  function safeCrackerStopRecordedAmbience() {
    const current = runtime.safeCrackerRecordedAmbience;
    runtime.safeCrackerRecordedAmbience = null;
    if (!current) return;
    try {
      const now = current.context.currentTime;
      current.gain.gain.cancelScheduledValues(now);
      current.gain.gain.setValueAtTime(Math.max(0.0001, current.gain.gain.value), now);
      current.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
      current.source.stop(now + 0.58);
    } catch {}
  }

  function safeCrackerStartRecordedAmbience() {
    if (!safeCrackerRecordedModeActive() || runtime.safeCrackerRecordedAmbience) return;
    safeCrackerLoadRecordedSound('ambience').then(buffer => {
      if (!buffer || !safeCrackerRecordedModeActive() || runtime.safeCrackerRecordedAmbience) return;
      const playback = safeCrackerPlayRecordedSound('ambience', {
        gain: 0.085,
        loop: true,
        attack: 1.1,
        highpass: 45,
        lowpass: 2450
      });
      if (playback) runtime.safeCrackerRecordedAmbience = playback;
    });
  }

  const safeCrackerRecordedSubmitFallback = safeCrackerPlaySubmit;
  safeCrackerPlaySubmit = function safeCrackerPlayRecordedSubmit() {
    const played = safeCrackerPlayRecordedSound('submit', {
      gain: 0.31,
      playbackRate: 1.03,
      highpass: 80,
      lowpass: 9000
    });
    if (!played) safeCrackerRecordedSubmitFallback();
    else safeCrackerHaptic(8);
  };

  const safeCrackerRecordedDetentFallback = safeCrackerPlayDetent;
  safeCrackerPlayDetent = function safeCrackerPlayRecordedDetent(digit) {
    const now = performance.now();
    if (now - Number(runtime.safeCrackerRecordedDetentAt || 0) < 32) return;
    runtime.safeCrackerRecordedDetentAt = now;
    runtime.safeCrackerRecordedDetentIndex = (Number(runtime.safeCrackerRecordedDetentIndex || 0) + 1) % 2;
    const name = runtime.safeCrackerRecordedDetentIndex ? 'dialA' : 'dialB';
    const rate = 0.96 + (Math.abs(Number(digit) || 0) % 5) * 0.012;
    const played = safeCrackerPlayRecordedSound(name, {
      gain: name === 'dialA' ? 0.24 : 0.27,
      playbackRate: rate,
      highpass: 120,
      lowpass: 7900
    });
    if (!played) safeCrackerRecordedDetentFallback(digit);
    else safeCrackerHaptic(3);
  };
  playDetent = safeCrackerPlayDetent;

  const safeCrackerRecordedTumblerFallback = safeCrackerPlayTumblerLock;
  safeCrackerPlayTumblerLock = function safeCrackerPlayRecordedTumblerLock() {
    const played = safeCrackerPlayRecordedSound('latchOpen', {
      gain: 0.42,
      playbackRate: 1.01,
      highpass: 45,
      lowpass: 9400
    });
    if (!played) safeCrackerRecordedTumblerFallback();
    else safeCrackerHaptic([14, 24, 23]);
  };

  const safeCrackerRecordedFeedbackFallback = safeCrackerPlayFeedback;
  safeCrackerPlayFeedback = function safeCrackerPlayRecordedFeedback(tier) {
    if (tier === 'green') {
      safeCrackerPlayTumblerLock();
      return;
    }
    const settings = tier === 'yellow'
      ? { gain: 0.22, playbackRate: 1.08, haptic: [6, 22, 8], lowpass: 5600 }
      : tier === 'orange'
        ? { gain: 0.27, playbackRate: 0.99, haptic: 7, lowpass: 4700 }
        : { gain: 0.33, playbackRate: 0.91, haptic: 5, lowpass: 4000 };
    const played = safeCrackerPlayRecordedSound('incorrect', {
      gain: settings.gain,
      playbackRate: settings.playbackRate,
      highpass: 55,
      lowpass: settings.lowpass
    });
    if (!played) safeCrackerRecordedFeedbackFallback(tier);
    else safeCrackerHaptic(settings.haptic);
  };
  playFeedback = safeCrackerPlayFeedback;

  const safeCrackerRecordedOpenFallback = safeCrackerPlaySafeOpen;
  safeCrackerPlaySafeOpen = function safeCrackerPlayRecordedSafeOpen() {
    const played = safeCrackerPlayRecordedSound('safeOpen', {
      gain: 0.48,
      highpass: 28,
      lowpass: 9000
    });
    if (!played) safeCrackerRecordedOpenFallback();
  };

  const safeCrackerRecordedCountdownFallback = safeCrackerPlayCountdownLabel;
  safeCrackerPlayCountdownLabel = function safeCrackerPlayRecordedCountdown(label) {
    const normalized = String(label || '').trim().toUpperCase();
    const gameId = String(runtime.game?.gameId || '');
    const numeric = Number(normalized);
    if (gameId && numeric === 3 && runtime.safeCrackerRecordedIntroGameId !== gameId) {
      runtime.safeCrackerRecordedIntroGameId = gameId;
      const played = safeCrackerPlayRecordedSound('intro', {
        gain: 0.4,
        highpass: 32,
        lowpass: 9300
      });
      if (!played) return safeCrackerRecordedCountdownFallback(label);
      safeCrackerHaptic(7);
      return;
    }
    if (runtime.safeCrackerRecordedIntroGameId === gameId && (
      (Number.isFinite(numeric) && numeric >= 1 && numeric <= 2) ||
      normalized.includes('CRACK') ||
      normalized.includes('GO') ||
      normalized.includes('START')
    )) {
      if (normalized.includes('CRACK') || normalized.includes('GO') || normalized.includes('START')) {
        safeCrackerHaptic([8, 22, 12]);
      }
      return;
    }
    return safeCrackerRecordedCountdownFallback(label);
  };

  function safeCrackerRecordedState(game) {
    if (game?.mode !== 'safecracker' || game?.status === 'complete') {
      safeCrackerStopRecordedAmbience();
      return;
    }
    safeCrackerPrimeRecordedSounds();
    safeCrackerStartRecordedAmbience();
  }

  document.addEventListener('pointerdown', () => {
    safeCrackerUnlockRecordedAudio();
    safeCrackerStartRecordedAmbience();
  }, { capture: true, passive: true });
  document.addEventListener('keydown', () => {
    safeCrackerUnlockRecordedAudio();
    safeCrackerStartRecordedAmbience();
  }, { capture: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) safeCrackerStopRecordedAmbience();
    else {
      safeCrackerPrimeRecordedSounds();
      safeCrackerStartRecordedAmbience();
    }
  });
  window.addEventListener(STATE_EVENT, event => safeCrackerRecordedState(event?.detail?.game));
  window.setTimeout(safeCrackerPrimeRecordedSounds, 0);
  // SAFE_CRACKER_RECORDED_SOUNDS_V13_END

  // SAFE_CRACKER_CLICK_CUES_V16_START
  function safeCrackerClickNoiseBuffer(context) {
    if (runtime.safeCrackerClickNoiseBuffer?.sampleRate === context.sampleRate) {
      return runtime.safeCrackerClickNoiseBuffer;
    }
    const length = Math.max(128, Math.floor(context.sampleRate * 0.05));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) {
      const fast = Math.exp(-index / Math.max(1, context.sampleRate * 0.0024));
      const tail = Math.exp(-index / Math.max(1, context.sampleRate * 0.011));
      const impulse = index === 0 ? 0.95 : index === 1 ? -0.72 : index === 2 ? 0.38 : 0;
      const grit = (Math.random() * 2 - 1) * (0.62 * fast + 0.12 * tail);
      data[index] = Math.max(-1, Math.min(1, impulse + grit));
    }
    runtime.safeCrackerClickNoiseBuffer = buffer;
    return buffer;
  }

  function safeCrackerPlayDryMetalImpact(options = {}) {
    const context = resumeAudio();
    if (!context || document.hidden) return false;
    const delay = Math.max(0, Number(options.delay) || 0);
    const duration = Math.max(0.014, Number(options.duration) || 0.032);
    const startAt = context.currentTime + delay;
    const finishAt = startAt + duration;
    const source = context.createBufferSource();
    const highpass = context.createBiquadFilter();
    const primary = context.createBiquadFilter();
    const secondary = context.createBiquadFilter();
    const primaryGain = context.createGain();
    const secondaryGain = context.createGain();

    source.buffer = safeCrackerClickNoiseBuffer(context);
    source.playbackRate.setValueAtTime(
      Math.max(0.82, Math.min(1.28, Number(options.playbackRate) || 1)),
      startAt
    );
    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(Math.max(100, Number(options.highpass) || 700), startAt);
    primary.type = 'bandpass';
    primary.frequency.setValueAtTime(Math.max(240, Number(options.frequency) || 3300), startAt);
    primary.Q.setValueAtTime(Math.max(0.6, Number(options.q) || 6.2), startAt);
    secondary.type = 'bandpass';
    secondary.frequency.setValueAtTime(Math.max(280, Number(options.secondaryFrequency) || 5100), startAt);
    secondary.Q.setValueAtTime(Math.max(0.6, Number(options.secondaryQ) || 8), startAt);

    const gainLevel = Math.max(0.002, Number(options.gain) || 0.19);
    const secondaryLevel = Math.max(0.001, Number(options.secondaryGain) || gainLevel * 0.42);
    primaryGain.gain.setValueAtTime(gainLevel, startAt);
    primaryGain.gain.exponentialRampToValueAtTime(0.0001, finishAt);
    secondaryGain.gain.setValueAtTime(secondaryLevel, startAt);
    secondaryGain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration * 0.72);

    source.connect(highpass);
    highpass.connect(primary);
    highpass.connect(secondary);
    primary.connect(primaryGain);
    secondary.connect(secondaryGain);
    primaryGain.connect(safeCrackerAudioBus(context));
    secondaryGain.connect(safeCrackerAudioBus(context));
    source.start(startAt);
    source.stop(finishAt + 0.014);
    return true;
  }

  function safeCrackerPlayMetalDialClick(digit) {
    const step = Math.abs(Number(digit) || 0) % 5;
    const tooth = safeCrackerPlayDryMetalImpact({
      duration: 0.024,
      gain: 0.255,
      highpass: 1050,
      frequency: 3520 + step * 38,
      q: 8.1,
      secondaryFrequency: 6120 + step * 44,
      secondaryQ: 10.2,
      secondaryGain: 0.112,
      playbackRate: 0.98 + step * 0.008
    });
    const catchClick = safeCrackerPlayDryMetalImpact({
      delay: 0.017,
      duration: 0.031,
      gain: 0.125,
      highpass: 410,
      frequency: 1380 + step * 24,
      q: 4.1,
      secondaryFrequency: 2480 + step * 28,
      secondaryQ: 5.6,
      secondaryGain: 0.057,
      playbackRate: 0.94 + step * 0.007
    });
    return Boolean(tooth || catchClick);
  }

  function safeCrackerPlayIncorrectRejectCue(tier) {
    const severity = tier === 'yellow' ? 0 : tier === 'orange' ? 1 : 2;
    const stop = safeCrackerPlayDryMetalImpact({
      duration: 0.052,
      gain: 0.245 + severity * 0.018,
      highpass: 450,
      frequency: 1680 - severity * 105,
      q: 4.5,
      secondaryFrequency: 3010 - severity * 120,
      secondaryQ: 6.1,
      secondaryGain: 0.096
    });
    const knock = safeCrackerPlayDryMetalImpact({
      delay: 0.095,
      duration: 0.085,
      gain: 0.225 + severity * 0.016,
      highpass: 115,
      frequency: 620 - severity * 48,
      q: 2.2,
      secondaryFrequency: 1120 - severity * 62,
      secondaryQ: 3.2,
      secondaryGain: 0.088
    });
    const reject = safeCrackerPlayDryMetalImpact({
      delay: 0.205,
      duration: 0.061,
      gain: 0.19 + severity * 0.014,
      highpass: 260,
      frequency: 940 - severity * 64,
      q: 3.3,
      secondaryFrequency: 1840 - severity * 82,
      secondaryQ: 4.7,
      secondaryGain: 0.071
    });
    return Boolean(stop || knock || reject);
  }

  function safeCrackerPlayCorrectNumberCue() {
    const latchStrike = safeCrackerPlayDryMetalImpact({
      duration: 0.074,
      gain: 0.34,
      highpass: 420,
      frequency: 2140,
      q: 5.9,
      secondaryFrequency: 4520,
      secondaryQ: 8.6,
      secondaryGain: 0.165
    });
    const boltRelease = safeCrackerPlayDryMetalImpact({
      delay: 0.108,
      duration: 0.102,
      gain: 0.245,
      highpass: 165,
      frequency: 880,
      q: 3.1,
      secondaryFrequency: 1690,
      secondaryQ: 4.4,
      secondaryGain: 0.102
    });
    const recordedLatch = safeCrackerPlayRecordedSound('latchOpen', {
      delay: 0.025,
      gain: 0.62,
      playbackRate: 0.97,
      highpass: 42,
      lowpass: 9800
    });
    return Boolean(latchStrike || boltRelease || recordedLatch);
  }

  function safeCrackerPlayAuthoritativeCorrectCue(game, completedStage) {
    const gameId = String(game?.gameId || runtime.game?.gameId || '');
    const stage = Math.max(1, Math.min(3, Number(completedStage) || Number(game?.safecrackerState?.me?.stage || 0)));
    const key = gameId + ':' + stage;
    if (!gameId || runtime.safeCrackerCorrectCueKey === key) return false;
    runtime.safeCrackerCorrectCueKey = key;
    const played = safeCrackerPlayCorrectNumberCue();
    if (played) safeCrackerHaptic([18, 32, 28]);
    return played;
  }

  const safeCrackerClickDetentFallback = safeCrackerPlayDetent;
  safeCrackerPlayDetent = function safeCrackerPlayDryRatchetDetent(digit) {
    const now = performance.now();
    if (now - Number(runtime.safeCrackerClickDetentAt || 0) < 27) return;
    runtime.safeCrackerClickDetentAt = now;
    const played = safeCrackerPlayMetalDialClick(digit);
    if (!played) safeCrackerClickDetentFallback(digit);
    else safeCrackerHaptic(3);
  };
  playDetent = safeCrackerPlayDetent;

  const safeCrackerClickTumblerFallback = safeCrackerPlayTumblerLock;
  safeCrackerPlayTumblerLock = function safeCrackerPlayCorrectNumberSound() {
    const stage = Number(runtime.game?.safecrackerState?.me?.stage || 0);
    const played = safeCrackerPlayAuthoritativeCorrectCue(runtime.game, stage);
    if (!played && !runtime.safeCrackerCorrectCueKey) safeCrackerClickTumblerFallback();
  };

  const safeCrackerClickFeedbackFallback = safeCrackerPlayFeedback;
  safeCrackerPlayFeedback = function safeCrackerPlayWrongOrCorrectNumberSound(tier) {
    if (tier === 'green') {
      safeCrackerPlayTumblerLock();
      return;
    }
    const settings = tier === 'yellow'
      ? { gain: 0.24, playbackRate: 1.04, haptic: [10, 40, 12], lowpass: 5700 }
      : tier === 'orange'
        ? { gain: 0.3, playbackRate: 0.96, haptic: [12, 46, 14], lowpass: 4800 }
        : { gain: 0.36, playbackRate: 0.87, haptic: [14, 52, 16], lowpass: 4000 };
    const cuePlayed = safeCrackerPlayIncorrectRejectCue(tier);
    const recordedPlayed = safeCrackerPlayRecordedSound('incorrect', {
      gain: settings.gain,
      playbackRate: settings.playbackRate,
      highpass: 42,
      lowpass: settings.lowpass
    });
    if (!cuePlayed && !recordedPlayed) safeCrackerClickFeedbackFallback(tier);
    else safeCrackerHaptic(settings.haptic);
  };
  playFeedback = safeCrackerPlayFeedback;

  const safeCrackerAuthoritativeRenderFallback = render;
  render = function safeCrackerRenderWithAuthoritativeCorrectCue(game) {
    const previousGame = runtime.game;
    const sameGame = Boolean(previousGame?.gameId && String(previousGame.gameId) === String(game?.gameId || ''));
    const previousStage = sameGame ? Number(previousGame?.safecrackerState?.me?.stage || 0) : 0;
    const nextStage = Number(game?.safecrackerState?.me?.stage || 0);
    if (sameGame && nextStage > previousStage) {
      safeCrackerPlayAuthoritativeCorrectCue(game, nextStage);
    }
    return safeCrackerAuthoritativeRenderFallback(game);
  };
  // SAFE_CRACKER_CLICK_CUES_V16_END

  // SAFE_CRACKER_DIAL_CLICK_V17_START
  function safeCrackerRatchetNoiseBuffer(context) {
    if (runtime.safeCrackerRatchetNoiseBuffer?.sampleRate === context.sampleRate) {
      return runtime.safeCrackerRatchetNoiseBuffer;
    }
    const length = Math.max(160, Math.floor(context.sampleRate * 0.065));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) {
      const toothEnvelope = Math.exp(-index / Math.max(1, context.sampleRate * 0.00135));
      const scrapeEnvelope = Math.exp(-index / Math.max(1, context.sampleRate * 0.0095));
      const randomMetal = (Math.random() * 2 - 1) * (0.82 * toothEnvelope + 0.15 * scrapeEnvelope);
      const edge = index === 0 ? 0.98 : index === 1 ? -0.88 : index === 2 ? 0.56 : index === 3 ? -0.27 : 0;
      const chatter = index > 3 && index < Math.floor(context.sampleRate * 0.018) && index % 17 === 0
        ? (index % 34 === 0 ? 0.16 : -0.13) * scrapeEnvelope
        : 0;
      data[index] = Math.max(-1, Math.min(1, edge + randomMetal + chatter));
    }
    runtime.safeCrackerRatchetNoiseBuffer = buffer;
    return buffer;
  }

  function safeCrackerPlayRatchetImpulse(options = {}) {
    const context = resumeAudio();
    if (!context || document.hidden) return false;
    const delay = Math.max(0, Number(options.delay) || 0);
    const duration = Math.max(0.009, Number(options.duration) || 0.022);
    const startAt = context.currentTime + delay;
    const finishAt = startAt + duration;
    const source = context.createBufferSource();
    const highpass = context.createBiquadFilter();
    const bandpass = context.createBiquadFilter();
    const gain = context.createGain();

    source.buffer = safeCrackerRatchetNoiseBuffer(context);
    source.playbackRate.setValueAtTime(
      Math.max(0.78, Math.min(1.34, Number(options.playbackRate) || 1)),
      startAt
    );
    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(Math.max(90, Number(options.highpass) || 700), startAt);
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(Math.max(220, Number(options.frequency) || 3200), startAt);
    bandpass.Q.setValueAtTime(Math.max(0.55, Number(options.q) || 4.8), startAt);
    const level = Math.max(0.002, Number(options.gain) || 0.16);
    gain.gain.setValueAtTime(level, startAt);
    gain.gain.exponentialRampToValueAtTime(0.0001, finishAt);

    source.connect(highpass);
    highpass.connect(bandpass);
    bandpass.connect(gain);
    gain.connect(safeCrackerAudioBus(context));
    source.start(startAt);
    source.stop(finishAt + 0.012);
    return true;
  }

  function safeCrackerPlayMechanicalRatchetClick(digit) {
    const step = Math.abs(Number(digit) || 0) % 6;
    const variation = step * 24;
    const toothStrike = safeCrackerPlayRatchetImpulse({
      duration: 0.013,
      gain: 0.335,
      highpass: 1750,
      frequency: 5050 + variation,
      q: 9.4,
      playbackRate: 1.04 + step * 0.006
    });
    const steelScrape = safeCrackerPlayRatchetImpulse({
      delay: 0.004,
      duration: 0.027,
      gain: 0.105,
      highpass: 860,
      frequency: 2860 + variation * 0.7,
      q: 1.65,
      playbackRate: 0.91 + step * 0.005
    });
    const pawlCatch = safeCrackerPlayRatchetImpulse({
      delay: 0.019,
      duration: 0.033,
      gain: 0.205,
      highpass: 310,
      frequency: 1420 + variation * 0.45,
      q: 4.7,
      playbackRate: 0.96 + step * 0.004
    });
    const reboundClick = safeCrackerPlayRatchetImpulse({
      delay: 0.039,
      duration: 0.014,
      gain: 0.092,
      highpass: 1180,
      frequency: 3670 + variation,
      q: 7.1,
      playbackRate: 1.01 + step * 0.005
    });
    return Boolean(toothStrike || steelScrape || pawlCatch || reboundClick);
  }

  const safeCrackerMechanicalDetentFallback = safeCrackerPlayDetent;
  safeCrackerPlayDetent = function safeCrackerPlayMechanicalRatchetDetent(digit) {
    const now = performance.now();
    if (now - Number(runtime.safeCrackerMechanicalDetentAt || 0) < 24) return;
    runtime.safeCrackerMechanicalDetentAt = now;
    const played = safeCrackerPlayMechanicalRatchetClick(digit);
    if (!played) safeCrackerMechanicalDetentFallback(digit);
    else safeCrackerHaptic(4);
  };
  playDetent = safeCrackerPlayDetent;
  // SAFE_CRACKER_DIAL_CLICK_V17_END



  // SAFE_CRACKER_ORIGINAL_PCM_V27_START
  const SAFE_CRACKER_ORIGINAL_CLICK_PCM_V27 = "AAABAAMAAAD1/xAAKwAmAAcAvP/z/0YAgABjANr/DwCdAAoAq//A/7v/bAGmAen/sf8y/xsA6wDQAJ4AQ/+i/zkAYQDHACkAlf8kAAYBXAC1/87/yv9dAGAATAAf/3H/ggDKAJgA//49/z0ACwErAM3+Xf/U/68AmgCP/3z/nP9tAEwAYgBI/8D+AwCBAJP/SP9SAIcAzwDx/8T+4P9CACf/7f5mANoABwHO/or+8v8uAfb//v2I/zgAvv9g/6n/Vv9A/9n/3f+Z/8//2f/w/7UAKADJ/fX+EADe/+EAigCg/3X/1wCtANr/GgAT/4n/0gCiAHwA1//E/5z/KwBrAVUAo/8yADsAMgAxAIf/H/+9AAMBw/+C/3wA1wB3AKkADwBy//3/Zf83ABMBSwDZ/8wABgEdAOL/X/9t/3EAJwDS/4oAyABCALf/bf9DADUA5v8BAEUAgACq/1T/gACKAMD/RwDwAFIABgADAMH/CwBTAA4A+f9nAEQAdgBaAJ7/zv/6/93/qf8WALz/VQBbANz/0v/l/3AAJQDu/4z/RP9cADIApv/g/+kAfwD3/63/qv9rAJAArQDz/37/3f8SABMBuwA1AP7/DP/3/wYB3QBg/pv+FAGuAJwA2P+I/wMAYAGWAFX/cgAQAD/+nf9gAdsANf/Q/rL/yQBiAXv/5/6GAPwAf/9Q/5v/+/4uABABfAD9/z0AKgBTAEUA9v6D/4QAGwGHALD/p/+4AAoBQv/d/l0A3f86/4gAov/g/j3/sQCSANn/if9e/kz/5wAcATn/fP1J/8T/If81AIcAxv7N/x4BE/9p//oA2f/9/uP/ZP9B/2MC2QAL/bkAwwKM/XL+zwIcAcX+mf/4/0AA0QCl/8L+bQHtAKf9CAImApv9OwBrAXr+v/+UAVX/LQBqAb39V/8pAi0Asv4UAykBBv1+/u//mQFgAQL/0v+8Aa/+qP1RAoMBY/0M/2ACcQArAe8BCPvlAJQDN/3w/zoEK/4C/FsAZgFwAs/+CvyIAPYFof0t99QF2wJR9w0BNgYg/F3+LQBe+qIF8QBY9OgBhg+U9ybtlBAZDQ3p3vOVJDYb3xeXGobNyc/fBXMuCSaZ7Yvzofgx74P4CAjNCGXw+/BQBBsH2/qp9tH/wQKjAs/3n/ltBFMD+vlf/EoEvP6D/e3+ZwDi/jD/PAFt/x0AEv4f/pcDAwO7/UP+cAFv/uf/xQINAm7/Bv9XAy8Cq/5J/kgAMwPNAk3/Tf8z/57+yQIwA8v++v00AN8AMwCB/ln/j/9yANUBLf48/zMCqv4N/hQB8v3z/GECNQMp/1L86gDzAUz8+wH1A637Xv51AygAwf6j/wMCFgD7/BEBbATCANn8cf70ACYBKACSALsAQAAj/7H+6ADsAOz98v67/7//zf+GAO8AiP5z/pMAtgDPAB8BN/9X/18BwQBFADkADAAtAO7/CQAEAO0AlAHb/5H+FgBEAA//jQDoAMj/QQB0APz/p//4/wUBJgBTAFMARv9BAIcAdf/H/8sAT/85/8cAYwBiANf/mP8QAJcA/wAlALH/lgBWAA//hgCNABf/QwB7ALj/g/85AHUAuf+O/5MAlwCk/9b/nAAyALL/DQDeAOX/vv4GAE0AEv8x/yMAtP8uAIIAQ/+S/37/Hf/v/1AA6//M/kX/kv9F/xgBLgC4/o//YwBx/+j+3v9l/9v+1v9JAGX/dP+9/2j/cv9J/z8AygAAAOX+cv/2/7b/YQC0/8f/HQCkAM8AjP94/7z/zADDAI3/wP+ZAEcAov9zAEAAK//1/28AeP9j/wEAPABKAMT/IAA0AA4Ae/85/3IAZABZ/z0AFQHy/4D/0QCLAVYAPQC/AOAAFwFxARwBLwBtAIgAHAFzAb0A5/9nAEIBugBhADUAHQCqAOIAUgDN//IAwACs/zcA5wCiAL7/TACsADEAtf/a/z8B0wDB/1H/HgCHAGQAEQFBAMP/u/8MATMATP44/8oApgEi/2D+xf/E/+T+6v6u/9b+bf9VAK3/C/9o/jf/uv8AAEf/k/7h//L/yP4M/97/Hf8t/5EAQwCO//X/wv9g/83/mgBQAGf/1v/s/+f/VwC1/0D/xgBMAZH/Wv8k/7H/qgChAPD/o/7x/5AAVQDk/4D//v8uAGAAov+9/z4A+//w/8b/pf8gADsBRwD4/hcA3AA0AEr/kP/8/67/x/9JADIAR//f/vb/7wBt/8T+0P8UAKf/i/+5/7X/fv+G/8X/IAAZAHb/0v8yAMr/Hv+T/3cAuP93/wkA/P8AAO7/aP+//w0AkgALAJX/IABb/y7//P/r/wsAHQDN/zYAHgDQ/+P/EAD3/1X/6f8LABEAyQC4AMz/nP+GAFwAXf/Z/6b/w//aALgAOQB0AKAA5/8xAIsANQDc/1EAuACQADMALAAIAP7/WACbAOkAOgAk/yMAFgC0/+IAiAAZACIA7ACcAOz/ZQBCAC8AiwBlAEoAPwBTAMwA7/+4/18AKwDzAJgARgBTABcALQAqADgAAwDiAL4A5f9DAD8A6P8uAKgAIAAJ/5j/HwBN/zT/ZABuAH8ASwCY/xn/fv/M/77/TABc/2EA0wAiAJj/s/5lAJUArf/b/6L/HADU/7H+SwAvAfL/8f9z/97/6//aAF8Bb/69/sj/igAFAVz/of8W/3L/AwDv/1kAJP+l/tb/0QCxAHP/cf7//m8BsgAU//b+/v+pAZr/j/9y/yL/RgAKACMAyP+T/9j/1/82AXwAAf9R/+D/CgFUAKv/kP78/ucA0wCxAIP/of5JAB4Ap/6M/1oA5/8y/5AAFgHk/yj/fv93ASMBtwC7/+v+YQByAIwBFQEb/4EAxQCY/8H/LwDEATsAZf8gAD//VQB2AFP/UwBAAbIAdP/A/zMAqv8XAN3/uACdAEz/GQCSAEj/YP8LAKEB5gBf/j//7v+JANT/bv+K/zj/XgADAO//xv9C/8X/HAAI/5r+4v9YAGj/iv9cABIArP9n/xEAvwABADb+sP8dAXEAAf/O/74APAC0/7f/AwC7AHwAnP/z/48AAAB6/+X/hABaAHoA9f8TAC4ARQDc/mv/awDk/wwAOgAsALL/kP+x//r/6P/XAJoAc//Z/vf/nQEJAN/+WgAVAfT/1v/p/0L/wv8JAM0Asf9p/U//UQC5/03/fv95AP//Uv6G/vr/7P5M/jcAqwCM/xP/dv8mACsAFwBb/3f/DgAqAHH/RQBV/8v/zgEwADz/Y/88ATcB+v9A/+4ASAHM/7D/xP/yANIA9v8+AGoANgA/AEkAqwDu/wsAJACS/yUA9//XAU0Dkv6+/Wb/LQDcAbf/pP/f/y8BIwA9/z0AC/9h/xEAKAAHAZIAdP9XAKn+q/4zAJ3/1/8BAREAPAAr/wwAGgGFAC7+Ev6AAcYBvP96ALMBPgGU/yX/pAHJAdAAqv+N/iwA6QDoAdn/1v79//T/i/9YANQAeQCb/lz/5gBCADoAJQA6AOH/GADBAAAA6v/h/vX+eAGCAIr/NAHjAaz/EP+A/4MASwA9/4z+YwBGAVkAVQDf/S3/0wCPAEMAyv5k/4oAPQDw/sL+Tv+UAGEBAQAV/7f+AgEWAXn/Cv4V/6IBbgA2AKcAmwA6AGAARABS/9j/3v/A/2D/tv9yACwADgBhACgAsf9kAbAASP8S/7L/JQL5AP7/t/5T/5sBJQFK/9r8OQDAAXYATf/2/xEBugBAADoArQBWAEMAeQC3AOEAuP/m/dwAlgHNAaUAQ/91AOMBAAKW/qz+of9VAV4CKAAFAIIAOwA6AOf/DQGzAfb/K/+a/x4AYAB7/5n+Iv/3AUwBnf+0AHsBGwA//y7+Uv/cAOf/UP8A/w8AcgBJAE4A9v9l/7b/Kf+F/r7/dv9//8UA+f+f/yEAmADk/7D+uP/XAXwAd/7E/SoA+gGk/8j+2f5wAHMAAP8XAYMCYf97/qn98P6XAaj/6P0E/5UBQAFE//X9V/9oAH8AYwCd/47/Jf9qAPYAMf+s/mP+4wBqAj4A9v7b/fb/0QF7ALP/+v8vAHoAyf9x/2UA8/+s/8cB4QFcAOX+mP5JAacB9AChACMAQQBlAf0AM/7Z/lIANf6c/p4BFAHI/9n/MQHbAfIAQAA9/xMAnQAn/4H/swAiAaYBYgDR/8X/KQBtAaQA0f8k/8L/XAHBAMIASwF2/2P/bwCuAikC8v20/kL/sP4GAO3/wv7H/2EBvwHPAKb9lf1W/xcAYwBt/hX/LAAfAd8B+f6F/gUBfwES/5f9h/85A3cA7/3I+2L+cQW+AVr+Mv7u/vEBWAGA/0gAogDw/yr9uv0iAkUCPAAw/kb/wgF9Aab/Wf5F/xQBeAHE/mT/lgCDAXgDwv8Z/tL+W/9OAUAB5P+ZAYsC4AA8/kYAbgQMAFL/BQDD/w8BSQCi/hH+d/+CAJz+Lv7+APgAqf8vAAsCsP8L/6YCMf/B/PUAwAG2AI4AcP9p/er/pgQeAj7/MP3Q/hIC4ACRAFf/Y/88AIkBDACT/pb/Rf8//oj/Tv7m/dH/IgLw/97/JQJS/oT/CgMP/zH8kf2kAq0GRP1i+87+vABOAUz+fQCZAoIAT/44AeMEX/7U+7gBEQVW/qv77gWcARv7PAPsCjMEQ/49AbUItAclDpT+c+fo93kIVyL1DSThn+xn/Z8McQTR/yrwgdFGAfQkkBnYzuSxbQKyEqr99Pg+BmQKgSoVNwj5wu8Q947qgvk/BeMARxJ1GuQQ7AzW+jP3twQZCbEKYfh5/RkJeQsHBov/TAsTDYDogt/N/b8J8QJ97Pn3zAbRCosBH/HC9cz/SQ13Chz9AvKf9d4JGQPD92X5sAIwBW4As/K39vcCNP0o/+D/Z/8G+YPzp/+7BET9afE18xQEr/4R+En+r/ZO9cD3N/vCBGv7NPFV/lYAvvxH+nz37f0S+0f57fRE9an8xvs19af+cf3488frEAdnBW7un+oEE9gInN6Y4xQO/hAS6FLlxCGjDbOlgcQT+TNBjgfDrWzElwWHO0P7fsZM9sMzzwv1zevtRitoCCfIqe8/Pfs/eNjY8vnrZNOf63IJAyfREwbh5fDi3/PbGBviI68AJfBCB6AIjezCFAY5r/3p8s4QuhVB8tb31ArMIkMYzf7G8oTz3R3mETYNXAZXDCAaxxsgFNjrF/OSE+wkIBkF+5ICABLoGmsFxf+cAnAQsCCoChwGuPwlCAQc7R7iFi77A/ZWDn4icxSp8E8H/CGcEAj1sQKpBDz/Jh80GV//efGzEjIeqg/uA7LwegTaF8ERLv4k/3wJIARHFT8Pc/m5/L4PgREw/m//4P1iBqETYhCb98vwVQ+yDo8FuP+P/PMB+AdoD4v/sfQp/xQNiwyc/Lv3YPevCsMJFAHZ9rr1eQ0rBlz+Sv2P+F/6DgZ0DlT6nPFHALkHX/zb91b+evm/AgIHpfw39CD3sQWxAwf/C/rb9/j+3AC6/ej84PuK+A8D8wjl9rz0YQHXAkj8VACE/2P1sfvrAzD7PPVT/jkCwvw0/mn+EfrB+vcBFwLd/Sv5ovmQAmACg/jp+pUB+v4s+tT/Xvoi9HIARwVO+1D4iQAd/q394gC9+0T6wPzUAT4A//tX+0z7NwD2//H8HPsc++T9TwAq/sn30PsnABz+Df4w/N/5xvyDA0v+rPi+/Bf+Rf3Y/er88fip+6L/nv4I/XP5ZfrC/nP+ofnR+aT+cfwc/hD/sPnp9879NwKo++X5T/qS+lf+DP7q+pr5k/3f/Sr8w/s3+Xr6Mf4U/w76fPl9+g/7BwDV/WX5Nvkf/eX+RfsJ+x/7nfs7/b3+5Pi59pT9lf4h/RP7TPtf+5j89f9k+xn5svv5/UD94Pyj+nv31/55AT/80Pmb/NL9Tvwl/+L8/PnC/bn/fvwX+2r8tfqT/mgBaPyi+oL9Qv+c/VP+IP0j+37+wP91/S77Z/12/rj/SQAf/FT7uv1/ADb/9Pyd/ZP9b/7e/lL+M/zu/MoA5QDZ/gX8Af0o/80AwwDy/A39uf/K/0T+jv5S/vD9wwA4AUT+Bf0v/9MAvwDN/+b8gP0/AXMBIf+7/tz/9f/0AOcA5v4q/u8AQAJyAM3+Xv7D/5gBSwGr/7v+PwCoAdwBrgA6/t7+KwFVAgcByv4S/+wA3wEQAab/lv9mAY4CPwH7/zv/aQDzAQkCoQBo/zcA+QE+Aj8BRQCZAEAC4gL6ALH//P8JAvwCqgFlAPT/twEUA3IC9ACbAOUB5QK8Am4BkgA9Ac8CagOJAY8AOgElAx4EgwIcATMBXgILAycCGAGlAbkCSAPWAjoBSAFiAsED9AMYAs8AswF0AyIEzAHRAH4BJQRcBKYCOAESApsD5QOsAlsB/QFnAx4EsgPCAXcBpwISBC8EcQKtAYYCvQMMBM8CzAElAqcDCgTRApIBeQIuBIUEZQMLAqMC6wPNBBIEfgKEAscDnwS4A5cCRAKJA98EewRbA6YCEgM0BCkEYAMeA7gDZQSTBBMDWAL9AigEMwVLBP4C9gIWBN4E8wMWA68CaANyBDYEjgMcA0oDLwT7AxID7AJYAyIECATbApMC8wIOBD0EVAObArwCowP6A3EDsQJeAjUD2APNA44CogFgAj8DHgN6AioCqwJxA2gDWQLKAcIBuQJpA9wC5AGNAVMCGgOnAsMBtwF4AgkDqwJ2AVAB5AG8ArAC2QFVAccBogKBAssBEQFAAX0CogIhAhMBsACuAW8COgJUAacATAGaAcYBegEyAVcBZgFcARoBWADDAMgBLwJ/ASsAGAB0AQkCeAEjADkAMQFlAXcA3v9EANsAWwHDAEQAvP9mAIwBWAF4AML/DwAJAfgAoACq/4z/YwCfAC0Apv+0/1QA2gAVADz//v5o/wQA7v80/yL/1v8gAL7/KP+T/tr+Vf9d/+n+q/6q/kT/dP9+/ub9Av7z/mz/hP6s/U79Lf7l/ov+3f1R/az9J/4c/oT9GP1+/QP+EP4b/X78z/xv/dD9Vv2c/Kj8LP1j/d38Gvwu/AH9Zf0V/XH8QvyZ/Of84Pxj/BP8ZPzD/Fr87fuy++L7qPzm/Gn82/vH+xD8SPwF/Kf76/uL/Kr8V/yN+0778/t4/ED85/u4+wL8S/wI/Lj7o/v0+4D8aPwh/O77vPv++zP8zPu++xb8ZPyD/CX83fvA+w38rPzU/GH8Efxd/Lv8lfxK/P37R/y6/KX8L/y0+0n8//zi/I/8ffyI/Nj8r/xz/HD8aPzE/Hv9Rf2U/If8vfxO/Tz9wPyr/P/8Xf2A/fb8V/y1/Dz9iP10/er87vw4/Zb9bv0B/eT8Tv2c/TT94PzM/Lj9HP4i/rf9/vwr/a397v1g/Sf9fv38/SD+m/2A/YL9xP3P/b79hv1s/Qj+Lf4H/nT9Sv0I/nr+Qf5u/aD9Ef5i/s39vv3R/fX9lP7m/kn+E/5x/jT/Hv+v/ov+Zf7P/in/PP+o/mr+uv7k/ywA9v5E/r3+Xf89/zL/6/54/5f/kf8Y/2j/2f/K/yf/g/8n//X+dP86AncE5wEj/w0DIAMY/Cn6av2aAMQB/v1n/Qn9qwD1AQwAO/6u/hEB4gBB//L/8wCJAAoAhwD0AHQAu//dAPIBtgAMAE4AEgFIAaIAngDaAB8B/gDtAM0AGQEUARYBUwElAdgAsAAgAQgChgEtAewATwG+AYQBNAElAaoB/AHeASsBVwH1ATICogELAV0B4QH0AbkBfAHhAc8BwQEbAhkCHAKPAZ0BNwJtAqABqgEnAowCYgLCAboB7AEzAoYCLgIQAjMCXAJGAlgCqwGVAZACGgOTAsMB8wHOAgYDcwJxAqgCnQLzAqECbwJQAqYCHAMUA28CSQK9AuwCkwJ3AmcCeQJsArAC1gJ1AmsCiwIEA80CIAIyApsC7AJUAtsBAwJcAqkCjAJ7AkACHQJYApQCMgLtARsCbAKjAkICFgJGAooC6AJnAggCKQJtAq8CVAIbAsoBpQGHAvICjwJQAiMCdQKiAuQBMwK7AtQCIANhAvEBFwJTAhoD8QJrAn4CxgIoA+ECcQLBAvgCHgMeA30CRAJoArQCDwOxAnwCigLIAmMDJgOnArUC+gJbAy8DvgKyAqYC3wI9A+QCpwLXAu8CRAM0A6MCoAIPAyoDzQJyAooCBAMLA7QCiQI9AloCwAKzAmYCLwJ/AscCwgKdAiwCMAJ4Am4CKwLiAf0B9AH6ASMCygHOARECGwLfASYBZwERAtYB2wEIAuYBpQGYAbsBeQE+AT8BuwHvAR0B6QDoALkA7gDpAPIAiwBPAMkAuQCuAJcArQAYAV8Au/8FADAARQB1AHkAIgBsAAUBlwDs/43/6P+vAIUAMwDs/4n/vv/j/+v/1v+P/9j/4P+U/5v/df/t/4IA1P9J/0f/g//+/9T/3f/U/wf/Fv9E//f+P/+I/9z/w/+h/mL+7v7R/in/vv9X/+n+AP9r/4T/4/7r/lf/QP8p//z+D/8V/xX/kv8s/27+iv4t/+r/TP89/k7+oP4D//7+xv7P/mH+V/6L/ib+S/7G/uH+6P6g/jv+Wf6s/rH+fv5Z/mD+ef5+/kv+Ev4o/jr+O/4Y/pj91/2p/tX+8f67/uj9zv0h/j7+Rf72/SH+n/49/rv9rP3m/Vn+V/4c/h/+5P2v/cz9sv2o/Vn+xP6G/oX+N/7X/fz96f0Q/mX+Uf41/gL+7P0Z/ib+Iv5T/nz+Df7d/Xv+qP6e/uT+nP5M/lH+Uv7k/hb/nf4H/0D/lf5Y/jP+Yf4M/xr/Av/N/mP+pv4k/w7/lP6U/tD+nv6c/un+Hf8U/yL/Mv/j/t/+6P7C/vv+CP/8/jz/Pf8x/1j/Hv/S/uL+H/99/2v/LP+I/5H/CP/V/v3+WP9W/+3+Hv+c/3X/8/4e/5r/bP8T/xH/jP+P/7/+x/4K/83+4/4O/w////4R/0D/K//L/tj+Uf9H/x7/KP9O/2H/DP9A/6H/YP9F/1r/fP9s/xr/Sv9w/zr/KP87/4r/pv+H/2T/Vv+P/4P/Xf8N//j+iP+W/4H/Y/9L/2X/3P74/rL/0P/R/57/W/9c/2P/ef+X/7r/zf+B/yb/T/+W/3X/XP+b/7n/f/9S/4f/tv+z/wAABQCx/3P/Qf+Q/8P/gP9w/77/CwC2/1z/o/8PAOz/k//M/wQA6P+E//f+WP8HAJz/WP/i/xoA6P+S/9n/YwAvABgALAAAAM3/xf8WAEYAPAAWALD/S/9F/2X/nP8BAOf/iP+F/87/EgDb/6D/uv/N/7H/S/8r/57/uf+f/9//2v+q/3L/Y/+t/5b/Z/9k/17/af91/0r/DP9N/4r/df8V/73+8v7y/vz+Mf8g/zf/Kf/0/t7+4/4s/z7/9f7U/tT+Gv9k/xL/zf7Z/g//Rf8O/+v+7/4M/0j/Hv+b/m/+yf7t/ub+9f70/hD//f6z/qz+yf7A/uD+9P7q/vv+wv6z/u7+Cf/U/lv+av7s/in/1/6L/qD+v/7v/u3+0f6a/pX+Bf/9/sf+w/7x/in/2f64/uT+5P79/ub+w/7b/t3+LP9R//r++f7w/t7+Fv8f/8b+0P5p/3j/df9P/+D+BP/V/r3+Pv+F/33/Ov8//2j/S/9d/8n/3/94/2D/l/+v/6D/lf+U/5j/mP9+/2X/QP9c/5f/p/+t/3X/dv+n/4X/c/+K/4H/Wv9D/1n/kv+p/5T/fv+T/0D/nv74/or/xv/m/4v/VP9F/y7/SP9+/0//+/5j/8z/sP9G/0D/pP+n/wwARADJ/7L/gf8q/2P/tf/Y/+b/y/+s/3T/PP+Z/yMANgDv/5P/i//8/xsA9P8EAB4APwDb/5T/7v/2/wAAGwBNAF8A2P/G/z0AYgA5AGMAnQCRALQAvgCzAL0AuwCSAH4AwwDQANQA1QC9AMIAngDlAFkBYAEzAcQA1gAbAe0AYgHGAZMBUAHKACMBzAHRAfUBxgGXAZcBkgGVAXQBrgGZATwBVgGVAZoBXgF0AbEB3wHrAboBvwHdARwC/AFzAZcB9wEIAuoBswHnASoCDALnAaoBzgFGAjACFwJLAkoC+AHVAd8BowGfAegBOQITAowBhwGCAW4BrgGlAXkB5AFEAvIBmgF5AZ4B4wH1Af8B1AGyAcIBrQF8AXcBqQHJAbsBhAF6AZcBrAHnAQIC+wEEAhYC7QGlAaYBmgGkAdQBzgEGAi8C5QHcAdMBjAGRAb4BEAIZAsgBrwGYAdUBJAL1AbIBvAECAhgCOQIgArMBzgEOAiYCLQIQAisCPAL6AfIBIQJAAmgCSQIpAvgBpAETAogCgwJ5AhgC0QENAo8CwgJiAlkCZgIBAhkCYAJUAkYCSgJnAiMCHAKXAq0CnwJXAhwCQgJ6AuMCuQJZAoEChwJqAksCRAKCAnwCLAIpAjACDwIkAkkCVgIKAngBhAHYAbwB4QEhAgwCKgInAvYB0gGhAb4B6wH4AcsBYgFvAboBowFsAZ8B3AG4AbMBogFXAVoBVwEhAVsBjgFFARoBCwH0AP0AEAEiAREB8wDuAJwASgChANoApACFAIMAhwBsAH8AmABzAHEAUQBOAF8AOQB6AL8AkABkAIYAxQCrAFcAUACVAMAAywClAC0A+v8JAEQA4gDPAGoAigA+APv/+v/M/x4AewB4AHAAcQBaAD4AXwBdAE0ATAAeADwATQALANP/yP9ZAOoArgA9APr/7P8QAA4A9f/6//f/FgA1APT/vf+5/7L/tP+7/6b/XP9Z/9T/7f+g/7D/BAD//5j/Y/96/4f/c/99/4L/SP83/y7/G/8m/zH/bf85/7L+tf7E/sD+qf6a/sv+pP50/pT+x/6B/s/9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s//F/7//zv/f/93/4v/d/+D/8P/V/8z/8/8JAAQA7f/R/8z/5//z/wAAAgDt//T/7//f/9n/0//j/+7/2P/Y/83/v//N/9H/xv+u/87/8f/s//z/+v/m/+X/4P/3/xAAAAD0/+b/+v/4/9f///8lABUA/v/w//L/AQD7/wMAGgAaAAoAJwBGACgAKQAfAAcAEQAQAB4ANAAUAAAACgD6//3/CgAAAOL/8P8KAA8AIQAVAAgA/f/o//b/GwAiABoA/v/t//X/8P/u/+T/7P/k/9z/8//w/+L/6f/1/wUA/f/i//7/CgADAAkA7f/N/+L//v/r/+L/5f/4//n/0//N/+P/0//D/+T/+P/2/+b/6f/6/wQA8//p//3/BAANAAUA//8PABoABAD7/wcAEgADAO//CwARAAgACgAKAAUAHQA1AB8ABQAFABsAJAAsACkAKQAeABIALgBFADgAIAAnADgASQA6ADQANAAkADkATAA7ACkAMAA0ADsAJQAbACYAJAAvADAAIAAeADAAKgAmACAALABJAEEALQAtAD4AQwBNAEIAOQA2AC4ANABFAEMALQAwAC0AMgAzADMANgA0ADUAMAAjABsAOABHADwALwA2ADgAOQA2ABMAEQAcABkAEwAXABwAQABAABIAFAAXABcAJgAnACgASQAyAAkAFQAnACoAEAAGABIAJgAkABUABAATACoAHwAZACQANQAgABcAGAAQABkAMQAuABoAEAAAAAsACgAAAAIADgAKAPj/+f8LABQA8P/g//D/AADz//b/BgAAAPr/+f8EAPj/6f/m//b/8//v//X//f8GAO//8P/0//L/AwAbAAoA8P/i//X/MQAyAAkA8v8PADcANwAVAAsAGAAeACcAIQAqACUAJAAuADQAOQA+ADoAMQAvACoATQBSADQAJAA0AEcARwBBAD0APQAhACIAOAA+ACAAEQAgACUAIAAMAAUAAgAPABUADgD3//j/FgAaAAgA/P8XAB8ABgDy/wYAFwAOAA0AGwAiABkAMAAkAAgADwANAPb/AAATABsALwAbAAQA+P/6/wIA///v/+j/9f8KABIA7P/p//r/BgAfACsADQDz/wcAFQAQAAcAEQAGAAkAEgAHABoANAAoABUAIgAeABYACwAdADYAIgAQABQAEAD5//r/AgAWABAA+f/6/wUACgAGAP7/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DADu/9T/1P/c/9z/1//m/+T/5f/v/97/0v/d//D/8/8DAC0AGwDv/93/z//f//L//f8BAPH/7//r/+r/8P/g/9T/zv/U/+X/4P/p//r/9//8/+b/1v/u/+//7f/7/wEABgACABsAJgD2/+v/9f/0/w0ACgAAABIAHAATAAMABgAbACYAIwAcABYAAgAEABwADgDw/+b/7P/0/+z/5f/u//n/9f/x//j/+/8IAA8ACgAJAAYACAD9/wgAOgA8ACQAHgAPAPr/8/8TACQACQD9//j/8f/w/+z/7v/r//X/FQAQAPP/6v/f/+j/8P/e//T/CwANACcAFwD1/+r/3/8OADMAHwAiACIAFQAVABAADQAUACMAKAAoADEAIAALABoAHwAZAB0AGwAfACQADgABAAMA/f/9/wgACwD+//v/CAD//+//+P8HAA8ADgD///b/8//w//r/+f/r//T/+v////j/1//m/wQA+v/8/wEA+//0//H/8//0//r/6//L/8z/5//7//z/+P/z/+z/6//q//r/BQAEABUAGAANAAQABwAtACsADQAvAEkANwBCAEoAKAAgABoAFgBEAE0AOQBBAD4AOwA8AFQAWAAeABMAMwAxABcABAASAAYA9v8VABMA+P/8/xIAHAAeAD4APgAGAPX/EAA8AEkALQBBAFIANwAxAB0AEAArADUAUwBaACEAEwAoACMAFwAYABYA///3//3//f8IABwAMAAkAAUACgAWABAAEgAoADkAOwA+ABwA//8UAB8AGgAcABcAHwAzABsA/f8SAAoA+/8OABAAKAAPANL/8f///+b/8f8BAAUA5//e/+//4P/r////+f8FABEAEAADAPL/AwAXAAQA//8JAAAAAQAMACAALwAmACsANQAxACIAEAAWABkAJAAxAB4AIQAgAAUACAAPABoAIwAFAPT/+v/x/+v/9f/2/+D/1P/u//P/1f/h//v/+f/3//T/AAALAA4ALwA3AB0AGgAWABcAIQAIAP3/GQAaABwALQAdABIAEwAeACsAGwAcAAsA+v8iADQAPgA4ABQAEQAJABwAOQAeABcAEwATACYAEwALABQACwAEABAAEgD3/wEAEwD8//H/6v/q/wAAAwD8//D/3f/U/9n/6f/p/8//zf/f/9P/v/+7/7z/0P/e/+b/6f/P/8f/2P/m//H/2f/I/+7/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4P/U/9n/2f/J/87/1P/S/97/3//P/9z/6P/i/+H/3//m/+D/2//k/+v/4v/W/9r/6P/m/97/0//F/8j/zf/I/8r/3//k/+b/8v/k/8X/uv/Q/97/wv+x/6f/pP/F/9X/xv+6/8f/wf+t/87/0/+z/6X/n/+1/8z/1P/O/6v/r//G/6//nv+3/8z/0//b/9D/xv+9/7j/zv/X/97/5P/W/9H/zf/N/8P/vf/U/9j/3P/e/9v/5f/d/+D/1f/V/+H/uf+9/9X/z//g/9v/2f/h/9H/wf+//8n/vP/D/9v/3f/2/+r/x//A/83/6//e/9r/4f/R/+L/3//b/+X/4f/r/9j/2//t/9z/4//x/wEA///s//r/8//z//b/6/8BAAcABAALAAcADwAQAAQA8v/2/w4ABgD5/woAGQAWABAADgAKAP7/6P/9/y4AJAAAAPL//v8TABkAKwAsABwAKQAbAO//6/8HABMAEAAPABEAEwD+//H/DQAKAPT/BAAbACEAHQAhACUAEQD4//j/DQAcACUAKgAaAP3/+/8pADAACAAQABUA+v/8/wcACAD+/+7//v8AAPn/GAAfAAMA+f8EAAUA9v/6/wwAEAAKAPz//////+//BAAeAA8A+f///wcA8f/w/wUA+v/v//n/DAAVAAQA//8GAAUABQAFAAsABwACAAgAAgD6/wQAEAAJAAcAGwAeAAoA/v8TACwAHgATABQADAASABgAGgAVAA0AHAAaABUALAApABsAKwAuABsAFAAYABQAEwAVABEAGwAiABoAIAAtACoAGQAQABoAEAD//xEAHgARAPz/+f8MAAoAAwANAA4ABwAHAAcA/v/v//D/8f/p//b/DAD6/9//4//f/9v/6f/u//D/6//h/+X/5//V/8P/y//T/9X/4P/e/9H/yv/H/8v/z//T/9z/5//h/83/yf/I/7//x//i//H/7//t/+X/3P/l/+j/3P/Q/9//9//z/+z/8//8//r/7f/u//f/AwAEAPz/DAACAOD/5v/7/wQAAQD+/wAA/P/7//f/+/8QABcAEAAQABwAIQAXABUAEwAFAP//DAAaABoAGAAXAB8AIgAEAPn/DAAUADAARgAuACIAIwAKAAIAGQAiACYAMQAsACMAHAAYABcAHAAvADIAIQApAC8AHgAdACIAIgAlACMAIgAiABwAIwAhABEAHAApACQALAAuACIAIQAgABsAGQAbACEAIAAcACIALAAwACIADQANABMAEwAaACEAIwArACEAEgAWABYAGAAhACIAJwAlABYAFgAeACEAIwAfACcANgArAB0AGgAPABMAHgAcACkANwApAB0AHQAcACEAIQAkADMAMgAjACIAIAAUAAgACwAcACAAEwAUABcACAAGAAsABQAKABEACwAMAA0AAAD//wAA+/8GABAACgAHAAYABQAJAAEA9P/y//P/7P/m//D////6//L/9v/z/+T/4v/0/wAA/P8AAP3/5f/i/+L/yf/J/+D/3f/S/9j/3P/Z/9f/4//r/9r/xP+6/8T/1f/J/8f/5f/n/97/6P/a/8v/yv+//8f/3v/h/+f/4//Y/+H/0/+2/77/0f/g/+T/0P/S/9//1P/a/+L/1f/j//z/9//s/+f/5v/o/+T/6v/z/+3/6v/v/+7/5P/c/+L/7v/v/+z/7P/0/wcACwD6/+v/5f/w//r/8//0//7//v/+//v/9P/2//z/CAARAAMA/f8GAP3/8v/3//r/AwAMAAkABQABAPf/8v/1//3//v/2//j/9//n/+b/6v/c/93/7P/p/+T/6P/l/+f/5v/m//j//P/r/+z/8v/r/+f/3v/a/+r/9P/w/+3/7P/s/+r/4v/j/+n/5//h/+D/6v/q/97/5P/x//H/9f/w/+H/5//v/+r/9f////f/9f/2//L/9v/8/wAAAQD5/+7/8f///wAA+v/+//3/9P/5/wkAEwAGAPf/DQAhAAwA///9/+3/+f8GAPf///8OAAQADQAcAA0A/v/y/+r/+f8EAP7//v8DAP//+v8BAAUAAAD+//j/7f/1/wMAAgAJABQADQAAAAEADwARAAEACQAdABQAEAAhABUA/v8GABMADwAHAAMABAABAPz/AQAFAPv//f8NAAoA//8HAAwABAACAAwAFgARAAUAEQAdAA0ACgAcABUACQAUAA8AAgANABIABAAEABEAFAARAAsABwAMABAACwAEAAQACgAVABoAFgASAA8ADAAOABUAEQAHAAYABAAAAA8AGgAPABAAHgAVAP//+v8BAAwAEQAMABAAGQAUAAsABgD+//3/CQAHAAMAGAAeAAsACwASAAgABwARAA8ACQAHAAYACwAFAPb//v8OAAoABAAGAPz/8v/1//3/CgANAPr/7P/t/+7/8v/5//X/7f/v/+//7f/x//D/6f/n/+//+P/2/+3/6v/x//D/4v/g/+X/4//j/+//9f/q/+j/8v/u/9//3//u//L/5f/f/+X/5f/k//T/+//v//n/CgAFAAIACQAJAAMADAARAAUACAARAAoADgAbABoAFQAgACgAIwAmACMAEwAVACcAKQAcACAAKQAlACoAKwAlACEADgAHABwAIwAbACIAJQASABIAJgArACgAJwAmACMAIQAoACsAIgAjACgAIAAUABsAGwADAAIAFAAUABMAGQASAA4ACwD//wQACwADAAcADgANABQAFQAFAPX/9v/8//3/9//5////8v/t//X/7P/l/+n/7//s/+H/5f/p/+z/8f/h/93/4f/Q/9P/4f/n/+v/1f/D/9P/4P/f/+D/4P/g/+D/3P/c/+f/4v/X/+P/7f/n/9j/0f/a/9z/4v/n/+T/6P/g/9z/5//o//H/7//i/+v/4//e//H/7v/j/+j/8P/5////9v/p//H/9//z//T/8v/6////+v/5//v/AQD0/+//AQDy/+X/9f/2//j/7//h/+3/8v/3////+P/z//T/+P/7//X/+f8AAP3/+P/2/+3/4//s//D/6f/v//L/8//4/+v/5v/m/+n/8P/n/+7/5//Q/+T/6//d/+//+f/0/+3/7f/3//L/7//5//b/8P/3/wAAAAD9//L/7v///wcAAQAEAAUA/P/5/wIADAAFAAAA///z//f/CgALABAAEwACAP7/AgAEAAUAAQAOAA4A+v/+/wYAAwADAAMA/f/+/xEAGQATAA4ADgAYABcAGQAcABUAGgARAA0AIAAdABoAIAAbABMAEgAcABEAAAD9//7/DwAYABQACwALABgACgAAAP//9P8LABAABAALAAIA//8BAP//AwAAAAMA/v/x/+7/6v/t//L/9v/0/+//9f/2//P/9P/y/+3/6P/6/woA9//n/+n/9//7//H/7P/z//3/+v/0/+3/3v/g/+b/4v/k/+//8f/e/9n/6P/w//P/8f/w//D/7f/0//n/9f/x//T/+f/2/+3/7P/1//v//v/4/+3/+f8DAAcACwD+//j///8PABgA+//z/wQABQAHAAEAAQAEAPz/AwANAA8ACwAFAAAA9v8EABoAGgAOAAIACQALAAIABwAJAAUA//8FABQAEQANABAACwAIAAkA/v/w//b/AQAFAAEA9P/0//D/7v/8/wAA///4//X/9//w//b/9v/0//b/4//e/+7/+P/4//X/+v/z/+z/7P/w//r/+P///wUA9P/q/+z//P/7//D//v/8//b/9P/q//z/AgD4//r/9//8/wAAAAD5/+v/9//+//r//////wAA/f8JABUACQAPAA8AAgAGAAsAEwAOAAcACwD//wAAGAAZABoAGAAGAAIABwARAB0AHAARAAEA/f8PABoAJQAqABcADAAWACIAHwAcACYAHQANABQAHgAgABMACgAYACEAHgAVAA8AFgATABEAGwAXABEAEAATABwAFQALAAwACgAJAA0AEAASABYAGwAPAAUADAAOABgAIAAaABQADAAQABgADwAJAAQACgAUAAwADAAOAA4AGQAbABgAFwAQAAwADAANABIAEgAMABAAHQAXAAkADQAdACAADwABAAkAFgAYABMAFgAaABMACgAJAAkADAATABMAEAARABQAGwAaABMAFwAZAA8ADAAUABkAFwAVABQAEgARABIAFwAcABkAEwAOAA8AFgAaABUADQAQABcAEQAHAAcACAAGAAkADwAQAAoAAwAEAAUACAAMAAwACAACAAEABwALAAkACAAIAAIAAwAFAPz/9f/y//T//f8BAP3/8P/m/+v/8f/2//v//P/2//D/6v/t//X/8v/l/+D/6//3/+//5v/m/+b/7P/t/+b/6P/t//T/8f/o/+X/5v/u/+j/4v/s/+7/6f/j/+H/6P/p/+3/6v/k/+//8f/o/+H/6P/5//D/5//3//z/8f/k/+z/AgAHAP//8v/u//X/8//6/w8AEQAGAAEAAwABAPz/DwAkABoACgAJAA8AEAANABIADAAAAAEABAAKAA8ACwAKAAQAAAD+/wAACwAGAPn/+/8AAAQAAwD+//f/5//k//H/+/8DAP7/9P/0//r////1/+X/4v/l/+v/8v/r/+T/4P/i/+b/6v/1//L/5P/l/+v/7P/r/+//9//y/+r/5//l/+3/9f/z//H/7v/s/+L/3//9/wsA9f/h/+f/+f/5//D/8//z//f//P/3//X/9//+//n/6v/w//r/8//s/+//9P/z//f/AAD7//T/+f/+//v/7//t////CgAEAPb/9v8FAAMA+//9//3/AQD9//b/9f/7/wcAAwD2//P/8v/6/wQAAgDz/+D/6f8CAAIA+//9//b/8P/4/wUAAgDw/+3/+v8AAPz/+f8FAAYA9P/s/+z/7v/t/+v/8v/v/+f/6v/u//H/8f/v/+3/7v/5//P/6P/t//H/8f/1//7//P/p/+n/+P/1//H/8//x//D/7P/q/+3/7f/x//H/6f/s//L/8//z//r/BwD+//X/9P/s//H/+f/+/wEA9P/r//P/AwAIAP3/8v/u//D/9P/7/wQAAAD7/wIAAQD7//b/8f/0/wIADgAJAAAA//8CAAMACAAHAP///P/+/woACwAAAAMABAAFAAYA/v8FAA0ADQAIAP7/AgAEAAQADgAQAAoABgAGAAEA9//5/wEA/P/3/wQACQD5//f/CQASAAUA+v8CAAQAAgAIAAwABgAEAAUA+v/6/wUABQABAPX/8v/6////AgD8//3/AwD6//L/7//7/wAA8f/2//v/7f/m/+r/7v/3//z/8v/r/+r/8//7//L/7v/x/+3/7f/v/+//7v/z//T/6//z//f/8P/1/////f/x/+7/9P/7//z/8f/z//7////5//L///8KAP7/9f/x//n/BQAAAPj/+v/9//7/AgABAAIABQADAAsADAAKABQAFwAQAAkAEwAWAAIA/P8BAA8AGgAKAAMACwAPAA8ACwACAP7/AwAGABEAGQALAAgABgD+/wUADQANAAUAAQD+//7/BQAEAAAAAQACAP//+//8//n//f8EAAAA9v/v//7/CQAAAAEAAAD///7/+v8FAAoAAwAEAAAA9////xIACQD5//v/AAADAAIA/P/2/wIAEgAKAAkACQD+/wYADAAHAAgACwAHAAYAFQAaAA4ABgANABsAFgANAAoADAAWABYAEAALAA8AEQD6/wIAIQAgABQAEAAPABAAEgARAA8AEQAMAA4AGgAcABQACQALAA0AFgAcAAUAAAAOAA4AEQAWABIADAATABoAEwALAAMABgAQABIADQAJAAsACgAUABgACQAGAAEAAgAXABUADQAWABYABgAGABcAEwAGAAMAAgAFAAoADwAGAAQADQALAAgA///9/wgADAAKAAAAAAAEAP7/BwAQAAcA/v8DAA0ACQAHAA4AFAAIAAIAEgAPAAYACAD//wEABgACAAcAEwASAAYAAAD+////BwAFAAQACQAHAAQACQAQAAwACwAGAAMAEAAOAAUAAgAAAAgADAARABUACAD//wIABgAJABMADwD/////AwANAA8ABAAJABMADwAAAPv/BAAJABAACAABABcAIgATAAYABwAIAAoACwAHAAwADgAKAAsAAwAAAAQACQAJAP7/AAAGAAMABAACAP///P/8/wQABwABAPr//P/+/wIABAD4//j/AgACAPj/8P/1//X/8v/4//3/AAD3/+v/7v/x//b/+//9//v/9//z//b//P/u/+j/9f/+/wgABgD1/+//9/8AAPz/+v/8//T/8v/4//z/+P/1//r/+P/1//z/BAD7//P/AQAFAP7//f/6//r///8BAPv/9/8CAAEA+f/3//n///8DAPv/9v/8//r/8//+/wgACgAAAPD/9P/5//r/BAAIAAQAAgAAAPb/+/8HAP7/+P8BAAMA/v/2//T/AQAQAAoA/v/0/+n/+/8NAAQABQAIAP3//P8CAPz/8v/4/wMABAD6//f//v/3//H/9v/7//3//P/3//P/9f/6//r/+v/0//D//P////X/6//w/wEABQD1/+v/8v/3//v/BAAAAPn/8f/v//r/AAD///z/9f/u//L/AwAGAPv/9f/3//r/+//5//L/9P8CAAQA/P/6/////v/v/+f/8//+////AwAJAP3/8//4//D/7v/9//3/7//x//j/9v/4//X/9f/5//H/7v/3//L/5f/q//j/+//6//f/8//x/+r/6f/2//f/7v/u//b/9v/1//D/6P/v//f/7f/m/+7/8P/r//T/+P/r/+v/9v/z/+r/5//q//f//f/s/+b/+P/7/+3/7f/5//v/8//u/+z/8f/8//r/6f/l/+7/8P/y//3/+v/u/+7/8P/w//T/9P/w//T/8//s//T/BQD///L/+P////j/9v/8//P/6f/y//n/7//q/+//8P/v//H/8//w/+3/8P/0/+//8v/+//z/9f/2//n/9//1//P/9P/8/wEA+v/0//T/9v8AAAgA/v/w//H/AAAIAP7/8v/3/wEA/v/3//v////8//3/+//6////AQABAAEA/P/5////AgD9//j/+/8BAAAA+//4//j//f8FAAQA+f/2/wIACwAFAP//AQAFAAcACAAJAAcABAAIAA4ACgABAAUAEQALAPr/+/8KAAoAAAAAAAEA+f/6/wAAAgABAPr/+f/8//b/9f//////+//8//v/+/8BAAMA/P/6//3/AAACAP3/+v8CAAAA+/8DAAUA//8AAAQACgAGAPr/+P/+/wUACAD///7/CgAJAAIAAQABAP7//f8AAP///P/8//7/BAAIAAIA//8FAAIA/P/+/wYADAAFAPz///8KAAsABwAJAAoAAgD7////BwAHAAEAAAABAAAAAgACAAMABQACAAEAAwAAAP3/AQADAAIAAgAFAAYABQADAAYACgAGAAIAAgABAAcACgADAAMAAAD5/wMADgAOAAoAAwAEAAcAAgAAAAEABgAOAAoAAgACAAUACQAFAAUADAAMAAUABAAHAAYA/v///wgABAAEAA8ADwAIAAUABgAIAAkACAAFAAYACwAKAAcABAACAAkACwAHAAoABAD5//7/CgANAAcAAgACAP////8HAAoABwAGAAMA//8GAAYA+P/2/wUACgD///X/+v8AAPv//f8FAAIA/v8AAAQABwD9//z/CgAPAAsABwACAAYACQAIAAcABQAHAAgABQAHAAUAAAAHAAoACgAOABIADQADAAYAEAANAAUAAAD9/wIACAAOAA4AAQD+/wMAAgACAAMABgAJAAEA+//+/wMAEAATAAMA/P8AAAIAAAAAAAwAEQAGAPz/+v/+/wYABgAAAAIABwAIAAcABQD///z//f8BAAcACAAHAAcABwAGAAQAAgAHAAgABgAIAAUAAwAHAAkACQAGAAQACAALAAoABQAFAA4AEAAIAAIAAwAHAAcABAAFAAMA//8AAAMACQAFAPz/AAABAAAABAD/////BgAHAAUA/P/5/wMAAwD+//z/+/8DAAcA/P/6/wAAAgAAAPv//v8EAAEAAQADAAIA///8//7/AwABAP3//P/9/wEABAAFAAEA/f/+/wAABAAEAP7//v8DAAQA/v/6////AgD+////BQAGAAQAAAD9////AwADAAEAAgACAAEAAAD//wAAAQACAAIA/f/7//7///////z//P8EAAIA+v/7//f/9f/6//3//P/6//v////9//z//P/4//z/AQD9//3//v/8//v/+//6//j/+P/7//v/+v/8//7//f/5//j//f/+//3//f/9//7//P/8//7/+//7//7/+//4//j//f8DAP//+//9//v/+f/6//7//v/3//P/9//6//f/9//6//f/9f/7//3//f/7//f/9f/3//r/+//4//z////5//f/+f/6//3/+//8/wEA+v/1//r/+//6//z///////z//v/8//T/+f8DAAMA///8//v//P/+/wMAAQD8//3////+//z//f////z/+/////7///8DAAEA/v/8//v//v8AAAEAAAD6//3/BAABAPz//P/+//7/+v/8/wIAAAD8//7//v/9//3/+//8//z/+f/7//7//f/9//3/AAABAP7//f/8//3////7//r////+//z////+//v//P8BAAIA/f/8//z//P/+//v/+P/8//3/+v/4//n//v/8//n//v////z/+//7//z//P/+/wIA+//5/wAA/v/6//v//f8AAP3/+//8//v/+//9//r/+//+/////f/2//f//v/+//3//v/9//3//f/9//z/+//+/wEA/v/7//3/AgAAAPn/+v/8//r/+//8//v//f/+//z/+v/6//v/+f/6//3//P/7//v/+P/7/////P/6//v//P/+//3//P/6//j/+v/8//z//P/9/////v/6//j/9v/0//r////+//3//P/7//v//P/8//z//P/8//j/+P/6//7/AgAAAPn/9//5//v//f/+//7//v/9//v/+P/4//v//P/6//j/+f/+//z/+//+//3//P/9//3//v///wAA/////wEAAgD//wAAAQABAAQAAwACAAQABQAEAAIAAwAFAAQAAgADAAUABwAGAAUABAAAAAAABAAEAAQABQAGAAgABQADAAQABQADAAEAAgAEAAQAAgACAAIABAAHAAYABQAFAAAA/f///wQABQAEAAUABAABAAIAAwAEAAcACAAIAAQAAQAFAAcABgAHAAYAAwAFAAcABgACAAMABgAEAAIABAADAAIABQAFAAUABwAHAAQAAQABAAYABwADAAQABQAFAAMAAwAEAAIAAAACAAQABAABAAAAAAD9////BAAFAAQAAwABAAAAAQAGAAUAAQADAAcAAwAAAAIAAgADAAQABQAGAAUABAACAAAAAwAEAAQAAgAAAAIAAgABAAYABAAAAAIAAwABAAIAAgACAAAA//8CAAQAAQD9////AgABAP////8AAP3/+v/8//7//f/9///////+//z/+////wAA/v/+//3//P/9//z//v8AAPz//P/+////AQD+//z//v///wAAAAD///////8BAAIA/////wAAAAAAAAUABgACAAMABAD/////AQAEAAUAAgABAAAA//8AAAIAAwADAAQAAgACAAMAAgAAAAAABAAGAAEAAQADAP7//f8CAAEA/v/+/wAAAAAAAAAAAgACAP7//v//////AgADAAEAAwACAP///v///wIAAgABAAEAAAABAAEA//8AAAEAAgABAAAAAgABAP///////wEAAgABAAEAAQAAAP//AAAAAP//AQD///7/AQACAP//AAABAP7//v////3//f/+//3//f/7//z//v/8//z//v/+//z/+f/6//3/+//8//7/AAD9//n/+v/+/////P/7//3//P/6//7/AAD///7/+//9////AAADAAEA/f/+//////8AAAAAAAAAAP//AAABAAAAAAAAAAAAAgAAAP7/AQACAP///v8AAP///f8AAAAAAAABAP////8BAP////8AAP///////wAAAAAAAAAAAAAAAP7//f8AAAEAAAD+//7/AQABAAAAAQAAAAAAAgACAAEAAQABAP////8BAAAA//8AAAEAAQAAAAAAAQAAAP//AAACAAAAAAACAAEAAQABAAAAAQAAAAAAAQABAAEAAQADAAEA//8BAP7//v8AAP//AAABAAAAAAD///7//////////v/+////AAD/////////////AQD///7/AAD///7//////////////////////wAAAAD/////AAAAAP///v/+//7//f////////////7///////7////+//3//v/+///////+//7//v///wAAAAAAAP///v/9//3/AAAAAAAA//8AAAEA///+/wAAAAAAAAEAAAAAAP///f/+/wAAAQAAAP////8AAP///v//////AAAAAP7//v///////v////7//v////7///8AAP7//f//////AAABAP////8AAP//////////AAAAAAAAAAD/////AAD//wAAAQABAAAAAAAAAAAA/////wEAAQAAAAAAAQACAAEAAAD//wAAAQAAAAAAAAAAAAAA//8AAAAAAAAAAP7///8AAP////8AAAAAAAD/////AAAAAP//AAABAAAA//8BAAEAAAD/////AAAAAAAA/////wEAAQAAAAAAAQAAAAAAAAAAAAAAAAAAAP////8AAAEA//////////8AAAAAAAAAAP////8AAP///v///wAAAAD//wAA/////////////wAAAAD/////AAAAAP////8AAP////8AAAAAAAAAAAAA//8AAAAAAAABAAEA/////wAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAEAAAAAAAAAAQABAAAAAAABAAAAAAABAAAAAAAAAAAAAAAAAAEAAQABAAEAAQAAAAAAAAAAAAEAAQABAAEAAAAAAAAAAQAAAAEAAQAAAAAAAAAAAAAAAAAAAAAAAAABAAEAAQABAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD//wAAAAAAAAAAAAAAAP///////wAAAAAAAAAAAAAAAAAA/////wAA//8AAAAAAAAAAP////8AAP//AAAAAP//AAAAAAAA//8AAAAA//8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/////wAAAAAAAAAA/////wAA//8AAAAAAAD///////8AAAAA////////////////AAAAAAAA//8AAAAAAAAAAAAAAAAAAP///////wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
  const SAFE_CRACKER_ORIGINAL_CLICK_RATE_V27 = 32000;

  function safeCrackerBuildOriginalClickPcmV27(context) {
    if (runtime.safeCrackerOriginalClickPcmV27?.context === context) {
      return runtime.safeCrackerOriginalClickPcmV27.buffer;
    }
    const binary = window.atob(SAFE_CRACKER_ORIGINAL_CLICK_PCM_V27);
    const frameCount = Math.floor(binary.length / 2);
    const buffer = context.createBuffer(1, frameCount, SAFE_CRACKER_ORIGINAL_CLICK_RATE_V27);
    const data = buffer.getChannelData(0);
    for (let frame = 0; frame < frameCount; frame += 1) {
      const byteIndex = frame * 2;
      const low = binary.charCodeAt(byteIndex);
      const high = binary.charCodeAt(byteIndex + 1);
      let signed = low | (high << 8);
      if (signed & 0x8000) signed -= 0x10000;
      data[frame] = signed / 32768;
    }
    runtime.safeCrackerOriginalClickPcmV27 = { context, buffer };
    return buffer;
  }

  function safeCrackerUnlockOriginalClickPcmV27() {
    const context = resumeAudio();
    if (!context) return;
    safeCrackerBuildOriginalClickPcmV27(context);
    try {
      const source = context.createBufferSource();
      source.buffer = context.createBuffer(1, 1, context.sampleRate || 44100);
      source.connect(context.destination);
      source.start(context.currentTime);
    } catch {}
  }

  function safeCrackerFireOriginalClickPcmV27() {
    const context = resumeAudio();
    if (!context || document.hidden) return false;
    const fire = () => {
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = safeCrackerBuildOriginalClickPcmV27(context);
      source.playbackRate.setValueAtTime(1, context.currentTime);
      gain.gain.setValueAtTime(1.12, context.currentTime);
      source.connect(gain);
      gain.connect(context.destination);
      source.start(context.currentTime);
    };
    if (context.state === 'running') {
      fire();
      return true;
    }
    context.resume().then(fire).catch(() => {});
    return true;
  }

  safeCrackerPlayDetent = function safeCrackerPlayOriginalPcmDetentV27(digit) {
    const now = performance.now();
    if (document.hidden || now - Number(runtime.safeCrackerOriginalPcmAtV27 || 0) < 26) return;
    runtime.safeCrackerOriginalPcmAtV27 = now;
    safeCrackerFireOriginalClickPcmV27();
    safeCrackerHaptic(4);
  };
  playDetent = safeCrackerPlayDetent;

  function safeCrackerSmoothRoomToneBufferV27(context) {
    if (runtime.safeCrackerSmoothRoomToneBufferV27?.sampleRate === context.sampleRate) return runtime.safeCrackerSmoothRoomToneBufferV27;
    const duration = 21;
    const fadeSeconds = 2.5;
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const fadeLength = Math.max(1, Math.floor(context.sampleRate * fadeSeconds));
    const raw = new Float32Array(length + fadeLength);
    let brown = 0;
    let slow = 0;
    for (let index = 0; index < raw.length; index += 1) {
      const white = Math.random() * 2 - 1;
      brown = brown * 0.985 + white * 0.015;
      slow = slow * 0.9996 + white * 0.0004;
      raw[index] = brown * 0.72 + slow * 0.28 + white * 0.018;
    }
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) data[index] = raw[index];
    for (let index = 0; index < fadeLength; index += 1) {
      const mix = index / fadeLength;
      data[index] = raw[length + index] * (1 - mix) + raw[index] * mix;
    }
    let peak = 0.0001;
    for (let index = 0; index < data.length; index += 1) peak = Math.max(peak, Math.abs(data[index]));
    const scale = 0.34 / peak;
    for (let index = 0; index < data.length; index += 1) data[index] *= scale;
    runtime.safeCrackerSmoothRoomToneBufferV27 = buffer;
    return buffer;
  }

  safeCrackerStartRecordedAmbience = function safeCrackerStartSmoothVaultRoomToneV27() {
    if (!safeCrackerRecordedModeActive() || runtime.safeCrackerRecordedAmbience) return;
    const context = resumeAudio();
    if (!context) return;
    const source = context.createBufferSource();
    const highpass = context.createBiquadFilter();
    const lowpass = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = safeCrackerSmoothRoomToneBufferV27(context);
    source.loop = true;
    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(32, context.currentTime);
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(720, context.currentTime);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.026, context.currentTime + 2.2);
    source.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(safeCrackerAudioBus(context));
    source.start(context.currentTime);
    runtime.safeCrackerRecordedAmbience = { source, gain, context, smoothRoomToneV27: true };
  };

  document.addEventListener('pointerdown', safeCrackerUnlockOriginalClickPcmV27, { capture: true, passive: true });
  document.addEventListener('touchstart', safeCrackerUnlockOriginalClickPcmV27, { capture: true, passive: true });
  document.addEventListener('keydown', safeCrackerUnlockOriginalClickPcmV27, { capture: true });
  // SAFE_CRACKER_ORIGINAL_PCM_V27_END

})();
