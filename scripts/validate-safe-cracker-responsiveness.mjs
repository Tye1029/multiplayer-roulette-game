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

assert(data.includes('let game = await duelGetRaw(gameId) || await duelGetRawStrong(gameId, 1);'), 'Ready and player actions do not use a fast exact read with strong fallback');
assert(data.includes('await sleep(160);'), 'Ready lookup does not retry a transient missing game');
assert(data.includes('let latest = await duelGetRaw(gameId) || await duelGetRawStrong(gameId, 1) || game;'), 'bot advancement still begins with the slow strong-read path');
assert(data.includes('let latest = await duelGetRaw(gameId) || await duelGetRawStrong(gameId, 1) || fallback;'), 'guess writes still begin with the slow strong-read path');
assert(data.includes('const beforeSave = await duelGetRawStrong(gameId, 1) || await duelGetRaw(gameId);'), 'pre-save race verification was removed');
assert(data.includes('confirmedState.processedActionIds.includes(cleanActionId)'), 'post-write action verification was removed');
assert(data.includes('secondsLeft: complete ? 0 :'), 'completed Safe Cracker timers continue counting down');

assert(html.includes('// SAFE_CRACKER_READY_RETRY_START'), 'automatic one-tap Ready retry helper is missing');
assert(html.includes('const attempts = isSafeCracker ? 3 : 1;'), 'Safe Cracker Ready is not retried automatically');
assert(html.includes('const data = await duelSafeCrackerReadyRequest(duelCurrentGameId);'), 'Ready button bypasses the retry helper');
assert(html.includes('window.__safeCrackerFocusedGetAbort = controller'), 'focused Safe Cracker GET cannot be cancelled');
assert(html.includes('window.__safeCrackerFocusedGetAbort?.abort()'), 'a guess does not cancel its obsolete focused GET');
assert(html.includes('game.status === "playing" ? 2200 : 650'), 'Safe Cracker polling cadence was not reduced');
assert(html.includes('window.__safeCrackerReadyRetryInFlight'), 'background polling can compete with Ready retries');
assert(html.includes('/assets/safe-cracker/safe-cracker.js?v=4'), 'responsive Safe Cracker JavaScript is not cache-busted');
assert(html.includes('/assets/safe-cracker/safe-cracker.css?v=4'), 'responsive Safe Cracker stylesheet is not cache-busted');
assert(action.includes('const DUEL_FUNCTION_BUILD = "safecracker-responsive-v4";'), 'responsive function bundle marker is missing');

console.log('Safe Cracker responsiveness validation passed: Ready retries automatically, obsolete polls are cancelled, polling is lighter, reads are faster, and write verification remains intact.');
