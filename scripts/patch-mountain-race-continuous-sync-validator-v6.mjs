import { readFile, writeFile } from 'node:fs/promises';

const stateSyncValidatorUrl = new URL('validate-mountain-race-state-sync.mjs', import.meta.url);
const gameplayValidatorUrl = new URL('validate-mountain-race-gameplay-visibility.mjs', import.meta.url);

let stateSource = await readFile(stateSyncValidatorUrl, 'utf8');
stateSource = stateSource
  .replace(
    "assert(client.includes('if (data?.wakeBot) scheduleBotWake();'), 'queued action responses do not schedule the focused Network Bot wake');",
    "assert(integration.includes('async function foldDueBotActions('), 'queued action responses do not fold due opponent progress into the same save');"
  )
  .replaceAll(
    'mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=5',
    'mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=6'
  );

const previousConsole = "console.log('Summit Sprint instant-input validation passed: visible arrows advance immediately, rapid taps queue without a per-button network lock, up to four exact prompt actions share one strongly confirmed save, stale queued prompts remain harmless, the bot wake stays deferred, and protected games remain intact.');";
const continuousAssertions = `assert(integration.includes('// MOUNTAIN_RACE_CONTINUOUS_SYNC_V6'), 'server continuous-sync marker is missing');
assert(integration.includes('inputPrompts: state.sequence.slice'), 'server does not provide the remaining private input runway');
assert(integration.includes('details.inputBatch.slice(0, 8)'), 'server does not accept eight queued moves per save');
assert(integration.includes('async function foldDueBotActions('), 'server does not fold due opponent movement into the player batch');
assert(integration.includes('const persistenceIds = [...targetActionIds, ...botActionIds]'), 'server does not strongly confirm player and opponent movement together');
assert(client.includes('// MOUNTAIN_RACE_CONTINUOUS_SYNC_V6'), 'client continuous-sync marker is missing');
assert(client.includes('function mergeMountainRaceGame('), 'client does not merge each climber forward independently');
assert(client.includes('me: mergePlayerProgress(previousState.me, incomingState.me)'), 'client does not preserve the newest local position');
assert(client.includes('opponent: mergePlayerProgress(previousState.opponent, incomingState.opponent)'), 'client does not preserve the newest opponent position');
assert(client.includes('presentation.prompts.slice(0, 4)'), 'client does not keep the visible prompt row limited to four arrows');
assert(client.includes('runtime.inputQueue.filter(item => item.status === \'queued\').slice(0, 8)'), 'client does not send eight queued moves per request');
assert(client.includes('}, immediate ? 0 : 90);'), 'client queue flush cadence is not continuous');
assert(html.includes('<!-- MOUNTAIN_RACE_CONTINUOUS_SYNC_V6 -->'), 'continuous-sync deployment marker is missing');
assert(html.includes('differentRound && incoming.statusRank <= accepted.statusRank'), 'shared snapshot guard still rejects useful same-round opponent progress');`;

if (!stateSource.includes(continuousAssertions)) {
  if (!stateSource.includes(previousConsole)) throw new Error('Summit Sprint V6 validator could not find the V5 completion assertion.');
  stateSource = stateSource.replace(
    previousConsole,
    `${continuousAssertions}\n\nconsole.log('Summit Sprint continuous-sync validation passed: the remaining private route feeds uninterrupted local input, eight moves share each authoritative save, due opponent movement is folded and confirmed with player movement, both climbers merge forward independently, and only true cross-round regressions are rejected.');`
  );
}

if (!stateSource.includes('inputPrompts: state.sequence.slice')) throw new Error('Summit Sprint V6 validator does not require the private runway.');
if (!stateSource.includes('opponent: mergePlayerProgress(previousState.opponent, incomingState.opponent)')) throw new Error('Summit Sprint V6 validator does not require forward-only opponent merging.');
if (!stateSource.includes('mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=6')) throw new Error('Summit Sprint V6 validator does not require the new cache boundary.');
await writeFile(stateSyncValidatorUrl, stateSource);

let gameplaySource = await readFile(gameplayValidatorUrl, 'utf8');
const gameplayAnchor = "assert(client.includes('expectedPromptIndex: item.fromIndex'), 'queued input request does not identify each visible prompt index');";
const gameplayAdditions = `${gameplayAnchor}
assert(client.includes('publicState.inputPrompts'), 'continuous private input runway is not used by the client');
assert(client.includes('presentation.prompts.slice(0, 4)'), 'more than four future arrows can appear at once');
assert(client.includes("slice(0, 8)"), 'rapid inputs are not grouped into eight-move requests');
assert(client.includes('mergePlayerProgress(previousState.opponent, incomingState.opponent)'), 'opponent position cannot merge forward during local input');`;
if (!gameplaySource.includes(gameplayAdditions)) {
  if (!gameplaySource.includes(gameplayAnchor)) throw new Error('Summit Sprint V6 gameplay validator could not find the queued prompt assertion.');
  gameplaySource = gameplaySource.replace(gameplayAnchor, gameplayAdditions);
}
await writeFile(gameplayValidatorUrl, gameplaySource);

console.log('Updated Summit Sprint validators for uninterrupted full-route input and component-wise real-time opponent synchronization.');
