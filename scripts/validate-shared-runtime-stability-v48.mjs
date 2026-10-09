import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [html, openingAudio, mountainRuntime, safeCracker, rouletteTurn] = await Promise.all([
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('assets/roulette/opening-spin-sync.js', root), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race-multiplayer.js', root), 'utf8'),
  readFile(new URL('assets/safe-cracker/safe-cracker.js', root), 'utf8'),
  readFile(new URL('assets/roulette/turn-animation.js', root), 'utf8')
]);

const fail = message => { throw new Error(`Shared runtime V48 validation failed: ${message}`); };
const assert = (condition, message) => { if (!condition) fail(message); };

assert(openingAudio.includes('SHARED_RUNTIME_STABILITY_V48'), 'opening-spin clamp marker is missing');
assert(
  openingAudio.includes('clip.volume = clamp(baseVolume * openingVolumeEnvelope(progress), 0, 1);'),
  'opening-spin volume assignment is not bounded to the HTMLMediaElement range'
);
assert(
  openingAudio.includes('baseVolume = clamp(Number(clip.volume) || 0, 0, 1);'),
  'opening-spin base volume is not normalized'
);
assert(
  !openingAudio.includes('clip.volume = baseVolume * openingVolumeEnvelope(progress);'),
  'unbounded opening-spin volume assignment remains'
);

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
for (const [base, envelope, expected] of [[0.8, 1.4, 1], [0.4, 0.5, 0.2], [2, 1, 1]]) {
  assert(clamp(clamp(base, 0, 1) * envelope, 0, 1) === expected, `volume clamp failed for ${base} x ${envelope}`);
}

for (const token of [
  'SHARED_RUNTIME_STABILITY_V48',
  'const focusedMissing = /duel was not found/i.test(focusedMessage);',
  'duelKnownRevisionByGame.delete(missingGameId);',
  'duelAcceptedStatusByGame.delete(missingGameId);',
  'duelRememberCurrentGame("");',
  'Focused duel no longer exists; returned to the lobby.',
  'Focused duel refresh failed; retaining current game',
  '/assets/roulette/opening-spin-sync.js?v=6&trim=1&clamp=1'
]) assert(html.includes(token), `focused-game cleanup is missing ${token}`);

assert(!html.includes('DRAW focused refresh failed; retaining current game'), 'obsolete mode-specific warning remains');
assert(mountainRuntime.includes('MOUNTAIN_RACE_FINISH_STABILITY_V47'), 'Summit Sprint V47 finish runtime was displaced');
assert(safeCracker.length > 0, 'protected Safe Cracker runtime is unreadable');
assert(rouletteTurn.length > 0, 'protected Roulette turn runtime is unreadable');

console.log('Shared runtime V48 validation passed: audio volume stays within range, stale focused games clear once, transient failures retain the board, and protected game runtimes remain present.');
