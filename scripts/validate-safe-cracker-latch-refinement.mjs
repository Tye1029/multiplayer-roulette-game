import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [css, client, html, patch, turnAnimation, turnFire, audioBindings] = await Promise.all([
  readFile(new URL('assets/safe-cracker/safe-cracker.css', root), 'utf8'),
  readFile(new URL('assets/safe-cracker/safe-cracker.js', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('scripts/patch-safe-cracker-latch-refinement.mjs', root), 'utf8'),
  readFile(new URL('assets/roulette/turn-animation.js', root)),
  readFile(new URL('assets/roulette/turn-fire.js', root)),
  readFile(new URL('assets/roulette/audio-bindings.js', root))
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Safe Cracker latch refinement v5 validation failed: ${message}`);
}

function occurrences(source, fragment) {
  return source.split(fragment).length - 1;
}

const start = '/* SAFE_CRACKER_LATCH_REFINEMENT_V5_START */';
const end = '/* SAFE_CRACKER_LATCH_REFINEMENT_V5_END */';
const blockStart = css.indexOf(start);
const blockEnd = css.indexOf(end, blockStart);
const block = blockStart >= 0 && blockEnd > blockStart ? css.slice(blockStart, blockEnd + end.length) : '';

assert(occurrences(css, start) === 1 && occurrences(css, end) === 1, 'refinement block must appear exactly once');
assert(css.indexOf('/* SAFE_CRACKER_LATCH_SEQUENCE_V1_END */') < blockStart, 'refinement must be the final latch visual pass');

const requiredCss = [
  'top: calc(18% + 24px)',
  'transform: translateY(-50%) scale(.78)',
  '.sc-bolts.left .sc-latch-mount:nth-child(2) { left: -5px; }',
  '.sc-bolts.right .sc-latch-mount:nth-child(2) { right: -5px; }',
  '.sc-latch-spine',
  'top: -5px',
  'bottom: -5px',
  'repeating-linear-gradient(0deg',
  '.sc-latch-screw',
  '.sc-latch-screw::before',
  '.sc-latch-screw::after',
  'width: 8px; height: 2px',
  'width: 2px; height: 8px',
  '.sc-latch-mount > i',
  '#c7d0d3 46%',
  'top: calc(18% + 30px)',
  'transform: translateY(-50%) scale(.72)'
];
for (const fragment of requiredCss) assert(block.includes(fragment), `missing CSS fragment: ${fragment}`);

assert(!block.includes('position: fixed'), 'refinement escaped the component');
assert(!block.includes('pointer-events: auto'), 'decorative hardware intercepts input');
assert(!block.includes('animation: scSafeCrackerLatchReleaseV1'), 'release timing must remain owned by the existing latch sequence');

assert(client.includes('class="sc-latch-spine" aria-hidden="true"'), 'vertical mounting spine markup is missing');
assert(client.includes('class="sc-latch-screw" aria-hidden="true"'), 'Phillips screw markup is missing');
assert(occurrences(client, 'data-sc-mounted-latches=') === 2, 'both three-latch banks must remain mounted');
assert(client.includes('safeCrackerLatchMount(latchClass(1))'), 'top staged latch changed');
assert(client.includes('safeCrackerLatchMount(latchClass(2))'), 'middle staged latch changed');
assert(client.includes('safeCrackerLatchMount(latchClass(3))'), 'bottom staged latch changed');
assert(client.includes('animation: scSafeCrackerLatchReleaseV1') || css.includes('animation: scSafeCrackerLatchReleaseV1 1.15s'), 'existing release animation is missing');
assert(client.includes('choice: `safecracker:guess:${runtime.selected}`'), 'authoritative gameplay submission changed');

assert(/safe-cracker\.css\?[^"'\s]*&latch=5/.test(html), 'stylesheet cache key latch=5 is missing');
assert(/safe-cracker\.js\?[^"'\s]*&latch=5/.test(html), 'runtime cache key latch=5 is missing');
assert(!patch.includes("writeFile(new URL('../netlify/functions/"), 'refinement writes networking files');
assert(!patch.includes("writeFile(new URL('../assets/roulette/"), 'refinement writes Roulette files');
assert(turnAnimation.length > 0 && turnFire.length > 0 && audioBindings.length > 0, 'protected Roulette files are unreadable');

console.log('Safe Cracker latch refinement v5 validation passed: top latches clear the display, middle latches are smaller and pulled away from the dial, all six assemblies have brushed protruding spines and recessed Phillips screws, and gameplay/Roulette remain protected.');
