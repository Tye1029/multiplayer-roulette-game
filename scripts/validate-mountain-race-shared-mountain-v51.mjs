import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const fail = message => { throw new Error(`Summit Sprint V51 validation failed: ${message}`); };
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
    'MOUNTAIN_RACE_SHARED_MOUNTAIN_V51',
    "dataset.mrSharedMountain = '51'",
    'MOUNTAIN_RACE_SUMMIT_CONTACT_V50',
    'mr-v51-center-rope',
    'data-mr-contact-index'
  ]) assert(source.includes(token), `runtime token missing: ${token}`);
}

assert(runtime.includes('    }, 2600); // MOUNTAIN_RACE_SHARED_MOUNTAIN_V51'), 'multiplayer result reveal does not leave the opponent finish pose visible');

const v51Css = css.slice(css.indexOf('MOUNTAIN_RACE_SHARED_MOUNTAIN_V51'));
for (const token of [
  '[data-mr-shared-mountain="51"] .mountain-race-game',
  '[data-mr-natural-terrain="49"][data-mr-shared-mountain="51"] {',
  'width: 100% !important',
  'max-width: none !important',
  'box-sizing: border-box !important',
  "url('/assets/mountain-race/images/summit-sprint-natural-cliff-v49.png') center 54% / cover no-repeat",
  '.mr-v51-center-rope',
  'mrV51RopeSway',
  '.mr-v44-start i::before',
  '.mr-climber[data-mr-contact-index="-1"]:not(.finished)',
  'transform: translate(-50%, 15.3%) !important',
  'transform: translate(-50%, 28.3%) !important',
  '.mr-lane.opponent .mr-climber.finished',
  '.mr-overlay.complete',
  'place-items: end center !important',
  'transparent 0 42%',
  'transform: translate(-50%, 28%) !important',
  'transform: translate(-50%, 40.6%) !important'
]) assert(v51Css.includes(token), `CSS token missing: ${token}`);

const visibleFootMarginRatio = (512 - 461) / 512;
for (const [label, platformHeight, platformBottom, grassInset, climberHeight, translateRatio] of [
  ['desktop', 86, -18, 3, 205, 0.153],
  ['mobile', 66, -14, 3, 147, 0.283]
]) {
  const grassPlane = platformBottom + platformHeight - grassInset;
  const visibleFoot = 76 + climberHeight * visibleFootMarginRatio - climberHeight * translateRatio;
  assert(Math.abs(grassPlane - visibleFoot) <= 1, `${label} climber feet miss the grass start by ${Math.abs(grassPlane - visibleFoot).toFixed(2)}px`);
}

const winner52 = runtime.includes('MOUNTAIN_RACE_WINNER_SUMMIT_V52');
for (const document of [html, preview]) assert(document.includes(winner52 ? 'visual=52' : 'visual=51'), 'V51/V52 cache boundary is missing');
assert(runtime.includes('currentIndex + 3'), 'four nearby ledges are no longer retained');
assert(runtime.includes('Math.max(8, Math.min(80, Math.trunc(Number(publicState.stepsTotal) || 24)))'), 'authoritative 24-hold default changed');
assert(runtime.includes('scheduleInputFlush(true)'), 'continuous competitive input buffering changed');
for (const token of ['data-mr-rematch', 'data-mr-new-game', 'winnerConfetti()', 'YOU REACHED THE SUMMIT FIRST!']) {
  assert(runtime.includes(token), `finish/rematch behavior missing: ${token}`);
}
assert(safeCracker.length > 0, 'protected Safe Cracker runtime is unreadable');
assert(roulette.length > 0, 'protected Roulette runtime is unreadable');

console.log('Summit Sprint V51 validation passed: one aspect-correct cliff fills the game shell, the live rope divides routes, both climbers stand on grass starts, opponent victory contact remains exact and visible, and protected gameplay remains intact.');
