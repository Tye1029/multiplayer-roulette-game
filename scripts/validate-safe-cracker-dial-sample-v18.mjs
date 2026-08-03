import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const sampleFiles = Object.freeze([
  'bank-vault-dial-click-1.b64',
  'bank-vault-dial-click-2.b64',
  'bank-vault-dial-click-3.b64',
  'bank-vault-dial-click-4.b64',
  'bank-vault-dial-click-5.b64',
  'bank-vault-dial-click-6.b64'
]);

const [client, index, patch, sourceNote, turnAnimation, turnFire, audioBindings] = await Promise.all([
  readFile(new URL('assets/safe-cracker/safe-cracker.js', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('scripts/patch-safe-cracker-dial-sample-v18.mjs', root), 'utf8'),
  readFile(new URL('assets/safe-cracker/audio-data-v3/SOURCE.md', root), 'utf8'),
  readFile(new URL('assets/roulette/turn-animation.js', root)),
  readFile(new URL('assets/roulette/turn-fire.js', root)),
  readFile(new URL('assets/roulette/audio-bindings.js', root))
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Safe Cracker dial sample v19 validation failed: ${message}`);
}

function occurrences(source, value) {
  return source.split(value).length - 1;
}

const sampleHashes = new Set();
for (const file of sampleFiles) {
  const text = await readFile(new URL(`assets/safe-cracker/audio-data-v3/${file}`, root), 'utf8');
  const bytes = Buffer.from(text.replace(/\s+/g, ''), 'base64');
  const hash = createHash('sha256').update(bytes).digest('hex');
  let frameSyncs = 0;
  for (let index = 0; index + 1 < bytes.length; index += 1) {
    if (bytes[index] === 0xff && (bytes[index + 1] & 0xe0) === 0xe0) frameSyncs += 1;
  }
  assert(bytes.length >= 2800 && bytes.length <= 3100, `${file} decoded size ${bytes.length} is outside the longer-sample range`);
  assert(bytes.subarray(0, 3).toString('ascii') === 'ID3' || bytes[0] === 0xff, `${file} is not an MP3 payload`);
  assert(frameSyncs >= 10, `${file} contains only ${frameSyncs} MPEG frame markers`);
  sampleHashes.add(hash);
}
assert(sampleHashes.size === sampleFiles.length, 'the six dial samples are not all distinct');

const sectionStart = client.indexOf('// SAFE_CRACKER_DIAL_SAMPLE_V19_START');
const sectionEnd = client.indexOf('// SAFE_CRACKER_DIAL_SAMPLE_V19_END', sectionStart);
const section = sectionStart >= 0 && sectionEnd > sectionStart ? client.slice(sectionStart, sectionEnd) : '';
const mappedSamples = section.match(/audio-data-v3\/bank-vault-dial-click-\d\.b64/g) || [];

const checks = [
  ['v19 marker is unique', occurrences(client, '// SAFE_CRACKER_DIAL_SAMPLE_V19_START') === 1 && occurrences(client, '// SAFE_CRACKER_DIAL_SAMPLE_V19_END') === 1],
  ['old v18 section is removed', !client.includes('// SAFE_CRACKER_DIAL_SAMPLE_V18_START') && !client.includes('// SAFE_CRACKER_DIAL_SAMPLE_V18_END')],
  ['all six longer detents are mapped once', mappedSamples.length === 6 && new Set(mappedSamples).size === 6],
  ['samples preload and decode', section.includes('function safeCrackerLoadBankVaultDialSamplesV19()') && section.includes('context.decodeAudioData(safeCrackerRecordedBytes(text))') && section.includes('window.setTimeout(safeCrackerLoadBankVaultDialSamplesV19, 0);')],
  ['dial uses only the recorded samples', section.includes('function safeCrackerPlayBankVaultDialSampleV19(digit)') && section.includes('source.buffer = buffers[index];') && section.includes('source.start(context.currentTime);') && !section.includes('createOscillator') && !section.includes('safeCrackerPlayRatchetImpulse(')],
  ['original pitch and full tail are preserved', section.includes('source.playbackRate.setValueAtTime(1') && section.includes('source.buffer.duration') && !section.includes("highpass.type = 'highpass'") && !section.includes("lowpass.type = 'lowpass'")],
  ['old generated fallback is not called', section.includes('function safeCrackerPlayUnfilteredBankVaultDetent(digit)') && !section.includes('safeCrackerBankVaultDialFallback') && !section.includes('safeCrackerPlayMechanicalRatchetClick')],
  ['result cues remain unchanged', client.includes('function safeCrackerPlayAuthoritativeCorrectCue(game, completedStage)') && client.includes('function safeCrackerPlayIncorrectRejectCue(tier)') && !section.includes('safeCrackerPlayFeedback =') && !section.includes('safeCrackerPlayTumblerLock =')],
  ['source note records the actual processing', sourceNote.includes('six longer 190 ms windows') && sourceNote.includes('no brightening filter') && sourceNote.includes('freesound_community-bank-vault-100469.mp3')],
  ['cache bust advances to v19', index.includes('&clicks=19')],
  ['gameplay and Roulette remain protected', client.includes('choice: `safecracker:guess:${runtime.selected}`') && turnAnimation.length > 0 && turnFire.length > 0 && audioBindings.length > 0],
  ['patch cannot write networking or Roulette files', !patch.includes("writeFile(new URL('../netlify/functions/") && !patch.includes("writeFile(new URL('../assets/roulette/")]
];

for (const [label, condition] of checks) assert(condition, label);

console.log('Safe Cracker dial sample v19 validation passed: longer minimally processed clips from the uploaded vault recording play at original pitch without the generated fallback, while result cues and protected gameplay remain unchanged.');
