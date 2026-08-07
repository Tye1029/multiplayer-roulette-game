import { readFile, stat } from 'node:fs/promises';
import referenceBase64 from './mountain-race-reference-atlas-v21-source.mjs';

const root = new URL('../', import.meta.url);
const css = await readFile(new URL('assets/mountain-race/mountain-race.css', root), 'utf8');
const runtime = await readFile(new URL('assets/mountain-race/mountain-race-multiplayer.js', root), 'utf8');
const html = await readFile(new URL('index.html', root), 'utf8');
const loader = await readFile(new URL('scripts/patch-mountain-race-load-performance.mjs', root), 'utf8');
const sourceImageUrl = new URL('assets/mountain-race/images/summit-sprint-reference-v21.jpg', root);

function assert(condition, message) {
  if (!condition) throw new Error(`Summit Sprint Reference Atlas V21 validation failed: ${message}`);
}

assert(typeof referenceBase64 === 'string' && referenceBase64.length > 50000, 'reference source module is too small');
assert(referenceBase64.startsWith('/9j/'), 'reference source module is not JPEG base64');

const image = await readFile(sourceImageUrl);
const imageStat = await stat(sourceImageUrl);
assert(imageStat.size > 30000, 'generated reference source image is unexpectedly small');
assert(image[0] === 0xff && image[1] === 0xd8, 'generated reference source image is not JPEG');

assert(loader.includes("./patch-mountain-race-reference-atlas-v21.mjs"), 'build chain is missing the V21 patch');
assert(loader.includes("./validate-mountain-race-reference-atlas-v21.mjs"), 'build chain is missing the V21 validator');
assert(runtime.includes('MOUNTAIN_RACE_REFERENCE_ATLAS_V21'), 'runtime marker missing');
assert(runtime.includes("root.dataset.mrReferenceAtlas = '21';"), 'V21 runtime dataset marker missing');
assert(runtime.includes("canvas.toDataURL('image/png')"), 'runtime does not create PNG atlas crops');
assert(runtime.includes('leftCliff: pngCrop('), 'left cliff PNG crop missing');
assert(runtime.includes('rightCliff: pngCrop('), 'right cliff PNG crop missing');
assert(runtime.includes('grass: pngCrop('), 'grass PNG crop missing');
assert(runtime.includes("ensureReferenceAtlasV21(root);"), 'V21 atlas installation is not called');
assert(css.includes('MOUNTAIN_RACE_REFERENCE_ATLAS_V21'), 'CSS marker missing');
assert(css.includes('[data-mr-reference-atlas="21"] .mr-start-ledge'), 'centered ledge rules missing');
assert(css.includes('left: 50% !important;'), 'center anchor missing');
assert(css.includes('transform: translateX(-50%) !important;'), 'ledge translate centering missing');
assert(css.includes('var(--mr-v21-left-cliff'), 'left reference cliff CSS missing');
assert(css.includes('var(--mr-v21-right-cliff'), 'right reference cliff CSS missing');
assert(css.includes('var(--mr-v21-grass-strip'), 'reference grass CSS missing');
assert(html.includes('reference=21'), 'V21 cache token missing');

console.log(`Summit Sprint Reference Atlas V21 validation passed (${imageStat.size} byte source image; PNG atlas generated client-side).`);
