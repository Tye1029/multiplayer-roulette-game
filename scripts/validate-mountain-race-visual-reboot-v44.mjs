import { readFile, stat } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const fail = message => { throw new Error(`Summit Sprint V44 validation failed: ${message}`); };
const assetNames = [
  'summit-sprint-reboot-background-v44.png',
  'summit-sprint-reboot-cliff-v44.png',
  'summit-sprint-reboot-climber-sheet-v44.png',
  'summit-sprint-reboot-climber-opponent-sheet-v44.png'
];
let totalBytes = 0;
for (const name of assetNames) {
  const url = new URL(`assets/mountain-race/images/${name}`, root);
  const [bytes, info] = await Promise.all([readFile(url), stat(url)]);
  if (!info.isFile() || info.size < 40_000) fail(`${name} is missing or empty`);
  if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') fail(`${name} is not PNG`);
  totalBytes += info.size;
}
if (totalBytes > 6_000_000) fail(`reboot assets are too heavy (${totalBytes} bytes)`);

const sprite = await readFile(new URL('assets/mountain-race/images/summit-sprint-reboot-climber-sheet-v44.png', root));
if (sprite.readUInt32BE(16) !== 1536 || sprite.readUInt32BE(20) !== 1024 || sprite[25] !== 6) fail('climber sheet must remain a 1536x1024 RGBA PNG');
const opponentSprite = await readFile(new URL('assets/mountain-race/images/summit-sprint-reboot-climber-opponent-sheet-v44.png', root));
if (opponentSprite.readUInt32BE(16) !== 1536 || opponentSprite.readUInt32BE(20) !== 1024 || opponentSprite[25] !== 6) fail('opponent sheet must remain a 1536x1024 RGBA PNG');

const [runtime, prototype, css, html, preview, safeCracker, roulette] = await Promise.all([
  readFile(new URL('assets/mountain-race/mountain-race-multiplayer.js', root), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race.js', root), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race.css', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('mountain-race-preview.html', root), 'utf8'),
  readFile(new URL('assets/safe-cracker/safe-cracker.js', root), 'utf8'),
  readFile(new URL('assets/roulette/turn-animation.js', root), 'utf8')
]);
const contact45 = runtime.includes('MOUNTAIN_RACE_CONTACT_LEDGES_V45');
const rugged46 = runtime.includes('MOUNTAIN_RACE_RUGGED_TERRAIN_V46');

for (const source of [runtime, prototype]) {
  for (const token of ['MOUNTAIN_RACE_VISUAL_REBOOT_V44', "dataset.mrVisualReboot = '44'", 'mr-v44-cliff', 'mr-v44-climber-sprite', ...(contact45 ? ['MOUNTAIN_RACE_CONTACT_LEDGES_V45'] : ['cameraLead'])]) {
    if (!source.includes(token)) fail(`runtime reboot token missing: ${token}`);
  }
}
if (!prototype.includes('morphMountainNode(previousGameElement, nextGameElement)')) fail('prototype still replaces the complete scene between moves');
for (const token of ['MOUNTAIN_RACE_VISUAL_REBOOT_V44', ...assetNames, 'mrV44ReachFrames', 'mrV44SlipFrames', 'background-size: 400% 200%']) {
  if (!css.includes(token)) fail(`CSS reboot token missing: ${token}`);
}
const holdsStart = runtime.indexOf('function renderHolds(');
const holdsEnd = runtime.indexOf('\n  function animationClass(', holdsStart);
const holdRenderer = runtime.slice(holdsStart, holdsEnd);
if (holdRenderer.includes('<img') || holdRenderer.includes('summit-sprint-hold-')) fail('legacy oversized hold PNGs remain in the active renderer');
const laneStart = runtime.indexOf('function renderLane(');
const laneEnd = runtime.indexOf('\n  function promptQueue(', laneStart);
const laneRenderer = runtime.slice(laneStart, laneEnd);
if (laneRenderer.includes('mr-cliff-art') || laneRenderer.includes('mr-start-art') || laneRenderer.includes('<img')) fail('legacy stacked terrain images remain in the active lane renderer');
if (!runtime.includes("!publicState.canSubmit || runtime.inputQueueBlocked) return;")) fail('correct controls are still blocked by in-flight network requests');
if (!runtime.includes("!presentation.blocked && !runtime.inputQueueBlocked;")) fail('control buttons still pause after every correct tap');
if (!runtime.includes('Math.max(0, total - 1)')) fail('unconfirmed clients can still display a false summit win');
if (!runtime.includes('scheduleInputFlush(true)')) fail('input buffering no longer starts immediately');
for (const document of [html, preview]) {
  if (!document.includes(rugged46 ? 'visual=46' : contact45 ? 'visual=45' : 'visual=44')) fail('V44/V46 cache boundary missing');
  const requiredPreloads = rugged46 ? assetNames.slice(0, 1) : contact45 ? assetNames.slice(0, 2) : assetNames;
  for (const name of requiredPreloads) if (!document.includes(`rel="preload" as="image" href="/assets/mountain-race/images/${name}"`)) fail(`preload missing: ${name}`);
}
if (!safeCracker.length || !roulette.length) fail('protected game runtimes are unreadable');
console.log(`Summit Sprint V44 validation passed for the active ${rugged46 ? 'V46 rugged-terrain presentation' : contact45 ? 'V45 contact-ledges presentation' : 'V44 presentation'}: ${totalBytes} retained bytes, persistent sprite nodes, live holds, non-blocking correct inputs, and protected game runtimes intact.`);
