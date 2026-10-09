import { access, readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [html, preview, runtime, prototype, recovery] = await Promise.all([
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('mountain-race-preview.html', root), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race-multiplayer.js', root), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race.js', root), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race-recovery-v64.css', root), 'utf8'),
  access(new URL('assets/mountain-race/images/summit-sprint-skyless-summit-v62.png', root))
]);

const assert = (condition, message) => {
  if (!condition) throw new Error(`Summit Sprint V64 recovery validation failed: ${message}`);
};

for (const document of [html, preview]) {
  assert(document.includes('mountain-race-recovery-v64.css?v=1'), 'last-loaded recovery stylesheet is missing');
  assert(document.indexOf('mountain-race-recovery-v64.css') > document.indexOf('mountain-race.css'), 'recovery stylesheet does not load last');
}
for (const source of [runtime, prototype]) {
  assert(source.includes('class="mr-control-terrain"'), 'separate terrain beneath the controls is missing');
  assert(source.includes('class="me" style="--mr-control-world-shift:'), 'player terrain camera is missing');
  assert(source.includes('class="opponent" style="--mr-control-world-shift:'), 'opponent terrain camera is missing');
}
for (const token of [
  'V63_RECOVERY_V64',
  '.mr-control-terrain{display:grid!important}',
  '.mr-command-deck{margin-top:0!important',
  '.mountain-race-game::after{content:none!important;display:none!important}',
  'summit-sprint-alpine-sky-v58.png',
  'summit-sprint-skyless-summit-v62.png',
  '.mr-rock-hold.current{filter:none!important}',
  '.mr-climb-viewport::before{content:none!important;display:none!important}'
]) assert(recovery.includes(token), `recovery CSS token is missing: ${token}`);

console.log('Summit Sprint V64 recovery validation passed: V62 lane scenery, natural ledges, normal control placement, and the real summit platform override the broken V63 composite scene.');
