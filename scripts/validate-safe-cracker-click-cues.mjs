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
  ['v15 click-cue marker is unique', occurrences(client, '// SAFE_CRACKER_CLICK_CUES_V15_START') === 1 && occurrences(client, '// SAFE_CRACKER_CLICK_CUES_V15_END') === 1],
  ['old v14 click layer is absent', !client.includes('// SAFE_CRACKER_CLICK_CUES_V14_START') && !client.includes('// SAFE_CRACKER_CLICK_CUES_V14_END')],
  ['recorded soundscape remains installed', occurrences(client, '// SAFE_CRACKER_RECORDED_SOUNDS_V13_START') === 1 && occurrences(client, '// SAFE_CRACKER_RECORDED_SOUNDS_V13_END') === 1],
  ['dial uses the new metallic ratchet cue', client.includes('function safeCrackerPlayMetalDialClick(digit)') && client.includes('function safeCrackerPlayMetalRatchetDetent(digit)') && client.includes('const played = safeCrackerPlayMetalDialClick(digit);')],
  ['dial click contains a sharp tooth and lower ratchet body', client.includes('const tooth = safeCrackerPlayClickTransient({') && client.includes('const ratchetBody = safeCrackerPlayClickTransient({') && client.includes('frequency: 3380 + step * 72') && client.includes('frequency: 1430 + step * 34')],
  ['incorrect-number cue is clear and guaranteed', client.includes('function safeCrackerPlayIncorrectRejectCue(tier)') && client.includes('const cuePlayed = safeCrackerPlayIncorrectRejectCue(tier);') && client.includes("safeCrackerPlayRecordedSound('incorrect'")],
  ['incorrect cue has three separate mechanical impacts', client.includes('const metalStop = safeCrackerPlayClickTransient({') && client.includes('const lockKnock = safeCrackerPlayClickTransient({') && client.includes('const rejectClack = safeCrackerPlayClickTransient({') && client.includes('delay: 0.205')],
  ['correct-number latch cue remains distinct', client.includes('function safeCrackerPlayCorrectNumberCue()') && client.includes('const cuePlayed = safeCrackerPlayCorrectNumberCue();') && client.includes("safeCrackerPlayRecordedSound('latchOpen'")],
  ['green feedback still routes to the correct-number cue', client.includes("if (tier === 'green') {") && client.includes('safeCrackerPlayTumblerLock();')],
  ['click cues use the Safe Cracker audio bus', client.includes('noiseGain.connect(safeCrackerAudioBus(context));') && client.includes('toneGain.connect(safeCrackerAudioBus(context));')],
  ['dial and feedback aliases point to final overrides', client.includes('playDetent = safeCrackerPlayDetent;') && client.includes('playFeedback = safeCrackerPlayFeedback;')],
  ['v15 cache bust is present', index.includes('&clicks=15')],
  ['dial retention remains installed', client.includes('// SAFE_CRACKER_DIAL_ACTIVITY_V16_START')],
  ['authoritative guess submission remains unchanged', client.includes('choice: `safecracker:guess:${runtime.selected}`')],
  ['patch does not touch networking or Roulette files', !patch.includes("writeFile(new URL('../netlify/functions/") && !patch.includes("writeFile(new URL('../assets/roulette/")],
  ['protected Roulette assets remain readable', turnAnimation.length > 0 && turnFire.length > 0 && audioBindings.length > 0]
];

for (const [label, condition] of checks) assert(condition, label);

console.log('Safe Cracker click-cue validation passed: dial turns use a layered metallic ratchet click, incorrect guesses use an unmistakable three-part rejected-lock cue, the correct latch cue remains intact, and protected gameplay boundaries are unchanged.');
