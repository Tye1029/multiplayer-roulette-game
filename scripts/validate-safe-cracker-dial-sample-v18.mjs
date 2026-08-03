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
  if (!condition) throw new Error(`Safe Cracker dial sample v18 validation failed: ${message}`);
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
  assert(bytes.length >= 2100 && bytes.length <= 2300, `${file} decoded size ${bytes.length} is outside the safe compact-sample range`);
  assert(bytes.subarray(0, 3).toString('ascii') === 'ID3' || bytes[0] === 0xff, `${file} is not an MP3 payload`);
  assert(frameSyncs >= 8, `${file} contains only ${frameSyncs} MPEG frame markers`);
  sampleHashes.add(hash);
}
assert(sampleHashes.size === sampleFiles.length, 'the six dial samples are not all distinct');

const sectionStart = client.indexOf('// SAFE_CRACKER_DIAL_SAMPLE_V18_START');
const sectionEnd = client.indexOf('// SAFE_CRACKER_DIAL_SAMPLE_V18_END', sectionStart);
const section = sectionStart >= 0 && sectionEnd > sectionStart ? client.slice(sectionStart, sectionEnd) : '';
const mappedSamples = (section.match(/audio-data-v3\/bank-vault-dial-click-\d\.b64/g) || []);

const checks = [
  ['v18 marker is unique', occurrences(client, '// SAFE_CRACKER_DIAL_SAMPLE_V18_START') === 1 && occurrences(client, '// SAFE_CRACKER_DIAL_SAMPLE_V18_END') === 1],
  ['v17 dial and v13 recorded systems remain installed', occurrences(client, '// SAFE_CRACKER_DIAL_CLICK_V17_START') === 1 && occurrences(client, '// SAFE_CRACKER_RECORDED_SOUNDS_V13_START') === 1],
  ['all six extracted bank-vault detents are mapped once', mappedSamples.length === 6 && new Set(mappedSamples).size === 6],
  ['samples preload and decode through WebAudio', section.includes('function safeCrackerLoadBankVaultDialSamples()') && section.includes('context.decodeAudioData(safeCrackerRecordedBytes(text))') && section.includes('window.setTimeout(safeCrackerLoadBankVaultDialSamples, 0);')],
  ['dial playback uses only the real sample bank', section.includes('function safeCrackerPlayBankVaultDialSample(digit)') && section.includes('source.buffer = buffers[index];') && section.includes('source.start(context.currentTime);') && !section.includes('createOscillator') && !section.includes('safeCrackerPlayRatchetImpulse(')],
  ['dial uses six rotating samples with subtle rate variation', section.includes('const index = (previous + 1 + (step % 2)) % buffers.length;') && section.includes('const rate = 0.985 + (step % 5) * 0.007;')],
  ['sample playback is short, bright, and routed through the Safe Cracker bus', section.includes("highpass.type = 'highpass';") && section.includes('highpass.frequency.setValueAtTime(135') && section.includes('lowpass.frequency.setValueAtTime(10800') && section.includes('gain.connect(safeCrackerAudioBus(context));')],
  ['final dial override points at the bank-vault recording', section.includes('function safeCrackerPlayRecordedBankVaultDetent(digit)') && section.includes('const played = safeCrackerPlayBankVaultDialSample(digit);') && section.includes('playDetent = safeCrackerPlayDetent;')],
  ['correct and incorrect result cues remain unchanged and available', client.includes('function safeCrackerPlayAuthoritativeCorrectCue(game, completedStage)') && client.includes('function safeCrackerPlayIncorrectRejectCue(tier)') && !section.includes('safeCrackerPlayFeedback =') && !section.includes('safeCrackerPlayTumblerLock =')],
  ['source processing note identifies the uploaded recording', sourceNote.includes('freesound_community-bank-vault-100469.mp3') && sourceNote.includes('six 90 ms detent clips')],
  ['cache bust advances to v18', index.includes('&clicks=18')],
  ['dial retention and authoritative gameplay remain installed', client.includes('// SAFE_CRACKER_DIAL_ACTIVITY_V16_START') && client.includes('choice: `safecracker:guess:${runtime.selected}`')],
  ['patch cannot write networking or Roulette files', !patch.includes("writeFile(new URL('../netlify/functions/") && !patch.includes("writeFile(new URL('../assets/roulette/")],
  ['protected Roulette assets remain readable', turnAnimation.length > 0 && turnFire.length > 0 && audioBindings.length > 0]
];

for (const [label, condition] of checks) assert(condition, label);

console.log('Safe Cracker dial sample v18 validation passed: six distinct framed MP3 detents extracted from the uploaded bank-vault recording drive the dial, result cues remain unchanged, and protected gameplay boundaries are intact.');
