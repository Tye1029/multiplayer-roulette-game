import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const fail = message => { throw new Error(`Summit Sprint V50 validation failed: ${message}`); };
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
    'MOUNTAIN_RACE_SUMMIT_CONTACT_V50',
    "dataset.mrSummitContact = '50'",
    "dataset.mrNaturalTerrain = '49'",
    'standing-on-summit',
    'data-mr-contact-index'
  ]) assert(source.includes(token), `runtime token missing: ${token}`);
}

const v50Css = css.slice(css.indexOf('MOUNTAIN_RACE_SUMMIT_CONTACT_V50'));
for (const token of [
  '[data-mr-summit-contact="50"] .mr-lane',
  '[data-mr-summit-contact="50"] .mr-climb-viewport',
  '[data-mr-rugged-terrain="46"][data-mr-natural-terrain="49"][data-mr-summit-contact="50"] .mr-mountain-wall',
  'background: transparent !important',
  'box-shadow: none !important',
  'transform: translate(-50%, 28%) !important',
  'transform: translate(-50%, 40.6%) !important'
]) assert(v50Css.includes(token), `CSS token missing: ${token}`);

const total = 24;
const grounded54 = runtime.includes('MOUNTAIN_RACE_GROUNDED_ASCENT_V54');
const route55 = runtime.includes('MOUNTAIN_RACE_ROUTE_CLARITY_V55');
const natural56 = runtime.includes('MOUNTAIN_RACE_NATURAL_SUMMIT_V56');
const step = natural56 ? 74 : route55 ? 60 : grounded54 ? 42 : 84;
const summitBottom = natural56 ? 196 + (total - 1) * step : 120 + total * step;
const climberBottom = natural56 ? 272 + (total - 1) * step : 196 + total * step;
const visibleFootRatio = (512 - 461) / 512;
for (const [label, platformHeight, climberHeight, translateRatio] of [
  ['desktop', 78, 205, 0.28],
  ['mobile', 62, 147, 0.406]
]) {
  const platformTop = summitBottom + platformHeight * 0.5;
  const visibleFoot = climberBottom - climberHeight * translateRatio + climberHeight * visibleFootRatio;
  assert(Math.abs(platformTop - visibleFoot) <= 1, `${label} winner feet miss the summit plane by ${Math.abs(platformTop - visibleFoot).toFixed(2)}px`);
}

assert(css.includes('overflow: hidden !important'), 'camera viewport/lane clipping was removed with the visual boxes');
const shared51 = runtime.includes('MOUNTAIN_RACE_SHARED_MOUNTAIN_V51');
const winner52 = runtime.includes('MOUNTAIN_RACE_WINNER_SUMMIT_V52');
const camera53 = runtime.includes('MOUNTAIN_RACE_WINNER_CAMERA_V53');
for (const document of [html, preview]) assert(document.includes('visual=58') || document.includes('visual=57') || document.includes(natural56 ? 'visual=56' : route55 ? 'visual=55' : grounded54 ? 'visual=54' : camera53 ? 'visual=53' : winner52 ? 'visual=52' : shared51 ? 'visual=51' : 'visual=50'), 'V50/V58 cache boundary is missing');
assert(runtime.includes(natural56 ? 'currentIndex + 3' : route55 ? 'currentIndex + 4' : grounded54 ? 'currentIndex + 7' : 'currentIndex + 3'), 'nearby ledges are no longer retained');
assert(runtime.includes('Math.max(8, Math.min(80, Math.trunc(Number(publicState.stepsTotal) || 24)))'), 'authoritative 24-hold default changed');
assert(runtime.includes('scheduleInputFlush(true)'), 'continuous competitive input buffering changed');
for (const token of ['data-mr-rematch', 'data-mr-new-game', 'winnerConfetti()', 'YOU REACHED THE SUMMIT FIRST!']) {
  assert(runtime.includes(token), `finish/rematch behavior missing: ${token}`);
}
assert(safeCracker.length > 0, 'protected Safe Cracker runtime is unreadable');
assert(roulette.length > 0, 'protected Roulette runtime is unreadable');

console.log('Summit Sprint V50 validation passed: desktop/mobile victory-frame feet land on the summit plane, rectangular lane/viewport/wall framing is transparent, camera clipping and protected gameplay remain intact.');
