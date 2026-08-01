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
assert(css.includes("url('/assets/safe-cracker/png-ui/safe-body.png?v=4')"), 'complete safe body cache version is missing');
assert(css.includes("url('/assets/safe-cracker/png-ui/dial-face.png?v=4')"), 'complete 226px dial cache version is missing');
assert(css.includes('clip-path: none !important') && css.includes('-webkit-clip-path: none !important'), 'legacy trapezoid clipping is not fully reset');
assert(css.includes('.sc-safe-door::after') && css.includes('display: none !important') && css.includes('background: none !important'), 'generated lower apron can still cover the supplied body');
assert(css.includes('left: 23.843%') && css.includes('top: 9.269%') && css.includes('width: 52.315%'), 'live display is not aligned to the complete body opening');
assert(css.includes('left: 24.306%') && css.includes('top: 28.520%') && css.includes('width: 51.620%'), 'complete rotating dial is not aligned');
assert(css.includes('left: 31.713%') && css.includes('top: 73.797%') && css.includes('gap: 18.354%'), 'minus and plus controls are not fitted to the photographed frames');
assert(css.includes('left: 21.065%') && css.includes('top: 87.344%') && css.includes('width: 58.102%'), 'Check Number is not fitted to the photographed lower frame');
assert(css.includes('.sc-result-title') && css.includes('color: #f2c86e !important'), 'warm result title hierarchy is missing');
assert(css.includes('.sc-result-code-card b') && css.includes('color: #f5d27e !important'), 'result code colors are missing');
assert(index.includes('&png=1&complete=2'), 'complete artwork cache bust is missing');
assert(client.includes('choice: `safecracker:guess:${runtime.selected}`'), 'authoritative Safe Cracker submission changed');
assert(client.includes('// SAFE_CRACKER_RUNTIME_STABILITY_V12_START'), 'runtime stability protection is missing');
assert(client.includes('// SAFE_CRACKER_SAMPLE_MIX_V11_START'), 'sample mix protection is missing');
assert(turnAnimation.length > 0 && turnFire.length > 0 && audioBindings.length > 0, 'protected Roulette assets are unreadable');
assert(!patch.includes("writeFile(new URL('../netlify/functions/"), 'completeness patch must not alter networking');
assert(!patch.includes("writeFile(new URL('../assets/roulette/"), 'completeness patch must not alter Roulette assets');

console.log('Safe Cracker PNG completeness passed: full supplied safe body, complete rotating dial, photographed lower frame, unclipped display, aligned live controls, warm results, authoritative gameplay, and Roulette boundaries are intact.');
