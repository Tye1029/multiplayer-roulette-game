import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [css, html, patch, turnAnimation, turnFire, audioBindings] = await Promise.all([
  readFile(new URL('assets/safe-cracker/safe-cracker.css', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('scripts/patch-safe-cracker-control-trim.mjs', root), 'utf8'),
  readFile(new URL('assets/roulette/turn-animation.js', root)),
  readFile(new URL('assets/roulette/turn-fire.js', root)),
  readFile(new URL('assets/roulette/audio-bindings.js', root))
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Safe Cracker control trim validation failed: ${message}`);
}

function occurrences(source, fragment) {
  return source.split(fragment).length - 1;
}

const start = '/* SAFE_CRACKER_CONTROL_TRIM_V1_START */';
const end = '/* SAFE_CRACKER_CONTROL_TRIM_V1_END */';
const blockStart = css.indexOf(start);
const blockEnd = css.indexOf(end, blockStart);
const block = blockStart >= 0 && blockEnd > blockStart ? css.slice(blockStart, blockEnd + end.length) : '';

assert(occurrences(css, start) === 1 && occurrences(css, end) === 1, 'control trim block must appear exactly once');
assert(css.indexOf('/* SAFE_CRACKER_SCREW_REFINEMENT_V1_END */') < blockStart, 'control trim must remain the final Safe Cracker visual pass');

const requiredCss = [
  '.sc-dial-wrap::after',
  '.sc-step-controls button',
  '.sc-display',
  '.sc-confirm-button',
  'outline: 1px solid rgba(224, 232, 235, .96)',
  'outline-offset: -2px',
  'border-color: #667278',
  'border-color: #4f5b60',
  "font-family: Impact, Haettenschweiler, 'Arial Black', 'Segoe UI Black', sans-serif",
  'font-size: 1.12rem',
  'font-weight: 900',
  'letter-spacing: .105em',
  'font-size: 1rem',
  'outline-offset: -1px'
];
for (const fragment of requiredCss) assert(block.includes(fragment), `missing CSS fragment: ${fragment}`);

assert(!block.includes('position: fixed'), 'control trim escaped the Safe Cracker component');
assert(!block.includes('pointer-events: auto'), 'control trim intercepts input');
assert(!block.includes('animation:'), 'control trim added unrelated animation');
assert(!patch.includes("writeFile(new URL('../netlify/functions/"), 'control trim writes networking files');
assert(!patch.includes("writeFile(new URL('../assets/roulette/"), 'control trim writes Roulette files');
assert(turnAnimation.length > 0 && turnFire.length > 0 && audioBindings.length > 0, 'protected Roulette files are unreadable');

assert(/safe-cracker\.css\?[^"'\s]*&trim=1/.test(html), 'stylesheet cache key trim=1 is missing');
assert(/safe-cracker\.js\?[^"'\s]*&trim=1/.test(html), 'runtime cache key trim=1 is missing');

console.log('Safe Cracker control trim validation passed: the pointer housing, step buttons, digital display, and Check Number control share the polished one-pixel silver trim, Check Number lettering is larger and blockier, mobile sizing is preserved, and Roulette/networking remain protected.');
