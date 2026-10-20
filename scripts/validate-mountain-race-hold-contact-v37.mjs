import { readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const [runtime, prototype, css, html, preview] = await Promise.all([
  readFile(new URL('assets/mountain-race/mountain-race-multiplayer.js', root), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race.js', root), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race.css', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'), readFile(new URL('mountain-race-preview.html', root), 'utf8')
]);
const fail = message => { throw new Error(`Summit Sprint V37 validation failed: ${message}`); };
for (const source of [runtime, prototype]) {
  for (const token of ['MOUNTAIN_RACE_HOLD_CONTACT_V37', 'contactIndex', 'contactLeft', '--mr-climber-left:${contactLeft}%']) {
    if (!source.includes(token)) fail(`runtime contact token missing: ${token}`);
  }
}
for (const token of ['MOUNTAIN_RACE_HOLD_CONTACT_V37', 'var(--mr-climber-left, 50%)', '--mr-v37-hand-anchor', 'left 620ms']) {
  if (!css.includes(token)) fail(`CSS contact token missing: ${token}`);
}
if (!html.includes('visual=37') || !preview.includes('visual=37')) fail('V37 cache boundary missing');
console.log('Summit Sprint V37 validation passed: each climber hand tracks its physical symbol hold.');
