import { readFile, writeFile } from 'node:fs/promises';

const guardUrl = new URL('../assets/roulette/turn-facing-guard.js', import.meta.url);
let guard = await readFile(guardUrl, 'utf8');

const before = `    if (state.pendingTransition) {
      await runPendingTransition();
      return;
    }

    const targetAngle = angleForTurn(game, turnId);`;

const after = `    if (state.pendingTransition) {
      await runPendingTransition();
      return;
    }

    if (state.activeTransition) {
      const active = state.activeTransition;
      const activeStillAuthoritative = (
        active.gameId === gameId &&
        active.turnId === turnId &&
        game.status === 'playing' &&
        Number(game?.rouletteState?.revision ?? -1) >= active.rouletteRevision
      );
      if (!activeStillAuthoritative) {
        cancelTransition('active-transition-no-longer-authoritative', game, turnId);
        return;
      }

      // An approved rotation temporarily leaves the protected lock in its pending
      // state. Polling and DOM mutations must preserve that animation rather than
      // interpreting the pending angle as an unrelated mismatch and snapping to
      // the destination before the movement is visible.
      api.enforceLockedFacing(gameId);
      root.dataset.rouletteAuthoritativeTurnId = turnId;
      root.dataset.rouletteAuthoritativeAngle = String(angleForTurn(game, turnId));
      return;
    }

    const targetAngle = angleForTurn(game, turnId);`;

if (!guard.includes(after)) {
  const first = guard.indexOf(before);
  if (first < 0) throw new Error('Active rotation hold patch could not find the pending-transition boundary.');
  if (guard.indexOf(before, first + before.length) >= 0) {
    throw new Error('Active rotation hold patch found more than one pending-transition boundary.');
  }
  guard = guard.slice(0, first) + after + guard.slice(first + before.length);
}

for (const required of [
  'if (state.activeTransition)',
  "cancelTransition('active-transition-no-longer-authoritative'",
  'An approved rotation temporarily leaves the protected lock in its pending',
  'api.enforceLockedFacing(gameId);'
]) {
  if (!guard.includes(required)) throw new Error(`Active rotation hold is missing ${required}`);
}

await writeFile(guardUrl, guard);
console.log('Patched Roulette so approved rotations remain visible until completion instead of being snapped by the guard poll.');
