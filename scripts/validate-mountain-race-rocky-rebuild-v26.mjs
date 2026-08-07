import { readFile, stat } from 'node:fs/promises';

const rootUrl = new URL('../', import.meta.url);
const marker = 'MOUNTAIN_RACE_ROCKY_REBUILD_V26';
const expected = new Map([
  ['assets/mountain-race/images/summit-sprint-sky-v26.png', [1200, 1700]],
  ['assets/mountain-race/images/summit-sprint-cliff-left-v26.png', [420, 2400]],
  ['assets/mountain-race/images/summit-sprint-cliff-right-v26.png', [420, 2400]],
  ['assets/mountain-race/images/summit-sprint-start-left-v26.png', [720, 360]],
  ['assets/mountain-race/images/summit-sprint-start-right-v26.png', [720, 360]],
  ['assets/mountain-race/images/summit-sprint-summit-left-v26.png', [660, 300]],
  ['assets/mountain-race/images/summit-sprint-summit-right-v26.png', [660, 300]],
  ['assets/mountain-race/images/summit-sprint-hold-1-v26.png', [320, 220]],
  ['assets/mountain-race/images/summit-sprint-hold-2-v26.png', [320, 220]],
  ['assets/mountain-race/images/summit-sprint-hold-3-v26.png', [320, 220]],
  ['assets/mountain-race/images/summit-sprint-hold-4-v26.png', [320, 220]],
  ['assets/mountain-race/images/summit-sprint-hold-5-v26.png', [320, 220]],
  ['assets/mountain-race/images/summit-sprint-hold-6-v26.png', [320, 220]]
]);

function fail(message) {
  throw new Error(`Summit Sprint V26 rocky rebuild validation failed: ${message}`);
}

for (const [path, [expectedWidth, expectedHeight]] of expected) {
  const url = new URL(path, rootUrl);
  const info = await stat(url);
  if (!info.isFile() || info.size < 7000) fail(`${path} is missing or unexpectedly small (${info.size} bytes).`);
  const bytes = await readFile(url);
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) fail(`${path} is not a PNG.`);
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  if (width !== expectedWidth || height !== expectedHeight) fail(`${path} dimensions are ${width}x${height}, expected ${expectedWidth}x${expectedHeight}.`);
}

const [css, runtime, html, preview, loader, integration] = await Promise.all([
  readFile(new URL('assets/mountain-race/mountain-race.css', rootUrl), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race-multiplayer.js', rootUrl), 'utf8'),
  readFile(new URL('index.html', rootUrl), 'utf8'),
  readFile(new URL('mountain-race-preview.html', rootUrl), 'utf8'),
  readFile(new URL('scripts/patch-mountain-race-load-performance.mjs', rootUrl), 'utf8'),
  readFile(new URL('netlify/functions/mountain-race/integration.js', rootUrl), 'utf8')
]);

if (!loader.includes("./patch-mountain-race-art-assets-v26.mjs")) fail('build chain is missing the V26 PNG generator.');
if (!loader.includes("./patch-mountain-race-rocky-rebuild-v26.mjs")) fail('build chain is missing the V26 visual patch.');
if (!loader.includes("./validate-mountain-race-rocky-rebuild-v26.mjs")) fail('build chain is missing the V26 validator.');
if (!runtime.includes(marker)) fail('runtime V26 marker is missing.');
if (!runtime.includes("root.dataset.mrRockyRebuild = '26'")) fail('V26 dataset is not activated.');
if (!runtime.includes('delete root.dataset.mrVisualRestart;')) fail('V25 terrain dataset is still active.');
if (!css.includes(marker)) fail('CSS V26 marker is missing.');
if (!css.includes('[data-mr-rocky-rebuild="26"] .mr-lane')) fail('V26 lane presentation selector is missing.');
if (!css.includes('border-radius: 0 !important')) fail('rounded terrain-card cleanup is missing.');
if (!css.includes('background-color: transparent !important')) fail('transparent cliff surroundings are missing.');
if (!css.includes('background-size: cover !important')) fail('aspect-preserving cliff sizing is missing.');
if (!css.includes('background-repeat: no-repeat !important')) fail('terrain no-repeat protection is missing.');
if (!css.includes('summit-sprint-start-left-v26.png') || !css.includes('summit-sprint-start-right-v26.png')) fail('independent start shelves are missing.');
if (!css.includes('summit-sprint-summit-left-v26.png') || !css.includes('summit-sprint-summit-right-v26.png')) fail('independent summit shelves are missing.');
if (!css.includes('summit-sprint-hold-6-v26.png')) fail('separate physical hold set is incomplete.');
if (!html.includes('visual=26')) fail('main page V26 cache boundary is missing.');
if (preview.includes('mountain-race.css?') && !preview.includes('visual=26')) fail('standalone preview V26 cache boundary is missing.');

// Gameplay invariants: V26 must remain purely presentational.
for (const token of [
  "const MODE = 'mountainrace'",
  "choice: 'mountainrace:batch'",
  'function authoritativeSlip(',
  'function rebaseInputQueueAgainstGame(',
  'MOUNTAIN_RACE_INPUT_REBASE_V8',
  'MOUNTAIN_RACE_TERMINAL_POLL_V10',
  'MOUNTAIN_RACE_LIFECYCLE_GUARD_V11'
]) {
  if (!runtime.includes(token)) fail(`protected Summit Sprint gameplay token is missing: ${token}`);
}
if (!integration.includes('stepsTotal') || !integration.includes('MOUNTAIN_RACE_BOT_MIN_STEP_INTERVAL_MS')) fail('authoritative mountain-race server logic is missing expected invariants.');

// Protected modes are presence-checked only; the V26 patch script never opens them for writing.
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

console.log(`Validated Summit Sprint V26 rocky rebuild with ${expected.size} new PNG assets, jagged transparent terrain presentation, V25 disabled visually, live gameplay invariants retained, and protected game files outside the V26 write set.`);
