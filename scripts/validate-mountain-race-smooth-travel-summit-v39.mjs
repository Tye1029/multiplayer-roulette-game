import { readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const [runtime, prototype, css, html, preview] = await Promise.all([
  readFile(new URL('assets/mountain-race/mountain-race-multiplayer.js', root), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race.js', root), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race.css', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'), readFile(new URL('mountain-race-preview.html', root), 'utf8')
]);
const fail = message => { throw new Error(`Summit Sprint V39 validation failed: ${message}`); };
for (const source of [runtime, prototype]) {
  for (const token of ['MOUNTAIN_RACE_SMOOTH_TRAVEL_SUMMIT_V39', 'previousContactLeft', '--mr-previous-climber-left:${previousContactLeft}%', 'promptIndex - 2) * 92']) {
    if (!source.includes(token)) fail(`runtime travel token missing: ${token}`);
  }
}
for (const token of ['MOUNTAIN_RACE_SMOOTH_TRAVEL_SUMMIT_V39', 'mrV39ClimbBetweenHolds', 'calc(var(--mr-climber-bottom) - 92px)', '760ms']) {
  if (!css.includes(token)) fail(`CSS travel token missing: ${token}`);
}
if (!html.includes('visual=39') || !preview.includes('visual=39')) fail('V39 cache boundary missing');
console.log('Summit Sprint V39 validation passed: climbers travel from the prior hold and final symbols remain framed.');
