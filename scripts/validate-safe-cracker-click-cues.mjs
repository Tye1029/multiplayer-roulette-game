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

const checks = [
  ['click-cue marker is unique', occurrences(client, '// SAFE_CRACKER_CLICK_CUES_V14_START') === 1 && occurrences(client, '// SAFE_CRACKER_CLICK_CUES_V14_END') === 1],
  ['recorded soundscape remains installed', occurrences(client, '// SAFE_CRACKER_RECORDED_SOUNDS_V13_START') === 1 && occurrences(client, '// SAFE_CRACKER_RECORDED_SOUNDS_V13_END') === 1],
  ['dial uses the new click transient', client.includes('function safeCrackerPlayDialClick(digit)') && client.includes('function safeCrackerPlayClickyDetent(digit)') && client.includes('const played = safeCrackerPlayDialClick(digit);')],
  ['dial click has noise and a short pitched impact', client.includes('function safeCrackerClickNoiseBuffer(context)') && client.includes('function safeCrackerPlayClickTransient(options = {})') && client.includes("toneType: 'square'")],
  ['wrong-number cue is distinct and guaranteed', client.includes('function safeCrackerPlayWrongNumberCue(tier)') && client.includes('const cuePlayed = safeCrackerPlayWrongNumberCue(tier);') && client.includes("safeCrackerPlayRecordedSound('incorrect'")],
  ['correct-number cue is distinct and guaranteed', client.includes('function safeCrackerPlayCorrectNumberCue()') && client.includes('const cuePlayed = safeCrackerPlayCorrectNumberCue();') && client.includes("safeCrackerPlayRecordedSound('latchOpen'")],
  ['green feedback routes to the correct-number cue', client.includes("if (tier === 'green') {") && client.includes('safeCrackerPlayTumblerLock();')],
  ['wrong and correct cues have different pitch movement', client.includes('toneFrequency: 285 - severity * 28') && client.includes('toneEnd: 118 - severity * 10') && client.includes('toneFrequency: 1280') && client.includes('toneEnd: 1760')],
  ['click cues use the Safe Cracker audio bus', client.includes('noiseGain.connect(safeCrackerAudioBus(context));') && client.includes('toneGain.connect(safeCrackerAudioBus(context));')],
  ['dial and feedback aliases point to the final overrides', client.includes('playDetent = safeCrackerPlayDetent;') && client.includes('playFeedback = safeCrackerPlayFeedback;')],
  ['new cache bust is present', index.includes('&clicks=14')],
  ['dial retention remains installed', client.includes('// SAFE_CRACKER_DIAL_ACTIVITY_V16_START')],
  ['authoritative guess submission remains unchanged', client.includes('choice: `safecracker:guess:${runtime.selected}`')],
  ['patch does not touch networking or Roulette files', !patch.includes("writeFile(new URL('../netlify/functions/") && !patch.includes("writeFile(new URL('../assets/roulette/")],
  ['protected Roulette assets remain readable', turnAnimation.length > 0 && turnFire.length > 0 && audioBindings.length > 0]
];

for (const [label, condition] of checks) assert(condition, label);

console.log('Safe Cracker click-cue validation passed: dial turns use crisp mechanical clicks, wrong guesses use a descending double clack, correct guesses use a bright rising latch cue, and protected gameplay boundaries remain intact.');
