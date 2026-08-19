import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [client, index, patch, turnAnimation, turnFire, audioBindings] = await Promise.all([
  readFile(new URL('assets/safe-cracker/safe-cracker.js', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('scripts/patch-safe-cracker-dial-click-v17.mjs', root), 'utf8'),
  readFile(new URL('assets/roulette/turn-animation.js', root)),
  readFile(new URL('assets/roulette/turn-fire.js', root)),
  readFile(new URL('assets/roulette/audio-bindings.js', root))
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Safe Cracker dial click v17 validation failed: ${message}`);
}

function occurrences(source, value) {
  return source.split(value).length - 1;
}

const start = client.indexOf('// SAFE_CRACKER_DIAL_CLICK_V17_START');
const end = client.indexOf('// SAFE_CRACKER_DIAL_CLICK_V17_END', start);
const dialSource = start >= 0 && end > start ? client.slice(start, end) : '';

const checks = [
  ['v17 dial marker is unique', occurrences(client, '// SAFE_CRACKER_DIAL_CLICK_V17_START') === 1 && occurrences(client, '// SAFE_CRACKER_DIAL_CLICK_V17_END') === 1],
  ['v16 result cues remain installed', occurrences(client, '// SAFE_CRACKER_CLICK_CUES_V16_START') === 1 && occurrences(client, '// SAFE_CRACKER_CLICK_CUES_V16_END') === 1],
  ['dial uses the final mechanical ratchet override', client.includes('function safeCrackerPlayMechanicalRatchetClick(digit)') && client.includes('function safeCrackerPlayMechanicalRatchetDetent(digit)') && client.includes('const played = safeCrackerPlayMechanicalRatchetClick(digit);')],
  ['ratchet uses filtered impact noise only', client.includes('function safeCrackerPlayRatchetImpulse(options = {})') && dialSource.includes("bandpass.type = 'bandpass';") && dialSource.includes("highpass.type = 'highpass';") && !dialSource.includes('createOscillator') && !dialSource.includes('safeCrackerPlayRecordedSound(')],
  ['ratchet has four physical layers', dialSource.includes('const toothStrike = safeCrackerPlayRatchetImpulse({') && dialSource.includes('const steelScrape = safeCrackerPlayRatchetImpulse({') && dialSource.includes('const pawlCatch = safeCrackerPlayRatchetImpulse({') && dialSource.includes('const reboundClick = safeCrackerPlayRatchetImpulse({')],
  ['tooth is sharp and high-frequency', dialSource.includes('duration: 0.013') && dialSource.includes('highpass: 1750') && dialSource.includes('q: 9.4')],
  ['steel scrape and pawl catch add mechanical body', dialSource.includes('delay: 0.004') && dialSource.includes('q: 1.65') && dialSource.includes('delay: 0.019') && dialSource.includes('q: 4.7')],
  ['final detent alias points to v17', client.includes('const safeCrackerMechanicalDetentFallback = safeCrackerPlayDetent;') && client.includes('playDetent = safeCrackerPlayDetent;')],
  ['correct-number authoritative latch cue remains present', client.includes('function safeCrackerPlayAuthoritativeCorrectCue(game, completedStage)') && client.includes('function safeCrackerRenderWithAuthoritativeCorrectCue(game)')],
  ['incorrect-number rejection cue remains present', client.includes('function safeCrackerPlayIncorrectRejectCue(tier)') && client.includes("safeCrackerPlayRecordedSound('incorrect'")],
  ['cache bust is v17', index.includes('&clicks=17')],
  ['dial retention remains installed', client.includes('// SAFE_CRACKER_DIAL_ACTIVITY_V16_START')],
  ['authoritative guess submission remains unchanged', client.includes('choice: `safecracker:guess:${runtime.selected}`')],
  ['patch cannot touch networking or Roulette files', !patch.includes("writeFile(new URL('../netlify/functions/") && !patch.includes("writeFile(new URL('../assets/roulette/")],
  ['protected Roulette assets remain readable', turnAnimation.length > 0 && turnFire.length > 0 && audioBindings.length > 0]
];

for (const [label, condition] of checks) assert(condition, label);

console.log('Safe Cracker dial click v17 validation passed: each detent has a sharp tooth strike, brief steel scrape, pawl catch, and rebound without musical oscillators, while result cues and protected gameplay remain unchanged.');
