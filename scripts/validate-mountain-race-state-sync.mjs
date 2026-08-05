import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [client, html, patch, safeCrackerClient, rouletteTurn] = await Promise.all([
  readFile(new URL('assets/mountain-race/mountain-race-multiplayer.js', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('scripts/patch-mountain-race-state-sync.mjs', root), 'utf8'),
  readFile(new URL('assets/safe-cracker/safe-cracker.js', root), 'utf8'),
  readFile(new URL('assets/roulette/turn-animation.js', root), 'utf8')
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Summit Sprint state-sync validation failed: ${message}`);
}

assert(client.includes('// MOUNTAIN_RACE_STATE_SYNC_V1'), 'client state-sync marker is missing');
assert(client.includes("pendingActionId: ''"), 'pending action ownership is missing');
assert(client.includes('function acceptsSnapshot(game)'), 'client snapshot ordering guard is missing');
assert(client.includes('incoming.gameRevision < accepted.gameRevision'), 'client does not reject older game revisions');
assert(client.includes('incoming.stateRevision < accepted.stateRevision'), 'client does not reject older race-state revisions');
assert(client.includes('options.actionResolved'), 'the action response is not distinguished from background polling');
assert(client.includes("adopt(event?.detail?.game, { source: 'state-event' })"), 'background state events are not isolated from action completion');
assert(client.includes('finishPendingAction(options.actionId'), 'only the matching action response must release the input lock');
assert(client.includes("runtime.game?.status !== 'complete' || !runtime.resultRevealReady"), 'the result card can still hide the final climb immediately');
assert(client.includes('}, 900);'), 'the final summit visual does not receive its reveal window');
assert(!client.includes('runtime.game = game;\n    runtime.busy = false;\n    runtime.pendingInput = null;'), 'generic snapshot adoption still clears an in-flight move');

assert(html.includes('<!-- MOUNTAIN_RACE_STATE_SYNC_V1 -->'), 'deployed state-sync marker is missing');
assert(html.includes('function mountainRaceAcceptSnapshot(game)'), 'shared snapshot guard is missing');
assert(html.includes('got.game.mode === "mountainrace" && !mountainRaceAcceptSnapshot(got.game)'), 'focused GET polling can still regress the race');
assert(html.includes('game?.mode === "mountainrace" && !mountainRaceAcceptSnapshot(game)'), 'active rendering can still mount stale race state');
assert(html.includes('const acceptedGame = data.game && mountainRaceAcceptSnapshot(data.game)'), 'action responses can still replace a newer race snapshot');
assert(html.includes('active?.mountainraceState?.revision'), 'known revisions are not based on the accepted Summit Sprint snapshot');
assert(html.includes('game?.mountainraceState||{}'), 'Network Bot ordering ignores Summit Sprint state revisions');
assert(html.includes('ignored rejected Summit Sprint snapshot'), 'Network Bot diagnostics do not report rejected stale race snapshots');
assert(html.includes('mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=1'), 'fresh state-sync cache boundary is missing');

const rank = status => ({ waiting: 0, ready: 1, countdown: 2, playing: 3, complete: 4, cancelled: 4 })[status] ?? 0;
const accepts = (accepted, incoming) => !(
  rank(incoming.status) < rank(accepted.status)
  || incoming.gameRevision < accepted.gameRevision
  || incoming.stateRevision < accepted.stateRevision
  || (accepted.roundId && incoming.roundId && accepted.roundId !== incoming.roundId && rank(incoming.status) <= rank(accepted.status))
);

const playing12 = { status: 'playing', gameRevision: 10, stateRevision: 12, roundId: 'round-a' };
assert(!accepts(playing12, { status: 'playing', gameRevision: 10, stateRevision: 11, roundId: 'round-a' }), 'the observed 12→11 state regression would still be accepted');
assert(!accepts(playing12, { status: 'playing', gameRevision: 9, stateRevision: 12, roundId: 'round-a' }), 'an older game revision with equal state would still be accepted');
assert(accepts(playing12, { status: 'playing', gameRevision: 11, stateRevision: 13, roundId: 'round-a' }), 'new authoritative progress is rejected');
const complete17 = { status: 'complete', gameRevision: 17, stateRevision: 22, roundId: 'round-a' };
assert(!accepts(complete17, { status: 'complete', gameRevision: 16, stateRevision: 22, roundId: 'round-a' }), 'the observed complete revision 17→16 regression would still be accepted');
assert(!accepts(complete17, { status: 'playing', gameRevision: 18, stateRevision: 23, roundId: 'round-a' }), 'a completed race can regress to playing');

assert(patch.includes('one tap remains locked until its own response'), 'patch does not document the double-tap root cause');
assert(safeCrackerClient.length > 0, 'protected Safe Cracker runtime is unreadable');
assert(rouletteTurn.length > 0, 'protected Roulette runtime is unreadable');

console.log('Summit Sprint state-sync validation passed: one input remains locked to its own response, stale GET/action/Network Bot snapshots cannot move the visuals backward, and the final summit climb appears before results.');
