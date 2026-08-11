import { readFile, stat } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const fail = message => { throw new Error(`Summit Sprint V49 validation failed: ${message}`); };
const assert = (condition, message) => { if (!condition) fail(message); };
const assets = [
  ['summit-sprint-natural-cliff-v49.png', 1024, 4096],
  ['summit-sprint-natural-outcrop-1-v49.png', 640, 232],
  ['summit-sprint-natural-outcrop-2-v49.png', 640, 225],
  ['summit-sprint-natural-outcrop-3-v49.png', 414, 240],
  ['summit-sprint-natural-outcrop-4-v49.png', 640, 221]
];

let bytesTotal = 0;
for (const [name, width, height] of assets) {
  const url = new URL(`assets/mountain-race/images/${name}`, root);
  const [bytes, info] = await Promise.all([readFile(url), stat(url)]);
  assert(info.isFile() && info.size >= 40_000, `${name} is missing or empty`);
  assert(bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a', `${name} is not PNG`);
  assert(bytes.readUInt32BE(16) === width && bytes.readUInt32BE(20) === height, `${name} dimensions changed`);
  assert([3, 6].includes(bytes[25]), `${name} must retain alpha-capable PNG data`);
  assert(bytes.includes(Buffer.from('tRNS')) || bytes[25] === 6, `${name} lost transparent edges`);
  bytesTotal += info.size;
}
assert(bytesTotal <= 2_300_000, `natural terrain assets are too heavy (${bytesTotal} bytes)`);

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
    'MOUNTAIN_RACE_NATURAL_TERRAIN_V49',
    "dataset.mrNaturalTerrain = '49'",
    "dataset.mrFinishStability = '47'",
    'data-mr-outcrop="${index % 4}"',
    'opponent-upcoming'
  ]) assert(source.includes(token), `runtime token missing: ${token}`);
}

const v49Css = css.slice(css.indexOf('MOUNTAIN_RACE_NATURAL_TERRAIN_V49'));
for (const token of [
  'summit-sprint-natural-cliff-v49.png',
  'summit-sprint-natural-outcrop-1-v49.png',
  'summit-sprint-natural-outcrop-4-v49.png',
  'center center / auto 100% no-repeat',
  'center bottom / contain no-repeat',
  'width: 86px !important; height: 34px !important',
  '[data-mr-natural-terrain="49"]'
]) assert(v49Css.includes(token), `CSS token missing: ${token}`);
assert(!v49Css.includes('/ 100% 100%'), 'V49 terrain stretches an image out of proportion');
assert(!/\brepeat(?:-x|-y)?\b/.test(v49Css.replaceAll('no-repeat', '')), 'V49 terrain repeats an image');

const summit50 = runtime.includes('MOUNTAIN_RACE_SUMMIT_CONTACT_V50');
const shared51 = runtime.includes('MOUNTAIN_RACE_SHARED_MOUNTAIN_V51');
for (const document of [html, preview]) {
  assert(document.includes(shared51 ? 'visual=51' : summit50 ? 'visual=50' : 'visual=49'), 'V49/V51 cache boundary is missing');
  for (const [name] of assets) {
    assert(document.includes(`rel="preload" as="image" href="/assets/mountain-race/images/${name}"`), `preload missing: ${name}`);
  }
  assert(!document.includes('rel="preload" as="image" href="/assets/mountain-race/images/summit-sprint-rugged-cliff-v46.png"'), 'retired V46 cliff remains preloaded');
}

assert(runtime.includes('currentIndex + 3'), 'multiplayer renderer no longer keeps four nearby ledges');
assert(runtime.includes('Math.max(8, Math.min(80, Math.trunc(Number(publicState.stepsTotal) || 24)))'), 'authoritative 24-hold default changed');
assert(runtime.includes('Math.max(0, cameraIndex - 1) * 84'), 'fixed four-prompt camera framing changed');
assert(runtime.includes('data-mr-contact-index'), 'physical ledge contact anchoring changed');
assert(runtime.includes('scheduleInputFlush(true)'), 'continuous competitive input buffering changed');
for (const token of ['data-mr-rematch', 'data-mr-new-game', 'winnerConfetti()', 'YOU REACHED THE SUMMIT FIRST!']) {
  assert(runtime.includes(token), `finish/rematch behavior missing: ${token}`);
}
assert(safeCracker.length > 0, 'protected Safe Cracker runtime is unreadable');
assert(roulette.length > 0, 'protected Roulette runtime is unreadable');

console.log(`Summit Sprint V49 validation passed: ${bytesTotal} bytes across five optimized natural-rock PNGs, aspect-correct cliff and ledges, 24-hold/contact/camera/input/finish behavior retained, and protected games intact.`);
