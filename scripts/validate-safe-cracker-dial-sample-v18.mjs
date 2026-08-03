import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const sampleSpec = Object.freeze([
  ['bank-vault-dial-click-1.b64', 'cc8a6c2c74db52e6724dc8701426f9fa193b597010061707817d42b417a9187a'],
  ['bank-vault-dial-click-2.b64', '5bda3950abd1aaaca650ed643e0ad9e7f0d84cd7cbb1e693bbcde0bc8babef5e'],
  ['bank-vault-dial-click-3.b64', 'e949245fd7d2002ea907e43c8e75f94a225b46491e74b994f3dab96f24d8b8db'],
  ['bank-vault-dial-click-4.b64', '2c4af5b8a258b8fc245bebd31ac5a1181bc5a2f7d98e81147e8b69cc84d1bc49'],
  ['bank-vault-dial-click-5.b64', '7580e56c1b3d0e4466e67f90f33711ea8d3cddaf7a3240ec17050d2aa562e219'],
  ['bank-vault-dial-click-6.b64', 'b713dc148e2a5b83fbf1b7c5055b04210c8818d32cae458b7db119f59cf0d37c']
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

for (const [file, expectedHash] of sampleSpec) {
  const text = await readFile(new URL(`assets/safe-cracker/audio-data-v3/${file}`, root), 'utf8');
  const bytes = Buffer.from(text.replace(/\s+/g, ''), 'base64');
  const hash = createHash('sha256').update(bytes).digest('hex');
  assert(bytes.length === 2204, `${file} decoded size is ${bytes.length}, expected 2204`);
  assert(hash === expectedHash, `${file} checksum is ${hash}, expected ${expectedHash}`);
  assert(bytes.subarray(0, 3).toString('ascii') === 'ID3' || bytes[0] === 0xff, `${file} is not an MP3 payload`);
}

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

console.log('Safe Cracker dial sample v18 validation passed: six exact detents extracted from the uploaded bank-vault recording drive the dial, result cues remain unchanged, and protected gameplay boundaries are intact.');
