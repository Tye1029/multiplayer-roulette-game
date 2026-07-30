import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [client, css, index, patch] = await Promise.all([
  readFile(new URL('assets/safe-cracker/safe-cracker.js', root), 'utf8'),
  readFile(new URL('assets/safe-cracker/safe-cracker.css', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('scripts/patch-safe-cracker-visual-dial.mjs', root), 'utf8')
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Safe Cracker visual-dial validation failed: ${message}`);
}

function occurrences(source, value) {
  return source.split(value).length - 1;
}

assert(occurrences(css, '/* SAFE_CRACKER_VISUAL_DIAL_V2_START */') === 1, 'visual dial marker must appear exactly once');
assert(occurrences(css, '/* SAFE_CRACKER_VISUAL_DIAL_V2_END */') === 1, 'visual dial end marker must appear exactly once');
assert(occurrences(client, '// SAFE_CRACKER_DIAL_PHYSICS_V2_START') === 1, 'dial physics marker must appear exactly once');
assert(client.includes('function animateDialSettle(fromRotation, toRotation, direction = 0)'), 'snap-settle helper is missing');
assert(client.includes("data-sc-digit=\"${digit}\""), 'dial numbers are not individually addressable');
assert(client.includes("number.classList.toggle('selected'"), 'selected dial number is not synchronized visually');
assert(client.includes('animateDialSettle(releasedRotation, runtime.rotation, runtime.lastDragDirection);'), 'pointer release does not settle physically');
assert(client.includes('animateDialSettle(previousRotation, runtime.rotation'), 'button and keyboard changes do not settle physically');
assert(client.includes("choice: `safecracker:guess:${runtime.selected}`"), 'visual pass changed authoritative guess submission');
assert(css.includes('.sc-dial-face::before'), 'precision tick ring is missing');
assert(css.includes('.sc-dial-number.selected > span'), 'selected engraved number treatment is missing');
assert(css.includes('.sc-dial-face.settling'), 'settling state styling is missing');
assert(css.includes('repeating-conic-gradient(from -1.8deg'), 'fine dial graduations are missing');
assert(index.includes('/assets/safe-cracker/safe-cracker.css?v=6'), 'visual-dial stylesheet cache version is not v6');
assert(index.includes('/assets/safe-cracker/safe-cracker.js?v=6'), 'visual-dial runtime cache version is not v6');
assert(!patch.includes('assets/roulette/turn-animation.js'), 'visual dial patch references the protected turn animation');
assert(!patch.includes('assets/roulette/turn-fire.js'), 'visual dial patch references the protected firing animation');
assert(!patch.includes('netlify/functions/_data.js'), 'visual dial patch must not modify server gameplay logic');

console.log('Safe Cracker visual-dial validation passed: precision materials, selected-number engraving, and tactile settle motion are present without server or Roulette changes.');
