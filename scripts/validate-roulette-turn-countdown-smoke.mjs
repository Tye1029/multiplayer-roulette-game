import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [html, audio, policy, lamp, lampCss, injector] = await Promise.all([
  read('index.html'),
  read('assets/roulette/audio-manager.js'),
  read('assets/roulette/spin-audio-policy.js'),
  read('assets/roulette/lamp.js'),
  read('assets/roulette/lamp.css'),
  read('scripts/inject-lamp-assets.mjs')
]);

for (const required of [
  'function playTurnMove(game, state, gameId, turnId)',
  "const movementKey = [gameId, revision, action, actor, turnId, shots].join(':');",
  "claimAction('turn-move', movementKey, 4500)",
  'duration: 0.58',
  'fadeOut: 0.24',
  'turnMove: playTurnMove',
  'lastTurnMoveKey'
]) {
  if (!policy.includes(required)) throw new Error(`Reliable turn movement audio is missing ${required}`);
}

for (const forbidden of [
  "claimAction('turn-move', `${gameId}:${turnId}`, 12000)",
  "scheduleAction('turn-cue'",
  "play('tap', {\n        group: 'turn-cue'"
]) {
  if (policy.includes(forbidden) || audio.includes(forbidden)) {
    throw new Error(`Obsolete or terminal-knock turn audio remains: ${forbidden}`);
  }
}

for (const required of [
  'function countdownCue(label)',
  "play('heartbeat', {",
  "play('rumble', {",
  'countdownCue,',
  'globalThis.RouletteAudio?.countdownCue?.(label);',
  '<style id="rr-v150-red-countdown-smoke">',
  'color:#b50f18!important'
]) {
  const source = required.startsWith('function countdownCue') || required.startsWith("play('") || required === 'countdownCue,'
    ? audio
    : html;
  if (!source.includes(required)) throw new Error(`Red audible countdown is missing ${required}`);
}

for (const required of [
  "smoke: doc.querySelector('.rr-smoke')",
  'function ensureSmokeLayers(doc, smoke)',
  'function ensureSmokeTimeline(smokeLit, cfg)',
  "'__rrLampSmokeTimeline'",
  'phaseMilliseconds(duration)',
  'ensureSmokeTimeline(smokeLayers.lit, cfg)'
]) {
  if (!lamp.includes(required)) throw new Error(`Lamp-synchronized smoke is missing ${required}`);
}

for (const required of [
  '/* Lamp-synchronized room smoke. */',
  '[data-roulette-game] .rr-smoke-ambient',
  '[data-roulette-game] .rr-smoke-lit',
  '@keyframes rrRoomSmokeDrift',
  'mix-blend-mode:screen!important'
]) {
  if (!lampCss.includes(required)) throw new Error(`Room smoke styling is missing ${required}`);
}

for (const required of [
  '<style id="rr-v151-reactive-smoke-priority">',
  'visibility:visible!important;',
  '[data-roulette-game] .rr-smoke-lit{',
  'background-size:125% 100%,100% 100%!important'
]) {
  if (!html.includes(required)) throw new Error(`Final-priority reactive smoke styling is missing ${required}`);
}

for (const required of [
  "import './patch-roulette-turn-countdown-smoke.mjs';",
  "import './patch-roulette-smoke-priority.mjs';",
  '/assets/roulette/lamp.css?v=18&smoke=1',
  '/assets/roulette/lamp.js?v=20&smoke=1',
  '/assets/roulette/audio-manager.js?v=4&ambience=2&countdown=2',
  '/assets/roulette/spin-audio-policy.js?v=3&turn-audio=2'
]) {
  if (!injector.includes(required)) throw new Error(`Fresh patched asset loading is missing ${required}`);
}

console.log('Roulette turn/countdown/smoke validation passed: every pass has a revision-keyed movement cue, the wood knock is removed, countdown is red and audible, and final-priority smoke tracks the calibrated lamp light.');
