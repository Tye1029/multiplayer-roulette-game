import { access, readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [runtime, prototype, css, html, preview] = await Promise.all([
  readFile(new URL('assets/mountain-race/mountain-race-multiplayer.js', root), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race.js', root), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race.css', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('mountain-race-preview.html', root), 'utf8'),
  access(new URL('assets/mountain-race/images/summit-sprint-alpine-sky-v58.png', root)),
  access(new URL('assets/mountain-race/images/summit-sprint-natural-peak-v56.png', root)),
  access(new URL('assets/safe-cracker/safe-cracker.js', root)),
  access(new URL('assets/roulette/turn-animation.js', root))
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Summit Sprint V59 validation failed: ${message}`);
}

for (const [name, source] of [['runtime', runtime], ['prototype', prototype]]) {
  assert(source.includes('MOUNTAIN_RACE_CONTINUOUS_SUMMIT_V59'), `${name} marker missing`);
  assert(source.includes("root.dataset.mrContinuousSummit = '59'"), `${name} dataset missing`);
  assert(source.includes('continuous-mountain') && source.includes('summit-approach'), `${name} continuous approach classes missing`);
  assert(source.includes('(cameraIndex - Math.max(0, total - 5)) / 5'), `${name} does not reveal the summit across the final five camera steps`);
  assert(source.includes('data-mr-summit-reveal="${summitReveal.toFixed(2)}"'), `${name} reveal diagnostic missing`);
  assert(source.includes('--mr-summit-bottom:${summitBottom}px'), `${name} summit is not fixed inside the moving world`);
  assert(source.includes('--mr-summit-reveal:${summitReveal}'), `${name} does not expose gradual peak opacity to the moving world`);
  assert(source.includes('MOUNTAIN_RACE_SUMMIT_SKY_V58'), `${name} lost the V58 baseline`);
}

for (const token of [
  'MOUNTAIN_RACE_CONTINUOUS_SUMMIT_V59',
  '.mr-lane.continuous-mountain',
  'grid-area: 1 / 1',
  'height: calc(var(--mr-summit-bottom) + 120px)',
  'background-size: auto calc(var(--mr-wall-height) + 94px)',
  "background: url('/assets/mountain-race/images/summit-sprint-natural-cliff-v49.png') left bottom / auto calc(var(--mr-wall-height) + 94px) no-repeat",
  'opacity: var(--mr-summit-reveal)',
  'width: calc(100% - 24px)',
  '.mr-lane.continuous-mountain.summit-view .mr-v44-cliff',
  'summit-sprint-alpine-sky-v58.png',
  'margin-bottom: 0',
  'margin-top: 0'
]) assert(css.includes(token), `CSS token missing: ${token}`);

for (const document of [html, preview]) {
  assert(document.includes('visual=58'), 'V58 compatible visual cache boundary missing');
  assert(document.includes('continuous=59'), 'V59 continuous-world cache boundary missing');
}

assert(runtime.includes('Math.max(8, Math.min(80, Math.trunc(Number(publicState.stepsTotal) || 24)))'), 'authoritative 24-hold server contract changed');
assert(runtime.includes('data-mr-rematch') && runtime.includes('data-mr-new-game'), 'finish actions changed');
assert(runtime.includes('scheduleInputFlush(true)'), 'continuous multiplayer input changed');

console.log('Summit Sprint V59 validation passed: the final five lane-camera steps reveal one fixed summit and sky, HUD cards overlay the same moving world, and protected gameplay remains intact.');
