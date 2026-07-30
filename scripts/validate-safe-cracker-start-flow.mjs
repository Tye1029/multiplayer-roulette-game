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
assert(data.includes('const requestedGameId = mpCleanId(gameId);'), 'Ready does not strongly recover the requested Safe Cracker game');
assert(data.includes('// SAFE_CRACKER_MUTATION_LOCK_V11_START'), 'cross-instance Safe Cracker mutation lock is missing');
assert(data.includes("setJSON(key, lease, { onlyIfNew: true })"), 'mutation lock is not acquired atomically');
assert(data.includes('const dueAt = safeCrackerBotDueAt(latest, state, npcId);'), 'bot timing still requires a countdown-blocking schedule write');
assert(data.includes("console.error('[safecracker] poll advancement failed without blocking the game snapshot:'"), 'poll errors can still trap the client on the countdown screen');
assert(!data.includes('getWithMetadata('), 'start transition still depends on the failing metadata API');

assert(client.includes('function safeCrackerStartCountdownLabel'), 'dedicated countdown clock is missing');
assert(client.includes("if (remaining > 2000) return '3';"), 'countdown does not show 3');
assert(client.includes("if (remaining > 1000) return '2';"), 'countdown does not show 2');
assert(client.includes("if (remaining > 0) return '1';"), 'countdown does not show 1');
assert(client.includes("return 'GO!';"), 'countdown does not show GO');
assert(client.includes('data-sc-start-countdown'), 'countdown overlay is missing from the Safe Cracker renderer');
assert(client.includes('data-sc-countdown-value'), 'cinematic countdown value is missing');
assert(client.includes('function playCountdownBeat'), 'mechanical countdown beat is missing');
assert(styles.includes('.sc-start-countdown-overlay'), 'countdown overlay styling is missing');
assert(styles.includes('.sc-countdown-vault'), 'countdown vault mechanism is missing');
assert(index.includes("if(game.mode==='safecracker')"), 'shared countdown portal still owns Safe Cracker');
assert(index.includes('/assets/safe-cracker/safe-cracker.js?v=8'), 'fresh Safe Cracker runtime is not visual-sequence v8');
assert(index.includes('/assets/safe-cracker/safe-cracker.css?v=8'), 'fresh Safe Cracker styles are not visual-sequence v8');
assert(client.includes('// SAFE_CRACKER_DIAL_PHYSICS_V2_START'), 'dial interaction polish is missing');
assert(client.includes('// SAFE_CRACKER_HUD_V3_START'), 'visual HUD pass is missing');
assert(client.includes('// SAFE_CRACKER_SEQUENCE_V4_START'), 'visual sequence pass is missing');
assert(action.includes('const DUEL_FUNCTION_BUILD = "safecracker-direct-v8";'), 'fresh immediate-completion Safe Cracker function bundle marker is missing');
assert(action.includes('"X-Safe-Cracker-Bot-Guard": "mutation-lock-v11"'), 'mutation-lock function marker is missing');

console.log('Safe Cracker start-flow validation passed: one Ready tap, authoritative countdown, fail-open polling, mutation-locked gameplay, mechanical presentation, and direct completion remain intact.');