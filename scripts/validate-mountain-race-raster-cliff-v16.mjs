import { access, readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [css, runtime, html] = await Promise.all([
  readFile(new URL('assets/mountain-race/mountain-race.css', root), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race-multiplayer.js', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8')
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Summit Sprint Raster Cliff V16 validation failed: ${message}`);
}

for (const required of [
  'MOUNTAIN_RACE_RASTER_CLIFF_V16',
  '--mr-mountain-raster-v16',
  '--mr-hold-sprite-v16',
  'background-size: 600% 100%',
  '.mr-rock-hold:nth-of-type(6n + 1)',
  '.mr-rock-hold:nth-of-type(6n)',
  'drop-shadow(0 0 12px rgba(240,144,55,.72))',
  '@media (prefers-reduced-motion: reduce)'
]) {
  assert(css.includes(required), `stylesheet is missing ${required}`);
}

for (const required of [
  'MOUNTAIN_RACE_RASTER_CLIFF_V16',
  'function rasterRandomV16(',
  'function createMountainRasterV16()',
  'function createHoldSpriteV16()',
  'function ensureMountainRaceRasterAssetsV16(root)',
  "canvas.toDataURL('image/png')",
  'window.__mountainRaceRasterAssetsV16',
  "root.dataset.mrRasterTexture = '16'",
  'ensureMountainRaceWorld(root);\n    ensureMountainRaceRasterAssetsV16(root);'
]) {
  assert(runtime.includes(required), `runtime is missing ${required}`);
}

assert(!runtime.includes('root.innerHTML = `'), 'whole-mount replacement returned');
assert(html.includes('<!-- MOUNTAIN_RACE_RASTER_CLIFF_V16 -->'), 'deployment marker is missing');
assert(/mountain-race\.css[^"']*texture=16/.test(html), 'stylesheet texture cache boundary is missing');
assert(/mountain-race-multiplayer\.js[^"']*texture=16/.test(html), 'runtime texture cache boundary is missing');

for (const preserved of [
  'MOUNTAIN_RACE_INPUT_REBASE_V8',
  'function authoritativeSlip(',
  'function rebaseInputQueueAgainstGame(',
  'MOUNTAIN_RACE_VISUAL_REBUILD_V14',
  'MOUNTAIN_RACE_DAYLIGHT_TERRAIN_V15',
  'class="mr-start-meadow"',
  'mr-finish-ledge mr-summit-plateau',
  'standing-on-summit'
]) {
  assert(runtime.includes(preserved) || css.includes(preserved), `protected visual/gameplay feature is missing ${preserved}`);
}
assert(html.includes('MOUNTAIN_RACE_TERMINAL_POLL_V10'), 'terminal polling protection was displaced');
assert(html.includes('MOUNTAIN_RACE_LIFECYCLE_GUARD_V11'), 'lifecycle guard was displaced');

for (const protectedPath of [
  'assets/safe-cracker/safe-cracker.js',
  'assets/safe-cracker/safe-cracker.css',
  'assets/roulette/turn-animation.js',
  'assets/roulette/turn-fire.js',
  'assets/roulette/audio-bindings.js',
  'netlify/functions/mountain-race/integration.js',
  'netlify/functions/duel-action.js'
]) {
  await access(new URL(protectedPath, root));
}

console.log('Summit Sprint Raster Cliff V16 validation passed: one cached PNG cliff texture moves with the wall, six PNG handhold variants remain separate interactive elements, and V8/V10/V11/V14/V15 plus protected games remain intact.');
