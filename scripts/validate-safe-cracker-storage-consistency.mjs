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

assert(String(packageJson.dependencies?.['@netlify/blobs'] || '') === '10.7.10', 'conditional writes require the pinned Netlify Blobs 10.7.10 client');
assert(data.includes('// SAFE_CRACKER_COMPLETION_CLAIM_START'), 'completion claim layer is missing');
assert(data.includes('duel-safecracker-completion/'), 'completion claims are not isolated per game and round');
assert(data.includes("const ownerToken = crypto.randomBytes(16).toString('hex');"), 'completion writers do not have unique ownership tokens');
assert(data.includes("store.get(claimId, { type: 'json', consistency: 'strong' })"), 'completion claims are not read strongly');
assert(data.includes('store.setJSON(claimId, proposed, { onlyIfNew: true })'), 'completion ownership is not atomic');
assert(data.includes('const claim = safeCrackerNormalizeCompletionClaim(confirmed, proposed);'), 'completion ownership is not verified by reading the stored claim back');
assert(data.includes('owner: claim.ownerToken === ownerToken'), 'the stored ownership token does not decide the winner');
assert(!data.includes('if (written?.modified) return { claim: proposed, owner: true };'), 'completion still depends on a version-specific setJSON return object');
assert(data.includes('safeCrackerWaitForClaimedCompletion'), 'duplicate finishers do not wait for the claimed result');
assert(data.includes('completionClaimId: claim.claimId'), 'completed games do not expose a stable internal claim ID');
assert(data.includes('const at = String(resolved?.completionAt || clean.completedAt || nowIso());'), 'completion timestamps are not stable across duplicate execution');

const readyStart = html.indexOf('// SAFE_CRACKER_READY_RETRY_START');
const readyEnd = html.indexOf('// SAFE_CRACKER_READY_RETRY_END', readyStart);
assert(readyStart >= 0 && readyEnd > readyStart, 'single-tap Ready retry helper is missing');
const readyHelper = html.slice(readyStart, readyEnd);
assert(readyHelper.includes('const deadlineAt = Date.now() + 12000;'), 'one Ready tap does not remain pending through transient storage visibility');
assert(readyHelper.includes('while (Date.now() < deadlineAt)'), 'Ready retry is not deadline-based');
assert(!readyHelper.includes('duelRequest("get"'), 'Ready retries still create competing GET traffic');
assert(action.includes('const DUEL_FUNCTION_BUILD = "safecracker-storage-v6";'), 'storage-consistent function bundle marker is missing');

console.log('Safe Cracker storage-consistency validation passed: Ready strongly recovers fresh games and read-back verified atomic claims own deterministic completions.');