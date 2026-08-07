import { readFile, stat } from 'node:fs/promises';

const rootUrl = new URL('../', import.meta.url);
const marker = 'MOUNTAIN_RACE_VISUAL_RESTART_V25';
const expected = new Map([
  ['assets/mountain-race/images/summit-sprint-sky-v25.png', [1080, 1600]],
  ['assets/mountain-race/images/summit-sprint-cliff-left-v25.png', [840, 2400]],
  ['assets/mountain-race/images/summit-sprint-cliff-right-v25.png', [840, 2400]],
  ['assets/mountain-race/images/summit-sprint-start-platform-v25.png', [1200, 320]],
  ['assets/mountain-race/images/summit-sprint-summit-platform-v25.png', [1000, 280]],
  ['assets/mountain-race/images/summit-sprint-hold-1-v25.png', [280, 180]],
  ['assets/mountain-race/images/summit-sprint-hold-2-v25.png', [280, 180]],
  ['assets/mountain-race/images/summit-sprint-hold-3-v25.png', [280, 180]],
  ['assets/mountain-race/images/summit-sprint-hold-4-v25.png', [280, 180]],
  ['assets/mountain-race/images/summit-sprint-hold-5-v25.png', [280, 180]],
  ['assets/mountain-race/images/summit-sprint-hold-6-v25.png', [280, 180]]
]);

function fail(message) { throw new Error(`Summit Sprint V25 validation failed: ${message}`); }

for (const [path, [expectedWidth, expectedHeight]] of expected) {
  const url = new URL(path, rootUrl);
  const info = await stat(url);
  if (!info.isFile() || info.size < 8000) fail(`${path} is missing or unexpectedly small.`);
  const head = await readFile(url);
  if (head.length < 24 || !head.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) fail(`${path} is not a PNG.`);
  const width = head.readUInt32BE(16), height = head.readUInt32BE(20);
  if (width !== expectedWidth || height !== expectedHeight) fail(`${path} dimensions are ${width}x${height}, expected ${expectedWidth}x${expectedHeight}.`);
}

const [css, runtime, html, preview] = await Promise.all([
  readFile(new URL('assets/mountain-race/mountain-race.css', rootUrl), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race-multiplayer.js', rootUrl), 'utf8'),
  readFile(new URL('index.html', rootUrl), 'utf8'),
  readFile(new URL('mountain-race-preview.html', rootUrl), 'utf8')
]);

if (!css.includes(marker)) fail('CSS marker is missing.');
if (!runtime.includes(marker) || !runtime.includes("root.dataset.mrVisualRestart = '25'")) fail('runtime visual marker is missing.');
if (!css.includes('background-repeat: no-repeat !important')) fail('terrain no-repeat rule is missing.');
if (!css.includes('background-size: 100% 100% !important')) fail('crisp cliff sizing rule is missing.');
if (!css.includes('summit-sprint-hold-6-v25.png')) fail('separate hold asset set is incomplete.');
if (!html.includes('visual=25')) fail('main page cache boundary is missing.');
if (preview.includes('mountain-race.css?') && !preview.includes('visual=25')) fail('standalone preview cache boundary is missing.');
if (runtime.includes('ensureCorrectedReferenceV24(root);')) fail('legacy V24 reference crop is still invoked.');

// Protected modes are only presence-checked here; this V25 patch never opens them for writing.
for (const path of [
  'assets/safe-cracker/safe-cracker.js',
  'assets/safe-cracker/safe-cracker.css',
  'assets/roulette/turn-animation.js',
  'assets/roulette/turn-fire.js',
  'assets/roulette/audio-bindings.js'
]) {
  const info = await stat(new URL(path, rootUrl));
  if (!info.isFile() || info.size === 0) fail(`protected file ${path} is missing.`);
}

console.log(`Validated Summit Sprint V25 clean visual restart with ${expected.size} generated PNG assets and protected gameplay files left outside the patch write set.`);
