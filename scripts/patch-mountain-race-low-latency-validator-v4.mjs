import { readFile, writeFile } from 'node:fs/promises';

const validatorUrl = new URL('validate-mountain-race-state-sync.mjs', import.meta.url);
let source = await readFile(validatorUrl, 'utf8');

source = source
  .replace(
    "assert(integration.includes('finalGame = await advance(finalGame)'), 'human input does not wake the Network Bot');",
    `assert(integration.includes('// MOUNTAIN_RACE_LOW_LATENCY_INPUTS_V4'), 'server low-latency marker is missing');
const actionStart = integration.indexOf('  async function action(');
const actionEnd = integration.indexOf('\\n  return Object.freeze(', actionStart);
const actionSource = actionStart >= 0 && actionEnd > actionStart ? integration.slice(actionStart, actionEnd) : '';
assert(actionSource.includes('wakeBot: true'), 'confirmed player input does not request a focused Network Bot wake');
assert(!actionSource.includes('await advance('), 'confirmed player input still blocks on the Network Bot driver');
assert(client.includes('// MOUNTAIN_RACE_LOW_LATENCY_INPUTS_V4'), 'client low-latency marker is missing');
assert(client.includes('function scheduleBotWake()'), 'client does not run the Network Bot wake after returning the player response');
assert(client.includes('if (data.wakeBot) scheduleBotWake();'), 'action responses do not schedule the focused Network Bot wake');`
  )
  .replaceAll(
    'mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=3',
    'mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=4'
  )
  .replace(
    "console.log('Summit Sprint reliable-input validation passed: empty winner ids stay empty, one tap submits the exact visible arrow, stale prompts never count as wrong, action-id confirmation repairs overwritten serverless saves, human actions wake the Network Bot, copied diagnostics contain the real race state, and protected games remain intact.');",
    "console.log('Summit Sprint low-latency validation passed: player moves still use exact-arrow and action-id confirmation, the confirmed response no longer waits for the Network Bot driver, a focused refresh wakes the bot immediately afterward, stale snapshots remain rejected, and protected games remain intact.');"
  );

if (source.includes("assert(integration.includes('finalGame = await advance(finalGame)')")) {
  throw new Error('Summit Sprint validator still requires the slow synchronous Network Bot pass.');
}
if (!source.includes("actionSource.includes('wakeBot: true')")) {
  throw new Error('Summit Sprint validator does not verify the deferred Network Bot wake.');
}
if (!source.includes('function scheduleBotWake()')) {
  throw new Error('Summit Sprint validator does not verify the client wake helper.');
}
if (!source.includes('mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=4')) {
  throw new Error('Summit Sprint validator does not require the low-latency cache boundary.');
}

await writeFile(validatorUrl, source);
console.log('Updated Summit Sprint validation for confirmed-first responses and deferred Network Bot wakeups.');
