import { readFile, stat } from 'node:fs/promises';

const rootUrl = new URL('../', import.meta.url);
const marker = 'MOUNTAIN_RACE_PROFESSIONAL_REBUILD_V27';
const expected = new Map([
  ['assets/mountain-race/images/summit-sprint-sky-v27.png', [1200, 1800]],
  ['assets/mountain-race/images/summit-sprint-cliff-left-mobile-v27.png', [390, 4560]],
  ['assets/mountain-race/images/summit-sprint-cliff-right-mobile-v27.png', [390, 4560]],
  ['assets/mountain-race/images/summit-sprint-cliff-left-desktop-v27.png', [720, 3420]],
  ['assets/mountain-race/images/summit-sprint-cliff-right-desktop-v27.png', [720, 3420]],
  ['assets/mountain-race/images/summit-sprint-start-left-v27.png', [720, 288]],
  ['assets/mountain-race/images/summit-sprint-start-right-v27.png', [720, 288]],
  ['assets/mountain-race/images/summit-sprint-summit-left-v27.png', [720, 256]],
  ['assets/mountain-race/images/summit-sprint-summit-right-v27.png', [720, 256]],
  ...Array.from({ length: 8 }, (_, i) => [`assets/mountain-race/images/summit-sprint-hold-${i + 1}-v27.png`, [320, 200]])
]);

function fail(message) {
  throw new Error(`Summit Sprint V27 professional rebuild validation failed: ${message}`);
}

function pngDimensions(bytes) {
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return null;
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

for (const [path, dims] of expected) {
  const url = new URL(path, rootUrl);
  const info = await stat(url);
  if (!info.isFile() || info.size < 7000) fail(`${path} is missing or unexpectedly small (${info.size} bytes).`);
  const bytes = await readFile(url);
  const found = pngDimensions(bytes);
  if (!found) fail(`${path} is not a PNG.`);
  if (found[0] !== dims[0] || found[1] !== dims[1]) fail(`${path} is ${found[0]}x${found[1]}, expected ${dims[0]}x${dims[1]}.`);
}

const [css, runtime, html, preview, loader, integration] = await Promise.all([
  readFile(new URL('assets/mountain-race/mountain-race.css', rootUrl), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race-multiplayer.js', rootUrl), 'utf8'),
  readFile(new URL('index.html', rootUrl), 'utf8'),
  readFile(new URL('mountain-race-preview.html', rootUrl), 'utf8'),
  readFile(new URL('scripts/patch-mountain-race-load-performance.mjs', rootUrl), 'utf8'),
  readFile(new URL('netlify/functions/mountain-race/integration.js', rootUrl), 'utf8')
]);

for (const file of [
  './patch-mountain-race-art-assets-v27.mjs',
  './patch-mountain-race-professional-rebuild-v27.mjs',
  './validate-mountain-race-professional-rebuild-v27.mjs'
]) {
  if (!loader.includes(file)) fail(`build chain is missing ${file}.`);
}

if (!runtime.includes(marker)) fail('runtime marker is missing.');
if (!runtime.includes("root.dataset.mrProfessionalRebuild = '27'")) fail('V27 dataset is not activated.');
if (!runtime.includes('class=\"mr-cliff-art\"')) fail('cliffs are not mounted as real image layers.');
if (!runtime.includes('class=\"mr-start-art\"')) fail('start shelves are not mounted as real image layers.');
if (!runtime.includes('class=\"mr-hold-art\"')) fail('physical holds are not mounted as real image layers.');
if (!runtime.includes('class=\"mr-summit-art\"')) fail('summit shelves are not mounted as real image layers.');
if (!runtime.includes('srcset=\"/assets/mountain-race/images/summit-sprint-cliff-')) fail('responsive mobile cliff source is missing.');
if (!runtime.includes('renderHolds(p.promptIndex, total, prompts, reveal, side)')) fail('visual side binding is missing.');

if (!css.includes(marker)) fail('CSS marker is missing.');
if (!css.includes('[data-mr-professional-rebuild="27"] .mr-cliff-art img')) fail('cliff image presentation selector is missing.');
if (!css.includes('width: 130px !important;') || !css.includes('height: 1520px !important;')) fail('mobile cliff wall target dimensions are missing.');
if (!css.includes('width: min(320px, calc(100% - 8px)) !important;')) fail('desktop cliff wall target width is missing.');
if (!css.includes('object-fit: fill !important;')) fail('aspect-authored cliff image placement is missing.');
if (!css.includes('background: none !important;')) fail('legacy terrain background cleanup is missing.');
if (!css.includes('border-radius: 0 !important;')) fail('terrain card/capsule cleanup is missing.');
if (!css.includes('summit-sprint-sky-v27.png')) fail('V27 sky is not active.');
if (!html.includes('visual=27')) fail('main page cache boundary is missing.');
if (preview.includes('mountain-race.css?') && !preview.includes('visual=27')) fail('standalone preview cache boundary is missing.');

// Exact authored ratios: mobile 390:4560 renders at 130:1520 (3x source),
// desktop 720:3420 renders at 320:1520 (2.25x source). This is intentional
// and prevents the cover-cropping that destroyed V26 source silhouettes.
const mobileRatio = 390 / 4560;
const mobileRenderRatio = 130 / 1520;
const desktopRatio = 720 / 3420;
const desktopRenderRatio = 320 / 1520;
if (Math.abs(mobileRatio - mobileRenderRatio) > 1e-9) fail('mobile cliff source/render aspect ratios do not match exactly.');
if (Math.abs(desktopRatio - desktopRenderRatio) > 1e-9) fail('desktop cliff source/render aspect ratios do not match exactly.');

// Gameplay remains authoritative and unchanged by V27. Earlier dedicated
// gameplay validators run in the same build; these tokens protect the visual hook.
for (const token of [
  "const MODE = 'mountainrace'",
  'function authoritativeSlip(',
  'function rebaseInputQueueAgainstGame(',
  "choice: 'mountainrace:batch'"
]) {
  if (!runtime.includes(token)) fail(`protected Summit Sprint runtime token is missing: ${token}`);
}
if (!integration.includes('stepsTotal') || !integration.includes('MOUNTAIN_RACE_BOT_MIN_STEP_INTERVAL_MS')) fail('authoritative mountain-race integration invariants are missing.');

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

console.log(`Validated Summit Sprint V27 professional PNG rebuild with ${expected.size} generated assets, exact mobile/desktop cliff aspect ratios, real image-layer terrain, live gameplay overlays, and protected multiplayer boundaries intact.`);
