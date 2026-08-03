import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const sampleSpec = Object.freeze([
  ['bank-vault-dial-click-1.b64', 'b78cbaad689722538fa593f9e24662cb6829cfc052fe8a0708951b4c66f88cd4'],
  ['bank-vault-dial-click-2.b64', 'f26c50de07c8a34ab485121e5660d5eef7b56808d1d774a280f5f75ac48a7554'],
  ['bank-vault-dial-click-3.b64', '82ecfced65b0973a8de90df571be4d39670282ca3d9b93760fb666231b135088'],
  ['bank-vault-dial-click-4.b64', 'a4d3a1fd9c7981bf9f3777e215ec8eafbb15e5256ef48277150a6cff7652bb36'],
  ['bank-vault-dial-click-5.b64', '173cc8cd77dbba1fa2dca6e4ca6223a77562de3aa895a6c4aae3ce81e3d1ecdb'],
  ['bank-vault-dial-click-6.b64', '53a5dbec1789cd8c94ee6e45f23d0b987936064bb1e23d05756e8bb7a3dd9856']
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
  assert(bytes.length === 2187, `${file} decoded size is ${bytes.length}, expected 2187`);
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
