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
    chain: 'freesound_community-chain-6073.mp3'
  });
  const LOOP_LEVELS = Object.freeze({
    room: 0.07,
    hum: 0.028,
    heartbeat: 0.045,
    rumble: 0.018
  });

  const templates = new Map();
  const loops = new Map();
  const clipTimers = new Set();
  const tensionPlayed = new Set();
  let unlocked = false;
  let enabled = true;
  let master = 1;
  let roomWanted = false;
  let tensionWanted = false;
  let roomTimer = 0;
  let pollTimer = 0;
  let previous = {
    gameId: '',
    status: '',
    turnId: '',
    joinerId: '',
    revision: -1
  };

  function source(name) {
    return BASE + encodeURIComponent(FILES[name]);
  }

  function template(name) {
    if (!templates.has(name)) {
      const audio = new Audio(source(name));
      audio.preload = 'metadata';
      audio.playsInline = true;
      templates.set(name, audio);
    }
    return templates.get(name);
  }

  function fade(audio, target, duration) {
    if (!audio) return;
    const start = Number(audio.volume) || 0;
    const end = Math.max(0, Math.min(1, Number(target) || 0));
    const began = performance.now();
    const milliseconds = Math.max(16, Number(duration) || 16);
    const step = now => {
      const progress = Math.min(1, (now - began) / milliseconds);
      audio.volume = start + (end - start) * progress;
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function play(name, options = {}) {
    if (!enabled || !unlocked || document.hidden || !FILES[name]) return null;
    const audio = template(name).cloneNode(true);
    audio.volume = Math.max(0, Math.min(1, (options.volume ?? 0.15) * master));
    audio.playbackRate = Math.max(0.7, Math.min(1.35, Number(options.rate) || 1));
    audio.preservesPitch = false;
    audio.playsInline = true;
    const start = Math.max(0, Number(options.start) || 0);

    const begin = () => {
      try {
        if (start && Number.isFinite(audio.duration)) {
          audio.currentTime = Math.min(start, Math.max(0, audio.duration - 0.1));
        }
      } catch {}
      audio.play().catch(() => {});
      if (!options.duration) return;
      const duration = Math.max(0.1, Number(options.duration) || 0.1);
      const fadeOut = Math.min(duration, Math.max(0.08, Number(options.fadeOut) || 0.25));
      const fadeTimer = setTimeout(() => {
        clipTimers.delete(fadeTimer);
        fade(audio, 0, fadeOut * 1000);
      }, Math.max(0, duration - fadeOut) * 1000);
      const stopTimer = setTimeout(() => {
        clipTimers.delete(stopTimer);
        audio.pause();
        audio.removeAttribute('src');
      }, duration * 1000 + 100);
      clipTimers.add(fadeTimer);
      clipTimers.add(stopTimer);
    };

    if (audio.readyState >= 1) begin();
    else audio.addEventListener('loadedmetadata', begin, { once: true });
    return audio;
  }

  function startLoop(name) {
    if (!unlocked || !enabled || document.hidden || !FILES[name]) return;
    const existing = loops.get(name);
    if (existing) {
      fade(existing, LOOP_LEVELS[name] * master, 450);
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

  function stopLoop(name, duration = 1200) {
    const audio = loops.get(name);
    if (!audio) return;
    loops.delete(name);
    fade(audio, 0, duration);
    setTimeout(() => {
      audio.pause();
      audio.removeAttribute('src');
    }, duration + 100);
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
        const useChain = Math.random() < 0.38;
        play(useChain ? 'chain' : 'wood', {
          volume: useChain ? 0.026 : 0.035,
          start: Math.random() * (useChain ? 8 : 4),
          duration: useChain ? 1.05 : 1.45,
          fadeOut: 0.35,
          rate: 0.94 + Math.random() * 0.12
        });
      }
      scheduleRoomDetail();
    }, 18000 + Math.random() * 24000);
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
    for (const value of [state?.shotsFired, state?.shotCount, state?.turnNumber, state?.round]) {
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

  function sync() {
    const game = currentGame();
    if (!game) {
      roomWanted = false;
      tensionWanted = false;
      refreshLoops();
      previous = { gameId: '', status: '', turnId: '', joinerId: '', revision: -1 };
      return;
    }

    const state = game.rouletteState || {};
    const gameId = String(game.gameId || '');
    const status = String(game.status || '');
    const turnId = String(state.turnId || '');
    const joinerId = String(game.joiner?.userId || '');
    const revision = Number(game.revision ?? state.revision ?? -1);
    const sameGame = previous.gameId === gameId;

    let root = null;
    try {
      root = duelActive?.querySelector(
        `[data-roulette-game][data-game-id="${CSS.escape(gameId)}"]`
      ) || null;
    } catch {}

    roomWanted = ['playing', 'waiting', 'open'].includes(status);
    tensionWanted = status === 'playing';
    refreshLoops();

    if (sameGame && !previous.joinerId && joinerId) play('chair', { volume: 0.1 });
    if (sameGame && previous.turnId && turnId && previous.turnId !== turnId) {
      play('tap', { volume: 0.12 });
    }
    if (
      sameGame &&
      status === 'playing' &&
      state.lastOutcome === 'blank' &&
      revision !== previous.revision &&
      countShots(state) >= 3 &&
      !tensionPlayed.has(gameId)
    ) {
      tensionPlayed.add(gameId);
      play('tension', { volume: 0.1 });
    }
    if (sameGame && previous.status && status === 'complete' && previous.status !== 'complete') {
      tensionWanted = false;
      refreshLoops();
      const cue = finishCue(game, root);
      play(cue, { volume: cue === 'victory' ? 0.22 : 0.19 });
    }

    previous = { gameId, status, turnId, joinerId, revision };
  }

  function duckForShot() {
    for (const [name, low, hold, recover] of [
      ['room', 0.16, 180, 950],
      ['hum', 0.16, 180, 950],
      ['heartbeat', 0.1, 250, 1150],
      ['rumble', 0.1, 250, 1150]
    ]) {
      const audio = loops.get(name);
      if (!audio) continue;
      fade(audio, LOOP_LEVELS[name] * master * low, 45);
      setTimeout(() => {
        if (loops.has(name)) fade(audio, LOOP_LEVELS[name] * master, recover);
      }, hold);
    }
  }

  function unlock() {
    if (unlocked) return;
    unlocked = true;
    for (const name of Object.keys(FILES)) template(name).load();
    sync();
    refreshLoops();
  }

  function setEnabled(value) {
    enabled = Boolean(value);
    if (!enabled) {
      clearRoomDetail();
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
      activeLoops: [...loops.keys()],
      roomWanted,
      tensionWanted,
      game: currentGame()
        ? {
            gameId: String(currentGame().gameId || ''),
            status: String(currentGame().status || '')
          }
        : null
    };
  }

  function beginPolling() {
    if (pollTimer) return;
    const tick = () => {
      sync();
      pollTimer = global.setTimeout(tick, 750);
    };
    tick();
  }

  global.RouletteAmbientAudio = Object.freeze({
    FILES,
    unlock,
    sync,
    duckForShot,
    setEnabled,
    setMasterVolume,
    diagnostics
  });

  beginPolling();
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
