import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [client, index, patch, turnAnimation, turnFire, audioBindings] = await Promise.all([
  readFile(new URL('assets/safe-cracker/safe-cracker.js', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('scripts/patch-safe-cracker-click-cues.mjs', root), 'utf8'),
  readFile(new URL('assets/roulette/turn-animation.js', root)),
  readFile(new URL('assets/roulette/turn-fire.js', root)),
  readFile(new URL('assets/roulette/audio-bindings.js', root))
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Safe Cracker click-cue validation failed: ${message}`);
}

function occurrences(source, value) {
  return source.split(value).length - 1;
}

const dialStart = client.indexOf('function safeCrackerPlayMetalDialClick(digit)');
const dialEnd = client.indexOf('function safeCrackerPlayIncorrectRejectCue(tier)', dialStart);
const dialSource = dialStart >= 0 && dialEnd > dialStart ? client.slice(dialStart, dialEnd) : '';

const checks = [
  ['click-cue marker is unique', occurrences(client, '// SAFE_CRACKER_CLICK_CUES_V16_START') === 1 && occurrences(client, '// SAFE_CRACKER_CLICK_CUES_V16_END') === 1],
  ['recorded soundscape remains installed', occurrences(client, '// SAFE_CRACKER_RECORDED_SOUNDS_V13_START') === 1 && occurrences(client, '// SAFE_CRACKER_RECORDED_SOUNDS_V13_END') === 1],
  ['dial uses the dry metallic ratchet override', client.includes('function safeCrackerPlayMetalDialClick(digit)') && client.includes('function safeCrackerPlayDryRatchetDetent(digit)') && client.includes('const played = safeCrackerPlayMetalDialClick(digit);')],
  ['dry metal impact uses filtered noise without an oscillator', client.includes('function safeCrackerPlayDryMetalImpact(options = {})') && client.includes("primary.type = 'bandpass';") && client.includes("secondary.type = 'bandpass';") && !dialSource.includes('createOscillator') && !dialSource.includes('safeCrackerPlayRecordedSound(')],
  ['dial has separate tooth and catch impacts', dialSource.includes('const tooth = safeCrackerPlayDryMetalImpact({') && dialSource.includes('const catchClick = safeCrackerPlayDryMetalImpact({') && dialSource.includes('delay: 0.017')],
  ['incorrect-number cue is a three-part dry rejected-lock sequence', client.includes('function safeCrackerPlayIncorrectRejectCue(tier)') && client.includes('const stop = safeCrackerPlayDryMetalImpact({') && client.includes('const knock = safeCrackerPlayDryMetalImpact({') && client.includes('const reject = safeCrackerPlayDryMetalImpact({')],
  ['correct-number cue includes dry latch impacts and recorded latch', client.includes('function safeCrackerPlayCorrectNumberCue()') && client.includes('const latchStrike = safeCrackerPlayDryMetalImpact({') && client.includes('const boltRelease = safeCrackerPlayDryMetalImpact({') && client.includes("safeCrackerPlayRecordedSound('latchOpen'")],
  ['correct cue is deduplicated by game and completed stage', client.includes('function safeCrackerPlayAuthoritativeCorrectCue(game, completedStage)') && client.includes('runtime.safeCrackerCorrectCueKey === key') && client.includes('runtime.safeCrackerCorrectCueKey = key;')],
  ['authoritative stage increase triggers the correct cue directly', client.includes('const previousStage = Number(myState(game)?.stage || 0);') && client.includes('const nextStage = Number(nextGame?.safecrackerState?.me?.stage || 0);') && client.includes('if (nextStage > previousStage) safeCrackerPlayAuthoritativeCorrectCue(nextGame, nextStage);')],
  ['incorrect feedback still combines generated and recorded rejection sounds', client.includes('const cuePlayed = safeCrackerPlayIncorrectRejectCue(tier);') && client.includes("safeCrackerPlayRecordedSound('incorrect'")],
  ['green feedback routes to the correct-number latch path', client.includes("if (tier === 'green') {") && client.includes('safeCrackerPlayTumblerLock();')],
  ['click cues use the Safe Cracker audio bus', client.includes('primaryGain.connect(safeCrackerAudioBus(context));') && client.includes('secondaryGain.connect(safeCrackerAudioBus(context));')],
  ['dial and feedback aliases point to the final overrides', client.includes('playDetent = safeCrackerPlayDetent;') && client.includes('playFeedback = safeCrackerPlayFeedback;')],
  ['new cache bust is present', index.includes('&clicks=16')],
  ['dial retention remains installed', client.includes('// SAFE_CRACKER_DIAL_ACTIVITY_V16_START')],
  ['authoritative guess submission remains unchanged', client.includes('choice: `safecracker:guess:${runtime.selected}`')],
  ['patch does not touch networking or Roulette files', !patch.includes("writeFile(new URL('../netlify/functions/") && !patch.includes("writeFile(new URL('../assets/roulette/")],
  ['protected Roulette assets remain readable', turnAnimation.length > 0 && turnFire.length > 0 && audioBindings.length > 0]
];

for (const [label, condition] of checks) assert(condition, label);

console.log('Safe Cracker click-cue validation passed: the dial uses dry non-musical metal ratchets, incorrect guesses use a clear three-part rejected-lock sequence, correct guesses fire directly from authoritative stage progress, and protected gameplay boundaries remain intact.');
