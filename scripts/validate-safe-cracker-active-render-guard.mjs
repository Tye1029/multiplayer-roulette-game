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

assert(occurrences(html, start) === 1, 'start marker must appear exactly once');
assert(occurrences(html, end) === 1, 'end marker must appear exactly once');
const guardStart = html.indexOf(start);
const guardEnd = html.indexOf(end, guardStart);
assert(guardStart >= 0 && guardEnd > guardStart, 'guard marker order is invalid');
const guard = html.slice(guardStart, guardEnd + end.length);
assert(guard.includes("['ready', 'countdown', 'playing']"), 'active lifecycle allowlist changed');
assert(!guard.includes("'complete'"), 'completed games must not be retained by the guard');
assert(guard.includes('data.game ||'), 'real incoming game must take priority');
assert(guard.includes("duelLastActiveGame?.mode === 'safecracker'"), 'guard is not scoped to Safe Cracker');
assert(guard.includes('window.__safeCrackerRenderGuardRecoveries'), 'recovery diagnostic counter is missing');
assert(guard.includes('duelRenderActive(safeCrackerActiveRenderGame, true);'), 'guarded game is not passed to the active renderer');
assert(!html.includes('duelRenderActive(data.game, true);'), 'unguarded active-game render call remains');

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
assert(patch.includes('sourcePattern') && patch.includes('matches.length !== 1'), 'patch does not enforce a single exact render bridge');

console.log('Safe Cracker active render guard validation passed: transient empty responses retain ready/countdown/playing boards, completed dismissal remains available, authoritative gameplay and protected Roulette stay intact.');
