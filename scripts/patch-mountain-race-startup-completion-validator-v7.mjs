import { readFile, writeFile } from 'node:fs/promises';

const stateSyncValidatorUrl = new URL('validate-mountain-race-state-sync.mjs', import.meta.url);
const startValidatorUrl = new URL('validate-mountain-race-start-stability.mjs', import.meta.url);
const loadValidatorUrl = new URL('validate-mountain-race-load-performance.mjs', import.meta.url);

let stateSource = await readFile(stateSyncValidatorUrl, 'utf8');
stateSource = stateSource.replaceAll(
  'mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=6',
  'mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=7'
);

const previousConsole = "console.log('Summit Sprint continuous-sync validation passed: the remaining private route feeds uninterrupted local input, eight moves share each authoritative save, due opponent movement is folded and confirmed with player movement, both climbers merge forward independently, and only true cross-round regressions are rejected.');";
const v7Assertions = `assert(integration.includes('// MOUNTAIN_RACE_STARTUP_COMPLETION_V7'), 'server startup/completion marker is missing');
assert(integration.includes('secondsLeft: complete || state.completedAt'), 'completed server clock does not freeze at zero');
assert(client.includes('// MOUNTAIN_RACE_STARTUP_COMPLETION_V7'), 'client startup/completion marker is missing');
assert(client.includes("runtime.game?.status === 'complete' || publicState.completedAt"), 'completed client clock does not freeze at zero');
assert(client.includes('window.__mountainRacePauseCompletedPolling?.(mergedGame)'), 'completed Remote Bot polling hook is missing');
assert(html.includes('<!-- MOUNTAIN_RACE_STARTUP_COMPLETION_V7 -->'), 'startup/completion deployment marker is missing');
assert(html.includes("const probe = await duelRequest('get', { gameId: id, knownRevision: '' }"), 'Ready does not wait for a stable two-climber snapshot');
assert(html.includes('async function duelSafeCrackerReadyRequest(gameId)'), 'active shared Ready helper is missing');
assert(html.includes('function mountainRacePauseCompletedPolling(game)'), 'completed Remote Bot focused-poll gate is missing');
assert(html.includes("String(game?.mode || '') !== 'mountainrace'"), 'completed poll gate is not isolated to Summit Sprint');
assert(html.includes("!game?.remoteNetworkTest"), 'human rematch polling is not preserved');`;

if (!stateSource.includes(v7Assertions)) {
  if (!stateSource.includes(previousConsole)) throw new Error('Summit Sprint V7 validator could not find the V6 completion assertion.');
  stateSource = stateSource.replace(
    previousConsole,
    `${v7Assertions}\n\nconsole.log('Summit Sprint startup/completion validation passed: the active shared Ready helper probes the stable two-climber game before acting, completed clocks are zero, completed Remote Bot focused polling stops, human rematch polling remains available, continuous input and opponent synchronization remain intact.');`
  );
}

if (!stateSource.includes('secondsLeft: complete || state.completedAt')) throw new Error('Summit Sprint V7 validator does not require a zero completed clock.');
if (!stateSource.includes("const probe = await duelRequest('get', { gameId: id, knownRevision: '' }")) throw new Error('Summit Sprint V7 validator does not require the stable Ready probe.');
if (!stateSource.includes('function mountainRacePauseCompletedPolling(game)')) throw new Error('Summit Sprint V7 validator does not require completed Remote Bot poll suspension.');
if (!stateSource.includes('mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=7')) throw new Error('Summit Sprint V7 validator does not require the new cache boundary.');
await writeFile(stateSyncValidatorUrl, stateSource);

let startSource = await readFile(startValidatorUrl, 'utf8');
const startAnchor = `assert(html.includes('["safecracker", "mountainrace"].includes(String(duelLastActiveGame?.mode || ""))'), 'one-tap Ready retry does not include Summit Sprint');`;
const startAdditions = `${startAnchor}
assert(html.includes('async function duelSafeCrackerReadyRequest(gameId)'), 'active shared Ready retry helper is missing');
assert(html.includes("const probe = await duelRequest('get', { gameId: id, knownRevision: '' }"), 'Summit Sprint Ready can still send transient act requests before the game is strongly visible');
assert(html.includes('stable?.creator?.userId && stable?.joiner?.userId'), 'Summit Sprint Ready does not verify both climbers before acting');`;
if (!startSource.includes(startAdditions)) {
  if (!startSource.includes(startAnchor)) throw new Error('Summit Sprint V7 start validator could not find its stable-mode assertion.');
  startSource = startSource.replace(startAnchor, startAdditions);
}
await writeFile(startValidatorUrl, startSource);

let loadSource = await readFile(loadValidatorUrl, 'utf8');
const loadAnchor = "assert(!html.includes('new MutationObserver(renameNetworkBotLog)'), 'the Network Bot Log still watches every DOM mutation');";
const loadAdditions = `${loadAnchor}
assert(html.includes('function mountainRacePauseCompletedPolling(game)'), 'completed Remote Bot races continue focused GET polling');
assert(html.includes('window.__duelPollRate = 0;'), 'completed Remote Bot polling does not release the focused timer');`;
if (!loadSource.includes(loadAdditions)) {
  if (!loadSource.includes(loadAnchor)) throw new Error('Summit Sprint V7 load validator could not find its observer assertion.');
  loadSource = loadSource.replace(loadAnchor, loadAdditions);
}
await writeFile(loadValidatorUrl, loadSource);

console.log('Updated Summit Sprint validators for the active shared Ready probe, zero completed clocks, and completed Remote Bot polling suspension.');
