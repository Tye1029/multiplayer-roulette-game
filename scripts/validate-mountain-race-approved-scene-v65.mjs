import { readFile, stat } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [html, runtime, prototype, sceneCss, stateModel] = await Promise.all([
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race-multiplayer.js', root), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race.js', root), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race-scene-v65.css', root), 'utf8'),
  readFile(new URL('netlify/functions/mountain-race/state-model.js', root), 'utf8')
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Summit Sprint V65 validation failed: ${message}`);
}

for (const name of [
  'summit-sprint-jagged-cliff-v65.png',
  'summit-sprint-jagged-ground-v65.png',
  'summit-sprint-jagged-ledges-v65.png',
  'summit-sprint-jagged-summit-v65.png',
  'summit-sprint-moving-sky-v65.png'
]) {
  const asset = await stat(new URL(`assets/mountain-race/images/${name}`, root));
  assert(asset.isFile() && asset.size > 300_000, `${name} is missing or unexpectedly small`);
  assert(sceneCss.includes(name), `${name} is not wired into the authoritative scene`);
  assert(html.includes(name), `${name} is not preloaded by the deployed page`);
}

for (const source of [runtime, prototype]) {
  assert(source.includes("dataset.mrApprovedScene = '65'"), 'runtime does not select the V65 scene');
  assert(source.includes('class="mr-v65-scenery"'), 'per-lane scenery is missing');
  assert(!source.includes('class="mr-control-terrain"'), 'duplicate terrain remains beneath the controls');
  assert(source.includes('winnerConfetti(total)'), 'confetti is not anchored to the dynamic route length');
  assert(source.includes('data-mr-outcrop="${index % 6}"'), 'all six natural ledge variants are not used');
}

for (const token of [
  'MOUNTAIN_RACE_APPROVED_SCENE_V65',
  '.mr-v65-scenery',
  '.mr-v65-sky',
  '.mr-v65-cliff',
  'mrV65CloudDrift',
  '.mr-v44-start',
  '.mr-finish-ledge.mr-summit-plateau',
  '.mr-climber.standing-start',
  '.mr-climber.finished',
  '.mr-v51-center-rope',
  '.mr-command-deck'
]) assert(sceneCss.includes(token), `scene stylesheet is missing ${token}`);

assert(sceneCss.includes('position: absolute !important;') && sceneCss.includes('bottom: 18px !important;'), 'control deck is not overlaid on the lane world');
assert(stateModel.includes('const MOUNTAIN_RACE_DEFAULT_STEPS = 30;'), 'server course is not 30 holds');
assert(runtime.includes('ALPINE EXPEDITION · ROUTE 30'), 'multiplayer route heading is stale');
assert(html.includes('mountain-race-scene-v65.css?v=1'), 'V65 cache boundary is missing');
assert(!html.includes('mountain-race-recovery-v64.css'), 'retired V64 recovery stylesheet is still deployed');

console.log('Summit Sprint V65 validation passed: one jagged mountain scene, six matching ledges, independent lane scenery, moving sky, full start ground behind controls, dynamic 30-hold summit/confetti, and no V64 recovery layer.');
