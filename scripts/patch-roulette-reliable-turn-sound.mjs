import { readFile, writeFile } from 'node:fs/promises';

const guardUrl = new URL('../assets/roulette/turn-facing-guard.js', import.meta.url);
let guard = await readFile(guardUrl, 'utf8');

function replaceOnce(source, label, before, after) {
  if (source.includes(after)) return source;
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Reliable turn sound patch could not find ${label}.`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Reliable turn sound patch found more than one ${label}.`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

const oldSoundFunction = `  function startTurnMovementSound() {
    const active = state.activeTransition;
    const api = global.RouletteTurnLock;
    const lock = api?.lock;
    if (!active || !lock || lock.opening || state.soundToken === active.token) return;
    const game = currentGame();
    if (
      String(game?.gameId || '') !== active.gameId ||
      game?.status !== 'playing' ||
      authoritativeTurnId(game) !== active.turnId
    ) return;
    state.soundToken = active.token;
    const started = global.RouletteAudio?.turnRotate?.({
      gameId: active.gameId,
      fromTurnId: active.fromTurnId,
      turnId: active.turnId,
      epoch: Number(lock.epoch || 0),
      duration: 1020,
      rotationToken: active.token
    });
    if (started === true) state.turnSoundsStarted += 1;
  }
`;

const newSoundFunction = `  function startTurnMovementSound(trigger = 'animation-boundary') {
    const active = state.activeTransition;
    const api = global.RouletteTurnLock;
    const lock = api?.lock;
    if (!active || !lock || lock.opening || state.soundToken === active.token) return false;
    const game = currentGame();
    if (
      String(game?.gameId || '') !== active.gameId ||
      game?.status !== 'playing' ||
      authoritativeTurnId(game) !== active.turnId
    ) return false;
    const started = global.RouletteAudio?.turnRotate?.({
      gameId: active.gameId,
      fromTurnId: active.fromTurnId,
      turnId: active.turnId,
      epoch: Number(lock.epoch || 0),
      duration: 1020,
      rotationToken: active.token
    });
    if (started === true) {
      state.soundToken = active.token;
      state.turnSoundsStarted += 1;
      recordDiagnostic('sound-started', { trigger, token: active.token, gameId: active.gameId, fromTurnId: active.fromTurnId, turnId: active.turnId });
      return true;
    }
    recordDiagnostic('sound-deferred', { trigger, token: active.token, gameId: active.gameId, fromTurnId: active.fromTurnId, turnId: active.turnId });
    return false;
  }
`;

guard = replaceOnce(guard, 'the turn movement sound function', oldSoundFunction, newSoundFunction);

guard = replaceOnce(
  guard,
  'the approved transition sound boundary',
  `    recordDiagnostic('approved', transition);
    promoteSnapshot(game);

    try {`,
  `    recordDiagnostic('approved', transition);
    promoteSnapshot(game);
    startTurnMovementSound('approved-transition');

    try {`
);

guard = replaceOnce(
  guard,
  'the animation-boundary fallback trigger',
  `        if (isFacing && !global.RouletteTurnLock?.lock?.opening) startTurnMovementSound();`,
  `        if (isFacing && !global.RouletteTurnLock?.lock?.opening) startTurnMovementSound('animation-wrapper-fallback');`
);

for (const required of [
  "function startTurnMovementSound(trigger = 'animation-boundary')",
  "startTurnMovementSound('approved-transition')",
  "startTurnMovementSound('animation-wrapper-fallback')",
  "recordDiagnostic('sound-started'",
  "recordDiagnostic('sound-deferred'",
  'state.soundToken = active.token;',
  'return true;',
  'return false;'
]) {
  if (!guard.includes(required)) throw new Error(`Reliable turn sound patch is missing ${required}`);
}

await writeFile(guardUrl, guard);
console.log('Patched Roulette turn audio: each approved transition starts sound directly, with the animation wrapper retained as a deduplicated fallback.');