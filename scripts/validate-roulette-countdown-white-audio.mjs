import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [html, audio, policy, guard, turnAnimation, turnFire] = await Promise.all([
  read('index.html'),
  read('assets/roulette/audio-manager.js'),
  read('assets/roulette/spin-audio-policy.js'),
  read('assets/roulette/turn-facing-guard.js'),
  read('assets/roulette/turn-animation.js'),
  read('assets/roulette/turn-fire.js')
]);

for (const [name, source] of [
  ['audio-manager.js', audio],
  ['spin-audio-policy.js', policy],
  ['turn-facing-guard.js', guard]
]) new vm.Script(source, { filename: name });

for (const required of [
  'rr-v154-white-countdown-audio',
  'color:#fff!important',
  "globalThis.RouletteAudio?.countdownCue?.(label)",
  '/assets/roulette/audio-manager.js?v=4&ambience=2&media=2&countdown=2',
  '/assets/roulette/spin-audio-policy.js?v=3&turnsound=3',
  '/assets/roulette/turn-facing-guard.js?v=1&lock=2'
]) {
  if (!html.includes(required)) throw new Error(`Countdown/turn HTML validation is missing ${required}`);
}

for (const required of [
  'function countdownSynthAudioContext()',
  'function countdownSynthTone(context, destination, options)',
  'function countdownSynthClick(context, destination, start, level)',
  'function countdownCue(label)',
  "const fundamental = [174.61, 207.65, 246.94][step]",
  "stopGroup('turn-cue', 24)",
  'countdownCue,'
]) {
  if (!audio.includes(required)) throw new Error(`Custom countdown audio validation is missing ${required}`);
}
if (audio.includes("scheduleAction('turn-cue'")) {
  throw new Error('The delayed wooden knock remains in audio-manager.js.');
}

for (const required of [
  "group: 'turn-move'",
  'volume: 0.044',
  'start: 0.12',
  'duration: 0.62',
  'fadeOut: 0.30'
]) {
  if (!policy.includes(required)) throw new Error(`Knock-free turn movement validation is missing ${required}`);
}

for (const required of [
  'function playTurnMovement(details = {})',
  'const key = `${gameId}:${fromTurnId}:${turnId}:${epoch}`',
  "if (!details || typeof details !== 'object') return false;",
  'return playTurnMovement(details);'
]) {
  if (!policy.includes(required)) throw new Error(`Direct turn movement validation is missing ${required}`);
}
if (policy.includes('function syncTurnMovement()') || policy.includes('pollTimer')) {
  throw new Error('Turn movement sound is still polling snapshots instead of following the real animation.');
}

for (const required of [
  'global.__rrAuthoritativeFacingGuardV2 = true',
  'function snapshotStamp(game)',
  'function compareSnapshots(left, right)',
  'function authoritativeTurnId(game, root = currentRoot(game?.gameId))',
  'function angleForTurn(game, turnId)',
  'function animationIsAuthorized(element)',
  'function startTurnMovementSound()',
  'function installAnimationGate()',
  "scheduleReconcile('blocked-unauthorized-facing-animation')",
  'state.cancelledStaleRotations += 1',
  'global.RouletteAudio?.turnRotate?.({',
  'await api.rotateToLockedTurn(game, gameId, turnId, 1020)',
  'api.enforceLockedFacing(gameId)',
  "state.timer = global.setInterval(() => scheduleReconcile('hard-lock-poll'), 80)",
  'global.RouletteFacingGuard = Object.freeze({'
]) {
  if (!guard.includes(required)) throw new Error(`Authoritative facing guard validation is missing ${required}`);
}

function gitBlobSha(source) {
  const bytes = Buffer.from(source, 'utf8');
  return createHash('sha1')
    .update(Buffer.from(`blob ${bytes.length}\0`, 'utf8'))
    .update(bytes)
    .digest('hex');
}

for (const [name, expected, source] of [
  ['turn-animation.js', '24358e84c147d99e7297089e69ed1abd0802379f', turnAnimation],
  ['turn-fire.js', '940e824eae39ddc40dda6200f893f97fc365949b', turnFire]
]) {
  const actual = gitBlobSha(source);
  if (actual !== expected) throw new Error(`${name} protected hash changed: ${actual}`);
}

console.log('Roulette validation passed: white countdown, freshest-snapshot turn lock, animation-synchronized early movement sound, no terminal knock, and protected animation hashes intact.');
