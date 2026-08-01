import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [css, index, patch, texturePatch, lampPipeline, client, duelAction, turnAnimation, turnFire, audioBindings] = await Promise.all([
  readFile(new URL('assets/safe-cracker/safe-cracker.css', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('scripts/patch-safe-cracker-light-source.mjs', root), 'utf8'),
  readFile(new URL('scripts/patch-safe-cracker-texture-pass.mjs', root), 'utf8'),
  readFile(new URL('scripts/patch-safe-cracker-lamp-validator.mjs', root), 'utf8'),
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

const start = '/* SAFE_CRACKER_LIGHT_SOURCE_V2_START */';
const end = '/* SAFE_CRACKER_LIGHT_SOURCE_V2_END */';
assert(occurrences(css, start) === 1, 'corrected light-source start marker must appear exactly once');
assert(occurrences(css, end) === 1, 'corrected light-source end marker must appear exactly once');
assert(!css.includes('/* SAFE_CRACKER_LIGHT_SOURCE_V1_START */'), 'legacy warm light block remains');
const blockStart = css.indexOf(start);
const blockEnd = css.indexOf(end, blockStart);
assert(blockStart >= 0 && blockEnd > blockStart, 'light-source marker order is invalid');
const block = css.slice(blockStart, blockEnd + end.length);

assert(block.includes('--sc-key-cool: rgba(226, 239, 250, .18)'), 'cool white key-light color is missing');
assert(block.includes('--sc-fill-cool: rgba(132, 169, 199, .065)'), 'cool reflected fill is missing');
assert(block.includes('radial-gradient(ellipse at 34% -10%'), 'shell light origin changed');
assert(block.includes('radial-gradient(ellipse at 82% 75%'), 'door shadow fill is missing');
assert(block.includes('inset -14px -8px 28px rgba(139, 174, 199, .04)'), 'recessed door shadow is not partially lit');
assert(block.includes('.safe-cracker-game .sc-dial::before'), 'stationary dial-light layer is missing');
assert(block.includes('pointer-events: none'), 'stationary dial light can intercept controls');
assert(block.includes('z-index: 2'), 'stationary dial light is not layered above the rotating face');
assert(block.includes('radial-gradient(ellipse at 31% 16%'), 'stationary dial highlight shape changed');
assert(block.includes('.safe-cracker-game .sc-dial-wrap'), 'dial cavity fill is missing');
assert(block.includes('.safe-cracker-game .sc-safe-shell'), 'shell light response is missing');
assert(block.includes('.safe-cracker-game .sc-safe-door'), 'door light response is missing');
assert(block.includes('.safe-cracker-game .sc-safe-door::before'), 'door edge response is missing');
assert(block.includes('.safe-cracker-game .sc-display'), 'display rim response is missing');
assert(block.includes('.safe-cracker-game .sc-dial-face'), 'dial-face material restoration is missing');
assert(block.includes('.safe-cracker-game .sc-dial-hub'), 'dial-hub material restoration is missing');
assert(block.includes('.safe-cracker-game .sc-step-controls button'), 'step-button response is missing');
assert(block.includes('.safe-cracker-game .sc-confirm-button'), 'confirmation-button response is missing');

const dialFaceStart = block.indexOf('.safe-cracker-game .sc-dial-face');
const dialHubStart = block.indexOf('.safe-cracker-game .sc-dial-hub', dialFaceStart);
const dialFaceBlock = block.slice(dialFaceStart, dialHubStart);
assert(!dialFaceBlock.includes('rgba(255, 215, 150'), 'legacy yellow dial wedge remains on the rotating face');
assert(!dialFaceBlock.includes('--sc-key-cool'), 'cool light is still painted directly onto the rotating face');
assert(dialFaceBlock.includes("url('/assets/safe-cracker/textures/dial-machined.svg?v=1')"), 'rotating dial texture was not preserved');
assert(block.includes("url('/assets/safe-cracker/textures/safe-steel-base.svg?v=1')"), 'approved steel texture was not preserved');
assert(block.includes("url('/assets/safe-cracker/textures/metal-wear.svg?v=1')"), 'approved wear texture was not preserved');
assert(css.includes('/* SAFE_CRACKER_TEXTURE_PASS_V3_START */'), 'A2 image texture pass is missing');
assert(css.includes('/* SAFE_CRACKER_SHADOW_DEPTH_V1_START */'), 'structural shadow pass is missing');
assert(index.includes('&texture=3'), 'A2 texture cache boundary changed');
assert(index.includes('&shadow=1'), 'shadow cache boundary changed');
assert(index.includes('&light=2'), 'corrected light-source cache boundary is missing');
assert(!index.includes('&light=1'), 'legacy warm-light cache boundary remains');
assert(texturePatch.includes("await import('./patch-safe-cracker-shadow-depth.mjs')"), 'texture pipeline no longer invokes shadow depth');
assert(lampPipeline.indexOf("await import('./patch-safe-cracker-texture-pass.mjs')") < lampPipeline.indexOf("await import('./patch-safe-cracker-light-source.mjs')"), 'light pass does not run after texture and shadow depth');
assert(lampPipeline.includes("await import('./validate-safe-cracker-shadow-depth.mjs')"), 'shadow-depth validation is missing from the build pipeline');
assert(lampPipeline.includes("await import('./validate-safe-cracker-light-source.mjs')"), 'light-source validation is missing from the build pipeline');

assert(!block.includes('position: fixed'), 'light pass must not create a fullscreen overlay');
assert(!block.includes('backdrop-filter'), 'light pass must not use backdrop filtering');
assert(!block.includes('mix-blend-mode'), 'light pass must not use unstable element blending');
assert(!block.includes('animation:'), 'light pass must remain static');
assert(!block.includes('filter: brightness'), 'light pass must not use a global brightness filter');
assert(!block.includes('pointer-events: auto'), 'light pass must not intercept controls');
assert(!patch.includes("writeFile(new URL('../netlify/functions/"), 'light pass must not write networking files');
assert(!patch.includes("writeFile(new URL('../assets/roulette/"), 'light pass must not write Roulette files');

assert(client.includes('choice: `safecracker:guess:${runtime.selected}`'), 'authoritative Safe Cracker submission changed');
assert(client.includes('// SAFE_CRACKER_INPUT_CONTINUITY_V9_START'), 'input continuity v9 is missing');
assert(client.includes('// SAFE_CRACKER_SAMPLE_MIX_V11_START'), 'sample mix v11 is missing');
assert(duelAction.includes('safecracker'), 'Safe Cracker server mode is unreadable');
assert(turnAnimation.length > 0 && turnFire.length > 0 && audioBindings.length > 0, 'protected Roulette assets are unreadable');

console.log('Safe Cracker light-source validation passed: cool white overhead light, reflected fill in recesses, and a stationary dial-light layer replace the warm rotating wedges while gameplay and protected systems remain intact.');
