import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const sampleNames = [
  'submit-latch.b64',
  'tumbler-lock.b64',
  'safe-unlock.b64',
  'safe-bolt-mechanism.b64',
  'safe-door-open.b64',
  'safe-door-lockdown.b64'
];
const [client, index, patch, turnAnimation, turnFire, audioBindings, ...samples] = await Promise.all([
  readFile(new URL('assets/safe-cracker/safe-cracker.js', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('scripts/patch-safe-cracker-sample-mix.mjs', root), 'utf8'),
  readFile(new URL('assets/roulette/turn-animation.js', root)),
  readFile(new URL('assets/roulette/turn-fire.js', root)),
  readFile(new URL('assets/roulette/audio-bindings.js', root)),
  ...sampleNames.map(name => readFile(new URL(`assets/safe-cracker/audio-data/${name}`, root), 'utf8'))
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Safe Cracker sample-mix validation failed: ${message}`);
}
function occurrences(source, value) {
  return source.split(value).length - 1;
}

assert(occurrences(client, '// SAFE_CRACKER_SAMPLE_MIX_V11_START') === 1, 'sample runtime marker must appear exactly once');
assert(occurrences(client, '// SAFE_CRACKER_SAMPLE_MIX_V11_END') === 1, 'sample runtime end marker must appear exactly once');
assert(client.includes('const SAFE_CRACKER_SAMPLE_MANIFEST = Object.freeze({'), 'sample manifest is missing');
assert(client.includes('function safeCrackerLoadSample(name)'), 'sample preloader is missing');
assert(client.includes("fetch(url, { cache: 'force-cache' })"), 'sample assets are not cached');
assert(client.includes('function safeCrackerPlaySample(name, options = {})'), 'sample player is missing');
assert(client.includes("safeCrackerPlaySample('submitLatch'"), 'submission sample is missing');
assert(client.includes("safeCrackerPlaySample('tumblerLock'"), 'tumbler sample is missing');
assert(client.includes("safeCrackerPlaySample('safeUnlock'"), 'unlock sample is missing');
assert(client.includes("safeCrackerPlaySample('boltMechanism'"), 'bolt-mechanism sample is missing');
assert(client.includes("safeCrackerPlaySample('safeDoorOpen'"), 'safe-opening sample is missing');
assert(client.includes("safeCrackerPlaySample('safeDoorLockdown'"), 'loss/tie lockdown sample is missing');
assert(client.includes('safeCrackerSubmitSynth();'), 'submission synth fallback is missing');
assert(client.includes('safeCrackerTumblerSynth();'), 'tumbler synth blend is missing');
assert(client.includes('if (!unlock && !bolts && !door)'), 'safe-opening fallback is missing');
assert(client.includes("playSafeCrackerResultSequence = safeCrackerPlayResultSequence"), 'result-sequence sample wrapper is not connected');
assert(client.includes('// SAFE_CRACKER_AUDIO_PASS_V10_START'), 'audio pass v10 is no longer installed');
assert(client.includes('// SAFE_CRACKER_INPUT_CONTINUITY_V9_START'), 'input continuity is no longer installed');
assert(client.includes('// SAFE_CRACKER_VIDEO_CORRECTION_V8_START'), 'Pass 8 visual correction is no longer installed');
assert(client.includes('choice: `safecracker:guess:${runtime.selected}`'), 'authoritative number submission changed');
assert(index.includes('&audio=1&samples=1'), 'sample cache bust is missing');
for (let index = 0; index < samples.length; index += 1) {
  const encoded = samples[index].replace(/\s+/g, '');
  assert(encoded.length > 4000, `${sampleNames[index]} is unexpectedly small`);
  const decoded = Buffer.from(encoded, 'base64');
  assert(decoded.length > 3000, `${sampleNames[index]} could not be decoded`);
  assert(decoded.subarray(0, 3).toString('ascii') === 'ID3' || decoded[0] === 0xff, `${sampleNames[index]} is not an MP3 payload`);
}
assert(turnAnimation.length > 0 && turnFire.length > 0 && audioBindings.length > 0, 'protected Roulette assets are unreadable');
assert(!patch.includes("writeFile(new URL('../netlify/functions/"), 'sample patch must not write networking files');
assert(!patch.includes("writeFile(new URL('../assets/roulette/"), 'sample patch must not write Roulette files');

console.log('Safe Cracker sample-mix validation passed: six optimized user-supplied mechanical samples are mapped, decoded, blended, cached, and isolated from gameplay, networking, and Roulette.');
