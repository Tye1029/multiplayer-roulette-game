import { readFile, stat } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const css = await readFile(new URL('assets/mountain-race/mountain-race.css', root), 'utf8');
const runtime = await readFile(new URL('assets/mountain-race/mountain-race-multiplayer.js', root), 'utf8');
const html = await readFile(new URL('index.html', root), 'utf8');
const loader = await readFile(new URL('scripts/patch-mountain-race-load-performance.mjs', root), 'utf8');
const imageUrl = new URL('assets/mountain-race/images/summit-sprint-cliff-v20.png', root);

function assert(condition, message) {
  if (!condition) throw new Error(`Summit Sprint Screenshot Base V20 validation failed: ${message}`);
}

const image = await readFile(imageUrl);
const imageStat = await stat(imageUrl);
assert(imageStat.size > 12000, 'screenshot PNG is unexpectedly small');
assert(
  image[0] === 0x89 && image[1] === 0x50 && image[2] === 0x4e && image[3] === 0x47
    && image[4] === 0x0d && image[5] === 0x0a && image[6] === 0x1a && image[7] === 0x0a,
  'screenshot asset is not a valid PNG'
);
assert(loader.includes("./patch-mountain-race-screenshot-base-v20.mjs"), 'build chain is missing the V20 patch');
assert(loader.includes("./validate-mountain-race-screenshot-base-v20.mjs"), 'build chain is missing the V20 validator');
assert(runtime.includes('MOUNTAIN_RACE_SCREENSHOT_BASE_V20'), 'runtime marker missing');
assert(runtime.includes("root.dataset.mrScreenshotBase = '20';"), 'runtime dataset installation missing');
assert(css.includes('MOUNTAIN_RACE_SCREENSHOT_BASE_V20'), 'CSS marker missing');
assert(css.includes('summit-sprint-cliff-v20.png'), 'CSS does not use the screenshot PNG');
assert(css.includes('[data-mr-screenshot-base="20"] .mr-mountain-wall'), 'scoped cliff rule missing');
assert(css.includes('mr-v20-grass-breeze'), 'grass lighting/motion treatment missing');
assert(html.includes('screenshot=20'), 'V20 cache token missing');
console.log(`Summit Sprint Screenshot Base V20 validation passed (${imageStat.size} byte PNG).`);
