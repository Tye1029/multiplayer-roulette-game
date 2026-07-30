import { readFile, writeFile } from 'node:fs/promises';

const dataUrl = new URL('../netlify/functions/_data.js', import.meta.url);
const actionUrl = new URL('../netlify/functions/duel-action.js', import.meta.url);
const marker = '// SAFE_CRACKER_ATOMIC_BOT_STOP_V10_START';

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

let data = await readFile(dataUrl, 'utf8');
if (!data.includes(marker)) {
  const helpers = String.raw`${marker}
function safeCrackerParseVersionedGame(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  let value = raw;
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer?.(value)) value = value.toString('utf8');
  if (typeof value === 'string') value = JSON.parse(value);
  if (!value || typeof value !== 'object') throw new Error('Safe Cracker storage returned an invalid game payload.');
  return duelSanitizeGame(value);
}

async function safeCrackerReadVersioned(gameId) {
  const id = mpCleanId(gameId);
  if (!id) return { game: null, etag: '', source: 'invalid-id' };
  const store = getUsersStore();
  const key = duelGameKey(id);
  let lastError = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      // Reading as text avoids runtime-specific JSON decoding differences while
      // preserving the exact ETag required by onlyIfMatch.
      const entry = await store.getWithMetadata(key, { consistency: 'strong', type: 'text' });
      if (entry === null) return { game: null, etag: '', source: 'missing' };
      const game = safeCrackerParseVersionedGame(entry.data);
      const etag = String(entry.etag || '');
      if (game && etag) return { game, etag, source: 'combined' };
      throw new Error('Safe Cracker combined storage read did not include an ETag.');
    } catch (error) {
      lastError = error;
    }

    try {
      // Compatibility fallback for runtimes where getWithMetadata is unavailable
      // or cannot decode the object. Matching metadata reads around one strong data
      // read prove that the payload and ETag came from the same unchanged version.
      const before = await store.getMetadata(key, { consistency: 'strong' });
      const raw = await store.get(key, { consistency: 'strong', type: 'text' });
      const after = await store.getMetadata(key, { consistency: 'strong' });
      if (raw === null) return { game: null, etag: '', source: 'missing' };
      const beforeEtag = String(before?.etag || '');
      const afterEtag = String(after?.etag || '');
      if (beforeEtag && beforeEtag === afterEtag) {
        return { game: safeCrackerParseVersionedGame(raw), etag: afterEtag, source: 'split' };
      }
      throw new Error('Safe Cracker storage changed during the compatibility read.');
    } catch (error) {
      lastError = error;
    }

    await sleep(35 * (attempt + 1));
  }

  const detail = String(lastError?.message || lastError || '').slice(0, 180);
  throw new Error('Safe Cracker could not obtain a versioned game record' + (detail ? ': ' + detail : '.'));
}

async function safeCrackerSaveVersioned(game, expectedEtag) {
  const gameId = mpCleanId(game?.gameId);
  if (!gameId || !expectedEtag) throw new Error('Safe Cracker could not obtain the storage version required to save that action.');
  const clean = duelSanitizeGame({
    ...game,
    schemaVersion: DUEL_SCHEMA_VERSION,
    revision: int(game?.revision, 0) + 1,
    updatedAt: nowIso()
  });

  let result;
  try {
    result = await getUsersStore().setJSON(duelGameKey(gameId), clean, { onlyIfMatch: expectedEtag });
  } catch (error) {
    const current = await duelGetRawStrong(gameId, 1) || await duelGetRaw(gameId);
    if (current?.status !== 'playing') return { modified: false, game: current };
    throw error;
  }

  if (result?.modified === false) {
    return { modified: false, game: await duelGetRawStrong(gameId, 1) || await duelGetRaw(gameId) || game };
  }

  // Some compatible Blobs clients resolve a successful conditional set without
  // a result object. Confirm that the targeted state revision actually persisted
  // instead of treating an undefined return value as a silent failed guess.
  let savedGame = clean;
  if (result?.modified !== true) {
    const confirmed = await safeCrackerReadVersioned(gameId);
    const targetStateRevision = int(clean.safecrackerState?.revision, 0);
    const confirmedStateRevision = int(confirmed.game?.safecrackerState?.revision, 0);
    const survived = Boolean(
      confirmed.game &&
      int(confirmed.game.revision, 0) >= int(clean.revision, 0) &&
      confirmedStateRevision >= targetStateRevision
    );
    if (!survived) return { modified: false, game: confirmed.game || game };
    savedGame = confirmed.game;
  }

  if (duelIsActiveStatus(savedGame.status)) {
    await Promise.all([savedGame.creator?.userId, savedGame.joiner?.userId].filter(Boolean).map(id => duelSetActivePointer(id, savedGame)));
  } else {
    await duelClearPointers(savedGame);
  }
  return { modified: true, game: savedGame };
}
// SAFE_CRACKER_ATOMIC_BOT_STOP_V10_END

`;
  const insertAt = data.indexOf('async function safeCrackerApplyGuess(');
  if (insertAt < 0) throw new Error('Safe Cracker bot-stop patch could not find the guess writer insertion point.');
  data = data.slice(0, insertAt) + helpers + data.slice(insertAt);

  const atomicApply = String.raw`async function safeCrackerApplyGuess(game, actorId, guess, actionId = '', isBot = false) {
  // SAFE_CRACKER_ATOMIC_APPLY_V10_START
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
    if (!versioned.etag) throw new Error('Safe Cracker could not obtain the storage version required to submit that number.');

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
      npcActionAt: isBot
        ? (player.stage < SAFE_CRACKER_STAGES ? new Date(now + safeCrackerBotDelay(latest)).toISOString() : null)
        : (state.npcActionAt || latest.npcActionAt || null)
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
  throw new Error('Safe Cracker could not save that number after repeated concurrent updates. Please try it again.');
  // SAFE_CRACKER_ATOMIC_APPLY_V10_END
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
if (action.includes('"X-Safe-Cracker-Bot-Guard": "atomic-cas-v9"')) {
  action = action.replace('"X-Safe-Cracker-Bot-Guard": "atomic-cas-v9"', '"X-Safe-Cracker-Bot-Guard": "atomic-cas-v10"');
} else if (!action.includes('X-Safe-Cracker-Bot-Guard')) {
  action = action.replace(
    '    "X-Duel-Function-Build": DUEL_FUNCTION_BUILD',
    '    "X-Duel-Function-Build": DUEL_FUNCTION_BUILD,\n    "X-Safe-Cracker-Bot-Guard": "atomic-cas-v10"'
  );
}
await writeFile(actionUrl, action);

console.log('Applied Safe Cracker atomic bot-stop v10: versioned reads have a compatibility fallback, successful writes are confirmed, storage failures are explicit, and late bot requests cannot overwrite completion.');