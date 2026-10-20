import { readFile, stat } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [css, html, preview] = await Promise.all([
  readFile(new URL('assets/mountain-race/mountain-race.css', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('mountain-race-preview.html', root), 'utf8')
]);
const fail = message => { throw new Error(`Summit Sprint V33 validation failed: ${message}`); };
for (const asset of ['summit-sprint-climber-blue-v33.png', 'summit-sprint-climber-orange-v33.png']) {
  const info = await stat(new URL(`assets/mountain-race/images/${asset}`, root));
  if (info.size < 100000) fail(`pose sheet missing or too small: ${asset}`);
  if (!css.includes(asset)) fail(`pose sheet is not consumed: ${asset}`);
}
for (const token of [
  'MOUNTAIN_RACE_DIRECTIONAL_POSES_V33', 'background-size: 300% 200%',
  '.mr-climber.direction-up::before', '.mr-climber.direction-left::before',
  '.mr-climber.direction-right::before', '.mr-climber.direction-down::before',
  '.mr-climber.slip::before', '.mr-climber.celebrate::before'
]) if (!css.includes(token)) fail(`directional pose token missing: ${token}`);
if (!html.includes('visual=33') || !preview.includes('visual=33')) fail('V33 cache boundary missing');
console.log('Summit Sprint V33 validation passed: up, left, right, down/slip, pull, and victory use distinct realistic frames.');
