import { readFile, writeFile } from 'node:fs/promises';

const dataUrl = new URL('../netlify/functions/_data.js', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const serverStart = '// SAFE_CRACKER_SERVER_START';
const serverEnd = '// SAFE_CRACKER_SERVER_END';
const assetStart = '<!-- SAFE_CRACKER_ASSETS_START -->';
const assetEnd = '<!-- SAFE_CRACKER_ASSETS_END -->';

function replaceRequired(source, search, replacement, label) {
  if (source.includes(replacement)) return source;
  if (!source.includes(search)) throw new Error(`Safe Cracker patch could not find ${label}.`);
  return source.replace(search, replacement);
}

function upsertBlock(source, start, end, block, anchor, label) {
  const pattern = new RegExp(`${start.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${end.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'm');
  let next = source.replace(pattern, '');
  if (!next.includes(anchor)) throw new Error(`Safe Cracker patch could not find ${label}.`);
  next = next.replace(anchor, `${block}\n\n${anchor}`);
  return next;
}

const serverBlock = String.raw`${serverStart}
const SAFE_CRACKER_ROUND_MS = 75 * 1000;
const SAFE_CRACKER_VERIFY_MS = 650;
const SAFE_CRACKER_STAGES = 3;
const SAFE_CRACKER_LOCKS = globalThis.__SAFE_CRACKER_LOCKS || (globalThis.__SAFE_CRACKER_LOCKS = new Map());

async function withSafeCrackerLock(gameId, task) {
  const key = mpCleanId(gameId);
  const previous = SAFE_CRACKER_LOCKS.get(key) || Promise.resolve();
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const queued = previous.then(() => gate);
  SAFE_CRACKER_LOCKS.set(key, queued);
  await previous;
  try { return await task(); }
  finally {
    release();
    if (SAFE_CRACKER_LOCKS.get(key) === queued) SAFE_CRACKER_LOCKS.delete(key);
  }
}

function safeCrackerPlayerIds(game) {
  return [cleanUserId(game?.creator?.userId), cleanUserId(game?.joiner?.userId)].filter(Boolean);
}

function safeCrackerGenerateCode() {
  const digits = Array.from({ length: 10 }, (_, digit) => digit);
  for (let index = digits.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [digits[index], digits[swap]] = [digits[swap], digits[index]];
  }
  return digits.slice(0, SAFE_CRACKER_STAGES).join('');
}

function safeCrackerInitialPlayer(code) {
  return {
    code,
    stage: 0,
    attempts: [],
    lastResult: null,
    nextGuessAt: null,
    completedAt: null
  };
}

function safeCrackerInitialState(game, startMs = Date.now()) {
  const ids = safeCrackerPlayerIds(game);
  const players = {};
  const usedCodes = new Set();
  for (const id of ids) {
    let code = safeCrackerGenerateCode();
    while (usedCodes.has(code)) code = safeCrackerGenerateCode();
    usedCodes.add(code);
    players[id] = safeCrackerInitialPlayer(code);
  }
  return {
    roundId: 'safe-' + crypto.randomBytes(7).toString('hex'),
    startAt: new Date(startMs).toISOString(),
    endAt: new Date(startMs + SAFE_CRACKER_ROUND_MS).toISOString(),
    revision: 1,
    players,
    winnerUserId: '',
    processedActionIds: [],
    npcActionAt: null
  };
}

function safeCrackerEnsureState(game) {
  const startMs = Date.parse(game?.startAt || '') || Date.now();
  const existing = game?.safecrackerState && typeof game.safecrackerState === 'object' ? game.safecrackerState : null;
  if (!existing?.players || typeof existing.players !== 'object') return safeCrackerInitialState(game, startMs);
  const players = { ...existing.players };
  for (const id of safeCrackerPlayerIds(game)) {
    const current = players[id] && typeof players[id] === 'object' ? players[id] : safeCrackerInitialPlayer(safeCrackerGenerateCode());
    const rawCode = String(current.code || '').replace(/[^0-9]/g, '').slice(0, SAFE_CRACKER_STAGES);
    const code = rawCode.length === SAFE_CRACKER_STAGES ? rawCode : safeCrackerGenerateCode();
    players[id] = {
      code,
      stage: Math.max(0, Math.min(SAFE_CRACKER_STAGES, int(current.stage, 0))),
      attempts: Array.isArray(current.attempts) ? current.attempts.slice(-80) : [],
      lastResult: current.lastResult && typeof current.lastResult === 'object' ? current.lastResult : null,
      nextGuessAt: current.nextGuessAt || null,
      completedAt: current.completedAt || null
    };
  }
  return {
    roundId: String(existing.roundId || ('safe-' + crypto.randomBytes(7).toString('hex'))),
    startAt: existing.startAt || new Date(startMs).toISOString(),
    endAt: existing.endAt || new Date(startMs + SAFE_CRACKER_ROUND_MS).toISOString(),
    revision: Math.max(1, int(existing.revision, 1)),
    players,
    winnerUserId: cleanUserId(existing.winnerUserId || ''),
    processedActionIds: Array.isArray(existing.processedActionIds) ? existing.processedActionIds.map(String).slice(-80) : [],
    npcActionAt: existing.npcActionAt || null
  };
}

function safeCrackerHasValidState(game) {
  const state = game?.safecrackerState;
  if (!state || typeof state !== 'object' || !state.players || typeof state.players !== 'object') return false;
  const start = Date.parse(state.startAt || '');
  const end = Date.parse(state.endAt || '');
  if (!state.roundId || !Number.isFinite(start) || !Number.isFinite(end) || end - start !== SAFE_CRACKER_ROUND_MS) return false;
  return safeCrackerPlayerIds(game).every(id => /^[0-9]{3}$/.test(String(state.players?.[id]?.code || '')));
}

function safeCrackerCircularDistance(first, second) {
  const distance = Math.abs(int(first, 0) - int(second, 0));
  return Math.min(distance, 10 - distance);
}

function safeCrackerTier(distance) {
  if (distance <= 0) return 'green';
  if (distance === 1) return 'yellow';
  if (distance <= 3) return 'orange';
  return 'red';
}

function safeCrackerPublicPlayer(player, includeAttempts) {
  const attempts = Array.isArray(player?.attempts) ? player.attempts : [];
  const lastResult = player?.lastResult && typeof player.lastResult === 'object' ? {
    stage: int(player.lastResult.stage, 0),
    guess: int(player.lastResult.guess, 0),
    tier: String(player.lastResult.tier || ''),
    correct: Boolean(player.lastResult.correct),
    at: player.lastResult.at || null
  } : null;
  return {
    stage: Math.max(0, Math.min(SAFE_CRACKER_STAGES, int(player?.stage, 0))),
    attempts: includeAttempts ? attempts.map(attempt => ({
      stage: int(attempt.stage, 0),
      guess: int(attempt.guess, 0),
      tier: String(attempt.tier || ''),
      correct: Boolean(attempt.correct),
      at: attempt.at || null
    })) : undefined,
    attemptCount: attempts.length,
    lastResult: includeAttempts ? lastResult : undefined,
    lastTier: lastResult?.tier || '',
    completed: Boolean(player?.completedAt) || int(player?.stage, 0) >= SAFE_CRACKER_STAGES,
    completedAt: player?.completedAt || null
  };
}

function safeCrackerPublicState(game, viewerUserId) {
  const state = game?.safecrackerState && typeof game.safecrackerState === 'object' ? safeCrackerEnsureState(game) : null;
  const viewer = cleanUserId(viewerUserId);
  const ids = safeCrackerPlayerIds(game);
  const opponentId = ids.find(id => id !== viewer) || '';
  if (!state) {
    return {
      roundId: '', startAt: game?.startAt || null, endAt: null, revision: 0,
      secondsLeft: 75, canSubmit: false, cooldownMs: 0,
      me: safeCrackerPublicPlayer({}, true), opponent: safeCrackerPublicPlayer({}, false)
    };
  }
  const me = state.players?.[viewer] || {};
  const opponent = state.players?.[opponentId] || {};
  const now = Date.now();
  const nextGuessMs = Date.parse(me.nextGuessAt || '');
  const endMs = Date.parse(state.endAt || '');
  const cooldownMs = Number.isFinite(nextGuessMs) ? Math.max(0, nextGuessMs - now) : 0;
  const complete = String(game?.status || '') === 'complete';
  return {
    roundId: state.roundId,
    startAt: state.startAt,
    endAt: state.endAt,
    revision: int(state.revision, 0),
    secondsLeft: Number.isFinite(endMs) ? Math.max(0, Math.ceil((endMs - now) / 1000)) : 75,
    canSubmit: String(game?.status || '') === 'playing' && ids.includes(viewer) && cooldownMs <= 0 && int(me.stage, 0) < SAFE_CRACKER_STAGES,
    cooldownMs,
    stagesTotal: SAFE_CRACKER_STAGES,
    me: safeCrackerPublicPlayer(me, true),
    opponent: safeCrackerPublicPlayer(opponent, false),
    revealedCodes: complete ? { my: String(me.code || ''), opponent: String(opponent.code || '') } : undefined
  };
}

function safeCrackerSummary(game, state, winnerId, tie, reason) {
  const creatorId = cleanUserId(game?.creator?.userId);
  const joinerId = cleanUserId(game?.joiner?.userId);
  const summary = id => ({
    stage: int(state.players?.[id]?.stage, 0),
    attempts: Array.isArray(state.players?.[id]?.attempts) ? state.players[id].attempts.length : 0
  });
  return {
    mode: 'safecracker',
    winnerRole: tie ? '' : winnerId === creatorId ? 'creator' : 'joiner',
    tie: Boolean(tie),
    text: reason || (tie ? 'Neither safe opened before time expired.' : 'First safe opened wins.'),
    creator: summary(creatorId),
    joiner: summary(joinerId)
  };
}

async function safeCrackerComplete(game, state, winnerId = '', reason = '') {
  const cleanWinner = cleanUserId(winnerId);
  const tie = !cleanWinner;
  const finalState = { ...state, winnerUserId: cleanWinner, revision: int(state.revision, 0) + 1, npcActionAt: null };
  return await duelCompleteWithResolved(
    { ...game, safecrackerState: finalState, npcActionAt: null },
    safeCrackerSummary(game, finalState, cleanWinner, tie, reason)
  );
}

function safeCrackerCandidateMatches(candidate, attempt) {
  return safeCrackerTier(safeCrackerCircularDistance(candidate, attempt.guess)) === String(attempt.tier || '');
}

function safeCrackerBotGuess(player) {
  const stage = int(player?.stage, 0);
  const attempts = (Array.isArray(player?.attempts) ? player.attempts : []).filter(attempt => int(attempt.stage, 0) === stage);
  let candidates = Array.from({ length: 10 }, (_, value) => value).filter(candidate => attempts.every(attempt => safeCrackerCandidateMatches(candidate, attempt)));
  if (!candidates.length) candidates = Array.from({ length: 10 }, (_, value) => value);
  const tried = new Set(attempts.map(attempt => int(attempt.guess, 0)));
  const guesses = Array.from({ length: 10 }, (_, value) => value).filter(value => !tried.has(value));
  if (!guesses.length) return candidates[Math.floor(Math.random() * candidates.length)] || 0;
  const ranked = guesses.map(guess => {
    const buckets = new Map();
    for (const candidate of candidates) {
      const tier = safeCrackerTier(safeCrackerCircularDistance(candidate, guess));
      buckets.set(tier, (buckets.get(tier) || 0) + 1);
    }
    return { guess, worst: Math.max(...buckets.values(), 0) };
  }).sort((a, b) => a.worst - b.worst || Math.random() - 0.5);
  return ranked[0]?.guess ?? guesses[0];
}

function safeCrackerBotDelay(game) {
  const network = game?.remoteNetworkConfig && typeof game.remoteNetworkConfig === 'object' ? game.remoteNetworkConfig : null;
  const min = network ? Math.max(100, int(network.minDelayMs, 100)) : 700;
  const max = network ? Math.max(min, int(network.maxDelayMs, min + 500)) : 1550;
  let delay = min + Math.floor(Math.random() * (max - min + 1)) + 420;
  if (network && Math.random() < Number(network.stallChance || 0)) delay += 1800 + Math.floor(Math.random() * 2200);
  return delay;
}

async function safeCrackerApplyGuess(game, actorId, guess, actionId = '', isBot = false) {
  const id = cleanUserId(actorId);
  let state = safeCrackerEnsureState(game);
  const player = { ...(state.players?.[id] || {}) };
  if (!player.code) throw new Error('Safe Cracker could not find that player safe.');
  if (int(player.stage, 0) >= SAFE_CRACKER_STAGES) return game;
  const now = Date.now();
  const stage = int(player.stage, 0);
  const target = int(String(player.code)[stage], 0);
  const distance = safeCrackerCircularDistance(target, guess);
  const tier = safeCrackerTier(distance);
  const correct = tier === 'green';
  const at = new Date(now).toISOString();
  const result = { stage, guess, distance, tier, correct, at };
  player.attempts = [...(Array.isArray(player.attempts) ? player.attempts : []), result].slice(-80);
  player.lastResult = result;
  player.stage = correct ? Math.min(SAFE_CRACKER_STAGES, stage + 1) : stage;
  player.nextGuessAt = new Date(now + SAFE_CRACKER_VERIFY_MS).toISOString();
  if (player.stage >= SAFE_CRACKER_STAGES) player.completedAt = at;
  const processed = actionId ? [...(state.processedActionIds || []), actionId].slice(-80) : (state.processedActionIds || []);
  state = {
    ...state,
    revision: int(state.revision, 0) + 1,
    players: { ...(state.players || {}), [id]: player },
    processedActionIds: processed,
    npcActionAt: isBot && player.stage < SAFE_CRACKER_STAGES ? new Date(now + safeCrackerBotDelay(game)).toISOString() : state.npcActionAt
  };
  game = { ...game, safecrackerState: state };
  if (player.stage >= SAFE_CRACKER_STAGES) return await safeCrackerComplete(game, state, id, ((game.creator?.userId === id ? game.creator?.name : game.joiner?.name) || 'A player') + ' opened the safe first.');
  return await duelSaveGame(game);
}

async function safeCrackerAdvanceAndSave(game) {
  const gameId = mpCleanId(game?.gameId);
  if (!gameId) return game;
  return await withSafeCrackerLock(gameId, async () => {
    let latest = await duelGetRaw(gameId);
    if (!latest || latest.status !== 'playing' || latest.mode !== 'safecracker') return latest || game;
    let state = safeCrackerEnsureState(latest);
    const endMs = Date.parse(state.endAt || '');
    if (Number.isFinite(endMs) && Date.now() >= endMs) {
      return await safeCrackerComplete({ ...latest, safecrackerState: state }, state, '', 'Time expired before either safe opened.');
    }
    const npcPlayer = [latest.creator, latest.joiner].find(player => player?.isNpc || String(player?.userId || '').startsWith('npc-') || String(player?.userId || '').startsWith('remote-bot-'));
    const npcId = cleanUserId(npcPlayer?.userId || '');
    if (!npcId || int(state.players?.[npcId]?.stage, 0) >= SAFE_CRACKER_STAGES) {
      if (state.npcActionAt) {
        state = { ...state, npcActionAt: null };
        return await duelSaveGame({ ...latest, safecrackerState: state });
      }
      return latest;
    }
    const scheduled = Date.parse(state.npcActionAt || '');
    if (!Number.isFinite(scheduled)) {
      state = { ...state, npcActionAt: new Date(Date.now() + safeCrackerBotDelay(latest)).toISOString() };
      return await duelSaveGame({ ...latest, safecrackerState: state });
    }
    if (Date.now() < scheduled) return latest;
    const guess = safeCrackerBotGuess(state.players[npcId]);
    return await safeCrackerApplyGuess({ ...latest, safecrackerState: state }, npcId, guess, 'bot-' + state.revision + '-' + guess, true);
  });
}

async function safeCrackerAction(user, gameId, rawChoice, details = {}) {
  return await withSafeCrackerLock(gameId, async () => {
    let game = await duelGetRaw(gameId);
    if (!game) throw new Error('That Safe Cracker duel was not found.');
    if (game.mode !== 'safecracker') throw new Error('That duel is not Safe Cracker.');
    if (game.status !== 'playing') return { game: duelPublicGame(game, user.id), record: await getUserRecord(user.id) };
    const viewer = cleanUserId(user.id);
    if (!safeCrackerPlayerIds(game).includes(viewer)) throw new Error('You are not in this Safe Cracker duel.');
    let state = safeCrackerEnsureState(game);
    const endMs = Date.parse(state.endAt || '');
    if (Number.isFinite(endMs) && Date.now() >= endMs) {
      game = await safeCrackerComplete({ ...game, safecrackerState: state }, state, '', 'Time expired before either safe opened.');
      return { game: duelPublicGame(game, viewer), record: await getUserRecord(viewer) };
    }
    const actionId = String(details.actionId || '').replace(/[^A-Za-z0-9._:-]/g, '').slice(0, 120);
    if (actionId && state.processedActionIds.includes(actionId)) {
      return { game: duelPublicGame({ ...game, safecrackerState: state }, viewer), record: await getUserRecord(viewer), ignoredAction: true, ignoreReason: 'duplicate' };
    }
    const match = /^safecracker:guess:([0-9])$/.exec(String(rawChoice || '').toLowerCase());
    if (!match) throw new Error('Choose one dial number from 0 to 9.');
    const player = state.players?.[viewer] || {};
    const nextGuessMs = Date.parse(player.nextGuessAt || '');
    if (Number.isFinite(nextGuessMs) && Date.now() < nextGuessMs) {
      return {
        game: duelPublicGame({ ...game, safecrackerState: state }, viewer),
        record: await getUserRecord(viewer),
        ignoredAction: true,
        ignoreReason: 'verification-cooldown',
        retryAfterMs: Math.max(0, nextGuessMs - Date.now())
      };
    }
    game = await safeCrackerApplyGuess({ ...game, safecrackerState: state }, viewer, int(match[1], 0), actionId, false);
    return { game: duelPublicGame(game, viewer), record: await getUserRecord(viewer) };
  });
}
${serverEnd}`;

let data = await readFile(dataUrl, 'utf8');
data = upsertBlock(data, serverStart, serverEnd, serverBlock, '// Shared duel ready lifecycle.', 'shared duel lifecycle anchor');

data = replaceRequired(
  data,
  '    rouletteState: game.rouletteState && typeof game.rouletteState === "object" ? game.rouletteState : null,\n    ready:',
  '    rouletteState: game.rouletteState && typeof game.rouletteState === "object" ? game.rouletteState : null,\n    safecrackerState: game.safecrackerState && typeof game.safecrackerState === "object" ? game.safecrackerState : null,\n    ready:',
  'Safe Cracker state sanitization'
);

data = replaceRequired(
  data,
  '  if (game.mode === "fishing" && ["countdown","playing"].includes(game.status)) {\n    const st=game.fishingState||{};\n    const start=Date.parse(st.startAt||""), end=Date.parse(st.endAt||"");\n    if (!st.roundId || !Number.isFinite(start) || !Number.isFinite(end) || end-start !== 60000 || !Array.isArray(st.events) || !st.catches || typeof st.catches!=="object") return false;\n  }\n  return true;',
  '  if (game.mode === "fishing" && ["countdown","playing"].includes(game.status)) {\n    const st=game.fishingState||{};\n    const start=Date.parse(st.startAt||""), end=Date.parse(st.endAt||"");\n    if (!st.roundId || !Number.isFinite(start) || !Number.isFinite(end) || end-start !== 60000 || !Array.isArray(st.events) || !st.catches || typeof st.catches!=="object") return false;\n  }\n  if (game.mode === "safecracker" && ["countdown","playing"].includes(game.status) && !safeCrackerHasValidState(game)) return false;\n  return true;',
  'Safe Cracker schema validation'
);

data = replaceRequired(
  data,
  '  if (next.mode === "roulette") next.rouletteState = rouletteInitialState(next, startMs);\n  return next;',
  '  if (next.mode === "roulette") next.rouletteState = rouletteInitialState(next, startMs);\n  if (next.mode === "safecracker") next.safecrackerState = safeCrackerInitialState(next, startMs);\n  return next;',
  'Safe Cracker countdown initialization'
);

data = replaceRequired(
  data,
  '      if (next.mode === "roulette" && !next.rouletteState) next.rouletteState = rouletteInitialState(next, startMs);\n    }',
  '      if (next.mode === "roulette" && !next.rouletteState) next.rouletteState = rouletteInitialState(next, startMs);\n      if (next.mode === "safecracker" && !safeCrackerHasValidState(next)) next.safecrackerState = safeCrackerInitialState(next, startMs);\n    }',
  'Safe Cracker playing-state recovery'
);

data = replaceRequired(
  data,
  '      rouletteState: next.mode === "roulette" ? null : next.rouletteState\n    };',
  '      rouletteState: next.mode === "roulette" ? null : next.rouletteState,\n      safecrackerState: next.mode === "safecracker" ? null : next.safecrackerState\n    };',
  'Safe Cracker ready reset'
);

data = replaceRequired(
  data,
  '  const rouletteState = clean.mode === "roulette" ? roulettePublicState(clean, viewer) : clean.rouletteState;\n  const drawCanAct',
  '  const rouletteState = clean.mode === "roulette" ? roulettePublicState(clean, viewer) : clean.rouletteState;\n  const safecrackerState = clean.mode === "safecracker" ? safeCrackerPublicState(clean, viewer) : clean.safecrackerState;\n  const drawCanAct',
  'Safe Cracker public-state construction'
);

data = replaceRequired(
  data,
  '    rouletteState,\n    actions:',
  '    rouletteState,\n    safecrackerState,\n    actions:',
  'Safe Cracker public-state response'
);

data = replaceRequired(
  data,
  'clean.mode === "roulette" ? rouletteCanAct(clean, viewer) : (clean.status === "playing" && isPlayer && !myAction)',
  'clean.mode === "roulette" ? rouletteCanAct(clean, viewer) : clean.mode === "safecracker" ? Boolean(safecrackerState?.canSubmit) : (clean.status === "playing" && isPlayer && !myAction)',
  'Safe Cracker canAct policy'
);

data = replaceRequired(
  data,
  '  } else if (game.mode === "roulette") {\n    let latest = duelNormalizeReadyState(game);\n    if (latest.status === "playing") latest = await rouletteAdvanceAndSave(latest);\n    game = latest;\n  } else {',
  '  } else if (game.mode === "roulette") {\n    let latest = duelNormalizeReadyState(game);\n    if (latest.status === "playing") latest = await rouletteAdvanceAndSave(latest);\n    game = latest;\n  } else if (game.mode === "safecracker") {\n    let latest = duelNormalizeReadyState(game);\n    if (latest.status === "playing") latest = await safeCrackerAdvanceAndSave(latest);\n    game = latest;\n  } else {',
  'Safe Cracker focused polling'
);

data = replaceRequired(
  data,
  '  if (game.mode === "roulette") {\n    return await rouletteAction(actorUser, gameId, choice, details);\n  }\n\n  if (game.mode === "blackjack") {',
  '  if (game.mode === "roulette") {\n    return await rouletteAction(actorUser, gameId, choice, details);\n  }\n\n  if (game.mode === "safecracker") {\n    return await safeCrackerAction(actorUser, gameId, rawChoice, details);\n  }\n\n  if (game.mode === "blackjack") {',
  'Safe Cracker action routing'
);

data = replaceRequired(
  data,
  '["draw","fishing","roulette","blackjack"].includes(clean.mode)',
  '["draw","fishing","roulette","blackjack","safecracker"].includes(clean.mode)',
  'Safe Cracker generic NPC exclusion'
);

data = replaceRequired(
  data,
  '  if (clean.mode === "roulette") return await rouletteMaybeComplete(clean);\n  if (clean.status !== "playing"',
  '  if (clean.mode === "roulette") return await rouletteMaybeComplete(clean);\n  if (clean.mode === "safecracker") return await safeCrackerAdvanceAndSave(clean);\n  if (clean.status !== "playing"',
  'Safe Cracker generic completion exclusion'
);

data = replaceRequired(
  data,
  'if (![' + '"fishing", "draw", "roulette"' + '].includes(game.mode)) throw new Error("The NPC is available for Russian Roulette testing.");',
  'if (![' + '"fishing", "draw", "roulette", "safecracker"' + '].includes(game.mode)) throw new Error("The NPC is available for Fishing, DRAW!, Roulette, and Safe Cracker testing.");',
  'Safe Cracker simple NPC availability'
);

data = replaceRequired(
  data,
  'name: game.mode === "draw" ? "Quickdraw Opponent" : game.mode === "roulette" ? "Roulette Opponent" : "Fishing Opponent",',
  'name: game.mode === "draw" ? "Quickdraw Opponent" : game.mode === "roulette" ? "Roulette Opponent" : game.mode === "safecracker" ? "Vault Cracker" : "Fishing Opponent",',
  'Safe Cracker NPC name'
);

data = replaceRequired(
  data,
  '    rouletteState: null,\n    ledgerIds:',
  '    rouletteState: null,\n    safecrackerState: null,\n    ledgerIds:',
  'Safe Cracker simple NPC state reset'
);

data = replaceRequired(
  data,
  'if (![' + '"roulette", "draw", "fishing"' + '].includes(String(game.mode || ""))) throw new Error("Remote Network Bot supports Roulette, Draw, and Fishing.");',
  'if (![' + '"roulette", "draw", "fishing", "safecracker"' + '].includes(String(game.mode || ""))) throw new Error("Remote Network Bot supports Roulette, Draw, Fishing, and Safe Cracker.");',
  'Safe Cracker Remote Bot availability'
);

data = replaceRequired(
  data,
  '    blackjackState:null,drawState:null,fishingState:null,rouletteState:null,',
  '    blackjackState:null,drawState:null,fishingState:null,rouletteState:null,safecrackerState:null,',
  'Safe Cracker Remote Bot state reset'
);

data = replaceRequired(
  data,
  'if (latest.status !== "complete" || ![' + '"draw", "fishing", "roulette"' + '].includes(String(latest.mode || ""))) throw new Error("Rematches are only available after a completed DRAW! or fishing duel.");',
  'if (latest.status !== "complete" || ![' + '"draw", "fishing", "roulette", "safecracker"' + '].includes(String(latest.mode || ""))) throw new Error("Rematches are only available after a completed supported duel.");',
  'Safe Cracker rematch support'
);

await writeFile(dataUrl, data);

const assetBlock = `${assetStart}\n  <link id="safeCrackerStyles" rel="stylesheet" href="/assets/safe-cracker/safe-cracker.css?v=1">\n  <script id="safeCrackerRuntime" src="/assets/safe-cracker/safe-cracker.js?v=1" defer></script>\n${assetEnd}`;

let html = await readFile(indexUrl, 'utf8');
html = upsertBlock(html, assetStart, assetEnd, assetBlock, '</head>', 'index head');
html = replaceRequired(
  html,
  'if (mode === "safecracker") return `<div class="duel-mode-art"><div class="duel-safe-preview">🔐</div><div class="duel-simple">Guess the 3-digit code. Closest safecracker wins.</div></div>`;',
  'if (mode === "safecracker") return ["countdown","playing","complete"].includes(String(game?.status || "")) ? `<div data-safe-cracker-mount></div>` : `<div class="duel-mode-art"><div class="duel-safe-preview">🔐</div><div class="duel-simple">Crack your own three-number safe before your opponent. First door open wins.</div></div>`;',
  'Safe Cracker game mount'
);
html = replaceRequired(
  html,
  '      if (game.mode === "safecracker") {\n        return `<div class="duel-mode-art"><div class="duel-safe-entry"><input class="duel-input" id="safeGuessInput" inputmode="numeric" maxlength="3" placeholder="Enter 3-digit code" /><button class="gold" data-duel-safe-submit="1" type="button">Lock Guess</button></div></div>`;\n      }',
  '      if (game.mode === "safecracker") {\n        return "";\n      }',
  'Safe Cracker temporary input removal'
);
html = replaceRequired(
  html,
  '          if (!(["draw", "fishing", "roulette"].includes(game.mode) && game.status === "complete")) {',
  '          if (!(["draw", "fishing", "roulette", "safecracker"].includes(game.mode) && game.status === "complete")) {',
  'Safe Cracker completed-game persistence'
);
html = replaceRequired(
  html,
  '        body = game.mode === "roulette" ? "" : game.mode === "blackjack"\n          ? `<div class="duel-blackjack-actions">${duelActionChoices(game)}</div>`',
  '        body = game.mode === "roulette" ? "" : game.mode === "safecracker" ? "" : game.mode === "blackjack"\n          ? `<div class="duel-blackjack-actions">${duelActionChoices(game)}</div>`',
  'Safe Cracker active body'
);
html = replaceRequired(
  html,
  '        body = ["draw", "fishing", "roulette"].includes(game.mode) ? "" : `${duelResultText(game)}<div class="duel-actions"><button class="gold" id="duelNewGameBtn" type="button">Create a New Game</button></div>`;',
  '        body = ["draw", "fishing", "roulette", "safecracker"].includes(game.mode) ? "" : `${duelResultText(game)}<div class="duel-actions"><button class="gold" id="duelNewGameBtn" type="button">Create a New Game</button></div>`;',
  'Safe Cracker result ownership'
);
html = replaceRequired(
  html,
  '      duelActive.querySelector("[data-duel-safe-submit]")?.addEventListener("click", () => {\n        if (!duelGenericMountedGameMatches(game)) return;\n        const guess = document.getElementById("safeGuessInput")?.value || "000";\n        duelAct(guess);\n      });',
  '      if (game.mode === "safecracker") {\n        window.__safeCrackerBridge = {\n          submit: async details => {\n            if (!duelGenericMountedGameMatches(game)) throw new Error("Safe Cracker board changed. Try again.");\n            const data = await duelRequest("act", { gameId: game.gameId, ...(details || {}) });\n            duelLastActiveGame = data.game || duelLastActiveGame;\n            if (data.game?.gameId) duelKnownRevisionByGame.set(String(data.game.gameId), String(data.game.safecrackerState?.revision || ""));\n            duelRenderActive(data.game, true);\n            return data;\n          },\n          refresh: () => duelRefresh(true),\n          rematch: () => duelRequestRematch(),\n          newGame: () => duelStartNewGame()\n        };\n        window.dispatchEvent(new CustomEvent("safecracker:state", { detail: { game } }));\n      }',
  'Safe Cracker client bridge'
);

await writeFile(indexUrl, html);
console.log('Patched server-authoritative Safe Cracker race, isolated dial UI bridge, NPC/Remote Bot support, persistence, rematches, and protected Roulette separation.');
