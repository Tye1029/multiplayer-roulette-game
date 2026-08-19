import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [client, css, index, patch, data, turnAnimation, turnFire] = await Promise.all([
  readFile(new URL('assets/safe-cracker/safe-cracker.js', root), 'utf8'),
  readFile(new URL('assets/safe-cracker/safe-cracker.css', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('scripts/patch-safe-cracker-visual-refinement.mjs', root), 'utf8'),
  readFile(new URL('netlify/functions/_data.js', root), 'utf8'),
  readFile(new URL('assets/roulette/turn-animation.js', root)),
  readFile(new URL('assets/roulette/turn-fire.js', root))
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Safe Cracker visual-refinement validation failed: ${message}`);
}

function occurrences(source, value) {
  return source.split(value).length - 1;
}

assert(occurrences(css, '/* SAFE_CRACKER_VISUAL_REFINEMENT_V7_START */') === 1, 'visual refinement marker must appear exactly once');
assert(occurrences(css, '/* SAFE_CRACKER_VISUAL_REFINEMENT_V7_END */') === 1, 'visual refinement end marker must appear exactly once');
assert(css.includes('--sc-refine-steel-hi'), 'shared steel material tokens are missing');
assert(css.includes('--sc-refine-brass-hi'), 'shared brass material tokens are missing');
assert(css.includes('.safe-cracker-game:has(.sc-display.green)'), 'confirmed-number environmental lighting is missing');
assert(css.includes('.safe-cracker-game:has(.sc-display.yellow)'), 'near-number environmental lighting is missing');
assert(css.includes('grid-template-columns: minmax(0, 1fr) 70px minmax(0, 1fr);'), 'top HUD is not balanced around the timer');
assert(css.includes('text-overflow: ellipsis;'), 'long player names are not safely truncated');
assert(css.includes('.sc-known-code span.known'), 'locked-code mechanical windows are missing');
assert(css.includes('radial-gradient(circle, #b3bdc1 0 2px'), 'safe hinge hardware treatment is missing');
assert(css.includes('.sc-safe-shell.sc-gameplay-win::before'), 'win cavity refinement is missing');
assert(css.includes('border-right: 7px solid #171d20;'), 'opened safe door thickness is missing');
assert(css.includes('.sc-confirm-button:disabled'), 'physically locked disabled confirmation state is missing');
assert(css.includes('.sc-timer.danger'), 'restrained final-seconds timer treatment is missing');
assert(css.includes('@media (max-width: 700px) and (max-height: 760px)'), 'short-phone composition pass is missing');
assert(css.includes('@media (min-width: 390px) and (min-height: 840px) and (max-width: 700px)'), 'tall-phone composition pass is missing');
assert(index.includes('/assets/safe-cracker/safe-cracker.css?v=8&polish=2&fit=2&result=1&final=1&refine=1'), 'visual-refinement stylesheet is not cache-busted');
assert(index.includes('/assets/safe-cracker/safe-cracker.js?v=8&polish=2&fit=2&result=1&final=1&refine=1'), 'visual-refinement runtime URL is not synchronized');
assert(client.includes("choice: `safecracker:guess:${runtime.selected}`"), 'visual refinement changed authoritative guess submission');
assert(client.includes('// SAFE_CRACKER_RESULT_FLOW_V5_START'), 'gameplay-safe opening pass is missing beneath visual refinement');
assert(client.includes('// SAFE_CRACKER_FINAL_POLISH_V6_START'), 'final motion/result polish is missing beneath visual refinement');
assert(data.includes('// SAFE_CRACKER_DIRECT_COMPLETION_START'), 'visual refinement disturbed direct completion');
assert(turnAnimation.length > 0 && turnFire.length > 0, 'protected Roulette assets could not be read');
assert(!patch.includes("writeFile(new URL('../netlify/functions/_data.js'"), 'visual-refinement patch must not write server gameplay');
assert(!patch.includes("writeFile(new URL('../assets/roulette/turn-animation.js'"), 'visual-refinement patch must not write protected Roulette turn animation');
assert(!patch.includes("writeFile(new URL('../assets/roulette/turn-fire.js'"), 'visual-refinement patch must not write protected Roulette firing animation');

console.log('Safe Cracker visual-refinement validation passed: safe depth, unified materials, HUD hierarchy, state lighting, typography, and phone-height composition are present without gameplay or Roulette changes.');
