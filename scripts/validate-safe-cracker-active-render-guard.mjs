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

const start = '// SAFE_CRACKER_ACTIVE_RENDER_GUARD_V16_START';
const end = '// SAFE_CRACKER_ACTIVE_RENDER_GUARD_V16_END';
const refreshStart = '// SAFE_CRACKER_REFRESH_SELECTOR_V16_START';
const refreshEnd = '// SAFE_CRACKER_REFRESH_SELECTOR_V16_END';
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
    sameGame && !incomingIsComplete && Number.isFinite(incomingRevision) &&
    Number.isFinite(stableRevision) && incomingRevision < stableRevision
  );
  const lifecycleRegressed = Boolean(
    incomingIsSafeCracker && stableIsActive && sameGame && !incomingIsComplete &&
    (statusRank[incoming.status] ?? -1) < (statusRank[stable.status] ?? -1)
  );
  const transientEmpty = !incoming && stableIsActive && stableAge <= retentionMs;
  const differentPreActive = Boolean(
    incomingIsSafeCracker && stableIsActive && !sameGame &&
    preActiveStatuses.includes(incoming.status) && stableAge <= retentionMs
  );
  return transientEmpty || lifecycleRegressed || revisionRegressed || differentPreActive ? stable : incoming;
}
function selectRefreshGame(incoming, stable) {
  const rank = { waiting: 0, ready: 1, countdown: 2, playing: 3, complete: 4, cancelled: 4 };
  const stableIsActive = stable?.mode === 'safecracker' && ['ready', 'countdown', 'playing'].includes(stable.status);
  if (!stableIsActive) return incoming;
  const sameGame = Boolean(
    incoming?.mode === 'safecracker' && String(incoming.gameId || '') === String(stable.gameId || '')
  );
  const incomingComplete = sameGame && incoming.status === 'complete';
  const incomingRevision = Number(incoming?.revision);
  const stableRevision = Number(stable?.revision);
  const incomingStateRevision = Number(incoming?.state?.revision ?? incoming?.safeCrackerState?.revision);
  const stableStateRevision = Number(stable?.state?.revision ?? stable?.safeCrackerState?.revision);
  const lifecycleRegressed = sameGame && !incomingComplete &&
    (rank[incoming?.status] ?? -1) < (rank[stable.status] ?? -1);
  const gameRevisionRegressed = sameGame && !incomingComplete &&
    Number.isFinite(incomingRevision) && Number.isFinite(stableRevision) && incomingRevision < stableRevision;
  const stateRevisionRegressed = sameGame && !incomingComplete &&
    Number.isFinite(incomingStateRevision) && Number.isFinite(stableStateRevision) &&
    incomingStateRevision < stableStateRevision;
  return !incoming || lifecycleRegressed || gameRevisionRegressed || stateRevisionRegressed ? stable : incoming;
}

assert(occurrences(html, start) === expectedGuards, `direct guard start marker must appear ${expectedGuards} times`);
assert(occurrences(html, end) === expectedGuards, `direct guard end marker must appear ${expectedGuards} times`);
assert(occurrences(html, refreshStart) === 2, 'refresh selector must wrap both capture and adoption points');
assert(occurrences(html, refreshEnd) === 2, 'refresh selector end marker count changed');
for (const version of [13, 14, 15]) {
  assert(!html.includes(`SAFE_CRACKER_ACTIVE_RENDER_GUARD_V${version}_START`), `legacy v${version} guard remains`);
}
const guardBlocks = html.match(/\/\/ SAFE_CRACKER_ACTIVE_RENDER_GUARD_V16_START[\s\S]*?\/\/ SAFE_CRACKER_ACTIVE_RENDER_GUARD_V16_END/g) || [];
assert(guardBlocks.length === expectedGuards, `expected ${expectedGuards} complete direct guard blocks`);
for (const guard of guardBlocks) {
  assert(guard.includes("['ready', 'countdown', 'playing']"), 'active lifecycle allowlist changed');
  assert(guard.includes("['waiting', 'ready', 'countdown']"), 'pre-active lifecycle allowlist is missing');
  assert(guard.includes('window.__safeCrackerStableActiveGame'), 'independent stable-game cache is missing');
  assert(guard.includes("typeof duelLastActiveGame !== 'undefined'"), 'existing active cache does not bootstrap direct guards');
  assert(guard.includes('safeCrackerRetentionMs = 30000'), 'bounded direct-response retention is missing');
  assert(guard.includes('safeCrackerLifecycleRegressed'), 'direct backward lifecycle detection is missing');
  assert(guard.includes('safeCrackerRevisionRegressed'), 'direct stale revision detection is missing');
  assert(guard.includes('safeCrackerDifferentPreActive'), 'direct competing pre-active protection is missing');
  assert(guard.includes('!safeCrackerIncomingIsComplete'), 'direct completion boundary is missing');
}
assert(occurrences(html, 'return duelRenderActive(safeCrackerActiveRenderGame, true);') === expectedGuards, 'guarded direct render calls are missing');
assert((html.match(/duelRenderActive\(data\.game,\s*true\);/g) || []).length === 0, 'an unguarded direct active-game render remains');

const refreshCaptureIndex = html.indexOf('const safeCrackerRefreshStable =');
const focusedGetIndex = html.indexOf('const got = await duelRequest("get"', refreshCaptureIndex);
const refreshAdoptionIndex = html.indexOf('const safeCrackerRefreshIncoming = active || null;', focusedGetIndex);
const lastActiveAdoptionIndex = html.indexOf('if (active) duelLastActiveGame = active;', refreshAdoptionIndex);
const renderRefreshIndex = html.indexOf('duelRenderActive(active);', lastActiveAdoptionIndex);
assert(refreshCaptureIndex >= 0, 'stable refresh snapshot is not captured');
assert(focusedGetIndex > refreshCaptureIndex, 'stable snapshot is captured after the focused request');
assert(refreshAdoptionIndex > focusedGetIndex, 'refresh selector does not inspect the selected incoming snapshot');
assert(lastActiveAdoptionIndex > refreshAdoptionIndex, 'regressed snapshot can overwrite duelLastActiveGame before selection');
assert(renderRefreshIndex > lastActiveAdoptionIndex, 'refresh selector does not run before the lobby/active renderer');
const refreshBlock = html.slice(refreshAdoptionIndex, lastActiveAdoptionIndex);
assert(refreshBlock.includes('safeCrackerRefreshMissing'), 'missing focused snapshots are not retained');
assert(refreshBlock.includes('safeCrackerRefreshLifecycleRegressed'), 'refresh lifecycle regression check is missing');
assert(refreshBlock.includes('safeCrackerRefreshGameRevisionRegressed'), 'refresh game revision check is missing');
assert(refreshBlock.includes('safeCrackerRefreshStateRevisionRegressed'), 'Safe Cracker state revision check is missing');
assert(refreshBlock.includes('active = safeCrackerRefreshStable'), 'refresh selector does not restore the live board');
assert(refreshBlock.includes('window.__safeCrackerRefreshSelectorRecoveries'), 'refresh recovery diagnostics are missing');

const stablePlaying = { mode: 'safecracker', status: 'playing', gameId: 'same', revision: 12, state: { revision: 9 } };
const stableCountdown = { mode: 'safecracker', status: 'countdown', gameId: 'same', revision: 8, state: { revision: 3 } };
const waitingSame = { mode: 'safecracker', status: 'waiting', gameId: 'same', revision: 13, state: { revision: 10 } };
const readySame = { mode: 'safecracker', status: 'ready', gameId: 'same', revision: 13, state: { revision: 10 } };
const olderPlaying = { mode: 'safecracker', status: 'playing', gameId: 'same', revision: 11, state: { revision: 8 } };
const newerPlaying = { mode: 'safecracker', status: 'playing', gameId: 'same', revision: 14, state: { revision: 10 } };
const staleStatePlaying = { mode: 'safecracker', status: 'playing', gameId: 'same', revision: 14, state: { revision: 7 } };
const completeSame = { mode: 'safecracker', status: 'complete', gameId: 'same', revision: 15, state: { revision: 10 } };
const differentWaiting = { mode: 'safecracker', status: 'waiting', gameId: 'different', revision: 1 };
const differentPlaying = { mode: 'safecracker', status: 'playing', gameId: 'different', revision: 4 };
const roulette = { mode: 'roulette', status: 'playing', gameId: 'roulette', revision: 1 };

assert(selectRenderGame(null, stablePlaying, 0) === stablePlaying, 'direct empty response does not retain live board');
assert(selectRenderGame(waitingSame, stablePlaying, retentionMs + 1) === stablePlaying, 'direct waiting regression can close live board');
assert(selectRenderGame(olderPlaying, stablePlaying, retentionMs + 1) === stablePlaying, 'direct stale revision can replace live board');
assert(selectRenderGame(completeSame, stablePlaying, 0) === completeSame, 'direct completion is blocked');
assert(selectRenderGame(differentPlaying, stablePlaying, 0) === differentPlaying, 'direct new active game is blocked');
assert(selectRenderGame(roulette, stablePlaying, 0) === roulette, 'Roulette is intercepted by direct guard');

assert(selectRefreshGame(null, stablePlaying) === stablePlaying, 'focused refresh with no game closes live board');
assert(selectRefreshGame(waitingSame, stablePlaying) === stablePlaying, 'focused waiting regression closes live board');
assert(selectRefreshGame(readySame, stablePlaying) === stablePlaying, 'focused ready regression closes live board');
assert(selectRefreshGame(olderPlaying, stablePlaying) === stablePlaying, 'focused older game revision replaces live board');
assert(selectRefreshGame(staleStatePlaying, stablePlaying) === stablePlaying, 'focused stale state revision replaces live board');
assert(selectRefreshGame(newerPlaying, stablePlaying) === newerPlaying, 'newer focused Safe Cracker snapshot does not win');
assert(selectRefreshGame(completeSame, stablePlaying) === completeSame, 'real focused completion is blocked');
assert(selectRefreshGame(differentWaiting, stablePlaying) === differentWaiting, 'different game is incorrectly retained by refresh selector');
assert(selectRefreshGame(roulette, stablePlaying) === roulette, 'Roulette is intercepted by refresh selector');
assert(selectRefreshGame(waitingSame, stableCountdown) === stableCountdown, 'waiting regression closes countdown board');

assert(client.includes('choice: `safecracker:guess:${runtime.selected}`'), 'authoritative Safe Cracker submission changed');
assert(client.includes('// SAFE_CRACKER_INPUT_CONTINUITY_V9_START'), 'input continuity v9 is missing');
assert(client.includes('// SAFE_CRACKER_SAMPLE_MIX_V11_START'), 'sample mix v11 is missing');
assert(turnAnimation.length > 0 && turnFire.length > 0 && audioBindings.length > 0, 'protected Roulette assets are unreadable');
assert(!patch.includes("writeFile(new URL('../netlify/functions/"), 'guard patch must not write networking files');
assert(!patch.includes("writeFile(new URL('../assets/roulette/"), 'guard patch must not write Roulette files');
assert(patch.includes('expectedRenderCalls = 3'), 'patch no longer protects all direct response paths');
assert(patch.includes('refreshCaptureNeedle') && patch.includes('refreshApplyNeedle'), 'patch cannot install the pre-lobby refresh selector');

console.log('Safe Cracker active render guard validation passed: direct responses and the focused refresh state selector both preserve active Safe Cracker boards through missing, stale-state, stale-revision and backward lifecycle snapshots before the lobby/render decision, while completion, different games and Roulette remain unaffected.');
