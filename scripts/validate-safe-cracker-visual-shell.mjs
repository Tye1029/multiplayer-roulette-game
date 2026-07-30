import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [css, index, patch] = await Promise.all([
  readFile(new URL('assets/safe-cracker/safe-cracker.css', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('scripts/patch-safe-cracker-visual-shell.mjs', root), 'utf8')
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Safe Cracker visual-shell validation failed: ${message}`);
}

function occurrences(source, value) {
  return source.split(value).length - 1;
}

assert(occurrences(css, '/* SAFE_CRACKER_VISUAL_SHELL_V1_START */') === 1, 'visual shell marker must appear exactly once');
assert(occurrences(css, '/* SAFE_CRACKER_VISUAL_SHELL_V1_END */') === 1, 'visual shell end marker must appear exactly once');
assert(css.includes('.safe-cracker-game::before'), 'vault-room wall texture is missing');
assert(css.includes('.safe-cracker-game::after'), 'vault-room floor treatment is missing');
assert(css.includes('.sc-safe-shell::before'), 'safe cabinet inner frame is missing');
assert(css.includes('.sc-safe-shell::after'), 'safe cabinet lighting pass is missing');
assert(css.includes('.sc-safe-door::after'), 'safe-door rivet and surface pass is missing');
assert(css.includes('repeating-linear-gradient(98deg'), 'brushed-steel safe texture is missing');
assert(css.includes('@media (max-width: 700px)'), 'mobile vault-shell treatment is missing');
assert(index.includes('/assets/safe-cracker/safe-cracker.css?v=7'), 'visual shell is not carried into visual-HUD v7');
assert(index.includes('/assets/safe-cracker/safe-cracker.js?v=7'), 'Safe Cracker runtime is not synchronized with visual-HUD v7');
assert(css.includes('/* SAFE_CRACKER_VISUAL_DIAL_V2_START */'), 'precision dial pass is missing above the shell');
assert(css.includes('/* SAFE_CRACKER_VISUAL_HUD_V3_START */'), 'industrial HUD pass is missing above the shell');
assert(!patch.includes('assets/roulette/turn-animation.js'), 'visual shell patch references the protected turn animation');
assert(!patch.includes('assets/roulette/turn-fire.js'), 'visual shell patch references the protected firing animation');
assert(!patch.includes('netlify/functions/_data.js'), 'visual shell patch must not modify gameplay or server logic');

console.log('Safe Cracker visual-shell validation passed: cinematic vault background remains intact beneath the precision dial and industrial HUD passes.');
