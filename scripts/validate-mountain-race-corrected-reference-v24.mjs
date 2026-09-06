import { readFile, stat } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const css = await readFile(new URL('assets/mountain-race/mountain-race.css', root), 'utf8');
const runtime = await readFile(new URL('assets/mountain-race/mountain-race-multiplayer.js', root), 'utf8');
const html = await readFile(new URL('index.html', root), 'utf8');
const loader = await readFile(new URL('scripts/patch-mountain-race-load-performance.mjs', root), 'utf8');
const referenceUrl = new URL('assets/mountain-race/images/summit-sprint-reference-v21.jpg', root);

function assert(condition, message) {
  if (!condition) throw new Error(`Summit Sprint Corrected Reference V24 validation failed: ${message}`);
}

assert(loader.includes("./patch-mountain-race-corrected-reference-v24.mjs"), 'build chain is missing the V24 patch');
assert(loader.includes("./validate-mountain-race-corrected-reference-v24.mjs"), 'build chain is missing the V24 validator');
assert(runtime.includes('MOUNTAIN_RACE_CORRECTED_REFERENCE_V24'), 'runtime marker missing');
assert(runtime.includes('function ensureCorrectedReferenceV24(root)'), 'V24 installer missing');
assert(runtime.includes("root.dataset.mrCorrectedReference = '24';"), 'V24 dataset installation missing');
assert(runtime.includes("root.dataset.mrCorrectedReferenceReady = '1';"), 'V24 ready dataset missing');
assert(runtime.includes('sx(105)'), 'true left-cliff crop origin missing');
assert(runtime.includes('sx(555)'), 'true right-cliff crop origin missing');
assert(runtime.includes('sy(125)'), 'true cliff crop vertical origin missing');
assert(runtime.includes('sy(870)'), 'true cliff crop height missing');
assert(runtime.includes("canvas.height = 1920"), 'full-height non-stretched cliff canvas missing');
assert(runtime.includes("canvas.toDataURL('image/png')"), 'V24 does not create PNG terrain');
assert(runtime.includes("--mr-v24-left-cliff"), 'left cliff PNG variable missing');
assert(runtime.includes("--mr-v24-right-cliff"), 'right cliff PNG variable missing');
assert(runtime.includes("--mr-v24-grass"), 'grass PNG variable missing');
assert(runtime.includes("--mr-v24-holds"), 'hold PNG variable missing');
assert(css.includes('MOUNTAIN_RACE_CORRECTED_REFERENCE_V24'), 'CSS marker missing');
assert(css.includes('var(--mr-v24-left-cliff)'), 'left cliff CSS binding missing');
assert(css.includes('var(--mr-v24-right-cliff)'), 'right cliff CSS binding missing');
assert(css.includes('var(--mr-v24-grass)'), 'grass CSS binding missing');
assert(css.includes('var(--mr-v24-holds)'), 'hold CSS binding missing');
assert(css.includes('[data-mr-corrected-reference-ready="1"] .mr-mountain-wall'), 'ready-state cliff binding missing');
assert(css.includes('.mr-rock-hold.unknown b'), 'future route badges are not separated from physical ledges');
assert(css.includes('left: 50% !important;'), 'centering override missing');
assert(html.includes('corrected=24'), 'V24 cache token missing');

const referenceStat = await stat(referenceUrl);
assert(referenceStat.size > 50000, `approved reference JPEG is unexpectedly small (${referenceStat.size} bytes)`);
const reference = await readFile(referenceUrl);
assert(reference[0] === 0xff && reference[1] === 0xd8 && reference[2] === 0xff, 'approved reference is not a JPEG');

console.log(`Summit Sprint Corrected Reference V24 validation passed (${referenceStat.size} byte source reference).`);
