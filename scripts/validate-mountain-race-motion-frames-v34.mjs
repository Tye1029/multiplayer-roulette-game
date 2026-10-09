import { readFile, stat } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [css, html, preview] = await Promise.all([
  readFile(new URL('assets/mountain-race/mountain-race.css', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('mountain-race-preview.html', root), 'utf8')
]);
const fail = message => { throw new Error(`Summit Sprint V34 validation failed: ${message}`); };
for (const color of ['blue', 'orange']) for (const direction of ['up', 'left', 'right', 'down']) {
  const asset = `summit-sprint-climber-${color}-${direction}-v34.png`;
  const info = await stat(new URL(`assets/mountain-race/images/${asset}`, root));
  if (info.size < 100000) fail(`motion sheet missing or too small: ${asset}`);
  if (!css.includes(asset)) fail(`motion sheet is not consumed: ${asset}`);
}
for (const token of ['MOUNTAIN_RACE_MOTION_FRAMES_V34', '@keyframes mrV34PoseFrames', '16.66%, 33.31%', '83.30%, 100%', '540ms steps(1, end)']) {
  if (!css.includes(token)) fail(`six-frame animation token missing: ${token}`);
}
if (!html.includes('visual=34') || !preview.includes('visual=34')) fail('V34 cache boundary missing');
console.log('Summit Sprint V34 validation passed: both climbers have six-frame up, left, right, and down/slip motion sequences.');
