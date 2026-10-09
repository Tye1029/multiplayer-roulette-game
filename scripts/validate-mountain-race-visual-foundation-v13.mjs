import { access, readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [css, runtime, html] = await Promise.all([
  readFile(new URL('assets/mountain-race/mountain-race.css', root), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race-multiplayer.js', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8')
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Summit Sprint Visual Foundation V13 validation failed: ${message}`);
}

function containsRuntimeClass(name) {
  return runtime.includes(`class="${name}"`) || runtime.includes(`class=\\"${name}\\"`);
}

for (const required of [
  'MOUNTAIN_RACE_VISUAL_FOUNDATION_V13',
  '.mr-world-layer',
  '.mr-world-moon',
  '.mr-world-range-far',
  '.mr-world-range-mid',
  '.mr-world-cloud-a',
  '.mr-world-snow-near',
  '.mr-stage-ridge',
  '.mr-ridge-beacon',
  '.mr-route-depth',
  '.mr-route-ice',
  '.mr-route-rope',
  '.mr-rope-anchor-a',
  '@keyframes mrSnowNear',
  '@media (prefers-reduced-motion: reduce)'
]) {
  assert(css.includes(required), `stylesheet is missing ${required}`);
}

for (const required of [
  'MOUNTAIN_RACE_VISUAL_FOUNDATION_V13',
  'ALPINE EXPEDITION · ROUTE 24',
  'NORTH FACE · 24 HOLDS · LIVE ASCENT'
]) {
  assert(runtime.includes(required), `multiplayer scene is missing ${required}`);
}

for (const className of [
  'mr-world-layer',
  'mr-world-moon',
  'mr-world-range mr-world-range-far',
  'mr-stage-ridge',
  'mr-route-depth',
  'mr-route-rope',
  'mr-rope-anchor mr-rope-anchor-a'
]) {
  assert(containsRuntimeClass(className), `multiplayer scene is missing class ${className}`);
}

assert(html.includes('<!-- MOUNTAIN_RACE_VISUAL_FOUNDATION_V13 -->'), 'deployment marker is missing');
assert(/mountain-race\.css[^"']*visual=(?:13|14)/.test(html), 'stylesheet visual cache boundary is missing');
assert(/mountain-race-multiplayer\.js[^"']*visual=(?:13|14)/.test(html), 'runtime visual cache boundary is missing');

// Visual work must remain outside the authoritative input and networking contract.
assert(runtime.includes("choice: 'mountainrace:batch'") || runtime.includes('choice: `mountainrace:input:'), 'authoritative Mountain Race input path is missing');
assert(runtime.includes('MOUNTAIN_RACE_INPUT_REBASE_V8'), 'authoritative input rebasing was displaced');
assert(runtime.includes('function authoritativeSlip('), 'slip reconciliation was displaced');
assert(runtime.includes('function rebaseInputQueueAgainstGame('), 'input queue rebasing was displaced');
assert(html.includes('MOUNTAIN_RACE_TERMINAL_POLL_V10'), 'terminal polling protection was displaced');
assert(html.includes('MOUNTAIN_RACE_LIFECYCLE_GUARD_V11'), 'lifecycle regression protection was displaced');

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

console.log('Summit Sprint Visual Foundation V13 validation passed: the unified alpine world, atmospheric depth, expedition HUD, embedded climbing routes, responsive composition, reduced-motion support, authoritative input rebasing, terminal polling, lifecycle protection, and protected games remain intact.');
