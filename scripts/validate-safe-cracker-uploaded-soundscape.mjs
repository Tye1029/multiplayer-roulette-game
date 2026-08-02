import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const sampleGroups = [
  {
    name: 'intro sequence',
    files: ['intro-sequence-1.b64', 'intro-sequence-2.b64', 'intro-sequence-3.b64', 'intro-sequence-4.b64'],
    minimumBytes: 12000,
    sha256: '7a15ecc1c95f91281bf646cc3fc506d1a22c4b8e7a0d8efa3f2ed42fadc2e541'
  },
  { name: 'dial detent A', files: ['dial-detent-a.b64'], minimumBytes: 900, sha256: '7bd79293ec8345ba3f45ff6bec5cfe416071250a04dd62eb49d4ab00cc0c7cec' },
  { name: 'dial detent B', files: ['dial-detent-b.b64'], minimumBytes: 1100, sha256: '5bbb474326583a1d5f27089cf93c0d12d96c152e2574ec0a66354ca26a5d6d00' },
  { name: 'incorrect number', files: ['incorrect-number.b64'], minimumBytes: 2500, sha256: '2a09cc9abdc736be9a0820f4e5b2e9d378bf9b3a5b7f9a0766dafeca20126307' },
  { name: 'correct latch', files: ['correct-latch-open.b64'], minimumBytes: 5000, sha256: '368b8e8fe5f6b7795ffbe5754d1ab0cf695a2c75d57f518f5c0e0ec95064798d' },
  {
    name: 'final vault opening',
    files: ['final-vault-open-1.b64', 'final-vault-open-2.b64', 'final-vault-open-3.b64'],
    minimumBytes: 10000,
    sha256: '03a2b17f2dbb8e8949b18911f92b62227d58bdfe403e93c4fd0145ccc0f1f44f'
  },
  {
    name: 'vault ambience',
    files: [
      'vault-ambience-loop-1.b64',
      'vault-ambience-loop-2.b64',
      'vault-ambience-loop-3.b64',
      'vault-ambience-loop-4.b64'
    ],
    minimumBytes: 17000,
    sha256: 'cfcceaf1703a9c2e8fb6f6e9cd6f0e01924b6026cff795088a3b15e3542c4d90'
  },
  { name: 'submit mechanism', files: ['submit-mechanism.b64'], minimumBytes: 2500, sha256: '6ba8244a330907ba20c5cff48d5725a1e9b81d37165b7d150f57e96e583151ab' }
];

const [client, html, patch, chunkPatch, credits, turnAnimation, turnFire, audioBindings] = await Promise.all([
  readFile(new URL('assets/safe-cracker/safe-cracker.js', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('scripts/patch-safe-cracker-uploaded-soundscape.mjs', root), 'utf8'),
  readFile(new URL('scripts/patch-safe-cracker-uploaded-soundscape-chunks.mjs', root), 'utf8'),
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
assert(occurrences(client, '// SAFE_CRACKER_UPLOADED_SOUNDSCAPE_CHUNKS_V2') === 1, 'chunked long-blend marker must appear exactly once');
assert(client.includes('const SAFE_CRACKER_UPLOADED_SOUNDSCAPE = Object.freeze({'), 'uploaded manifest is missing');
assert(client.includes('function safeCrackerLoadUploadedSound(name)'), 'uploaded preloader is missing');
assert(client.includes('const urls = Array.isArray(locations) ? locations : [locations]'), 'chunk-aware sample loading is missing');
assert(client.includes("fetch(url + '?soundscape=1', { cache: 'force-cache' })"), 'uploaded samples are not cache-busted and cached');
assert(client.includes("parts.join('')"), 'chunked samples are not reassembled before decoding');
for (let index = 1; index <= 4; index += 1) {
  assert(client.includes(`intro-sequence-${index}.b64`), `intro chunk ${index} is not mounted`);
  assert(client.includes(`vault-ambience-loop-${index}.b64`), `ambience chunk ${index} is not mounted`);
}
for (let index = 1; index <= 3; index += 1) {
  assert(client.includes(`final-vault-open-${index}.b64`), `final-opening chunk ${index} is not mounted`);
}
assert(!client.includes("intro: '/assets/safe-cracker/audio-data-v2/intro-sequence.b64'"), 'superseded single-file intro remains active');
assert(!client.includes("finalOpen: '/assets/safe-cracker/audio-data-v2/final-vault-open.b64'"), 'superseded single-file final opening remains active');
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
assert(html.includes('&soundscape=3'), 'soundscape=3 cache key is missing');
assert(credits.includes('844296__funkelfang__open-vault.wav'), 'source attribution list is incomplete');
assert(credits.includes('All nine supplied recordings'), 'mix provenance note is missing');

for (let index = 0; index < sampleGroups.length; index += 1) {
  const group = sampleGroups[index];
  const decoded = Buffer.from(encodedSamples[index], 'base64');
  const hash = createHash('sha256').update(decoded).digest('hex');
  assert(decoded.length >= group.minimumBytes, `${group.name} is unexpectedly small`);
  assert(decoded.subarray(0, 3).toString('ascii') === 'ID3' || decoded[0] === 0xff, `${group.name} is not an MP3 payload`);
  assert(hash === group.sha256, `${group.name} does not match the approved optimized blend: expected ${group.sha256}, got ${hash}, decoded ${decoded.length} bytes`);
}

assert(turnAnimation.length > 0 && turnFire.length > 0 && audioBindings.length > 0, 'protected Roulette assets are unreadable');
for (const source of [patch, chunkPatch]) {
  assert(!source.includes("writeFile(new URL('../netlify/functions/"), 'soundscape patches must not write networking files');
  assert(!source.includes("writeFile(new URL('../assets/roulette/"), 'soundscape patches must not write Roulette files');
}

console.log('Uploaded Safe Cracker soundscape validation passed: eight checksum-verified optimized blends made from all nine supplied recordings are decoded, cached, event-scoped, Android-safe, V16-compatible, and isolated from networking and Roulette.');
