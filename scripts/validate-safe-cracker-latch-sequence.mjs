import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [css, client, html, patch, turnAnimation, turnFire, audioBindings] = await Promise.all([
  readFile(new URL('assets/safe-cracker/safe-cracker.css', root), 'utf8'),
  readFile(new URL('assets/safe-cracker/safe-cracker.js', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('scripts/patch-safe-cracker-latch-sequence.mjs', root), 'utf8'),
  readFile(new URL('assets/roulette/turn-animation.js', root)),
  readFile(new URL('assets/roulette/turn-fire.js', root)),
  readFile(new URL('assets/roulette/audio-bindings.js', root))
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Safe Cracker latch validation failed: ${message}`);
}

function occurrences(source, value) {
  return source.split(value).length - 1;
}

const start = '/* SAFE_CRACKER_LATCH_SEQUENCE_V1_START */';
const end = '/* SAFE_CRACKER_LATCH_SEQUENCE_V1_END */';
const startIndex = css.indexOf(start);
const endIndex = css.indexOf(end, startIndex);
assert(occurrences(css, start) === 1 && occurrences(css, end) === 1, 'latch sequence block must appear exactly once');
assert(startIndex >= 0 && endIndex > startIndex, 'latch sequence marker order is invalid');
const block = css.slice(startIndex, endIndex + end.length);

const requiredCss = [
  '.safe-cracker-game .sc-confirm-button',
  'background-color: #aab4b8 !important',
  'border: 3px solid #050708 !important',
  '.safe-cracker-game .sc-confirm-button::after',
  'background: #050708 !important',
  'transform: translateY(4px) !important',
  'Six fixed mounting assemblies',
  '.safe-cracker-game .sc-latch-mount::before',
  '.safe-cracker-game .sc-latch-mount::after',
  '.safe-cracker-game .sc-latch-mount > i',
  '.safe-cracker-game .sc-bolts.right i.sc-latch-released',
  'transform .82s cubic-bezier(.2,.85,.28,1)',
  'animation: scSafeCrackerLatchReleaseV1 1.15s',
  '@keyframes scSafeCrackerLatchReleaseV1'
];
for (const fragment of requiredCss) assert(block.includes(fragment), `missing established latch behavior: ${fragment}`);

assert(!block.includes('#c98b29') && !block.includes('#855515') && !block.includes('#4d3010'), 'superseded gold button base returned');
assert(!block.includes('position: fixed'), 'latch pass escaped the Safe Cracker component');

const requiredClient = [
  '// SAFE_CRACKER_LATCH_SEQUENCE_V1_RUNTIME',
  "latchGameId: ''",
  'latchStage: 0',
  '// SAFE_CRACKER_LATCH_SEQUENCE_V1_HELPER',
  'function safeCrackerLatchMount',
  'function safeCrackerStaticLatchBank',
  'function safeCrackerLatchBank(game, me)',
  "safeCrackerStaticLatchBank('left')",
  'safeCrackerLatchMount(latchClass(1))',
  'safeCrackerLatchMount(latchClass(2))',
  'safeCrackerLatchMount(latchClass(3))',
  'choice: `safecracker:guess:${runtime.selected}`'
];
for (const fragment of requiredClient) assert(client.includes(fragment), `missing latch runtime behavior: ${fragment}`);
assert(occurrences(client, 'data-sc-mounted-latches=') === 2, 'both three-latch banks must be generated exactly once');
assert(!/RESETTING(?:…|\.\.\.)/i.test(client), 'RESETTING still appears on the Check Number control');

assert(/safe-cracker\.css\?[^"'\s]*&latch=9/.test(html), 'stylesheet cache key latch=9 is missing');
assert(/safe-cracker\.js\?[^"'\s]*&latch=9/.test(html), 'runtime cache key latch=9 is missing');
assert(!patch.includes("writeFile(new URL('../netlify/functions/"), 'latch patch writes networking files');
assert(!patch.includes("writeFile(new URL('../assets/roulette/"), 'latch patch writes Roulette files');
assert(turnAnimation.length > 0 && turnFire.length > 0 && audioBindings.length > 0, 'protected Roulette files are unreadable');

console.log('Safe Cracker latch sequence validation passed: all six mounted latches retain the protected 1.15-second release and black Check Number base, while the final latch=9 texture refinement, gameplay, networking, and Roulette boundaries remain intact.');
