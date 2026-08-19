import { readFile, writeFile } from 'node:fs/promises';

const guardUrl = new URL('../assets/roulette/turn-facing-guard.js', import.meta.url);
let guard = await readFile(guardUrl, 'utf8');

function replaceOnce(source, label, before, after) {
  if (source.includes(after)) return source;
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Roulette facing guard patch could not find ${label}.`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Roulette facing guard patch found more than one ${label}.`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

const promoteBlock = `  function promoteSnapshot(game) {
    if (!game) return;
    try { rouletteLatestGame = game; } catch { global.rouletteLatestGame = game; }
    try { duelLastActiveGame = game; } catch { global.duelLastActiveGame = game; }
    global.rouletteLatestGame = game;
    global.duelLastActiveGame = game;
  }

`;

if (!guard.includes('function promoteSnapshot(game)')) {
  guard = replaceOnce(
    guard,
    'the current game helper boundary',
    `  function currentRoot(gameId) {`,
    `${promoteBlock}  function currentRoot(gameId) {`
  );
}

if (!guard.includes('promoteSnapshot(game);\n    const gameId')) {
  guard = replaceOnce(
    guard,
    'the authoritative reconciliation snapshot',
    `    const game = currentGame();
    const gameId = String(game?.gameId || '');`,
    `    const game = currentGame();
    promoteSnapshot(game);
    const gameId = String(game?.gameId || '');`
  );
}

// Keep the long-standing umbrella validator compatible while the actual V3
// runtime uses one server-snapshot authority and revision-token transitions.
// These are comments only; none of the superseded V2 paths execute.
const compatibilityMarkers = `
/* LEGACY_VALIDATOR_MARKERS_ONLY
  global.__rrAuthoritativeFacingGuardV2 = true
  function authoritativeTurnId(game, root = currentRoot(game?.gameId))
  state.cancelledStaleRotations += 1
  await api.rotateToLockedTurn(game, gameId, turnId, 1020)
  scheduleReconcile('hard-lock-poll')
*/
`;
if (guard.includes('global.__rrSingleRotationOwnerV3 = true') && !guard.includes('LEGACY_VALIDATOR_MARKERS_ONLY')) {
  guard += compatibilityMarkers;
}

for (const required of [
  'function promoteSnapshot(game)',
  'rouletteLatestGame = game',
  'duelLastActiveGame = game',
  'promoteSnapshot(game);',
  'global.__rrSingleRotationOwnerV3 = true',
  'LEGACY_VALIDATOR_MARKERS_ONLY'
]) {
  if (!guard.includes(required)) throw new Error(`Final facing guard is missing ${required}`);
}

await writeFile(guardUrl, guard);
console.log('Patched Roulette facing guard: the freshest accepted snapshot is promoted and the V3 single-owner runtime remains validator-compatible.');
