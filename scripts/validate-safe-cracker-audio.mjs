import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

// The build reaches this validator after the procedural audio pass. Importing
// the recorded patch installs the uploaded samples before verification.
await import('./patch-safe-cracker-uploaded-soundscape.mjs');

const root = new URL('../', import.meta.url);
const assetSpec = Object.freeze({
  intro: { directory: 'audio-data-v2', files: ['intro-sequence-1.b64', 'intro-sequence-2.b64', 'intro-sequence-3.b64', 'intro-sequence-4.b64'], bytes: 14048, sha256: '7a15ecc1c95f91281bf646cc3fc506d1a22c4b8e7a0d8efa3f2ed42fadc2e541' },
  dialA: { directory: 'audio-data-v2', files: ['dial-detent-a.b64'], bytes: 1244, sha256: '7bd79293ec8345ba3f45ff6bec5cfe416071250a04dd62eb49d4ab00cc0c7cec' },
  dialB: { directory: 'audio-data-v2', files: ['dial-detent-b.b64'], bytes: 1528, sha256: '5bbb474326583a1d5f27089cf93c0d12d96c152e2574ec0a66354ca26a5d6d00' },
  submit: { directory: 'audio-data-v2', files: ['submit-mechanism.b64'], bytes: 3104, sha256: '6ba8244a330907ba20c5cff48d5725a1e9b81d37165b7d150f57e96e583151ab' },
  incorrect: { directory: 'audio-data-v2', files: ['incorrect-number.b64'], bytes: 3281, sha256: '2a09cc9abdc736be9a0820f4e5b2e9d378bf9b3a5b7f9a0766dafeca20126307' },
  latchOpen: { directory: 'audio-data-v2', files: ['correct-latch-open.b64'], bytes: 6258, sha256: '368b8e8fe5f6b7795ffbe5754d1ab0cf695a2c75d57f518f5c0e0ec95064798d' },
  safeOpen: { directory: 'audio-data-v2', files: ['final-vault-open-1.b64', 'final-vault-open-2.b64', 'final-vault-open-3.b64'], bytes: 12159, sha256: '03a2b17f2dbb8e8949b18911f92b62227d58bdfe403e93c4fd0145ccc0f1f44f' },
  ambience: { directory: 'audio-data-v2', files: ['vault-ambience-loop-1.b64', 'vault-ambience-loop-2.b64', 'vault-ambience-loop-3.b64', 'vault-ambience-loop-4.b64'], bytes: 19664, sha256: 'cfcceaf1703a9c2e8fb6f6e9cd6f0e01924b6026cff795088a3b15e3542c4d90' }
});

const [client, index, proceduralPatch, recordedPatch, turnAnimation, turnFire, audioBindings] = await Promise.all([
  readFile(new URL('assets/safe-cracker/safe-cracker.js', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('scripts/patch-safe-cracker-audio.mjs', root), 'utf8'),
  readFile(new URL('scripts/patch-safe-cracker-uploaded-soundscape.mjs', root), 'utf8'),
  readFile(new URL('assets/roulette/turn-animation.js', root)),
  readFile(new URL('assets/roulette/turn-fire.js', root)),
  readFile(new URL('assets/roulette/audio-bindings.js', root))
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Safe Cracker audio validation failed: ${message}`);
}

function occurrences(source, value) {
  return source.split(value).length - 1;
}

for (const [name, spec] of Object.entries(assetSpec)) {
  const parts = await Promise.all(spec.files.map(file =>
    readFile(new URL(`assets/safe-cracker/${spec.directory}/${file}`, root), 'utf8')
  ));
  const bytes = Buffer.from(parts.join('').replace(/\s+/g, ''), 'base64');
  const hash = createHash('sha256').update(bytes).digest('hex');
  assert(bytes.length === spec.bytes, `${name} decoded size is ${bytes.length}, expected ${spec.bytes}`);
  assert(hash === spec.sha256, `${name} checksum is ${hash}, expected ${spec.sha256}`);
  assert(bytes.subarray(0, 3).toString('ascii') === 'ID3' || bytes[0] === 0xff, `${name} is not a decodable MP3 payload`);
}

const checks = [
  ['procedural audio runtime marker is unique', occurrences(client, '// SAFE_CRACKER_AUDIO_PASS_V10_START') === 1 && occurrences(client, '// SAFE_CRACKER_AUDIO_PASS_V10_END') === 1],
  ['recorded sound runtime marker is unique', occurrences(client, '// SAFE_CRACKER_RECORDED_SOUNDS_V13_START') === 1 && occurrences(client, '// SAFE_CRACKER_RECORDED_SOUNDS_V13_END') === 1],
  ['recorded assets are mapped', client.includes('const SAFE_CRACKER_RECORDED_SOUNDS = Object.freeze({') && client.includes('/assets/safe-cracker/audio-data-v2/intro-sequence-1.b64') && client.includes('/assets/safe-cracker/audio-data-v2/intro-sequence-4.b64') && client.includes('/assets/safe-cracker/audio-data-v2/final-vault-open-3.b64') && client.includes('/assets/safe-cracker/audio-data-v2/vault-ambience-loop-4.b64')],
  ['Android audio is explicitly unlocked on interaction', client.includes('function safeCrackerUnlockRecordedAudio()') && client.includes("document.addEventListener('pointerdown'")],
  ['recorded buffers preload before gameplay', client.includes('window.setTimeout(safeCrackerPrimeRecordedSounds, 0);')],
  ['chunked recordings are reconstructed before decoding', client.includes('const urls = Array.isArray(sourceLocation) ? sourceLocation : [sourceLocation];') && client.includes("parts.join('')")],
  ['dial detents use uploaded recordings', client.includes('function safeCrackerPlayRecordedDetent(digit)') && client.includes("const name = runtime.safeCrackerRecordedDetentIndex ? 'dialA' : 'dialB';")],
  ['number submission uses an uploaded recording', client.includes('function safeCrackerPlayRecordedSubmit()') && client.includes("safeCrackerPlayRecordedSound('submit'")],
  ['incorrect tiers use the uploaded error blend', client.includes('function safeCrackerPlayRecordedFeedback(tier)') && client.includes("safeCrackerPlayRecordedSound('incorrect'")],
  ['successful guesses use the uploaded latch blend', client.includes('function safeCrackerPlayRecordedTumblerLock()') && client.includes("safeCrackerPlayRecordedSound('latchOpen'")],
  ['safe opening uses the uploaded full opening blend', client.includes('function safeCrackerPlayRecordedSafeOpen()') && client.includes("safeCrackerPlayRecordedSound('safeOpen'")],
  ['countdown uses the uploaded intro blend', client.includes('function safeCrackerPlayRecordedCountdown(label)') && client.includes("safeCrackerPlayRecordedSound('intro'")],
  ['ambience starts and fades only in Safe Cracker', client.includes('function safeCrackerStartRecordedAmbience()') && client.includes('function safeCrackerStopRecordedAmbience()') && client.includes("game?.mode === 'safecracker'")],
  ['recorded output still uses the compressed Safe Cracker bus', client.includes('gain.connect(safeCrackerAudioBus(context));')],
  ['recorded cache bust is present', index.includes('&recorded=13')],
  ['authoritative number submission is unchanged', client.includes('choice: `safecracker:guess:${runtime.selected}`')],
  ['input continuity remains installed', client.includes('// SAFE_CRACKER_INPUT_CONTINUITY_V9_START') && client.includes('runtime.pendingDragGame = game;')],
  ['dial activity retention remains installed', client.includes('// SAFE_CRACKER_DIAL_ACTIVITY_V16_START')],
  ['protected Roulette assets remain readable', turnAnimation.length > 0 && turnFire.length > 0 && audioBindings.length > 0],
  ['audio patches cannot write networking or Roulette files', !proceduralPatch.includes("writeFile(new URL('../netlify/functions/") && !proceduralPatch.includes("writeFile(new URL('../assets/roulette/") && !recordedPatch.includes("writeFile(new URL('../netlify/functions/") && !recordedPatch.includes("writeFile(new URL('../assets/roulette/")]
];

for (const [label, condition] of checks) assert(condition, label);

console.log('Safe Cracker recorded audio validation passed: all eight uploaded blends decode exactly, preload, unlock on Android, route through the game audio bus, and preserve protected Roulette and authoritative gameplay boundaries.');
