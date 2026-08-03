import { readFile } from 'node:fs/promises';
import mountainRaceStateModel from '../netlify/functions/mountain-race/state-model.js';

const {
  MOUNTAIN_RACE_MODE,
  MOUNTAIN_RACE_CONTROLS,
  MOUNTAIN_RACE_DEFAULT_STEPS,
  MOUNTAIN_RACE_DURATION_MS,
  createMountainRaceState,
  applyMountainRaceInput,
  publicMountainRaceState
} = mountainRaceStateModel;

const root = new URL('../', import.meta.url);
const [readme, client, css, preview, serverReadme] = await Promise.all([
  readFile(new URL('assets/mountain-race/README.md', root), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race.js', root), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race.css', root), 'utf8'),
  readFile(new URL('mountain-race-preview.html', root), 'utf8'),
  readFile(new URL('netlify/functions/mountain-race/README.md', root), 'utf8')
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Summit Sprint prototype validation failed: ${message}`);
}

assert(MOUNTAIN_RACE_MODE === 'mountainrace', 'internal mode id changed');
assert(JSON.stringify(MOUNTAIN_RACE_CONTROLS) === JSON.stringify(['up', 'left', 'right', 'down']), 'control set changed');
assert(MOUNTAIN_RACE_DEFAULT_STEPS === 24, 'race no longer uses 24 holds');
assert(MOUNTAIN_RACE_DURATION_MS === 30_000, 'race clock is no longer 30 seconds');
assert(readme.includes('Current playable prototype'), 'front-end README does not document the prototype');
assert(readme.includes('/mountain-race-preview.html'), 'prototype route is not documented');
assert(readme.includes('not registered in the main launcher yet'), 'launcher isolation notice is missing');
assert(serverReadme.includes('not yet imported by the shared duel function'), 'server isolation notice is missing');

for (const fragment of [
  "window.MountainRaceGame = Object.freeze",
  "const MODE = 'mountainrace';",
  'const TOTAL_HOLDS = 24;',
  'const RACE_DURATION_MS = 30_000;',
  'const BOT_ERROR_RATE = 0.08;',
  'function createSequence(length = TOTAL_HOLDS)',
  "player.promptIndex = Math.max(0, player.promptIndex - 1);",
  "root.addEventListener('pointerdown'",
  "window.addEventListener('keydown'",
  'function scheduleBotMove()',
  'function beginRace()',
  'data-mr-input=',
  'data-mr-start',
  'data-mr-restart',
  "document.querySelector('[data-mountain-race-demo]')"
]) {
  assert(client.includes(fragment), `client is missing prototype fragment: ${fragment}`);
}

assert(!client.includes('safe-cracker'), 'client references Safe Cracker');
assert(!client.includes('roulette'), 'client references Roulette');
assert(css.includes('.mountain-race-game .mr-mountain-wall'), 'scrolling mountain wall styling is missing');
assert(css.includes('.mountain-race-game .mr-rock-hold.current'), 'active hold styling is missing');
assert(css.includes('.mountain-race-game .mr-climber.slip'), 'slip animation styling is missing');
assert(css.includes('.mountain-race-game .mr-direction-pad'), 'touch direction pad styling is missing');
assert(css.includes('@media (max-width: 760px)'), 'mobile layout is missing');
assert(!/(^|\n)\s*(html|body|:root|button|section|main|header)\s*[,{]/m.test(css), 'reusable CSS contains an unscoped global selector');

assert(preview.includes('data-mountain-race-demo'), 'preview mount is missing');
assert(preview.includes('/assets/mountain-race/mountain-race.css?prototype=1'), 'preview stylesheet is missing or stale');
assert(preview.includes('/assets/mountain-race/mountain-race.js?prototype=1'), 'preview runtime is missing or stale');
assert(!preview.includes('/assets/safe-cracker/'), 'preview loads Safe Cracker assets');
assert(!preview.includes('/assets/roulette/'), 'preview loads Roulette assets');

const state = createMountainRaceState({ playerIds: ['player-a', 'player-b'], now: 1_800_000_000_000, sequenceLength: 8 });
assert(state.sequence.length === 8, 'authoritative sequence length is incorrect');
assert(Object.keys(state.players).length === 2, 'authoritative state does not contain exactly two players');
assert(Date.parse(state.endAt) - Date.parse(state.startAt) === 30_000, 'authoritative race duration is incorrect');
assert(!state.sequence.some((control, index) => index >= 2 && control === state.sequence[index - 1] && control === state.sequence[index - 2]), 'sequence contains a three-control repeat');

const expected = state.sequence[0];
const accepted = applyMountainRaceInput(state, 'player-a', expected, 'action-1', 1_800_000_004_000);
assert(accepted.players['player-a'].promptIndex === 1, 'correct input did not advance the player');
assert(accepted.players['player-a'].progress === 1 / 8, 'correct input did not update elevation progress');

const wrongControl = MOUNTAIN_RACE_CONTROLS.find(control => control !== state.sequence[1]);
const slipped = applyMountainRaceInput(accepted, 'player-a', wrongControl, 'action-2', 1_800_000_004_100);
assert(slipped.players['player-a'].promptIndex === 0, 'incorrect input did not slip the player back one hold');
assert(slipped.players['player-a'].rejectedInputs === 1, 'incorrect input did not increment mistakes');

const duplicate = applyMountainRaceInput(slipped, 'player-a', state.sequence[0], 'action-2', 1_800_000_004_200);
assert(duplicate.revision === slipped.revision, 'duplicate action changed authoritative state');

const publicState = publicMountainRaceState(accepted, 'player-a');
assert(publicState.prompts.length <= 4, 'public state exposes too many future prompts');
assert(!('sequence' in publicState), 'public state exposes the full private sequence');
assert(!('expected' in (publicState.players['player-a'].lastInput || {})), 'public player state exposes the expected answer');

console.log('Summit Sprint prototype validation passed: the standalone 24-hold race has countdown, scrolling lanes, keyboard/touch input, a Normal bot, one-hold slip penalties, a 30-second clock, replay states, isolated assets, and a compatible authoritative state model.');
