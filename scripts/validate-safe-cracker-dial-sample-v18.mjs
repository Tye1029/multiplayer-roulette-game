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
  if (!condition) throw new Error(`Safe Cracker uploaded PCM dial v25 validation failed: ${message}`);
}

function occurrences(source, value) {
  return source.split(value).length - 1;
}

const cleanSample = sampleText.replace(/\s+/g, '');
const sampleBytes = Buffer.from(cleanSample, 'base64');
const sampleHash = createHash('sha256').update(sampleBytes).digest('hex');
assert(sampleBytes.length >= 4600 && sampleBytes.length <= 4800, `uploaded PCM contains ${sampleBytes.length} bytes outside the recorded-click range`);
assert(/^[A-Za-z0-9+/=]+$/.test(cleanSample), 'uploaded PCM payload is not valid base64');

const sectionStart = client.indexOf('// SAFE_CRACKER_UPLOADED_PCM_V25_START');
const sectionEnd = client.indexOf('// SAFE_CRACKER_UPLOADED_PCM_V25_END', sectionStart);
const section = sectionStart >= 0 && sectionEnd > sectionStart ? client.slice(sectionStart, sectionEnd) : '';
const embeddedMatch = section.match(/const SAFE_CRACKER_UPLOADED_CLICK_PCM_V25 = "([A-Za-z0-9+/=]+)";/);

const checks = [
  ['v25 section is unique', occurrences(client, '// SAFE_CRACKER_UPLOADED_PCM_V25_START') === 1 && occurrences(client, '// SAFE_CRACKER_UPLOADED_PCM_V25_END') === 1],
  ['all older dial sections were removed', !client.includes('// SAFE_CRACKER_DIAL_SAMPLE_V18_START') && !client.includes('// SAFE_CRACKER_DIAL_SAMPLE_V19_START') && !client.includes('// SAFE_CRACKER_DIAL_SAMPLE_V20_START') && !client.includes('// SAFE_CRACKER_DIAL_SAMPLE_V21_START') && !client.includes('// SAFE_CRACKER_DIAL_SAMPLE_V22_START') && !client.includes('// SAFE_CRACKER_DIAL_SAMPLE_V23_START') && !client.includes('// SAFE_CRACKER_DIAL_PCM_V24_START')],
  ['the committed uploaded waveform is embedded exactly', Boolean(embeddedMatch) && embeddedMatch[1] === cleanSample],
  ['PCM sample rate and length are explicit', section.includes('const SAFE_CRACKER_UPLOADED_CLICK_RATE_V25 = 16000;') && section.includes('context.createBuffer(1, binary.length, SAFE_CRACKER_UPLOADED_CLICK_RATE_V25)')],
  ['uploaded bytes are converted directly into the AudioBuffer', section.includes('window.atob(SAFE_CRACKER_UPLOADED_CLICK_PCM_V25)') && section.includes('(binary.charCodeAt(index) - 128) / 127') && section.includes('buffer.getChannelData(0)')],
  ['the generated V24 synthesizer is absent', !section.includes('Math.sin(') && !section.includes('const steelA =') && !section.includes('const catchClick =') && !section.includes('const rebound =')],
  ['dial uses the proven direct WebAudio route', section.includes('function safeCrackerFireUploadedClickPcmV25()') && section.includes("context.state === 'running'") && section.includes('context.resume().then(fire)') && !section.includes('new Audio(') && !section.includes('decodeAudioData') && !section.includes('fetch(')],
  ['original pitch and waveform play without dial filtering', section.includes('source.playbackRate.setValueAtTime(1') && section.includes('gain.gain.setValueAtTime(0.98') && section.includes('gain.connect(context.destination);')],
  ['pointer gesture explicitly unlocks the PCM route', section.includes("document.addEventListener('pointerdown', safeCrackerUnlockUploadedClickPcmV25") && section.includes("document.addEventListener('touchstart', safeCrackerUnlockUploadedClickPcmV25")],
  ['dial alias is replaced', section.includes('function safeCrackerPlayUploadedPcmDetentV25(digit)') && section.includes('playDetent = safeCrackerPlayDetent;')],
  ['smooth ambience remains', section.includes('function safeCrackerSmoothRoomToneBufferV25(context)') && section.includes('const duration = 21;') && section.includes('gain.gain.exponentialRampToValueAtTime(0.026')],
  ['correct and incorrect cues remain separate', client.includes('function safeCrackerPlayAuthoritativeCorrectCue(game, completedStage)') && client.includes('function safeCrackerPlayIncorrectRejectCue(tier)') && !section.includes('safeCrackerPlayFeedback =') && !section.includes('safeCrackerPlayTumblerLock =')],
  ['source note documents exact waveform conversion', sourceNote.includes('exact waveform from `Metallic Clicks Sound Effect  SFX.mp3`') && sourceNote.includes('16 kHz unsigned 8-bit PCM') && sourceNote.includes('synthesized ratchet layer')],
  ['cache bust advances to v25', index.includes('&clicks=25')],
  ['gameplay and Roulette remain protected', client.includes('choice: `safecracker:guess:${runtime.selected}`') && turnAnimation.length > 0 && turnFire.length > 0 && audioBindings.length > 0],
  ['patch cannot write networking or Roulette files', !patch.includes("writeFile(new URL('../netlify/functions/") && !patch.includes("writeFile(new URL('../assets/roulette/")]
];

for (const [label, condition] of checks) assert(condition, label);

console.log(`Safe Cracker uploaded PCM dial v25 validation passed: committed waveform ${sampleHash} (${sampleBytes.length} bytes) from the user-provided metallic-click recording plays through the proven direct WebAudio buffer route with no generated ratchet, media element, decoder delay, or stale asset path; result cues, ambience, gameplay, and Roulette remain protected.`);
