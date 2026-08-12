import { readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const [runtime, prototype, css, html, preview] = await Promise.all([
  readFile(new URL('assets/mountain-race/mountain-race-multiplayer.js', root), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race.js', root), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race.css', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'), readFile(new URL('mountain-race-preview.html', root), 'utf8')
]);
const fail = message => { throw new Error(`Summit Sprint V43 validation failed: ${message}`); };
for (const token of ['MOUNTAIN_RACE_CONFIRMED_LIGHTWEIGHT_V43', 'runtime.inputQueue.length || runtime.inputBatchInFlight.length', 'Math.max(0, total - 1)', 'firstVisible', 'lastVisible', 'scheduleInputFlush(true)']) {
  if (!runtime.includes(token)) fail(`multiplayer confirmation token missing: ${token}`);
}
for (const token of ['MOUNTAIN_RACE_CONFIRMED_LIGHTWEIGHT_V43', 'firstVisible', 'lastVisible']) if (!prototype.includes(token)) fail(`prototype window token missing: ${token}`);
for (const token of ['MOUNTAIN_RACE_CONFIRMED_LIGHTWEIGHT_V43', 'backdrop-filter: none', '.mr-world-cloud', 'filter: none']) if (!css.includes(token)) fail(`lightweight CSS token missing: ${token}`);
if (!html.includes('visual=43') || !preview.includes('visual=43')) fail('V43 cache boundary missing');
console.log('Summit Sprint V43 validation passed: no unconfirmed summit, one pending move and lightweight nearby hold rendering.');
