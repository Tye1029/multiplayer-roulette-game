import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const clientUrl = new URL('assets/mountain-race/mountain-race-multiplayer.js', root);
const indexUrl = new URL('index.html', root);
const marker = '// MOUNTAIN_RACE_CONTINUOUS_SYNC_V6';
const htmlMarker = '<!-- MOUNTAIN_RACE_CONTINUOUS_SYNC_V6 -->';

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Summit Sprint continuous-sync client patch could not find ${label}.`);
  return source.replace(before, after);
}

function replaceFunction(source, signature, replacement, label) {
  const start = source.indexOf(signature);
  if (start < 0) throw new Error(`Summit Sprint continuous-sync client patch could not find ${label}.`);
  const paramsStart = source.indexOf('(', start);
  let parenDepth = 0;
  let quote = '';
  let escaped = false;
  let bodyStart = -1;
  for (let index = paramsStart; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '(') parenDepth += 1;
    else if (char === ')') {
      parenDepth -= 1;
      if (parenDepth === 0) {
        bodyStart = source.indexOf('{', index + 1);
        break;
      }
    }
  }
  if (bodyStart < 0) throw new Error(`Summit Sprint continuous-sync client patch could not parse ${label}.`);

  let braceDepth = 0;
  quote = '';
  escaped = false;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') braceDepth += 1;
    else if (char === '}') {
      braceDepth -= 1;
      if (braceDepth === 0) return source.slice(0, start) + replacement + source.slice(index + 1);
    }
  }
  throw new Error(`Summit Sprint continuous-sync client patch could not close ${label}.`);
}

function indentFunction(fn, replacementName) {
  const renamed = fn.toString().replace(fn.name, replacementName);
  return renamed.split('\n').map(line => `  ${line}`).join('\n');
}

function generatedInputTimestamp(input) {
  const parsed = Date.parse(String(input?.at || ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function generatedNewerInput(previousInput, incomingInput) {
  if (!previousInput) return incomingInput || null;
  if (!incomingInput) return previousInput || null;
  const previousTime = inputTimestamp(previousInput);
  const incomingTime = inputTimestamp(incomingInput);
  if (incomingTime !== previousTime) return incomingTime > previousTime ? incomingInput : previousInput;
  return String(incomingInput.at || '') >= String(previousInput.at || '') ? incomingInput : previousInput;
}

function generatedMergePlayerProgress(previousPlayer = {}, incomingPlayer = {}) {
  const previousIndex = Math.max(0, Math.trunc(Number(previousPlayer.promptIndex) || 0));
  const incomingIndex = Math.max(0, Math.trunc(Number(incomingPlayer.promptIndex) || 0));
  const promptIndex = Math.max(previousIndex, incomingIndex);
  return {
    ...previousPlayer,
    ...incomingPlayer,
    promptIndex,
    acceptedInputs: Math.max(
      Math.max(0, Math.trunc(Number(previousPlayer.acceptedInputs) || 0)),
      Math.max(0, Math.trunc(Number(incomingPlayer.acceptedInputs) || 0))
    ),
    rejectedInputs: Math.max(
      Math.max(0, Math.trunc(Number(previousPlayer.rejectedInputs) || 0)),
      Math.max(0, Math.trunc(Number(incomingPlayer.rejectedInputs) || 0))
    ),
    progress: Math.max(Number(previousPlayer.progress) || 0, Number(incomingPlayer.progress) || 0),
    lastInput: newerInput(previousPlayer.lastInput, incomingPlayer.lastInput),
    finishedAt: incomingPlayer.finishedAt || previousPlayer.finishedAt || null
  };
}

function generatedMergeMountainRaceGame(previousGame, incomingGame) {
  if (!previousGame || String(previousGame.gameId || '') !== String(incomingGame?.gameId || '')) return incomingGame;
  const previousState = previousGame.mountainraceState || {};
  const incomingState = incomingGame?.mountainraceState || {};
  const previousRound = String(previousState.roundId || '');
  const incomingRound = String(incomingState.roundId || '');
  if (previousRound && incomingRound && previousRound !== incomingRound) return incomingGame;

  const previousMeIndex = Math.max(0, Math.trunc(Number(previousState.me?.promptIndex) || 0));
  const incomingMeIndex = Math.max(0, Math.trunc(Number(incomingState.me?.promptIndex) || 0));
  const previousStateRevision = Math.max(-1, Number(previousState.revision ?? -1));
  const incomingStateRevision = Math.max(-1, Number(incomingState.revision ?? -1));
  const incomingOwnsRunway = incomingMeIndex > previousMeIndex
    || (incomingMeIndex === previousMeIndex && incomingStateRevision >= previousStateRevision);
  const previousStatusRank = lifecycleRank(previousGame.status);
  const incomingStatusRank = lifecycleRank(incomingGame?.status);
  const incomingOwnsLifecycle = incomingStatusRank >= previousStatusRank;
  const previousSeconds = Number(previousState.secondsLeft);
  const incomingSeconds = Number(incomingState.secondsLeft);
  const secondsLeft = Number.isFinite(previousSeconds) && Number.isFinite(incomingSeconds)
    ? Math.min(previousSeconds, incomingSeconds)
    : Number.isFinite(incomingSeconds) ? incomingSeconds : previousSeconds;

  const mergedState = {
    ...previousState,
    ...incomingState,
    revision: Math.max(previousStateRevision, incomingStateRevision),
    secondsLeft,
    prompts: incomingOwnsRunway
      ? (Array.isArray(incomingState.prompts) ? incomingState.prompts : [])
      : (Array.isArray(previousState.prompts) ? previousState.prompts : []),
    inputPrompts: incomingOwnsRunway
      ? (Array.isArray(incomingState.inputPrompts) ? incomingState.inputPrompts : incomingState.prompts || [])
      : (Array.isArray(previousState.inputPrompts) ? previousState.inputPrompts : previousState.prompts || []),
    me: mergePlayerProgress(previousState.me, incomingState.me),
    opponent: mergePlayerProgress(previousState.opponent, incomingState.opponent),
    completedAt: incomingState.completedAt || previousState.completedAt || null,
    winnerUserId: incomingOwnsLifecycle
      ? String(incomingState.winnerUserId || previousState.winnerUserId || '')
      : String(previousState.winnerUserId || incomingState.winnerUserId || ''),
    viewerWon: incomingOwnsLifecycle ? Boolean(incomingState.viewerWon) : Boolean(previousState.viewerWon),
    tie: incomingOwnsLifecycle ? Boolean(incomingState.tie) : Boolean(previousState.tie)
  };

  return {
    ...previousGame,
    ...incomingGame,
    status: incomingOwnsLifecycle ? incomingGame.status : previousGame.status,
    revision: Math.max(Number(previousGame.revision) || 0, Number(incomingGame?.revision) || 0),
    mountainraceState: mergedState
  };
}

function generatedAcceptsSnapshot(game) {
  if (!runtime.game || String(runtime.game.gameId || '') !== String(game?.gameId || '')) return true;
  const accepted = snapshotVersion(runtime.game);
  const incoming = snapshotVersion(game);
  const differentRound = Boolean(accepted.roundId && incoming.roundId && accepted.roundId !== incoming.roundId);
  const stale = differentRound && incoming.statusRank <= accepted.statusRank;
  if (stale) {
    window.__mountainRaceRejectedSnapshots = Number(window.__mountainRaceRejectedSnapshots || 0) + 1;
    return false;
  }
  return true;
}

function generatedScheduleInputFlush(immediate = false) {
  if (runtime.inputFlushTimer) window.clearTimeout(runtime.inputFlushTimer);
  runtime.inputFlushTimer = window.setTimeout(() => {
    runtime.inputFlushTimer = 0;
    flushInputQueue();
  }, immediate ? 0 : 90);
}

async function generatedFlushInputQueue() {
  if (runtime.inputBatchInFlight.length || runtime.game?.status !== 'playing') return;
  const batch = runtime.inputQueue.filter(item => item.status === 'queued').slice(0, 8);
  if (!batch.length) return;
  const bridge = window.__mountainRaceBridge;
  if (!bridge?.submit) return;

  batch.forEach(item => { item.status = 'sending'; });
  runtime.inputBatchInFlight = batch.map(item => item.actionId);
  syncPendingCompatibility();

  try {
    const data = await bridge.submit({
      choice: 'mountainrace:batch',
      inputBatch: batch.map(item => ({
        control: item.token,
        expectedControl: item.expected,
        expectedPromptIndex: item.fromIndex,
        actionId: item.actionId
      }))
    });

    const confirmed = new Set(Array.isArray(data?.confirmedActionIds) ? data.confirmedActionIds.map(String) : []);
    const ignored = new Set(Array.isArray(data?.ignoredActionIds) ? data.ignoredActionIds.map(String) : []);
    const authoritativeIndex = Math.max(0, Math.trunc(Number(data?.game?.mountainraceState?.me?.promptIndex) || 0));
    for (const item of batch) {
      if (!confirmed.has(item.actionId) && item.correct && item.fromIndex < authoritativeIndex) confirmed.add(item.actionId);
    }

    runtime.inputQueue = runtime.inputQueue.filter(item => !confirmed.has(item.actionId) && !ignored.has(item.actionId));
    for (const item of runtime.inputQueue) {
      if (runtime.inputBatchInFlight.includes(item.actionId)) item.status = 'queued';
    }
    runtime.inputBatchInFlight = [];
    runtime.inputQueueBlocked = runtime.inputQueue.some(item => !item.correct);
    runtime.syncNotice = ignored.size
      ? 'The course changed before part of that queue arrived. Continue from the highlighted arrow.'
      : '';
    syncPendingCompatibility();

    if (data?.game) adopt(data.game, { source: 'continuous-batch-response' });
    else window.__mountainRaceBridge?.refresh?.();
    if (runtime.inputQueue.some(item => item.status === 'queued')) scheduleInputFlush(true);
    else render();
  } catch (error) {
    for (const item of runtime.inputQueue) {
      if (runtime.inputBatchInFlight.includes(item.actionId)) item.status = 'queued';
    }
    runtime.inputBatchInFlight = [];
    runtime.syncNotice = String(error?.message || 'Unable to confirm those queued moves. Retrying safely…');
    syncPendingCompatibility();
    render();
    scheduleInputFlush(false);
  }
}

async function generatedSubmit(rawToken) {
  const publicState = state();
  const bridge = window.__mountainRaceBridge;
  if (!bridge?.submit || runtime.game?.status !== 'playing' || !publicState.canSubmit || runtime.inputQueueBlocked) return;

  const total = Math.max(8, Math.min(80, Math.trunc(Number(publicState.stepsTotal) || 24)));
  const rawRunway = Array.isArray(publicState.inputPrompts) && publicState.inputPrompts.length
    ? publicState.inputPrompts
    : publicState.prompts;
  const authoritativePrompts = Array.isArray(rawRunway) ? rawRunway.map(control) : [];
  const presentation = optimisticPresentation(publicState, authoritativePrompts, total);
  if (!presentation.prompts.length || presentation.blocked) return;

  const token = control(rawToken);
  const expected = presentation.prompts[0];
  const fromIndex = presentation.me.promptIndex;
  const actionId = `mrq-${Date.now()}-${++runtime.inputSequence}-${Math.random().toString(36).slice(2, 8)}`;
  const item = {
    token,
    expected,
    correct: token === expected,
    fromIndex,
    actionId,
    roundId: String(publicState.roundId || ''),
    at: `pending-${actionId}`,
    order: runtime.inputSequence,
    status: 'queued'
  };
  runtime.inputQueue.push(item);
  runtime.inputQueueBlocked = !item.correct;
  runtime.syncNotice = '';
  syncPendingCompatibility();
  if (navigator.vibrate) navigator.vibrate(item.correct ? 12 : [22, 30, 22]);
  render();

  const queuedCount = runtime.inputQueue.filter(entry => entry.status === 'queued').length;
  scheduleInputFlush(!item.correct || queuedCount >= 8);
}

function generatedAdopt(game, options = {}) {
  if (!game || game.mode !== MODE) return false;
  const previousGame = runtime.game;
  const gameChanged = Boolean(previousGame && String(previousGame.gameId || '') !== String(game.gameId || ''));
  const resolvingPending = Boolean(options.actionResolved
    && (!runtime.pendingActionId || !options.actionId || options.actionId === runtime.pendingActionId));

  if (!gameChanged && !acceptsSnapshot(game)) {
    if (resolvingPending) {
      finishPendingAction(options.actionId || '');
      runtime.syncNotice = options.ignoreReason === 'prompt-changed'
        ? 'The course advanced while that move was traveling. Follow the highlighted direction.'
        : '';
      render();
    }
    restoreAcceptedBoard();
    startTicker();
    return false;
  }

  if (gameChanged) {
    clearInputQueue();
    runtime.syncNotice = '';
    runtime.renderKey = '';
    if (runtime.resultRevealTimer) window.clearTimeout(runtime.resultRevealTimer);
    runtime.resultRevealTimer = 0;
    runtime.resultRevealGameId = '';
    runtime.resultRevealReady = false;
  }

  const mergedGame = previousGame && !gameChanged ? mergeMountainRaceGame(previousGame, game) : game;
  const nextRenderKey = meaningfulRenderKey(mergedGame);
  const hadPending = Boolean(runtime.inputQueue.length || runtime.busy);
  const sameMeaningfulState = Boolean(previousGame?.gameId === mergedGame.gameId
    && runtime.renderKey === nextRenderKey
    && !hadPending
    && !resolvingPending);
  const confirmedInputAt = mergedGame.mountainraceState?.me?.lastInput?.at || '';
  if (runtime.pendingInput && confirmedInputAt) runtime.lastMyInputAt = confirmedInputAt;
  runtime.game = mergedGame;
  updateServerClock(mergedGame);
  scheduleResultReveal(previousGame, mergedGame);
  if (String(mergedGame.status || '') !== 'playing' && runtime.inputQueue.length) clearInputQueue();

  if (resolvingPending) {
    finishPendingAction(options.actionId || '');
    runtime.syncNotice = options.ignoreReason === 'prompt-changed'
      ? 'The course advanced while that move was traveling. Follow the highlighted direction.'
      : options.ignoredAction
        ? 'That duplicate move was ignored. The highlighted direction is current.'
        : '';
  }

  if (sameMeaningfulState && runtime.root?.isConnected) {
    updateClock();
    startTicker();
    return true;
  }
  runtime.renderKey = nextRenderKey;
  render();
  startTicker();
  return true;
}

function generatedMountainRaceAcceptSnapshot(game) {
  if (String(game?.mode || '') !== 'mountainrace' || !game?.gameId) return true;
  const id = String(game.gameId);
  const incoming = mountainRaceSnapshotVersion(game);
  const accepted = mountainRaceAcceptedSnapshotByGame.get(id);
  const differentRound = Boolean(accepted?.roundId && incoming.roundId && accepted.roundId !== incoming.roundId);
  if (accepted && differentRound && incoming.statusRank <= accepted.statusRank) {
    window.__mountainRaceSharedRejectedSnapshots = Number(window.__mountainRaceSharedRejectedSnapshots || 0) + 1;
    return false;
  }
  mountainRaceAcceptedSnapshotByGame.set(id, accepted ? {
    statusRank: Math.max(accepted.statusRank, incoming.statusRank),
    gameRevision: Math.max(accepted.gameRevision, incoming.gameRevision),
    stateRevision: Math.max(accepted.stateRevision, incoming.stateRevision),
    roundId: incoming.roundId || accepted.roundId
  } : incoming);
  return true;
}

let client = await readFile(clientUrl, 'utf8');
if (!client.includes(marker)) {
  client = replaceRequired(
    client,
    '  // MOUNTAIN_RACE_INSTANT_INPUT_QUEUE_V5',
    `  // MOUNTAIN_RACE_INSTANT_INPUT_QUEUE_V5\n  ${marker}`,
    'client marker'
  );

  const mergeHelpers = [
    indentFunction(generatedInputTimestamp, 'inputTimestamp'),
    indentFunction(generatedNewerInput, 'newerInput'),
    indentFunction(generatedMergePlayerProgress, 'mergePlayerProgress'),
    indentFunction(generatedMergeMountainRaceGame, 'mergeMountainRaceGame')
  ].join('\n\n');
  client = replaceRequired(
    client,
    '  function optimisticPresentation(publicState, prompts, total) {',
    `${mergeHelpers}\n\n  function optimisticPresentation(publicState, prompts, total) {`,
    'component-wise snapshot merge helpers'
  );

  client = replaceFunction(
    client,
    '  function acceptsSnapshot(',
    indentFunction(generatedAcceptsSnapshot, 'acceptsSnapshot'),
    'same-round component snapshot acceptance'
  );
  client = replaceFunction(
    client,
    '  function scheduleInputFlush(',
    indentFunction(generatedScheduleInputFlush, 'scheduleInputFlush'),
    'continuous flush cadence'
  );
  client = replaceFunction(
    client,
    '  async function flushInputQueue(',
    indentFunction(generatedFlushInputQueue, 'flushInputQueue'),
    'eight-move continuous flush'
  );
  client = replaceFunction(
    client,
    '  async function submit(',
    indentFunction(generatedSubmit, 'submit'),
    'full-runway immediate submit'
  );
  client = replaceFunction(
    client,
    '  function adopt(',
    indentFunction(generatedAdopt, 'adopt'),
    'component-wise monotonic adoption'
  );

  client = replaceRequired(
    client,
    `    const authoritativePrompts = Array.isArray(publicState.prompts) ? publicState.prompts.map(control).slice(0, 4) : [];
    const presentation = optimisticPresentation(publicState, authoritativePrompts, total);
    const prompts = presentation.prompts;`,
    `    const rawRunway = Array.isArray(publicState.inputPrompts) && publicState.inputPrompts.length ? publicState.inputPrompts : publicState.prompts;
    const authoritativePrompts = Array.isArray(rawRunway) ? rawRunway.map(control) : [];
    const presentation = optimisticPresentation(publicState, authoritativePrompts, total);
    const prompts = presentation.prompts.slice(0, 4);`,
    'four-visible/full-private prompt rendering'
  );
  client = replaceRequired(
    client,
    `  window.MountainRaceMultiplayer = Object.freeze({ adopt, render, submit, acceptsSnapshot, snapshotVersion, compareSnapshotVersions, scheduleBotWake, flushInputQueue, clearInputQueue });`,
    `  window.MountainRaceMultiplayer = Object.freeze({ adopt, render, submit, acceptsSnapshot, snapshotVersion, compareSnapshotVersions, scheduleBotWake, flushInputQueue, clearInputQueue, mergeMountainRaceGame });`,
    'continuous sync diagnostics export'
  );
}

if (!client.includes(marker)) throw new Error('Summit Sprint continuous-sync client marker is missing.');
if (!client.includes('function mergeMountainRaceGame(')) throw new Error('Summit Sprint does not merge climber progress independently.');
if (!client.includes('inputPrompts') || !client.includes('presentation.prompts.slice(0, 4)')) throw new Error('Summit Sprint does not keep a full private runway behind four visible prompts.');
if (!client.includes("slice(0, 8)")) throw new Error('Summit Sprint client does not send eight queued moves per request.');
if (!client.includes('}, immediate ? 0 : 90);')) throw new Error('Summit Sprint queue flush cadence is still too slow.');
await writeFile(clientUrl, client);

let html = await readFile(indexUrl, 'utf8');
if (!html.includes(htmlMarker)) {
  const anchor = html.includes('</body>') ? '</body>' : html.includes('</html>') ? '</html>' : '';
  html = anchor ? html.replace(anchor, `${htmlMarker}\n${anchor}`) : `${html}\n${htmlMarker}\n`;
}
html = replaceFunction(
  html,
  '    function mountainRaceAcceptSnapshot(',
  indentFunction(generatedMountainRaceAcceptSnapshot, 'mountainRaceAcceptSnapshot').replace(/^  /gm, '  '),
  'shared same-round snapshot acceptance'
);
html = html
  .replaceAll('mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=5', 'mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=6')
  .replaceAll('&sync=6&sync=6', '&sync=6');

if (!html.includes(htmlMarker)) throw new Error('Summit Sprint continuous-sync deployment marker is missing.');
if (!html.includes('differentRound && incoming.statusRank <= accepted.statusRank')) throw new Error('Shared Summit Sprint guard still rejects useful same-round opponent progress.');
if (!html.includes('mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=6')) throw new Error('Fresh Summit Sprint continuous-sync cache boundary is missing.');
await writeFile(indexUrl, html);

console.log('Added Summit Sprint Continuous Sync V6: uninterrupted full-race local input, eight-move network batches, four-arrow display, and component-wise forward-only merging for both climbers.');
