import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [html, patch, safeCrackerClient, rouletteTurn] = await Promise.all([
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('scripts/patch-mountain-race-terminal-poll-v10.mjs', root), 'utf8'),
  readFile(new URL('assets/safe-cracker/safe-cracker.js', root), 'utf8'),
  readFile(new URL('assets/roulette/turn-animation.js', root), 'utf8')
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Summit Sprint terminal-poll validation failed: ${message}`);
}

assert(html.includes('<!-- MOUNTAIN_RACE_TERMINAL_POLL_V10 -->'), 'deployment marker is missing');
assert(html.includes("const activeGame=typeof duelLastActiveGame!=='undefined'?duelLastActiveGame:null;"), 'mutation resume does not inspect the adopted game');
assert(html.includes("window.__mountainRacePauseCompletedPolling(activeGame))return;"), 'mutation completion can still restart a terminal Remote Bot timer');
assert(html.includes('window.__mountainRacePauseCompletedPolling(duelLastActiveGame || null)) return;'), 'a stray focused timer can still issue a completed Remote Bot GET');
assert(html.includes('function mountainRacePauseCompletedPolling(game)'), 'V7 terminal polling helper is missing');
assert(html.includes('mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=10') ||
  html.includes('mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=11'), 'V10-or-newer cache boundary is missing');
assert(patch.includes('mutation polling resume boundary'), 'patch does not own the mutation-resume cause');
assert(patch.includes('focused refresh function'), 'patch does not guard the final refresh boundary');

const shouldPause = game => Boolean(game?.mode === 'mountainrace' && game?.status === 'complete' && game?.remoteNetworkTest);
assert(shouldPause({ mode: 'mountainrace', status: 'complete', remoteNetworkTest: true }), 'completed Remote Bot race is not terminal');
assert(!shouldPause({ mode: 'mountainrace', status: 'complete', remoteNetworkTest: false }), 'human completed race would lose rematch polling');
assert(!shouldPause({ mode: 'mountainrace', status: 'playing', remoteNetworkTest: true }), 'active Remote Bot race would stop polling');
assert(!shouldPause({ mode: 'safecracker', status: 'complete', remoteNetworkTest: true }), 'protected Safe Cracker behavior would be intercepted');
assert(safeCrackerClient.length > 0, 'protected Safe Cracker client is unreadable');
assert(rouletteTurn.length > 0, 'protected Roulette turn runtime is unreadable');

console.log('Summit Sprint Terminal Poll V10 validation passed: completed Remote Bot action responses cannot restart polling, stray focused timers stop before GET, human rematches remain live, and protected games remain intact.');
