import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [css, index, patch, texturePatch, shadowPatch, client, duelAction, turnAnimation, turnFire, audioBindings] = await Promise.all([
  readFile(new URL('assets/safe-cracker/safe-cracker.css', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('scripts/patch-safe-cracker-light-source.mjs', root), 'utf8'),
  readFile(new URL('scripts/patch-safe-cracker-texture-pass.mjs', root), 'utf8'),
  readFile(new URL('scripts/patch-safe-cracker-shadow-depth.mjs', root), 'utf8'),
  readFile(new URL('assets/safe-cracker/safe-cracker.js', root), 'utf8'),
  readFile(new URL('netlify/functions/duel-action.js', root), 'utf8'),
  readFile(new URL('assets/roulette/turn-animation.js', root)),
  readFile(new URL('assets/roulette/turn-fire.js', root)),
  readFile(new URL('assets/roulette/audio-bindings.js', root))
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Safe Cracker light-source validation failed: ${message}`);
}
function occurrences(source, value) {
  return source.split(value).length - 1;
}

const start = '/* SAFE_CRACKER_LIGHT_SOURCE_V1_START */';
const end = '/* SAFE_CRACKER_LIGHT_SOURCE_V1_END */';
assert(occurrences(css, start) === 1, 'light-source start marker must appear exactly once');
assert(occurrences(css, end) === 1, 'light-source end marker must appear exactly once');
const blockStart = css.indexOf(start);
const blockEnd = css.indexOf(end, blockStart);
assert(blockStart >= 0 && blockEnd > blockStart, 'light-source marker order is invalid');
const block = css.slice(blockStart, blockEnd + end.length);

assert(block.includes('--sc-key-warm: rgba(255, 205, 126, .24)'), 'warm key-light color is missing');
assert(block.includes('radial-gradient(ellipse at 28% -8%'), 'shell light origin changed');
assert(block.includes('radial-gradient(ellipse at 27% -2%'), 'door light origin changed');
assert(block.includes('radial-gradient(circle at 30% 17%'), 'dial light origin changed');
assert(block.includes('.safe-cracker-game .sc-safe-shell'), 'shell light response is missing');
assert(block.includes('.safe-cracker-game .sc-safe-door'), 'door light response is missing');
assert(block.includes('.safe-cracker-game .sc-safe-door::before'), 'door edge light response is missing');
assert(block.includes('.safe-cracker-game .sc-display'), 'display rim response is missing');
assert(block.includes('.safe-cracker-game .sc-dial-face'), 'dial-face response is missing');
assert(block.includes('.safe-cracker-game .sc-dial-hub'), 'dial-hub response is missing');
assert(block.includes('.safe-cracker-game .sc-step-controls button'), 'step-button response is missing');
assert(block.includes('.safe-cracker-game .sc-confirm-button'), 'confirmation-button response is missing');

assert(block.includes("url('/assets/safe-cracker/textures/safe-steel-base.svg?v=1')"), 'approved steel texture was not preserved');
assert(block.includes("url('/assets/safe-cracker/textures/metal-wear.svg?v=1')"), 'approved wear texture was not preserved');
assert(block.includes("url('/assets/safe-cracker/textures/dial-machined.svg?v=1')"), 'approved dial texture was not preserved');
assert(css.includes('/* SAFE_CRACKER_TEXTURE_PASS_V3_START */'), 'A2 image texture pass is missing');
assert(css.includes('/* SAFE_CRACKER_SHADOW_DEPTH_V1_START */'), 'structural shadow pass is missing');
assert(index.includes('&texture=3'), 'A2 texture cache boundary changed');
assert(index.includes('&shadow=1'), 'shadow cache boundary changed');
assert(index.includes('&light=1'), 'light-source cache boundary is missing');
assert(texturePatch.includes("await import('./patch-safe-cracker-shadow-depth.mjs')"), 'texture pipeline no longer invokes shadow depth');
assert(shadowPatch.includes("await import('./patch-safe-cracker-light-source.mjs')"), 'shadow pipeline does not invoke the light pass');

assert(!block.includes('position: fixed'), 'light pass must not create a fullscreen overlay');
assert(!block.includes('backdrop-filter'), 'light pass must not use backdrop filtering');
assert(!block.includes('mix-blend-mode'), 'light pass must not use unstable element blending');
assert(!block.includes('animation:'), 'light pass must remain static');
assert(!block.includes('transform:'), 'light pass must not move geometry');
assert(!block.includes('filter: brightness'), 'light pass must not use a global brightness filter');
assert(!block.includes('pointer-events: auto'), 'light pass must not intercept controls');
assert(!patch.includes("writeFile(new URL('../netlify/functions/"), 'light pass must not write networking files');
assert(!patch.includes("writeFile(new URL('../assets/roulette/"), 'light pass must not write Roulette files');

assert(client.includes('choice: `safecracker:guess:${runtime.selected}`'), 'authoritative Safe Cracker submission changed');
assert(client.includes('// SAFE_CRACKER_INPUT_CONTINUITY_V9_START'), 'input continuity v9 is missing');
assert(client.includes('// SAFE_CRACKER_SAMPLE_MIX_V11_START'), 'sample mix v11 is missing');
assert(duelAction.includes('safecracker'), 'Safe Cracker server mode is unreadable');
assert(turnAnimation.length > 0 && turnFire.length > 0 && audioBindings.length > 0, 'protected Roulette assets are unreadable');

console.log('Safe Cracker light-source validation passed: one static warm upper-left key is resolved per surface while A2 texture, structural depth, controls, gameplay, networking, audio and Roulette remain protected.');
