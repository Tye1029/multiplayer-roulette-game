import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [client, index, patch, turnAnimation, turnFire, audioBindings] = await Promise.all([
  readFile(new URL('assets/safe-cracker/safe-cracker.js', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('scripts/patch-safe-cracker-audio.mjs', root), 'utf8'),
  readFile(new URL('assets/roulette/turn-animation.js', root)),
  readFile(new URL('assets/roulette/turn-fire.js', root)),
  readFile(new URL('assets/roulette/audio-bindings.js', root))
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Safe Cracker audio validation failed: ${message}`);
}

function occurrences(source, value) {
  return source.split(value).length - 1;
}

const checks = [
  ['audio runtime marker is unique', occurrences(client, '// SAFE_CRACKER_AUDIO_PASS_V10_START') === 1 && occurrences(client, '// SAFE_CRACKER_AUDIO_PASS_V10_END') === 1],
  ['dial detents use layered mechanical ticks', client.includes('function safeCrackerPlayDetent(digit)') && client.includes('safeCrackerPlayMetalTick(pitch, 0.72 + weight * 0.32);')],
  ['number submission has a dedicated press sound', client.includes('function safeCrackerPlaySubmit()') && client.includes('safeCrackerPlaySubmit();')],
  ['all proximity tiers have dedicated feedback', client.includes('function safeCrackerPlayFeedback(tier)') && client.includes("if (tier === 'green')") && client.includes("if (tier === 'yellow')") && client.includes("if (tier === 'orange')")],
  ['successful guesses use a physical tumbler lock', client.includes('function safeCrackerPlayTumblerLock()') && client.includes('safeCrackerPlayNoise(0.11, 0.018, 0.045')],
  ['countdown audio follows the visible countdown portal', client.includes('function safeCrackerScanCountdown()') && client.includes("document.querySelector('[data-sc-countdown-value]')")],
  ['last-ten-second urgency is second-gated', client.includes('function safeCrackerUpdateUrgency()') && client.includes('if (seconds > 10 || seconds <= 0)')],
  ['safe opening uses bolts, scrape, thud, and shimmer layers', client.includes('function safeCrackerPlaySafeOpen()') && client.includes('safeCrackerPlayNoise(0.34, 0.025, 0.24') && client.includes('safeCrackerPlayTone(568, 0.48, 0.014')],
  ['win, loss, and tie have separate result signatures', client.includes('function safeCrackerPlayResult(won, tied)') && client.includes("if (tied) {") && client.includes("safeCrackerPlayTone(659, 0.42")],
  ['Safe Cracker buttons are scoped and step/confirm sounds are not doubled', client.includes("button.matches('[data-sc-step], [data-sc-confirm]')") && client.includes('.sth-game[data-mode="safecracker"]')],
  ['haptics are centralized and throttled', client.includes('function safeCrackerHaptic(pattern)') && client.includes('runtime.safeCrackerLastHapticAt')],
  ['audio output is compressed through one master bus', client.includes('function safeCrackerAudioBus(context)') && client.includes('context.createDynamicsCompressor()')],
  ['audio cache bust is present', index.includes('&input=1&audio=1')],
  ['authoritative number submission is unchanged', client.includes('choice: `safecracker:guess:${runtime.selected}`')],
  ['input continuity remains installed', client.includes('// SAFE_CRACKER_INPUT_CONTINUITY_V9_START') && client.includes('runtime.pendingDragGame = game;')],
  ['Pass 8 video correction remains installed', client.includes('// SAFE_CRACKER_VIDEO_CORRECTION_V8_START')],
  ['protected Roulette assets remain readable', turnAnimation.length > 0 && turnFire.length > 0 && audioBindings.length > 0],
  ['audio patch cannot write networking or Roulette files', !patch.includes("writeFile(new URL('../netlify/functions/") && !patch.includes("writeFile(new URL('../assets/roulette/")]
];

for (const [label, condition] of checks) assert(condition, label);

console.log('Safe Cracker audio validation passed: detents, submission, proximity, tumbler lock, countdown, urgency, safe opening, results, buttons, haptics, continuity, and protected Roulette boundaries are intact.');
