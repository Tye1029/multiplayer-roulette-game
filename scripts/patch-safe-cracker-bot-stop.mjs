import { readFile, writeFile } from 'node:fs/promises';

const dataUrl = new URL('../netlify/functions/_data.js', import.meta.url);
const actionUrl = new URL('../netlify/functions/duel-action.js', import.meta.url);
const marker = '// SAFE_CRACKER_ATOMIC_BOT_STOP_V9_START';

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

let data = await readFile(dataUrl, 'utf8');
if (!data.includes(marker)) {
  const helpers = String.raw`${marker}
async function safeCrackerReadVersioned(gameId) {
  const id = mpCleanId(gameId);
  if (!id) return { game: null, etag: '' };
  try {
    const entry = await getUsersStore().getWithMetadata(duelGameKey(id), { consistency: 'strong', type: 'json' });
    return {
      game: entry?.data ? duelSanitizeGame(entry.data) : null,
      etag: String(entry?.etag || '')
    };
  } catch {
    return { game: await duelGetRawStrong(id, 1) || await duelGetRaw(id), etag: '' };
  }
}

async function safeCrackerSaveVersioned(game, expectedEtag) {
  const gameId = mpCleanId(game?.gameId);
  if (!gameId || !expectedEtag) {
    return { modified: false, game: await duelGetRawStrong(gameId, 1) || await duelGetRaw(gameId) || game };
  }
  const clean = duelSanitizeGame({
    ...game,
    schemaVersion: DUEL_SCHEMA_VERSION,
    revision: int(game?.revision, 0) + 1,
    updatedAt: nowIso()
  });
  const result = await getUsersStore().setJSON(duelGameKey(gameId), clean, { onlyIfMatch: expectedEtag });
  if (!result?.modified) {
    return { modified: false, game: await duelGetRawStrong(gameId, 1) || await duelGetRaw(gameId) || game };
  }
  if (duelIsActiveStatus(clean.status)) {
    await Promise.all([clean.creator?.userId, clean.joiner?.userId].filter(Boolean).map(id => duelSetActivePointer(id, clean)));
  } else {
    await duelClearPointers(clean);
  }
  return { modified: true, game: clean };
}
// SAFE_CRACKER_ATOMIC_BOT_STOP_V9_END

`;
  const insertAt = data.indexOf('async function safeCrackerApplyGuess(');
  if (insertAt < 0) throw new Error('Safe Cracker bot-stop patch could not find the guess writer insertion point.');
  data = data.slice(0, insertAt) + helpers + data.slice(insertAt);

  const atomicApply = String.raw`async function safeCrackerApplyGuess(game, actorId, guess, actionId = '', isBot = false) {
  // SAFE_CRACKER_ATOMIC_APPLY_V9_START
  const id = cleanUserId(actorId);
  const gameId = mpCleanId(game?.gameId);
  const cleanActionId = String(actionId || '').replace(/[^A-Za-z0-9._:-]/g, '').slice(0, 120);
  if (!id || !gameId) throw new Error('Safe Cracker could not identify that action.');
  let fallback = game;
  for (let writeAttempt = 0; writeAttempt < 5; writeAttempt += 1) {
    const versioned = await safeCrackerReadVersioned(gameId);
    const latest = versioned.game || fallback;
    if (!latest) throw new Error('That Safe Cracker duel was not found.');
    if (latest.mode !== 'safecracker') throw new Error('That duel is not Safe Cracker.');
    if (latest.status !== 'playing') return latest;
    if (!versioned.etag) return latest;

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
      npcActionAt: isBot && player.stage < SAFE_CRACKER_STAGES ? new Date(now + safeCrackerBotDelay(latest)).toISOString() : null
    };

    const candidate = { ...latest, safecrackerState: state, npcActionAt: state.npcActionAt };
    const saved = await safeCrackerSaveVersioned(candidate, versioned.etag);
    if (!saved.modified) {
      fallback = saved.game || latest;
      if (saved.game?.status !== 'playing') return saved.game;
      continue;
    }

    const authoritative = saved.game || candidate;
    if (player.stage >= SAFE_CRACKER_STAGES) {
      return await safeCrackerComplete(authoritative, safeCrackerEnsureState(authoritative), id, ((latest.creator?.userId === id ? latest.creator?.name : latest.joiner?.name) || 'A player') + ' opened the safe first.');
    }
    return authoritative;
  }
  return await duelGetRawStrong(gameId, 1) || await duelGetRaw(gameId) || fallback;
  // SAFE_CRACKER_ATOMIC_APPLY_V9_END
}

`;
  data = replaceFunction(data, 'async function safeCrackerApplyGuess(', atomicApply, 'Safe Cracker guess writer');

  const advanceMarker = 'async function safeCrackerAdvanceAndSave(game) {';
  const { start, end } = functionBounds(data, advanceMarker, 'Safe Cracker bot advancement');
  let advance = data.slice(start, end);
  advance = advance.replace(/    let latest = [^;]+;/, `    const versioned = await safeCrackerReadVersioned(gameId);\n    let latest = versioned.game || game;\n    const expectedEtag = versioned.etag;`);
  if (!advance.includes('const expectedEtag = versioned.etag;')) throw new Error('Safe Cracker bot-stop patch could not version the bot read.');
  advance = advance.replace(
    `        return await duelSaveGame({ ...latest, safecrackerState: state });`,
    `        const cleared = await safeCrackerSaveVersioned({ ...latest, safecrackerState: state, npcActionAt: null }, expectedEtag);\n        return cleared.game || latest;`
  );
  advance = advance.replace(
    `      return await duelSaveGame({ ...latest, safecrackerState: state });`,
    `      const scheduledSave = await safeCrackerSaveVersioned({ ...latest, safecrackerState: state, npcActionAt: state.npcActionAt }, expectedEtag);\n      return scheduledSave.game || latest;`
  );
  if (advance.includes('duelSaveGame({ ...latest, safecrackerState: state })')) throw new Error('Safe Cracker bot-stop patch left an unconditional bot schedule write.');
  data = data.slice(0, start) + advance + data.slice(end);
}

await writeFile(dataUrl, data);

let action = await readFile(actionUrl, 'utf8');
if (!action.includes('X-Safe-Cracker-Bot-Guard')) {
  action = action.replace(
    '    "X-Duel-Function-Build": DUEL_FUNCTION_BUILD',
    '    "X-Duel-Function-Build": DUEL_FUNCTION_BUILD,\n    "X-Safe-Cracker-Bot-Guard": "atomic-cas-v9"'
  );
}
await writeFile(actionUrl, action);

console.log('Applied Safe Cracker atomic bot-stop guard: all guess and NPC schedule writes use strong ETag compare-and-set and cannot overwrite a completed match.');
