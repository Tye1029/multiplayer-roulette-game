import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [css, index, patch, texturePatch, client, duelAction, turnAnimation, turnFire, audioBindings] = await Promise.all([
  readFile(new URL('assets/safe-cracker/safe-cracker.css', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('scripts/patch-safe-cracker-shadow-depth.mjs', root), 'utf8'),
  readFile(new URL('scripts/patch-safe-cracker-texture-pass.mjs', root), 'utf8'),
  readFile(new URL('assets/safe-cracker/safe-cracker.js', root), 'utf8'),
  readFile(new URL('netlify/functions/duel-action.js', root), 'utf8'),
  readFile(new URL('assets/roulette/turn-animation.js', root)),
  readFile(new URL('assets/roulette/turn-fire.js', root)),
  readFile(new URL('assets/roulette/audio-bindings.js', root))
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Safe Cracker shadow-depth validation failed: ${message}`);
}
function occurrences(source, value) {
  return source.split(value).length - 1;
}

const start = '/* SAFE_CRACKER_SHADOW_DEPTH_V2_START */';
const end = '/* SAFE_CRACKER_SHADOW_DEPTH_V2_END */';
const compatibilityStart = '/* SAFE_CRACKER_SHADOW_DEPTH_V1_START */';
const compatibilityEnd = '/* SAFE_CRACKER_SHADOW_DEPTH_V1_END */';
assert(occurrences(css, start) === 1, 'shadow-depth v2 start marker must appear exactly once');
assert(occurrences(css, end) === 1, 'shadow-depth v2 end marker must appear exactly once');
assert(occurrences(css, compatibilityStart) === 1, 'shadow-depth compatibility start marker must appear exactly once');
assert(occurrences(css, compatibilityEnd) === 1, 'shadow-depth compatibility end marker must appear exactly once');
const blockStart = css.indexOf(start);
const blockEnd = css.indexOf(end, blockStart);
assert(blockStart >= 0 && blockEnd > blockStart, 'shadow-depth marker order is invalid');
const block = css.slice(blockStart, blockEnd + end.length);
assert(block.indexOf(compatibilityStart) < block.indexOf('.safe-cracker-game {'), 'compatibility marker must not wrap or replace the active V2 values');

assert(block.includes('.safe-cracker-game .sc-safe-door'), 'safe-door structural depth is missing');
assert(block.includes('inset 0 -28px 42px rgba(0, 0, 0, .17)'), 'lighter safe-door lower recess is missing');
assert(block.includes('inset 0 0 50px rgba(0, 0, 0, .44)'), 'lighter safe-door full-panel inset is missing');
assert(block.includes('0 20px 36px rgba(0, 0, 0, .32)'), 'lighter safe-door cast shadow is missing');
assert(block.includes('.safe-cracker-game .sc-safe-door::before'), 'inner door contact edge is missing');
assert(block.includes('.safe-cracker-game .sc-display.green'), 'green display feedback depth was not preserved');
assert(block.includes('inset 0 3px 5px rgba(0, 0, 0, .52)'), 'lighter display recess is missing');
assert(block.includes('.safe-cracker-game .sc-dial-wrap'), 'dial cavity depth is missing');
assert(block.includes('inset 0 14px 18px rgba(0, 0, 0, .22)'), 'lighter dial cavity shadow is missing');
assert(block.includes('.safe-cracker-game .sc-dial-face'), 'dial-face contact depth is missing');
assert(block.includes('inset 0 -18px 24px rgba(0, 0, 0, .24)'), 'lighter dial-face lower shadow is missing');
assert(block.includes('.safe-cracker-game .sc-dial-hub'), 'dial-hub depth is missing');
assert(block.includes('0 9px 14px rgba(0, 0, 0, .42)'), 'lighter hub contact shadow is missing');
assert(block.includes('.safe-cracker-game .sc-step-controls button:not(:active)'), 'step-button resting depth is missing');
assert(block.includes('.safe-cracker-game .sc-step-controls button:active'), 'step-button pressed depth is missing');
assert(block.includes('.safe-cracker-game .sc-confirm-button:not(:disabled):not(:active)'), 'confirmation-button resting depth is missing');
assert(block.includes('.safe-cracker-game .sc-confirm-button:not(:disabled):active'), 'confirmation-button pressed depth is missing');
assert(block.includes('.safe-cracker-game .sc-safe-handle'), 'safe hardware depth is missing');
assert(block.includes('.safe-cracker-game .sc-bolts i'), 'bolt contact shadows are missing');

assert(css.includes('linear-gradient(145deg, #56636a 0%, #303a3f 48%, #20292e 78%, #465158 100%)'), 'visibly lighter safe-shell steel gradient is missing');
assert(css.includes('radial-gradient(ellipse at 72% 86%, rgba(0, 0, 0, .06), transparent 54%)'), 'reduced safe-door lower vignette is missing');
assert(css.includes('linear-gradient(145deg, #718087 0%, #465259 30%, #283238 69%, #556168 100%)'), 'visibly lighter safe-door steel gradient is missing');
assert(css.includes('background-blend-mode: soft-light, overlay, screen, soft-light, normal'), 'safe-door dark vignette is still multiplied');

assert(index.includes('&texture=3'), 'approved A2 texture cache boundary changed');
assert(index.includes('&shadow=3'), 'fresh visible-shadow cache boundary is missing');
assert(css.includes('/* SAFE_CRACKER_TEXTURE_PASS_V3_START */'), 'approved A2 image texture is missing');
assert(texturePatch.includes("await import('./patch-safe-cracker-shadow-depth.mjs')"), 'texture build does not invoke the separate shadow-depth pass');
assert(texturePatch.includes("'$1&shadow=3'"), 'texture build does not force the fresh mobile CSS cache boundary');
assert(!block.includes('background-image:'), 'shadow pass must not replace or add texture images');
assert(!block.includes('animation:'), 'shadow pass must not add animation');
assert(!block.includes('filter: brightness'), 'shadow pass must not add a global lighting filter');
assert(!block.includes('pointer-events: auto'), 'shadow pass must not intercept controls');
assert(!patch.includes("writeFile(new URL('../netlify/functions/"), 'shadow pass must not write networking files');
assert(!patch.includes("writeFile(new URL('../assets/roulette/"), 'shadow pass must not write Roulette files');

assert(client.includes('choice: `safecracker:guess:${runtime.selected}`'), 'authoritative Safe Cracker submission changed');
assert(client.includes('// SAFE_CRACKER_INPUT_CONTINUITY_V9_START'), 'input continuity v9 is missing');
assert(client.includes('// SAFE_CRACKER_SAMPLE_MIX_V11_START'), 'sample mix v11 is missing');
assert(duelAction.includes('safecracker'), 'Safe Cracker server mode is unreadable');
assert(turnAnimation.length > 0 && turnFire.length > 0 && audioBindings.length > 0, 'protected Roulette assets are unreadable');

console.log('Safe Cracker shadow-depth validation passed: the actual shell and door steel tones are visibly lighter, the lower vignette no longer multiplies the panel into black, a fresh mobile cache boundary is active, and structural depth, controls, gameplay, networking, audio and Roulette remain protected.');
