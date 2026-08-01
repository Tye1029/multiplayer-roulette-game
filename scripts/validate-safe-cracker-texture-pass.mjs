import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [css, index, patch, steel, wear, dialTexture, client, duelAction, turnAnimation, turnFire, audioBindings] = await Promise.all([
  readFile(new URL('assets/safe-cracker/safe-cracker.css', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('scripts/patch-safe-cracker-texture-pass.mjs', root), 'utf8'),
  readFile(new URL('assets/safe-cracker/textures/safe-steel-base.svg', root), 'utf8'),
  readFile(new URL('assets/safe-cracker/textures/metal-wear.svg', root), 'utf8'),
  readFile(new URL('assets/safe-cracker/textures/dial-machined.svg', root), 'utf8'),
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

assert(occurrences(css, '/* SAFE_CRACKER_TEXTURE_PASS_V3_START */') === 1, 'texture v3 marker must appear exactly once');
assert(occurrences(css, '/* SAFE_CRACKER_TEXTURE_PASS_V3_END */') === 1, 'texture v3 end marker must appear exactly once');
assert(!css.includes('/* SAFE_CRACKER_TEXTURE_PASS_V1_START */'), 'legacy texture v1 block remains');
assert(!css.includes('/* SAFE_CRACKER_TEXTURE_PASS_V2_START */'), 'legacy texture v2 block remains');
const start = css.indexOf('/* SAFE_CRACKER_TEXTURE_PASS_V3_START */');
const end = css.indexOf('/* SAFE_CRACKER_TEXTURE_PASS_V3_END */', start);
const block = css.slice(start, end);
assert(block.includes("url('/assets/safe-cracker/textures/safe-steel-base.svg?v=1')"), 'directional steel image is not mounted');
assert(block.includes("url('/assets/safe-cracker/textures/metal-wear.svg?v=1')"), 'irregular wear image is not mounted');
assert(block.includes("url('/assets/safe-cracker/textures/dial-machined.svg?v=1')"), 'machined dial image is not mounted');
assert(!block.includes('repeating-linear-gradient'), 'crosshatched line texture remains in the v3 block');
assert(!block.includes('repeating-radial-gradient'), 'CSS-generated dial rings remain in the v3 block');
assert(block.includes('.safe-cracker-game .sc-safe-door'), 'safe-door image texture is missing');
assert(block.includes('.safe-cracker-game .sc-dial-face'), 'dial image texture is missing');
assert(block.includes('.safe-cracker-game .sc-step-controls button'), 'button image texture is missing');
assert(block.includes('.safe-cracker-game .sc-confirm-button'), 'confirmation-button image texture is missing');
assert(index.includes('&texture=3'), 'texture v3 CSS cache boundary is missing');
assert(!index.includes('&texture=1') && !index.includes('&texture=2'), 'legacy texture cache boundary remains');

assert(steel.includes('baseFrequency=".82 .012"'), 'steel texture lost its single-direction grain');
assert(steel.includes('stitchTiles="stitch"'), 'steel texture is not tile-safe');
assert(wear.includes('stroke-opacity=".2"') && wear.includes('<ellipse'), 'irregular wear and scuffs are missing');
assert(dialTexture.includes('<circle') && dialTexture.includes('stroke-opacity=".11"'), 'dial machining artwork is missing');
assert(!patch.includes('animation:'), 'texture pass must not introduce continuous animation');
assert(!patch.includes('filter: brightness'), 'texture pass must not introduce lighting changes');
assert(!patch.includes('pointer-events: auto'), 'texture pass must not intercept controls');
assert(client.includes('choice: `safecracker:guess:${runtime.selected}`'), 'authoritative Safe Cracker submission changed');
assert(client.includes('// SAFE_CRACKER_INPUT_CONTINUITY_V9_START'), 'input continuity v9 is missing');
assert(client.includes('// SAFE_CRACKER_SAMPLE_MIX_V11_START'), 'sample mix v11 is missing');
assert(duelAction.includes('safecracker'), 'Safe Cracker server mode is unreadable');
assert(turnAnimation.length > 0 && turnFire.length > 0 && audioBindings.length > 0, 'protected Roulette assets are unreadable');
assert(!patch.includes("writeFile(new URL('../netlify/functions/"), 'texture pass must not write networking files');
assert(!patch.includes("writeFile(new URL('../assets/roulette/"), 'texture pass must not write Roulette files');

console.log('Safe Cracker texture-pass validation passed: image-based directional steel, irregular wear and circular dial machining replace CSS crosshatching while stability, gameplay, networking, audio and Roulette remain protected.');
