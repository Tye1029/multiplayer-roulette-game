(function (global) {
  'use strict';

  const audio = global.RouletteAudio;
  if (!audio) throw new Error('RouletteAudio must load before direct action bindings.');

  const BASE = '/assets/roulette/audio/';
  const TABLE_MOVE = 'freesound_community-wood-chest-slid3-90317.mp3';
  const CHAMBER_SPIN = 'freesound_community-revolver-spin-96947.mp3';
  const OPENING_BLOCKED_SOURCES = Object.freeze([
    CHAMBER_SPIN,
    'freesound_community-revolver-chamber-spin-ratchet-sound-90521.mp3',
    'freesound_community-revolver-cocking-104722.mp3',
    'freesound_community-tap-on-wooden-table-44998.mp3',
    'freesound_community-chain-6073.mp3'
  ]);
  const RESULT_FILES = Object.freeze({
    victory: 'desifreemusic-impact-strike-cinematic-hit-stinger-466320.mp3',
    defeat: 'u_903n3qx7rq-dramatic-sting-118943.mp3'
  });
  const RESULT_SOURCES = new Set(Object.values(RESULT_FILES));
  const OPENING_WOOD_SOUND_MS = 7000;
  const OPENING_WOOD_PEAK = 0.045;
  const SPIN_BUTTON_COOLDOWN_MS = 520;
  const RESULT_POLL_MS = 350;

  const seenResults = new Set();
  let openingWoodUntil = 0;
  let openingWoodStarted = false;
  let openingWoodFrame = 0;
  let activeOpeningWoodClip = null;
  let activeSpinButtonClip = null;
  let activeResultClip = null;
  let lastSpinButtonAt = -Infinity;
  let resultPollTimer = 0;
  let nativeMediaPlay = null;

  function silenceLegacy() {
    const noop = function () { return null; };
    try { rouletteSpinSound = noop; } catch {}
    try { rouletteShotIndexSound = noop; } catch {}
    try { rouletteBlankSound = noop; } catch {}
    try { rouletteGunshotSound = noop; } catch {}
    try { rouletteTone = noop; } catch {}
    global.rouletteSpinSound = noop;
    global.rouletteShotIndexSound = noop;
    global.rouletteBlankSound = noop;
    global.rouletteGunshotSound = noop;
  }

  function blockMedia(element) {
    try { element.pause(); } catch {}
    queueMicrotask(() => {
      try { element.dispatchEvent(new Event('ended')); } catch {}
    });
    return Promise.resolve();
  }

  function cancelOpeningWoodFrame() {
    if (openingWoodFrame) cancelAnimationFrame(openingWoodFrame);
    openingWoodFrame = 0;
  }

  function shapeOpeningWood(clip) {
    cancelOpeningWoodFrame();
    activeOpeningWoodClip = clip;
    const started = performance.now();
    const fadeInMs = 300;
    const fadeOutAtMs = 1550;
    const finishAtMs = 2480;

    const step = now => {
      if (activeOpeningWoodClip !== clip || clip.paused) {
        if (activeOpeningWoodClip === clip) activeOpeningWoodClip = null;
        openingWoodFrame = 0;
        return;
      }

      const elapsed = now - started;
      let envelope = OPENING_WOOD_PEAK;
      if (elapsed < fadeInMs) envelope *= Math.max(0, elapsed / fadeInMs);
      if (elapsed > fadeOutAtMs) {
        envelope *= Math.max(0, 1 - (elapsed - fadeOutAtMs) / (finishAtMs - fadeOutAtMs));
      }
      clip.volume = Math.max(0, Math.min(OPENING_WOOD_PEAK, envelope));

      if (elapsed >= finishAtMs) {
        clip.volume = 0;
        activeOpeningWoodClip = null;
        openingWoodFrame = 0;
        return;
      }
      openingWoodFrame = requestAnimationFrame(step);
    };

    openingWoodFrame = requestAnimationFrame(step);
  }

  function fadeOutOpeningWood(duration = 170) {
    cancelOpeningWoodFrame();
    const clip = activeOpeningWoodClip;
    activeOpeningWoodClip = null;
    if (!clip) return;

    const started = performance.now();
    const startVolume = Math.max(0, Number(clip.volume) || 0);
    const step = now => {
      const progress = Math.min(1, (now - started) / Math.max(50, duration));
      clip.volume = startVolume * (1 - progress);
      if (progress < 1) {
        openingWoodFrame = requestAnimationFrame(step);
        return;
      }
      openingWoodFrame = 0;
      try { clip.pause(); } catch {}
      try { clip.removeAttribute('src'); } catch {}
    };
    openingWoodFrame = requestAnimationFrame(step);
  }

  function installFinalMixFilter() {
    if (HTMLMediaElement.prototype.__rrFinalAudioBindingsV4) return;
    const upstreamPlay = HTMLMediaElement.prototype.play;
    nativeMediaPlay = HTMLMediaElement.prototype.__rrOriginalPlay || upstreamPlay;
    Object.defineProperty(HTMLMediaElement.prototype, '__rrFinalAudioBindingsV4', {
      value: true,
      configurable: true
    });

    HTMLMediaElement.prototype.play = function () {
      const src = String(this.currentSrc || this.src || this.getAttribute?.('src') || '');
      const now = performance.now();

      if (
        [...RESULT_SOURCES].some(file => src.includes(file)) &&
        this.__rrAuthorizedResultCue !== true
      ) return blockMedia(this);

      if (now < openingWoodUntil) {
        if (src.includes(TABLE_MOVE)) {
          if (openingWoodStarted) return blockMedia(this);
          openingWoodStarted = true;
          const result = upstreamPlay.apply(this, arguments);
          shapeOpeningWood(this);
          return result;
        }
        if (OPENING_BLOCKED_SOURCES.some(file => src.includes(file))) {
          return blockMedia(this);
        }
      }

      return upstreamPlay.apply(this, arguments);
    };
  }

  function beginOpeningWoodSound() {
    fadeOutOpeningWood(90);
    openingWoodUntil = performance.now() + OPENING_WOOD_SOUND_MS;
    openingWoodStarted = false;
  }

  function stopClip(clip) {
    if (!clip) return;
    try { clip.pause(); } catch {}
    try { clip.removeAttribute('src'); } catch {}
  }

  function playSpinButtonChamber() {
    const now = performance.now();
    if (now - lastSpinButtonAt < SPIN_BUTTON_COOLDOWN_MS) return;
    lastSpinButtonAt = now;

    fadeOutOpeningWood(150);
    stopClip(activeSpinButtonClip);

    const clip = new Audio(BASE + CHAMBER_SPIN);
    clip.__rrAuthorizedSpinButtonChamber = true;
    clip.preload = 'auto';
    clip.playsInline = true;
    clip.preservesPitch = false;
    clip.volume = 0.34;
    clip.playbackRate = 0.96;
    activeSpinButtonClip = clip;

    const cleanup = () => {
      if (activeSpinButtonClip === clip) activeSpinButtonClip = null;
    };
    clip.addEventListener('ended', cleanup, { once: true });
    clip.addEventListener('error', cleanup, { once: true });

    const play = nativeMediaPlay || HTMLMediaElement.prototype.__rrOriginalPlay;
    if (typeof play !== 'function') {
      cleanup();
      return;
    }
    Promise.resolve(play.call(clip)).catch(cleanup);
  }

  function currentGame() {
    try {
      if (typeof rouletteLatestGame !== 'undefined' && rouletteLatestGame?.mode === 'roulette') {
        return rouletteLatestGame;
      }
    } catch {}
    try {
      if (typeof duelLastActiveGame !== 'undefined' && duelLastActiveGame?.mode === 'roulette') {
        return duelLastActiveGame;
      }
    } catch {}
    return null;
  }

  function nearestInteractive(target) {
    return target?.closest?.(
      'button,[role="button"],input[type="button"],input[type="submit"],a,' +
      '[data-action],[data-roulette-action],[id*="spin" i],[class*="spin" i]'
    ) || null;
  }

  function spinDescriptor(control) {
    const dataset = control?.dataset || {};
    return [
      control?.textContent,
      control?.value,
      control?.getAttribute?.('aria-label'),
      control?.getAttribute?.('title'),
      control?.getAttribute?.('name'),
      control?.id,
      typeof control?.className === 'string' ? control.className : '',
      dataset.action,
      dataset.rouletteAction
    ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  }

  function isStrictSpinLabel(label) {
    return /^SPIN(?: (?:CHAMBER|CYLINDER))?$/.test(label);
  }

  function isSpinControl(control) {
    if (!control || control.disabled || control.getAttribute?.('aria-disabled') === 'true') return false;
    const descriptor = spinDescriptor(control);
    if (!isStrictSpinLabel(descriptor.toUpperCase()) && !/\bSPIN\b/i.test(descriptor)) return false;

    const rouletteContext = control.closest?.(
      '[data-roulette-game],.rr-game,.roulette-game,.rr-card,#duelActive,#duel-active'
    );
    return Boolean(rouletteContext || currentGame()?.mode === 'roulette');
  }

  function handleSpinGesture(event) {
    const control = nearestInteractive(event.target);
    if (isSpinControl(control)) playSpinButtonChamber();
  }

  function localUserId() {
    try { if (typeof userId !== 'undefined' && userId) return String(userId); } catch {}
    try { if (typeof currentUserId !== 'undefined' && currentUserId) return String(currentUserId); } catch {}
    for (const key of ['userId', 'tornUserId', 'currentUserId']) {
      const value = localStorage.getItem(key);
      if (value) return String(value);
    }
    return '';
  }

  function resultRoot(gameId) {
    try {
      return duelActive?.querySelector(
        `[data-roulette-game][data-game-id="${CSS.escape(String(gameId || ''))}"]`
      ) || null;
    } catch {}
    return null;
  }

  function resultCue(game) {
    const state = game?.rouletteState || {};
    const local = localUserId();
    const winner = String(
      state.winnerId || state.winnerUserId || game?.winner?.userId || game?.winner?.id ||
      game?.winnerId || ''
    );
    const loser = String(
      state.loserId || state.loserUserId || game?.loser?.userId || game?.loser?.id ||
      game?.loserId || ''
    );
    if (local && winner) return winner === local ? 'victory' : 'defeat';
    if (local && loser) return loser === local ? 'defeat' : 'victory';

    const root = resultRoot(game?.gameId);
    const text = String(
      root?.querySelector('.rr-final,.rr-result,.rr-ending-banner')?.textContent || ''
    ).toLowerCase();
    if (/you\s+(win|won)|victory/.test(text)) return 'victory';
    if (/you\s+(lose|lost)|defeat|eliminated/.test(text)) return 'defeat';
    return '';
  }

  function resultKey(game, cue) {
    const state = game?.rouletteState || {};
    return [
      game?.gameId || 'roulette-result',
      game?.completedAt || game?.revision || state.revision || '',
      state.winnerId || game?.winner?.userId || game?.winnerId || '',
      cue
    ].join(':');
  }

  function playResultCue(game, cue, key) {
    const file = RESULT_FILES[cue];
    if (!file || document.hidden) {
      seenResults.delete(key);
      return;
    }

    stopClip(activeResultClip);
    const clip = new Audio(BASE + file);
    clip.__rrAuthorizedResultCue = true;
    clip.preload = 'auto';
    clip.playsInline = true;
    clip.volume = cue === 'victory' ? 0.48 : 0.42;
    clip.playbackRate = 1;
    activeResultClip = clip;

    audio.duckForShot?.();
    const cleanup = () => {
      if (activeResultClip === clip) activeResultClip = null;
    };
    clip.addEventListener('ended', cleanup, { once: true });
    clip.addEventListener('error', cleanup, { once: true });
    clip.play().catch(() => {
      cleanup();
      seenResults.delete(key);
    });
  }

  function syncResultCue() {
    const game = currentGame();
    const status = String(game?.status || '').toLowerCase();
    if (!game || !['complete', 'completed', 'finished'].includes(status)) return;

    const cue = resultCue(game);
    if (!cue) return;
    const key = resultKey(game, cue);
    if (seenResults.has(key)) return;
    seenResults.add(key);
    global.setTimeout(() => playResultCue(game, cue, key), 700);
  }

  silenceLegacy();
  installFinalMixFilter();

  if (typeof rouletteOpeningSequence !== 'function') {
    throw new Error('Opening sequence must load before direct audio bindings.');
  }
  if (typeof rouletteShotSequence !== 'function') {
    throw new Error('Shot sequence must load before direct audio bindings.');
  }

  const originalOpeningSequence = rouletteOpeningSequence;
  if (!originalOpeningSequence.__rrUploadedAudioBound) {
    const boundOpeningSequence = async function (game, state, gameId) {
      beginOpeningWoodSound();
      audio.openingSpin(game, state, gameId);
      silenceLegacy();
      return originalOpeningSequence.apply(this, arguments);
    };
    boundOpeningSequence.__rrUploadedAudioBound = true;
    rouletteOpeningSequence = boundOpeningSequence;
  }

  const originalShotSequence = rouletteShotSequence;
  if (!originalShotSequence.__rrUploadedAudioBound) {
    const boundShotSequence = async function (game, state, gameId) {
      audio.shotSequence(game, state, gameId);
      silenceLegacy();
      return originalShotSequence.apply(this, arguments);
    };
    boundShotSequence.__rrUploadedAudioBound = true;
    rouletteShotSequence = boundShotSequence;
  }

  document.addEventListener('pointerdown', handleSpinGesture, true);
  document.addEventListener('click', handleSpinGesture, true);

  const pollResult = () => {
    syncResultCue();
    resultPollTimer = global.setTimeout(pollResult, RESULT_POLL_MS);
  };
  pollResult();

  global.RouletteAudioBindings = Object.freeze({
    playSpinButtonChamber,
    diagnostics() {
      return {
        openingWoodActive: performance.now() < openingWoodUntil,
        openingWoodStarted,
        openingWoodVolume: Number(activeOpeningWoodClip?.volume || 0),
        spinButtonPlaying: Boolean(activeSpinButtonClip),
        seenResults: [...seenResults]
      };
    }
  });

  global.addEventListener('pagehide', () => {
    clearTimeout(resultPollTimer);
    document.removeEventListener('pointerdown', handleSpinGesture, true);
    document.removeEventListener('click', handleSpinGesture, true);
    cancelOpeningWoodFrame();
    stopClip(activeOpeningWoodClip);
    stopClip(activeResultClip);
    stopClip(activeSpinButtonClip);
    activeOpeningWoodClip = null;
    activeResultClip = null;
    activeSpinButtonClip = null;
  }, { once: true });

  silenceLegacy();
  audio.markBindingsReady();
})(window);
