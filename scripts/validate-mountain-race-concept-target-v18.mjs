import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [runtime, css, html, safeCracker, roulette] = await Promise.all([
  readFile(new URL('assets/mountain-race/mountain-race-multiplayer.js', root), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race.css', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('assets/safe-cracker/safe-cracker.js', root), 'utf8'),
  readFile(new URL('assets/roulette/turn-animation.js', root), 'utf8')
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Summit Sprint Concept Target V18 validation failed: ${message}`);
}

for (const source of [runtime, css, html]) {
  assert(source.includes('MOUNTAIN_RACE_CONCEPT_TARGET_V18'), 'V18 marker is missing');
}

assert(runtime.includes('function directionGlyphV18(value)'), 'SVG direction helper is missing');
assert(runtime.includes('mr-direction-glyph-v18'), 'SVG direction markup is missing');
assert(runtime.includes("known ? symbol(known) : ''"), 'unknown route bullets were not removed');
assert(!runtime.includes("known ? symbol(known) : '•'"), 'legacy route dots remain');
assert(runtime.includes('ensureConceptTargetV18(root)'), 'persistent V18 scene installation is missing');
assert(runtime.includes('MOUNTAIN_RACE_ENVIRONMENT_POLISH_V17'), 'V17 environment preservation is missing');
assert(runtime.includes('MOUNTAIN_RACE_VISUAL_REBUILD_V14'), 'V14 anti-flash preservation is missing');
assert(css.includes('[data-mountain-race-mount][data-mr-concept-target="18"]'), 'V18 concept root styling is missing');
assert(css.includes('.mr-direction-glyph-v18'), 'new direction emblem styling is missing');
assert(css.includes('.mr-race-stage::before'), 'central chasm treatment is missing');
assert(css.includes('.mr-rock-hold.unknown b { display: none !important; }'), 'unknown symbol suppression is missing');
assert(css.includes('grid-template-columns: repeat(4'), 'four live direction controls are not preserved');
assert(html.includes('concept=18'), 'V18 cache boundary is missing');
assert(safeCracker.length > 1000, 'Safe Cracker asset was damaged');
assert(roulette.length > 1000, 'Roulette asset was damaged');

console.log('Summit Sprint Concept Target V18 validation passed.');
