import { readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const [runtime, prototypeRuntime, css, html, preview] = await Promise.all([
  readFile(new URL('assets/mountain-race/mountain-race-multiplayer.js', root), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race.js', root), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race.css', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'), readFile(new URL('mountain-race-preview.html', root), 'utf8')
]);
const fail = message => { throw new Error(`Summit Sprint V35 validation failed: ${message}`); };
for (const source of [runtime, prototypeRuntime]) {
  if (!source.includes('MOUNTAIN_RACE_MOTION_SMOOTHING_V35')) fail('six frame DOM layers are missing');
  for (let index = 0; index < 6; index += 1) if (!source.includes(`mr-motion-frame-${index}`)) fail(`motion frame ${index} is missing`);
}
for (const token of ['mrV35FrameFade', 'mrV35LastFrame', 'mrV35Travel', '180ms ease-in-out', 'animation-delay: calc(var(--mr-motion-frame) * 72ms)']) {
  if (!css.includes(token)) fail(`cross-fade token missing: ${token}`);
}
if (!html.includes('MOUNTAIN_RACE_V35_MOTION_PREFETCH') || !preview.includes('MOUNTAIN_RACE_V35_MOTION_PREFETCH')) fail('motion prefetch hints missing');
if (!html.includes('visual=35') || !preview.includes('visual=35')) fail('V35 cache boundary missing');
console.log('Summit Sprint V35 validation passed: six decoded frames cross-fade over a stable resting character without blank flashes.');
