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

const start = '/* SAFE_CRACKER_LIGHT_SOURCE_V3_START */';
const end = '/* SAFE_CRACKER_LIGHT_SOURCE_V3_END */';
assert(occurrences(css, start) === 1, 'scene-light start marker must appear exactly once');
assert(occurrences(css, end) === 1, 'scene-light end marker must appear exactly once');
assert(!css.includes('/* SAFE_CRACKER_LIGHT_SOURCE_V1_START */'), 'legacy warm light block remains');
assert(!css.includes('/* SAFE_CRACKER_LIGHT_SOURCE_V2_START */'), 'legacy dial-local light block remains');
const blockStart = css.indexOf(start);
const blockEnd = css.indexOf(end, blockStart);
assert(blockStart >= 0 && blockEnd > blockStart, 'scene-light marker order is invalid');
const block = css.slice(blockStart, blockEnd + end.length);

assert(block.includes('--sc-scene-key: rgba(232, 243, 251, .135)'), 'cool white scene key is missing');
assert(block.includes('--sc-scene-fill: rgba(143, 176, 202, .042)'), 'cool reflected scene fill is missing');
assert(block.includes('.safe-cracker-game .sc-safe-shell::after'), 'scene-wide safe overlay is missing');
assert(block.includes('z-index: 40'), 'scene overlay is not above the complete safe assembly');
assert(block.includes('pointer-events: none'), 'scene overlay can intercept controls');
assert(block.includes('radial-gradient(ellipse 112% 72% at 34% -4%'), 'broad overhead scene key changed');
assert(block.includes('radial-gradient(ellipse 82% 68% at 88% 86%'), 'shadow-region fill is missing');
assert(block.includes('.safe-cracker-game .sc-dial::before'), 'former dial-local layer is not explicitly disabled');
assert(block.includes('content: none !important'), 'dial-local lighting remains active');
assert(block.includes('inset 0 0 48px rgba(0, 0, 0, .46)'), 'recessed safe areas are not partially lifted');
assert(block.includes('.safe-cracker-game .sc-safe-door'), 'safe-door material response is missing');
assert(block.includes('.safe-cracker-game .sc-display'), 'display edge response is missing');
assert(block.includes('.safe-cracker-game .sc-dial-wrap'), 'dial cavity response is missing');
assert(block.includes('.safe-cracker-game .sc-dial-face'), 'dial material restoration is missing');
assert(block.includes('.safe-cracker-game .sc-dial-hub'), 'dial hub restoration is missing');
assert(block.includes('.safe-cracker-game .sc-step-controls button'), 'step-button material is missing');
assert(block.includes('.safe-cracker-game .sc-confirm-button'), 'confirmation-button material is missing');

const dialFaceStart = block.indexOf('.safe-cracker-game .sc-dial-face');
const dialHubStart = block.indexOf('.safe-cracker-game .sc-dial-hub', dialFaceStart);
const dialFaceBlock = block.slice(dialFaceStart, dialHubStart);
assert(!dialFaceBlock.includes('circle at 38% 28%'), 'directional baked highlight remains on the rotating face');
assert(!dialFaceBlock.includes('--sc-scene-key'), 'scene light is still painted directly onto the rotating face');
assert(dialFaceBlock.includes('radial-gradient(circle at 50% 50%'), 'rotating dial face is not directionally neutral');
assert(dialFaceBlock.includes("url('/assets/safe-cracker/textures/dial-machined.svg?v=1')"), 'rotating dial texture was not preserved');
assert(block.includes("url('/assets/safe-cracker/textures/safe-steel-base.svg?v=1')"), 'approved steel texture was not preserved');
assert(block.includes("url('/assets/safe-cracker/textures/metal-wear.svg?v=1')"), 'approved wear texture was not preserved');
assert(css.includes('/* SAFE_CRACKER_TEXTURE_PASS_V3_START */'), 'A2 image texture pass is missing');
assert(css.includes('/* SAFE_CRACKER_SHADOW_DEPTH_V1_START */'), 'structural shadow pass is missing');
assert(index.includes('&texture=3'), 'A2 texture cache boundary changed');
assert(index.includes('&shadow=1'), 'shadow cache boundary changed');
assert(index.includes('&light=3'), 'scene-light cache boundary is missing');
assert(!index.includes('&light=1') && !index.includes('&light=2'), 'legacy light cache boundary remains');
assert(texturePatch.includes("await import('./patch-safe-cracker-shadow-depth.mjs')"), 'texture pipeline no longer invokes shadow depth');
assert(lampPipeline.indexOf("await import('./patch-safe-cracker-texture-pass.mjs')") < lampPipeline.indexOf("await import('./patch-safe-cracker-light-source.mjs')"), 'light pass does not run after texture and shadow depth');
assert(lampPipeline.includes("await import('./validate-safe-cracker-shadow-depth.mjs')"), 'shadow-depth validation is missing from the build pipeline');
assert(lampPipeline.includes("await import('./validate-safe-cracker-light-source.mjs')"), 'light-source validation is missing from the build pipeline');

assert(!block.includes('position: fixed'), 'light pass must not create a fullscreen page overlay');
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

console.log('Safe Cracker light-source validation passed: one broad cool-white scene overlay spans the complete safe, shadowed recesses receive soft fill, and rotating dial materials contain no directional light.');
