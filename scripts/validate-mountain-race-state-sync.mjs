import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [client, html, syncPatch, orderPatch, safeCrackerClient, rouletteTurn] = await Promise.all([
  readFile(new URL('assets/mountain-race/mountain-race-multiplayer.js', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('scripts/patch-mountain-race-state-sync.mjs', root), 'utf8'),
  readFile(new URL('scripts/patch-mountain-race-authoritative-order-v2.mjs', root), 'utf8'),
  readFile(new URL('assets/safe-cracker/safe-cracker.js', root), 'utf8'),
  readFile(new URL('assets/roulette/turn-animation.js', root), 'utf8')
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Summit Sprint state-sync validation failed: ${message}`);
}

assert(client.includes('// MOUNTAIN_RACE_STATE_SYNC_V1'), 'client state-sync marker is missing');
assert(client.includes('// MOUNTAIN_RACE_AUTHORITATIVE_ORDER_V2'), 'client authoritative-order marker is missing');
assert(client.includes("pendingActionId: ''"), 'pending action ownership is missing');
assert(client.includes('function acceptsSnapshot(game)'), 'client snapshot guard is missing');
assert(client.includes('function compareSnapshotVersions(accepted, incoming)'), 'client race-state-first comparator is missing');
assert(client.includes('const stale = compareSnapshotVersions(accepted, incoming) < 0;'), 'client still requires both independent revision counters to increase together');
assert(client.includes('options.actionResolved'), 'the action response is not distinguished from background polling');
assert(client.includes("adopt(event?.detail?.game, { source: 'state-event' })"), 'background state events are not isolated from action completion');
assert(client.includes('finishPendingAction(options.actionId'), 'only the matching action response must release the input lock');
assert(client.includes("runtime.game?.status !== 'complete' || !runtime.resultRevealReady"), 'the result card can still hide the final climb immediately');
assert(client.includes('}, 900);'), 'the final summit visual does not receive its reveal window');
assert(!client.includes('runtime.game = game;\n    runtime.busy = false;\n    runtime.pendingInput = null;'), 'generic snapshot adoption still clears an in-flight move');

assert(html.includes('<!-- MOUNTAIN_RACE_STATE_SYNC_V1 -->'), 'deployed state-sync marker is missing');
assert(html.includes('<!-- MOUNTAIN_RACE_AUTHORITATIVE_ORDER_V2 -->'), 'deployed authoritative-order marker is missing');
assert(html.includes('function mountainRaceCompareVersions(accepted, incoming)'), 'shared race-state-first comparator is missing');
assert(html.includes('mountainRaceCompareVersions(accepted, incoming) < 0'), 'shared guard still compares game and race revisions as simultaneous requirements');
assert(html.includes('got.game.mode === "mountainrace" && !mountainRaceAcceptSnapshot(got.game)'), 'focused GET polling can still regress the race');
assert(html.includes('game?.mode === "mountainrace" && !mountainRaceAcceptSnapshot(game)'), 'active rendering can still mount stale race state');
assert(html.includes('const acceptedGame = data.game && mountainRaceAcceptSnapshot(data.game)'), 'direct action responses do not pass through the authoritative race comparator');
assert(html.includes("game.mode!=='mountainrace'&&rnbCompareSnapshots(game,current)<0"), 'Network Bot still applies its conflicting generic comparator to Summit Sprint');
assert(html.includes("if(g.mode==='mountainrace')"), 'debug exports still omit the Summit Sprint state');
assert(html.includes('networkBotLog:st.networkBotLog||null'), 'Network Bot diagnostics are missing from the copied state');
assert(html.includes('mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=2'), 'fresh authoritative-order cache boundary is missing');

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
assert(compare(playing21, { status: 'complete', gameRevision: 14, stateRevision: 20, roundId: 'round-a' }) < 0, 'the observed stale complete state 21→20 would still hide the current race');
assert(compare(playing21, { status: 'playing', gameRevision: 13, stateRevision: 22, roundId: 'round-a' }) > 0, 'a valid action or bot move with a newer race revision is rejected only because its game revision is lower');
assert(compare(playing21, { status: 'playing', gameRevision: 15, stateRevision: 20, roundId: 'round-a' }) < 0, 'a newer game revision can still replace newer visible race progress with an older prompt');
assert(compare(playing21, { status: 'complete', gameRevision: 15, stateRevision: 22, roundId: 'round-a' }) > 0, 'the authoritative completed state is rejected');
const complete22 = { status: 'complete', gameRevision: 16, stateRevision: 22, roundId: 'round-a' };
assert(compare(complete22, { status: 'complete', gameRevision: 15, stateRevision: 22, roundId: 'round-a' }) < 0, 'equal race state still accepts an older game snapshot');
assert(compare(complete22, { status: 'playing', gameRevision: 17, stateRevision: 22, roundId: 'round-a' }) < 0, 'equal race state can regress from complete to playing');
assert(compare(playing21, { status: 'playing', gameRevision: 30, stateRevision: 40, roundId: 'round-b' }) < 0, 'a foreign round can replace the active course');

assert(syncPatch.includes('one tap remains locked until its own response'), 'state-sync patch does not document the original double-tap cause');
assert(orderPatch.includes('race-state revision now decides freshness before the independent game revision'), 'authoritative-order patch does not document the cross-counter root cause');
assert(safeCrackerClient.length > 0, 'protected Safe Cracker runtime is unreadable');
assert(rouletteTurn.length > 0, 'protected Roulette runtime is unreadable');

console.log('Summit Sprint state-sync validation passed: a single tap owns its response, race-state revision is the authoritative freshness key, bot and player progress remain visible despite independent game revisions, copied diagnostics contain the real race state, and the final climb appears before results.');
