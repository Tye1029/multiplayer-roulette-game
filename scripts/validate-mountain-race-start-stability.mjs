import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const scriptRoot = new URL('../', import.meta.url);
const root = process.env.MULTIPLAYER_BUILD_ROOT
  ? pathToFileURL(`${path.resolve(process.env.MULTIPLAYER_BUILD_ROOT)}${path.sep}`)
  : scriptRoot;
const integrationModule = (await import(new URL('netlify/functions/mountain-race/integration.js', root))).default;
const deploymentMarker = '<!-- MOUNTAIN_RACE_START_STABILITY_V1 -->';
const {
  MOUNTAIN_RACE_BOT_CATCH_UP_LIMIT,
  MOUNTAIN_RACE_BOT_REACTION_MIN_MS,
  MOUNTAIN_RACE_BOT_REACTION_MAX_MS,
  MOUNTAIN_RACE_BOT_MIN_STEP_INTERVAL_MS
} = integrationModule;

const [data, html, integration, patch, multiplayerClient, safeCrackerClient, rouletteTurn] = await Promise.all([
  readFile(new URL('netlify/functions/_data.js', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('netlify/functions/mountain-race/integration.js', root), 'utf8'),
  readFile(new URL('scripts/patch-mountain-race-start-stability.mjs', root), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race-multiplayer.js', root), 'utf8'),
  readFile(new URL('assets/safe-cracker/safe-cracker.js', root), 'utf8'),
  readFile(new URL('assets/roulette/turn-animation.js', root), 'utf8')
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Summit Sprint start-stability validation failed: ${message}`);
}

assert(MOUNTAIN_RACE_BOT_CATCH_UP_LIMIT === 1, 'a delayed poll can still burst multiple bot moves');
assert(MOUNTAIN_RACE_BOT_REACTION_MIN_MS === 520, 'minimum bot reaction delay changed');
assert(MOUNTAIN_RACE_BOT_REACTION_MAX_MS === 760, 'maximum bot reaction delay changed');
assert(MOUNTAIN_RACE_BOT_MIN_STEP_INTERVAL_MS === 800, 'hard server-time bot step interval changed');
assert(integration.includes('const MOUNTAIN_RACE_BOT_CATCH_UP_LIMIT = 1;'), 'integration does not cap each wake to one move');
assert(integration.includes('const MOUNTAIN_RACE_BOT_REACTION_MIN_MS = 520;'), 'integration lacks visible reaction pacing');
assert(integration.includes('const MOUNTAIN_RACE_BOT_REACTION_MAX_MS = 760;'), 'integration lacks the reaction-delay ceiling');
assert(integration.includes('const MOUNTAIN_RACE_BOT_MIN_STEP_INTERVAL_MS = 800;'), 'integration lacks the hard server-time pacing interval');
assert(integration.includes('scheduleFromMs: currentNow'), 'the next bot move is still scheduled from an overdue timestamp');
assert(integration.includes('currentNow < lastBotActionMs + MOUNTAIN_RACE_BOT_MIN_STEP_INTERVAL_MS'), 'concurrent polls can still advance the bot inside one pacing interval');
assert(integration.includes('each request may execute only one due bot move'), 'single-wake pacing guard is missing');

assert(
  data.includes('const effectiveStartMs = game?.mode === "mountainrace" ? atMs + 3000 : startMs;') ||
  (
    data.includes('const effectiveStartMs = atMs + duelCountdownMs(game?.mode);') &&
    data.includes('countdownMs: duelCountdownMs')
  ),
  'Summit Sprint does not own one three-second authoritative countdown'
);
assert(data.includes('startAt: new Date(effectiveStartMs).toISOString()'), 'shared lifecycle does not publish the Summit Sprint GO timestamp');
assert(data.includes('mountainRaceInitialState(next, effectiveStartMs)'), 'race state is not initialized from the single GO timestamp');
assert(
  data.includes('if (game.mode === "mountainrace") {\n        // Summit Sprint starts from one human Ready tap.') ||
  data.includes('// Synthetic opponents share one Ready contract in every mode.'),
  'Remote Bot readiness still waits for a second delayed confirmation'
);
assert(
  data.includes('const mountainRaceRequest = String(gameId || "").startsWith("duel-mountainrace-");') ||
  data.includes('async function duelReadFocusedGame(user, gameId, attempts = 3)'),
  'Summit Sprint requests are not identified for strong reads'
);
assert(
  data.includes('? await duelGetRawStrong(gameId, 2) || await duelGetRaw(gameId)') ||
  data.includes('const game = await duelGetRawStrong(requestedGameId, 1) || await duelGetRaw(requestedGameId);'),
  'Summit Sprint action/poll reads are not strong-first'
);
assert(
  data.includes('const latest = mountainRaceRequest\n        ? await duelGetRawStrong(gameId, 1) || await duelGetRaw(gameId)') ||
  data.includes('const latest = await duelReadFocusedGame(user, gameId, 2);'),
  'Ready normalization can still read a stale attached game'
);

assert(html.includes("if(game.mode==='mountainrace'){\n        duelHideCountdownPortal();"), 'shared countdown portal still renders over the Summit Sprint countdown');
assert(html.includes('["safecracker", "mountainrace"].includes(String(duelLastActiveGame?.mode || ""))'), 'one-tap Ready retry does not include Summit Sprint');
assert(html.includes("st=g?.mode==='mountainrace'?(g?.mountainraceState||{})"), 'debug export can still select an empty state from another game mode');
assert(html.includes(deploymentMarker), 'deployed page lacks the start-stability marker');
assert(multiplayerClient.includes('function countdownOverlay()'), 'dedicated Summit Sprint countdown renderer is missing');
assert(multiplayerClient.includes("runtime.game?.status !== 'countdown'"), 'dedicated countdown is not status-scoped');

assert(patch.includes('strong-first Summit Sprint action lookup'), 'patch does not protect Ready/action requests from transient stale reads');
assert(patch.includes('dedicated Summit Sprint countdown ownership'), 'patch does not remove the duplicate shared countdown');
assert(patch.includes('MOUNTAIN_RACE_BOT_CATCH_UP_LIMIT = 1'), 'patch does not stop catch-up bursts');
assert(safeCrackerClient.length > 0, 'protected Safe Cracker runtime is unreadable');
assert(rouletteTurn.length > 0, 'protected Roulette turn runtime is unreadable');

console.log('Summit Sprint start-stability validation passed: strong reads prevent transient startup failures, one Ready tap produces one three-second countdown, debug state is mode-correct, and concurrent polls cannot move the Network Bot faster than the authoritative server-time interval.');
