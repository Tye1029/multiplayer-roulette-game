import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [data, html, action, packageJsonText] = await Promise.all([
  readFile(new URL('netlify/functions/_data.js', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('netlify/functions/duel-action.js', root), 'utf8'),
  readFile(new URL('package.json', root), 'utf8')
]);
const packageJson = JSON.parse(packageJsonText);

function assert(condition, message) {
  if (!condition) throw new Error(`Safe Cracker storage-consistency validation failed: ${message}`);
}

assert(data.includes('primaryStore.get(duelGameKey(id), { type: "json", consistency: "strong" })'), 'strong reads do not use operation-level consistency on the configured store');
assert(data.includes('store.get(duelActiveKey(viewer),{type:"json",consistency:"strong"})'), 'active-game pointers are not read strongly');
assert(data.includes('duelGetRawStrong(pointer.gameId,2) || await duelGetRaw(pointer.gameId)'), 'active-game recovery does not strongly resolve the pointed game');
assert(data.includes('const requestedGameId = mpCleanId(gameId);'), 'Ready does not normalize the requested game ID');
assert(data.includes('for (let attempt = 0; attempt < 6 && !game; attempt += 1)'), 'Ready does not retry the authoritative record');
assert(data.includes('const active = await duelFindActiveGameForUser(user.id);'), 'Ready cannot recover the user’s active Safe Cracker game');

assert(String(packageJson.dependencies?.['@netlify/blobs'] || '') === '10.7.10', 'Netlify Blobs must remain pinned to the verified client version');
assert(data.includes('// SAFE_CRACKER_DIRECT_COMPLETION_START'), 'direct completion layer is missing');
assert(data.includes('// SAFE_CRACKER_ATOMIC_APPLY_V10_START'), 'atomic completion writer v10 is missing');
assert(data.includes("getWithMetadata(key, { consistency: 'strong', type: 'text' })"), 'combined versioned read is not compatibility-safe');
assert(data.includes('beforeEtag && beforeEtag === afterEtag'), 'fallback versioned read can mix an ETag with a different payload');
assert(!data.includes('if (!versioned.etag) return latest;'), 'missing ETags still fake successful writes');
assert(!data.includes('duel-safecracker-completion/'), 'obsolete completion-claim blobs are still in the finish path');
assert(!data.includes('safeCrackerClaimCompletion'), 'obsolete completion ownership loop is still present');
assert(data.includes("if (latest?.status === 'complete') return latest;"), 'duplicate finish requests do not return the completed game');
assert(data.includes("completionMode: 'direct-v8'"), 'completed games do not identify the immediate finish path');
assert(data.includes('const saved = await safeCrackerSaveVersioned(candidate, versioned.etag);'), 'the third digit is not atomically claimed before completion');
assert(data.includes('return await safeCrackerComplete(authoritative, safeCrackerEnsureState(authoritative), id,'), 'the third digit does not return completion immediately after the atomic claim');
assert(!data.includes('const confirmedComplete = await duelGetRawStrong(gameId, 2) || completed;'), 'a stale confirmation read can still discard a completed result');
assert(data.includes('const alreadyCompletedPlayerId = safeCrackerCompletedPlayerId(latest, state);'), 'polling cannot repair games already stuck at stage three');
assert(data.includes('repairedCompletion: true'), 'an action cannot repair an already completed stage-three state');
assert(data.includes('const at = String(resolved?.completionAt || clean.completedAt || nowIso());'), 'completion timestamps are not stable across duplicate execution');
assert(data.includes("setJSON(duelGameKey(gameId), clean, { onlyIfMatch: expectedEtag })"), 'Safe Cracker state writes are not compare-and-set protected');
assert(data.includes('confirmedStateRevision >= targetStateRevision'), 'conditional writes with a void result are not verified after saving');

const readyStart = html.indexOf('// SAFE_CRACKER_READY_RETRY_START');
const readyEnd = html.indexOf('// SAFE_CRACKER_READY_RETRY_END', readyStart);
assert(readyStart >= 0 && readyEnd > readyStart, 'single-tap Ready retry helper is missing');
const readyHelper = html.slice(readyStart, readyEnd);
assert(readyHelper.includes('const deadlineAt = Date.now() + 12000;'), 'one Ready tap does not remain pending through transient storage visibility');
assert(readyHelper.includes('while (Date.now() < deadlineAt)'), 'Ready retry is not deadline-based');
assert(!readyHelper.includes('duelRequest("get"'), 'Ready retries still create competing GET traffic');
assert(action.includes('const DUEL_FUNCTION_BUILD = "safecracker-direct-v8";'), 'immediate-completion function bundle marker is missing');
assert(action.includes('"X-Safe-Cracker-Bot-Guard": "atomic-cas-v10"'), 'atomic bot-stop v10 function marker is missing');

console.log('Safe Cracker storage-consistency validation passed: regular guesses persist or return explicit errors, the third digit is atomically claimed, completion is immediate, and stage-three games repair automatically.');