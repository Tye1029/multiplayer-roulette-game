import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const css = await readFile(new URL('assets/mountain-race/mountain-race.css', root), 'utf8');
const runtime = await readFile(new URL('assets/mountain-race/mountain-race-multiplayer.js', root), 'utf8');
const html = await readFile(new URL('index.html', root), 'utf8');
const loader = await readFile(new URL('scripts/patch-mountain-race-load-performance.mjs', root), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(`Summit Sprint Reference Rebuild V22 validation failed: ${message}`);
}

assert(loader.includes("./patch-mountain-race-reference-rebuild-v22.mjs"), 'build chain is missing the V22 patch');
assert(loader.includes("./validate-mountain-race-reference-rebuild-v22.mjs"), 'build chain is missing the V22 validator');
assert(runtime.includes('MOUNTAIN_RACE_REFERENCE_REBUILD_V22'), 'runtime marker missing');
assert(runtime.includes('function ensureReferenceRebuildV22(root)'), 'runtime installer missing');
assert(runtime.includes("root.dataset.mrReferenceRebuild = '22';"), 'runtime dataset marker missing');
assert(runtime.includes("image.src = 'assets/mountain-race/images/summit-sprint-reference-v21.jpg?reference=22';"), 'reference image source missing');
assert(runtime.includes("leftTerrain: makeTerrain('left')"), 'left aspect-correct terrain PNG missing');
assert(runtime.includes("rightTerrain: makeTerrain('right')"), 'right aspect-correct terrain PNG missing');
assert(runtime.includes('grass: makeGrass()'), 'reference grass PNG missing');
assert(css.includes('MOUNTAIN_RACE_REFERENCE_REBUILD_V22'), 'CSS marker missing');
assert(css.includes('--mr-v22-left-terrain'), 'left terrain variable missing');
assert(css.includes('--mr-v22-right-terrain'), 'right terrain variable missing');
assert(css.includes('--mr-v22-grass'), 'grass variable missing');
assert(css.includes('background-size: 100% 100%, 100% auto !important;'), 'terrain is not protected from full-height stretching');
assert(css.includes('background-repeat: no-repeat, repeat-y !important;'), 'terrain does not repeat vertically at natural aspect');
assert(css.includes('background-image: var(--mr-ledge-sprite-v19) !important;'), 'physical ledge sprite was not restored');
assert(css.includes('.mr-rock-hold.unknown b'), 'future ledge arrow suppression missing');
assert(css.includes('left: 50% !important;'), 'ledge centering rule missing');
assert(css.includes('transform: translateX(-50%) !important;'), 'ledge centering transform missing');
assert(html.includes('referenceRebuild=22'), 'V22 cache token missing');
console.log('Summit Sprint Reference Rebuild V22 validation passed.');
