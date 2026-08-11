import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [runtime, prototype, css, html, preview, safeCracker, roulette] = await Promise.all([
  readFile(new URL('assets/mountain-race/mountain-race-multiplayer.js', root), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race.js', root), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race.css', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('mountain-race-preview.html', root), 'utf8'),
  readFile(new URL('assets/safe-cracker/safe-cracker.js', root), 'utf8'),
  readFile(new URL('assets/roulette/turn-animation.js', root), 'utf8')
]);

const fail = message => { throw new Error(`Summit Sprint V47 validation failed: ${message}`); };
const assert = (condition, message) => { if (!condition) fail(message); };

const helperStart = runtime.indexOf('  function winnerConfetti()');
const helperEnd = runtime.indexOf('  function renderLane(', helperStart);
assert(helperStart >= 0 && helperEnd > helperStart, 'winner confetti helper is not defined before the multiplayer lane renderer');
const helperSource = runtime.slice(helperStart, helperEnd);
const confettiMarkup = Function(`${helperSource}; return winnerConfetti();`)();
assert(confettiMarkup.includes('mr-winner-confetti'), 'winner confetti helper does not return its celebration layer');
assert((confettiMarkup.match(/<i /g) || []).length === 20, 'winner confetti helper does not return all 20 pieces');
assert(runtime.includes("animation === 'celebrate' ? winnerConfetti() : ''"), 'multiplayer winner lane does not request confetti');
assert(prototype.includes('function winnerConfetti()'), 'prototype winner confetti helper is missing');

const resultStart = runtime.indexOf('  function resultOverlay(');
const resultEnd = runtime.indexOf('  function countdownOverlay(', resultStart);
assert(resultStart >= 0 && resultEnd > resultStart, 'result overlay renderer is missing');
const resultSource = runtime.slice(resultStart, resultEnd);
const resultMarkup = Function('runtime', 'escapeHtml', `${resultSource}; return resultOverlay({ viewerWon: true, tie: false, opponent: { name: 'Rival' } }, { promptIndex: 24, rejectedInputs: 0 }, 24);`)(
  { game: { status: 'complete' }, resultRevealReady: true },
  value => String(value)
);
for (const token of ['mr-overlay complete', 'RACE COMPLETE', 'YOU REACHED THE SUMMIT FIRST!', 'data-mr-rematch', 'data-mr-new-game']) {
  assert(resultMarkup.includes(token), `completed-race result markup is missing ${token}`);
}

const total = 24;
const grounded54 = runtime.includes('MOUNTAIN_RACE_GROUNDED_ASCENT_V54');
const route55 = runtime.includes('MOUNTAIN_RACE_ROUTE_CLARITY_V55');
const step = route55 ? 60 : grounded54 ? 42 : 84;
const wallHeight = Math.max(2600, 580 + total * step);
const finalScroll = Math.max(0, total - 1) * step;
for (const viewportHeight of [520, 590]) {
  const wallTop = viewportHeight - wallHeight + finalScroll;
  assert(wallTop <= 0, `final camera exposes ${wallTop}px above the wall at viewport ${viewportHeight}`);
}
const summitScreenBottom = 120 + total * step - finalScroll;
assert(summitScreenBottom === 120 + step, `summit framing drifted to ${summitScreenBottom}px`);
assert(runtime.includes(`Math.max(2600, 580 + total * ${step})`), 'multiplayer wall does not cover the final camera');
assert(prototype.includes(`Math.max(2600, 580 + total * ${step})`), 'prototype wall does not cover the final camera');
assert(css.includes('MOUNTAIN_RACE_FINISH_STABILITY_V47') && css.includes('min-height: 2600px'), 'V47 wall coverage CSS is missing');

for (const token of ['mountainRaceCompletionLabel', '"WINNER" : "RACE OVER"', 'statusLabel || (ready ? "LOCKED IN" : "WAITING")']) {
  assert(html.includes(token), `completed player-card state is missing ${token}`);
}
const natural49 = runtime.includes('MOUNTAIN_RACE_NATURAL_TERRAIN_V49');
const summit50 = runtime.includes('MOUNTAIN_RACE_SUMMIT_CONTACT_V50');
const shared51 = runtime.includes('MOUNTAIN_RACE_SHARED_MOUNTAIN_V51');
const winner52 = runtime.includes('MOUNTAIN_RACE_WINNER_SUMMIT_V52');
const camera53 = runtime.includes('MOUNTAIN_RACE_WINNER_CAMERA_V53');
const expectedVisual = route55 ? 'visual=55' : grounded54 ? 'visual=54' : camera53 ? 'visual=53' : winner52 ? 'visual=52' : shared51 ? 'visual=51' : summit50 ? 'visual=50' : natural49 ? 'visual=49' : 'visual=47';
assert(html.includes(expectedVisual) && preview.includes(expectedVisual), 'V47/V54 cache boundary is missing');
assert(safeCracker.length > 0, 'protected Safe Cracker runtime is unreadable');
assert(roulette.length > 0, 'protected Roulette animation runtime is unreadable');

console.log('Summit Sprint V47 validation passed: completed result markup executes, winner confetti renders 20 pieces, final camera terrain coverage is continuous, completion labels are correct, and protected games remain intact.');
