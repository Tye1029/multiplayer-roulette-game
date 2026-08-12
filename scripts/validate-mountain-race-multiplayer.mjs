import { readFile } from 'node:fs/promises';
import stateModelModule from '../netlify/functions/mountain-race/state-model.js';
import integrationModule from '../netlify/functions/mountain-race/integration.js';

const {
  MOUNTAIN_RACE_DEFAULT_STEPS,
  MOUNTAIN_RACE_DURATION_MS,
  MOUNTAIN_RACE_COUNTDOWN_MS,
  MOUNTAIN_RACE_CONTROLS
} = stateModelModule;
const {
  MOUNTAIN_RACE_BOT_ERROR_RATE,
  MOUNTAIN_RACE_BOT_CATCH_UP_LIMIT,
  createMountainRaceIntegration
} = integrationModule;
const root = new URL('../', import.meta.url);

const [
  html,
  data,
  client,
  prototypeClient,
  css,
  patch,
  integrationSource,
  duelActionSource,
  safeCrackerClient,
  safeCrackerCss,
  rouletteTurn,
  rouletteFire,
  rouletteAudio
] = await Promise.all([
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('netlify/functions/_data.js', root), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race-multiplayer.js', root), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race.js', root), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race.css', root), 'utf8'),
  readFile(new URL('scripts/patch-mountain-race-multiplayer.mjs', root), 'utf8'),
  readFile(new URL('netlify/functions/mountain-race/integration.js', root), 'utf8'),
  readFile(new URL('netlify/functions/duel-action.js', root), 'utf8'),
  readFile(new URL('assets/safe-cracker/safe-cracker.js', root)),
  readFile(new URL('assets/safe-cracker/safe-cracker.css', root)),
  readFile(new URL('assets/roulette/turn-animation.js', root)),
  readFile(new URL('assets/roulette/turn-fire.js', root)),
  readFile(new URL('assets/roulette/audio-bindings.js', root))
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Summit Sprint multiplayer validation failed: ${message}`);
}

function occurrences(source, fragment) {
  return source.split(fragment).length - 1;
}

assert(MOUNTAIN_RACE_DEFAULT_STEPS === 24, 'authoritative course length changed');
assert(MOUNTAIN_RACE_DURATION_MS === 30_000, 'authoritative race duration changed');
assert(MOUNTAIN_RACE_COUNTDOWN_MS === 3_000, 'authoritative countdown duration changed');
assert(MOUNTAIN_RACE_BOT_ERROR_RATE === 0.08, 'testing bot error rate changed');
assert(MOUNTAIN_RACE_BOT_CATCH_UP_LIMIT === 1, 'testing bot must execute at most one move per server wake');
assert(JSON.stringify(MOUNTAIN_RACE_CONTROLS) === JSON.stringify(['up', 'left', 'right', 'down']), 'control set changed');

for (const fragment of [
  'MOUNTAIN_RACE_SERVER_START',
  'createMountainRaceIntegration',
  'MODE_NAMES: DUEL_MODES',
  'mountainraceState:',
  'mountainRaceInitialState(next, startMs)',
  'mountainRacePublicState(clean, viewer)',
  'mountainRaceAdvanceAndSave(latest)',
  'mountainRaceAction(actorUser, gameId, rawChoice, details)',
  '"mountainrace"',
  'Mountain Bot'
]) assert(data.includes(fragment), `generated server is missing: ${fragment}`);
assert(occurrences(data, '// MOUNTAIN_RACE_SERVER_START') === 1, 'server integration block must appear exactly once');
assert(occurrences(data, '// MOUNTAIN_RACE_SERVER_END') === 1, 'server integration end marker must appear exactly once');

for (const fragment of [
  'data-mode="mountainrace"',
  '>Summit Sprint</button>',
  'data-rnb-game="mountainrace"',
  'data-mountain-race-mount',
  'mountain-race-multiplayer.js?v=1',
  'mountain-race.css?v=3&multiplayer=1',
  'window.__mountainRaceBridge',
  'new CustomEvent("mountainrace:state"',
  "option.value = 'mountainrace'"
]) assert(html.includes(fragment), `generated multiplayer page is missing: ${fragment}`);
assert(occurrences(html, '<button class="sth-game" data-mode="mountainrace"') === 1, 'launcher should contain one Summit Sprint button');
assert(occurrences(html, '<button data-rnb-game="mountainrace"') === 1, 'Remote Bot panel should contain one Summit Sprint button');

for (const fragment of [
  "const MODE = 'mountainrace'",
  "const STATE_EVENT = 'mountainrace:state'",
  "choice: 'mountainrace:batch'",
  'window.__mountainRaceBridge',
  'data-mr-network-input',
  'data-mr-rematch',
  'data-mr-new-game',
  'ArrowUp',
  'pointerdown'
]) assert(client.includes(fragment), `multiplayer client is missing: ${fragment}`);
assert(!client.includes('createPrototypeState'), 'multiplayer runtime accidentally owns a local course');
assert(prototypeClient.includes('createPrototypeState'), 'standalone prototype was removed');
assert(css.includes('.mountain-race-game .mr-mountain-wall'), 'mountain presentation is missing');
assert(css.includes('.mountain-race-game .mr-climber.slip'), 'slip animation is missing');

for (const fragment of [
  'const MOUNTAIN_RACE_BOT_CATCH_UP_LIMIT = 1;',
  'function createMountainRaceIntegration(host = {})',
  'async function applyActionUnlocked(user, game, rawChoice, details = {}, options = {})',
  'async function action(user, gameId, rawChoice, details = {})',
  'async function advance(game)',
  'const match = /^mountainrace:input:(up|left|right|down)$/',
  'expectedPromptIndex !== actualPromptIndex',
  'processedActionIds.includes(actionId)',
  'processed < MOUNTAIN_RACE_BOT_CATCH_UP_LIMIT',
  'mountainrace:input:${token}',
  'replayedAction: true',
  "ignoreReason: 'prompt-changed'",
  'return await resolveTimeout'
]) assert(integrationSource.includes(fragment), `integration service is missing: ${fragment}`);
assert(!patch.includes("writeFile(new URL('../assets/roulette/"), 'mountain patch writes Roulette assets');
assert(!patch.includes("writeFile(new URL('../assets/safe-cracker/"), 'mountain patch writes Safe Cracker assets');
assert(duelActionSource.includes('expectedPromptIndex: body.expectedPromptIndex'), 'shared action route drops the expected Summit prompt index');
assert(duelActionSource.includes('expectedControl: body.expectedControl'), 'shared action route drops the expected Summit control');
assert(duelActionSource.includes('inputBatch: body.inputBatch'), 'shared action route drops queued Summit Sprint inputs');
assert(duelActionSource.includes('X-Summit-Input-Route-Build'), 'deployed Summit input-route marker is missing');
assert(safeCrackerClient.length > 0 && safeCrackerCss.length > 0, 'protected Safe Cracker assets are unreadable');
assert(rouletteTurn.length > 0 && rouletteFire.length > 0 && rouletteAudio.length > 0, 'protected Roulette assets are unreadable');

const games = new Map();
const clone = value => structuredClone(value);
const cleanUserId = value => String(value || '').trim().replace(/[^A-Za-z0-9._:-]/g, '').slice(0, 120);
const int = (value, fallback = 0) => {
  const number = Number(value);
  return Math.max(0, Math.floor(Number.isFinite(number) ? number : fallback));
};
const mpCleanId = value => String(value || '').trim().replace(/[^A-Za-z0-9._:-]/g, '').slice(0, 160);
const saveGame = async game => {
  games.set(game.gameId, clone(game));
  return clone(game);
};
const getRaw = async gameId => games.has(gameId) ? clone(games.get(gameId)) : null;
const completeResolved = async (game, result) => {
  const complete = { ...game, status: 'complete', result, revision: int(game.revision, 0) + 1 };
  games.set(complete.gameId, clone(complete));
  return clone(complete);
};
const publicGame = game => clone(game);
const getUserRecord = async userId => ({ userId, balanceTickets: 100_000 });

const integration = createMountainRaceIntegration({
  cleanUserId,
  int,
  mpCleanId,
  getRaw,
  getRawStrong: getRaw,
  saveGame,
  publicGame,
  completeResolved,
  getUserRecord
});

const now = Date.now();
let game = {
  gameId: 'mountain-validator-race',
  mode: 'mountainrace',
  status: 'playing',
  revision: 1,
  startAt: new Date(now).toISOString(),
  creator: { userId: 'player-a', name: 'Player A' },
  joiner: { userId: 'player-b', name: 'Player B' }
};
game.mountainraceState = integration.initialState(game, now);
await saveGame(game);
assert(integration.hasValidState(game), 'new authoritative state is invalid');
const firstPublic = integration.publicState(game, 'player-a');
assert(firstPublic.stepsTotal === 24, 'public state does not report 24 holds');
assert(firstPublic.prompts.length === 4, 'viewer does not receive exactly four upcoming prompts');
assert(!('sequence' in firstPublic), 'public state exposes the full course');
assert(firstPublic.opponent.name === 'Player B', 'opponent profile was not resolved');

const firstExpected = game.mountainraceState.sequence[0];
let response = await integration.action(
  { id: 'player-a' },
  game.gameId,
  `mountainrace:input:${firstExpected}`,
  { actionId: 'correct-1', expectedPromptIndex: 0 }
);
game = response.game;
assert(game.mountainraceState.players['player-a'].promptIndex === 1, 'correct move did not climb one hold');
assert(response.skipBalanceLookup === true, 'active move performs an unnecessary balance refresh');

game = await getRaw(game.gameId);
const batchStartIndex = game.mountainraceState.players['player-a'].promptIndex;
const batchControls = game.mountainraceState.sequence.slice(batchStartIndex, batchStartIndex + 2);
response = await integration.action(
  { id: 'player-a' },
  game.gameId,
  'mountainrace:batch',
  {
    inputBatch: batchControls.map((control, offset) => ({
      control,
      expectedControl: control,
      expectedPromptIndex: batchStartIndex + offset,
      actionId: `batch-${offset + 1}`
    }))
  }
);
game = response.game;
assert(response.batchAccepted === true, 'queued direction batch was not accepted');
assert(response.confirmedActionIds.length === 2, 'queued direction batch was not fully confirmed');
assert(game.mountainraceState.players['player-a'].promptIndex === batchStartIndex + 2, 'queued direction batch did not advance both holds');

const revisionBeforeStale = game.mountainraceState.revision;
response = await integration.action(
  { id: 'player-a' },
  game.gameId,
  `mountainrace:input:${game.mountainraceState.sequence[batchStartIndex + 2]}`,
  { actionId: 'stale-prompt-1', expectedPromptIndex: batchStartIndex }
);
assert(response.ignoredAction === true && response.ignoreReason === 'prompt-changed', 'stale prompt request was not rejected');
assert(response.game.mountainraceState.revision === revisionBeforeStale, 'stale prompt request changed authoritative state');

game = await getRaw(game.gameId);
const nextExpected = game.mountainraceState.sequence[batchStartIndex + 2];
const wrongControl = MOUNTAIN_RACE_CONTROLS.find(token => token !== nextExpected);
response = await integration.action(
  { id: 'player-a' },
  game.gameId,
  `mountainrace:input:${wrongControl}`,
  { actionId: 'wrong-1', expectedPromptIndex: batchStartIndex + 2 }
);
game = response.game;
assert(game.mountainraceState.players['player-a'].promptIndex === batchStartIndex + 1, 'wrong move did not slip back one hold');
assert(game.mountainraceState.players['player-a'].rejectedInputs === 1, 'wrong move was not counted');

const revisionBeforeDuplicate = game.mountainraceState.revision;
response = await integration.action(
  { id: 'player-a' },
  game.gameId,
  `mountainrace:input:${wrongControl}`,
  { actionId: 'wrong-1', expectedPromptIndex: batchStartIndex + 2 }
);
assert(response.replayedAction === true, 'duplicate action was not identified');
assert(response.game.mountainraceState.revision === revisionBeforeDuplicate, 'duplicate action changed authoritative state');

const originalRandom = Math.random;
try {
  // A fixed value keeps the bot accurate and its 120 ms network cadence stable.
  // Each wake may process only one move; an old start timestamp makes the first
  // due move deterministic without permitting a catch-up burst.
  Math.random = () => 0.5;
  const botStart = Date.now() - 8_000;
  let botGame = {
    gameId: 'mountain-validator-remote-bot',
    mode: 'mountainrace',
    status: 'playing',
    revision: 1,
    startAt: new Date(botStart).toISOString(),
    creator: { userId: 'player-a', name: 'Player A' },
    joiner: {
      userId: 'remote-bot-mountain-test',
      name: 'Remote Mountain Bot',
      isNpc: true,
      isRemoteBot: true
    },
    remoteNetworkConfig: {
      minDelayMs: 120,
      maxDelayMs: 120,
      stallChance: 0,
      duplicateChance: 1,
      reconnectChance: 0
    }
  };
  botGame.mountainraceState = integration.initialState(botGame, botStart);
  await saveGame(botGame);

  botGame = await integration.advance(botGame);
  const firstWake = botGame.mountainraceState.players['remote-bot-mountain-test'];
  const firstWakeMoves = firstWake.acceptedInputs + firstWake.rejectedInputs;
  assert(firstWakeMoves === 1, 'one poll advanced the bot more than once');
  assert(firstWakeMoves <= MOUNTAIN_RACE_BOT_CATCH_UP_LIMIT, 'one poll exceeded the bounded catch-up limit');
  assert(botGame.mountainraceState.botActionSequence === firstWakeMoves, 'bot action sequence does not match accepted requests');
  assert(botGame.mountainraceState.processedActionIds.length === firstWakeMoves, 'duplicate network retries moved the bot twice');

  assert(botGame.status === 'playing', 'one bot wake unexpectedly completed the race');
  assert(firstWake.promptIndex === 1, 'the Remote Network Bot did not climb exactly one hold');
} finally {
  Math.random = originalRandom;
}

console.log('Summit Sprint multiplayer validation passed: the launcher, create/join flow, authoritative 24-hold race, wrong-input slip, private prompt queue, stale and duplicate protection, full Remote Network Bot catch-up and completion, rematches, and protected existing games are intact.');
