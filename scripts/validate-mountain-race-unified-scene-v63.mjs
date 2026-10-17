import { access, readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [runtime, prototype, css, html, preview] = await Promise.all([
  readFile(new URL('assets/mountain-race/mountain-race-multiplayer.js', root), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race.js', root), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race.css', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('mountain-race-preview.html', root), 'utf8'),
  access(new URL('assets/mountain-race/images/summit-sprint-unified-summit-v63.png', root)),
  access(new URL('assets/mountain-race/images/summit-sprint-clouds-v63.png', root)),
  access(new URL('assets/mountain-race/images/summit-sprint-grounded-world-v61.png', root)),
  access(new URL('assets/safe-cracker/safe-cracker.js', root)),
  access(new URL('assets/roulette/turn-animation.js', root))
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Summit Sprint V63 validation failed: ${message}`);
}

for (const [name, source] of [['runtime', runtime], ['prototype', prototype]]) {
  assert(source.includes('MOUNTAIN_RACE_UNIFIED_SCENE_V63'), `${name} marker missing`);
  assert(source.includes("root.dataset.mrUnifiedScene = '63'"), `${name} dataset missing`);
  assert(!source.includes('class="mr-control-terrain"'), `${name} retained duplicate footer terrain`);
  assert(source.includes('--mr-wall-scroll:${scroll}px'), `${name} independent cameras changed`);
}

for (const token of [
  'MOUNTAIN_RACE_UNIFIED_SCENE_V63',
  'summit-sprint-unified-summit-v63.png',
  'summit-sprint-clouds-v63.png',
  'margin-top: -132px',
  '.mr-lane.continuous-mountain.summit-view .mr-mountain-wall::before',
  'transform: translate(-50%, 0)',
  'grayscale(1)',
  'mask-image: linear-gradient',
  'background-color: #30352f',
  '@keyframes mrV63CloudDrift',
  'prefers-reduced-motion: reduce'
]) assert(css.includes(token), `CSS token missing: ${token}`);

for (const document of [html, preview]) {
  assert(document.includes('scenery=62'), 'V62 cache boundary missing');
  assert(document.includes('scene=63'), 'V63 cache boundary missing');
}

assert(runtime.includes('Math.max(8, Math.min(80, Math.trunc(Number(publicState.stepsTotal) || 24)))'), 'authoritative 24 holds changed');
assert(runtime.includes('data-mr-rematch') && runtime.includes('data-mr-new-game'), 'finish actions changed');
assert(runtime.includes('scheduleInputFlush(true)'), 'continuous input changed');

console.log('Summit Sprint V63 validation passed: no duplicate footer seam, unified finish sky, grounded winner, granite ledges, and gentle cloud drift.');
