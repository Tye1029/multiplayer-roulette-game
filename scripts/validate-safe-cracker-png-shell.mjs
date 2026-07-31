import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [client, css, index, patch, bodyPng, dialPng, bodyB64, dialB64, turnAnimation, turnFire, audioBindings] = await Promise.all([
  readFile(new URL('assets/safe-cracker/safe-cracker.js', root), 'utf8'),
  readFile(new URL('assets/safe-cracker/safe-cracker.css', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('scripts/patch-safe-cracker-png-shell.mjs', root), 'utf8'),
  readFile(new URL('assets/safe-cracker/reference/safe-body-layer.png', root)),
  readFile(new URL('assets/safe-cracker/reference/safe-dial-face-layer.png', root)),
  readFile(new URL('assets/safe-cracker/reference/safe-body-layer.b64', root), 'utf8'),
  readFile(new URL('assets/safe-cracker/reference/safe-dial-face-layer.b64', root), 'utf8'),
  readFile(new URL('assets/roulette/turn-animation.js', root)),
  readFile(new URL('assets/roulette/turn-fire.js', root)),
  readFile(new URL('assets/roulette/audio-bindings.js', root))
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Safe Cracker PNG-shell validation failed: ${message}`);
}
function occurrences(source, value) {
  return source.split(value).length - 1;
}
function pngDimensions(buffer) {
  assert(buffer.subarray(1, 4).toString('ascii') === 'PNG', 'decoded asset is not PNG');
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}

const [bodyWidth, bodyHeight] = pngDimensions(bodyPng);
const [dialWidth, dialHeight] = pngDimensions(dialPng);

assert(bodyWidth === 864 && bodyHeight === 1122, 'safe body dimensions changed');
assert(dialWidth === 452 && dialHeight === 452, 'dial dimensions changed');
assert(bodyPng.length > 100000, 'safe body PNG is unexpectedly small');
assert(dialPng.length > 30000, 'dial PNG is unexpectedly small');
assert(Buffer.from(bodyB64.replace(/\s+/g, ''), 'base64').equals(bodyPng), 'safe body payload and decoded PNG differ');
assert(Buffer.from(dialB64.replace(/\s+/g, ''), 'base64').equals(dialPng), 'dial payload and decoded PNG differ');
assert(occurrences(css, '/* SAFE_CRACKER_PNG_SHELL_V15_START */') === 1, 'PNG-shell marker must appear once');
assert(occurrences(css, '/* SAFE_CRACKER_PNG_SHELL_V15_END */') === 1, 'PNG-shell end marker must appear once');
assert(css.includes("background-image: url('/assets/safe-cracker/reference/safe-body-layer.png?v=1')"), 'safe body PNG is not mounted');
assert(css.includes("background-image: url('/assets/safe-cracker/reference/safe-dial-face-layer.png?v=1')"), 'dial PNG is not mounted');
assert(css.includes('aspect-ratio: 864 / 1122'), 'safe body aspect ratio is not locked');
assert(css.includes('left: 23.495%') && css.includes('top: 9.002%'), 'live display is not aligned to the PNG opening');
assert(css.includes('left: 23.73%') && css.includes('top: 28.16%'), 'rotating dial is not aligned to the PNG opening');
assert(css.includes('left: 31.25%') && css.includes('top: 73.44%'), 'minus/plus controls are not aligned to the PNG openings');
assert(css.includes('left: 20.6%') && css.includes('top: 86.81%'), 'confirm control is not aligned to the PNG opening');
assert(css.includes('.sc-dial-number') && css.includes('.sc-dial-hub') && css.includes('display: none !important'), 'duplicate CSS dial artwork is not removed');
assert(css.includes('.sc-bolts') && css.includes('.sc-safe-handle') && css.includes('content: none !important'), 'duplicate CSS safe hardware is not removed');
assert(index.includes('&reference=1&depth=1&pngshell=1'), 'PNG-shell cache version is missing');
assert(client.includes('// SAFE_CRACKER_RUNTIME_STABILITY_V12_START'), 'runtime stability is no longer installed');
assert(client.includes('// SAFE_CRACKER_SAMPLE_MIX_V11_START'), 'sample mix is no longer installed');
assert(client.includes('choice: `safecracker:guess:${runtime.selected}`'), 'authoritative number submission changed');
assert(turnAnimation.length > 0 && turnFire.length > 0 && audioBindings.length > 0, 'protected Roulette assets are unreadable');
assert(!patch.includes("writeFile(new URL('../netlify/functions/"), 'PNG-shell patch must not write networking files');
assert(!patch.includes("writeFile(new URL('../assets/roulette/"), 'PNG-shell patch must not write Roulette files');

console.log('Safe Cracker PNG-shell validation passed: supplied static safe body, supplied rotating dial face, live display and controls, exact alignment, cache versioning, gameplay submission, runtime stability, audio, and protected Roulette boundaries are intact.');
