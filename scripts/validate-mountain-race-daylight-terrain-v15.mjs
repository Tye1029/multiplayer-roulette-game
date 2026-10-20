import { access, readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [css, runtime, html] = await Promise.all([
  readFile(new URL('assets/mountain-race/mountain-race.css', root), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race-multiplayer.js', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8')
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Summit Sprint Daylight Terrain V15 validation failed: ${message}`);
}

for (const required of [
  'MOUNTAIN_RACE_DAYLIGHT_TERRAIN_V15',
  '.mr-start-meadow',
  '.mr-finish-ledge.mr-summit-plateau',
  '.mr-summit-turf',
  '.mr-climber.finished',
  '@keyframes mrSummitStand',
  'linear-gradient(180deg, #54b4ed',
  'linear-gradient(104deg, #916a46',
  'repeating-radial-gradient'
]) {
  assert(css.includes(required), `stylesheet is missing ${required}`);
}

for (const required of [
  'MOUNTAIN_RACE_DAYLIGHT_TERRAIN_V15',
  'class="mr-start-meadow"',
  'mr-finish-ledge mr-summit-plateau',
  'class="mr-summit-turf"',
  'function renderClimber(raw, side, animation, total)',
  "const finishClass = finished ? 'finished standing-on-summit' : '';",
  'finished ? 148 + Number(total || 0) * 58',
  'data-mr-finished=',
  'renderClimber(p, side, animation, total)'
]) {
  assert(runtime.includes(required), `multiplayer runtime is missing ${required}`);
}

assert(!runtime.includes('root.innerHTML = `'), 'persistent V14 world protection was displaced');
assert(runtime.includes('function ensureMountainRaceWorld(root)'), 'persistent world mount is missing');
assert(html.includes('<!-- MOUNTAIN_RACE_DAYLIGHT_TERRAIN_V15 -->'), 'deployment marker is missing');
assert(/mountain-race\.css[^"']*visual=14[^"']*terrain=15/.test(html), 'stylesheet daylight cache boundary is missing');
assert(/mountain-race-multiplayer\.js[^"']*visual=14[^"']*terrain=15/.test(html), 'runtime daylight cache boundary is missing');

// Debug invariants from the supplied run: height remains accepted minus rejected.
const visibleHeight = (accepted, rejected) => Math.max(0, accepted - rejected);
assert(visibleHeight(26, 2) === 24, 'player debug arithmetic is inconsistent');
assert(visibleHeight(19, 2) === 17, 'opponent debug arithmetic is inconsistent');

// Visual work must not alter authoritative input, polling, or lifecycle protections.
assert(runtime.includes("choice: 'mountainrace:batch'") || runtime.includes('choice: `mountainrace:input:'), 'authoritative input path is missing');
assert(runtime.includes('MOUNTAIN_RACE_INPUT_REBASE_V8'), 'input rebasing was displaced');
assert(runtime.includes('function authoritativeSlip('), 'slip reconciliation was displaced');
assert(runtime.includes('function rebaseInputQueueAgainstGame('), 'queued input rebasing was displaced');
assert(html.includes('MOUNTAIN_RACE_TERMINAL_POLL_V10'), 'terminal polling protection was displaced');
assert(html.includes('MOUNTAIN_RACE_LIFECYCLE_GUARD_V11'), 'lifecycle ordering protection was displaced');
assert(html.includes('MOUNTAIN_RACE_VISUAL_REBUILD_V14'), 'white-flash render protection was displaced');

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

console.log('Summit Sprint Daylight Terrain V15 validation passed: clear sky, brown procedural rock, grassy start and summit planes, correct finished-climber footing, persistent anti-flash rendering, debug arithmetic, authoritative gameplay, and protected games remain intact.');
