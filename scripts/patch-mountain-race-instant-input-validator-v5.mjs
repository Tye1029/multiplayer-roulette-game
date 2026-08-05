import { readFile, writeFile } from 'node:fs/promises';

const stateSyncValidatorUrl = new URL('validate-mountain-race-state-sync.mjs', import.meta.url);
const multiplayerValidatorUrl = new URL('validate-mountain-race-multiplayer.mjs', import.meta.url);
const gameplayValidatorUrl = new URL('validate-mountain-race-gameplay-visibility.mjs', import.meta.url);

let source = await readFile(stateSyncValidatorUrl, 'utf8');
source = source
  .replace(
    "assert(client.includes('if (data.wakeBot) scheduleBotWake();'), 'action responses do not schedule the focused Network Bot wake');",
    "assert(client.includes('if (data?.wakeBot) scheduleBotWake();'), 'queued action responses do not schedule the focused Network Bot wake');"
  )
  .replaceAll(
    'mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=4',
    'mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=5'
  );

const previousConsole = "console.log('Summit Sprint low-latency validation passed: player moves still use exact-arrow and action-id confirmation, the confirmed response no longer waits for the Network Bot driver, a focused refresh wakes the bot immediately afterward, stale snapshots remain rejected, and protected games remain intact.');";
const instantAssertions = `assert(integration.includes('// MOUNTAIN_RACE_INSTANT_INPUT_QUEUE_V5'), 'server instant-input marker is missing');
assert(integration.includes('async function applyBatchUnlocked('), 'server does not validate a queued input batch');
assert(integration.includes('await saveGame(workingGame)'), 'queued inputs are not combined into one authoritative save');
assert(integration.includes('confirmedActionIds'), 'server does not return confirmed queued action IDs');
assert(client.includes('// MOUNTAIN_RACE_INSTANT_INPUT_QUEUE_V5'), 'client instant-input marker is missing');
assert(client.includes('inputQueue: []'), 'client does not retain rapid taps');
assert(client.includes('async function flushInputQueue()'), 'client does not flush queued taps');
assert(client.includes("choice: 'mountainrace:batch'"), 'client still makes one request per arrow');
assert(client.includes('prompts.length > 0 && !presentation.blocked'), 'controls still wait for each network response');
assert(actionRoute.includes('inputBatch: body.inputBatch'), 'Netlify route drops the queued input batch');`;

if (!source.includes(instantAssertions)) {
  if (!source.includes(previousConsole)) throw new Error('Summit Sprint instant-input validator could not find the V4 completion assertion.');
  source = source.replace(
    previousConsole,
    `${instantAssertions}\n\nconsole.log('Summit Sprint instant-input validation passed: visible arrows advance immediately, rapid taps queue without a per-button network lock, up to four exact prompt actions share one strongly confirmed save, stale queued prompts remain harmless, the bot wake stays deferred, and protected games remain intact.');`
  );
}

if (!source.includes("choice: 'mountainrace:batch'")) throw new Error('Summit Sprint validator does not require batched arrow requests.');
if (!source.includes('inputBatch: body.inputBatch')) throw new Error('Summit Sprint validator does not verify queued input routing.');
if (!source.includes('mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=5')) throw new Error('Summit Sprint validator does not require the instant-input cache boundary.');
if (source.includes("assert(client.includes('if (data.wakeBot) scheduleBotWake();')")) throw new Error('Summit Sprint validator still expects the removed single-action response path.');
await writeFile(stateSyncValidatorUrl, source);

let multiplayerSource = await readFile(multiplayerValidatorUrl, 'utf8');
const clientExpectationBefore = `  "const STATE_EVENT = 'mountainrace:state'",
  'mountainrace:input:\${token}',
  'window.__mountainRaceBridge',`;
const clientExpectationAfter = `  "const STATE_EVENT = 'mountainrace:state'",
  "choice: 'mountainrace:batch'",
  'window.__mountainRaceBridge',`;
if (!multiplayerSource.includes(clientExpectationAfter)) {
  if (!multiplayerSource.includes(clientExpectationBefore)) {
    throw new Error('Summit Sprint multiplayer validator could not find the legacy client request expectation.');
  }
  multiplayerSource = multiplayerSource.replace(clientExpectationBefore, clientExpectationAfter);
}
if (!multiplayerSource.includes("choice: 'mountainrace:batch'")) {
  throw new Error('Summit Sprint multiplayer validator does not require the queued client batch request.');
}
const legacyServerTokenCount = multiplayerSource.split('mountainrace:input:${token}').length - 1;
if (legacyServerTokenCount !== 1) {
  throw new Error(`Summit Sprint multiplayer validator expected one legacy server compatibility token, found ${legacyServerTokenCount}.`);
}
await writeFile(multiplayerValidatorUrl, multiplayerSource);

let gameplaySource = await readFile(gameplayValidatorUrl, 'utf8');
gameplaySource = gameplaySource
  .replace(
    `assert(client.includes("Correct direction — climbing now!"), 'correct input does not provide immediate feedback');`,
    `assert(client.includes('runtime.inputQueue.push(item);'), 'correct input is not queued and rendered immediately');`
  )
  .replace(
    `assert(client.includes("Wrong direction — slipping!"), 'wrong input does not provide immediate feedback');`,
    `assert(client.includes('runtime.inputQueueBlocked = !item.correct;'), 'wrong input does not immediately block the queue for slip confirmation');`
  )
  .replace(
    `assert(client.includes('expectedPromptIndex: fromIndex'), 'input request does not identify the visible prompt index');`,
    `assert(client.includes('expectedPromptIndex: item.fromIndex'), 'queued input request does not identify each visible prompt index');`
  )
  .replace(
    `assert(client.includes('runtime.pendingInput = null;'), 'authoritative reconciliation does not clear pending input');`,
    `assert(client.includes('syncPendingCompatibility();'), 'authoritative queue reconciliation does not synchronize pending compatibility state');`
  );
if (!gameplaySource.includes('runtime.inputQueue.push(item);')) throw new Error('Summit Sprint visibility validator does not require immediate queue feedback.');
if (!gameplaySource.includes('runtime.inputQueueBlocked = !item.correct;')) throw new Error('Summit Sprint visibility validator does not require immediate wrong-input feedback.');
if (!gameplaySource.includes('expectedPromptIndex: item.fromIndex')) throw new Error('Summit Sprint visibility validator does not require exact queued prompt indices.');
await writeFile(gameplayValidatorUrl, gameplaySource);

console.log('Updated Summit Sprint validation for immediate local queues, one-save authoritative batches, exact queued prompt indices, visible feedback, and preserved server single-input compatibility.');
