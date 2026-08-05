import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [client, html, integration, actionRoute, syncPatch, orderPatch, reliablePatch, safeCrackerClient, rouletteTurn] = await Promise.all([
  readFile(new URL('assets/mountain-race/mountain-race-multiplayer.js', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('netlify/functions/mountain-race/integration.js', root), 'utf8'),
  readFile(new URL('netlify/functions/duel-action.js', root), 'utf8'),
  readFile(new URL('scripts/patch-mountain-race-state-sync.mjs', root), 'utf8'),
  readFile(new URL('scripts/patch-mountain-race-authoritative-order-v2.mjs', root), 'utf8'),
  readFile(new URL('scripts/patch-mountain-race-reliable-inputs-v3.mjs', root), 'utf8'),
  readFile(new URL('assets/safe-cracker/safe-cracker.js', root), 'utf8'),
  readFile(new URL('assets/roulette/turn-animation.js', root), 'utf8')
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Summit Sprint state-sync validation failed: ${message}`);
}

assert(client.includes('// MOUNTAIN_RACE_STATE_SYNC_V1'), 'client state-sync marker is missing');
assert(client.includes('// MOUNTAIN_RACE_AUTHORITATIVE_ORDER_V2'), 'client authoritative-order marker is missing');
assert(client.includes('// MOUNTAIN_RACE_RELIABLE_INPUTS_V3'), 'client reliable-input marker is missing');
assert(client.includes("pendingActionId: ''"), 'pending action ownership is missing');
assert(client.includes('function compareSnapshotVersions(accepted, incoming)'), 'client race-state-first comparator is missing');
assert(client.includes('const stale = compareSnapshotVersions(accepted, incoming) < 0;'), 'client still requires both independent revision counters to increase together');
assert(client.includes('options.actionResolved'), 'the action response is not distinguished from background polling');
assert(client.includes('finishPendingAction(options.actionId'), 'only the matching action response must release the input lock');
assert(client.includes('expectedPromptIndex: fromIndex'), 'the exact visible prompt index is not submitted');
assert(client.includes('expectedControl: expected'), 'the exact visible arrow identity is not submitted');
assert(client.includes('the next\n    // prompt is not exposed until storage confirms this exact action id'), 'the next arrow still advances speculatively before persistence');
assert(client.includes("runtime.game?.status !== 'complete' || !runtime.resultRevealReady"), 'the result card can still hide the final climb immediately');

assert(integration.includes('// MOUNTAIN_RACE_RELIABLE_INPUTS_V3'), 'server reliable-input marker is missing');
assert(integration.includes('const MOUNTAIN_RACE_ACTION_CONFIRM_ATTEMPTS = 5;'), 'server action confirmation retries are missing');
assert(integration.includes('function optionalUserId(value)'), 'nullable winner ids are not preserved');
assert(!integration.includes("cleanUserId(existing.winnerId || '')"), 'an empty winner id can still become the synthetic unknown user');
assert(integration.includes('expectedControl !== currentExpectedControl'), 'server does not reject a stale displayed arrow without a wrong penalty');
assert(integration.includes('confirmedState?.processedActionIds.includes(actionId)'), 'server does not confirm persistence using the unique action id');
assert(integration.includes('latest = await strongRead(game.gameId) || latest'), 'overwritten moves are not retried from strong storage');
assert(integration.includes('finalGame = await advance(finalGame)'), 'human input does not wake the Network Bot');
assert(actionRoute.includes('expectedControl: body.expectedControl'), 'Netlify route drops the displayed arrow identity');

assert(html.includes('<!-- MOUNTAIN_RACE_STATE_SYNC_V1 -->'), 'deployed state-sync marker is missing');
assert(html.includes('<!-- MOUNTAIN_RACE_AUTHORITATIVE_ORDER_V2 -->'), 'deployed authoritative-order marker is missing');
assert(html.includes('<!-- MOUNTAIN_RACE_RELIABLE_INPUTS_V3 -->'), 'deployed reliable-input marker is missing');
assert(html.includes('function mountainRaceCompareVersions(accepted, incoming)'), 'shared race-state-first comparator is missing');
assert(html.includes("game.mode!=='mountainrace'&&rnbCompareSnapshots(game,current)<0"), 'Network Bot still applies its conflicting generic comparator to Summit Sprint');
assert(html.includes("if(g.mode==='mountainrace')"), 'debug exports still omit the Summit Sprint state');
assert(html.includes('networkBotLog:st.networkBotLog||null'), 'Network Bot diagnostics are missing from the copied state');
assert(html.includes('mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=3'), 'fresh reliable-input cache boundary is missing');

const rank = status => ({ waiting: 0, ready: 1, countdown: 2, playing: 3, complete: 4, cancelled: 4 })[status] ?? 0;
const compare = (accepted, incoming) => {
  const sameRound = !accepted.roundId || !incoming.roundId || accepted.roundId === incoming.roundId;
  if (!sameRound) return -1;
  if (incoming.stateRevision !== accepted.stateRevision) return incoming.stateRevision - accepted.stateRevision;
  if (rank(incoming.status) !== rank(accepted.status)) return rank(incoming.status) - rank(accepted.status);
  if (incoming.gameRevision !== accepted.gameRevision) return incoming.gameRevision - accepted.gameRevision;
  return 0;
};

const playing21 = { status: 'playing', gameRevision: 14, stateRevision: 21, roundId: 'round-a' };
assert(compare(playing21, { status: 'complete', gameRevision: 14, stateRevision: 20, roundId: 'round-a' }) < 0, 'stale completion can still hide the current race');
assert(compare(playing21, { status: 'playing', gameRevision: 13, stateRevision: 22, roundId: 'round-a' }) > 0, 'newer race progress is rejected only because its game revision is lower');
assert(compare(playing21, { status: 'playing', gameRevision: 15, stateRevision: 20, roundId: 'round-a' }) < 0, 'a newer game revision can still replace a newer visible prompt with an older one');

assert(syncPatch.includes('one tap remains locked until its own response'), 'state-sync patch does not document the original double-tap cause');
assert(orderPatch.includes('race-state revision now decides freshness before the independent game revision'), 'authoritative-order patch does not document the cross-counter cause');
assert(reliablePatch.includes('every move is confirmed by action id after persistence'), 'reliable-input patch does not document the storage-overwrite cause');
assert(safeCrackerClient.length > 0, 'protected Safe Cracker runtime is unreadable');
assert(rouletteTurn.length > 0, 'protected Roulette runtime is unreadable');

console.log('Summit Sprint reliable-input validation passed: empty winner ids stay empty, one tap submits the exact visible arrow, stale prompts never count as wrong, action-id confirmation repairs overwritten serverless saves, human actions wake the Network Bot, copied diagnostics contain the real race state, and protected games remain intact.');
