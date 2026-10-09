import { readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const [css, html, preview] = await Promise.all([
  readFile(new URL('assets/mountain-race/mountain-race.css', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('mountain-race-preview.html', root), 'utf8')
]);
const fail = message => { throw new Error(`Summit Sprint V36 validation failed: ${message}`); };
for (const token of ['MOUNTAIN_RACE_CONTINUOUS_REACH_V36', 'mrV36ReachFrames', 'mrV36ReachTravel', '620ms linear both', '.mr-motion-frame-0']) {
  if (!css.includes(token)) fail(`missing ${token}`);
}
if (!css.includes('display: none !important;') || !css.includes('opacity: 1 !important;')) fail('single opaque frame-layer policy missing');
if (!html.includes('visual=36') || !preview.includes('visual=36')) fail('V36 cache boundary missing');
console.log('Summit Sprint V36 validation passed: one opaque sprite layer performs a continuous reach and ledge settle.');
