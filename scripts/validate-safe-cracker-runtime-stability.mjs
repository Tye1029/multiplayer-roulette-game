import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [client, index, patch, samplePatch, turnAnimation, turnFire, audioBindings] = await Promise.all([
  readFile(new URL('assets/safe-cracker/safe-cracker.js', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('scripts/patch-safe-cracker-runtime-stability.mjs', root), 'utf8'),
  readFile(new URL('scripts/patch-safe-cracker-sample-mix.mjs', root), 'utf8'),
  readFile(new URL('assets/roulette/turn-animation.js', root)),
  readFile(new URL('assets/roulette/turn-fire.js', root)),
  readFile(new URL('assets/roulette/audio-bindings.js', root))
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Safe Cracker runtime-stability validation failed: ${message}`);
}
function occurrences(source, value) {
  return source.split(value).length - 1;
}

assert(occurrences(client, '// SAFE_CRACKER_RUNTIME_STABILITY_V12_START') === 1, 'runtime marker must appear exactly once');
assert(occurrences(client, '// SAFE_CRACKER_RUNTIME_STABILITY_V12_END') === 1, 'runtime end marker must appear exactly once');
assert(client.includes('function safeCrackerLoadSampleSerialized(name)'), 'serialized sample loader is missing');
assert(client.includes('runtime.safeCrackerSampleGestureUnlocked'), 'sample loading is not gesture-gated');
assert(client.includes('runtime.safeCrackerSampleDecodeChain'), 'sample decode queue is missing');
assert(client.includes("window.setTimeout(() => resolve(buffer), 110)"), 'sample decode breathing room is missing');
assert(client.includes('function safeCrackerUnlockSampleLoading()'), 'sample unlock helper is missing');
assert(client.includes("document.addEventListener('pointerdown', safeCrackerUnlockSampleLoading"), 'pointer gesture sample unlock is missing');
assert(client.includes("document.addEventListener('keydown', safeCrackerUnlockSampleLoading"), 'keyboard sample unlock is missing');
assert(client.includes('function safeCrackerReleaseInterruptedDrag(reason, event = null)'), 'interrupted-drag recovery is missing');
assert(client.includes("window.addEventListener('pointerup'"), 'global pointer-up recovery is missing');
assert(client.includes("window.addEventListener('pointercancel'"), 'global pointer-cancel recovery is missing');
assert(client.includes("document.addEventListener('lostpointercapture'"), 'lost-pointer-capture recovery is missing');
assert(client.includes("window.addEventListener('blur'"), 'window-blur recovery is missing');
assert(client.includes("safeCrackerReleaseInterruptedDrag('document-hidden')"), 'visibility recovery is missing');
assert(client.includes("safeCrackerReleaseInterruptedDrag('drag-watchdog')"), 'bounded drag watchdog is missing');
assert(client.includes('const pendingGame = runtime.pendingDragGame;'), 'queued polling snapshot recovery is missing');
assert(client.includes('runtime.pendingDragGame = null;'), 'queued polling snapshot is not cleared');
assert(client.includes('// SAFE_CRACKER_INPUT_CONTINUITY_V9_START'), 'input continuity v9 is no longer installed');
assert(client.includes('// SAFE_CRACKER_SAMPLE_MIX_V11_START'), 'sample mix v11 is no longer installed');
assert(client.includes('// SAFE_CRACKER_AUDIO_PASS_V10_START'), 'audio pass v10 is no longer installed');
assert(client.includes('choice: `safecracker:guess:${runtime.selected}`'), 'authoritative number submission changed');
assert(index.includes('&audio=1&samples=1&stability=1'), 'runtime-stability cache bust is missing');
assert(samplePatch.includes("window.addEventListener(STATE_EVENT, event =>"), 'validator no longer covers the original eager sample-prime listener');
assert(turnAnimation.length > 0 && turnFire.length > 0 && audioBindings.length > 0, 'protected Roulette assets are unreadable');
assert(!patch.includes("writeFile(new URL('../netlify/functions/"), 'runtime patch must not write networking files');
assert(!patch.includes("writeFile(new URL('../assets/roulette/"), 'runtime patch must not write Roulette files');

console.log('Safe Cracker runtime-stability validation passed: sample decoding is serialized after interaction, mobile pointer interruptions recover, queued snapshots flush, and Roulette stays protected.');
