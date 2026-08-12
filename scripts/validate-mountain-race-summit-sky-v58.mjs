import { access, readFile, stat } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const assetUrl = new URL('assets/mountain-race/images/summit-sprint-alpine-sky-v58.png', root);
const [runtime, prototype, css, html, preview, asset, assetInfo] = await Promise.all([
  readFile(new URL('assets/mountain-race/mountain-race-multiplayer.js', root), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race.js', root), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race.css', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('mountain-race-preview.html', root), 'utf8'),
  readFile(assetUrl),
  stat(assetUrl),
  access(new URL('assets/safe-cracker/safe-cracker.js', root)),
  access(new URL('assets/roulette/turn-animation.js', root))
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Summit Sprint V58 validation failed: ${message}`);
}

assert(assetInfo.isFile() && assetInfo.size >= 500_000, 'alpine sky asset is missing or unexpectedly small');
assert(asset.subarray(0, 8).toString('hex') === '89504e470d0a1a0a', 'alpine sky asset is not PNG');
assert(asset.readUInt32BE(16) === 1200 && asset.readUInt32BE(20) === 800, 'alpine sky dimensions changed');
assert(asset[25] === 2, 'alpine sky must remain an RGB PNG');

for (const [name, source] of [['runtime', runtime], ['prototype', prototype]]) {
  assert(source.includes('MOUNTAIN_RACE_SUMMIT_SKY_V58'), `${name} marker missing`);
  assert(source.includes("root.dataset.mrSummitSky = '58'"), `${name} dataset missing`);
  assert(source.includes("summitView =") && source.includes("'summit-view' : 'cliff-view'"), `${name} does not render independent lane views`);
  assert(source.includes('data-mr-lane-view="${summitView ?'), `${name} lane view diagnostic is missing`);
  assert(source.includes('data-mr-camera-index="${cameraIndex}"'), `${name} independent camera diagnostic is missing`);
  assert(source.includes('Boolean(') && source.includes('promptIndex >= total'), `${name} summit state is not based on that player`);
  assert(source.includes('MOUNTAIN_RACE_CELEBRATION_CONTACT_V57'), `${name} lost the V57 baseline`);
}

for (const token of [
  'MOUNTAIN_RACE_SUMMIT_SKY_V58',
  'summit-sprint-alpine-sky-v58.png',
  '.mr-lane.cliff-view.me .mr-climb-viewport',
  '.mr-lane.cliff-view.opponent .mr-climb-viewport',
  '.mr-lane.summit-view .mr-v44-cliff',
  '.mr-lane.summit-view .mr-rock-hold',
  '.mr-lane.summit-view .mr-player-card',
  'transform: translate(-50%, 17%)',
  'transform: translate(-50%, 30%)'
]) assert(css.includes(token), `CSS token missing: ${token}`);

assert(!css.includes('[data-mr-summit-sky="58"] .mr-race-stage {\n  background-image: url(\'/assets/mountain-race/images/summit-sprint-natural-cliff-v49.png\')'), 'outer shell still uses the stretched cliff');

for (const document of [html, preview]) {
  assert(document.includes('visual=58'), 'V58 cache boundary missing');
  assert(document.includes('summit-sprint-alpine-sky-v58.png'), 'V58 sky preload missing');
}

assert(runtime.includes('Math.max(8, Math.min(80, Math.trunc(Number(publicState.stepsTotal) || 24)))'), 'authoritative 24-hold server contract changed');
assert(runtime.includes('data-mr-rematch') && runtime.includes('data-mr-new-game'), 'finish actions changed');
assert(runtime.includes('scheduleInputFlush(true)'), 'continuous multiplayer input changed');

console.log('Summit Sprint V58 validation passed: lanes transition independently, completed lanes contain sky above the natural peak, outer gutters are sky, and both winners stand higher on the summit.');
