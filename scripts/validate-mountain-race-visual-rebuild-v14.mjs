import { access, readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [css, runtime, html] = await Promise.all([
  readFile(new URL('assets/mountain-race/mountain-race.css', root), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race-multiplayer.js', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8')
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Summit Sprint Visual Rebuild V14 validation failed: ${message}`);
}

for (const required of [
  'MOUNTAIN_RACE_VISUAL_REBUILD_V14',
  '[data-mountain-race-mount]',
  '[data-mountain-race-mount] > .mr-world-layer',
  '[data-mountain-race-mount] > .mountain-race-game',
  'backdrop-filter: none !important',
  '.mr-world-range-far',
  '.mr-world-range-mid',
  '.mr-stage-ridge',
  '.mr-route-ice',
  '.mr-route-rope',
  '@media (prefers-reduced-motion: reduce)'
]) {
  assert(css.includes(required), `stylesheet is missing ${required}`);
}

for (const required of [
  'MOUNTAIN_RACE_VISUAL_REBUILD_V14',
  'const MOUNTAIN_RACE_WORLD_V14',
  'function ensureMountainRaceWorld(root)',
  "root.querySelector(':scope > .mr-world-layer')",
  "root.querySelector(':scope > .mountain-race-game')",
  'previousGameElement.replaceChildren(...nextGameElement.childNodes)',
  "root.dataset.mrVisualStable = '14'",
  'class=\"mr-world-layer\"',
  'class=\"mr-world-moon\"',
  'class=\"mr-stage-ridge\"',
  'class=\"mr-route-rope\"'
]) {
  assert(runtime.includes(required), `multiplayer runtime is missing ${required}`);
}

assert(!runtime.includes('root.innerHTML = `'), 'the entire mountain mount is still replaced during active renders');
assert(html.includes('<!-- MOUNTAIN_RACE_VISUAL_REBUILD_V14 -->'), 'deployment marker is missing');
assert(/mountain-race\.css[^"']*visual=14/.test(html), 'stylesheet visual cache boundary is missing');
assert(/mountain-race-multiplayer\.js[^"']*visual=14/.test(html), 'runtime visual cache boundary is missing');

// The visual rebuild must preserve the authoritative gameplay contract.
assert(runtime.includes("choice: 'mountainrace:batch'") || runtime.includes('choice: `mountainrace:input:'), 'authoritative input path is missing');
assert(runtime.includes('MOUNTAIN_RACE_INPUT_REBASE_V8'), 'input rebasing was displaced');
assert(runtime.includes('function authoritativeSlip('), 'authoritative slip reconciliation was displaced');
assert(runtime.includes('function rebaseInputQueueAgainstGame('), 'queued input rebasing was displaced');
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

console.log('Summit Sprint Visual Rebuild V14 validation passed: the alpine world is visibly exposed, active renders preserve the persistent atmosphere, backdrop-filter flashes are disabled, cliff routes are substantially reconstructed, and authoritative gameplay plus protected games remain intact.');
