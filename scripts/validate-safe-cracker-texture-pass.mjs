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

const startMarker = '/* SAFE_CRACKER_TEXTURE_PASS_V6_START */';
const endMarker = '/* SAFE_CRACKER_TEXTURE_PASS_V6_END */';
assert(occurrences(css, startMarker) === 1, 'material-reset start marker must appear exactly once');
assert(occurrences(css, endMarker) === 1, 'material-reset end marker must appear exactly once');
for (const version of [1, 2, 3, 4, 5]) {
  assert(!css.includes(`/* SAFE_CRACKER_TEXTURE_PASS_V${version}_START */`), `legacy texture v${version} block remains`);
}
const start = css.indexOf(startMarker);
const end = css.indexOf(endMarker, start);
const block = css.slice(start, end);

assert(block.includes("url('/assets/safe-cracker/textures/safe-steel-base.svg?v=3')"), 'brushed steel image is not mounted');
assert(block.includes("url('/assets/safe-cracker/textures/metal-wear.svg?v=3')"), 'irregular wear image is not mounted');
assert(block.includes("url('/assets/safe-cracker/textures/dial-machined.svg?v=3')"), 'neutral machined dial image is not mounted');
assert(block.includes('.safe-cracker-game .sc-dial-wrap::before'), 'stationary dial construction was not neutralized');
assert(block.includes('.safe-cracker-game .sc-dial-face::after'), 'legacy rotating glare is not explicitly disabled');
assert(block.includes('content: none !important'), 'legacy rotating glare can still render');
assert(block.includes('background: none !important'), 'legacy rotating glare background can still render');
assert(!block.includes('repeating-linear-gradient'), 'crosshatched CSS line texture remains');
assert(!block.includes('repeating-conic-gradient'), 'rotating directional dial wedges remain');
assert(!block.includes('circle at '), 'off-centre dial material highlight remains');
assert(!block.includes('ellipse at '), 'directional shell material lighting remains');
assert(!block.includes('mix-blend-mode'), 'material pass still contains a separate light blend');
assert(block.includes('.safe-cracker-game .sc-safe-door'), 'safe-door material is missing');
assert(block.includes('.safe-cracker-game .sc-dial-face'), 'dial material is missing');
assert(block.includes('.safe-cracker-game .sc-dial-hub'), 'dial hub material is missing');
assert(block.includes('.safe-cracker-game .sc-step-controls button'), 'button material is missing');
assert(block.includes('.safe-cracker-game .sc-confirm-button'), 'confirmation-button material is missing');
assert(index.includes('&texture=6'), 'material-reset CSS cache boundary is missing');
for (const version of [1, 2, 3, 4, 5]) {
  assert(!index.includes(`&texture=${version}`), `legacy texture cache ${version} remains`);
}

assert(steel.includes('baseFrequency=".82 .012"'), 'steel texture lost its single-direction grain');
assert(steel.includes('stitchTiles="stitch"'), 'steel texture is not tile-safe');
assert(wear.includes('stroke-opacity=".2"') && wear.includes('<ellipse'), 'irregular wear and scuffs are missing');
assert(dialTexture.includes('data-material="concentric-machining-v2"'), 'concentric dial artwork marker is missing');
assert(dialTexture.includes('<circle') && !dialTexture.includes('<path'), 'dial artwork contains directional arc shapes');
assert(!patch.includes('animation:'), 'material pass must not introduce continuous animation');
assert(!patch.includes('filter: brightness'), 'material pass must not introduce lighting filters');
assert(!patch.includes('pointer-events: auto'), 'material pass must not intercept controls');
assert(client.includes('choice: `safecracker:guess:${runtime.selected}`'), 'authoritative Safe Cracker submission changed');
assert(client.includes('// SAFE_CRACKER_INPUT_CONTINUITY_V9_START'), 'input continuity v9 is missing');
assert(client.includes('// SAFE_CRACKER_SAMPLE_MIX_V11_START'), 'sample mix v11 is missing');
assert(duelAction.includes('safecracker'), 'Safe Cracker server mode is unreadable');
assert(turnAnimation.length > 0 && turnFire.length > 0 && audioBindings.length > 0, 'protected Roulette assets are unreadable');
assert(!patch.includes("writeFile(new URL('../netlify/functions/"), 'material pass must not write networking files');
assert(!patch.includes("writeFile(new URL('../assets/roulette/"), 'material pass must not write Roulette files');
assert(patch.includes("await import('./patch-safe-cracker-shadow-depth.mjs')"), 'material pipeline does not continue into structural depth');

console.log('Safe Cracker material-reset validation passed: image-based steel, irregular wear and concentric machining remain, all directional surface lighting and rotating glare are removed, and gameplay, networking, audio and Roulette stay protected.');

await import('./validate-safe-cracker-shadow-depth.mjs');
