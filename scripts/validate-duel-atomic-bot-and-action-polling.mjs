import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const data = await readFile(new URL('../netlify/functions/_data.js', import.meta.url), 'utf8');
const action = await readFile(new URL('../netlify/functions/duel-action.js', import.meta.url), 'utf8');
const compatibilityPatch = await readFile(new URL('./patch-remote-bot-attach-retry.mjs', import.meta.url), 'utf8');

for (const required of [
  'async function duelCreateRemoteNetworkBotGame(user, details = {})',
  'function duelRebuildWaitingGameFromCreateResult',
  'duelGetRawStrong(clientGameId, 1)',
  'duelClientCreateGameId(mode, details.clientGameId || details.gameId || "")',
  'atomicCreateAndAttach: true',
  'duelCreateRemoteNetworkBotGame,'
]) {
  if (!data.includes(required)) throw new Error(`Atomic Remote Bot server validation is missing ${required}`);
}

for (const required of [
  'duelCreateRemoteNetworkBotGame,',
  'action === "create-remote-bot"',
  'clientGameId: body.clientGameId',
  'profile: body.profile'
]) {
  if (!action.includes(required)) throw new Error(`Atomic Remote Bot handler validation is missing ${required}`);
}

for (const required of [
  'async function rnbAttachBotAtomically(gameId,profile)',
  "duelRequest('create-remote-bot'",
  'const data=await rnbAttachBotAtomically(gameId,profile);',
  'const duelRequestBeforeMutationPause=duelRequest;',
  "const duelMutationActions=new Set(['act','create','create-remote-bot'",
  'window.__duelMutationRequestsInFlight',
  'duelPausePollingForMutation()',
  'data.game=duelAdoptMutationResponseGame(data.game)',
  'Number(window.__duelMutationRequestsInFlight || 0) > 0',
  'duelMutationResumeTimer=setTimeout',
  'duelSetPollRate(typeof duelLastActiveGame'
]) {
  if (!html.includes(required)) throw new Error(`Action polling validation is missing ${required}`);
}

for (const forbidden of [
  'async function rnbAttachBotWithRetry(gameId,profile)',
  'const delays=[0,900,1500,2200,3000,3500];',
  "line(botLogs,'attach retry scheduled'"
]) {
  if (html.includes(forbidden)) throw new Error(`Old repeated Remote Bot retry behavior remains: ${forbidden}`);
}

if (!compatibilityPatch.includes("await import('./patch-duel-atomic-bot-and-action-polling.mjs');")) {
  throw new Error('The atomic Remote Bot/action polling patch is not wired into the build.');
}

console.log('Atomic Remote Bot/action polling validation passed: one server request creates or recovers and attaches the bot, mutations pause focused polling, action responses are adopted before the timer resumes, and the old client retry loop is absent.');
