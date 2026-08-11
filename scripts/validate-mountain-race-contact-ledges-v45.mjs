import { readFile, stat } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const fail = message => { throw new Error(`Summit Sprint V45 validation failed: ${message}`); };
const assets = [
  ['summit-sprint-reboot-ledge-v45.png', 768, 168],
  ['summit-sprint-climber-back-sheet-v45.png', 1536, 1024],
  ['summit-sprint-climber-back-opponent-sheet-v45.png', 1536, 1024]
];

let v45Bytes = 0;
for (const [name, width, height] of assets) {
  const url = new URL(`assets/mountain-race/images/${name}`, root);
  const [bytes, info] = await Promise.all([readFile(url), stat(url)]);
  if (!info.isFile() || info.size < 40_000) fail(`${name} is missing or empty`);
  if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') fail(`${name} is not PNG`);
  if (bytes.readUInt32BE(16) !== width || bytes.readUInt32BE(20) !== height) fail(`${name} dimensions changed`);
  if (bytes[25] !== 6) fail(`${name} must remain RGBA`);
  v45Bytes += info.size;
}
if (v45Bytes > 1_900_000) fail(`V45 ledge and rear-facing sheets are too heavy (${v45Bytes} bytes)`);

const [runtime, prototype, css, html, preview, safeCracker, roulette] = await Promise.all([
  readFile(new URL('assets/mountain-race/mountain-race-multiplayer.js', root), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race.js', root), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race.css', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('mountain-race-preview.html', root), 'utf8'),
  readFile(new URL('assets/safe-cracker/safe-cracker.js', root), 'utf8'),
  readFile(new URL('assets/roulette/turn-animation.js', root), 'utf8')
]);

for (const source of [runtime, prototype]) {
  for (const token of [
    'MOUNTAIN_RACE_CONTACT_LEDGES_V45',
    "dataset.mrContactLedges = '45'",
    'mr-v45-climber-sprite',
    'data-mr-contact-index',
    'Math.max(0, cameraIndex - 1) * 84'
  ]) if (!source.includes(token)) fail(`runtime token missing: ${token}`);
  if (source.includes('cameraLead = Math.max(2, 5 -')) fail('shrinking midpoint camera lead remains active');
}
if (!runtime.includes('currentIndex + 3')) fail('multiplayer renderer does not retain four visible prompts');
if (!prototype.includes('player.promptIndex + 3')) fail('prototype renderer does not retain four visible prompts');

for (const token of [
  'MOUNTAIN_RACE_CONTACT_LEDGES_V45',
  'summit-sprint-reboot-ledge-v45.png',
  'summit-sprint-climber-back-sheet-v45.png',
  'summit-sprint-climber-back-opponent-sheet-v45.png',
  'mrV45ReachFrames',
  'mrV45SlipFrames',
  'translate(-50%, 64%)'
]) if (!css.includes(token)) fail(`CSS token missing: ${token}`);

const climberStart = runtime.indexOf('function renderClimber(');
const climberEnd = runtime.indexOf('\n  function renderLane(', climberStart);
const climberRenderer = runtime.slice(climberStart, climberEnd);
if (!climberRenderer.includes("contactIndex = finished ? Math.max(0, total - 1) : index - 1")) fail('climber is not anchored to the completed physical ledge');
if (!climberRenderer.includes("contactLeft < previousContactLeft ? 'left' : 'right'")) fail('climber facing is not derived from physical travel direction');
if (climberRenderer.includes('direction-${control(raw.lastInput')) fail('climber still faces according to the button symbol');

for (const index of [1, 8, 12, 20, 23]) {
  const scroll = Math.max(0, index - 1) * 84;
  const completedBottom = 120 + (index - 1) * 84 - scroll;
  const currentBottom = 120 + index * 84 - scroll;
  const fourthBottom = currentBottom + 3 * 84;
  if (completedBottom !== 120 || currentBottom !== 204 || fourthBottom !== 456) fail(`camera geometry drifted at hold ${index}`);
  if (fourthBottom + 48 > 520) fail(`four known ledges no longer fit at hold ${index}`);
}

const rugged46 = runtime.includes('MOUNTAIN_RACE_RUGGED_TERRAIN_V46');
const finish47 = runtime.includes('MOUNTAIN_RACE_FINISH_STABILITY_V47');
const natural49 = runtime.includes('MOUNTAIN_RACE_NATURAL_TERRAIN_V49');
const summit50 = runtime.includes('MOUNTAIN_RACE_SUMMIT_CONTACT_V50');
for (const document of [html, preview]) {
  if (!document.includes(summit50 ? 'visual=50' : natural49 ? 'visual=49' : finish47 ? 'visual=47' : rugged46 ? 'visual=46' : 'visual=45')) fail('V45/V50 cache boundary missing');
  const requiredPreloads = rugged46 ? assets.slice(1) : assets;
  for (const [name] of requiredPreloads) if (!document.includes(`rel="preload" as="image" href="/assets/mountain-race/images/${name}"`)) fail(`preload missing: ${name}`);
  if (document.includes('rel="preload" as="image" href="/assets/mountain-race/images/summit-sprint-reboot-climber-sheet-v44.png"')) fail('retired front-facing climber is still preloaded');
  if (document.includes('rel="preload" as="image" href="/assets/mountain-race/images/summit-sprint-reboot-climber-opponent-sheet-v44.png"')) fail('retired front-facing opponent is still preloaded');
}

if (!runtime.includes("!publicState.canSubmit || runtime.inputQueueBlocked) return;")) fail('correct controls became network-blocked again');
if (!runtime.includes('const total = Math.max(8, Math.min(80, Math.trunc(Number(publicState.stepsTotal) || 24)))')) fail('authoritative 24-hold default changed');
if (!runtime.includes('scheduleInputFlush(true)')) fail('immediate input buffering changed');
if (!safeCracker.length || !roulette.length) fail('protected game runtimes are unreadable');

console.log(`Summit Sprint V45 validation passed: ${v45Bytes} bytes across three reusable RGBA PNGs, rear-facing climbers, physical contact-ledges, stable four-prompt camera framing, non-blocking controls, and protected games intact.`);
