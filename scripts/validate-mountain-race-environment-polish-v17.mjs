import { access, readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [css, runtime, html] = await Promise.all([
  readFile(new URL('assets/mountain-race/mountain-race.css', root), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race-multiplayer.js', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8')
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Summit Sprint Environment Polish V17 validation failed: ${message}`);
}

for (const required of [
  'MOUNTAIN_RACE_ENVIRONMENT_POLISH_V17',
  '--mr-mountain-detail-v17',
  '--mr-grass-texture-v17',
  '.mr-environment-v17',
  '.mr-sun-v17',
  '.mr-cloud-bank-v17.far',
  '.mr-cloud-bank-v17.near',
  '.mr-wind-v17 i',
  '@keyframes mrCloudDriftNearV17',
  '@keyframes mrWindStreakV17',
  '@keyframes mrGrassSwayV17',
  '.mr-climber.standing-on-summit::after',
  '@media (prefers-reduced-motion: reduce)'
]) {
  assert(css.includes(required), `stylesheet is missing ${required}`);
}

for (const required of [
  'MOUNTAIN_RACE_ENVIRONMENT_POLISH_V17',
  'function environmentRandomV17(',
  'function createMountainDetailRasterV17()',
  'function createGrassTextureV17()',
  'function ensureMountainRaceEnvironmentV17(root)',
  "canvas.toDataURL('image/png')",
  'window.__mountainRaceEnvironmentV17',
  "root.dataset.mrEnvironment = '17'",
  'class="mr-environment-v17"',
  'class="mr-cloud-bank-v17 far"',
  'class="mr-wind-v17"',
  'ensureMountainRaceRasterAssetsV16(root);\n    ensureMountainRaceEnvironmentV17(root);'
]) {
  assert(runtime.includes(required), `runtime is missing ${required}`);
}

assert(!runtime.includes('root.innerHTML = `'), 'whole-mount replacement returned');
assert(html.includes('<!-- MOUNTAIN_RACE_ENVIRONMENT_POLISH_V17 -->'), 'deployment marker is missing');
assert(/mountain-race\.css[^"']*environment=17/.test(html), 'stylesheet environment cache boundary is missing');
assert(/mountain-race-multiplayer\.js[^"']*environment=17/.test(html), 'runtime environment cache boundary is missing');

for (const preserved of [
  'MOUNTAIN_RACE_INPUT_REBASE_V8',
  'function authoritativeSlip(',
  'function rebaseInputQueueAgainstGame(',
  'MOUNTAIN_RACE_VISUAL_REBUILD_V14',
  'MOUNTAIN_RACE_DAYLIGHT_TERRAIN_V15',
  'MOUNTAIN_RACE_RASTER_CLIFF_V16',
  'function createMountainRasterV16()',
  'function createHoldSpriteV16()',
  'class="mr-start-meadow"',
  'mr-finish-ledge mr-summit-plateau',
  'standing-on-summit'
]) {
  assert(runtime.includes(preserved) || css.includes(preserved), `protected feature is missing ${preserved}`);
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

console.log('Summit Sprint Environment Polish V17 validation passed: enhanced rock and grass textures, directional sunlight, cloud and wind layers, summit shadows, reduced-motion handling, V8/V10/V11/V14/V15/V16, and protected games remain intact.');
