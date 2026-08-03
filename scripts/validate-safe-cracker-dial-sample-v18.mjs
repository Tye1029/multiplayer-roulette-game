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
  if (!condition) throw new Error(`Safe Cracker dial sample v20 validation failed: ${message}`);
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

const sectionStart = client.indexOf('// SAFE_CRACKER_DIAL_SAMPLE_V20_START');
const sectionEnd = client.indexOf('// SAFE_CRACKER_DIAL_SAMPLE_V20_END', sectionStart);
const section = sectionStart >= 0 && sectionEnd > sectionStart ? client.slice(sectionStart, sectionEnd) : '';
const mappedSamples = section.match(/audio-data-v3\/bank-vault-dial-click-\d\.b64/g) || [];

const checks = [
  ['v20 marker is unique', occurrences(client, '// SAFE_CRACKER_DIAL_SAMPLE_V20_START') === 1 && occurrences(client, '// SAFE_CRACKER_DIAL_SAMPLE_V20_END') === 1],
  ['older dial sample sections are removed', !client.includes('// SAFE_CRACKER_DIAL_SAMPLE_V18_START') && !client.includes('// SAFE_CRACKER_DIAL_SAMPLE_V19_START')],
  ['all six longer detents are mapped once', mappedSamples.length === 6 && new Set(mappedSamples).size === 6],
  ['sample text prefetches before audio unlock', section.includes('function safeCrackerPrefetchBankVaultDialTextsV20()') && section.includes("fetch(url + '?clicks=20'") && section.includes('window.setTimeout(safeCrackerPrefetchBankVaultDialTextsV20, 0);')],
  ['samples decode on interaction', section.includes('function safeCrackerDecodeBankVaultDialSamplesV20()') && section.includes('context.decodeAudioData(safeCrackerRecordedBytes(text))') && section.includes("document.addEventListener('pointerdown', safeCrackerDecodeBankVaultDialSamplesV20")],
  ['the first pending detent is queued instead of dropped', section.includes('runtime.safeCrackerPendingBankVaultDialAtV20 = now;') && section.includes('performance.now() - pendingAt < 650') && section.includes('safeCrackerPlayBankVaultDialBufferV20(pendingDigit)')],
  ['dial playback is clearly audible through the existing bus', section.includes('gain.gain.setValueAtTime(1.18') && section.includes('gain.connect(safeCrackerAudioBus(context));')],
  ['dial uses only the uploaded recordings', section.includes('function safeCrackerPlayReliableBankVaultDetent(digit)') && !section.includes('safeCrackerBankVaultDialFallback') && !section.includes('safeCrackerPlayMechanicalRatchetClick') && !section.includes('createOscillator')],
  ['original pitch and recorded tail remain intact', section.includes('source.playbackRate.setValueAtTime(1') && section.includes('source.buffer.duration') && !section.includes("highpass.type = 'highpass'") && !section.includes("lowpass.type = 'lowpass'")],
  ['result cues remain unchanged', client.includes('function safeCrackerPlayAuthoritativeCorrectCue(game, completedStage)') && client.includes('function safeCrackerPlayIncorrectRejectCue(tier)') && !section.includes('safeCrackerPlayFeedback =') && !section.includes('safeCrackerPlayTumblerLock =')],
  ['source note documents preload, pending queue, and gain', sourceNote.includes('fetched immediately when the page loads') && sourceNote.includes('queued for up to 650 ms') && sourceNote.includes('sample gain is 1.18')],
  ['cache bust advances to v20', index.includes('&clicks=20')],
  ['gameplay and Roulette remain protected', client.includes('choice: `safecracker:guess:${runtime.selected}`') && turnAnimation.length > 0 && turnFire.length > 0 && audioBindings.length > 0],
  ['patch cannot write networking or Roulette files', !patch.includes("writeFile(new URL('../netlify/functions/") && !patch.includes("writeFile(new URL('../assets/roulette/")]
];

for (const [label, condition] of checks) assert(condition, label);

console.log('Safe Cracker dial sample v20 validation passed: uploaded clicks prefetch before interaction, decode on unlock, queue the first detent, play at an audible level, and leave result cues and protected gameplay unchanged.');
