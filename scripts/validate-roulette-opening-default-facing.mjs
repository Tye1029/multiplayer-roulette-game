import { readFile } from 'node:fs/promises';

const guard = await readFile(new URL('../assets/roulette/turn-facing-guard.js', import.meta.url), 'utf8');
const injector = await readFile(new URL('./inject-lamp-assets.mjs', import.meta.url), 'utf8');

for (const required of [
  "if (game.status === 'complete')",
  'if (openingIsActive(root, lock)) return;',
  "const defaultTurnId = String(game?.creator?.userId || turnId);",
  "snapFacing(game, defaultTurnId, 'pre-opening-default-left'",
  'turn-facing-guard.js?v=3&lock=5&owner=3&opening=1'
]) {
  const source = required.includes('turn-facing-guard.js?') ? injector : guard;
  if (!source.includes(required)) throw new Error(`Opening default-facing validation is missing ${required}`);
}

const nonPlayingStart = guard.indexOf("    if (game.status !== 'playing') {");
const playingStart = guard.indexOf("    if (openingIsActive(root, lock)) return;", nonPlayingStart + 1);
if (nonPlayingStart < 0 || playingStart < 0) throw new Error('Could not locate the non-playing facing branch.');
const branch = guard.slice(nonPlayingStart, playingStart + 48);
if (!branch.includes("game.status === 'complete'")) throw new Error('Completed games no longer keep their final authoritative direction.');
if (!branch.includes('pre-opening-default-left')) throw new Error('Waiting/Ready/Countdown do not use the neutral left-facing direction.');

console.log('Roulette opening-facing validation passed: neutral left before the opening spin, protected spin ownership during countdown, and final direction retained after completion.');
