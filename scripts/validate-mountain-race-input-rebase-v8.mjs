import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const [client, html, safeCrackerClient, rouletteTurn] = await Promise.all([
  readFile(new URL('assets/mountain-race/mountain-race-multiplayer.js', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('assets/safe-cracker/safe-cracker.js', root), 'utf8'),
  readFile(new URL('assets/roulette/turn-animation.js', root), 'utf8')
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Summit Sprint input-rebase validation failed: ${message}`);
}

function extractFunction(source, signature) {
  const start = source.indexOf(signature);
  if (start < 0) throw new Error(`Could not find ${signature}.`);
  const paramsStart = source.indexOf('(', start);
  let parenDepth = 0;
  let bodyStart = -1;
  let quote = '';
  let escaped = false;
  for (let index = paramsStart; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '(') parenDepth += 1;
    else if (char === ')') {
      parenDepth -= 1;
      if (parenDepth === 0) {
        bodyStart = source.indexOf('{', index + 1);
        break;
      }
    }
  }
  if (bodyStart < 0) throw new Error(`Could not parse ${signature}.`);

  let braceDepth = 0;
  quote = '';
  escaped = false;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') braceDepth += 1;
    else if (char === '}') {
      braceDepth -= 1;
      if (braceDepth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`Could not close ${signature}.`);
}

assert(client.includes('// MOUNTAIN_RACE_INPUT_REBASE_V8'), 'client marker is missing');
assert(client.includes('function authoritativeSlip('), 'authoritative slip detector is missing');
assert(client.includes('incomingOwnsRunway = ownSlip'), 'the prompt runway is not replaced after a confirmed slip');
assert(client.includes('{ allowBackward: ownSlip }'), 'the local climber still cannot move back to the authoritative hold');
assert(client.includes('function rebaseInputQueueAgainstGame('), 'queued old-height inputs are not rebased');
assert(client.includes('data-mr-displayed-expected='), 'rendered controls do not retain the displayed arrow');
assert(client.includes('data-mr-displayed-index='), 'rendered controls do not retain the displayed prompt index');
assert(client.includes('displayedRound !== currentRound'), 'a tap from an old round can still be submitted');
assert(client.includes('Math.trunc(displayedIndex) !== currentIndex'), 'a tap from an old height can still be submitted');
assert(client.includes('displayedExpected !== currentExpected'), 'a tap against an old displayed arrow can still be scored');
assert(client.includes('No mistake counted'), 'stale visual taps do not explain that they are harmless');
assert(html.includes('<!-- MOUNTAIN_RACE_INPUT_REBASE_V8 -->'), 'deployment marker is missing');
assert(html.includes('mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=8') ||
  html.includes('mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=11'), 'V8-or-newer cache boundary is missing');

const runtime = { inputQueue: [] };
const sandbox = {
  runtime,
  window: {},
  control(value) {
    const token = String(value || '').toLowerCase();
    return ['up', 'left', 'right', 'down'].includes(token) ? token : 'up';
  },
  lifecycleRank(status) {
    return { waiting: 0, ready: 1, countdown: 2, playing: 3, complete: 4 }[String(status || '')] ?? -1;
  }
};
vm.createContext(sandbox);
const functions = [
  'function inputTimestamp(',
  'function newerInput(',
  'function authoritativeSlip(',
  'function mergePlayerProgress(',
  'function mergeMountainRaceGame(',
  'function rebaseInputQueueAgainstGame('
].map(signature => extractFunction(client, signature)).join('\n');
vm.runInContext(`${functions}\nthis.api = { authoritativeSlip, mergeMountainRaceGame, rebaseInputQueueAgainstGame };`, sandbox);

const previousGame = {
  gameId: 'duel-mountainrace-test',
  mode: 'mountainrace',
  status: 'playing',
  revision: 10,
  mountainraceState: {
    roundId: 'round-a',
    revision: 8,
    secondsLeft: 20,
    prompts: ['left', 'down', 'right'],
    inputPrompts: ['left', 'down', 'right'],
    me: {
      promptIndex: 2,
      acceptedInputs: 2,
      rejectedInputs: 0,
      progress: 2 / 24,
      lastInput: { control: 'up', correct: true, at: '2026-08-05T11:04:24.000Z' }
    },
    opponent: { promptIndex: 5, acceptedInputs: 5, rejectedInputs: 0, progress: 5 / 24, lastInput: null }
  }
};
const slippedGame = {
  ...previousGame,
  revision: 11,
  mountainraceState: {
    ...previousGame.mountainraceState,
    revision: 9,
    prompts: ['up', 'left', 'down', 'down'],
    inputPrompts: ['up', 'left', 'down', 'down'],
    me: {
      promptIndex: 1,
      acceptedInputs: 2,
      rejectedInputs: 1,
      progress: 1 / 24,
      lastInput: { control: 'down', correct: false, at: '2026-08-05T11:04:25.229Z' }
    }
  }
};
const mergedSlip = sandbox.api.mergeMountainRaceGame(previousGame, slippedGame);
assert(mergedSlip.mountainraceState.me.promptIndex === 1, 'a confirmed wrong input still leaves the client one hold too high');
assert(mergedSlip.mountainraceState.prompts[0] === 'up', 'the post-slip highlighted arrow is still from the old height');
assert(mergedSlip.mountainraceState.me.lastInput.correct === false, 'the confirmed slip input is not adopted');

const staleRegression = {
  ...slippedGame,
  revision: 9,
  mountainraceState: {
    ...slippedGame.mountainraceState,
    revision: 7,
    me: {
      ...slippedGame.mountainraceState.me,
      lastInput: { control: 'down', correct: false, at: '2026-08-05T11:04:23.000Z' }
    }
  }
};
const rejectedRegression = sandbox.api.mergeMountainRaceGame(previousGame, staleRegression);
assert(rejectedRegression.mountainraceState.me.promptIndex === 2, 'an older snapshot can still pull the climber backward');

runtime.inputQueue = [
  { roundId: 'round-a', fromIndex: 2, expected: 'left', token: 'left', order: 1, status: 'queued' },
  { roundId: 'round-a', fromIndex: 3, expected: 'down', token: 'down', order: 2, status: 'queued' }
];
const dropped = sandbox.api.rebaseInputQueueAgainstGame(slippedGame);
assert(dropped === 2, 'queued moves from the pre-slip height were not discarded');
assert(runtime.inputQueue.length === 0, 'old-height queued moves remain able to trigger repeated sync pauses');

runtime.inputQueue = [
  { roundId: 'round-a', fromIndex: 1, expected: 'up', token: 'up', order: 1, status: 'queued' },
  { roundId: 'round-a', fromIndex: 2, expected: 'left', token: 'left', order: 2, status: 'queued' }
];
const kept = sandbox.api.rebaseInputQueueAgainstGame(slippedGame);
assert(kept === 0, 'valid queued moves were incorrectly discarded');
assert(runtime.inputQueue.length === 2, 'valid post-slip queued moves were not retained');

assert(safeCrackerClient.length > 0, 'protected Safe Cracker runtime is unreadable');
assert(rouletteTurn.length > 0, 'protected Roulette runtime is unreadable');

console.log('Summit Sprint Input Rebase V8 validation passed: confirmed slips restore the real hold and arrow, stale regressions remain blocked, old-height queues are discarded once, valid queues continue, and taps are bound to the exact prompt rendered on screen.');
