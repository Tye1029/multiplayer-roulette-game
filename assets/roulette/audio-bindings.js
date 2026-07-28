(function (global) {
  'use strict';

  const audio = global.RouletteAudio;
  if (!audio) throw new Error('RouletteAudio must load before direct action bindings.');

  const BASE = '/assets/roulette/audio/';
  const TABLE_MOVE = 'freesound_community-wood-chest-slid3-90317.mp3';
  const OPENING_SPIN = 'revolver-spinning-on-wood-v4.mp3';
  const CHAMBER_SPIN = 'freesound_community-revolver-spin-96947.mp3';
  const OPENING_BLOCKED_SOURCES = Object.freeze([
    TABLE_MOVE,
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
  const OPENING_SPIN_VOLUME = 0.16;
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
  let visibleResultState = '';
  let visibleResultSerial = 0;
  let lastResultCue = '';
  let lastResultAt = -Infinity;
  const resultAudioPool = Object.create(null);
  let resultAudioPrimed = false;

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

  function playOpeningSpinSound() {
    stopClip(activeOpeningWoodClip);

    // Reuse the exact quiet movement recording heard when the gun rotates to the
    // next player, but let its full body play slower for the who-goes-first spin.
    const clip = new Audio(BASE + TABLE_MOVE);
    clip.__rrAuthorizedOpeningSpin = true;
    clip.preload = 'auto';
    clip.playsInline = true;
    clip.preservesPitch = false;
    clip.volume = 0;
    clip.playbackRate = 0.9;
    activeOpeningWoodClip = clip;
    openingWoodStarted = true;

    const cleanup = () => {
      if (activeOpeningWoodClip === clip) activeOpeningWoodClip = null;
    };
    clip.addEventListener('ended', cleanup, { once: true });
    clip.addEventListener('error', cleanup, { once: true });

    const play = nativeMediaPlay || HTMLMediaElement.prototype.__rrOriginalPlay;
    if (typeof play !== 'function') {
      cleanup();
      return;
    }

    const begin = () => {
      try { clip.currentTime = Math.min(0.08, Math.max(0, clip.duration - 0.1)); } catch {}
      Promise.resolve(play.call(clip)).then(() => {
        const started = performance.now();
        const fadeInMs = 170;
        const fadeOutAtMs = 2050;
        const finishAtMs = 2680;
        const shape = now => {
          if (activeOpeningWoodClip !== clip || clip.paused) return;
          const elapsed = now - started;
          let level = OPENING_SPIN_VOLUME;
          if (elapsed < fadeInMs) level *= elapsed / fadeInMs;
          if (elapsed > fadeOutAtMs) {
            level *= Math.max(0, 1 - (elapsed - fadeOutAtMs) / (finishAtMs - fadeOutAtMs));
          }
          clip.volume = Math.max(0, Math.min(OPENING_SPIN_VOLUME, level));
          clip.playbackRate = Math.max(0.76, 0.9 - elapsed * 0.000052);
          if (elapsed < finishAtMs) {
            openingWoodFrame = requestAnimationFrame(shape);
            return;
          }
          clip.volume = 0;
          stopClip(clip);
          cleanup();
          openingWoodFrame = 0;
        };
        openingWoodFrame = requestAnimationFrame(shape);
      }).catch(cleanup);
    };

    if (clip.readyState >= 1) begin();
    else clip.addEventListener('loadedmetadata', begin, { once: true });
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

      if (
        now < openingWoodUntil &&
        this.__rrAuthorizedOpeningSpin !== true &&
        OPENING_BLOCKED_SOURCES.some(file => src.includes(file))
      ) return blockMedia(this);

      return upstreamPlay.apply(this, arguments);
    };
  }

  function beginOpeningWoodSound() {
    fadeOutOpeningWood(90);
    openingWoodUntil = performance.now() + OPENING_WOOD_SOUND_MS;
    openingWoodStarted = false;
    playOpeningSpinSound();
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
    primeResultAudio();
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

  function resultVolume(cue) {
    return cue === 'victory' ? 0.48 : 0.42;
  }

  function makeResultClip(cue) {
    if (resultAudioPool[cue]) return resultAudioPool[cue];

    const file = RESULT_FILES[cue];
    if (!file) return null;

    const clip = new Audio(BASE + file);
    clip.__rrAuthorizedResultCue = true;
    clip.preload = 'auto';
    clip.playsInline = true;
    clip.volume = resultVolume(cue);
    clip.playbackRate = 1;

    clip.addEventListener('ended', () => {
      if (activeResultClip === clip) activeResultClip = null;
      try { clip.currentTime = 0; } catch {}
    });

    clip.addEventListener('error', () => {
      if (activeResultClip === clip) activeResultClip = null;
      delete resultAudioPool[cue];
      resultAudioPrimed = false;
    });

    resultAudioPool[cue] = clip;
    return clip;
  }

  function primeResultAudio() {
    if (resultAudioPrimed) return;

    const play =
      nativeMediaPlay ||
      HTMLMediaElement.prototype.__rrOriginalPlay;

    if (typeof play !== 'function') return;

    resultAudioPrimed = true;

    for (const cue of Object.keys(RESULT_FILES)) {
      const clip = makeResultClip(cue);
      if (!clip) continue;

      const targetVolume = resultVolume(cue);
      clip.volume = 0;

      try {
        clip.pause();
        clip.currentTime = 0;
      } catch {}

      Promise.resolve(play.call(clip)).then(() => {
        try {
          clip.pause();
          clip.currentTime = 0;
          clip.volume = targetVolume;
        } catch {}
      }).catch(() => {
        clip.volume = targetVolume;
        resultAudioPrimed = false;
      });
    }
  }

  function playResultCue(game, cue, key) {
    if (!RESULT_FILES[cue] || document.hidden) {
      seenResults.delete(key);
      return;
    }

    const clip = makeResultClip(cue);
    if (!clip) {
      seenResults.delete(key);
      return;
    }

    if (activeResultClip && activeResultClip !== clip) {
      try {
        activeResultClip.pause();
        activeResultClip.currentTime = 0;
      } catch {}
    }

    try {
      clip.pause();
      clip.currentTime = 0;
    } catch {}

    clip.muted = false;
    clip.volume = resultVolume(cue);
    clip.playbackRate = 1;
    activeResultClip = clip;

    audio.duckForShot?.();

    const play =
      nativeMediaPlay ||
      HTMLMediaElement.prototype.__rrOriginalPlay;

    if (typeof play !== 'function') {
      activeResultClip = null;
      seenResults.delete(key);
      return;
    }

    Promise.resolve(play.call(clip)).catch(() => {
      if (activeResultClip === clip) activeResultClip = null;
      resultAudioPrimed = false;
      seenResults.delete(key);
    });
  }

  const RESULT_ELEMENT_SELECTOR = [
    '[role="dialog"]',
    '[aria-modal="true"]',
    '[data-roulette-result]',
    '.rr-final',
    '.rr-result',
    '.rr-ending-banner',
    '.result-modal',
    '.game-result',
    '.game-over',
    '.end-screen',
    '.modal',
    '.popup',
    'h1',
    'h2',
    'h3'
  ].join(',');

  function cueFromResultText(value, shortLine = false) {
    const text = String(value || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

    if (!text) return '';
    if (shortLine && text.length > 64) return '';

    if (
      /\byou\s+(?:win|won|survived)\b|\bvictory\b/.test(text)
    ) return 'victory';

    if (
      /\byou\s+(?:lose|lost|died)\b|\bdefeat\b|\beliminated\b/.test(text)
    ) return 'defeat';

    return '';
  }

  function documentResultCue() {
    const candidates = document.querySelectorAll(RESULT_ELEMENT_SELECTOR);

    for (const element of candidates) {
      const computed = global.getComputedStyle?.(element);
      if (
        computed &&
        (
          computed.display === 'none' ||
          computed.visibility === 'hidden' ||
          Number(computed.opacity) === 0
        )
      ) continue;

      const rect = element.getBoundingClientRect?.();
      if (rect && (rect.width < 1 || rect.height < 1)) continue;

      const cue = cueFromResultText(element.textContent);
      if (cue) return cue;
    }

    const scope =
      document.querySelector('#duelActive,#duel-active') ||
      document.body;

    const lines = String(scope?.innerText || '')
      .split(/\n+/)
      .map(line => line.trim())
      .filter(Boolean);

    for (const line of lines) {
      const cue = cueFromResultText(line, true);
      if (cue) return cue;
    }

    return '';
  }

  function queueResultCue(game, cue, key) {
    if (!cue || seenResults.has(key)) return;

    seenResults.add(key);
    lastResultCue = cue;
    lastResultAt = performance.now();

    global.setTimeout(() => playResultCue(game, cue, key), 700);
  }

  function syncResultCue() {
    const domCue = documentResultCue();

    if (!domCue) {
      visibleResultState = '';
    }

    const game = currentGame();
    const status = String(game?.status || '').toLowerCase();
    const gameComplete = Boolean(
      game && ['complete', 'completed', 'finished'].includes(status)
    );

    if (gameComplete) {
      const cue = resultCue(game) || domCue;
      if (!cue) return;

      if (domCue) visibleResultState = domCue;
      queueResultCue(game, cue, resultKey(game, cue));
      return;
    }

    if (!domCue || visibleResultState === domCue) return;

    visibleResultState = domCue;

    const now = performance.now();
    if (lastResultCue === domCue && now - lastResultAt < 8000) return;

    visibleResultSerial += 1;
    queueResultCue(
      null,
      domCue,
      `visible-result:${visibleResultSerial}:${domCue}`
    );
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

  // Roulette result sounds are fired directly when the result popup appears.
  // Keep the older document scanner inactive to prevent duplicate result audio.
  clearTimeout(resultPollTimer);

  global.RouletteAudioBindings = Object.freeze({
    playSpinButtonChamber,

    playResult(cue) {
      const normalized =
        cue === 'victory' || cue === 'defeat' ? cue : '';

      if (!normalized) return false;

      const key =
        `direct-result:${Date.now()}:${normalized}`;

      playResultCue(null, normalized, key);
      return true;
    },

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
