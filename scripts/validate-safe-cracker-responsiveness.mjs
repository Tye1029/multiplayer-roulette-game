import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [data, html, action] = await Promise.all([
  readFile(new URL('netlify/functions/_data.js', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('netlify/functions/duel-action.js', root), 'utf8')
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Safe Cracker responsiveness validation failed: ${message}`);
}

assert(data.includes('primaryStore.get(duelGameKey(id), { type: "json", consistency: "strong" })'), 'fresh-game reads do not use operation-level strong consistency');
assert(data.includes('const requestedGameId = mpCleanId(gameId);'), 'Ready does not normalize the requested game');
assert(data.includes('for (let attempt = 0; attempt < 6 && !game; attempt += 1)'), 'Ready does not recover through transient storage visibility');
assert(data.includes('const active = await duelFindActiveGameForUser(user.id);'), 'Ready does not recover the player’s active game');
assert(data.includes('let latest = await duelGetRawStrong(gameId, 1) || await duelGetRaw(gameId) || game;'), 'bot advancement does not use the corrected strong-first read path');
assert(data.includes('let latest = await duelGetRawStrong(gameId, 1) || await duelGetRaw(gameId) || fallback;'), 'guess writes do not use the corrected strong-first read path');
assert(data.includes('const beforeSave = await duelGetRawStrong(gameId, 1) || await duelGetRaw(gameId);'), 'pre-save race verification was removed');
assert(data.includes('confirmedState.processedActionIds.includes(cleanActionId)'), 'post-write action verification was removed');
assert(data.includes('secondsLeft: complete ? 0 :'), 'completed Safe Cracker timers continue counting down');
assert(data.includes('return await safeCrackerComplete(candidate, state, id,'), 'a correct third digit does not return completion immediately');
assert(!data.includes('const confirmedComplete = await duelGetRawStrong(gameId, 2) || completed;'), 'stale post-finish confirmation can still discard completion');

const helperStart = html.indexOf('// SAFE_CRACKER_READY_RETRY_START');
const helperEnd = html.indexOf('// SAFE_CRACKER_READY_RETRY_END', helperStart);
assert(helperStart >= 0 && helperEnd > helperStart, 'automatic one-tap Ready retry helper is missing');
const helper = html.slice(helperStart, helperEnd);
assert(helper.includes('const deadlineAt = Date.now() + 12000;'), 'Ready does not remain pending long enough for transient storage visibility');
assert(helper.includes('while (Date.now() < deadlineAt)'), 'Ready retry does not use a single deadline-bound tap');
assert(!helper.includes('duelRequest("get"'), 'Ready retry still creates competing GET traffic');
assert(html.includes('const data = await duelSafeCrackerReadyRequest(duelCurrentGameId);'), 'Ready button bypasses the retry helper');
assert(html.includes('window.__safeCrackerFocusedGetAbort = controller'), 'focused Safe Cracker GET cannot be cancelled');
assert(html.includes('window.__safeCrackerFocusedGetAbort?.abort()'), 'a guess does not cancel its obsolete focused GET');
assert(html.includes('game.status === "playing" ? 2200 : 650'), 'Safe Cracker polling cadence was not reduced');
assert(html.includes('window.__safeCrackerReadyRetryInFlight'), 'background polling can compete with Ready retries');
assert(html.includes('/assets/safe-cracker/safe-cracker.js?v=6'), 'responsive Safe Cracker JavaScript is not visual-dial v6');
assert(html.includes('/assets/safe-cracker/safe-cracker.css?v=6'), 'responsive Safe Cracker stylesheet is not visual-dial v6');
assert(action.includes('const DUEL_FUNCTION_BUILD = "safecracker-direct-v8";'), 'immediate-completion function bundle marker is missing');

console.log('Safe Cracker responsiveness validation passed: Ready retries, poll cancellation, immediate completion, and visual-dial v6 remain intact.');
