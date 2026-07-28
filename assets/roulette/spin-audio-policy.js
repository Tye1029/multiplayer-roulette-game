(function (global) {
  'use strict';

  const audio = global.RouletteAudio;
  if (!audio) throw new Error('RouletteAudio must load before spin audio policy.');

  const TABLE_SPIN = '/assets/roulette/audio/freesound_community-wood-chest-slid3-90317.mp3';
  const CHAMBER_RATCHET = 'freesound_community-revolver-chamber-spin-ratchet-sound-90521.mp3';
  const active = new Set();
  let chamberSpinUntil = 0;
  let lastGameId = '';
  let lastTurnId = '';
  let pollTimer = 0;

  function fade(audioElement, target, duration) {
    const start = Number(audioElement.volume) || 0;
    const end = Math.max(0, Math.min(1, Number(target) || 0));
    const began = performance.now();
    const milliseconds = Math.max(16, Number(duration) || 16);
    const step = now => {
      const progress = Math.min(1, (now - began) / milliseconds);
      audioElement.volume = start + (end - start) * progress;
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function stopActive(fadeMs = 55) {
    for (const clip of active) {
      fade(clip, 0, fadeMs);
      setTimeout(() => {
        try { clip.pause(); } catch {}
        clip.removeAttribute('src');
      }, fadeMs + 45);
    }
    active.clear();
  }

  function playTableSpin(options = {}) {
    if (document.hidden) return null;
    const clip = new Audio(TABLE_SPIN);
    clip.preload = 'auto';
    clip.playsInline = true;
    clip.preservesPitch = false;
    clip.playbackRate = Math.max(0.72, Math.min(1.3, Number(options.rate) || 1));
    const target = Math.max(0, Math.min(1, Number(options.volume) || 0.15));
    const fadeIn = Math.max(0, Number(options.fadeIn) || 0);
    clip.volume = fadeIn ? 0 : target;
    active.add(clip);

    const begin = () => {
      try {
        if (Number(options.start) > 0 && Number.isFinite(clip.duration)) {
          clip.currentTime = Math.min(Number(options.start), Math.max(0, clip.duration - 0.08));
        }
      } catch {}
      clip.play().catch(() => {});
      if (fadeIn) fade(clip, target, fadeIn * 1000);
      const duration = Math.max(0.2, Number(options.duration) || 0);
      if (!duration) return;
      const fadeOut = Math.min(duration, Math.max(0.08, Number(options.fadeOut) || 0.2));
      setTimeout(() => fade(clip, 0, fadeOut * 1000), Math.max(0, duration - fadeOut) * 1000);
      setTimeout(() => {
        active.delete(clip);
        try { clip.pause(); } catch {}
        clip.removeAttribute('src');
      }, duration * 1000 + 90);
    };

    if (clip.readyState >= 1 || !Number(options.start)) begin();
    else clip.addEventListener('loadedmetadata', begin, { once: true });
    clip.addEventListener('ended', () => active.delete(clip), { once: true });
    return clip;
  }

  // Block cylinder-ratchet playback everywhere except the opening Spin-button window.
  if (!HTMLMediaElement.prototype.__rrSpinPolicyPlay) {
    const nativePlay = HTMLMediaElement.prototype.play;
    Object.defineProperty(HTMLMediaElement.prototype, '__rrSpinPolicyPlay', {
      value: nativePlay,
      configurable: true
    });
    HTMLMediaElement.prototype.play = function () {
      const src = String(this.currentSrc || this.src || this.getAttribute?.('src') || '');
      if (src.includes(CHAMBER_RATCHET) && performance.now() >= chamberSpinUntil) {
        try { this.pause(); } catch {}
        return Promise.resolve();
      }
      return nativePlay.apply(this, arguments);
    };
  }

  const originalOpeningSpin = audio.openingSpin.bind(audio);
  function openingSpin() {
    chamberSpinUntil = performance.now() + 5600;
    stopActive(45);
    playTableSpin({ volume: 0.31, rate: 0.88, duration: 2.58, fadeOut: 0.48 });
    setTimeout(() => playTableSpin({
      volume: 0.22,
      rate: 0.78,
      start: 0.18,
      duration: 2.5,
      fadeIn: 0.12,
      fadeOut: 0.62
    }), 2380);
    return originalOpeningSpin();
  }

  global.RouletteAudio = Object.freeze({ ...audio, openingSpin });

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

  // Ordinary player-to-player gun rotations get only the wood-on-table movement layer.
  function syncTurnMovement() {
    const game = currentGame();
    const gameId = String(game?.gameId || '');
    const turnId = String(game?.rouletteState?.turnId || '');
    if (!gameId || game?.status !== 'playing' || !turnId) {
      lastGameId = gameId;
      lastTurnId = turnId;
      return;
    }
    if (gameId === lastGameId && lastTurnId && turnId !== lastTurnId && performance.now() >= chamberSpinUntil) {
      stopActive(45);
      playTableSpin({
        volume: 0.145,
        rate: 1.06,
        start: 0.15,
        duration: 1.02,
        fadeIn: 0.04,
        fadeOut: 0.2
      });
    }
    lastGameId = gameId;
    lastTurnId = turnId;
  }

  const poll = () => {
    syncTurnMovement();
    pollTimer = global.setTimeout(poll, 350);
  };
  poll();

  global.addEventListener('pagehide', () => {
    clearTimeout(pollTimer);
    stopActive(40);
  }, { once: true });
})(window);
