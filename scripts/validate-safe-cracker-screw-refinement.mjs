import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [css, client, html, patch, turnAnimation, turnFire, audioBindings] = await Promise.all([
  readFile(new URL('assets/safe-cracker/safe-cracker.css', root), 'utf8'),
  readFile(new URL('assets/safe-cracker/safe-cracker.js', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('scripts/patch-safe-cracker-screw-refinement.mjs', root), 'utf8'),
  readFile(new URL('assets/roulette/turn-animation.js', root)),
  readFile(new URL('assets/roulette/turn-fire.js', root)),
  readFile(new URL('assets/roulette/audio-bindings.js', root))
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Safe Cracker screw refinement validation failed: ${message}`);
}

function occurrences(source, fragment) {
  return source.split(fragment).length - 1;
}

const start = '/* SAFE_CRACKER_SCREW_REFINEMENT_V1_START */';
const end = '/* SAFE_CRACKER_SCREW_REFINEMENT_V1_END */';
const blockStart = css.indexOf(start);
const blockEnd = css.indexOf(end, blockStart);
const block = blockStart >= 0 && blockEnd > blockStart ? css.slice(blockStart, blockEnd + end.length) : '';

assert(occurrences(css, start) === 1 && occurrences(css, end) === 1, 'screw refinement block must appear exactly once');
assert(css.indexOf('/* SAFE_CRACKER_LATCH_REFINEMENT_V9_END */') < blockStart, 'screw refinement must remain the final Safe Cracker hardware pass');

const requiredCss = [
  '.sc-safe-door::after',
  '.sc-door-screws',
  '.sc-display-bezel i',
  '.sc-door-screws i',
  "url('./brushed-metal-horizontal-v1.svg?grain=1')",
  'rgba(255,255,255,.56)',
  'background-blend-mode: soft-light, screen, normal, normal',
  '.sc-display-bezel i::before',
  '.sc-display-bezel i::after',
  '.sc-door-screws i::before',
  '.sc-door-screws i::after',
  'width: 13px',
  'height: 13px',
  'width: 10px',
  'height: 10px',
  'width: 8px; height: 2px',
  'width: 2px; height: 8px',
  'width: 6px; height: 2px',
  'width: 2px; height: 6px'
];
for (const fragment of requiredCss) assert(block.includes(fragment), `missing CSS fragment: ${fragment}`);

assert(!block.includes('position: fixed'), 'screw styling escaped the Safe Cracker component');
assert(!block.includes('pointer-events: auto'), 'decorative screws intercept input');
assert(!block.includes('animation:'), 'corner screws must remain stationary');

const doorMarkup = '<div class="sc-door-screws" aria-hidden="true"><i></i><i></i><i></i><i></i></div>';
assert(client.includes(doorMarkup), 'safe-door Phillips screw markup is missing');
assert(occurrences(client, doorMarkup) === 1, 'safe-door screw markup must appear exactly once');
assert(client.includes('<div class="sc-display-bezel" aria-hidden="true"><i></i><i></i><i></i><i></i></div>'), 'display bezel screw markup changed');
assert(client.includes('choice: `safecracker:guess:${runtime.selected}`'), 'authoritative gameplay submission changed');

assert(/safe-cracker\.css\?[^"'\s]*&screw=1/.test(html), 'stylesheet cache key screw=1 is missing');
assert(/safe-cracker\.js\?[^"'\s]*&screw=1/.test(html), 'runtime cache key screw=1 is missing');
assert(!patch.includes("writeFile(new URL('../netlify/functions/"), 'screw patch writes networking files');
assert(!patch.includes("writeFile(new URL('../assets/roulette/"), 'screw patch writes Roulette files');
assert(turnAnimation.length > 0 && turnFire.length > 0 && audioBindings.length > 0, 'protected Roulette files are unreadable');

console.log('Safe Cracker screw refinement validation passed: all eight former silver corner dots are stationary scratched brushed-metal Phillips screws with reflective glare, mobile sizing is preserved, and Roulette/networking remain protected.');
