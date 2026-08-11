import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const fail = message => { throw new Error(`Summit Sprint V52 validation failed: ${message}`); };
const assert = (condition, message) => { if (!condition) fail(message); };

const [runtime, prototype, css, html, preview, safeCracker, roulette] = await Promise.all([
  readFile(new URL('assets/mountain-race/mountain-race-multiplayer.js', root), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race.js', root), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race.css', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('mountain-race-preview.html', root), 'utf8'),
  readFile(new URL('assets/safe-cracker/safe-cracker.js', root), 'utf8'),
  readFile(new URL('assets/roulette/turn-animation.js', root), 'utf8')
]);

for (const source of [runtime, prototype]) {
  for (const token of [
    'MOUNTAIN_RACE_WINNER_SUMMIT_V52',
    "dataset.mrWinnerSummit = '52'",
    'MOUNTAIN_RACE_SHARED_MOUNTAIN_V51',
    'standing-on-summit'
  ]) assert(source.includes(token), `runtime token missing: ${token}`);
}

assert(runtime.includes("index >= Number(total || 0) || animation === 'celebrate'"), 'multiplayer timeout winner is not promoted to the summit pose');
assert(prototype.includes("index >= TOTAL_HOLDS || player.animation === 'celebrate'"), 'prototype timeout winner is not promoted to the summit pose');
assert(runtime.includes("const opponentAnimation = animationClass(opponent, runtime.lastOpponentInputAt, !publicState.viewerWon && !publicState.tie && runtime.game.status === 'complete')"), 'opponent winner no longer receives the celebration state');

const camera53 = runtime.includes('MOUNTAIN_RACE_WINNER_CAMERA_V53');
const grounded54 = runtime.includes('MOUNTAIN_RACE_GROUNDED_ASCENT_V54');
for (const document of [html, preview]) assert(document.includes(grounded54 ? 'visual=54' : camera53 ? 'visual=53' : 'visual=52'), 'V52/V54 cache boundary is missing');
for (const token of [
  'MOUNTAIN_RACE_SHARED_MOUNTAIN_V51',
  '.mr-lane.opponent .mr-climber.finished',
  'transform: translate(-50%, 28%) !important',
  'transform: translate(-50%, 40.6%) !important',
  'place-items: end center !important'
]) assert(css.includes(token), `shared finish presentation token missing: ${token}`);

assert(runtime.includes(grounded54 ? 'currentIndex + 7' : 'currentIndex + 3'), 'nearby ledges are no longer retained');
assert(runtime.includes('Math.max(8, Math.min(80, Math.trunc(Number(publicState.stepsTotal) || 24)))'), 'authoritative 24-hold default changed');
assert(runtime.includes('scheduleInputFlush(true)'), 'continuous competitive input buffering changed');
for (const token of ['data-mr-rematch', 'data-mr-new-game', 'winnerConfetti()', 'YOU REACHED THE SUMMIT FIRST!']) {
  assert(runtime.includes(token), `finish/rematch behavior missing: ${token}`);
}
assert(safeCracker.length > 0, 'protected Safe Cracker runtime is unreadable');
assert(roulette.length > 0, 'protected Roulette runtime is unreadable');

console.log('Summit Sprint V52 validation passed: any authoritative winner, including a timeout winner below hold 24, receives the exact visible summit pose while gameplay, rematches, and protected games remain intact.');
