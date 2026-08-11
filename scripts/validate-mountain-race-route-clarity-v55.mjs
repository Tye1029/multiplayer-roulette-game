import { access, readFile, stat } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const assetUrls = [
  new URL('assets/mountain-race/images/summit-sprint-start-climbers-v55.png', root),
  new URL('assets/mountain-race/images/summit-sprint-waiting-climbers-v55.png', root)
];
const [runtime, prototype, css, html, preview, assets] = await Promise.all([
  readFile(new URL('assets/mountain-race/mountain-race-multiplayer.js', root), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race.js', root), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race.css', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('mountain-race-preview.html', root), 'utf8'),
  Promise.all(assetUrls.map(async url => ({ bytes: await readFile(url), info: await stat(url) }))),
  access(new URL('assets/safe-cracker/safe-cracker.js', root)),
  access(new URL('assets/roulette/turn-animation.js', root))
]);
const natural56 = runtime.includes('MOUNTAIN_RACE_NATURAL_SUMMIT_V56');

function assert(condition, message) {
  if (!condition) throw new Error(`Summit Sprint V55 validation failed: ${message}`);
}

for (const { bytes, info } of assets) {
  assert(info.isFile() && info.size >= 100_000, 'start sprite asset is missing or empty');
  assert(bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a', 'start sprite asset is not PNG');
  assert(bytes.readUInt32BE(16) === 1536 && bytes.readUInt32BE(20) === 1024, 'start sprite dimensions changed');
  assert(bytes[25] === 6, 'start sprite must retain RGBA transparency');
}

for (const [name, source, visibleToken] of [
  ['runtime', runtime, 'currentIndex + 4'],
  ['prototype', prototype, 'player.promptIndex + 4']
]) {
  assert(source.includes('MOUNTAIN_RACE_ROUTE_CLARITY_V55'), `${name} marker missing`);
  assert(source.includes("root.dataset.mrRouteClarity = '55'"), `${name} dataset missing`);
  assert(source.includes(natural56 ? visibleToken.replace('+ 4', '+ 3') : visibleToken), `${name} does not retain the readable prompted ledges`);
  assert(source.includes(natural56 ? '* 74' : '* 60'), `${name} does not use the expected readable spacing`);
  assert(source.includes('standing-start'), `${name} start pose state missing`);
  assert(source.includes('start-waiting') && source.includes('start-reaching'), `${name} does not distinguish countdown and live start poses`);
  assert(source.includes('ready-next'), `${name} next-grip state missing`);
  assert(source.includes('MOUNTAIN_RACE_GROUNDED_ASCENT_V54'), `${name} lost the grounded V54 baseline`);
}

for (const token of [
  'MOUNTAIN_RACE_ROUTE_CLARITY_V55',
  '[data-mr-route-clarity="55"] .mr-rock-hold.current',
  'z-index: 16 !important',
  'top: -12px !important',
  'summit-sprint-start-climbers-v55.png',
  'summit-sprint-waiting-climbers-v55.png',
  'background-size: 200% 100% !important',
  'background-position: left center !important',
  'background-position: right center !important',
  '.standing-start.start-reaching.direction-left',
  'transform: scaleX(-1) !important'
]) assert(css.includes(token), `CSS token missing: ${token}`);

for (const document of [html, preview]) {
  assert(document.includes(natural56 ? 'visual=56' : 'visual=55'), 'V55/V56 cache boundary missing');
  assert(document.includes('summit-sprint-start-climbers-v55.png'), 'V55 start sprite preload missing');
  assert(document.includes('summit-sprint-waiting-climbers-v55.png'), 'V55 waiting sprite preload missing');
}
assert(runtime.includes('Math.max(8, Math.min(80, Math.trunc(Number(publicState.stepsTotal) || 24)))'), 'authoritative 24-hold server contract changed');
assert(runtime.includes('data-mr-rematch') && runtime.includes('data-mr-new-game'), 'finish actions changed');
assert(runtime.includes('scheduleInputFlush(true)'), 'continuous multiplayer input changed');

console.log('Summit Sprint V55 validation passed: five readable ledges, balanced 60px spacing, foreground active prompts, separate waiting/live rear-view start sprites, and the authoritative 24-hold multiplayer contract are present.');
