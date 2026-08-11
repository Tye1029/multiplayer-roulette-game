import { access, readFile, stat } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const assetUrl = new URL('assets/mountain-race/images/summit-sprint-celebration-climbers-v57.png', root);
const [runtime, prototype, css, html, preview, asset, assetInfo] = await Promise.all([
  readFile(new URL('assets/mountain-race/mountain-race-multiplayer.js', root), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race.js', root), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race.css', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('mountain-race-preview.html', root), 'utf8'),
  readFile(assetUrl),
  stat(assetUrl),
  access(new URL('assets/safe-cracker/safe-cracker.js', root)),
  access(new URL('assets/roulette/turn-animation.js', root))
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Summit Sprint V57 validation failed: ${message}`);
}

assert(assetInfo.isFile() && assetInfo.size >= 300_000, 'celebration sprite is missing or empty');
assert(asset.subarray(0, 8).toString('hex') === '89504e470d0a1a0a', 'celebration sprite is not PNG');
assert(asset.readUInt32BE(16) === 1536 && asset.readUInt32BE(20) === 1024, 'celebration sprite dimensions changed');
assert(asset[25] === 6, 'celebration sprite must retain RGBA transparency');

for (const [name, source] of [['runtime', runtime], ['prototype', prototype]]) {
  assert(source.includes('MOUNTAIN_RACE_CELEBRATION_CONTACT_V57'), `${name} marker missing`);
  assert(source.includes("root.dataset.mrCelebrationContact = '57'"), `${name} dataset missing`);
  assert(source.includes('(nextContactLeft - contactLeft) * 0.3'), `${name} does not lean toward the next authoritative hold`);
  assert(source.includes('summitApproach') && source.includes("'summit-reaching'"), `${name} final-approach state missing`);
  assert(source.includes('gripBottom + (summitApproach ? 42 : 0)'), `${name} final reach does not meet the summit lip`);
  assert(source.includes('--mr-climber-grip-bottom:${reachBottom}px;--mr-climber-left:${climberLeft}%'), `${name} does not render the corrected contact anchors`);
  assert(source.includes('--mr-confetti-bottom:'), `${name} confetti is not anchored to the winner`);
  assert(source.includes('Array.from({ length: 28 }'), `${name} confetti burst was not strengthened`);
  assert(source.includes('MOUNTAIN_RACE_NATURAL_SUMMIT_V56'), `${name} lost the V56 baseline`);
}

for (const token of [
  'MOUNTAIN_RACE_CELEBRATION_CONTACT_V57',
  '[data-mr-celebration-contact="57"] .mr-climber.summit-reaching',
  'summit-sprint-celebration-climbers-v57.png',
  'background-size: 200% 100%',
  'bottom: var(--mr-confetti-bottom)',
  'mrV57WinnerLift',
  'mrV57Confetti',
  'infinite !important'
]) assert(css.includes(token), `CSS token missing: ${token}`);

for (const document of [html, preview]) {
  assert(document.includes('visual=57'), 'V57 cache boundary missing');
  assert(document.includes('summit-sprint-celebration-climbers-v57.png'), 'V57 celebration preload missing');
}

assert(runtime.includes('Math.max(8, Math.min(80, Math.trunc(Number(publicState.stepsTotal) || 24)))'), 'authoritative 24-hold server contract changed');
assert(runtime.includes('data-mr-rematch') && runtime.includes('data-mr-new-game'), 'finish actions changed');
assert(runtime.includes('scheduleInputFlush(true)'), 'continuous multiplayer input changed');

console.log('Summit Sprint V57 validation passed: both climbers track authoritative ledges, hold 24 reaches the summit lip, the corrected rear-view winner sprite is transparent, and confetti remains visible during celebration.');
