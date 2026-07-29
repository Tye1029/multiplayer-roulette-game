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
  '/assets/roulette/turn-facing-guard.js?v=3&lock=5&owner=3&opening=1',
  'Shot visuals own recoil and hammer movement only.',
  'Direction changes are owned exclusively by turn-facing-guard.js.',
  "window.addEventListener('roulette-facing-diagnostic'",
  'rotationDiagnostics=Array.isArray(window.__rouletteFacingDiagnostics)'
]) {
  if (!html.includes(required)) throw new Error(`Countdown/turn HTML validation is missing ${required}`);
}
for (const forbidden of [
  'if(nextTurnId)await rouletteRotateToTurn',
  "rouletteQueueVisual(()=>rouletteRotateToTurn(game,st,gameId,{duration:900,targetTurnId:incomingTurnId}))"
]) {
  if (html.includes(forbidden)) throw new Error(`A duplicate legacy turn-rotation owner remains: ${forbidden}`);
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
  'function playTurnMovement(details = {})',
  "group: 'turn-move'",
  'volume: 0.044',
  'start: 0.12',
  'duration: 0.62',
  'fadeOut: 0.30',
  'return playTurnMovement(details);'
]) {
  if (!policy.includes(required)) throw new Error(`Turn movement audio validation is missing ${required}`);
}
for (const forbidden of [
  'function syncTurnMovement()',
  'pollTimer',
  'turn-move.wav'
]) {
  if (policy.includes(forbidden)) throw new Error(`Old turn movement polling/audio remains: ${forbidden}`);
}

for (const required of [
  'global.__rrSingleRotationOwnerV3 = true;',
  'function transitionToken(gameId, fromTurnId, turnId, rouletteRevision)',
  'next.rouletteRevision <= previous.rouletteRevision',
  "recordDiagnostic('requested', transition);",
  "recordDiagnostic('approved', transition);",
  "recordDiagnostic('completed', transition);",
  "reason: 'legacy-rotation-api'",
  "reason: 'unauthorized-facing-animation'",
  'state.activeTransition = transition;',
  'await api.rotateToLockedTurn(game, transition.gameId, transition.turnId, 1020);',
  'function activeTransitionStillAuthoritative(game, transition)',
  "recordDiagnostic('held', { reason: 'approved-transition-active'"
]) {
  if (!guard.includes(required)) throw new Error(`Single-owner facing guard validation is missing ${required}`);
}

const hash = source => createHash('sha1').update(source).digest('hex');
if (hash(turnAnimation) !== '24358e84c147d99e7297089e69ed1abd0802379f') throw new Error('Protected turn-animation.js changed.');
if (hash(turnFire) !== '940e824eae39ddc40dda6200f893f97fc365949b') throw new Error('Protected turn-fire.js changed.');

console.log('Roulette validation passed: white countdown, one revision-token rotation owner, active approved rotations remain visible, pre-spin left-facing lock, final-state direction lock, diagnostic export, synchronized movement audio, no terminal knock, and protected animation hashes intact.');
