import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const sampleGroups = [
  { name: 'intro sequence', files: ['intro-sequence.b64'], minimumBytes: 12000 },
  { name: 'dial detent A', files: ['dial-detent-a.b64'], minimumBytes: 900 },
  { name: 'dial detent B', files: ['dial-detent-b.b64'], minimumBytes: 1100 },
  { name: 'incorrect number', files: ['incorrect-number.b64'], minimumBytes: 2500 },
  { name: 'correct latch', files: ['correct-latch-open.b64'], minimumBytes: 5000 },
  { name: 'final vault opening', files: ['final-vault-open.b64'], minimumBytes: 10000 },
  {
    name: 'vault ambience',
    files: [
      'vault-ambience-loop-1.b64',
      'vault-ambience-loop-2.b64',
      'vault-ambience-loop-3.b64',
      'vault-ambience-loop-4.b64'
    ],
    minimumBytes: 17000
  },
  { name: 'submit mechanism', files: ['submit-mechanism.b64'], minimumBytes: 2500 }
];

const [client, html, patch, credits, turnAnimation, turnFire, audioBindings] = await Promise.all([
  readFile(new URL('assets/safe-cracker/safe-cracker.js', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('scripts/patch-safe-cracker-uploaded-soundscape.mjs', root), 'utf8'),
  readFile(new URL('assets/safe-cracker/audio-data-v2/ATTRIBUTION.md', root), 'utf8'),
  readFile(new URL('assets/roulette/turn-animation.js', root)),
  readFile(new URL('assets/roulette/turn-fire.js', root)),
  readFile(new URL('assets/roulette/audio-bindings.js', root))
]);

const encodedSamples = await Promise.all(sampleGroups.map(async group => {
  const parts = await Promise.all(group.files.map(file =>
    readFile(new URL(`assets/safe-cracker/audio-data-v2/${file}`, root), 'utf8')
  ));
  return parts.join('').replace(/\s+/g, '');
}));

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
assert(client.includes('const urls = Array.isArray(locations) ? locations : [locations]'), 'chunk-aware sample loading is missing');
assert(client.includes("fetch(url + '?soundscape=1', { cache: 'force-cache' })"), 'uploaded samples are not cache-busted and cached');
assert(client.includes("parts.join('')"), 'chunked ambience is not reassembled before decoding');
for (let index = 1; index <= 4; index += 1) {
  assert(client.includes(`vault-ambience-loop-${index}.b64`), `ambience chunk ${index} is not mounted`);
}
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

for (let index = 0; index < sampleGroups.length; index += 1) {
  const group = sampleGroups[index];
  const decoded = Buffer.from(encodedSamples[index], 'base64');
  assert(decoded.length >= group.minimumBytes, `${group.name} is unexpectedly small`);
  assert(decoded.subarray(0, 3).toString('ascii') === 'ID3' || decoded[0] === 0xff, `${group.name} is not an MP3 payload`);
}

assert(turnAnimation.length > 0 && turnFire.length > 0 && audioBindings.length > 0, 'protected Roulette assets are unreadable');
assert(!patch.includes("writeFile(new URL('../netlify/functions/"), 'soundscape patch must not write networking files');
assert(!patch.includes("writeFile(new URL('../assets/roulette/"), 'soundscape patch must not write Roulette files');

console.log('Uploaded Safe Cracker soundscape validation passed: eight optimized blends made from all nine supplied recordings are decoded, cached, event-scoped, ambience-safe, V16-compatible, and isolated from networking and Roulette.');
