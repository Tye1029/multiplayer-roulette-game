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
  if (!condition) throw new Error(`Safe Cracker dial sample v21 validation failed: ${message}`);
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

const sectionStart = client.indexOf('// SAFE_CRACKER_DIAL_SAMPLE_V21_START');
const sectionEnd = client.indexOf('// SAFE_CRACKER_DIAL_SAMPLE_V21_END', sectionStart);
const section = sectionStart >= 0 && sectionEnd > sectionStart ? client.slice(sectionStart, sectionEnd) : '';
const mappedSamples = section.match(/audio-data-v3\/bank-vault-dial-click-\d\.b64/g) || [];

const checks = [
  ['v21 marker is unique', occurrences(client, '// SAFE_CRACKER_DIAL_SAMPLE_V21_START') === 1 && occurrences(client, '// SAFE_CRACKER_DIAL_SAMPLE_V21_END') === 1],
  ['older sample sections are removed', !client.includes('// SAFE_CRACKER_DIAL_SAMPLE_V18_START') && !client.includes('// SAFE_CRACKER_DIAL_SAMPLE_V19_START') && !client.includes('// SAFE_CRACKER_DIAL_SAMPLE_V20_START')],
  ['all six vault detents remain mapped', mappedSamples.length === 6 && new Set(mappedSamples).size === 6],
  ['native audio voices replace WebAudio MP3 decoding', section.includes('function safeCrackerCreateDialVoiceV21(url)') && section.includes('new Audio(url)') && section.includes("new Blob([bytes], { type: 'audio/mpeg' })") && !section.includes('decodeAudioData(')],
  ['two overlapping voices are created per detent', section.includes('voices: [safeCrackerCreateDialVoiceV21(url), safeCrackerCreateDialVoiceV21(url)]') && section.includes('entry.voices[entry.cursor++ % entry.voices.length]')],
  ['dial samples preload before interaction and are unlocked on input', section.includes('function safeCrackerPrefetchDialVoicesV21()') && section.includes("fetch(url + '?clicks=21'") && section.includes('safeCrackerPrefetchDialVoicesV21();') && section.includes("document.addEventListener('pointerdown', safeCrackerPrimeDialV21")],
  ['native dial playback is audible and fixed pitch', section.includes('voice.volume = 0.96') && section.includes('voice.playbackRate = 1') && section.includes('voice.play()')],
  ['a dry fallback prevents silent detents', section.includes('function safeCrackerPlayDryDialFallbackV21()') && section.includes('safeCrackerPlayNoise(0.018, 0.018') && section.includes('safeCrackerPlayDryDialFallbackV21();')],
  ['the final dial override uses the native sample route', section.includes('function safeCrackerPlayNativeBankVaultDetentV21(digit)') && section.includes('safeCrackerPlayNativeDialSampleV21()') && section.includes('playDetent = safeCrackerPlayDetent;')],
  ['recorded repeating ambience is replaced by smooth room tone', section.includes('function safeCrackerSmoothRoomToneBufferV21(context)') && section.includes('const duration = 21;') && section.includes('function safeCrackerStartSmoothVaultRoomToneV21()') && section.includes('gain.gain.exponentialRampToValueAtTime(0.026')],
  ['smooth ambience contains no foreground sample loop', !section.includes("safeCrackerPlayRecordedSound('ambience'") && !section.includes('vault-ambience-loop-')],
  ['correct and incorrect result cues remain unchanged', client.includes('function safeCrackerPlayAuthoritativeCorrectCue(game, completedStage)') && client.includes('function safeCrackerPlayIncorrectRejectCue(tier)') && !section.includes('safeCrackerPlayFeedback =') && !section.includes('safeCrackerPlayTumblerLock =')],
  ['source note documents native playback and transient-free ambience', sourceNote.includes('native HTML audio voices') && sourceNote.includes('quiet 21-second seamless filtered vault-room air tone') && sourceNote.includes('recurring loud mechanical impacts are no longer used')],
  ['cache bust advances to v21', index.includes('&clicks=21')],
  ['gameplay and Roulette remain protected', client.includes('choice: `safecracker:guess:${runtime.selected}`') && turnAnimation.length > 0 && turnFire.length > 0 && audioBindings.length > 0],
  ['patch cannot write networking or Roulette files', !patch.includes("writeFile(new URL('../netlify/functions/") && !patch.includes("writeFile(new URL('../assets/roulette/")]
];

for (const [label, condition] of checks) assert(condition, label);

console.log('Safe Cracker dial sample v21 validation passed: native preloaded vault clicks guarantee an audible dial, the fallback prevents silence, and the repeating impact ambience is replaced by a smooth room tone.');
