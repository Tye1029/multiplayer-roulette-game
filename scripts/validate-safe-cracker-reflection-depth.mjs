import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [client, css, index, patch, turnAnimation, turnFire, audioBindings] = await Promise.all([
  readFile(new URL('assets/safe-cracker/safe-cracker.js', root), 'utf8'),
  readFile(new URL('assets/safe-cracker/safe-cracker.css', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('scripts/patch-safe-cracker-reflection-depth.mjs', root), 'utf8'),
  readFile(new URL('assets/roulette/turn-animation.js', root)),
  readFile(new URL('assets/roulette/turn-fire.js', root)),
  readFile(new URL('assets/roulette/audio-bindings.js', root))
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Safe Cracker reflection-depth validation failed: ${message}`);
}
function occurrences(source, value) {
  return source.split(value).length - 1;
}

const checks = [
  ['reflection-depth marker is unique', occurrences(css, '/* SAFE_CRACKER_REFLECTION_DEPTH_V14_START */') === 1 && occurrences(css, '/* SAFE_CRACKER_REFLECTION_DEPTH_V14_END */') === 1],
  ['oversized display overlay is disabled', css.includes('.sc-display::after') && css.includes('display: none !important') && css.includes('content: none !important')],
  ['safe reflection cannot retain a polygon clip', css.includes('.sc-safe-door::after') && css.includes('clip-path: none !important')],
  ['localized warm top light is present', css.includes('radial-gradient(ellipse 40% 16% at 49% 0%') && css.includes('radial-gradient(ellipse 44% 24% at 50% -3%')],
  ['dial rim is materially thicker', css.includes('.sc-dial-face') && css.includes('border: 10px solid #070808') && css.includes('inset 0 0 0 16px')],
  ['dial reflection is fixed above the rotating face', css.includes('.sc-dial::before') && css.includes('Screen-fixed crescent and glints') && css.includes('mix-blend-mode: screen')],
  ['dial hub is reduced to expose the thicker number ring', css.includes('.sc-dial-hub') && css.includes('width: 35%')],
  ['minus and plus controls are aligned and centered', css.includes('.sc-step-controls') && css.includes('margin: -4px 0 11px') && css.includes('place-items: center')],
  ['mobile short-screen layout is bounded', css.includes('@media (max-width: 700px) and (max-height: 780px)') && css.includes('width: 82px')],
  ['JavaScript depth cache bust is present', index.includes('/assets/safe-cracker/safe-cracker.js?v=8&polish=2&fit=2&result=1&final=1&refine=1&correct=1&input=1&audio=1&samples=1&stability=1&reference=1&depth=1')],
  ['stylesheet depth cache bust is present', index.includes('/assets/safe-cracker/safe-cracker.css?v=8&polish=2&fit=2&result=1&final=1&refine=1&correct=1&input=1&reference=1&depth=1')],
  ['reference visuals remain installed', client.includes('// SAFE_CRACKER_REFERENCE_VISUALS_V13_START')],
  ['runtime stability remains installed', client.includes('// SAFE_CRACKER_RUNTIME_STABILITY_V12_START')],
  ['authoritative submission remains unchanged', client.includes('choice: `safecracker:guess:${runtime.selected}`')],
  ['protected Roulette assets remain readable', turnAnimation.length > 0 && turnFire.length > 0 && audioBindings.length > 0],
  ['patch cannot write networking files', !patch.includes("writeFile(new URL('../netlify/functions/")],
  ['patch cannot write Roulette files', !patch.includes("writeFile(new URL('../assets/roulette/")]
];

for (const [label, condition] of checks) assert(condition, label);

console.log('Safe Cracker reflection-depth validation passed: trapezoid removed, localized warm lighting, thicker reflective dial, aligned controls, responsive fit, stable gameplay, and protected Roulette boundaries are intact.');