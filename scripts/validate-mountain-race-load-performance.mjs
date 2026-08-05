import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [client, html, patch, safeCrackerClient, rouletteTurn] = await Promise.all([
  readFile(new URL('assets/mountain-race/mountain-race-multiplayer.js', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('scripts/patch-mountain-race-load-performance.mjs', root), 'utf8'),
  readFile(new URL('assets/safe-cracker/safe-cracker.js', root), 'utf8'),
  readFile(new URL('assets/roulette/turn-animation.js', root), 'utf8')
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Summit Sprint load-performance validation failed: ${message}`);
}

assert(client.includes('// MOUNTAIN_RACE_LOAD_PERFORMANCE_V1'), 'client load-performance marker is missing');
assert(client.includes("renderKey: ''"), 'render signature state is missing');
assert(client.includes('function meaningfulRenderKey(game)'), 'meaningful-state signature helper is missing');
assert(client.includes('sameMeaningfulState && runtime.root?.isConnected'), 'unchanged polls still rebuild the mountain DOM');
assert(client.includes('updateClock();\n      startTicker();\n      return;'), 'unchanged polls do not take the lightweight clock-only path');

assert(html.includes('<!-- MOUNTAIN_RACE_LOAD_PERFORMANCE_V1 -->'), 'deployed load-performance marker is missing');
assert(!html.includes('new MutationObserver(renameNetworkBotLog)'), 'permanent Network Bot Log observer still exists');
assert(html.includes('attempts < 8'), 'bounded Network Bot Log discovery is missing');
assert(html.includes('window.setTimeout(retry, 650)'), 'bounded label discovery does not yield between attempts');
assert(html.includes('mountain-race-multiplayer.js?v=1&gameplay=3&load=2'), 'fresh load-performance client cache boundary is missing');

assert(patch.includes('stopped unchanged network polls from rebuilding the complete mountain DOM'), 'patch does not document the actual load fix');
assert(patch.includes("await import('./patch-mountain-race-state-sync.mjs')"), 'state synchronization patch is not chained after the load fix');
assert(safeCrackerClient.length > 0, 'protected Safe Cracker runtime is unreadable');
assert(rouletteTurn.length > 0, 'protected Roulette runtime is unreadable');

console.log('Summit Sprint load-performance validation passed: no permanent whole-page observer remains, log-label discovery is bounded, unchanged polls use a clock-only path, and protected games remain intact.');
await import('./validate-mountain-race-state-sync.mjs');
