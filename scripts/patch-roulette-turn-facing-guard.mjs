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

guard = replaceOnce(
  guard,
  'the authoritative reconciliation snapshot',
  `    const game = currentGame();
    const gameId = String(game?.gameId || '');`,
  `    const game = currentGame();
    promoteSnapshot(game);
    const gameId = String(game?.gameId || '');`
);

for (const required of [
  'function promoteSnapshot(game)',
  'rouletteLatestGame = game',
  'duelLastActiveGame = game',
  'promoteSnapshot(game);'
]) {
  if (!guard.includes(required)) throw new Error(`Final facing guard is missing ${required}`);
}

await writeFile(guardUrl, guard);
console.log('Patched Roulette facing guard: the freshest accepted snapshot is promoted before the protected animator reads it.');
