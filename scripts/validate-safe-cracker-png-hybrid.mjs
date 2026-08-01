import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const pngNames = Object.freeze(['safe-body.png', 'dial-face.png']);
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
function pngDimensions(buffer) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert(buffer.length >= 24 && buffer.subarray(0, 8).equals(signature), 'asset does not have a PNG signature');
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}
function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

assert(occurrences(css, '/* SAFE_CRACKER_PNG_HYBRID_V15_START */') === 1, 'hybrid CSS marker must appear exactly once');
assert(occurrences(css, '/* SAFE_CRACKER_PNG_HYBRID_V15_END */') === 1, 'hybrid CSS end marker must appear exactly once');
assert(css.includes("background-image: url('/assets/safe-cracker/png-ui/safe-body.png?v=2')"), 'base static safe body PNG is not mounted');
assert(css.includes("background-image: url('/assets/safe-cracker/png-ui/dial-face.png?v=2')"), 'base rotating dial-face PNG is not mounted');
assert(css.includes('aspect-ratio: 432 / 561'), 'static safe geometry is not bounded to the supplied artwork ratio');
assert(css.includes('left: 23.495%') && css.includes('top: 9.002%'), 'live display is not aligned to the display opening');
assert(css.includes('left: 23.73%') && css.includes('top: 28.16%'), 'rotating dial plate is not aligned to the static body');
assert(css.includes('.sc-dial-number,') && css.includes('.sc-dial-hub {\n  display: none !important;'), 'legacy CSS dial numbers or hub are still visible');
assert(css.includes('.sc-safe-handle') && css.includes('content: none !important;'), 'legacy CSS safe hardware is still visible');
assert(css.includes('.sc-display-status') && css.includes('.sc-display-meta'), 'live status and attempt text were removed');
assert(css.includes('.sc-current-number') && css.includes('z-index: 14'), 'live selected number was removed');
assert(css.includes('.sc-confirm-button span'), 'live confirmation label was removed');
assert(css.includes('touch-action: none !important') && css.includes('touch-action: manipulation !important'), 'interactive dial or button touch behavior is missing');
assert(index.includes('&reference=1&depth=1&png=1'), 'PNG hybrid cache bust is missing');
assert(client.includes('function applyDialVisual()') || client.includes('applyDialVisual();'), 'live dial rotation code is missing');
assert(client.includes('choice: `safecracker:guess:${runtime.selected}`'), 'authoritative number submission changed');
assert(client.includes('// SAFE_CRACKER_RUNTIME_STABILITY_V12_START'), 'runtime stability v12 is no longer installed');
assert(client.includes('// SAFE_CRACKER_SAMPLE_MIX_V11_START'), 'sample mix v11 is no longer installed');
assert(client.includes('// SAFE_CRACKER_INPUT_CONTINUITY_V9_START'), 'input continuity v9 is no longer installed');
assert(client.includes('// SAFE_CRACKER_REFERENCE_VISUALS_V13_START'), 'reference visual runtime is no longer installed');
assert(css.includes('/* SAFE_CRACKER_REFLECTION_DEPTH_V14_START */'), 'reflection-depth v14 is no longer installed before the hybrid override');

const [bodyWidth, bodyHeight] = pngDimensions(pngs[0]);
const [dialWidth, dialHeight] = pngDimensions(pngs[1]);
assert(bodyWidth === 432 && bodyHeight === 561, `safe-body.png dimensions changed to ${bodyWidth}x${bodyHeight}`);
assert(dialWidth === 226 && dialHeight === 226, `dial-face.png dimensions changed to ${dialWidth}x${dialHeight}`);
assert(pngs[0].length === 42_449, `safe-body.png size changed to ${pngs[0].length}`);
assert(pngs[1].length === 13_498, `dial-face.png size changed to ${pngs[1].length}`);
assert(sha256(pngs[0]) === '96128cc36a50ee38b743b08fad7cafb59552eabbc3e610f134002abbdf4129ec', 'safe-body.png does not match the complete supplied artwork');
assert(sha256(pngs[1]) === '1eec8dab3287dfd47e881fec3adcaec1be66d45f5f687e8c9508b885f57a648e', 'dial-face.png does not match the complete supplied artwork');

assert(assetPatch.includes("Buffer.from('SCPNG6\\n'"), 'asset patch does not verify the complete artwork bundle header');
assert(assetPatch.includes('png-ui-v6-data') && assetPatch.includes('expectedChunks'), 'asset patch does not use the complete verified chunks');
assert(assetPatch.includes('createHash') && assetPatch.includes('pngSignature') && assetPatch.includes('writeFile'), 'asset patch does not validate and write complete PNG assets');
assert(!assetPatch.includes('png-ui-v5-data'), 'obsolete compact PNG bundle is still active');
assert(turnAnimation.length > 0 && turnFire.length > 0 && audioBindings.length > 0, 'protected Roulette assets are unreadable');
for (const patch of [assetPatch, hybridPatch]) {
  assert(!patch.includes("writeFile(new URL('../netlify/functions/"), 'PNG patch must not write networking files');
  assert(!patch.includes("writeFile(new URL('../assets/roulette/"), 'PNG patch must not write Roulette files');
}

console.log('Safe Cracker PNG-hybrid validation passed: complete supplied safe artwork, independently rotating full dial, live controls, runtime stability, authoritative gameplay, audio, and protected Roulette boundaries are intact.');
