import { readFile, writeFile } from 'node:fs/promises';

const dataUrl = new URL('../netlify/functions/_data.js', import.meta.url);
const actionUrl = new URL('../netlify/functions/duel-action.js', import.meta.url);
const marker = '// SAFE_CRACKER_MUTATION_LOCK_V11_START';

function functionBounds(source, functionMarker, label) {
  const start = source.indexOf(functionMarker);
  if (start < 0) throw new Error(`Safe Cracker bot-stop patch could not find ${label}.`);
  const nextAsync = source.indexOf('\nasync function ', start + functionMarker.length);
  const nextPlain = source.indexOf('\nfunction ', start + functionMarker.length);
  const candidates = [nextAsync, nextPlain].filter(value => value >= 0);
  return { start, end: candidates.length ? Math.min(...candidates) : source.length };
}

function replaceFunction(source, functionMarker, replacement, label) {
  const { start, end } = functionBounds(source, functionMarker, label);
  return source.slice(0, start) + replacement + source.slice(end);
}

function replaceInsideFunction(source, functionMarker, before, after, label) {
  const { start, end } = functionBounds(source, functionMarker, label);
  const section = source.slice(start, end);
  if (section.includes(after)) return source;
  if (!section.includes(before)) throw new Error(`Safe Cracker bot-stop patch could not find ${label}.`);
  return source.slice(0, start) + section.replace(before, after) + source.slice(end);
}

function removeMarkedBlock(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  if (start < 0) return source;
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (end < 0) throw new Error(`Safe Cracker bot-stop patch found ${startMarker} without its closing marker.`);
  return source.slice(0, start) + source.slice(end + endMarker.length).replace(/^\s*\n/, '\n');
}

let data = await readFile(dataUrl, 'utf8');
data = removeMarkedBlock(data, '// SAFE_CRACKER_ATOMIC_BOT_STOP_V9_START', '// SAFE_CRACKER_ATOMIC_BOT_STOP_V9_END');
data = removeMarkedBlock(data, '// SAFE_CRACKER_ATOMIC_BOT_STOP_V10_START', '// SAFE_CRACKER_ATOMIC_BOT_STOP_V10_END');

if (!data.includes(marker)) {
  const helpers = String.raw`${marker}
function safeCrackerMutationLockKey(gameId, roundId) {
  return 'duel-safecracker-lock/' + mpCleanId(gameId) + '/' + mpCleanId(roundId || 'round') + '.json';
}

async function safeCrackerReadMutationLock(key) {
  try {
    return await getUsersStore().get(key, { type: 'json', consistency: 'strong' });
  } catch {
    return null;
  }
}

async function safeCrackerAcquireMutationLock(gameId, roundId) {
  const key = safeCrackerMutationLockKey(gameId, roundId);
  const token = crypto.randomBytes(12).toString('hex');
  let lastError = null;

  for (let attempt = 0; attempt < 24; attempt += 1) {
    const now = Date.now();
    const lease = {
      token,
      gameId: mpCleanId(gameId),
      roundId: String(roundId || ''),
      acquiredAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 20000).toISOString()
    };

    try {
      await getUsersStore().setJSON(key, lease, { onlyIfNew: true });
    } catch (error) {
      lastError = error;
    }

    const current = await safeCrackerReadMutationLock(key);
    if (current?.token === token) return { key, token };

    const expiresAt = Date.parse(current?.expiresAt || '');
    if (current && Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
      try { await getUsersStore().delete(key); } catch (error) { lastError = error; }
    }

    await sleep(24 + Math.min(110, attempt * 7));
  }

  const detail = String(lastError?.message || lastError || '').slice(0, 160);
  throw new Error('Safe Cracker could not reserve the game update' + (detail ? ': ' + detail : '.'));
}

async function safeCrackerReleaseMutationLock(lock) {
  if (!lock?.key || !lock?.token) return;
  try {
    const current = await safeCrackerReadMutationLock(lock.key);
    if (current?.token === lock.token) await getUsersStore().delete(lock.key);
  } catch {}
}

async function safeCrackerWithMutationLock(gameId, task) {
  const id = mpCleanId(gameId);
  if (!id) throw new Error('Safe Cracker could not identify that game update.');
  const initial = await duelGetRawStrong(id, 1) || await duelGetRaw(id);
  if (!initial) throw new Error('That Safe Cracker duel was not found.');
  const initialState = safeCrackerEnsureState(initial);
  const lock = await safeCrackerAcquireMutationLock(id, initialState.roundId);
  try {
    const latest = await duelGetRawStrong(id, 1) || await duelGetRaw(id) || initial;
    return await task(latest);
  } finally {
    await safeCrackerReleaseMutationLock(lock);
  }
}

function safeCrackerStableBotHash(value) {
  const text = String(value || '');
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function safeCrackerBotDueAt(game, state, npcId) {
  const player = state.players?.[npcId] || {};
  const attempts = Array.isArray(player.attempts) ? player.attempts : [];
  const baseMs = Date.parse(player.lastResult?.at || state.startAt || '') || Date.now();
  const network = game?.remoteNetworkConfig && typeof game.remoteNetworkConfig === 'object' ? game.remoteNetworkConfig : null;
  const min = network ? Math.max(100, int(network.minDelayMs, 100)) : 700;
  const max = network ? Math.max(min, int(network.maxDelayMs, min + 500)) : 1550;
  const hash = safeCrackerStableBotHash([state.roundId, npcId, player.stage, attempts.length].join(':'));
  let delay = min + (hash % (max - min + 1)) + 420;
  const stallRoll = ((hash >>> 8) % 10000) / 10000;
  if (network && stallRoll < Number(network.stallChance || 0)) delay += 1800 + ((hash >>> 16) % 2201);
  return baseMs + delay;
}
// SAFE_CRACKER_MUTATION_LOCK_V11_END

`;
  const insertAt = data.indexOf('async function safeCrackerApplyGuess(');
  if (insertAt < 0) throw new Error('Safe Cracker bot-stop patch could not find the guess writer insertion point.');
  data = data.slice(0, insertAt) + helpers + data.slice(insertAt);

  const lockedApply = String.raw`async function safeCrackerApplyGuess(game, actorId, guess, actionId = '', isBot = false) {
  // SAFE_CRACKER_LOCKED_APPLY_V11_START
  const id = cleanUserId(actorId);
  const gameId = mpCleanId(game?.gameId);
  const cleanActionId = String(actionId || '').replace(/[^A-Za-z0-9._:-]/g, '').slice(0, 120);
  if (!id || !gameId) throw new Error('Safe Cracker could not identify that action.');

  return await safeCrackerWithMutationLock(gameId, async latest => {
    if (!latest) throw new Error('That Safe Cracker duel was not found.');
    if (latest.mode !== 'safecracker') throw new Error('That duel is not Safe Cracker.');
    if (latest.status !== 'playing') return latest;

    let state = safeCrackerEnsureState(latest);
    const alreadyCompletedPlayerId = safeCrackerCompletedPlayerId(latest, state);
    if (alreadyCompletedPlayerId) {
      const playerName = latest.creator?.userId === alreadyCompletedPlayerId ? latest.creator?.name : latest.joiner?.name;
      return await safeCrackerComplete({ ...latest, safecrackerState: state }, state, alreadyCompletedPlayerId, (playerName || 'A player') + ' opened the safe first.');
    }
    if (cleanActionId && state.processedActionIds.includes(cleanActionId)) return latest;

    const player = { ...(state.players?.[id] || {}) };
    if (!player.code) throw new Error('Safe Cracker could not find that player safe.');
    if (int(player.stage, 0) >= SAFE_CRACKER_STAGES) return latest;
    const now = Date.now();
    const nextGuessMs = Date.parse(player.nextGuessAt || '');
    if (!isBot && Number.isFinite(nextGuessMs) && now < nextGuessMs) return latest;

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

    const processed = cleanActionId ? [...(state.processedActionIds || []), cleanActionId].slice(-80) : (state.processedActionIds || []);
    state = {
      ...state,
      revision: int(state.revision, 0) + 1,
      players: { ...(state.players || {}), [id]: player },
      processedActionIds: processed,
      npcActionAt: null
    };

    const candidate = { ...latest, safecrackerState: state, npcActionAt: null };
    if (player.stage >= SAFE_CRACKER_STAGES) {
      return await safeCrackerComplete(candidate, state, id, ((latest.creator?.userId === id ? latest.creator?.name : latest.joiner?.name) || 'A player') + ' opened the safe first.');
    }
    return await duelSaveGame(candidate);
  });
  // SAFE_CRACKER_LOCKED_APPLY_V11_END
}

`;
  data = replaceFunction(data, 'async function safeCrackerApplyGuess(', lockedApply, 'Safe Cracker guess writer');

  const lockedAdvance = String.raw`async function safeCrackerAdvanceAndSave(game) {
  // SAFE_CRACKER_POLL_FAIL_OPEN_V11_START
  const gameId = mpCleanId(game?.gameId);
  if (!gameId) return game;
  return await withSafeCrackerLock(gameId, async () => {
    let latest = await duelGetRawStrong(gameId, 1) || await duelGetRaw(gameId) || game;
    if (!latest || latest.status !== 'playing' || latest.mode !== 'safecracker') return latest || game;
    let state = safeCrackerEnsureState(latest);

    const alreadyCompletedPlayerId = safeCrackerCompletedPlayerId(latest, state);
    if (alreadyCompletedPlayerId) {
      return await safeCrackerWithMutationLock(gameId, async lockedLatest => {
        if (lockedLatest?.status !== 'playing') return lockedLatest || latest;
        const lockedState = safeCrackerEnsureState(lockedLatest);
        const winnerId = safeCrackerCompletedPlayerId(lockedLatest, lockedState);
        if (!winnerId) return lockedLatest;
        const playerName = lockedLatest.creator?.userId === winnerId ? lockedLatest.creator?.name : lockedLatest.joiner?.name;
        return await safeCrackerComplete({ ...lockedLatest, safecrackerState: lockedState }, lockedState, winnerId, (playerName || 'A player') + ' opened the safe first.');
      });
    }

    const endMs = Date.parse(state.endAt || '');
    if (Number.isFinite(endMs) && Date.now() >= endMs) {
      return await safeCrackerWithMutationLock(gameId, async lockedLatest => {
        if (lockedLatest?.status !== 'playing') return lockedLatest || latest;
        const lockedState = safeCrackerEnsureState(lockedLatest);
        const winnerId = safeCrackerCompletedPlayerId(lockedLatest, lockedState);
        if (winnerId) {
          const playerName = lockedLatest.creator?.userId === winnerId ? lockedLatest.creator?.name : lockedLatest.joiner?.name;
          return await safeCrackerComplete({ ...lockedLatest, safecrackerState: lockedState }, lockedState, winnerId, (playerName || 'A player') + ' opened the safe first.');
        }
        return await safeCrackerComplete({ ...lockedLatest, safecrackerState: lockedState }, lockedState, '', 'Time expired before either safe opened.');
      });
    }

    const npcPlayer = [latest.creator, latest.joiner].find(player => player?.isNpc || String(player?.userId || '').startsWith('npc-') || String(player?.userId || '').startsWith('remote-bot-'));
    const npcId = cleanUserId(npcPlayer?.userId || '');
    if (!npcId || int(state.players?.[npcId]?.stage, 0) >= SAFE_CRACKER_STAGES) return latest;

    const dueAt = safeCrackerBotDueAt(latest, state, npcId);
    if (Date.now() < dueAt) return latest;
    const guess = safeCrackerBotGuess(state.players[npcId]);
    return await safeCrackerApplyGuess(latest, npcId, guess, 'bot-' + state.revision + '-' + guess, true);
  });
  // SAFE_CRACKER_POLL_FAIL_OPEN_V11_END
}

`;
  data = replaceFunction(data, 'async function safeCrackerAdvanceAndSave(', lockedAdvance, 'Safe Cracker bot advancement');

  data = replaceInsideFunction(
    data,
    'async function duelGetGame(user, gameId, options = {}) {',
    '    if (latest.status === "playing") latest = await safeCrackerAdvanceAndSave(latest);',
    `    if (latest.status === "playing") {
      try {
        latest = await safeCrackerAdvanceAndSave(latest);
      } catch (error) {
        console.error('[safecracker] poll advancement failed without blocking the game snapshot:', error?.message || error);
        latest = await duelGetRawStrong(latest.gameId, 1) || await duelGetRaw(latest.gameId) || latest;
      }
    }`,
    'fail-open Safe Cracker polling'
  );
}

await writeFile(dataUrl, data);

let action = await readFile(actionUrl, 'utf8');
if (/"X-Safe-Cracker-Bot-Guard":\s*"[^"]+"/.test(action)) {
  action = action.replace(/"X-Safe-Cracker-Bot-Guard":\s*"[^"]+"/, '"X-Safe-Cracker-Bot-Guard": "mutation-lock-v11"');
} else {
  action = action.replace(
    '    "X-Duel-Function-Build": DUEL_FUNCTION_BUILD',
    '    "X-Duel-Function-Build": DUEL_FUNCTION_BUILD,\n    "X-Safe-Cracker-Bot-Guard": "mutation-lock-v11"'
  );
}
await writeFile(actionUrl, action);

console.log('Applied Safe Cracker mutation-lock v11: polling no longer depends on metadata APIs, all player and bot guesses are serialized across function instances, and a late bot request cannot write after completion.');