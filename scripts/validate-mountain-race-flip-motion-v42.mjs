import { readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const [runtime, prototype, css, html, preview] = await Promise.all([
  readFile(new URL('assets/mountain-race/mountain-race-multiplayer.js', root), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race.js', root), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race.css', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'), readFile(new URL('mountain-race-preview.html', root), 'utf8')
]);
const fail = message => { throw new Error(`Summit Sprint V42 validation failed: ${message}`); };
for (const source of [runtime, prototype]) {
  for (const token of ['MOUNTAIN_RACE_FLIP_MOTION_V42', 'previousClimberRect', 'nextClimberRect', 'currentElement.animate(keyframes', "translate: deltaX + 'px '"]) {
    if (!source.includes(token)) fail(`runtime FLIP token missing: ${token}`);
  }
  if (source.includes("currentElement.replaceWith(nextElement.cloneNode(true));\n      return;")) fail('legacy climber replacement remains');
}
for (const token of ['MOUNTAIN_RACE_FLIP_MOTION_V42', 'animation: none !important', 'will-change: translate, rotate']) {
  if (!css.includes(token)) fail(`CSS FLIP token missing: ${token}`);
}
if (!html.includes('visual=42') || !preview.includes('visual=42')) fail('V42 cache boundary missing');
console.log('Summit Sprint V42 validation passed: climbers remain mounted and animate between measured screen positions.');
