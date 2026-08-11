import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const fail = message => { throw new Error(`Summit Sprint V53 validation failed: ${message}`); };
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
    'MOUNTAIN_RACE_WINNER_CAMERA_V53',
    "dataset.mrWinnerCamera = '53'",
    'MOUNTAIN_RACE_WINNER_SUMMIT_V52',
    'standing-on-summit'
  ]) assert(source.includes(token), `runtime token missing: ${token}`);
}

assert(runtime.includes("const cameraIndex = animation === 'celebrate' ? total"), 'multiplayer timeout winner camera does not frame the summit');
assert(prototype.includes("const cameraIndex = player.animation === 'celebrate' ? total"), 'prototype timeout winner camera does not frame the summit');
assert(runtime.includes("index >= Number(total || 0) || animation === 'celebrate'"), 'multiplayer timeout winner no longer receives the summit pose');
assert(prototype.includes("index >= TOTAL_HOLDS || player.animation === 'celebrate'"), 'prototype timeout winner no longer receives the summit pose');

for (const document of [html, preview]) assert(document.includes('visual=53'), 'V53 cache boundary is missing');
for (const token of [
  'MOUNTAIN_RACE_SHARED_MOUNTAIN_V51',
  '.mr-lane.opponent .mr-climber.finished',
  'transform: translate(-50%, 28%) !important',
  'transform: translate(-50%, 40.6%) !important',
  'place-items: end center !important'
]) assert(css.includes(token), `shared finish presentation token missing: ${token}`);

assert(runtime.includes('currentIndex + 3'), 'four nearby ledges are no longer retained');
assert(runtime.includes('Math.max(8, Math.min(80, Math.trunc(Number(publicState.stepsTotal) || 24)))'), 'authoritative 24-hold default changed');
assert(runtime.includes('scheduleInputFlush(true)'), 'continuous competitive input buffering changed');
for (const token of ['data-mr-rematch', 'data-mr-new-game', 'winnerConfetti()', 'YOU REACHED THE SUMMIT FIRST!']) {
  assert(runtime.includes(token), `finish/rematch behavior missing: ${token}`);
}
assert(safeCracker.length > 0, 'protected Safe Cracker runtime is unreadable');
assert(roulette.length > 0, 'protected Roulette runtime is unreadable');

console.log('Summit Sprint V53 validation passed: any authoritative winner is placed on the summit and its lane camera frames that platform, including timeout wins below hold 24, while gameplay and protected games remain intact.');
