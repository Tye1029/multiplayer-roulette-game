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

const start = '/* SAFE_CRACKER_LIGHT_SOURCE_V7_START */';
const end = '/* SAFE_CRACKER_LIGHT_SOURCE_V7_END */';
assert(occurrences(css, start) === 1, 'lighting-reset start marker must appear exactly once');
assert(occurrences(css, end) === 1, 'lighting-reset end marker must appear exactly once');
for (const version of [1, 2, 3, 4, 5, 6]) {
  assert(!css.includes(`/* SAFE_CRACKER_LIGHT_SOURCE_V${version}_START */`), `legacy light v${version} block remains`);
}
const blockStart = css.indexOf(start);
const blockEnd = css.indexOf(end, blockStart);
assert(blockStart >= 0 && blockEnd > blockStart, 'lighting-reset marker order is invalid');
const block = css.slice(blockStart, blockEnd + end.length);
const overlayStart = block.indexOf('.safe-cracker-game .sc-safe-shell::after');
const overlayEnd = block.indexOf('/* Fixed trim', overlayStart);
const overlay = block.slice(overlayStart, overlayEnd > overlayStart ? overlayEnd : block.length);

assert(occurrences(block, '.safe-cracker-game .sc-safe-shell::after') === 1, 'there must be exactly one scene-light overlay');
assert(block.includes('contain: paint'), 'safe-local paint containment is missing');
assert(block.includes('z-index: 40'), 'scene overlay is not above the complete safe assembly');
assert(block.includes('pointer-events: none'), 'scene overlay can intercept dial or button input');
assert(block.includes('radial-gradient(ellipse 76% 56% at 36% -7%'), 'strong overhead source is missing');
assert(block.includes('rgba(255, 255, 255, .42)'), 'visible key-light strength changed');
assert(block.includes('linear-gradient(118deg'), 'broad same-source falloff is missing');
assert(block.includes('rgba(226, 237, 244, .16)'), 'broad cool fill is too weak or missing');
assert(block.includes('.safe-cracker-game .sc-safe-door::before'), 'door trim does not respond to the overhead source');
assert(block.includes('border-top-color: rgba(242, 248, 251, .24)'), 'top trim highlight is not visible');
assert(block.includes('border-right-color: rgba(132, 154, 169, .11)'), 'right edge lost its reflected fill');
assert(block.includes('.safe-cracker-game .sc-dial-face::after'), 'rotating dial glare is not explicitly disabled');
assert(block.includes('.safe-cracker-game .sc-dial::after'), 'legacy dial-local overlay is not explicitly disabled');
assert(block.includes('content: none !important'), 'dial-local lighting remains active');
assert(block.includes('background: none !important'), 'dial-local lighting background remains active');
assert(block.includes('@media (max-width: 700px)'), 'mobile performance boundary is missing');
assert(block.includes('.safe-cracker-game .sc-dial-wrap'), 'mobile rotating dial wrapper is not optimized');
assert(block.includes('.safe-cracker-game .sc-dial-pointer'), 'mobile pointer filter is not optimized');
assert(block.includes('filter: none !important'), 'mobile drop-shadow filters remain active');

assert(occurrences(overlay, 'radial-gradient(') === 1, 'scene overlay uses more than one radial layer');
assert(occurrences(overlay, 'linear-gradient(') === 1, 'scene overlay uses more than one linear layer');
assert(!overlay.includes('box-shadow:'), 'scene overlay reintroduced expensive large shadow layers');
assert(!block.includes('background-image:'), 'light pass is replacing material artwork');
assert(!block.includes('safe-steel-base.svg'), 'light pass still owns steel texture');
assert(!block.includes('metal-wear.svg'), 'light pass still owns wear texture');
assert(!block.includes('dial-machined.svg'), 'light pass still owns dial texture');
assert(!block.includes('repeating-conic-gradient'), 'light pass contains a dial-bound wedge pattern');
assert(!block.includes('mix-blend-mode'), 'light pass uses an unstable separate blend source');
assert(!block.includes('position: fixed'), 'light pass creates a page-wide overlay instead of a safe-local source');
assert(!block.includes('backdrop-filter'), 'light pass uses backdrop filtering');
assert(!block.includes('animation:'), 'scene light must remain stationary');
assert(!block.includes('filter: brightness'), 'scene light is a global brightness wash');
assert(!block.includes('pointer-events: auto'), 'light pass can intercept controls');

assert(css.includes('/* SAFE_CRACKER_TEXTURE_PASS_V6_START */'), 'material-only reset is missing');
assert(css.includes("url('/assets/safe-cracker/textures/dial-machined.svg?v=3')"), 'neutral dial material is missing');
assert(css.includes('/* SAFE_CRACKER_SHADOW_DEPTH_V1_START */'), 'structural shadow pass is missing');
assert(index.includes('&texture=6'), 'material cache boundary changed');
assert(index.includes('&shadow=1'), 'shadow cache boundary changed');
assert(index.includes('&light=7'), 'lighting-reset cache boundary is missing');
for (const version of [1, 2, 3, 4, 5, 6]) {
  assert(!index.includes(`&light=${version}`), `legacy light cache ${version} remains`);
}
assert(texturePatch.includes("await import('./patch-safe-cracker-shadow-depth.mjs')"), 'material pipeline no longer invokes structural depth');
assert(lampPipeline.indexOf("await import('./patch-safe-cracker-texture-pass.mjs')") < lampPipeline.indexOf("await import('./patch-safe-cracker-light-source.mjs')"), 'scene light does not run after materials and shadows');
assert(lampPipeline.includes("await import('./validate-safe-cracker-light-source.mjs')"), 'lighting validation is missing from the build pipeline');

assert(!patch.includes("writeFile(new URL('../netlify/functions/"), 'light pass must not write networking files');
assert(!patch.includes("writeFile(new URL('../assets/roulette/"), 'light pass must not write Roulette files');
assert(client.includes('choice: `safecracker:guess:${runtime.selected}`'), 'authoritative Safe Cracker submission changed');
assert(client.includes('// SAFE_CRACKER_INPUT_CONTINUITY_V9_START'), 'input continuity v9 is missing');
assert(client.includes('// SAFE_CRACKER_SAMPLE_MIX_V11_START'), 'sample mix v11 is missing');
assert(duelAction.includes('safecracker'), 'Safe Cracker server mode is unreadable');
assert(turnAnimation.length > 0 && turnFire.length > 0 && audioBindings.length > 0, 'protected Roulette assets are unreadable');

console.log('Safe Cracker lighting-reset validation passed: a stronger two-layer stationary source is visible across the whole safe, mobile rotating filters are disabled, materials remain independent, and controls, gameplay, networking, audio and Roulette stay protected.');
