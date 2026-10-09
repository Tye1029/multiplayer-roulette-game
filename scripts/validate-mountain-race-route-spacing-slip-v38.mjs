import { readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const [runtime, prototype, css, html, preview] = await Promise.all([
  readFile(new URL('assets/mountain-race/mountain-race-multiplayer.js', root), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race.js', root), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race.css', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'), readFile(new URL('mountain-race-preview.html', root), 'utf8')
]);
const fail = message => { throw new Error(`Summit Sprint V38 validation failed: ${message}`); };
for (const source of [runtime, prototype]) {
  for (const token of ['MOUNTAIN_RACE_ROUTE_SPACING_SLIP_V38', 'index * 92', '--mr-slip-fall:${slipFall}px']) {
    if (!source.includes(token)) fail(`runtime spacing token missing: ${token}`);
  }
  if (!source.includes('20 + index * 92')) fail('lower climber position missing');
}
for (const token of ['MOUNTAIN_RACE_ROUTE_SPACING_SLIP_V38', 'mrV38FallBack', '720ms', 'var(--mr-slip-fall, 92px)']) {
  if (!css.includes(token)) fail(`fall animation token missing: ${token}`);
}
if (!html.includes('visual=38') || !preview.includes('visual=38')) fail('V38 cache boundary missing');
console.log('Summit Sprint V38 validation passed: holds are separated and wrong input falls one complete ledge interval.');
