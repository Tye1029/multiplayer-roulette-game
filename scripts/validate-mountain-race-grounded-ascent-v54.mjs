import { access, readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const files = {
  runtime: new URL('assets/mountain-race/mountain-race-multiplayer.js', root),
  prototype: new URL('assets/mountain-race/mountain-race.js', root),
  css: new URL('assets/mountain-race/mountain-race.css', root),
  html: new URL('index.html', root),
  asset: new URL('assets/mountain-race/images/summit-sprint-start-grass-v54.png', root)
};

const [runtime, prototype, css, html, preview] = await Promise.all([
  readFile(files.runtime, 'utf8'), readFile(files.prototype, 'utf8'),
  readFile(files.css, 'utf8'), readFile(files.html, 'utf8'),
  readFile(new URL('mountain-race-preview.html', root), 'utf8'), access(files.asset)
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Summit Sprint V54 validation failed: ${message}`);
}

const route55 = runtime.includes('MOUNTAIN_RACE_ROUTE_CLARITY_V55');
const natural56 = runtime.includes('MOUNTAIN_RACE_NATURAL_SUMMIT_V56');

for (const [name, source] of Object.entries({ runtime, prototype })) {
  assert(source.includes('MOUNTAIN_RACE_GROUNDED_ASCENT_V54'), `${name} marker missing`);
  assert(source.includes("root.dataset.mrGroundedAscent = '54'"), `${name} dataset missing`);
  assert(source.includes(natural56 ? 'currentIndex + 3' : route55 ? 'currentIndex + 4' : 'currentIndex + 7') || source.includes(natural56 ? 'player.promptIndex + 3' : route55 ? 'player.promptIndex + 4' : 'player.promptIndex + 7'), `${name} does not expose the balanced upcoming route`);
  assert(source.includes(natural56 ? '* 74' : route55 ? '* 60' : '* 42'), `${name} does not use the expected vertical spacing`);
  assert(source.includes('standing-start'), `${name} start pose class missing`);
  assert(source.includes('ready-next'), `${name} next-grip pose class missing`);
  assert(source.includes('data-mr-contact-index'), `${name} physical contact anchoring changed`);
}
assert(prototype.includes("Math.max(30, base - 10)"), 'prototype left route margin can clip a climber');
assert(prototype.includes("Math.min(70, base + 10)"), 'prototype right route margin can clip a climber');

for (const token of [
  'MOUNTAIN_RACE_GROUNDED_ASCENT_V54',
  'summit-sprint-start-grass-v54.png',
  '.mr-v51-center-rope::after',
  '.mr-climber.standing-start',
  '.mr-climber.ready-next',
  '@keyframes mrV45ReachFrames',
  '76.01%, 100% { --mr-v45-frame-x: 66.667%',
  'background-position: left center',
  'background-position: right center',
  'gap: 0 !important',
  'max-width: none !important'
]) assert(css.includes(token), `CSS token missing: ${token}`);

assert(html.includes(natural56 ? '&visual=56' : route55 ? '&visual=55' : '&visual=54'), 'document cache marker is not current');
assert(html.includes('summit-sprint-start-grass-v54.png'), 'grass start asset is not preloaded');
assert(preview.includes(natural56 ? 'mountain-race.js?prototype=1&visual=56' : route55 ? 'mountain-race.js?prototype=1&visual=55' : 'mountain-race.js?prototype=1&visual=54'), 'prototype runtime cache marker is not current');
assert(runtime.includes('Math.max(8, Math.min(80, Math.trunc(Number(publicState.stepsTotal) || 24)))'), 'authoritative 24-hold server contract changed');
assert(runtime.includes('data-mr-winner-camera="53"') || runtime.includes("root.dataset.mrWinnerCamera = '53'"), 'V53 winner camera was lost');

console.log('Summit Sprint V54 validation passed: one edge-to-edge cliff, anchored full-height rope, grounded grass starts, closer 24-hold spacing, next-grip poses, and V53 finish framing are present.');
