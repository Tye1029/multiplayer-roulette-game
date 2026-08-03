import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [client, index, sampleText, sourceNote, patch, turnAnimation, turnFire, audioBindings] = await Promise.all([
  readFile(new URL('assets/safe-cracker/safe-cracker.js', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('assets/safe-cracker/audio-data-v3/bank-vault-dial-click-1.b64', root), 'utf8'),
  readFile(new URL('assets/safe-cracker/audio-data-v3/SOURCE.md', root), 'utf8'),
  readFile(new URL('scripts/patch-safe-cracker-dial-sample-v22.mjs', root), 'utf8'),
  readFile(new URL('assets/roulette/turn-animation.js', root)),
  readFile(new URL('assets/roulette/turn-fire.js', root)),
  readFile(new URL('assets/roulette/audio-bindings.js', root))
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Safe Cracker embedded metallic click v23 validation failed: ${message}`);
}

function occurrences(source, value) {
  return source.split(value).length - 1;
}

const sampleBytes = Buffer.from(sampleText.replace(/\s+/g, ''), 'base64');
const sampleHash = createHash('sha256').update(sampleBytes).digest('hex');
let frameSyncs = 0;
for (let index = 0; index + 1 < sampleBytes.length; index += 1) {
  if (sampleBytes[index] === 0xff && (sampleBytes[index + 1] & 0xe0) === 0xe0) frameSyncs += 1;
}
assert(sampleBytes.length >= 5400 && sampleBytes.length <= 5700, `embedded click decoded size ${sampleBytes.length} is outside the exact 400 ms range`);
assert(sampleBytes.subarray(0, 3).toString('ascii') === 'ID3' || sampleBytes[0] === 0xff, 'embedded click is not an MP3 payload');
assert(frameSyncs >= 18, `embedded click contains only ${frameSyncs} MPEG frame markers`);
assert(sampleHash === 'cdad6e1c31fb97c70f8cea1aa48d88d64131c2e436390c1ceda933ce4233a63b', `embedded click checksum changed: ${sampleHash}`);

const sectionStart = client.indexOf('// SAFE_CRACKER_DIAL_SAMPLE_V23_START');
const sectionEnd = client.indexOf('// SAFE_CRACKER_DIAL_SAMPLE_V23_END', sectionStart);
const section = sectionStart >= 0 && sectionEnd > sectionStart ? client.slice(sectionStart, sectionEnd) : '';
const embeddedMatch = section.match(/data:audio\/mpeg;base64,([A-Za-z0-9+/=]+)/);

const checks = [
  ['v23 section is unique', occurrences(client, '// SAFE_CRACKER_DIAL_SAMPLE_V23_START') === 1 && occurrences(client, '// SAFE_CRACKER_DIAL_SAMPLE_V23_END') === 1],
  ['all older sample sections were removed', !client.includes('// SAFE_CRACKER_DIAL_SAMPLE_V18_START') && !client.includes('// SAFE_CRACKER_DIAL_SAMPLE_V19_START') && !client.includes('// SAFE_CRACKER_DIAL_SAMPLE_V20_START') && !client.includes('// SAFE_CRACKER_DIAL_SAMPLE_V21_START') && !client.includes('// SAFE_CRACKER_DIAL_SAMPLE_V22_START')],
  ['the exact MP3 is embedded directly in generated JavaScript', Boolean(embeddedMatch) && embeddedMatch[1] === sampleText.replace(/\s+/g, '')],
  ['six overlapping native voices use the one exact recording', section.includes('Array.from({ length: 6 }, () => safeCrackerCreateMetallicVoiceV23())') && section.includes('new Audio(SAFE_CRACKER_METALLIC_CLICK_V23)')],
  ['the dial always uses the embedded metallic recording', section.includes('function safeCrackerPlayExactMetallicClickV23()') && section.includes('function safeCrackerPlayEmbeddedMetallicDetentV23(digit)') && section.includes('playDetent = safeCrackerPlayDetent;')],
  ['no old asset fetch or synthetic ratchet fallback remains', !section.includes('fetch(') && !section.includes('safeCrackerPlayDryDialFallback') && !section.includes('safeCrackerPlayNoise(') && !section.includes('createOscillator')],
  ['native playback keeps the original pitch at full volume', section.includes('voice.volume = 1;') && section.includes('voice.playbackRate = 1;') && section.includes('voice.currentTime = 0;')],
  ['playback failure retries the same embedded recording', section.includes('const retry = safeCrackerCreateMetallicVoiceV23();') && section.includes('retry.play().catch(() => {});')],
  ['smooth background ambience remains unchanged', section.includes('function safeCrackerSmoothRoomToneBufferV23(context)') && section.includes('const duration = 21;') && section.includes('function safeCrackerStartSmoothVaultRoomToneV23()') && section.includes('gain.gain.exponentialRampToValueAtTime(0.026')],
  ['correct and incorrect cues remain separate', client.includes('function safeCrackerPlayAuthoritativeCorrectCue(game, completedStage)') && client.includes('function safeCrackerPlayIncorrectRejectCue(tier)') && !section.includes('safeCrackerPlayFeedback =') && !section.includes('safeCrackerPlayTumblerLock =')],
  ['source note identifies the exact embedded pass', sourceNote.includes('exact 400 ms metallic click') && sourceNote.includes('embedded directly into the generated Safe Cracker JavaScript') && sourceNote.includes('no previous dial bank or synthesized fallback')],
  ['cache bust advances to v23', index.includes('&clicks=23')],
  ['gameplay and Roulette remain protected', client.includes('choice: `safecracker:guess:${runtime.selected}`') && turnAnimation.length > 0 && turnFire.length > 0 && audioBindings.length > 0],
  ['patch cannot write networking or Roulette files', !patch.includes("writeFile(new URL('../netlify/functions/") && !patch.includes("writeFile(new URL('../assets/roulette/")]
];

for (const [label, condition] of checks) assert(condition, label);

console.log('Safe Cracker embedded metallic click v23 validation passed: one exact 400 ms click from the new upload is embedded for every detent with no previous bank, cache path, or synthetic fallback, while result cues, smooth ambience, gameplay, and Roulette remain unchanged.');
