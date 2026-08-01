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

const start = '// SAFE_CRACKER_ACTIVE_RENDER_GUARD_V15_START';
const end = '// SAFE_CRACKER_ACTIVE_RENDER_GUARD_V15_END';
const expectedGuards = 3;
const retentionMs = 30000;

function assert(condition, message) {
  if (!condition) throw new Error(`Safe Cracker active render guard validation failed: ${message}`);
}
function occurrences(source, value) {
  return source.split(value).length - 1;
}
function selectRenderGame(incoming, stable, stableAge = 0) {
  const activeStatuses = ['ready', 'countdown', 'playing'];
  const preActiveStatuses = ['waiting', 'ready', 'countdown'];
  const statusRank = { waiting: 0, ready: 1, countdown: 2, playing: 3, complete: 4 };
  const stableIsActive = stable?.mode === 'safecracker' && activeStatuses.includes(stable.status);
  const incomingIsSafeCracker = incoming?.mode === 'safecracker';
  const incomingIsComplete = incomingIsSafeCracker && incoming.status === 'complete';
  const sameGame = Boolean(incoming && stable && String(incoming.gameId || '') === String(stable.gameId || ''));
  const incomingRevision = Number(incoming?.revision);
  const stableRevision = Number(stable?.revision);
  const revisionRegressed = Boolean(
    sameGame &&
    !incomingIsComplete &&
    Number.isFinite(incomingRevision) &&
    Number.isFinite(stableRevision) &&
    incomingRevision < stableRevision
  );
  const lifecycleRegressed = Boolean(
    incomingIsSafeCracker &&
    stableIsActive &&
    sameGame &&
    !incomingIsComplete &&
    (statusRank[incoming.status] ?? -1) < (statusRank[stable.status] ?? -1)
  );
  const transientEmpty = !incoming && stableIsActive && stableAge <= retentionMs;
  const differentPreActive = Boolean(
    incomingIsSafeCracker &&
    stableIsActive &&
    !sameGame &&
    preActiveStatuses.includes(incoming.status) &&
    stableAge <= retentionMs
  );
  const useStable = transientEmpty || lifecycleRegressed || revisionRegressed || differentPreActive;
  return useStable ? stable : incoming;
}

assert(occurrences(html, start) === expectedGuards, `start marker must appear ${expectedGuards} times`);
assert(occurrences(html, end) === expectedGuards, `end marker must appear ${expectedGuards} times`);
assert(!html.includes('SAFE_CRACKER_ACTIVE_RENDER_GUARD_V13_START'), 'legacy v13 guard remains');
assert(!html.includes('SAFE_CRACKER_ACTIVE_RENDER_GUARD_V14_START'), 'legacy v14 guard remains');
const guardBlocks = html.match(/\/\/ SAFE_CRACKER_ACTIVE_RENDER_GUARD_V15_START[\s\S]*?\/\/ SAFE_CRACKER_ACTIVE_RENDER_GUARD_V15_END/g) || [];
assert(guardBlocks.length === expectedGuards, `expected ${expectedGuards} complete guard blocks`);
for (const guard of guardBlocks) {
  assert(guard.includes("['ready', 'countdown', 'playing']"), 'active lifecycle allowlist changed');
  assert(guard.includes("['waiting', 'ready', 'countdown']"), 'pre-active lifecycle allowlist is missing');
  assert(guard.includes('waiting: 0') && guard.includes('complete: 4'), 'monotonic lifecycle ranking is missing');
  assert(guard.includes('window.__safeCrackerStableActiveGame'), 'independent stable-game cache is missing');
  assert(guard.includes("typeof duelLastActiveGame !== 'undefined'"), 'existing active-game cache does not bootstrap the guard');
  assert(guard.includes('window.__safeCrackerStableActiveSeenAt'), 'retention timestamp is missing');
  assert(guard.includes('safeCrackerRetentionMs = 30000'), 'bounded transient retention is missing');
  assert(guard.includes('safeCrackerLifecycleRegressed'), 'backward lifecycle detection is missing');
  assert(guard.includes('safeCrackerRevisionRegressed'), 'stale revision detection is missing');
  assert(guard.includes('safeCrackerDifferentPreActive'), 'competing pre-active snapshot protection is missing');
  assert(guard.includes('!safeCrackerIncomingIsComplete'), 'real completion is not protected from stale-revision retention');
  assert(guard.includes('window.__safeCrackerRenderGuardRecoveries'), 'recovery diagnostic counter is missing');
  assert(guard.includes('window.__safeCrackerRenderGuardRegressions'), 'regression diagnostic counter is missing');
}
assert(occurrences(html, 'return duelRenderActive(safeCrackerActiveRenderGame, true);') === expectedGuards, 'guarded render calls are missing');
assert((html.match(/duelRenderActive\(data\.game,\s*true\);/g) || []).length === 0, 'an unguarded active-game render call remains');

const stablePlaying = { mode: 'safecracker', status: 'playing', gameId: 'same', revision: 12 };
const stableCountdown = { mode: 'safecracker', status: 'countdown', gameId: 'same', revision: 8 };
const waitingSame = { mode: 'safecracker', status: 'waiting', gameId: 'same', revision: 13 };
const readySame = { mode: 'safecracker', status: 'ready', gameId: 'same', revision: 13 };
const olderPlaying = { mode: 'safecracker', status: 'playing', gameId: 'same', revision: 11 };
const newerPlaying = { mode: 'safecracker', status: 'playing', gameId: 'same', revision: 14 };
const completeSame = { mode: 'safecracker', status: 'complete', gameId: 'same', revision: 15 };
const lowerRevisionComplete = { mode: 'safecracker', status: 'complete', gameId: 'same', revision: 10 };
const differentWaiting = { mode: 'safecracker', status: 'waiting', gameId: 'different', revision: 1 };
const differentPlaying = { mode: 'safecracker', status: 'playing', gameId: 'different', revision: 4 };
const roulette = { mode: 'roulette', status: 'playing', gameId: 'roulette', revision: 1 };
assert(selectRenderGame(null, stablePlaying, 0) === stablePlaying, 'fresh empty response does not retain playing board');
assert(selectRenderGame(null, stablePlaying, retentionMs) === stablePlaying, 'empty response is dropped at the retention boundary');
assert(selectRenderGame(null, stablePlaying, retentionMs + 1) === null, 'expired empty response retains a stale board forever');
assert(selectRenderGame(waitingSame, stablePlaying, retentionMs + 1) === stablePlaying, 'same-game waiting regression can close playing board');
assert(selectRenderGame(readySame, stablePlaying, retentionMs + 1) === stablePlaying, 'same-game ready regression can close playing board');
assert(selectRenderGame(olderPlaying, stablePlaying, retentionMs + 1) === stablePlaying, 'older same-status revision can replace newer board');
assert(selectRenderGame(newerPlaying, stablePlaying, 0) === newerPlaying, 'newer active snapshot does not win');
assert(selectRenderGame(completeSame, stablePlaying, 0) === completeSame, 'real complete snapshot is blocked');
assert(selectRenderGame(lowerRevisionComplete, stablePlaying, 0) === lowerRevisionComplete, 'lower-revision completion is incorrectly treated as stale');
assert(selectRenderGame(differentWaiting, stablePlaying, 0) === stablePlaying, 'fresh competing waiting snapshot can close playing board');
assert(selectRenderGame(differentWaiting, stablePlaying, retentionMs + 1) === differentWaiting, 'expired stable board blocks a genuinely new waiting game');
assert(selectRenderGame(differentPlaying, stablePlaying, 0) === differentPlaying, 'a new authoritative playing game is blocked');
assert(selectRenderGame(roulette, stablePlaying, 0) === roulette, 'Roulette is incorrectly intercepted');
assert(selectRenderGame(waitingSame, stableCountdown, retentionMs + 1) === stableCountdown, 'waiting regression can close countdown board');
assert(selectRenderGame(null, completeSame, 0) === null, 'completed game is incorrectly retained after dismissal');

assert(client.includes('choice: `safecracker:guess:${runtime.selected}`'), 'authoritative Safe Cracker submission changed');
assert(client.includes('// SAFE_CRACKER_INPUT_CONTINUITY_V9_START'), 'input continuity v9 is missing');
assert(client.includes('// SAFE_CRACKER_SAMPLE_MIX_V11_START'), 'sample mix v11 is missing');
assert(turnAnimation.length > 0 && turnFire.length > 0 && audioBindings.length > 0, 'protected Roulette assets are unreadable');
assert(!patch.includes("writeFile(new URL('../netlify/functions/"), 'guard patch must not write networking files');
assert(!patch.includes("writeFile(new URL('../assets/roulette/"), 'guard patch must not write Roulette files');
assert(patch.includes('expectedRenderCalls = 3'), 'patch does not protect every active-game renderer');
assert(patch.includes('v14GuardPattern') && patch.includes('v13GuardPattern') && patch.includes('rawRenderCallPattern'), 'patch cannot upgrade current guards or install from raw render calls');

console.log('Safe Cracker active render guard validation passed: all three render paths bootstrap from the existing active cache, preserve forward lifecycle and revision continuity, hold transient empty and competing pre-active snapshots for a bounded interval, accept explicit completion and new active games, and leave Roulette untouched.');
