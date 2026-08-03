import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const chunkPaths = Object.freeze(Array.from({ length: 7 }, (_, index) =>
  `assets/safe-cracker/audio-data-v4/metallic-click-v27-part-${index + 1}.b64`
));
const expectedChunkLengths = Object.freeze([6256, 6256, 6256, 6256, 6256, 6172, 96]);
const expectedBase64Length = 37548;
const expectedByteLength = 28160;
const expectedHash = 'f083e8341eaab8dd5c345128a2f084b9e93f7bdc7c48a2ab5b7fb978b38977cc';

const [client, index, sourceNote, patch, turnAnimation, turnFire, audioBindings, chunkTexts] = await Promise.all([
  readFile(new URL('assets/safe-cracker/safe-cracker.js', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('assets/safe-cracker/audio-data-v3/SOURCE.md', root), 'utf8'),
  readFile(new URL('scripts/patch-safe-cracker-dial-sample-v22.mjs', root), 'utf8'),
  readFile(new URL('assets/roulette/turn-animation.js', root)),
  readFile(new URL('assets/roulette/turn-fire.js', root)),
  readFile(new URL('assets/roulette/audio-bindings.js', root)),
  Promise.all(chunkPaths.map(path => readFile(new URL(path, root), 'utf8')))
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Safe Cracker original PCM dial v27 validation failed: ${message}`);
}

function occurrences(source, value) {
  return source.split(value).length - 1;
}

const cleanChunks = chunkTexts.map(text => text.replace(/\s+/g, ''));
const chunkLengths = cleanChunks.map(chunk => chunk.length);
assert(cleanChunks.length === 7, 'exactly seven transport chunks are required');
assert(JSON.stringify(chunkLengths) === JSON.stringify(expectedChunkLengths), `chunk lengths ${JSON.stringify(chunkLengths)} do not match ${JSON.stringify(expectedChunkLengths)}`);
for (const [indexValue, chunk] of cleanChunks.entries()) {
  assert(/^[A-Za-z0-9+/=]+$/.test(chunk), `chunk ${indexValue + 1} is not valid base64 text`);
}
const originalBase64 = cleanChunks.join('');
const originalBytes = Buffer.from(originalBase64, 'base64');
const originalHash = createHash('sha256').update(originalBytes).digest('hex');
assert(originalBase64.length === expectedBase64Length, `combined base64 length ${originalBase64.length} does not match ${expectedBase64Length}`);
assert(originalBytes.length === expectedByteLength, `combined source PCM length ${originalBytes.length} does not match ${expectedByteLength}`);
assert(originalHash === expectedHash, `combined source PCM checksum ${originalHash} does not match ${expectedHash}`);
assert(originalBytes.length % 2 === 0, 'signed 16-bit source PCM byte count is not even');

const sectionStart = client.indexOf('// SAFE_CRACKER_ORIGINAL_PCM_V27_START');
const sectionEnd = client.indexOf('// SAFE_CRACKER_ORIGINAL_PCM_V27_END', sectionStart);
const section = sectionStart >= 0 && sectionEnd > sectionStart ? client.slice(sectionStart, sectionEnd) : '';
const embeddedMatch = section.match(/const SAFE_CRACKER_ORIGINAL_CLICK_PCM_V27 = "([A-Za-z0-9+/=]+)";/);
const dialStart = section.indexOf('function safeCrackerBuildOriginalClickPcmV27');
const dialEnd = section.indexOf('function safeCrackerSmoothRoomToneBufferV27', dialStart);
const dialSection = dialStart >= 0 && dialEnd > dialStart ? section.slice(dialStart, dialEnd) : '';

const checks = [
  ['v27 section is unique', occurrences(client, '// SAFE_CRACKER_ORIGINAL_PCM_V27_START') === 1 && occurrences(client, '// SAFE_CRACKER_ORIGINAL_PCM_V27_END') === 1],
  ['all older dial sections were removed', !client.includes('// SAFE_CRACKER_DIAL_SAMPLE_V18_START') && !client.includes('// SAFE_CRACKER_DIAL_SAMPLE_V19_START') && !client.includes('// SAFE_CRACKER_DIAL_SAMPLE_V20_START') && !client.includes('// SAFE_CRACKER_DIAL_SAMPLE_V21_START') && !client.includes('// SAFE_CRACKER_DIAL_SAMPLE_V22_START') && !client.includes('// SAFE_CRACKER_DIAL_SAMPLE_V23_START') && !client.includes('// SAFE_CRACKER_DIAL_PCM_V24_START') && !client.includes('// SAFE_CRACKER_UPLOADED_PCM_V25_START') && !client.includes('// SAFE_CRACKER_CLEAN_PCM_V26_START')],
  ['the exact original-source waveform is embedded', Boolean(embeddedMatch) && embeddedMatch[1] === originalBase64],
  ['32 kHz source rate is explicit', section.includes('const SAFE_CRACKER_ORIGINAL_CLICK_RATE_V27 = 32000;') && section.includes('context.createBuffer(1, frameCount, SAFE_CRACKER_ORIGINAL_CLICK_RATE_V27)')],
  ['signed little-endian 16-bit PCM is decoded directly', section.includes('const frameCount = Math.floor(binary.length / 2);') && section.includes('const low = binary.charCodeAt(byteIndex);') && section.includes('const high = binary.charCodeAt(byteIndex + 1);') && section.includes('let signed = low | (high << 8);') && section.includes('if (signed & 0x8000) signed -= 0x10000;') && section.includes('data[frame] = signed / 32768;')],
  ['no v26 smoothing or interpolation remains', !dialSection.includes('gentleAverage') && !dialSection.includes('upsample') && !dialSection.includes('const p0 =') && !dialSection.includes('const p3 =') && !dialSection.includes('const a = -0.5 * p0')],
  ['no compressor, EQ, media element, decoder, or synthetic layer is used for the dial', !dialSection.includes('createDynamicsCompressor') && !dialSection.includes('createBiquadFilter()') && !dialSection.includes('decodeAudioData') && !dialSection.includes('new Audio(') && !dialSection.includes('createOscillator') && !dialSection.includes('Math.random()')],
  ['dial uses the proven direct WebAudio destination', dialSection.includes('function safeCrackerFireOriginalClickPcmV27()') && dialSection.includes("context.state === 'running'") && dialSection.includes('context.resume().then(fire)') && dialSection.includes('gain.connect(context.destination);')],
  ['original pitch and conservative source gain are retained', dialSection.includes('source.playbackRate.setValueAtTime(1') && dialSection.includes('gain.gain.setValueAtTime(1.12')],
  ['pointer gesture explicitly unlocks the source PCM route', section.includes("document.addEventListener('pointerdown', safeCrackerUnlockOriginalClickPcmV27") && section.includes("document.addEventListener('touchstart', safeCrackerUnlockOriginalClickPcmV27")],
  ['dial alias is replaced', dialSection.includes('function safeCrackerPlayOriginalPcmDetentV27(digit)') && dialSection.includes('playDetent = safeCrackerPlayDetent;')],
  ['smooth ambience remains unchanged', section.includes('function safeCrackerSmoothRoomToneBufferV27(context)') && section.includes('const duration = 21;') && section.includes('gain.gain.exponentialRampToValueAtTime(0.026')],
  ['correct and incorrect cues remain separate', client.includes('function safeCrackerPlayAuthoritativeCorrectCue(game, completedStage)') && client.includes('function safeCrackerPlayIncorrectRejectCue(tier)') && !section.includes('safeCrackerPlayFeedback =') && !section.includes('safeCrackerPlayTumblerLock =')],
  ['source note documents the original-source rebuild honestly', sourceNote.includes('matched back to approximately 4.57 seconds') && sourceNote.includes('32 kHz signed 16-bit PCM') && sourceNote.includes(expectedHash) && sourceNote.includes('no interpolation') && sourceNote.includes('seven text chunks')],
  ['cache bust advances to v27', index.includes('&clicks=27')],
  ['gameplay and Roulette remain protected', client.includes('choice: `safecracker:guess:${runtime.selected}`') && turnAnimation.length > 0 && turnFire.length > 0 && audioBindings.length > 0],
  ['patch cannot write networking or Roulette files', !patch.includes("writeFile(new URL('../netlify/functions/") && !patch.includes("writeFile(new URL('../assets/roulette/")]
];

for (const [label, condition] of checks) assert(condition, label);

console.log(`Safe Cracker original PCM dial v27 validation passed: exact 32 kHz signed 16-bit source waveform ${originalHash} (${originalBytes.length} bytes, ${originalBytes.length / 2} frames) plays through direct WebAudio without the v26 low-resolution reconstruction; result cues, ambience, gameplay, and Roulette remain protected.`);
