import { readFile, writeFile } from 'node:fs/promises';

const guardUrl = new URL('../assets/roulette/turn-facing-guard.js', import.meta.url);
let guard = await readFile(guardUrl, 'utf8');

const before = `    if (game.status !== 'playing') {
      if (state.pendingTransition || state.activeTransition || lock.pendingTurnId) {
        cancelTransition(\`status-\${String(game.status || 'unknown')}\`, game, turnId);
      }
      snapFacing(game, turnId, 'non-playing-final-lock', !lockMatches(gameId, turnId, angleForTurn(game, turnId)));
      return;
    }`;

const after = `    if (game.status !== 'playing') {
      if (state.pendingTransition || state.activeTransition || lock.pendingTurnId) {
        cancelTransition(\`status-\${String(game.status || 'unknown')}\`, game, turnId);
      }
      if (game.status === 'complete') {
        snapFacing(game, turnId, 'non-playing-final-lock', !lockMatches(gameId, turnId, angleForTurn(game, turnId)));
        return;
      }
      // Waiting, Ready, and Countdown always display the neutral left-facing gun.
      // Once the real opening spin begins, its protected animation owns the facing
      // until it settles on the server-selected first player.
      if (openingIsActive(root, lock)) return;
      const defaultTurnId = String(game?.creator?.userId || turnId);
      const defaultAngle = angleForTurn(game, defaultTurnId);
      snapFacing(game, defaultTurnId, 'pre-opening-default-left', !lockMatches(gameId, defaultTurnId, defaultAngle));
      return;
    }`;

if (!guard.includes(after)) {
  const first = guard.indexOf(before);
  if (first < 0) throw new Error('Opening default-facing patch could not find the non-playing facing branch.');
  if (guard.indexOf(before, first + before.length) >= 0) throw new Error('Opening default-facing patch found the branch more than once.');
  guard = guard.slice(0, first) + after + guard.slice(first + before.length);
}

for (const required of [
  "game.status === 'complete'",
  'if (openingIsActive(root, lock)) return;',
  "const defaultTurnId = String(game?.creator?.userId || turnId);",
  "'pre-opening-default-left'"
]) if (!guard.includes(required)) throw new Error(`Final opening facing guard is missing ${required}`);

await writeFile(guardUrl, guard);
console.log('Patched Roulette opening facing: waiting, ready, and countdown stay left until the protected opening spin begins.');
