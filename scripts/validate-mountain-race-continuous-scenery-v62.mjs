import { access, readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [runtime, prototype, css, html, preview] = await Promise.all([
  readFile(new URL('assets/mountain-race/mountain-race-multiplayer.js', root), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race.js', root), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race.css', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('mountain-race-preview.html', root), 'utf8'),
  access(new URL('assets/mountain-race/images/summit-sprint-skyless-summit-v62.png', root)),
  access(new URL('assets/mountain-race/images/summit-sprint-grounded-world-v61.png', root)),
  access(new URL('assets/safe-cracker/safe-cracker.js', root)),
  access(new URL('assets/roulette/turn-animation.js', root))
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Summit Sprint V62 validation failed: ${message}`);
}

for (const [name, source] of [['runtime', runtime], ['prototype', prototype]]) {
  assert(source.includes('MOUNTAIN_RACE_CONTINUOUS_SCENERY_V62'), `${name} marker missing`);
  assert(source.includes("root.dataset.mrContinuousScenery = '62'"), `${name} dataset missing`);
  assert(source.includes('class="mr-control-terrain"'), `${name} control terrain missing`);
  assert(source.includes('class="me" style="--mr-control-world-shift:'), `${name} player terrain missing`);
  assert(source.includes('class="opponent" style="--mr-control-world-shift:'), `${name} opponent terrain missing`);
  assert(source.includes('--mr-wall-scroll:${scroll}px'), `${name} independent camera contract changed`);
}

for (const token of [
  'MOUNTAIN_RACE_CONTINUOUS_SCENERY_V62',
  '.mr-control-terrain',
  'grid-template-columns: repeat(2, minmax(0, 1fr))',
  'var(--mr-control-world-shift, 0px)',
  'summit-sprint-grounded-world-v61.png',
  'summit-sprint-skyless-summit-v62.png',
  'opacity: 1 !important',
  '.mr-lane.summit-view .mr-v44-cliff',
  'background-size: auto 100%',
  '.mr-lane.summit-view .mr-winner-confetti',
  'transform: translate(-50%, 45%)',
  '.mr-finish-ledge.mr-summit-plateau'
]) assert(css.includes(token), `CSS token missing: ${token}`);

for (const document of [html, preview]) {
  assert(document.includes('grounded=61'), 'V61 cache boundary missing');
  assert(document.includes('scenery=62'), 'V62 cache boundary missing');
}

assert(runtime.includes('Math.max(8, Math.min(80, Math.trunc(Number(publicState.stepsTotal) || 24)))'), 'authoritative 24-hold contract changed');
assert(runtime.includes('data-mr-rematch') && runtime.includes('data-mr-new-game'), 'finish actions changed');
assert(runtime.includes('scheduleInputFlush(true)'), 'continuous input changed');

console.log('Summit Sprint V62 validation passed: both cameras extend behind the controls independently and the summit uses one seamless sky.');
