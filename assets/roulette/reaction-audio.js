(function (global) {
  'use strict';

  if (global.__rrReactionAudioV1) return;
  global.__rrReactionAudioV1 = true;

  const RELIEF_SOURCES = Object.freeze([
    [
      '/assets/roulette/audio-data/relief-sigh-1-1.b64',
      '/assets/roulette/audio-data/relief-sigh-1-2a.b64',
      '/assets/roulette/audio-data/relief-sigh-1-2b.b64'
    ],
    [
      '/assets/roulette/audio-data/relief-sigh-2-1.b64',
      '/assets/roulette/audio-data/relief-sigh-2-2.b64'
    ],
    [
      '/assets/roulette/audio-data/relief-sigh-3-1.b64',
      '/assets/roulette/audio-data/relief-sigh-3-2.b64'
    ]
  ]);
  const CHAIR_FALL_SOURCE = Object.freeze([
    '/assets/roulette/audio-data/body-chair-fall-1.b64',
    '/assets/roulette/audio-data/body-chair-fall-2.b64',
    '/assets/roulette/audio-data/body-chair-fall-3a.b64',
    '/assets/roulette/audio-data/body-chair-fall-3b-1.b64',
    '/assets/roulette/audio-data/body-chair-fall-3b-2.b64',
    '/assets/roulette/audio-data/body-chair-fall-4.b64'
  ]);
  const INITIAL_BLANKS = 5;
  const MAX_BLANKS_FOR_RELIEF = 3;
  const RELIEF_CHANCE_PER_THOUSAND = 300;
  const LIVE_DELAY_MS = 720;
  const RELIEF_DELAY_MS = 650;

  const sourceCache = new Map();
  const seenShots = new Set();
  const timers = new Set();
  let activeClip = null;

  function stopClip(clip) {
    if (!clip) return;
    try { clip.pause(); } catch {}
    try { clip.removeAttribute('src'); } catch {}
  }

  function stableHash(value) {
    let hash = 2166136261;
    const text = String(value || '');
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function outcomeName(state) {
    return String(
      state?.lastOutcome || state?.outcome || state?.shotOutcome ||
      state?.lastShot?.outcome || state?.lastShotResult || ''
    ).toLowerCase();
  }

  function shotKey(game, state, gameId) {
    const count = state?.shotsFired ?? state?.shotCount ?? state?.turnNumber ?? state?.round ??
      (Array.isArray(state?.shots) ? state.shots.length : '') ??
      (Array.isArray(state?.history) ? state.history.length : '');
    return [
      gameId || game?.gameId || 'shot-reaction',
      game?.revision ?? state?.revision ?? count ?? '',
      state?.turnId || '',
      outcomeName(state)
    ].join(':');
  }

  function blankCount(state) {
    for (const list of [state?.shots, state?.history, state?.outcomes, state?.shotHistory]) {
      if (!Array.isArray(list)) continue;
      return list.reduce((total, entry) => {
        const value = String(entry?.outcome ?? entry?.result ?? entry?.type ?? entry ?? '').toLowerCase();
        return total + (/blank|dry|safe|click/.test(value) ? 1 : 0);
      }, 0);
    }
    return null;
  }

  function blanksRemaining(state) {
    for (const value of [
      state?.blanksRemaining, state?.remainingBlanks, state?.blanksLeft,
      state?.blankRoundsRemaining, state?.remainingBlankCount, state?.blankCountRemaining
    ]) {
      const number = Number(value);
      if (Number.isFinite(number)) return Math.max(0, Math.floor(number));
    }
    const counted = blankCount(state);
    if (Number.isFinite(counted)) return Math.max(0, INITIAL_BLANKS - counted);
    const shots = Number(state?.shotsFired ?? state?.shotCount ?? state?.turnNumber ?? state?.round);
    if (Number.isFinite(shots) && /blank|dry|safe|click/.test(outcomeName(state))) {
      return Math.max(0, INITIAL_BLANKS - Math.floor(shots));
    }
    return null;
  }

  function sourceKey(parts) {
    return parts.join('|');
  }

  function audioSource(parts) {
    const key = sourceKey(parts);
    if (!sourceCache.has(key)) {
      sourceCache.set(key, Promise.all(parts.map(path =>
        fetch(path, { cache: 'force-cache' }).then(response => {
          if (!response.ok) throw new Error(`Reaction audio failed to load: ${path}`);
          return response.text();
        })
      )).then(chunks => `data:audio/mpeg;base64,${chunks.map(value => value.trim()).join('')}`)
        .catch(error => {
          sourceCache.delete(key);
          throw error;
        }));
    }
    return sourceCache.get(key);
  }

  function preload() {
    for (const source of [...RELIEF_SOURCES, CHAIR_FALL_SOURCE]) {
      audioSource(source).catch(() => {});
    }
  }

  async function playSource(parts, volume) {
    if (document.hidden) return;
    let source = '';
    try { source = await audioSource(parts); } catch { return; }
    if (!source || document.hidden) return;

    stopClip(activeClip);
    const clip = new Audio(source);
    clip.preload = 'auto';
    clip.playsInline = true;
    clip.preservesPitch = false;
    clip.volume = Math.max(0, Math.min(1, Number(volume) || 0));
    activeClip = clip;
    const cleanup = () => {
      if (activeClip === clip) activeClip = null;
    };
    clip.addEventListener('ended', cleanup, { once: true });
    clip.addEventListener('error', cleanup, { once: true });
    clip.play().catch(cleanup);
  }

  function schedule(callback, delay) {
    const timer = global.setTimeout(() => {
      timers.delete(timer);
      callback();
    }, delay);
    timers.add(timer);
  }

  function queueReaction(game, state, gameId) {
    const outcome = outcomeName(state);
    if (!outcome) return;
    const key = shotKey(game, state, gameId);
    if (seenShots.has(key)) return;
    seenShots.add(key);

    if (/live|shot|bullet|fatal/.test(outcome)) {
      schedule(() => playSource(CHAIR_FALL_SOURCE, 0.52), LIVE_DELAY_MS);
      return;
    }
    if (!/blank|dry|safe|click/.test(outcome)) return;

    const remaining = blanksRemaining(state);
    if (!Number.isFinite(remaining) || remaining > MAX_BLANKS_FOR_RELIEF) return;
    const hash = stableHash(key);
    if (hash % 1000 >= RELIEF_CHANCE_PER_THOUSAND) return;
    const source = RELIEF_SOURCES[Math.floor(hash / 1000) % RELIEF_SOURCES.length];
    schedule(() => playSource(source, 0.24), RELIEF_DELAY_MS);
  }

  if (typeof global.rouletteShotSequence !== 'function') {
    throw new Error('Shot sequence must load before reaction audio.');
  }
  const previousShotSequence = global.rouletteShotSequence;
  if (!previousShotSequence.__rrReactionAudioBound) {
    const wrappedShotSequence = function (game, state, gameId) {
      const result = previousShotSequence.apply(this, arguments);
      queueReaction(game, state, gameId);
      return result;
    };
    wrappedShotSequence.__rrReactionAudioBound = true;
    global.rouletteShotSequence = wrappedShotSequence;
  }

  document.addEventListener('pointerdown', preload, { once: true, capture: true });
  global.addEventListener('pagehide', () => {
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
    stopClip(activeClip);
    activeClip = null;
  }, { once: true });

  global.RouletteReactionAudio = Object.freeze({
    blanksRemaining,
    queueReaction,
    diagnostics: () => ({ seenShots: seenShots.size, playing: Boolean(activeClip) })
  });
})(window);
