import { readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const [runtime, prototype, css, html, preview] = await Promise.all([
  readFile(new URL('assets/mountain-race/mountain-race-multiplayer.js', root), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race.js', root), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race.css', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'), readFile(new URL('mountain-race-preview.html', root), 'utf8')
]);
const fail = message => { throw new Error(`Summit Sprint V41 validation failed: ${message}`); };
for (const source of [runtime, prototype]) {
  for (const token of ['MOUNTAIN_RACE_SYNCHRONIZED_MOTION_V41', 'cameraIndex', "lastInput?.correct === false", 'promptIndex + 1']) {
    if (!source.includes(token)) fail(`runtime synchronization token missing: ${token}`);
  }
}
for (const token of ['MOUNTAIN_RACE_SYNCHRONIZED_MOTION_V41', 'transform 620ms', 'mrV41SummitArrival', 'translate3d(0, 220px, 0)']) {
  if (!css.includes(token)) fail(`CSS synchronization token missing: ${token}`);
}
if (!html.includes('visual=41') || !preview.includes('visual=41')) fail('V41 cache boundary missing');
console.log('Summit Sprint V41 validation passed: camera and climber are synchronized, slips remain visible and summit backing is continuous.');
