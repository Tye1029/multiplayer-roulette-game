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
  '/assets/roulette/turn-facing-guard.js?v=2&lock=3&owner=1',
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
  "group: 'turn-move'",
  'volume: 0.044',
  'start: 0.12',
  'duration: 0.62',
  'fadeOut: 0.30',
  'function playTurnMovement(details = {})',
  'const key = `${gameId}:${fromTurnId}:${turnId}:${epoch}`',
  "if (!details || typeof details !== 'object') return false;",
  'return playTurnMovement(details);'
]) {
  if (!policy.includes(required)) throw new Error(`Turn movement validation is missing ${required}`);
}
if (policy.includes('function syncTurnMovement()') || policy.includes('pollTimer')) {
  throw new Error('Turn movement sound is still polling snapshots instead of following the approved animation.');
}

for (const required of [
  'global.__rrSingleRotationOwnerV3 = true',
  'global.__rouletteFacingDiagnostics = diagnostics',
  'function recordDiagnostic(event, details = {})',
  'function snapshotStamp(game)',
  'function compareSnapshots(left, right)',
  'function authoritativeTurnId(game)',
  'function transitionToken(gameId, fromTurnId, turnId, rouletteRevision)',
  'function observeAcceptedSnapshot(game, turnId)',
  'function installLegacyRotationBlock()',
  'function installBindGate()',
  'function installAnimationGate()',
  "recordDiagnostic('requested', transition)",
  "recordDiagnostic('approved', transition)",
  "recordDiagnostic('completed', transition)",
  "recordDiagnostic('cancelled'",
  "recordDiagnostic('blocked'",
  "reason: 'legacy-rotation-api'",
  "reason: 'duplicate-rotation-token'",
  'await api.rotateToLockedTurn(game, transition.gameId, transition.turnId, 1020)',
  "if (game.status !== 'playing')",
  "snapFacing(game, turnId, 'non-playing-final-lock'",
  "state.timer = global.setInterval(() => scheduleReconcile('single-owner-poll'), 80)",
  'global.RouletteFacingGuard = Object.freeze({'
]) {
  if (!guard.includes(required)) throw new Error(`Single-owner facing guard validation is missing ${required}`);
}
if (guard.includes('rootRevision >= gameRevision')) {
  throw new Error('Mounted DOM state can still override the accepted server snapshot.');
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

console.log('Roulette validation passed: white countdown, one revision-token rotation owner, final-state direction lock, diagnostic export, synchronized movement audio, no terminal knock, and protected animation hashes intact.');
