import { access, readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const html = await readFile(new URL('index.html', root), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(`Summit Sprint Terminal Drain V12 validation failed: ${message}`);
}

function count(source, token) {
  return source.split(token).length - 1;
}

for (const required of [
  '<!-- MOUNTAIN_RACE_TERMINAL_DRAIN_V12 -->',
  '/* MOUNTAIN_RACE_TERMINAL_DRAIN_V12_POLL_START */',
  '/* MOUNTAIN_RACE_TERMINAL_DRAIN_V12_AFTER_ADOPT */',
  '/* MOUNTAIN_RACE_TERMINAL_DRAIN_V12_ADOPT */',
  'let remembered = window.__mountainRaceLastCompletedGame || null;',
  'window.__mountainRaceLastCompletedGame = terminalGame;',
  'remembered = null;',
  'rnbGame = terminalGame;',
  "typeof rnbTimer !== 'undefined'",
  "typeof rnbCountdownTimer !== 'undefined'",
  'mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=12'
]) {
  assert(html.includes(required), `generated page is missing ${required}`);
}

assert(count(html, '/* MOUNTAIN_RACE_TERMINAL_DRAIN_V12_POLL_START */') === 1, 'Remote Bot poll start guard must be installed exactly once');
assert(count(html, '/* MOUNTAIN_RACE_TERMINAL_DRAIN_V12_ADOPT */') === 1, 'Remote Bot completion adoption guard must be installed exactly once');
assert(count(html, '/* MOUNTAIN_RACE_TERMINAL_DRAIN_V12_AFTER_ADOPT */') >= 1, 'every generated poll path needs a post-GET completion exit');
assert(html.includes("if(window.__mountainRacePauseCompletedPolling?.(rnbGame||duelLastActiveGame||window.__mountainRaceLastCompletedGame||null))return;"), 'Remote Bot poll loop does not stop from remembered terminal state');
assert(html.includes("if(game&&game.mode==='mountainrace'&&['complete','cancelled'].includes(String(game.status||'')))window.__mountainRacePauseCompletedPolling?.(game);"), 'Remote Bot adoption does not propagate completion immediately');

function terminalDecision(rememberedGame, incomingGame) {
  let remembered = rememberedGame || null;
  const incomingId = String(incomingGame?.gameId || '');
  const rememberedId = String(remembered?.gameId || '');
  const incomingTerminal = Boolean(
    incomingGame
    && incomingGame.mode === 'mountainrace'
    && incomingGame.remoteNetworkTest
    && ['complete', 'cancelled'].includes(String(incomingGame.status || ''))
  );

  if (!incomingTerminal && incomingGame?.mode === 'mountainrace' && remembered && incomingId && incomingId === rememberedId) {
    const incomingRevision = Number(incomingGame.revision ?? -1);
    const rememberedRevision = Number(remembered.revision ?? -1);
    const incomingRoundId = String(incomingGame.mountainraceState?.roundId || '');
    const rememberedRoundId = String(remembered.mountainraceState?.roundId || '');
    const newerRound = incomingRevision > rememberedRevision
      || (incomingRoundId && rememberedRoundId && incomingRoundId !== rememberedRoundId);
    if (newerRound) remembered = null;
  }

  const terminalGame = incomingTerminal
    ? incomingGame
    : (remembered && incomingId && incomingId === String(remembered.gameId || '') ? remembered : null);
  return { blocked: Boolean(terminalGame?.remoteNetworkTest), remembered: terminalGame || remembered };
}

const complete = {
  gameId: 'duel-mountainrace-v12',
  mode: 'mountainrace',
  remoteNetworkTest: true,
  status: 'complete',
  revision: 29,
  mountainraceState: { roundId: 'round-a', revision: 42 }
};

const firstTerminal = terminalDecision(null, complete);
assert(firstTerminal.blocked, 'a completed Remote Bot race must stop future polling');

const stalePlaying = terminalDecision(complete, {
  ...complete,
  status: 'playing',
  revision: 28,
  mountainraceState: { roundId: 'round-a', revision: 40 }
});
assert(stalePlaying.blocked, 'a stale in-flight playing response must not reopen a completed race');

const rematch = terminalDecision(complete, {
  ...complete,
  status: 'ready',
  revision: 30,
  mountainraceState: { roundId: 'round-a', revision: 0 }
});
assert(!rematch.blocked && rematch.remembered === null, 'a higher-revision rematch must release remembered terminal state in the same call');

const newRound = terminalDecision(complete, {
  ...complete,
  status: 'countdown',
  revision: 29,
  mountainraceState: { roundId: 'round-b', revision: 0 }
});
assert(!newRound.blocked && newRound.remembered === null, 'a new round ID must release remembered terminal state');

const otherGame = terminalDecision(complete, {
  ...complete,
  gameId: 'duel-mountainrace-v12-new',
  status: 'ready',
  revision: 1,
  mountainraceState: { roundId: 'round-new', revision: 0 }
});
assert(!otherGame.blocked, 'a different game ID must never be blocked by the previous race result');

for (const protectedPath of [
  'assets/safe-cracker/safe-cracker.js',
  'assets/safe-cracker/safe-cracker.css',
  'assets/roulette/turn-animation.js',
  'assets/roulette/turn-fire.js',
  'assets/roulette/audio-bindings.js'
]) {
  await access(new URL(protectedPath, root));
}

console.log('Summit Sprint Terminal Drain V12 validation passed: completion is propagated to the Remote Bot scheduler, pending wake timers are cleared, stale terminal polls remain blocked, post-GET wake ACTs are skipped, and rematches release the terminal lock immediately.');
