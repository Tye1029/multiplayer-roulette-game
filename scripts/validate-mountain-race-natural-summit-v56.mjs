import { access, readFile, stat } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const assetUrl = new URL('assets/mountain-race/images/summit-sprint-natural-peak-v56.png', root);
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
  if (!condition) throw new Error(`Summit Sprint V56 validation failed: ${message}`);
}

assert(assetInfo.isFile() && assetInfo.size >= 250_000, 'natural summit peak asset is missing or empty');
assert(asset.subarray(0, 8).toString('hex') === '89504e470d0a1a0a', 'natural summit peak asset is not PNG');
assert(asset.readUInt32BE(16) === 768 && asset.readUInt32BE(20) === 615, 'natural summit peak dimensions changed');
assert(asset[25] === 6, 'natural summit peak must retain RGBA transparency');

for (const [name, source] of [['runtime', runtime], ['prototype', prototype]]) {
  assert(source.includes('MOUNTAIN_RACE_NATURAL_SUMMIT_V56'), `${name} marker missing`);
  assert(source.includes("root.dataset.mrNaturalSummit = '56'"), `${name} dataset missing`);
  assert(source.includes('196 + index * 74'), `${name} does not use the arms-length 74px route`);
  assert(source.includes('196 + Math.max(0, total - 1) * 74'), `${name} summit does not share hold 24`);
  assert(source.includes('currentIndex + 3') || source.includes('player.promptIndex + 3'), `${name} does not show exactly the four prompted ledges`);
  assert(source.includes("'contact'"), `${name} held-ledge contact class missing`);
  assert(source.includes("'final-hold'"), `${name} final-hold class missing`);
  assert(source.includes('228 + contactIndex * 74'), `${name} hand overlap anchor missing`);
  assert(source.includes('272 + Math.max(0,'), `${name} summit standing anchor missing`);
  assert(source.includes('Math.max(0, cameraIndex) * 74'), `${name} camera spacing changed`);
  assert(source.includes('MOUNTAIN_RACE_ROUTE_CLARITY_V55'), `${name} lost the V55 baseline`);
}

for (const token of [
  'MOUNTAIN_RACE_NATURAL_SUMMIT_V56',
  '[data-mr-natural-summit="56"] .mr-rock-hold.contact',
  '[data-mr-natural-summit="56"] .mr-rock-hold.final-hold',
  '[data-mr-natural-terrain="49"][data-mr-natural-summit="56"] .mr-finish-ledge.mr-summit-plateau',
  'summit-sprint-natural-peak-v56.png',
  'aspect-ratio: 768 / 615',
  'calc(100% - 84px)',
  'mrV56SummitPullUp',
  'translate: 0 68px'
]) assert(css.includes(token), `CSS token missing: ${token}`);

for (const document of [html, preview]) {
  assert(document.includes('visual=56') || document.includes('visual=57') || document.includes('visual=58'), 'V56/V58 cache boundary missing');
  assert(document.includes('summit-sprint-natural-peak-v56.png'), 'V56 summit preload missing');
}

assert(runtime.includes('Math.max(8, Math.min(80, Math.trunc(Number(publicState.stepsTotal) || 24)))'), 'authoritative 24-hold server contract changed');
assert(runtime.includes('data-mr-rematch') && runtime.includes('data-mr-new-game'), 'finish actions changed');
assert(runtime.includes('scheduleInputFlush(true)'), 'continuous multiplayer input changed');

console.log('Summit Sprint V56 validation passed: wider 74px route, arms-length first grab, physical held-ledge overlap, natural hold-24 summit, pull-up finish, and protected multiplayer contracts are present.');
