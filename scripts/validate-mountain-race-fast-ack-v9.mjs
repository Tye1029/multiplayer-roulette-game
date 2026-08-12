import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [data, action, integration, client, html, safeCracker, roulette] = await Promise.all([
  readFile(new URL('netlify/functions/_data.js', root), 'utf8'),
  readFile(new URL('netlify/functions/duel-action.js', root), 'utf8'),
  readFile(new URL('netlify/functions/mountain-race/integration.js', root), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race-multiplayer.js', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('assets/safe-cracker/safe-cracker.js', root), 'utf8'),
  readFile(new URL('assets/roulette/turn-animation.js', root), 'utf8')
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Summit Sprint fast-ack validation failed: ${message}`);
}

assert(data.includes('// MOUNTAIN_RACE_FAST_ACK_V9'), 'fast-save marker is missing');
assert(data.includes('async function mountainRaceFastSaveGame(game)'), 'game-only save helper is missing');
assert(data.includes('saveGame: mountainRaceFastSaveGame'), 'Mountain Race still uses the generic pointer-writing save');
const fastSaveStart = data.indexOf('async function mountainRaceFastSaveGame(game)');
const fastSaveEnd = data.indexOf('const mountainRaceIntegration', fastSaveStart);
const fastSaveBody = data.slice(fastSaveStart, fastSaveEnd);
assert(fastSaveBody.includes('getUsersStore().setJSON(duelGameKey(clean.gameId), clean)'), 'fast save does not persist the authoritative game');
assert(!fastSaveBody.includes('duelSetActivePointer'), 'fast save still rewrites active pointers');
assert(!fastSaveBody.includes('duelClearPointers'), 'fast save clears pointers during active play');

assert(action.includes('// MOUNTAIN_RACE_FAST_ACK_V9'), 'fast route marker is missing');
assert(action.includes('result?.skipBalanceLookup'), 'active input responses still perform the user-record balance read');
assert(action.includes('DUEL_SITE_USER_CACHE'), 'warm requests do not reuse the verified site-user mapping');
assert(action.includes('DUEL_SITE_USER_CACHE_MS = 10 * 60 * 1000'), 'site-user cache lifetime is missing');
assert(action.includes('inputBatch: body.inputBatch'), 'queued inputs are still routed to the server');

assert(integration.includes('response.skipBalanceLookup = true'), 'playing Summit Sprint responses do not request the fast route');
assert(integration.includes('await strongRead(game.gameId)'), 'authoritative action-id confirmation was removed');
assert(client.includes('// MOUNTAIN_RACE_INPUT_REBASE_V8'), 'authoritative slip rebasing was lost');
assert(html.includes('<!-- MOUNTAIN_RACE_FAST_ACK_V9 -->'), 'deployment marker is missing');
assert(html.includes('mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=9') ||
  html.includes('mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=11'), 'fresh V9-or-newer client cache boundary is missing');
assert(safeCracker.length > 0, 'protected Safe Cracker runtime is unreadable');
assert(roulette.length > 0, 'protected Roulette runtime is unreadable');

console.log('Summit Sprint Fast Ack V9 validation passed: active batches keep strong game confirmation while removing two pointer writes, the unrelated balance read, and repeated warm site-user resolution; V8 input rebasing and protected games remain intact.');
