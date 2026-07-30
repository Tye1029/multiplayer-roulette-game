import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [data, client, styles, index, action] = await Promise.all([
  readFile(new URL('netlify/functions/_data.js', root), 'utf8'),
  readFile(new URL('assets/safe-cracker/safe-cracker.js', root), 'utf8'),
  readFile(new URL('assets/safe-cracker/safe-cracker.css', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('netlify/functions/duel-action.js', root), 'utf8')
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Safe Cracker start-flow validation failed: ${message}`);
}

assert(data.includes('const startMs = atMs + (game?.mode === "safecracker" ? 3000 : DUEL_COUNTDOWN_MS);'), 'Safe Cracker does not have an authoritative three-second countdown');
assert(data.includes('if (game.mode === "roulette" || game.mode === "safecracker")'), 'Remote Bot is not confirmed Ready in the same Safe Cracker transaction');
assert(data.includes('let game = await duelGetRaw(gameId) || await duelGetRawStrong(gameId, 1);'), 'player actions do not use the available exact game read with strong fallback');
assert(data.includes('let latest = await duelGetRaw(gameId) || await duelGetRawStrong(gameId, 1) || game;'), 'bot advancement does not use the available exact game read with strong fallback');
assert(data.includes('let latest = await duelGetRaw(gameId) || await duelGetRawStrong(gameId, 1) || fallback;'), 'verified guess writes do not have a responsive normal-read path');
assert(data.includes('const beforeSave = await duelGetRawStrong(gameId, 1) || await duelGetRaw(gameId);'), 'pre-save verification has no normal-read fallback');

assert(client.includes('function safeCrackerStartCountdownLabel'), 'dedicated countdown clock is missing');
assert(client.includes("if (remaining > 2000) return '3';"), 'countdown does not show 3');
assert(client.includes("if (remaining > 1000) return '2';"), 'countdown does not show 2');
assert(client.includes("if (remaining > 0) return '1';"), 'countdown does not show 1');
assert(client.includes("return 'GO!';"), 'countdown does not show GO');
assert(client.includes('data-sc-start-countdown'), 'countdown overlay is missing from the Safe Cracker renderer');
assert(styles.includes('.sc-start-countdown-overlay'), 'countdown overlay styling is missing');
assert(index.includes("if(game.mode==='safecracker')"), 'shared countdown portal still owns Safe Cracker');
assert(index.includes('/assets/safe-cracker/safe-cracker.js?v=4'), 'fresh Safe Cracker runtime is not cache-busted');
assert(index.includes('/assets/safe-cracker/safe-cracker.css?v=4'), 'fresh Safe Cracker styles are not cache-busted');
assert(action.includes('const DUEL_FUNCTION_BUILD = "safecracker-responsive-v4";'), 'fresh responsive Safe Cracker function bundle marker is missing');

console.log('Safe Cracker start-flow validation passed: one Ready tap starts a dedicated 3-2-1-GO countdown, actions use fast fallback reads, and fresh assets/functions are bundled.');
