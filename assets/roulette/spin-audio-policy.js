(function (global) {
  'use strict';

  const audio = global.RouletteAudio;
  if (!audio) throw new Error('RouletteAudio must load before spin audio policy.');

  const BASE = '/assets/roulette/audio/';
  const TABLE_MOVE = `${BASE}freesound_community-wood-chest-slid3-90317.mp3`;
  const CHAMBER_SPIN = 'freesound_community-revolver-spin-96947.mp3';
  const CHAMBER_RATCHET = 'freesound_community-revolver-chamber-spin-ratchet-sound-90521.mp3';
  const CHAMBER_LOCK = 'freesound_community-revolver-cocking-104722.mp3';
  const CHAIN = 'freesound_community-chain-6073.mp3';
  const TABLE_TAP = 'freesound_community-tap-on-wooden-table-44998.mp3';
  const chamberOnly = [CHAMBER_SPIN, CHAMBER_RATCHET, CHAMBER_LOCK];
  const groups = new Map();
  const timers = new Map();

  let chamberSpinUntil = 0;
  let lastOpeningAt = -Infinity;
  let lastChainAt = -Infinity;
  let lastGameId = '';
  let lastTurnId = '';
  let pollTimer = 0;

  function fade(element, target, duration) {
    if (!element) return;
    const token = Symbol('mix-fade');
    element.__rrMixFadeToken = token;
    const start = Number(element.volume) || 0;
    const end = Math.max(0, Math.min(1, Number(target) || 0));
    const began = performance.now();
    const milliseconds = Math.max(16, Number(duration) || 16);
    const step = now => {
      if (element.__rrMixFadeToken !== token) return;
      const progress = Math.min(1, (now - began) / milliseconds);
      element.volume = start + (end - start) * progress;
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function register(group, clip) {
    if (!group || !clip) return;
    if (!groups.has(group)) groups.set(group, new Set());
    const set = groups.get(group);
    set.add(clip);
    const cleanup = () => {
      set.delete(clip);
      if (!set.size) groups.delete(group);
    };
    clip.addEventListener('ended', cleanup, { once: true });
    clip.addEventListener('error', cleanup, { once: true });
  }

  function stopGroup(group, fadeMs = 55) {
    const set = groups.get(group);
    if (!set) return;
    groups.delete(group);
    for (const clip of set) {
      fade(clip, 0, fadeMs);
      setTimeout(() => {
        try { clip.pause(); } catch {}
        clip.removeAttribute('src');
      }, fadeMs + 45);
    }
  }

  function clearTimers(group) {
    const set = timers.get(group);
    if (!set) return;
    timers.delete(group);
    for (const timer of set) clearTimeout(timer);
  }

  function schedule(group, callback, delay) {
    if (!timers.has(group)) timers.set(group, new Set());
    const set = timers.get(group);
    const timer = setTimeout(() => {
      set.delete(timer);
      if (!set.size) timers.delete(group);
      callback();
    }, Math.max(0, Number(delay) || 0));
    set.add(timer);
    return timer;
  }

  function playClip(path, options = {}) {
    if (document.hidden) return null;
    if (options.replaceGroup && options.group) stopGroup(options.group, options.replaceFade ?? 45);
    const clip = new Audio(path.startsWith('/') ? path : BASE + path);
    clip.preload = 'auto';
    clip.playsInline = true;
    clip.preservesPitch = false;
    clip.playbackRate = Math.max(0.68, Math.min(1.35, Number(options.rate) || 1));
    const target = Math.max(0, Math.min(1, Number(options.volume) || 0.1));
    const fadeIn = Math.max(0, Number(options.fadeIn) || 0);
    clip.volume = fadeIn ? 0 : target;
    register(options.group, clip);

    const startAt = Math.max(0, Number(options.start) || 0);
    const begin = () => {
      try {
        if (startAt && Number.isFinite(clip.duration)) {
          clip.currentTime = Math.min(startAt, Math.max(0, clip.duration - 0.08));
        }
      } catch {}
      clip.play().catch(() => {});
      if (fadeIn) fade(clip, target, fadeIn * 1000);
      const duration = Math.max(0, Number(options.duration) || 0);
      if (!duration) return;
      const fadeOut = Math.min(duration, Math.max(0.08, Number(options.fadeOut) || 0.2));
      setTimeout(() => fade(clip, 0, fadeOut * 1000), Math.max(0, duration - fadeOut) * 1000);
      setTimeout(() => {
        try { clip.pause(); } catch {}
        clip.removeAttribute('src');
      }, duration * 1000 + 90);
    };

    if (clip.readyState >= 1 || !startAt) begin();
    else clip.addEventListener('loadedmetadata', begin, { once: true });
    return clip;
  }

  // One global filter owns chamber exclusivity and keeps lamp/table cues restrained.
  if (!HTMLMediaElement.prototype.__rrAudioMixPolicyV2) {
    const nativePlay = HTMLMediaElement.prototype.__rrOriginalPlay || HTMLMediaElement.prototype.play;
    if (!HTMLMediaElement.prototype.__rrOriginalPlay) {
      Object.defineProperty(HTMLMediaElement.prototype, '__rrOriginalPlay', {
        value: nativePlay,
        configurable: true
      });
    }
    Object.defineProperty(HTMLMediaElement.prototype, '__rrAudioMixPolicyV2', {
      value: true,
      configurable: true
    });
    HTMLMediaElement.prototype.play = function () {
      const src = String(this.currentSrc || this.src || this.getAttribute?.('src') || '');
      const now = performance.now();
      if (chamberOnly.some(file => src.includes(file)) && now >= chamberSpinUntil) {
        try { this.pause(); } catch {}
        return Promise.resolve();
      }
      if (src.includes(CHAIN)) {
        if (now - lastChainAt < 8500) {
          try { this.pause(); } catch {}
          return Promise.resolve();
        }
        lastChainAt = now;
        this.volume = Math.min(0.011, Math.max(0, Number(this.volume) || 0) * 0.34);
      } else if (src.includes(TABLE_TAP)) {
        this.volume = Math.min(0.075, Math.max(0, Number(this.volume) || 0));
      }
      return nativePlay.apply(this, arguments);
    };
  }

  function openingSpin() {
    const now = performance.now();
    if (now - lastOpeningAt < 5000) return;
    lastOpeningAt = now;
    chamberSpinUntil = now + 5900;
    clearTimers('opening');
    stopGroup('turn-move', 45);
    stopGroup('opening', 55);

    // Gun body sliding/spinning on the table: deliberately underneath the chamber.
    playClip(TABLE_MOVE, {
      group: 'opening',
      volume: 0.105,
      rate: 0.96,
      duration: 2.52,
      fadeIn: 0.04,
      fadeOut: 0.34
    });
    schedule('opening', () => playClip(TABLE_MOVE, {
      group: 'opening',
      volume: 0.072,
      rate: 0.92,
      start: 0.08,
      duration: 2.42,
      fadeIn: 0.12,
      fadeOut: 0.55
    }), 2480);

    // Chamber motion exists only in this explicit Spin-button window.
    playClip(CHAMBER_SPIN, {
      group: 'opening',
      volume: 0.285,
      rate: 0.92,
      duration: 3.15,
      fadeIn: 0.03,
      fadeOut: 0.42
    });
    [520, 1260, 2180, 3220, 4140].forEach((delay, index) => {
      schedule('opening', () => playClip(CHAMBER_RATCHET, {
        group: 'opening',
        volume: Math.max(0.052, 0.09 - index * 0.009),
        rate: 1.07 - index * 0.055,
        duration: 0.72,
        fadeOut: 0.16
      }), delay);
    });
    schedule('opening', () => playClip(CHAMBER_LOCK, {
      group: 'opening',
      volume: 0.16,
      rate: 1,
      duration: 1.1,
      fadeOut: 0.22
    }), 4780);
  }

  // Bind to the actual roulette Spin button so the chamber starts on the press,
  // while the opening-sequence wrapper below is safely deduplicated.
  document.addEventListener('click', event => {
    const button = event.target?.closest?.('button');
    if (!button || !button.closest('[data-roulette-game]')) return;
    const label = String(button.textContent || '').replace(/\s+/g, ' ').trim().toUpperCase();
    if (/\bSPIN\b/.test(label)) openingSpin();
  }, true);

  // External bindings use this replacement; the previous layered opening mix is not called.
  global.RouletteAudio = Object.freeze({
    ...audio,
    openingSpin,
    turnRotate() { return null; }
  });

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

  function syncTurnMovement() {
    const game = currentGame();
    const gameId = String(game?.gameId || '');
    const turnId = String(game?.rouletteState?.turnId || '');
    if (!gameId || game?.status !== 'playing' || !turnId) {
      lastGameId = gameId;
      lastTurnId = turnId;
      return;
    }
    if (
      gameId === lastGameId &&
      lastTurnId &&
      turnId !== lastTurnId &&
      performance.now() >= chamberSpinUntil
    ) {
      stopGroup('turn-move', 45);
      playClip(TABLE_MOVE, {
        group: 'turn-move',
        volume: 0.085,
        rate: 1.05,
        start: 0.12,
        duration: 0.96,
        fadeIn: 0.04,
        fadeOut: 0.24
      });
    }
    lastGameId = gameId;
    lastTurnId = turnId;
  }

  const poll = () => {
    syncTurnMovement();
    pollTimer = global.setTimeout(poll, 300);
  };
  poll();

  global.RouletteAudioMixPolicy = Object.freeze({
    openingSpin,
    diagnostics() {
      return {
        chamberWindowActive: performance.now() < chamberSpinUntil,
        activeGroups: [...groups.keys()],
        lastGameId,
        lastTurnId
      };
    }
  });

  global.addEventListener('pagehide', () => {
    clearTimeout(pollTimer);
    for (const group of [...timers.keys()]) clearTimers(group);
    for (const group of [...groups.keys()]) stopGroup(group, 40);
  }, { once: true });
})(window);