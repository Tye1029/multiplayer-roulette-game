import { access, readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [runtime, prototype, css, html, preview] = await Promise.all([
  readFile(new URL('assets/mountain-race/mountain-race-multiplayer.js', root), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race.js', root), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race.css', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('mountain-race-preview.html', root), 'utf8'),
  access(new URL('assets/mountain-race/images/summit-sprint-natural-world-v60.png', root)),
  access(new URL('assets/safe-cracker/safe-cracker.js', root)),
  access(new URL('assets/roulette/turn-animation.js', root))
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Summit Sprint V60 validation failed: ${message}`);
}

for (const [name, source] of [['runtime', runtime], ['prototype', prototype]]) {
  assert(source.includes('MOUNTAIN_RACE_NATURAL_WORLD_V60'), `${name} marker missing`);
  assert(source.includes("root.dataset.mrNaturalWorld = '60'"), `${name} dataset missing`);
  assert(source.includes('MOUNTAIN_RACE_CONTINUOUS_SUMMIT_V59'), `${name} lost independent continuous cameras`);
  assert(source.includes('--mr-wall-scroll:${scroll}px'), `${name} camera motion changed`);
}

for (const token of [
  'MOUNTAIN_RACE_NATURAL_WORLD_V60',
  'summit-sprint-natural-world-v60.png',
  '[data-mountain-race-mount][data-mr-natural-terrain="49"]',
  'center bottom / 100% 2198px no-repeat',
  '.mr-lane.summit-view .mr-v44-cliff',
  'display: block',
  '.mr-finish-ledge.mr-summit-plateau',
  'opacity: 0',
  'background: none'
]) assert(css.includes(token), `CSS token missing: ${token}`);

for (const document of [html, preview]) {
  assert(document.includes('continuous=59'), 'V59 cache boundary missing');
  assert(document.includes('world=60'), 'V60 natural-world cache boundary missing');
}

assert(runtime.includes('Math.max(8, Math.min(80, Math.trunc(Number(publicState.stepsTotal) || 24)))'), 'authoritative 24-hold contract changed');
assert(runtime.includes('data-mr-rematch') && runtime.includes('data-mr-new-game'), 'finish actions changed');
assert(runtime.includes('scheduleInputFlush(true)'), 'continuous multiplayer input changed');

console.log('Summit Sprint V60 validation passed: one approved portrait mountain plate supplies the cliff, natural upper silhouette, and sky while independent cameras and protected gameplay remain intact.');
