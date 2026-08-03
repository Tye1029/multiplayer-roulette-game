import { readFile } from 'node:fs/promises';
import mountainRaceStateModel from '../netlify/functions/mountain-race/state-model.js';

const {
  MOUNTAIN_RACE_MODE,
  MOUNTAIN_RACE_CONTROLS,
  createMountainRaceState,
  applyMountainRaceInput,
  publicMountainRaceState
} = mountainRaceStateModel;

const root = new URL('../', import.meta.url);
const [readme, client, css, serverReadme] = await Promise.all([
  readFile(new URL('assets/mountain-race/README.md', root), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race.js', root), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race.css', root), 'utf8'),
  readFile(new URL('netlify/functions/mountain-race/README.md', root), 'utf8')
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Summit Sprint scaffold validation failed: ${message}`);
}

assert(MOUNTAIN_RACE_MODE === 'mountainrace', 'internal mode id changed');
assert(JSON.stringify(MOUNTAIN_RACE_CONTROLS) === JSON.stringify(['up', 'left', 'right', 'down']), 'control set changed');
assert(readme.includes('Summit Sprint'), 'front-end README is missing the original game name');
assert(readme.includes('not registered in the launcher yet'), 'launcher isolation notice is missing');
assert(serverReadme.includes('not yet imported by the shared duel function'), 'server isolation notice is missing');
assert(client.includes("window.MountainRaceGame = Object.freeze"), 'isolated client namespace is missing');
assert(client.includes("const MODE = 'mountainrace';"), 'client mode id is missing');
assert(client.includes("CustomEvent('mountainrace:input'"), 'isolated input event is missing');
assert(!client.includes('safe-cracker'), 'client references Safe Cracker');
assert(!client.includes('roulette'), 'client references Roulette');
assert(css.includes('.mountain-race-game'), 'CSS root namespace is missing');
assert(!/(^|\n)\s*(html|body|:root|button|section|main|header)\s*[,{]/m.test(css), 'CSS contains an unscoped global selector');

const state = createMountainRaceState({ playerIds: ['player-a', 'player-b'], now: 1_800_000_000_000, sequenceLength: 8 });
assert(state.sequence.length === 8, 'authoritative sequence length is incorrect');
assert(Object.keys(state.players).length === 2, 'authoritative state does not contain exactly two players');

const expected = state.sequence[0];
const accepted = applyMountainRaceInput(state, 'player-a', expected, 'action-1', 1_800_000_004_000);
assert(accepted.players['player-a'].promptIndex === 1, 'correct input did not advance the player');
assert(accepted.players['player-a'].progress === 1 / 8, 'correct input did not update elevation progress');

const duplicate = applyMountainRaceInput(accepted, 'player-a', expected, 'action-1', 1_800_000_004_100);
assert(duplicate.revision === accepted.revision, 'duplicate action changed authoritative state');

const publicState = publicMountainRaceState(accepted, 'player-a');
assert(publicState.prompts.length <= 4, 'public state exposes too many future prompts');
assert(!('sequence' in publicState), 'public state exposes the full private sequence');
assert(!('expected' in (publicState.players['player-a'].lastInput || {})), 'public player state exposes the expected answer');

console.log('Summit Sprint scaffold validation passed: folders are isolated, CSS and client code are namespaced, authoritative state accepts ordered inputs, duplicates are idempotent, and private future prompts remain hidden.');
