import { readFile, stat } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [runtime, prototypeRuntime, css, html, preview] = await Promise.all([
  readFile(new URL('assets/mountain-race/mountain-race-multiplayer.js', root), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race.js', root), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race.css', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('mountain-race-preview.html', root), 'utf8')
]);

const fail = message => { throw new Error(`Summit Sprint V32 validation failed: ${message}`); };
for (const asset of ['summit-sprint-climber-blue-v32.png', 'summit-sprint-climber-orange-v32.png']) {
  const info = await stat(new URL(`assets/mountain-race/images/${asset}`, root));
  if (info.size < 100000) fail(`realistic climber asset is missing or too small: ${asset}`);
  if (!css.includes(asset)) fail(`CSS does not consume ${asset}`);
}
for (const token of ['MOUNTAIN_RACE_REALISTIC_CLIMBERS_V32', 'winnerConfetti()', '}, 1750);']) {
  if (!runtime.includes(token)) fail(`multiplayer celebration token missing: ${token}`);
}
if (!prototypeRuntime.includes('MOUNTAIN_RACE_REALISTIC_CLIMBERS_V32') || !prototypeRuntime.includes('winnerConfetti()')) fail('prototype celebration is missing');
for (const token of ['mrV32Grab', 'mrV32Victory', 'mrV32Confetti', 'background-size: 200% 100%']) {
  if (!css.includes(token)) fail(`character presentation token missing: ${token}`);
}
if (!html.includes('visual=32') || !preview.includes('visual=32')) fail('V32 cache boundary missing');
console.log('Summit Sprint V32 realistic climber, grip animation, winner celebration, confetti, and result-delay validation passed.');
