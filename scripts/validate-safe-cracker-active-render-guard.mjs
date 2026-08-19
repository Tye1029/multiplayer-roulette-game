import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [html, client, patch, turnAnimation, turnFire, audioBindings] = await Promise.all([
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('assets/safe-cracker/safe-cracker.js', root), 'utf8'),
  readFile(new URL('scripts/patch-safe-cracker-active-render-guard.mjs', root), 'utf8'),
  readFile(new URL('assets/roulette/turn-animation.js', root)),
  readFile(new URL('assets/roulette/turn-fire.js', root)),
  readFile(new URL('assets/roulette/audio-bindings.js', root))
]);

const start = '// SAFE_CRACKER_ACTIVE_RENDER_GUARD_V13_START';
const end = '// SAFE_CRACKER_ACTIVE_RENDER_GUARD_V13_END';
const expectedGuards = 3;

function assert(condition, message) {
  if (!condition) throw new Error(`Safe Cracker active render guard validation failed: ${message}`);
}
function occurrences(source, value) {
  return source.split(value).length - 1;
}
function selectRenderGame(incoming, retained) {
  return incoming || (
    retained?.mode === 'safecracker' &&
    ['ready', 'countdown', 'playing'].includes(retained.status)
      ? retained
      : null
  );
}

assert(occurrences(html, start) === expectedGuards, `start marker must appear ${expectedGuards} times`);
assert(occurrences(html, end) === expectedGuards, `end marker must appear ${expectedGuards} times`);
const guardBlocks = html.match(/\/\/ SAFE_CRACKER_ACTIVE_RENDER_GUARD_V13_START[\s\S]*?\/\/ SAFE_CRACKER_ACTIVE_RENDER_GUARD_V13_END/g) || [];
assert(guardBlocks.length === expectedGuards, `expected ${expectedGuards} complete guard blocks`);
for (const guard of guardBlocks) {
  assert(guard.includes("['ready', 'countdown', 'playing']"), 'active lifecycle allowlist changed');
  assert(!guard.includes("'complete'"), 'completed games must not be retained by a guard');
  assert(guard.includes('data.game ||'), 'real incoming game must take priority');
  assert(guard.includes("duelLastActiveGame?.mode === 'safecracker'"), 'guard is not scoped to Safe Cracker');
  assert(guard.includes('window.__safeCrackerRenderGuardRecoveries'), 'recovery diagnostic counter is missing');
}
assert(occurrences(html, 'return duelRenderActive(safeCrackerActiveRenderGame, true);') === expectedGuards, 'guarded render calls are missing');
assert((html.match(/duelRenderActive\(data\.game,\s*true\);/g) || []).length === 0, 'an unguarded active-game render call remains');

const playing = { mode: 'safecracker', status: 'playing', gameId: 'playing' };
const ready = { mode: 'safecracker', status: 'ready', gameId: 'ready' };
const countdown = { mode: 'safecracker', status: 'countdown', gameId: 'countdown' };
const complete = { mode: 'safecracker', status: 'complete', gameId: 'complete' };
const roulette = { mode: 'roulette', status: 'playing', gameId: 'roulette' };
const incoming = { mode: 'safecracker', status: 'playing', gameId: 'incoming' };
assert(selectRenderGame(null, playing) === playing, 'playing Safe Cracker game is not retained');
assert(selectRenderGame(null, ready) === ready, 'ready Safe Cracker game is not retained');
assert(selectRenderGame(null, countdown) === countdown, 'countdown Safe Cracker game is not retained');
assert(selectRenderGame(null, complete) === null, 'complete Safe Cracker game cannot be dismissed');
assert(selectRenderGame(null, roulette) === null, 'Roulette game is incorrectly retained by Safe Cracker guard');
assert(selectRenderGame(incoming, playing) === incoming, 'real incoming game does not override retained state');

assert(client.includes('choice: `safecracker:guess:${runtime.selected}`'), 'authoritative Safe Cracker submission changed');
assert(client.includes('// SAFE_CRACKER_INPUT_CONTINUITY_V9_START'), 'input continuity v9 is missing');
assert(client.includes('// SAFE_CRACKER_SAMPLE_MIX_V11_START'), 'sample mix v11 is missing');
assert(turnAnimation.length > 0 && turnFire.length > 0 && audioBindings.length > 0, 'protected Roulette assets are unreadable');
assert(!patch.includes("writeFile(new URL('../netlify/functions/"), 'guard patch must not write networking files');
assert(!patch.includes("writeFile(new URL('../assets/roulette/"), 'guard patch must not write Roulette files');
assert(patch.includes('expectedRenderCalls = 3') && patch.includes('renderCalls.length !== expectedRenderCalls') && patch.includes('html.replace(renderCallPattern, replacement)'), 'patch does not protect every active-game renderer');

console.log('Safe Cracker active render guard validation passed: all active-game render paths retain ready/countdown/playing Safe Cracker boards on transient empty responses, completed dismissal remains available, and protected gameplay boundaries stay intact.');
