import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [css, index, patch, client, duelAction, turnAnimation, turnFire, audioBindings] = await Promise.all([
  readFile(new URL('assets/safe-cracker/safe-cracker.css', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('scripts/patch-safe-cracker-texture-pass.mjs', root), 'utf8'),
  readFile(new URL('assets/safe-cracker/safe-cracker.js', root), 'utf8'),
  readFile(new URL('netlify/functions/duel-action.js', root), 'utf8'),
  readFile(new URL('assets/roulette/turn-animation.js', root)),
  readFile(new URL('assets/roulette/turn-fire.js', root)),
  readFile(new URL('assets/roulette/audio-bindings.js', root))
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Safe Cracker texture-pass validation failed: ${message}`);
}
function occurrences(source, value) {
  return source.split(value).length - 1;
}

assert(occurrences(css, '/* SAFE_CRACKER_TEXTURE_PASS_V1_START */') === 1, 'texture marker must appear exactly once');
assert(occurrences(css, '/* SAFE_CRACKER_TEXTURE_PASS_V1_END */') === 1, 'texture end marker must appear exactly once');
assert(css.includes('--sc-texture-bright: rgba(255, 255, 255, .025)'), 'low-contrast steel highlight grain is missing');
assert(css.includes('repeating-linear-gradient(89.5deg'), 'safe-door brushed grain is missing');
assert(css.includes('background-blend-mode:'), 'texture layers are not blended into the existing material');
assert(css.includes('.safe-cracker-game .sc-step-controls button'), 'button material texture is missing');
assert(css.includes('.safe-cracker-game .sc-confirm-button'), 'confirmation-button material texture is missing');
assert(index.includes('&texture=1'), 'texture CSS cache boundary is missing');
assert(!patch.includes('animation:'), 'texture pass must not introduce continuous animation');
assert(!patch.includes('filter: brightness'), 'texture pass must not introduce lighting changes');
assert(!patch.includes('pointer-events: auto'), 'texture pass must not intercept controls');
assert(client.includes('choice: `safecracker:guess:${runtime.selected}`'), 'authoritative Safe Cracker submission changed');
assert(duelAction.includes('safecracker'), 'Safe Cracker server mode is unreadable');
assert(turnAnimation.length > 0 && turnFire.length > 0 && audioBindings.length > 0, 'protected Roulette assets are unreadable');
assert(!patch.includes("writeFile(new URL('../netlify/functions/"), 'texture pass must not write networking files');
assert(!patch.includes("writeFile(new URL('../assets/roulette/"), 'texture pass must not write Roulette files');

console.log('Safe Cracker texture-pass validation passed: subtle brushed metal is installed, controls and cache boundaries remain intact, and gameplay, networking, audio, and Roulette are protected.');
