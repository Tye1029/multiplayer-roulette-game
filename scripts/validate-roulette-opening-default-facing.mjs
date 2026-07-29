import { readFile } from 'node:fs/promises';

const guard = await readFile(new URL('../assets/roulette/turn-facing-guard.js', import.meta.url), 'utf8');
const injector = await readFile(new URL('./inject-lamp-assets.mjs', import.meta.url), 'utf8');

for (const required of [
  "if (game.status === 'complete')",
  'if (openingIsActive(root, lock)) return;',
  "const defaultTurnId = String(game?.creator?.userId || turnId);",
  "snapFacing(game, defaultTurnId, 'pre-opening-default-left'",
  'turn-facing-guard.js?v=4&lock=5&owner=3&opening=1&sound=1'
]) {
  const source = required.includes('turn-facing-guard.js?') ? injector : guard;
  if (!source.includes(required)) throw new Error(`Opening default-facing validation is missing ${required}`);
}

const reconcileStart = guard.indexOf("  async function reconcile(reason = 'poll') {");
const completeLock = guard.indexOf("if (game.status === 'complete')", reconcileStart);
const defaultLeft = guard.indexOf("const defaultTurnId = String(game?.creator?.userId || turnId);", completeLock);
const playingBranch = guard.indexOf("\n\n    if (openingIsActive(root, lock)) return;", defaultLeft);
if (reconcileStart < 0 || completeLock < 0 || defaultLeft < 0 || playingBranch < 0) {
  throw new Error('Could not verify the ordered reconcile branches for final locking, pre-opening left facing, and protected opening-spin ownership.');
}
if (!(reconcileStart < completeLock && completeLock < defaultLeft && defaultLeft < playingBranch)) {
  throw new Error('The opening-facing branches are not in the required order.');
}

console.log('Roulette opening-facing validation passed: neutral left before the opening spin, protected spin ownership during countdown, reliable turn sound cache version, and final direction retained after completion.');