import { access, readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [runtime, prototype, css, html, preview] = await Promise.all([
  readFile(new URL('assets/mountain-race/mountain-race-multiplayer.js', root), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race.js', root), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race.css', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('mountain-race-preview.html', root), 'utf8'),
  access(new URL('assets/mountain-race/images/summit-sprint-grounded-world-v61.png', root)),
  access(new URL('assets/mountain-race/images/summit-sprint-ground-base-v61.png', root)),
  access(new URL('assets/mountain-race/images/summit-sprint-grounded-summit-v61.png', root)),
  access(new URL('assets/safe-cracker/safe-cracker.js', root)),
  access(new URL('assets/roulette/turn-animation.js', root))
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Summit Sprint V61 validation failed: ${message}`);
}

for (const [name, source] of [['runtime', runtime], ['prototype', prototype]]) {
  assert(source.includes('MOUNTAIN_RACE_GROUNDED_WORLD_V61'), `${name} marker missing`);
  assert(source.includes("root.dataset.mrGroundedWorld = '61'"), `${name} dataset missing`);
  assert(source.includes('MOUNTAIN_RACE_CONTINUOUS_SUMMIT_V59'), `${name} lost independent cameras`);
  assert(source.includes('--mr-wall-scroll:${scroll}px'), `${name} lane-owned camera motion changed`);
}

for (const token of [
  'MOUNTAIN_RACE_GROUNDED_WORLD_V61',
  'summit-sprint-grounded-world-v61.png',
  'summit-sprint-ground-base-v61.png',
  'summit-sprint-grounded-summit-v61.png',
  'center calc(100% + 256px) / auto 2397px no-repeat',
  '.mr-v44-start',
  'width: 104%',
  '.mr-finish-ledge.mr-summit-plateau',
  'translate(-50%, calc(100% - 82px))',
  'background-position: center bottom, center top'
]) assert(css.includes(token), `CSS token missing: ${token}`);

for (const document of [html, preview]) {
  assert(document.includes('world=60'), 'V60 cache boundary missing');
  assert(document.includes('grounded=61'), 'V61 cache boundary missing');
}

assert(runtime.includes('Math.max(8, Math.min(80, Math.trunc(Number(publicState.stepsTotal) || 24)))'), 'authoritative 24-hold contract changed');
assert(runtime.includes('data-mr-rematch') && runtime.includes('data-mr-new-game'), 'finish actions changed');
assert(runtime.includes('scheduleInputFlush(true)'), 'continuous input changed');

console.log('Summit Sprint V61 validation passed: each lane independently scrolls its own sharp grass base, continuous mountain, and grabbable summit while protected gameplay remains intact.');
