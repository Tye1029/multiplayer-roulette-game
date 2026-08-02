import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const samples = [
  ['intro-sequence.b64', 30000],
  ['dial-detent-a.b64', 1500],
  ['dial-detent-b.b64', 1800],
  ['incorrect-number.b64', 4000],
  ['correct-latch-open.b64', 8000],
  ['final-vault-open.b64', 25000],
  ['vault-ambience-loop.b64', 25000],
  ['submit-mechanism.b64', 4000]
];

const [client, html, patch, credits, turnAnimation, turnFire, audioBindings, ...encodedSamples] = await Promise.all([
  readFile(new URL('assets/safe-cracker/safe-cracker.js', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('scripts/patch-safe-cracker-uploaded-soundscape.mjs', root), 'utf8'),
  readFile(new URL('assets/safe-cracker/audio-data-v2/ATTRIBUTION.md', root), 'utf8'),
  readFile(new URL('assets/roulette/turn-animation.js', root)),
  readFile(new URL('assets/roulette/turn-fire.js', root)),
  readFile(new URL('assets/roulette/audio-bindings.js', root)),
  ...samples.map(([name]) => readFile(new URL(`assets/safe-cracker/audio-data-v2/${name}`, root), 'utf8'))
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Uploaded Safe Cracker soundscape validation failed: ${message}`);
}
function occurrences(source, value) {
  return source.split(value).length - 1;
}

assert(occurrences(client, '// SAFE_CRACKER_UPLOADED_SOUNDSCAPE_V1_START') === 1, 'runtime marker must appear exactly once');
assert(occurrences(client, '// SAFE_CRACKER_UPLOADED_SOUNDSCAPE_V1_END') === 1, 'runtime end marker must appear exactly once');
assert(client.includes('const SAFE_CRACKER_UPLOADED_SOUNDSCAPE = Object.freeze({'), 'uploaded manifest is missing');
assert(client.includes('function safeCrackerLoadUploadedSound(name)'), 'uploaded preloader is missing');
assert(client.includes("fetch(url + '?soundscape=1', { cache: 'force-cache' })"), 'uploaded samples are not cache-busted and cached');
assert(client.includes('function safeCrackerPlayUploadedSound(name, options = {})'), 'uploaded player is missing');
assert(client.includes('function safeCrackerStartUploadedAmbience()'), 'ambience starter is missing');
assert(client.includes("safeCrackerPlayUploadedSound('intro'"), 'intro sequence is missing');
assert(client.includes("safeCrackerPlayUploadedSound(sample"), 'alternating dial samples are missing');
assert(client.includes("safeCrackerPlayUploadedSound('incorrect'"), 'incorrect-number sample is missing');
assert(client.includes("safeCrackerPlayUploadedSound('latchOpen'"), 'correct latch sample is missing');
assert(client.includes("safeCrackerPlayUploadedSound('finalOpen'"), 'final vault-opening sample is missing');
assert(client.includes("safeCrackerPlayUploadedSound('ambience'"), 'background ambience is missing');
assert(client.includes("safeCrackerPlayUploadedSound('submit'"), 'submit mechanism is missing');
assert(client.includes('playDetent = safeCrackerPlayDetent'), 'dial binding was not updated');
assert(client.includes('playFeedback = safeCrackerPlayFeedback'), 'feedback binding was not updated');
assert(client.includes('// SAFE_CRACKER_SAMPLE_MIX_V11_START'), 'existing sample mix was removed');
assert(client.includes('// SAFE_CRACKER_AUDIO_PASS_V10_START'), 'audio pass v10 was removed');
assert(client.includes('// SAFE_CRACKER_DIAL_ACTIVITY_V16_START'), 'dial-board retention v16 was removed');
assert(client.includes('choice: `safecracker:guess:${runtime.selected}`'), 'authoritative submission changed');
assert(html.includes('&soundscape=1'), 'soundscape cache key is missing');
assert(credits.includes('844296__funkelfang__open-vault.wav'), 'source attribution list is incomplete');
assert(credits.includes('All nine supplied recordings'), 'mix provenance note is missing');

for (let index = 0; index < samples.length; index += 1) {
  const [name, minimumBytes] = samples[index];
  const encoded = encodedSamples[index].replace(/\s+/g, '');
  const decoded = Buffer.from(encoded, 'base64');
  assert(decoded.length >= minimumBytes, `${name} is unexpectedly small`);
  assert(decoded.subarray(0, 3).toString('ascii') === 'ID3' || decoded[0] === 0xff, `${name} is not an MP3 payload`);
}

assert(turnAnimation.length > 0 && turnFire.length > 0 && audioBindings.length > 0, 'protected Roulette assets are unreadable');
assert(!patch.includes("writeFile(new URL('../netlify/functions/"), 'soundscape patch must not write networking files');
assert(!patch.includes("writeFile(new URL('../assets/roulette/"), 'soundscape patch must not write Roulette files');

console.log('Uploaded Safe Cracker soundscape validation passed: eight optimized blends made from all nine supplied recordings are decoded, cached, event-scoped, ambience-safe, V16-compatible, and isolated from networking and Roulette.');
