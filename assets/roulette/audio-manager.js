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

  const BASE_LOOP_LEVELS = Object.freeze({
    room: 0.085,
    hum: 0.032,
    heartbeat: 0.040,
    rumble: 0.022
  });

  function preferAmbientAudioSession() {
    try {
      if (global.navigator?.audioSession && 'type' in global.navigator.audioSession) {
        global.navigator.audioSession.type = 'ambient';
      }
    } catch {}
  }

  const templates = new Map();
  const loops = new Map();
  const groups = new Map();
  const actionTimers = new Map();
  const lastActionAt = new Map();
  const tensionPlayed = new Set();
  const legacyNoop = function () { return null; };

  let unlocked = false;
  let enabled = true;
  let master = 1;
  let roomWanted = false;
  let tensionWanted = false;
  let currentShotCount = 0;
  let roomTimer = 0;
  let pollTimer = 0;
  let lampTimer = 0;
  let bindingsReady = false;
  let hammerVariant = 0;
  let dryVariant = 0;
  let lastLampEndpoint = -1;
  let lastLampCreakAt = 0;
  let previous = {
    gameId: '',
    status: '',
    turnId: '',
    joinerId: '',
    revision: -1,
    outcome: ''
  };

  function source(name) {
    return BASE + encodeURIComponent(FILES[name]);
  }

  function template(name) {
    if (!templates.has(name)) {
      const audio = new Audio(source(name));
      audio.preload = ['room', 'hum', 'heartbeat', 'rumble'].includes(name) ? 'metadata' : 'auto';
      audio.playsInline = true;
      templates.set(name, audio);
    }
    return templates.get(name);
  }

  function fade(audio, target, duration = 250) {
    if (!audio) return;
    const token = Symbol('fade');
    audio.__rrAudioFadeToken = token;
    const start = Number(audio.volume) || 0;
    const end = Math.max(0, Math.min(1, Number(target) || 0));
    const began = performance.now();
    const milliseconds = Math.max(16, Number(duration) || 16);
    const step = now => {
      if (audio.__rrAudioFadeToken !== token) return;
      const progress = Math.min(1, (now - began) / milliseconds);
      audio.volume = start + (end - start) * progress;
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function registerGroup(group, audio) {
    if (!group || !audio) return;
    if (!groups.has(group)) groups.set(group, new Set());
    const set = groups.get(group);
    set.add(audio);
    const cleanup = () => {
      set.delete(audio);
      if (!set.size) groups.delete(group);
    };
    audio.addEventListener('ended', cleanup, { once: true });
    audio.addEventListener('error', cleanup, { once: true });
  }

  function stopGroup(group, fadeMs = 70) {
    const set = groups.get(group);
    if (!set) return;
    groups.delete(group);
    for (const audio of set) {
      fade(audio, 0, fadeMs);
      setTimeout(() => {
        try { audio.pause(); } catch {}
        audio.removeAttribute('src');
      }, fadeMs + 40);
    }
  }

  function clearActionTimers(group) {
    const timers = actionTimers.get(group);
    if (!timers) return;
    actionTimers.delete(group);
    for (const timer of timers) clearTimeout(timer);
  }

  function scheduleAction(group, callback, delay) {
    if (!actionTimers.has(group)) actionTimers.set(group, new Set());
    const timers = actionTimers.get(group);
    const timer = setTimeout(() => {
      timers.delete(timer);
      if (!timers.size) actionTimers.delete(group);
      callback();
    }, Math.max(0, Number(delay) || 0));
    timers.add(timer);
    return timer;
  }

  function permitAction(name, minimumGap) {
    const now = performance.now();
    const last = Number(lastActionAt.get(name)) || -Infinity;
    if (now - last < minimumGap) return false;
    lastActionAt.set(name, now);
    return true;
  }

  function play(name, options = {}) {
    if (!enabled || !unlocked || document.hidden || !FILES[name]) return null;
    if (options.replaceGroup && options.group) stopGroup(options.group, options.replaceFade ?? 45);

    const audio = template(name).cloneNode(true);
    audio.volume = Math.max(0, Math.min(1, (options.volume ?? 0.15) * master));
    audio.playbackRate = Math.max(0.68, Math.min(1.4, Number(options.rate) || 1));
    audio.preservesPitch = false;
    audio.playsInline = true;
    registerGroup(options.group, audio);

    const startAt = Math.max(0, Number(options.start) || 0);
    const begin = () => {
      try {
        if (startAt && Number.isFinite(audio.duration)) {
          audio.currentTime = Math.min(startAt, Math.max(0, audio.duration - 0.08));
        }
      } catch {}
      audio.play().catch(() => {});
      if (!options.duration) return;
      const clipDuration = Math.max(0.1, Number(options.duration) || 0.1);
      const fadeOut = Math.min(clipDuration, Math.max(0.06, Number(options.fadeOut) || 0.2));
      setTimeout(() => fade(audio, 0, fadeOut * 1000), Math.max(0, clipDuration - fadeOut) * 1000);
      setTimeout(() => {
        try { audio.pause(); } catch {}
        audio.removeAttribute('src');
      }, clipDuration * 1000 + 80);
    };

    if (audio.readyState >= 1 || !startAt) begin();
    else audio.addEventListener('loadedmetadata', begin, { once: true });
    return audio;
  }

  function loopTarget(name) {
    let level = BASE_LOOP_LEVELS[name] || 0;
    if (name === 'heartbeat') level += Math.min(0.034, currentShotCount * 0.0055);
    if (name === 'rumble') level += Math.min(0.014, currentShotCount * 0.0022);
    return level * master;
  }

  function startLoop(name) {
    if (!unlocked || !enabled || document.hidden || !FILES[name]) return;
    const existing = loops.get(name);
    if (existing) {
      fade(existing, loopTarget(name), 500);
      return;
    }
    const audio = template(name).cloneNode(true);
    audio.loop = true;
    audio.volume = 0;
    audio.playsInline = true;
    loops.set(name, audio);
    audio.play()
      .then(() => fade(audio, loopTarget(name), 1800))
      .catch(() => loops.delete(name));
  }

  function stopLoop(name, duration = 1200) {
    const audio = loops.get(name);
    if (!audio) return;
    loops.delete(name);
    fade(audio, 0, duration);
    setTimeout(() => {
      try { audio.pause(); } catch {}
      audio.removeAttribute('src');
    }, duration + 100);
  }

  function refreshLoops() {
    if (!unlocked || !enabled || document.hidden) return;
    for (const name of ['room', 'hum']) {
      if (roomWanted) startLoop(name);
      else stopLoop(name, 1600);
    }
    for (const name of ['heartbeat', 'rumble']) {
      if (tensionWanted) startLoop(name);
      else stopLoop(name, 1300);
    }
  }

  function duckForShot() {
    for (const [name, scale, hold, recovery] of [
      ['room', 0.15, 180, 950],
      ['hum', 0.12, 180, 950],
      ['heartbeat', 0.08, 260, 1150],
      ['rumble', 0.08, 260, 1150]
    ]) {
      const audio = loops.get(name);
      if (!audio) continue;
      fade(audio, loopTarget(name) * scale, 40);
      setTimeout(() => {
        if (loops.get(name) === audio) fade(audio, loopTarget(name), recovery);
      }, hold);
    }
  }

  function openingSpin() {
    if (!permitAction('openingSpin', 1100)) return;
    clearActionTimers('opening');
    stopGroup('opening', 55);
    play('spin', { group: 'opening', volume: 0.36, rate: 0.82 });
    [360, 900, 1540, 2320, 3200, 4100].forEach((delay, index) => {
      scheduleAction('opening', () => play('ratchet', {
        group: 'opening',
        volume: Math.max(0.062, 0.125 - index * 0.009),
        rate: 1.08 - index * 0.055
      }), delay);
    });
    scheduleAction('opening', () => play('lock', {
      group: 'opening',
      volume: 0.21,
      rate: 1
    }), 4780);
  }

  function turnRotate(duration = 1020) {
    if (!permitAction('turnRotate', 420)) return;
    clearActionTimers('turn');
    stopGroup('turn', 45);
    const milliseconds = Math.max(500, Number(duration) || 1020);
    play('ratchet', {
      group: 'turn',
      volume: 0.19,
      rate: 0.92,
      duration: Math.min(0.82, milliseconds / 1000),
      fadeOut: 0.18
    });
    scheduleAction('turn', () => play('lock', {
      group: 'turn',
      volume: 0.14,
      rate: 1.03
    }), Math.max(260, milliseconds - 170));
  }

  let countdownSynthContext = null;

  function countdownSynthAudioContext() {
    if (countdownSynthContext && countdownSynthContext.state !== 'closed') return countdownSynthContext;
    const AudioContextType = global.AudioContext || global.webkitAudioContext;
    if (typeof AudioContextType !== 'function') return null;
    try {
      countdownSynthContext = new AudioContextType({ latencyHint: 'interactive' });
    } catch {
      try { countdownSynthContext = new AudioContextType(); } catch { countdownSynthContext = null; }
    }
    return countdownSynthContext;
  }

  function countdownSynthTone(context, destination, options) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = options.start;
    const duration = options.duration;
    const attack = Math.min(duration * 0.25, options.attack || 0.012);
    const level = Math.max(0.0001, options.level || 0.04);

    oscillator.type = options.type || 'sine';
    oscillator.frequency.setValueAtTime(options.frequency, start);
    if (options.endFrequency && options.endFrequency > 0) {
      oscillator.frequency.exponentialRampToValueAtTime(options.endFrequency, start + duration);
    }
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(level, start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.025);
  }

  function countdownSynthClick(context, destination, start, level) {
    const sampleRate = context.sampleRate || 44100;
    const frameCount = Math.max(1, Math.floor(sampleRate * 0.055));
    const buffer = context.createBuffer(1, frameCount, sampleRate);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < frameCount; index += 1) {
      const envelope = 1 - index / frameCount;
      channel[index] = (Math.random() * 2 - 1) * envelope * envelope;
    }

    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1450, start);
    filter.Q.setValueAtTime(1.8, start);
    gain.gain.setValueAtTime(Math.max(0.0001, level), start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.055);
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
    source.start(start);
  }

  function countdownCue(label) {
    const value = String(label || '');
    if (!['3', '2', '1', 'GO!'].includes(value)) return false;
    if (!enabled || !unlocked || document.hidden) return false;

    const context = countdownSynthAudioContext();
    if (!context) return false;

    try {
      if (context.state === 'suspended') context.resume().catch(() => {});
      const now = context.currentTime + 0.014;
      const output = context.createGain();
      output.gain.setValueAtTime(Math.max(0.08, master), now);
      output.connect(context.destination);

      if (value === 'GO!') {
        countdownSynthClick(context, output, now, 0.11);
        countdownSynthTone(context, output, {
          start: now,
          duration: 0.30,
          frequency: 293.66,
          endFrequency: 220,
          type: 'triangle',
          level: 0.105,
          attack: 0.008
        });
        countdownSynthTone(context, output, {
          start: now + 0.065,
          duration: 0.42,
          frequency: 440,
          endFrequency: 659.25,
          type: 'sine',
          level: 0.075,
          attack: 0.012
        });
        countdownSynthTone(context, output, {
          start: now + 0.075,
          duration: 0.34,
          frequency: 880,
          endFrequency: 1174.66,
          type: 'triangle',
          level: 0.026,
          attack: 0.009
        });
      } else {
        const step = value === '3' ? 0 : value === '2' ? 1 : 2;
        const fundamental = [174.61, 207.65, 246.94][step];
        countdownSynthClick(context, output, now, 0.075 + step * 0.008);
        countdownSynthTone(context, output, {
          start: now,
          duration: 0.24,
          frequency: fundamental,
          endFrequency: fundamental * 0.82,
          type: 'triangle',
          level: 0.082,
          attack: 0.007
        });
        countdownSynthTone(context, output, {
          start: now + 0.012,
          duration: 0.19,
          frequency: fundamental * 3,
          endFrequency: fundamental * 2.25,
          type: 'sine',
          level: 0.026,
          attack: 0.005
        });
      }

      global.setTimeout(() => {
        try { output.disconnect(); } catch {}
      }, value === 'GO!' ? 900 : 520);
      return true;
    } catch {
      return false;
    }
  }

  function hammer() {
    if (!permitAction('hammer', 170)) return;
    stopGroup('hammer', 35);
    const name = hammerVariant++ % 2 === 0 ? 'hammerA' : 'hammerB';
    play(name, { group: 'hammer', volume: 0.26, rate: 1 });
  }

  function blank() {
    if (!permitAction('blank', 180)) return;
    stopGroup('shot', 35);
    const name = dryVariant++ % 2 === 0 ? 'dryA' : 'dryB';
    play(name, { group: 'shot', volume: 0.34, rate: 1 });
    scheduleAction('blank', () => play('lock', {
      group: 'shot',
      volume: 0.05,
      rate: 1.02
    }), 45);
  }

  function gunshot() {
    if (!permitAction('gunshot', 260)) return;
    clearActionTimers('blank');
    stopGroup('shot', 35);
    duckForShot();
    play('gunshot', { group: 'shot', volume: 0.78, rate: 1 });
    play('rumble', {
      group: 'shot-body',
      replaceGroup: true,
      volume: 0.036,
      rate: 0.8,
      start: 0.2,
      duration: 1.65,
      fadeOut: 0.72
    });
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
    try { if (typeof userId !== 'undefined') return String(userId || ''); } catch {}
    try { if (typeof currentUserId !== 'undefined') return String(currentUserId || ''); } catch {}
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

  function clearRoomDetail() {
    if (roomTimer) clearTimeout(roomTimer);
    roomTimer = 0;
  }

  function scheduleRoomDetail() {
    clearRoomDetail();
    if (!roomWanted) return;
    roomTimer = setTimeout(() => {
      if (roomWanted && unlocked && !document.hidden) {
        play('wood', {
          group: 'room-detail',
          replaceGroup: true,
          volume: 0.034,
          start: Math.random() * 4,
          duration: 1.4,
          fadeOut: 0.36,
          rate: 0.94 + Math.random() * 0.12
        });
      }
      scheduleRoomDetail();
    }, 19000 + Math.random() * 27000);
  }

  function lampSpeedSeconds() {
    let speed = 5.6;
    try {
      const api = global.RouletteLampConfig;
      speed = Number(api?.defaults?.speed) || speed;
      const saved = JSON.parse(localStorage.getItem(api?.storageKey || 'rrLampCalibrationV9') || 'null');
      if (saved && Number(saved.speed) > 0) speed = Number(saved.speed);
    } catch {}
    return Math.max(2, Math.min(20, speed));
  }

  function trackLampSwing() {
    if (!roomWanted || !unlocked || document.hidden) return;
    const epoch = Number(global.__rrLampPhaseEpoch);
    if (!Number.isFinite(epoch)) return;
    const duration = lampSpeedSeconds() * 1000;
    const elapsed = ((Date.now() - epoch) % duration + duration) % duration;
    const phase = elapsed / duration;
    let endpoint = -1;
    if (phase < 0.035 || phase > 0.965) endpoint = 0;
    else if (Math.abs(phase - 0.5) < 0.035) endpoint = 1;

    if (endpoint < 0) {
      lastLampEndpoint = -1;
      return;
    }
    if (endpoint === lastLampEndpoint) return;
    lastLampEndpoint = endpoint;
    const now = Date.now();
    if (now - lastLampCreakAt < 4700 || Math.random() > 0.62) return;
    lastLampCreakAt = now;
    play('chain', {
      group: 'lamp-chain',
      replaceGroup: true,
      volume: 0.027,
      start: endpoint === 0 ? 0.4 + Math.random() * 1.2 : 3.2 + Math.random() * 2.2,
      duration: 0.82,
      fadeOut: 0.28,
      rate: 0.93 + Math.random() * 0.11
    });
  }

  function silenceLegacyRouletteAudio() {
    try { rouletteSpinSound = legacyNoop; } catch {}
    try { rouletteShotIndexSound = legacyNoop; } catch {}
    try { rouletteBlankSound = legacyNoop; } catch {}
    try { rouletteGunshotSound = legacyNoop; } catch {}
    try { rouletteTone = legacyNoop; } catch {}
    global.rouletteSpinSound = legacyNoop;
    global.rouletteShotIndexSound = legacyNoop;
    global.rouletteBlankSound = legacyNoop;
    global.rouletteGunshotSound = legacyNoop;
  }

  function sync() {
    silenceLegacyRouletteAudio();
    const game = currentGame();
    if (!game) {
      roomWanted = false;
      tensionWanted = false;
      currentShotCount = 0;
      refreshLoops();
      clearRoomDetail();
      previous = { gameId: '', status: '', turnId: '', joinerId: '', revision: -1, outcome: '' };
      return;
    }

    const state = game.rouletteState || {};
    const gameId = String(game.gameId || '');
    const status = String(game.status || '');
    const turnId = String(state.turnId || '');
    const joinerId = String(game.joiner?.userId || '');
    const revision = Number(game.revision ?? state.revision ?? -1);
    const outcome = String(state.lastOutcome || '');
    const sameGame = previous.gameId === gameId;

    let root = null;
    try {
      root = duelActive?.querySelector(
        `[data-roulette-game][data-game-id="${CSS.escape(gameId)}"]`
      ) || null;
    } catch {}

    roomWanted = ['waiting', 'open', 'ready', 'countdown', 'playing', 'complete'].includes(status);
    tensionWanted = status === 'playing';
    currentShotCount = countShots(state);
    refreshLoops();
    if (roomWanted && !roomTimer) scheduleRoomDetail();
    if (!roomWanted) clearRoomDetail();

    if (sameGame && !previous.joinerId && joinerId) {
      play('chair', { group: 'join', replaceGroup: true, volume: 0.1, duration: 2.4, fadeOut: 0.55 });
    }

    if (sameGame && previous.turnId && turnId && previous.turnId !== turnId && status === 'playing') {
      clearActionTimers('turn-cue');
      stopGroup('turn-cue', 24);
      turnRotate(1020);
    }

    if (
      sameGame &&
      status === 'playing' &&
      outcome === 'blank' &&
      revision !== previous.revision &&
      currentShotCount >= 3 &&
      !tensionPlayed.has(gameId)
    ) {
      tensionPlayed.add(gameId);
      scheduleAction('tension', () => play('tension', {
        group: 'tension-stinger',
        replaceGroup: true,
        volume: 0.095,
        duration: 4.8,
        fadeOut: 1.2
      }), 620);
    }

    if (sameGame && previous.status && status === 'complete' && previous.status !== 'complete') {
      tensionWanted = false;
      refreshLoops();
      const cue = finishCue(game, root);
      play(cue, {
        group: 'ending',
        replaceGroup: true,
        volume: cue === 'victory' ? 0.21 : 0.18,
        duration: cue === 'victory' ? 4.5 : 2.2,
        fadeOut: cue === 'victory' ? 1.15 : 0.65
      });
    }

    previous = { gameId, status, turnId, joinerId, revision, outcome };
  }

  function unlock() {
    preferAmbientAudioSession();
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
      for (const group of [...groups.keys()]) stopGroup(group, 80);
    } else {
      refreshLoops();
    }
  }

  function setMasterVolume(value) {
    master = Math.max(0, Math.min(1, Number(value) || 0));
    for (const [name, audio] of loops) fade(audio, loopTarget(name), 300);
  }

  function markBindingsReady() {
    bindingsReady = true;
    silenceLegacyRouletteAudio();
  }

  function diagnostics() {
    const game = currentGame();
    return {
      unlocked,
      enabled,
      bindingsReady,
      activeLoops: [...loops.keys()],
      activeGroups: [...groups.keys()],
      roomWanted,
      tensionWanted,
      legacyMuted: global.rouletteSpinSound === legacyNoop,
      game: game ? { gameId: String(game.gameId || ''), status: String(game.status || '') } : null
    };
  }

  global.RouletteAudio = Object.freeze({
    FILES,
    unlock,
    sync,
    openingSpin,
    turnRotate,
    countdownCue,
    hammer,
    blank,
    gunshot,
    duckForShot,
    markBindingsReady,
    setEnabled,
    setMasterVolume,
    diagnostics
  });

  preferAmbientAudioSession();
  silenceLegacyRouletteAudio();
  for (const type of ['pointerdown', 'pointerup', 'touchstart', 'click', 'keydown']) {
    document.addEventListener(type, unlock, { capture: true, passive: true, once: true });
  }

  const poll = () => {
    sync();
    pollTimer = global.setTimeout(poll, 500);
  };
  poll();
  lampTimer = global.setInterval(trackLampSwing, 140);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      for (const [name, audio] of loops) fade(audio, 0, 160);
    } else if (enabled) {
      sync();
      refreshLoops();
    }
  });

  global.addEventListener('pagehide', () => {
    clearTimeout(pollTimer);
    clearInterval(lampTimer);
  }, { once: true });
})(window);
