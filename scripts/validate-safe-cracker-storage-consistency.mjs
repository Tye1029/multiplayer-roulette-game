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
assert(!data.includes('duel-safecracker-completion/'), 'obsolete completion-claim blobs are still in the finish path');
assert(!data.includes('safeCrackerClaimCompletion'), 'obsolete completion ownership loop is still present');
assert(data.includes("if (latest?.status === 'complete') return latest;"), 'duplicate finish requests do not return the completed game');
assert(data.includes("completionMode: 'direct-v7'"), 'completed games do not identify the direct finish path');
assert(data.includes("if (confirmed?.status === 'complete') return confirmed;"), 'completion does not prefer a confirmed completed snapshot');
assert(data.includes('return completed;'), 'confirmation failure can still block a correct final digit');
assert(data.includes('const at = String(resolved?.completionAt || clean.completedAt || nowIso());'), 'completion timestamps are not stable across duplicate execution');

const readyStart = html.indexOf('// SAFE_CRACKER_READY_RETRY_START');
const readyEnd = html.indexOf('// SAFE_CRACKER_READY_RETRY_END', readyStart);
assert(readyStart >= 0 && readyEnd > readyStart, 'single-tap Ready retry helper is missing');
const readyHelper = html.slice(readyStart, readyEnd);
assert(readyHelper.includes('const deadlineAt = Date.now() + 12000;'), 'one Ready tap does not remain pending through transient storage visibility');
assert(readyHelper.includes('while (Date.now() < deadlineAt)'), 'Ready retry is not deadline-based');
assert(!readyHelper.includes('duelRequest("get"'), 'Ready retries still create competing GET traffic');
assert(action.includes('const DUEL_FUNCTION_BUILD = "safecracker-direct-v7";'), 'direct-completion function bundle marker is missing');

console.log('Safe Cracker storage-consistency validation passed: Ready strongly recovers fresh games and a correct final digit completes directly without a separate claim blob.');
