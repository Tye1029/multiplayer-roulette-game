import { readFile, writeFile } from 'node:fs/promises';

const lampUrl = new URL('./validate-lamp.mjs', import.meta.url);
const turnUrl = new URL('./validate-roulette-countdown-white-audio.mjs', import.meta.url);
const openingUrl = new URL('./validate-opening-spin-sync.mjs', import.meta.url);

let [lamp, turn, opening] = await Promise.all([
  readFile(lampUrl, 'utf8'),
  readFile(turnUrl, 'utf8'),
  readFile(openingUrl, 'utf8')
]);

function replaceAll(source, before, after) {
  return source.includes(before) ? source.split(before).join(after) : source;
}

for (const [before, after] of [
  ['/assets/roulette/spin-audio-policy.js?v=3', '/assets/roulette/spin-audio-policy.js?v=4'],
  ['/assets/roulette/audio-bindings.js?v=5', '/assets/roulette/audio-bindings.js?v=6'],
  ['const key = `${gameId}:${fromTurnId}:${turnId}:${epoch}`', 'const key = rotationToken || `${gameId}:${fromTurnId}:${turnId}:${epoch}`'],
  ['volume: 0.044', 'volume: 0.048'],
  ['start: 0.12', 'start: 0'],
  ['duration: 0.62', 'duration: 0.72'],
  ['fadeOut: 0.30', 'fadeOut: 0.26'],
  ['function startTurnMovementSound()', "function startTurnMovementSound(trigger = 'animation-boundary')"]
]) lamp = replaceAll(lamp, before, after);

if (!lamp.includes("'turnMovement: true',")) {
  lamp = lamp.replace(
    "  'fadeOut: 0.26',\n  'global.RouletteAudio = Object.freeze({',",
    "  'fadeOut: 0.26',\n  'turnMovement: true',\n  'if (options.turnMovement === true) clip.__rrAuthorizedTurnMove = true;',\n  'global.RouletteAudio = Object.freeze({',"
  );
}
if (!lamp.includes("\"startTurnMovementSound('approved-transition')\",")) {
  lamp = lamp.replace(
    "  'global.RouletteAudio?.turnRotate?.({',",
    "  'global.RouletteAudio?.turnRotate?.({',\n  \"startTurnMovementSound('approved-transition')\",\n  \"recordDiagnostic('sound-started'\","
  );
}
if (!lamp.includes("'this.__rrAuthorizedTurnMove !== true',")) {
  lamp = lamp.replace(
    "  'OPENING_BLOCKED_SOURCES.some(file => src.includes(file))',",
    "  'this.__rrAuthorizedTurnMove !== true',\n  'OPENING_BLOCKED_SOURCES.some(file => src.includes(file))',"
  );
}

for (const [before, after] of [
  ['/assets/roulette/spin-audio-policy.js?v=3&turnsound=3', '/assets/roulette/spin-audio-policy.js?v=4&turnsound=4&reliable=1'],
  ['/assets/roulette/turn-facing-guard.js?v=3&lock=5&owner=3&opening=1', '/assets/roulette/turn-facing-guard.js?v=4&lock=5&owner=3&opening=1&sound=1'],
  ['const key = `${gameId}:${fromTurnId}:${turnId}:${epoch}`', 'const key = rotationToken || `${gameId}:${fromTurnId}:${turnId}:${epoch}`'],
  ['volume: 0.044', 'volume: 0.048'],
  ['start: 0.12', 'start: 0'],
  ['duration: 0.62', 'duration: 0.72'],
  ['fadeOut: 0.30', 'fadeOut: 0.26']
]) turn = replaceAll(turn, before, after);

if (!turn.includes("'turnMovement: true',")) {
  turn = turn.replace(
    "  'fadeOut: 0.26',\n  'function playTurnMovement(details = {})',",
    "  'fadeOut: 0.26',\n  'turnMovement: true',\n  'if (options.turnMovement === true) clip.__rrAuthorizedTurnMove = true;',\n  'function playTurnMovement(details = {})',"
  );
}
if (!turn.includes("\"startTurnMovementSound('approved-transition')\",")) {
  turn = turn.replace(
    "  \"recordDiagnostic('approved', transition)\",",
    "  \"recordDiagnostic('approved', transition)\",\n  \"startTurnMovementSound('approved-transition')\",\n  \"recordDiagnostic('sound-started'\","
  );
}

for (const [before, after] of [
  ['const RAPID_FADE_END_PROGRESS = 0.53', 'const RAPID_FADE_END_PROGRESS = 0.50'],
  ['const SILENT_PROGRESS = 0.74', 'const SILENT_PROGRESS = 0.646'],
  ['<script src="/assets/roulette/opening-spin-sync.js?v=4" defer></script>', '<script src="/assets/roulette/opening-spin-sync.js?v=5&trim=1" defer></script>'],
  ['<script src="/assets/roulette/audio-bindings.js?v=5" defer></script>', '<script src="/assets/roulette/audio-bindings.js?v=6&turnmove=1" defer></script>'],
  ['fades slightly earlier through the slowdown, and becomes silent before the final settle.', 'ends about half a second earlier through the slowdown while the 5.3-second visual animation remains unchanged.']
]) opening = replaceAll(opening, before, after);

if (!opening.includes("'const SETTLE_FADE_END_PROGRESS = 0.58',")) {
  opening = opening.replace(
    "  'const RAPID_FADE_LEVEL = 0.08',",
    "  'const RAPID_FADE_LEVEL = 0.08',\n  'const SETTLE_FADE_END_PROGRESS = 0.58',"
  );
}

for (const required of [
  '/assets/roulette/spin-audio-policy.js?v=4',
  '/assets/roulette/audio-bindings.js?v=6',
  'const key = rotationToken || `${gameId}:${fromTurnId}:${turnId}:${epoch}`',
  'turnMovement: true',
  "startTurnMovementSound('approved-transition')",
  'this.__rrAuthorizedTurnMove !== true'
]) if (!lamp.includes(required)) throw new Error(`Lamp audio validation update is missing ${required}`);

for (const required of [
  '/assets/roulette/spin-audio-policy.js?v=4&turnsound=4&reliable=1',
  '/assets/roulette/turn-facing-guard.js?v=4&lock=5&owner=3&opening=1&sound=1',
  'turnMovement: true',
  "startTurnMovementSound('approved-transition')"
]) if (!turn.includes(required)) throw new Error(`Turn audio validation update is missing ${required}`);

for (const required of [
  'const RAPID_FADE_END_PROGRESS = 0.50',
  'const SETTLE_FADE_END_PROGRESS = 0.58',
  'const SILENT_PROGRESS = 0.646',
  '/assets/roulette/opening-spin-sync.js?v=5&trim=1',
  '/assets/roulette/audio-bindings.js?v=6&turnmove=1'
]) if (!opening.includes(required)) throw new Error(`Opening audio validation update is missing ${required}`);

await Promise.all([
  writeFile(lampUrl, lamp),
  writeFile(turnUrl, turn),
  writeFile(openingUrl, opening)
]);
console.log('Updated audio validators for direct approved-transition sound, opening-window authorization, and the half-second opening trim.');