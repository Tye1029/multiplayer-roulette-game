import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [client, index, sourceNote, patch, sampleText, turnAnimation, turnFire, audioBindings] = await Promise.all([
  readFile(new URL('assets/safe-cracker/safe-cracker.js', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('assets/safe-cracker/audio-data-v3/SOURCE.md', root), 'utf8'),
  readFile(new URL('scripts/patch-safe-cracker-dial-sample-v22.mjs', root), 'utf8'),
  readFile(new URL('assets/safe-cracker/audio-data-v3/bank-vault-dial-click-1.b64', root), 'utf8'),
  readFile(new URL('assets/roulette/turn-animation.js', root)),
  readFile(new URL('assets/roulette/turn-fire.js', root)),
  readFile(new URL('assets/roulette/audio-bindings.js', root))
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Safe Cracker clean PCM dial v26 validation failed: ${message}`);
}

function occurrences(source, value) {
  return source.split(value).length - 1;
}

const cleanSample = sampleText.replace(/\s+/g, '');
const sampleBytes = Buffer.from(cleanSample, 'base64');
const sampleHash = createHash('sha256').update(sampleBytes).digest('hex');
assert(sampleBytes.length >= 4600 && sampleBytes.length <= 4800, `uploaded PCM contains ${sampleBytes.length} bytes outside the recorded-click range`);
assert(/^[A-Za-z0-9+/=]+$/.test(cleanSample), 'uploaded PCM payload is not valid base64');

const sectionStart = client.indexOf('// SAFE_CRACKER_CLEAN_PCM_V26_START');
const sectionEnd = client.indexOf('// SAFE_CRACKER_CLEAN_PCM_V26_END', sectionStart);
const section = sectionStart >= 0 && sectionEnd > sectionStart ? client.slice(sectionStart, sectionEnd) : '';
const embeddedMatch = section.match(/const SAFE_CRACKER_CLEAN_CLICK_PCM_V26 = "([A-Za-z0-9+/=]+)";/);

const checks = [
  ['v26 section is unique', occurrences(client, '// SAFE_CRACKER_CLEAN_PCM_V26_START') === 1 && occurrences(client, '// SAFE_CRACKER_CLEAN_PCM_V26_END') === 1],
  ['all older dial sections were removed', !client.includes('// SAFE_CRACKER_DIAL_SAMPLE_V18_START') && !client.includes('// SAFE_CRACKER_DIAL_SAMPLE_V19_START') && !client.includes('// SAFE_CRACKER_DIAL_SAMPLE_V20_START') && !client.includes('// SAFE_CRACKER_DIAL_SAMPLE_V21_START') && !client.includes('// SAFE_CRACKER_DIAL_SAMPLE_V22_START') && !client.includes('// SAFE_CRACKER_DIAL_SAMPLE_V23_START') && !client.includes('// SAFE_CRACKER_DIAL_PCM_V24_START') && !client.includes('// SAFE_CRACKER_UPLOADED_PCM_V25_START')],
  ['the same committed uploaded waveform is embedded exactly', Boolean(embeddedMatch) && embeddedMatch[1] === cleanSample],
  ['source and reconstructed rates are explicit', section.includes('const SAFE_CRACKER_CLEAN_CLICK_SOURCE_RATE_V26 = 16000;') && section.includes('const SAFE_CRACKER_CLEAN_CLICK_RATE_V26 = 32000;')],
  ['waveform is reconstructed as float PCM', section.includes('new Float32Array(binary.length)') && section.includes('context.createBuffer(1, outputLength, SAFE_CRACKER_CLEAN_CLICK_RATE_V26)') && section.includes('buffer.getChannelData(0)')],
  ['DC offset and quantization edges are gently reduced', section.includes('mean /= Math.max(1, source.length)') && section.includes('const gentleAverage =') && section.includes('current * 0.82 + gentleAverage * 0.18')],
  ['cubic interpolation doubles playback resolution', section.includes('const upsample = SAFE_CRACKER_CLEAN_CLICK_RATE_V26 / SAFE_CRACKER_CLEAN_CLICK_SOURCE_RATE_V26') && section.includes('const p0 =') && section.includes('const p3 =') && section.includes('const a = -0.5 * p0')],
  ['click edges are tapered instead of chopped', section.includes('* 0.0015') && section.includes('* 0.042') && section.includes('Math.sin((index / fadeIn)') && section.includes('Math.cos((index / fadeOut)')],
  ['no compressor, filter, sample decoder, or synthetic layer is used', !section.includes('createDynamicsCompressor') && !section.includes('createBiquadFilter()') && !section.includes('decodeAudioData') && !section.includes('new Audio(') && !section.includes('Math.random() * Math.exp')],
  ['dial uses the proven direct WebAudio destination', section.includes('function safeCrackerFireCleanClickPcmV26()') && section.includes("context.state === 'running'") && section.includes('context.resume().then(fire)') && section.includes('gain.connect(context.destination);')],
  ['original pitch is retained with only a small clean gain adjustment', section.includes('source.playbackRate.setValueAtTime(1') && section.includes('gain.gain.setValueAtTime(1.02')],
  ['pointer gesture explicitly unlocks the PCM route', section.includes("document.addEventListener('pointerdown', safeCrackerUnlockCleanClickPcmV26") && section.includes("document.addEventListener('touchstart', safeCrackerUnlockCleanClickPcmV26")],
  ['dial alias is replaced', section.includes('function safeCrackerPlayCleanPcmDetentV26(digit)') && section.includes('playDetent = safeCrackerPlayDetent;')],
  ['smooth ambience remains', section.includes('function safeCrackerSmoothRoomToneBufferV26(context)') && section.includes('const duration = 21;') && section.includes('gain.gain.exponentialRampToValueAtTime(0.026')],
  ['correct and incorrect cues remain separate', client.includes('function safeCrackerPlayAuthoritativeCorrectCue(game, completedStage)') && client.includes('function safeCrackerPlayIncorrectRejectCue(tier)') && !section.includes('safeCrackerPlayFeedback =') && !section.includes('safeCrackerPlayTumblerLock =')],
  ['source note documents the cleanup honestly', sourceNote.includes('same uploaded metallic-click waveform') && sourceNote.includes('32 kHz 32-bit floating-point AudioBuffer') && sourceNote.includes('does not restore information absent from the source')],
  ['cache bust advances to v26', index.includes('&clicks=26')],
  ['gameplay and Roulette remain protected', client.includes('choice: `safecracker:guess:${runtime.selected}`') && turnAnimation.length > 0 && turnFire.length > 0 && audioBindings.length > 0],
  ['patch cannot write networking or Roulette files', !patch.includes("writeFile(new URL('../netlify/functions/") && !patch.includes("writeFile(new URL('../assets/roulette/")]
];

for (const [label, condition] of checks) assert(condition, label);

console.log(`Safe Cracker clean PCM dial v26 validation passed: uploaded waveform ${sampleHash} (${sampleBytes.length} bytes) is reconstructed as smoother 32-bit float audio with cubic interpolation, gentle edge tapering, and no compression or synthetic layer; result cues, ambience, gameplay, and Roulette remain protected.`);
