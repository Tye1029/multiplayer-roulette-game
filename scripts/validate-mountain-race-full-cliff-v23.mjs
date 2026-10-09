import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const css = await readFile(new URL('assets/mountain-race/mountain-race.css', root), 'utf8');
const runtime = await readFile(new URL('assets/mountain-race/mountain-race-multiplayer.js', root), 'utf8');
const html = await readFile(new URL('index.html', root), 'utf8');
const loader = await readFile(new URL('scripts/patch-mountain-race-load-performance.mjs', root), 'utf8');
const reference = await readFile(new URL('assets/mountain-race/images/summit-sprint-reference-v21.jpg', root));

function assert(condition, message) {
  if (!condition) throw new Error(`Summit Sprint Full Cliff V23 validation failed: ${message}`);
}

assert(reference.length > 30000, 'approved reference source is missing or too small');
assert(reference[0] === 0xff && reference[1] === 0xd8, 'approved reference source is not JPEG data');
assert(loader.includes("./patch-mountain-race-full-cliff-v23.mjs"), 'build chain is missing V23 patch');
assert(loader.includes("./validate-mountain-race-full-cliff-v23.mjs"), 'build chain is missing V23 validator');
assert(runtime.includes('MOUNTAIN_RACE_FULL_CLIFF_V23'), 'runtime marker missing');
assert(runtime.includes('function ensureFullCliffV23(root)'), 'full cliff runtime helper missing');
assert(runtime.includes('const makeCliff = mirror =>'), 'full cliff PNG generator missing');
assert(runtime.includes("return canvas.toDataURL('image/png');"), 'V23 is not generating PNG terrain');
assert(runtime.includes('grass: makeGrass()'), 'dedicated grass PNG generator missing');
assert(runtime.includes("root.dataset.mrFullCliff = '23';"), 'V23 dataset installation missing');
assert(css.includes('MOUNTAIN_RACE_FULL_CLIFF_V23'), 'CSS marker missing');
assert(css.includes('--mr-v23-left-cliff'), 'left full cliff PNG CSS variable missing');
assert(css.includes('--mr-v23-right-cliff'), 'right full cliff PNG CSS variable missing');
assert(css.includes('--mr-v23-grass'), 'grass PNG CSS variable missing');
assert(css.includes('clip-path: none !important'), 'V22 pointed edge reset missing');
assert(css.includes('background-size: 100% 100%, cover !important'), 'full reference cliff cover rule missing');
assert(css.includes('.mr-rock-hold.unknown'), 'future hold visibility override missing');
assert(html.includes('fullcliff=23'), 'V23 cache token missing');
console.log('Summit Sprint Full Cliff V23 validation passed.');
