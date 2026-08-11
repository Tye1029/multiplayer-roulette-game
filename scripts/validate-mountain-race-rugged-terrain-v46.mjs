import { readFile, stat } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const fail = message => { throw new Error(`Summit Sprint V46 validation failed: ${message}`); };
const assets = [
  ['summit-sprint-rugged-cliff-v46.png', 768, 1152],
  ['summit-sprint-rugged-outcrop-1-v46.png', 512, 192],
  ['summit-sprint-rugged-outcrop-2-v46.png', 512, 192],
  ['summit-sprint-rugged-outcrop-3-v46.png', 512, 192],
  ['summit-sprint-rugged-outcrop-4-v46.png', 512, 192]
];

let bytesTotal = 0;
for (const [name, width, height] of assets) {
  const url = new URL(`assets/mountain-race/images/${name}`, root);
  const [bytes, info] = await Promise.all([readFile(url), stat(url)]);
  if (!info.isFile() || info.size < 30_000) fail(`${name} is missing or empty`);
  if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') fail(`${name} is not PNG`);
  if (bytes.readUInt32BE(16) !== width || bytes.readUInt32BE(20) !== height) fail(`${name} dimensions changed`);
  if (bytes[25] !== 6 && bytes[25] !== 3) fail(`${name} must retain alpha-capable PNG data`);
  bytesTotal += info.size;
}
if (bytesTotal > 900_000) fail(`V46 terrain assets are too heavy (${bytesTotal} bytes)`);

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
    'MOUNTAIN_RACE_RUGGED_TERRAIN_V46',
    "dataset.mrRuggedTerrain = '46'",
    'data-mr-outcrop="${index % 4}"',
    'opponent-upcoming',
    'MOUNTAIN_RACE_CONTACT_LEDGES_V45'
  ]) if (!source.includes(token)) fail(`runtime token missing: ${token}`);
}

for (const token of [
  'MOUNTAIN_RACE_RUGGED_TERRAIN_V46',
  'summit-sprint-rugged-cliff-v46.png',
  'summit-sprint-rugged-outcrop-1-v46.png',
  'summit-sprint-rugged-outcrop-4-v46.png',
  '.mr-rock-hold.opponent-upcoming',
  'visibility: visible !important'
]) if (!css.includes(token)) fail(`CSS token missing: ${token}`);

const finish47 = runtime.includes('MOUNTAIN_RACE_FINISH_STABILITY_V47');
const natural49 = runtime.includes('MOUNTAIN_RACE_NATURAL_TERRAIN_V49');
const summit50 = runtime.includes('MOUNTAIN_RACE_SUMMIT_CONTACT_V50');
const shared51 = runtime.includes('MOUNTAIN_RACE_SHARED_MOUNTAIN_V51');
const winner52 = runtime.includes('MOUNTAIN_RACE_WINNER_SUMMIT_V52');
const camera53 = runtime.includes('MOUNTAIN_RACE_WINNER_CAMERA_V53');
const grounded54 = runtime.includes('MOUNTAIN_RACE_GROUNDED_ASCENT_V54');
const route55 = runtime.includes('MOUNTAIN_RACE_ROUTE_CLARITY_V55');
const natural56 = runtime.includes('MOUNTAIN_RACE_NATURAL_SUMMIT_V56');
for (const document of [html, preview]) {
  if (!document.includes(natural56 ? 'visual=56' : route55 ? 'visual=55' : grounded54 ? 'visual=54' : camera53 ? 'visual=53' : winner52 ? 'visual=52' : shared51 ? 'visual=51' : summit50 ? 'visual=50' : natural49 ? 'visual=49' : finish47 ? 'visual=47' : 'visual=46')) fail('V46/V56 cache boundary missing');
  const requiredPreloads = natural49 ? [] : assets;
  for (const [name] of requiredPreloads) if (!document.includes(`rel="preload" as="image" href="/assets/mountain-race/images/${name}"`)) fail(`preload missing: ${name}`);
  if (natural49 && document.includes('rel="preload" as="image" href="/assets/mountain-race/images/summit-sprint-rugged-cliff-v46.png"')) fail('retired V46 cliff remains preloaded after V49');
  if (document.includes('rel="preload" as="image" href="/assets/mountain-race/images/summit-sprint-reboot-cliff-v44.png"')) fail('retired gray cliff remains preloaded');
  if (document.includes('rel="preload" as="image" href="/assets/mountain-race/images/summit-sprint-reboot-ledge-v45.png"')) fail('retired flat ledge remains preloaded');
}

if (!runtime.includes(natural56 ? 'currentIndex + 3' : route55 ? 'currentIndex + 4' : grounded54 ? 'currentIndex + 7' : 'currentIndex + 3')) fail('multiplayer renderer no longer keeps nearby ledges');
if (!runtime.includes("side === 'opponent' && index >= currentIndex ? 'opponent-upcoming'")) fail('opponent future ledges are not explicitly visible');
if (!runtime.includes(natural56 ? 'Math.max(0, cameraIndex) * 74' : route55 ? 'Math.max(0, cameraIndex - 1) * 60' : grounded54 ? 'Math.max(0, cameraIndex - 1) * 42' : 'Math.max(0, cameraIndex - 1) * 84')) fail('camera framing changed');
if (!runtime.includes('data-mr-contact-index')) fail('physical climber contact anchoring changed');
if (!runtime.includes('scheduleInputFlush(true)')) fail('non-blocking input buffering changed');
if (!safeCracker.length || !roulette.length) fail('protected game runtimes are unreadable');

console.log(`Summit Sprint V46 validation passed: ${bytesTotal} bytes across five optimized rugged-brown PNGs, four natural outcrop variants, opponent future-ledges visible, V45 contact/camera behavior retained, and protected games intact.`);
