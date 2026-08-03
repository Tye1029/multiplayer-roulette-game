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

const [client, index, sourceNote, v22Patch, turnAnimation, turnFire, audioBindings] = await Promise.all([
  readFile(new URL('assets/safe-cracker/safe-cracker.js', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('assets/safe-cracker/audio-data-v3/SOURCE.md', root), 'utf8'),
  readFile(new URL('scripts/patch-safe-cracker-dial-sample-v22.mjs', root), 'utf8'),
  readFile(new URL('assets/roulette/turn-animation.js', root)),
  readFile(new URL('assets/roulette/turn-fire.js', root)),
  readFile(new URL('assets/roulette/audio-bindings.js', root))
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Safe Cracker metallic click v22 validation failed: ${message}`);
}

function occurrences(source, value) {
  return source.split(value).length - 1;
}

const hashes = new Set();
for (const file of sampleFiles) {
  const text = await readFile(new URL(`assets/safe-cracker/audio-data-v3/${file}`, root), 'utf8');
  const bytes = Buffer.from(text.replace(/\s+/g, ''), 'base64');
  let frameSyncs = 0;
  for (let index = 0; index + 1 < bytes.length; index += 1) {
    if (bytes[index] === 0xff && (bytes[index + 1] & 0xe0) === 0xe0) frameSyncs += 1;
  }
  assert(bytes.length >= 3000 && bytes.length <= 3500, `${file} decoded size ${bytes.length} is outside the metallic-click range`);
  assert(bytes.subarray(0, 3).toString('ascii') === 'ID3' || bytes[0] === 0xff, `${file} is not an MP3 payload`);
  assert(frameSyncs >= 10, `${file} does not contain enough MPEG frames`);
  hashes.add(createHash('sha256').update(bytes).digest('hex'));
}
assert(hashes.size === sampleFiles.length, 'the six metallic click samples are not distinct');

const sectionStart = client.indexOf('// SAFE_CRACKER_DIAL_SAMPLE_V22_START');
const sectionEnd = client.indexOf('// SAFE_CRACKER_DIAL_SAMPLE_V22_END', sectionStart);
const section = sectionStart >= 0 && sectionEnd > sectionStart ? client.slice(sectionStart, sectionEnd) : '';
const mappedSamples = section.match(/audio-data-v3\/bank-vault-dial-click-\d\.b64/g) || [];

const checks = [
  ['v22 section is unique', occurrences(client, '// SAFE_CRACKER_DIAL_SAMPLE_V22_START') === 1 && occurrences(client, '// SAFE_CRACKER_DIAL_SAMPLE_V22_END') === 1],
  ['v21 section was replaced', !client.includes('// SAFE_CRACKER_DIAL_SAMPLE_V21_START')],
  ['all six metallic clicks remain mapped', mappedSamples.length === 6 && new Set(mappedSamples).size === 6],
  ['native overlapping audio voices remain active', section.includes('function safeCrackerCreateDialVoiceV22(url)') && section.includes('new Audio(url)') && section.includes('voices: [safeCrackerCreateDialVoiceV22(url), safeCrackerCreateDialVoiceV22(url)]')],
  ['new click assets use a fresh cache key', section.includes("fetch(url + '?clicks=22'") && index.includes('&clicks=22')],
  ['dial uses the native sample route with audible volume', section.includes('function safeCrackerPlayNativeMetallicClickDetentV22(digit)') && section.includes('voice.volume = 0.96') && section.includes('voice.playbackRate = 1') && section.includes('playDetent = safeCrackerPlayDetent;')],
  ['fallback still prevents silent dial steps', section.includes('function safeCrackerPlayDryDialFallbackV22()') && section.includes('safeCrackerPlayDryDialFallbackV22();')],
  ['smooth background ambience remains unchanged', section.includes('function safeCrackerSmoothRoomToneBufferV22(context)') && section.includes('const duration = 21;') && section.includes('function safeCrackerStartSmoothVaultRoomToneV22()') && section.includes('gain.gain.exponentialRampToValueAtTime(0.026')],
  ['correct and incorrect cues remain separate', client.includes('function safeCrackerPlayAuthoritativeCorrectCue(game, completedStage)') && client.includes('function safeCrackerPlayIncorrectRejectCue(tier)') && !section.includes('safeCrackerPlayFeedback =') && !section.includes('safeCrackerPlayTumblerLock =')],
  ['source note identifies the new uploaded file', sourceNote.includes('Metallic Clicks Sound Effect  SFX.mp3') && sourceNote.includes('six isolated 190 ms metallic clicks') && sourceNote.includes('background ambience remains the V21 smooth room tone')],
  ['v22 patch does not touch gameplay or Roulette files', !v22Patch.includes("writeFile(new URL('../netlify/functions/") && !v22Patch.includes("writeFile(new URL('../assets/roulette/") && client.includes('choice: `safecracker:guess:${runtime.selected}`') && turnAnimation.length > 0 && turnFire.length > 0 && audioBindings.length > 0]
];

for (const [label, condition] of checks) assert(condition, label);

console.log('Safe Cracker metallic click v22 validation passed: six isolated clicks from the new upload drive the native dial audio, while result cues, smooth ambience, gameplay, and Roulette remain unchanged.');
