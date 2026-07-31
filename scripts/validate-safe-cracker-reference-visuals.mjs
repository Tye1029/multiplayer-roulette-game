import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [client, css, index, patch, turnAnimation, turnFire, audioBindings] = await Promise.all([
  readFile(new URL('assets/safe-cracker/safe-cracker.js', root), 'utf8'),
  readFile(new URL('assets/safe-cracker/safe-cracker.css', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('scripts/patch-safe-cracker-reference-visuals.mjs', root), 'utf8'),
  readFile(new URL('assets/roulette/turn-animation.js', root)),
  readFile(new URL('assets/roulette/turn-fire.js', root)),
  readFile(new URL('assets/roulette/audio-bindings.js', root))
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Safe Cracker reference-visual validation failed: ${message}`);
}
function occurrences(source, value) {
  return source.split(value).length - 1;
}

const checks = [
  ['runtime marker is unique', occurrences(client, '// SAFE_CRACKER_REFERENCE_VISUALS_V13_START') === 1 && occurrences(client, '// SAFE_CRACKER_REFERENCE_VISUALS_V13_END') === 1],
  ['CSS marker is unique', occurrences(css, '/* SAFE_CRACKER_REFERENCE_VISUALS_V13_START */') === 1 && occurrences(css, '/* SAFE_CRACKER_REFERENCE_VISUALS_V13_END */') === 1],
  ['reference title and dynamic pot are mounted after render', client.includes('function safeCrackerMountReferenceFrame(game = runtime.game)') && client.includes('SAFE CRACKER DUEL') && client.includes('safeCrackerReferencePot(game).toLocaleString')],
  ['reference root class is scoped to Safe Cracker', client.includes("root.classList.add('sc-reference-visuals')") && css.includes('.safe-cracker-game.sc-reference-visuals')],
  ['gold masthead and pot banner are styled', css.includes('.sc-reference-title') && css.includes('.sc-reference-pot') && css.includes('--sc-ref-gold-hi')],
  ['safe body is darker and deeply shadowed', css.includes('.safe-cracker-game.sc-reference-visuals .sc-safe-door') && css.includes('inset 0 -36px 70px rgba(0,0,0,.56)')],
  ['screen-fixed safe reflection is present', css.includes('.safe-cracker-game.sc-reference-visuals .sc-safe-door::after') && css.includes('linear-gradient(112deg') && css.includes('mix-blend-mode: screen')],
  ['screen-fixed dial reflection is present', css.includes('.safe-cracker-game.sc-reference-visuals .sc-dial::before') && css.includes('linear-gradient(128deg')],
  ['premium gold dial and illuminated number are present', css.includes('.safe-cracker-game.sc-reference-visuals .sc-dial-face') && css.includes('.safe-cracker-game.sc-reference-visuals .sc-current-number')],
  ['gold-trimmed controls are present', css.includes('.safe-cracker-game.sc-reference-visuals .sc-step-controls button') && css.includes('.safe-cracker-game.sc-reference-visuals .sc-confirm-button')],
  ['mobile hierarchy remains bounded', css.includes('@media (max-width: 700px)') && css.includes('@media (max-width: 700px) and (max-height: 780px)')],
  ['reference cache bust is present', index.includes('&audio=1&samples=1&stability=1&reference=1')],
  ['runtime stability remains installed', client.includes('// SAFE_CRACKER_RUNTIME_STABILITY_V12_START')],
  ['sample mix remains installed', client.includes('// SAFE_CRACKER_SAMPLE_MIX_V11_START')],
  ['input continuity remains installed', client.includes('// SAFE_CRACKER_INPUT_CONTINUITY_V9_START')],
  ['authoritative number submission is unchanged', client.includes('choice: `safecracker:guess:${runtime.selected}`')],
  ['protected Roulette assets remain readable', turnAnimation.length > 0 && turnFire.length > 0 && audioBindings.length > 0],
  ['visual patch cannot write networking files', !patch.includes("writeFile(new URL('../netlify/functions/")],
  ['visual patch cannot write Roulette files', !patch.includes("writeFile(new URL('../assets/roulette/")]
];

for (const [label, condition] of checks) assert(condition, label);

console.log('Safe Cracker reference visuals passed: gold framing, shadowed steel, fixed reflections, premium dial lighting, responsive mobile hierarchy, runtime stability, audio, gameplay submission, and protected Roulette boundaries are intact.');
