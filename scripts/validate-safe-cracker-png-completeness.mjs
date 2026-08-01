import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [css, index, patch, client, turnAnimation, turnFire, audioBindings] = await Promise.all([
  readFile(new URL('assets/safe-cracker/safe-cracker.css', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('scripts/patch-safe-cracker-png-completeness.mjs', root), 'utf8'),
  readFile(new URL('assets/safe-cracker/safe-cracker.js', root), 'utf8'),
  readFile(new URL('assets/roulette/turn-animation.js', root)),
  readFile(new URL('assets/roulette/turn-fire.js', root)),
  readFile(new URL('assets/roulette/audio-bindings.js', root))
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Safe Cracker PNG completeness validation failed: ${message}`);
}
function occurrences(source, value) {
  return source.split(value).length - 1;
}

assert(occurrences(css, '/* SAFE_CRACKER_PNG_COMPLETENESS_V16_START */') === 1, 'v16 start marker must appear exactly once');
assert(occurrences(css, '/* SAFE_CRACKER_PNG_COMPLETENESS_V16_END */') === 1, 'v16 end marker must appear exactly once');
assert(css.includes('clip-path: none !important') && css.includes('-webkit-clip-path: none !important'), 'legacy trapezoid clipping is not fully reset');
assert(css.includes('.sc-safe-door::after') && css.includes('top: 81.8%'), 'missing lower safe apron was not restored');
assert(css.includes('.sc-confirm-button') && css.includes('left: 15.5%') && css.includes('width: 69%'), 'confirmation plate is not restored and aligned');
assert(css.includes('.sc-step-controls') && css.includes('top: 72.15%') && css.includes('height: 8.25%'), 'minus and plus frames are incomplete');
assert(css.includes("url('/assets/safe-cracker/png-ui/safe-body.png?v=3')"), 'completed safe body cache version is missing');
assert(css.includes('.sc-safe-shell::before') && css.includes('.sc-safe-shell::after'), 'outer gold frame and light reflection are missing');
assert(index.includes('&png=1&complete=1'), 'v16 cache bust is missing');
assert(client.includes('choice: `safecracker:guess:${runtime.selected}`'), 'authoritative Safe Cracker submission changed');
assert(client.includes('// SAFE_CRACKER_RUNTIME_STABILITY_V12_START'), 'runtime stability protection is missing');
assert(turnAnimation.length > 0 && turnFire.length > 0 && audioBindings.length > 0, 'protected Roulette assets are unreadable');
assert(!patch.includes("writeFile(new URL('../netlify/functions/"), 'completeness patch must not alter networking');
assert(!patch.includes("writeFile(new URL('../assets/roulette/"), 'completeness patch must not alter Roulette assets');

console.log('Safe Cracker PNG completeness passed: full safe shell, lower frame, confirmation plate, control depth, unclipped display, live dial, authoritative gameplay, and Roulette boundaries are intact.');
