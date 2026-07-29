import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [html, audio, policy, smoke, smokeCss, injector] = await Promise.all([
  read('index.html'),
  read('assets/roulette/audio-manager.js'),
  read('assets/roulette/spin-audio-policy.js'),
  read('assets/roulette/smoke.js'),
  read('assets/roulette/smoke.css'),
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
  'global.__rrPermanentSmokeV1 = true',
  "ensureLayer(smoke, 'rr-smoke-ambient')",
  "ensureLayer(smoke, 'rr-smoke-lit')",
  'synchronizeLitSmoke(lit, readLampConfig())',
  'animation.currentTime = Math.max(0, Date.now() - phaseEpoch)'
]) {
  if (!smoke.includes(required)) throw new Error(`Permanent lamp-synchronized smoke is missing ${required}`);
}

for (const required of [
  '[data-roulette-game] .rr-smoke {',
  '[data-roulette-game] .rr-smoke-ambient',
  '[data-roulette-game] .rr-smoke-lit',
  'opacity: .72 !important;',
  'opacity: .78 !important;',
  '@keyframes rrPermanentSmokeDrift',
  'mix-blend-mode: screen !important;'
]) {
  if (!smokeCss.includes(required)) throw new Error(`Permanent room smoke styling is missing ${required}`);
}

if (html.includes('rr-v153-adjustable-smoke-priority')) {
  throw new Error('Obsolete adjustable-smoke priority styling remains in the built page.');
}

for (const required of [
  "import './patch-roulette-turn-countdown-smoke.mjs';",
  "import './patch-roulette-smoke-priority.mjs';",
  '/assets/roulette/smoke.css?v=1',
  '/assets/roulette/smoke.js?v=1',
  '/assets/roulette/audio-manager.js?v=4&ambience=2&countdown=2',
  '/assets/roulette/spin-audio-policy.js?v=3&turn-audio=2'
]) {
  if (!injector.includes(required)) throw new Error(`Fresh patched asset loading is missing ${required}`);
}

console.log('Roulette turn/countdown/smoke validation passed: pass audio is revision-keyed without a terminal knock, countdown is red and audible, and strong permanent smoke follows the lamp phase without a settings menu.');
