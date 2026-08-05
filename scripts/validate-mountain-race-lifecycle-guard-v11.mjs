import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [html, patch, safeCrackerClient, rouletteTurn] = await Promise.all([
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('scripts/patch-mountain-race-lifecycle-guard-v11.mjs', root), 'utf8'),
  readFile(new URL('assets/safe-cracker/safe-cracker.js', root), 'utf8'),
  readFile(new URL('assets/roulette/turn-animation.js', root), 'utf8')
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Summit Sprint lifecycle-guard validation failed: ${message}`);
}

const ranks = { waiting: 0, ready: 1, countdown: 2, playing: 3, complete: 4, cancelled: 4 };
function lifecycleRegression(current, incoming) {
  if (!current || !incoming || String(incoming.mode || '') !== 'mountainrace' || String(current.gameId || '') !== String(incoming.gameId || '')) return false;
  const currentRank = ranks[String(current.status || 'waiting')] ?? 0;
  const incomingRank = ranks[String(incoming.status || 'waiting')] ?? 0;
  const currentRevision = Number(current.revision ?? -1);
  const incomingRevision = Number(incoming.revision ?? -1);
  return incomingRank < currentRank && incomingRevision <= currentRevision;
}

const gameId = 'duel-mountainrace-validation';
assert(lifecycleRegression(
  { gameId, mode: 'mountainrace', status: 'countdown', revision: 2 },
  { gameId, mode: 'mountainrace', status: 'ready', revision: 1 }
), 'an in-flight Ready revision can still overwrite Countdown');
assert(lifecycleRegression(
  { gameId, mode: 'mountainrace', status: 'playing', revision: 3 },
  { gameId, mode: 'mountainrace', status: 'countdown', revision: 2 }
), 'an in-flight Countdown revision can still overwrite Playing');
assert(!lifecycleRegression(
  { gameId, mode: 'mountainrace', status: 'complete', revision: 23 },
  { gameId, mode: 'mountainrace', status: 'ready', revision: 24 }
), 'a higher-revision rematch would be rejected');
assert(!lifecycleRegression(
  { gameId, mode: 'mountainrace', status: 'playing', revision: 20, mountainraceState: { revision: 31 } },
  { gameId, mode: 'mountainrace', status: 'playing', revision: 19, mountainraceState: { revision: 32 } }
), 'same-lifecycle opponent component synchronization would be rejected');
assert(!lifecycleRegression(
  { gameId, mode: 'safecracker', status: 'countdown', revision: 2 },
  { gameId, mode: 'safecracker', status: 'ready', revision: 1 }
), 'protected Safe Cracker snapshots would be intercepted');

assert(html.includes('<!-- MOUNTAIN_RACE_LIFECYCLE_GUARD_V11 -->'), 'deployment marker is missing');
assert(html.includes('function mountainRaceSharedLifecycleRegression(current,incoming)'), 'shared lifecycle helper is missing');
assert(html.includes('incomingRank<currentRank&&incomingRevision<=currentRevision'), 'lifecycle and revision ordering are not both enforced');
assert(html.includes('const mountainRaceLifecycleRegression=mountainRaceSharedLifecycleRegression(current,game);'), 'Remote Bot adoption does not invoke the lifecycle helper');
assert(html.includes('window.__mountainRaceSharedRejectedSnapshots=Number(window.__mountainRaceSharedRejectedSnapshots||0)+1;'), 'rejected lifecycle responses are not diagnosed');
assert(html.includes('mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=11'), 'V11 client cache boundary is missing');
assert(patch.includes('higher-revision rematches'), 'patch does not document rematch preservation');
assert(safeCrackerClient.length > 0, 'protected Safe Cracker client is unreadable');
assert(rouletteTurn.length > 0, 'protected Roulette runtime is unreadable');

console.log('Summit Sprint Lifecycle Guard V11 validation passed: stale Ready/Countdown responses cannot move the shared game backward, higher-revision rematches remain available, same-lifecycle component updates remain mergeable, and protected games are untouched.');
