(function (global) {
  'use strict';

  const BASE = '/assets/roulette/audio/';
  const FILES = Object.freeze({
    room: 'soundsforyou-the-ambience-room-tone-139064.mp3',
    hum: 'freesound_community-lamp-electricity-buzzingwav-14609.mp3',
    wood: 'oxidvideos-wood-creaks-411791.mp3',
    chair: 'freesound_community-wooden-chair-slide-scrape-on-wood-floor-75857.mp3',
    tap: 'freesound_community-tap-on-wooden-table-44998.mp3',
    heartbeat: 'pwlpl-heartbeat-tense-377250.mp3',
    rumble: 'diff_style-disturbing-low-rumble-183748.mp3',
    tension: 'gd_salman-tension-stinger-ambience-355381.mp3',
    victory: 'desifreemusic-impact-strike-cinematic-hit-stinger-466320.mp3',
    defeat: 'u_903n3qx7rq-dramatic-sting-118943.mp3',
    chain: 'freesound_community-chain-6073.mp3',
    hammerA: 'freesound_community-pistol-hammer-cocking-back-4-39887.mp3',
    hammerB: 'freesound_community-cocking-a-revolver-6279.mp3',
    dryA: 'spinopel-dry-fire-gun-364844.mp3',
    dryB: 'freesound_community-gun-dry-firing-3-39820.mp3',
    gunshot: 'freesound_community-single-pistol-gunshot-33-37187.mp3',
    spin: 'freesound_community-revolver-spin-96947.mp3',
    ratchet: 'freesound_community-revolver-chamber-spin-ratchet-sound-90521.mp3',
    lock: 'freesound_community-revolver-cocking-104722.mp3'
  });

  const LOOP_LEVELS = Object.freeze({
    room: 0.055,
    hum: 0.024,
    heartbeat: 0.032,
    rumble: 0.018
  });

  const templates = new Map();
  const loops = new Map();
  const sequenceTimers = new Set();
  const clipTimers = new Set();
  const tensionPlayed = new Set();

  let unlocked = false;
  let enabled = true;
  let master = 1;
  let roomWanted = false;
  let tensionWanted = false;
  let roomTimer = 0;
  let pollTimer = 0;
  let lastHammer = '';
  let lastDry = '';
  let bindHooked = false;
  let openingHooked = false;
  let shotHooked = false;
  const direct = { spin: false, hammer: false, blank: false, gunshot: false };
  let previous = { gameId: '', status: '', turnId: '', joinerId: '', revision: -1 };

  function source(name) {
    return BASE + encodeURIComponent(FILES[name]);
  }

  function template(name) {
    if (!templates.has(name)) {
      const audio = new Audio(source(name));
      audio.preload = 'auto';
      audio.playsInline = true;
      templates.set(name, audio);
    }
    return templates.get(name);
  }

  function fade(audio, target, ms) {
    if (!audio) return;
    const start = Number(audio.volume) || 0;
    const end = Math.max(0, Math.min(1, target));
    const began = performance.now();
    const step = now => {
      const progress = Math.min(1, (now - began) / Math.max(16, ms));
      audio.volume = start + (end - start) * progress;
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function play(name, options = {}) {
    if (!enabled || !unlocked || !FILES[name]) return null;
    const audio = template(name).cloneNode(true);
    audio.volume = Math.max(0, Math.min(1, (options.volume ?? 0.15) * master));
    audio.playbackRate = Math.max(0.65, Math.min(1.4, options.rate || 1));
    audio.preservesPitch = false;
    const start = Math.max(0, Number(options.start) || 0);

    const begin = () => {
      try {
        if (start) audio.currentTime = Math.min(start, Math.max(0, audio.duration - 0.1));
      } catch {}
      audio.play().catch(() => {});
      if (options.duration) {
        const fadeAt = Math.max(0, options.duration - (options.fadeOut || 0.25));
        const fadeTimer = setTimeout(() => {
          clipTimers.delete(fadeTimer);
          fade(audio, 0, (options.fadeOut || 0.25) * 1000);
        }, fadeAt * 1000);
        const stopTimer = setTimeout(() => {
          clipTimers.delete(stopTimer);
          audio.pause();
          audio.removeAttribute('src');
        }, options.duration * 1000 + 80);
        clipTimers.add(fadeTimer);
        clipTimers.add(stopTimer);
      }
    };

    if (audio.readyState >= 1) begin();
    else audio.addEventListener('loadedmetadata', begin, { once: true });
    return audio;
  }

  function startLoop(name) {
    if (!unlocked || !enabled || document.hidden) return;
    if (loops.has(name)) {
      fade(loops.get(name), LOOP_LEVELS[name] * master, 450);
      return;
    }
    const audio = template(name).cloneNode(true);
    audio.loop = true;
    audio.volume = 0;
    audio.playsInline = true;
    loops.set(name, audio);
    audio.play()
      .then(() => fade(audio, LOOP_LEVELS[name] * master, 1800))
      .catch(() => loops.delete(name));
  }

  function stopLoop(name, ms = 1200) {
    const audio = loops.get(name);
    if (!audio) return;
    loops.delete(name);
    fade(audio, 0, ms);
    setTimeout(() => {
      audio.pause();
      audio.removeAttribute('src');
    }, ms + 100);
  }

  function refreshLoops() {
    if (!unlocked || !enabled || document.hidden) return;
    for (const name of ['room', 'hum']) {
      if (roomWanted) startLoop(name);
      else stopLoop(name, 1700);
    }
    for (const name of ['heartbeat', 'rumble']) {
      if (tensionWanted) startLoop(name);
      else stopLoop(name, 1400);
    }
    if (roomWanted) scheduleRoomDetail();
    else clearRoomDetail();
  }

  function clearRoomDetail() {
    if (roomTimer) clearTimeout(roomTimer);
    roomTimer = 0;
  }

  function scheduleRoomDetail() {
    clearRoomDetail();
    if (!roomWanted) return;
    roomTimer = setTimeout(() => {
      if (roomWanted && unlocked && !document.hidden) {
        const chain = Math.random() < 0.4;
        play(chain ? 'chain' : 'wood', {
          volume: chain ? 0.022 : 0.03,
          start: Math.random() * (chain ? 8 : 4),
          duration: chain ? 0.9 : 1.3,
          fadeOut: 0.3,
          rate: 0.94 + Math.random() * 0.12
        });
      }
      scheduleRoomDetail();
    }, 18000 + Math.random() * 24000);
  }

  function schedule(fn, ms) {
    const timer = setTimeout(() => {
      sequenceTimers.delete(timer);
      fn();
    }, ms);
    sequenceTimers.add(timer);
  }

  function clearSequence() {
    for (const timer of sequenceTimers) clearTimeout(timer);
    sequenceTimers.clear();
  }

  function alternate(a, b, last) {
    if (last === a) return b;
    if (last === b) return a;
    return Math.random() < 0.5 ? a : b;
  }

  function spinSound() {
    clearSequence();
    play('spin', { volume: 0.3, rate: 0.82 });
    [350, 820, 1420, 2180, 3070, 3970].forEach((delay, index) => {
      schedule(() => play('ratchet', {
        volume: Math.max(0.065, 0.12 - index * 0.009),
        rate: 1.08 - index * 0.055
      }), delay);
    });
    schedule(() => play('lock', { volume: 0.19 }), 4740);
  }

  function hammerSound() {
    lastHammer = alternate('hammerA', 'hammerB', lastHammer);
    play(lastHammer, { volume: 0.24 });
  }

  function blankSound() {
    lastDry = alternate('dryA', 'dryB', lastDry);
    play(lastDry, { volume: 0.31 });
    schedule(() => play('lock', { volume: 0.06 }), 35);
  }

  function duckLoop(name, low, hold, recover) {
    const audio = loops.get(name);
    if (!audio) return;
    fade(audio, LOOP_LEVELS[name] * master * low, 40);
    setTimeout(() => {
      if (loops.has(name)) fade(audio, LOOP_LEVELS[name] * master, recover);
    }, hold);
  }

  function gunshotSound() {
    duckLoop('room', 0.18, 180, 900);
    duckLoop('hum', 0.18, 180, 900);
    duckLoop('heartbeat', 0.12, 240, 1100);
    duckLoop('rumble', 0.12, 240, 1100);
    play('gunshot', { volume: 0.78 });
    play('rumble', {
      volume: 0.045,
      start: 0.2,
      duration: 1.6,
      fadeOut: 0.7,
      rate: 0.8
    });
  }

  function localUserId() {
    try {
      if (typeof userId !== 'undefined') return String(userId || '');
    } catch {}
    try {
      if (typeof currentUserId !== 'undefined') return String(currentUserId || '');
    } catch {}
    return localStorage.getItem('userId') || localStorage.getItem('tornUserId') || '';
  }

  function countShots(state) {
    const values = [state?.shotsFired, state?.shotCount, state?.turnNumber, state?.round];
    for (const value of values) {
      if (Number.isFinite(Number(value))) return Math.max(0, Number(value));
    }
    if (Array.isArray(state?.shots)) return state.shots.length;
    if (Array.isArray(state?.history)) return state.history.length;
    return 0;
  }

  function finishCue(game, root) {
    const state = game?.rouletteState || {};
    const winner = String(state.winnerId || game?.winner?.userId || game?.winnerId || '');
    const local = localUserId();
    if (winner && local) return winner === local ? 'victory' : 'defeat';
    const text = String(root?.querySelector('.rr-final')?.textContent || '').toLowerCase();
    return text.includes('you win') || text.includes('you won') || text.includes('victory')
      ? 'victory'
      : 'defeat';
  }

  function currentGame() {
    try {
      return rouletteLatestGame || null;
    } catch {
      return null;
    }
  }

  function sync() {
    const game = currentGame();
    if (!game) {
      roomWanted = false;
      tensionWanted = false;
      refreshLoops();
      return;
    }

    const state = game.rouletteState || {};
    const gameId = String(game.gameId || '');
    const status = String(game.status || '');
    const turnId = String(state.turnId || '');
    const joinerId = String(game.joiner?.userId || '');
    const revision = Number(game.revision ?? state.revision ?? -1);

    let root = null;
    try {
      root = duelActive?.querySelector(
        `[data-roulette-game][data-game-id="${CSS.escape(gameId)}"]`
      ) || null;
    } catch {}

    roomWanted = ['playing', 'waiting', 'open'].includes(status);
    tensionWanted = status === 'playing';
    refreshLoops();

    const sameGame = previous.gameId === gameId;
    if (sameGame && !previous.joinerId && joinerId) {
      play('chair', { volume: 0.09 });
    }
    if (sameGame && previous.turnId && turnId && previous.turnId !== turnId) {
      play('tap', { volume: 0.1 });
    }
    if (
      status === 'playing' &&
      state.lastOutcome === 'blank' &&
      revision !== previous.revision &&
      countShots(state) >= 3 &&
      !tensionPlayed.has(gameId)
    ) {
      tensionPlayed.add(gameId);
      play('tension', { volume: 0.085 });
    }
    if (status === 'complete' && previous.status !== 'complete') {
      tensionWanted = false;
      refreshLoops();
      const cue = finishCue(game, root);
      play(cue, { volume: cue === 'victory' ? 0.2 : 0.17 });
    }

    previous = { gameId, status, turnId, joinerId, revision };
  }

  function attemptDirectBindings() {
    global.rouletteSpinSound = spinSound;
    global.rouletteShotIndexSound = hammerSound;
    global.rouletteBlankSound = blankSound;
    global.rouletteGunshotSound = gunshotSound;

    try {
      if (typeof rouletteSpinSound !== 'undefined') {
        rouletteSpinSound = spinSound;
        direct.spin = rouletteSpinSound === spinSound;
      }
    } catch {}
    try {
      if (typeof rouletteShotIndexSound !== 'undefined') {
        rouletteShotIndexSound = hammerSound;
        direct.hammer = rouletteShotIndexSound === hammerSound;
      }
    } catch {}
    try {
      if (typeof rouletteBlankSound !== 'undefined') {
        rouletteBlankSound = blankSound;
        direct.blank = rouletteBlankSound === blankSound;
      }
    } catch {}
    try {
      if (typeof rouletteGunshotSound !== 'undefined') {
        rouletteGunshotSound = gunshotSound;
        direct.gunshot = rouletteGunshotSound === gunshotSound;
      }
    } catch {}
  }

  function hookOpeningSequence() {
    if (openingHooked) return;
    try {
      if (typeof rouletteOpeningSequence !== 'function') return;
      const originalOpening = rouletteOpeningSequence;
      if (originalOpening.__rrAudioHooked) {
        openingHooked = true;
        return;
      }
      const wrappedOpening = async function () {
        if (!direct.spin) spinSound();
        return originalOpening.apply(this, arguments);
      };
      wrappedOpening.__rrAudioHooked = true;
      rouletteOpeningSequence = wrappedOpening;
      openingHooked = rouletteOpeningSequence === wrappedOpening;
    } catch {}
  }

  function hookShotSequence() {
    if (shotHooked) return;
    try {
      if (typeof rouletteShotSequence !== 'function') return;
      const originalShot = rouletteShotSequence;
      if (originalShot.__rrAudioHooked) {
        shotHooked = true;
        return;
      }
      const wrappedShot = async function (_game, state) {
        if (!direct.hammer) hammerSound();
        if (!direct.blank || !direct.gunshot) {
          const live = state?.lastOutcome === 'live';
          schedule(() => {
            if (live) {
              if (!direct.gunshot) gunshotSound();
            } else if (!direct.blank) {
              blankSound();
            }
          }, 255);
        }
        return originalShot.apply(this, arguments);
      };
      wrappedShot.__rrAudioHooked = true;
      rouletteShotSequence = wrappedShot;
      shotHooked = rouletteShotSequence === wrappedShot;
    } catch {}
  }

  function hookBind() {
    if (bindHooked) return;
    try {
      if (typeof rouletteBind !== 'function') return;
      const originalBind = rouletteBind;
      if (originalBind.__rrAudioHooked) {
        bindHooked = true;
        return;
      }
      const wrappedBind = function () {
        const result = originalBind.apply(this, arguments);
        queueMicrotask(sync);
        return result;
      };
      wrappedBind.__rrAudioHooked = true;
      rouletteBind = wrappedBind;
      bindHooked = rouletteBind === wrappedBind;
    } catch {}
  }

  function installHooks() {
    attemptDirectBindings();
    hookOpeningSequence();
    hookShotSequence();
    hookBind();
  }

  function beginPolling() {
    if (pollTimer) return;
    const tick = () => {
      installHooks();
      sync();
      pollTimer = global.setTimeout(tick, 750);
    };
    tick();
  }

  function unlock() {
    if (unlocked) return;
    unlocked = true;
    for (const name of [
      'spin', 'ratchet', 'lock', 'hammerA', 'hammerB',
      'dryA', 'dryB', 'gunshot', 'tap'
    ]) {
      template(name).load();
    }
    installHooks();
    sync();
    refreshLoops();
  }

  function setEnabled(value) {
    enabled = Boolean(value);
    if (!enabled) {
      for (const name of [...loops.keys()]) stopLoop(name, 250);
    } else {
      refreshLoops();
    }
  }

  function setMasterVolume(value) {
    master = Math.max(0, Math.min(1, Number(value) || 0));
    for (const [name, audio] of loops) {
      fade(audio, LOOP_LEVELS[name] * master, 250);
    }
  }

  function diagnostics() {
    return {
      unlocked,
      enabled,
      direct: { ...direct },
      hooks: { bindHooked, openingHooked, shotHooked },
      activeLoops: [...loops.keys()],
      game: currentGame()
        ? {
            gameId: String(currentGame().gameId || ''),
            status: String(currentGame().status || '')
          }
        : null
    };
  }

  global.RouletteAudio = Object.freeze({
    FILES,
    unlock,
    sync,
    spinSound,
    hammerSound,
    blankSound,
    gunshotSound,
    setEnabled,
    setMasterVolume,
    diagnostics
  });

  installHooks();
  beginPolling();

  for (const name of [
    'spin', 'ratchet', 'lock', 'hammerA', 'hammerB',
    'dryA', 'dryB', 'gunshot', 'tap'
  ]) {
    template(name).load();
  }

  for (const type of ['pointerdown', 'pointerup', 'touchstart', 'click', 'keydown']) {
    document.addEventListener(type, unlock, {
      capture: true,
      passive: true,
      once: true
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      for (const audio of loops.values()) fade(audio, 0, 180);
    } else if (enabled) {
      sync();
      refreshLoops();
    }
  });
})(window);
