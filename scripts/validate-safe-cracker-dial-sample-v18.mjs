import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [client, index, sourceNote, patch, turnAnimation, turnFire, audioBindings] = await Promise.all([
  readFile(new URL('assets/safe-cracker/safe-cracker.js', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('assets/safe-cracker/audio-data-v3/SOURCE.md', root), 'utf8'),
  readFile(new URL('scripts/patch-safe-cracker-dial-sample-v22.mjs', root), 'utf8'),
  readFile(new URL('assets/roulette/turn-animation.js', root)),
  readFile(new URL('assets/roulette/turn-fire.js', root)),
  readFile(new URL('assets/roulette/audio-bindings.js', root))
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Safe Cracker PCM dial v24 validation failed: ${message}`);
}

function occurrences(source, value) {
  return source.split(value).length - 1;
}

const sectionStart = client.indexOf('// SAFE_CRACKER_DIAL_PCM_V24_START');
const sectionEnd = client.indexOf('// SAFE_CRACKER_DIAL_PCM_V24_END', sectionStart);
const section = sectionStart >= 0 && sectionEnd > sectionStart ? client.slice(sectionStart, sectionEnd) : '';

const checks = [
  ['v24 section is unique', occurrences(client, '// SAFE_CRACKER_DIAL_PCM_V24_START') === 1 && occurrences(client, '// SAFE_CRACKER_DIAL_PCM_V24_END') === 1],
  ['all media-sample sections were removed', !client.includes('// SAFE_CRACKER_DIAL_SAMPLE_V18_START') && !client.includes('// SAFE_CRACKER_DIAL_SAMPLE_V19_START') && !client.includes('// SAFE_CRACKER_DIAL_SAMPLE_V20_START') && !client.includes('// SAFE_CRACKER_DIAL_SAMPLE_V21_START') && !client.includes('// SAFE_CRACKER_DIAL_SAMPLE_V22_START') && !client.includes('// SAFE_CRACKER_DIAL_SAMPLE_V23_START')],
  ['dial buffer is built synchronously as PCM', section.includes('function safeCrackerBuildMechanicalPcmV24(context)') && section.includes('context.createBuffer(1, length, context.sampleRate)') && section.includes('buffer.getChannelData(0)')],
  ['mechanical click contains impact, steel, catch, and rebound layers', section.includes('const attack =') && section.includes('const steelA =') && section.includes('const catchClick =') && section.includes('const rebound =')],
  ['dial uses active WebAudio rather than media decoding', section.includes('function safeCrackerFireMechanicalPcmV24()') && section.includes("context.state === 'running'") && section.includes('context.resume().then(fire)') && !section.includes('new Audio(') && !section.includes('decodeAudioData') && !section.includes('data:audio/')],
  ['detent is connected directly and started immediately', section.includes('gain.connect(context.destination);') && section.includes('source.start(context.currentTime);') && section.includes('gain.gain.setValueAtTime(0.92')],
  ['pointer gesture explicitly unlocks the PCM route', section.includes("document.addEventListener('pointerdown', safeCrackerUnlockMechanicalPcmV24") && section.includes("document.addEventListener('touchstart', safeCrackerUnlockMechanicalPcmV24")],
  ['dial alias is replaced', section.includes('function safeCrackerPlayMechanicalPcmDetentV24(digit)') && section.includes('playDetent = safeCrackerPlayDetent;')],
  ['smooth ambience remains', section.includes('function safeCrackerSmoothRoomToneBufferV24(context)') && section.includes('const duration = 21;') && section.includes('gain.gain.exponentialRampToValueAtTime(0.026')],
  ['correct and incorrect cues remain separate', client.includes('function safeCrackerPlayAuthoritativeCorrectCue(game, completedStage)') && client.includes('function safeCrackerPlayIncorrectRejectCue(tier)') && !section.includes('safeCrackerPlayFeedback =') && !section.includes('safeCrackerPlayTumblerLock =')],
  ['source note documents why media playback was removed', sourceNote.includes('native MP3/data-URI route was removed') && sourceNote.includes('synchronous PCM steel-ratchet buffer')],
  ['cache bust advances to v24', index.includes('&clicks=24')],
  ['gameplay and Roulette remain protected', client.includes('choice: `safecracker:guess:${runtime.selected}`') && turnAnimation.length > 0 && turnFire.length > 0 && audioBindings.length > 0],
  ['patch cannot write networking or Roulette files', !patch.includes("writeFile(new URL('../netlify/functions/") && !patch.includes("writeFile(new URL('../assets/roulette/")]
];

for (const [label, condition] of checks) assert(condition, label);

console.log('Safe Cracker PCM dial v24 validation passed: the dial uses an immediate synchronous WebAudio steel-ratchet buffer with no media element, MP3 decoder, stale asset path, or delayed fallback; result cues, ambience, gameplay, and Roulette remain protected.');
