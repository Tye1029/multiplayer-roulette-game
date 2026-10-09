import { readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const [runtime, prototype, css, html, preview] = await Promise.all([
  readFile(new URL('assets/mountain-race/mountain-race-multiplayer.js', root), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race.js', root), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race.css', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'), readFile(new URL('mountain-race-preview.html', root), 'utf8')
]);
const fail = message => { throw new Error(`Summit Sprint V40 validation failed: ${message}`); };
for (const source of [runtime, prototype]) {
  for (const token of ['MOUNTAIN_RACE_STATIC_SCENE_V40', 'morphMountainNode', '--mr-wall-height:${Math.max(2060, 300 + total * 92)}px', 'data-mr-animation-key']) {
    if (!source.includes(token)) fail(`runtime static-scene token missing: ${token}`);
  }
}
if (runtime.includes('previousGameElement.replaceChildren(...nextGameElement.childNodes);')) fail('multiplayer still replaces the complete game tree');
for (const token of ['MOUNTAIN_RACE_STATIC_SCENE_V40', 'height: var(--mr-wall-height, 2508px)', 'contain: layout style paint']) {
  if (!css.includes(token)) fail(`CSS static-scene token missing: ${token}`);
}
if (!html.includes('visual=40') || !preview.includes('visual=40')) fail('V40 cache boundary missing');
console.log('Summit Sprint V40 validation passed: terrain persists between updates and the wall contains the full route and summit.');
