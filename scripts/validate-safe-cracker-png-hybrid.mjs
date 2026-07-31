import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const pngNames = Object.freeze([
  'safe-body.png',
  'dial-face.png',
  'dial-rim-pointer.png',
  'dial-hub.png',
  'button-minus.png',
  'button-plus.png',
  'button-check-frame.png'
]);
const [client, css, index, assetPatch, hybridPatch, turnAnimation, turnFire, audioBindings, ...pngs] = await Promise.all([
  readFile(new URL('assets/safe-cracker/safe-cracker.js', root), 'utf8'),
  readFile(new URL('assets/safe-cracker/safe-cracker.css', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('scripts/patch-safe-cracker-png-assets.mjs', root), 'utf8'),
  readFile(new URL('scripts/patch-safe-cracker-png-hybrid.mjs', root), 'utf8'),
  readFile(new URL('assets/roulette/turn-animation.js', root)),
  readFile(new URL('assets/roulette/turn-fire.js', root)),
  readFile(new URL('assets/roulette/audio-bindings.js', root)),
  ...pngNames.map(name => readFile(new URL(`assets/safe-cracker/png-ui/${name}`, root)))
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Safe Cracker PNG-hybrid validation failed: ${message}`);
}
function occurrences(source, value) {
  return source.split(value).length - 1;
}
function isPng(buffer) {
  return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
}

assert(occurrences(css, '/* SAFE_CRACKER_PNG_HYBRID_V15_START */') === 1, 'hybrid CSS marker must appear exactly once');
assert(occurrences(css, '/* SAFE_CRACKER_PNG_HYBRID_V15_END */') === 1, 'hybrid CSS end marker must appear exactly once');
assert(css.includes("background-image: url('/assets/safe-cracker/png-ui/safe-body.png')"), 'static safe body PNG is not mounted');
assert(css.includes("url('/assets/safe-cracker/png-ui/dial-face.png')"), 'rotating dial-face PNG is not mounted');
assert(css.includes("url('/assets/safe-cracker/png-ui/dial-rim-pointer.png')"), 'fixed dial rim and pointer PNG is not mounted');
assert(css.includes("url('/assets/safe-cracker/png-ui/dial-hub.png')"), 'fixed dial hub PNG is not mounted');
assert(css.includes("url('/assets/safe-cracker/png-ui/button-minus.png')"), 'minus-button PNG is not mounted');
assert(css.includes("url('/assets/safe-cracker/png-ui/button-plus.png')"), 'plus-button PNG is not mounted');
assert(css.includes("url('/assets/safe-cracker/png-ui/button-check-frame.png')"), 'check-button frame PNG is not mounted');
assert(css.includes('aspect-ratio: 450 / 606'), 'static safe geometry is not bounded to the artwork ratio');
assert(css.includes('left: 13.33%') && css.includes('top: 20.46%'), 'dial assembly is not aligned to the static body');
assert(css.includes('left: 11.69%') && css.includes('top: 12.2%'), 'rotating dial plate is not independently positioned');
assert(css.includes('.sc-dial-number,') && css.includes('.sc-dial-hub {\n  display: none !important;'), 'legacy CSS dial numbers or rotating hub are still visible');
assert(css.includes('.sc-dial-wrap::after') && css.includes('z-index: 10'), 'dial hub is not fixed above the rotating face');
assert(css.includes('.sc-display-status') && css.includes('.sc-display-meta'), 'live status and attempt text were removed');
assert(css.includes('.sc-current-number') && css.includes('z-index: 14'), 'live selected number was removed');
assert(css.includes('.sc-confirm-button span'), 'live confirmation label was removed');
assert(css.includes('touch-action: none') && css.includes('touch-action: manipulation'), 'interactive dial or button touch behavior is missing');
assert(index.includes('&reference=1&depth=1&png=1'), 'PNG hybrid cache bust is missing');
assert(client.includes('function applyDialVisual()') || client.includes('applyDialVisual();'), 'live dial rotation code is missing');
assert(client.includes('choice: `safecracker:guess:${runtime.selected}`'), 'authoritative number submission changed');
assert(client.includes('// SAFE_CRACKER_RUNTIME_STABILITY_V12_START'), 'runtime stability v12 is no longer installed');
assert(client.includes('// SAFE_CRACKER_SAMPLE_MIX_V11_START'), 'sample mix v11 is no longer installed');
assert(client.includes('// SAFE_CRACKER_INPUT_CONTINUITY_V9_START'), 'input continuity v9 is no longer installed');
assert(client.includes('// SAFE_CRACKER_REFERENCE_VISUALS_V13_START'), 'reference visual runtime is no longer installed');
assert(css.includes('/* SAFE_CRACKER_REFLECTION_DEPTH_V14_START */'), 'reflection-depth v14 is no longer installed before the hybrid override');

for (let indexValue = 0; indexValue < pngs.length; indexValue += 1) {
  const name = pngNames[indexValue];
  const data = pngs[indexValue];
  const minimum = name === 'safe-body.png' ? 20_000 : 1_500;
  assert(data.length > minimum, `${name} is unexpectedly small`);
  assert(isPng(data), `${name} does not have a PNG signature`);
}

assert(assetPatch.includes("Buffer.from('SCPNG1\\n'"), 'asset patch does not verify the bundle header');
assert(assetPatch.includes('pngSignature'), 'asset patch does not validate PNG signatures');
assert(turnAnimation.length > 0 && turnFire.length > 0 && audioBindings.length > 0, 'protected Roulette assets are unreadable');
for (const patch of [assetPatch, hybridPatch]) {
  assert(!patch.includes("writeFile(new URL('../netlify/functions/"), 'PNG patch must not write networking files');
  assert(!patch.includes("writeFile(new URL('../assets/roulette/"), 'PNG patch must not write Roulette files');
}

console.log('Safe Cracker PNG-hybrid validation passed: seven reference-derived PNG layers, independent live dial and controls, responsive alignment, runtime stability, authoritative gameplay, audio, and protected Roulette boundaries are intact.');
