import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const css = await readFile(new URL('assets/mountain-race/mountain-race.css', root), 'utf8');
const runtime = await readFile(new URL('assets/mountain-race/mountain-race-multiplayer.js', root), 'utf8');
const html = await readFile(new URL('index.html', root), 'utf8');
const loader = await readFile(new URL('scripts/patch-mountain-race-load-performance.mjs', root), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(`Summit Sprint Concept Detail V19 validation failed: ${message}`);
}

assert(loader.includes("./patch-mountain-race-concept-detail-v19.mjs"), 'build chain is missing V19 patch import');
assert(loader.includes("./validate-mountain-race-concept-detail-v19.mjs"), 'build chain is missing V19 validator import');
assert(runtime.includes('MOUNTAIN_RACE_CONCEPT_DETAIL_V19'), 'runtime marker missing');
assert(runtime.includes('ensureConceptDetailV19(root);'), 'runtime does not install V19 assets');
assert(runtime.includes('function createCliffTextureV19()'), 'cliff texture generator missing');
assert(runtime.includes('function createGrassTextureV19()'), 'grass texture generator missing');
assert(runtime.includes('function createLedgeSpriteV19()'), 'ledge sprite generator missing');
assert(css.includes('MOUNTAIN_RACE_CONCEPT_DETAIL_V19'), 'css marker missing');
assert(css.includes('--mr-cliff-detail-v19'), 'css cliff texture variable missing');
assert(css.includes('--mr-grass-detail-v19'), 'css grass texture variable missing');
assert(css.includes('--mr-ledge-sprite-v19'), 'css ledge sprite variable missing');
assert(css.includes('.mr-finish-ledge'), 'summit ledge styling missing');
assert(html.includes('concept=19'), 'index cache token missing');
console.log('Summit Sprint Concept Detail V19 validation passed.');
