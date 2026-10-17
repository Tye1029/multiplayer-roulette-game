import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const clientUrl = new URL('assets/mountain-race/mountain-race-multiplayer.js', root);
const indexUrl = new URL('index.html', root);
const marker = '// MOUNTAIN_RACE_INPUT_REBASE_V8';
const htmlMarker = '<!-- MOUNTAIN_RACE_INPUT_REBASE_V8 -->';

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Summit Sprint input-rebase patch could not find ${label}.`);
  return source.replace(before, after);
}

function replaceFunction(source, signature, replacement, label) {
  const start = source.indexOf(signature);
  if (start < 0) throw new Error(`Summit Sprint input-rebase patch could not find ${label}.`);
  const paramsStart = source.indexOf('(', start);
  if (paramsStart < 0) throw new Error(`Summit Sprint input-rebase patch could not parse ${label}.`);

  let parenDepth = 0;
  let bodyStart = -1;
  let quote = '';
  let escaped = false;
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
  if (bodyStart < 0) throw new Error(`Summit Sprint input-rebase patch could not find ${label} body.`);

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
  throw new Error(`Summit Sprint input-rebase patch could not close ${label}.`);
}

function indentFunction(fn, replacementName) {
  const renamed = fn.toString().replace(fn.name, replacementName);
  return renamed.split('\n').map(line => `  ${line}`).join('\n');
}

function generatedAuthoritativeSlip(previousPlayer = {}, incomingPlayer = {}, previousRevision = -1, incomingRevision = -1) {
  const previousIndex = Math.max(0, Math.trunc(Number(previousPlayer.promptIndex) || 0));
  const incomingIndex = Math.max(0, Math.trunc(Number(incomingPlayer.promptIndex) || 0));
  if (incomingIndex >= previousIndex || Number(incomingRevision) < Number(previousRevision)) return false;

  const incomingInput = incomingPlayer.lastInput;
  if (!incomingInput || incomingInput.correct !== false) return false;
  const incomingTime = inputTimestamp(incomingInput);
  const previousTime = inputTimestamp(previousPlayer.lastInput);
  return incomingTime > previousTime;
}

function generatedMergePlayerProgress(previousPlayer = {}, incomingPlayer = {}, options = {}) {
  const previousIndex = Math.max(0, Math.trunc(Number(previousPlayer.promptIndex) || 0));
  const incomingIndex = Math.max(0, Math.trunc(Number(incomingPlayer.promptIndex) || 0));
  const allowBackward = Boolean(options.allowBackward);
  const promptIndex = allowBackward ? incomingIndex : Math.max(previousIndex, incomingIndex);
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
    progress: allowBackward
      ? Math.max(0, Number(incomingPlayer.progress) || 0)
      : Math.max(Number(previousPlayer.progress) || 0, Number(incomingPlayer.progress) || 0),
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
  const ownSlip = authoritativeSlip(previousState.me, incomingState.me, previousStateRevision, incomingStateRevision);
  const opponentSlip = authoritativeSlip(previousState.opponent, incomingState.opponent, previousStateRevision, incomingStateRevision);
  const incomingOwnsRunway = ownSlip
    || incomingMeIndex > previousMeIndex
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
    me: mergePlayerProgress(previousState.me, incomingState.me, { allowBackward: ownSlip }),
    opponent: mergePlayerProgress(previousState.opponent, incomingState.opponent, { allowBackward: opponentSlip }),
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

function generatedRebaseInputQueueAgainstGame(game) {
  const publicState = game?.mountainraceState || {};
  const roundId = String(publicState.roundId || '');
  const startIndex = Math.max(0, Math.trunc(Number(publicState.me?.promptIndex) || 0));
  const rawRunway = Array.isArray(publicState.inputPrompts) && publicState.inputPrompts.length
    ? publicState.inputPrompts
    : publicState.prompts;
  const runway = Array.isArray(rawRunway) ? rawRunway.map(control) : [];
  const ordered = runtime.inputQueue.slice().sort((a, b) => a.order - b.order);
  const kept = [];
  let expectedIndex = startIndex;
  let blocked = false;
  let dropped = 0;

  for (const item of ordered) {
    const expected = runway[expectedIndex - startIndex] || '';
    const valid = !blocked
      && item.roundId === roundId
      && item.fromIndex === expectedIndex
      && Boolean(expected)
      && item.expected === expected;
    if (!valid) {
      dropped += 1;
      continue;
    }

    kept.push(item);
    if (item.token === expected) expectedIndex += 1;
    else blocked = true;
  }

  runtime.inputQueue = kept;
  if (dropped) {
    window.__mountainRaceQueueRebases = Number(window.__mountainRaceQueueRebases || 0) + dropped;
  }
  return dropped;
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
    const rebased = data?.game ? rebaseInputQueueAgainstGame(data.game) : 0;
    runtime.inputQueueBlocked = runtime.inputQueue.some(item => !item.correct);
    runtime.syncNotice = ignored.size || rebased
      ? 'Course re-aligned — no extra mistake was counted. Keep climbing from the highlighted arrow.'
      : '';
    syncPendingCompatibility();

    if (data?.game) adopt(data.game, { source: 'input-rebase-response' });
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

async function generatedSubmit(rawToken, displayed = null) {
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

  const currentExpected = presentation.prompts[0];
  const currentIndex = Math.max(0, Math.trunc(Number(presentation.me?.promptIndex) || 0));
  const currentRound = String(publicState.roundId || '');
  const displayedExpectedRaw = String(displayed?.expected || '').toLowerCase();
  const displayedExpected = CONTROLS.includes(displayedExpectedRaw) ? displayedExpectedRaw : '';
  const displayedIndex = Number(displayed?.promptIndex);
  const displayedRound = String(displayed?.roundId || '');
  const hasDisplayedSnapshot = Boolean(displayed && displayedExpected && Number.isFinite(displayedIndex) && displayedIndex >= 0 && displayedRound);

  if (displayed && (!hasDisplayedSnapshot
    || displayedRound !== currentRound
    || Math.trunc(displayedIndex) !== currentIndex
    || displayedExpected !== currentExpected)) {
    window.__mountainRaceVisualRebases = Number(window.__mountainRaceVisualRebases || 0) + 1;
    runtime.syncNotice = 'The arrow refreshed during that tap. No mistake counted — use the highlighted arrow.';
    render();
    bridge.refresh?.();
    return;
  }

  const token = control(rawToken);
  const expected = hasDisplayedSnapshot ? displayedExpected : currentExpected;
  const fromIndex = hasDisplayedSnapshot ? Math.trunc(displayedIndex) : currentIndex;
  const actionId = `mrq-${Date.now()}-${++runtime.inputSequence}-${Math.random().toString(36).slice(2, 8)}`;
  const item = {
    token,
    expected,
    correct: token === expected,
    fromIndex,
    actionId,
    roundId: currentRound,
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

function generatedOnPointerDown(event) {
  const input = event.target.closest('[data-mr-network-input]');
  if (input && runtime.root?.contains(input) && !input.disabled) {
    event.preventDefault();
    submit(input.dataset.mrNetworkInput, {
      expected: input.dataset.mrDisplayedExpected || '',
      promptIndex: input.dataset.mrDisplayedIndex,
      roundId: input.dataset.mrDisplayedRound || ''
    });
    return;
  }
  if (event.target.closest('[data-mr-rematch]')) {
    event.preventDefault();
    window.__mountainRaceBridge?.rematch?.();
    return;
  }
  if (event.target.closest('[data-mr-new-game]')) {
    event.preventDefault();
    window.__mountainRaceBridge?.newGame?.();
  }
}

let client = await readFile(clientUrl, 'utf8');
if (!client.includes(marker)) {
  client = replaceRequired(
    client,
    '  // MOUNTAIN_RACE_STARTUP_COMPLETION_V7',
    `  // MOUNTAIN_RACE_STARTUP_COMPLETION_V7\n  ${marker}`,
    'client marker'
  );

  client = replaceRequired(
    client,
    '  function mergePlayerProgress(previousPlayer = {}, incomingPlayer = {}) {',
    `${indentFunction(generatedAuthoritativeSlip, 'authoritativeSlip')}\n\n  function mergePlayerProgress(previousPlayer = {}, incomingPlayer = {}) {`,
    'authoritative slip helper'
  );
  client = replaceFunction(
    client,
    '  function mergePlayerProgress(',
    indentFunction(generatedMergePlayerProgress, 'mergePlayerProgress'),
    'slip-aware player merge'
  );
  client = replaceFunction(
    client,
    '  function mergeMountainRaceGame(',
    indentFunction(generatedMergeMountainRaceGame, 'mergeMountainRaceGame'),
    'slip-aware course merge'
  );

  client = replaceRequired(
    client,
    '  async function flushInputQueue() {',
    `${indentFunction(generatedRebaseInputQueueAgainstGame, 'rebaseInputQueueAgainstGame')}\n\n  async function flushInputQueue() {`,
    'queue rebase helper'
  );
  client = replaceFunction(
    client,
    '  async function flushInputQueue(',
    indentFunction(generatedFlushInputQueue, 'flushInputQueue'),
    'authoritative queue rebase'
  );
  client = replaceFunction(
    client,
    '  async function submit(',
    indentFunction(generatedSubmit, 'submit'),
    'display-snapshot submit'
  );
  client = replaceFunction(
    client,
    '  function onPointerDown(',
    indentFunction(generatedOnPointerDown, 'onPointerDown'),
    'display-snapshot pointer input'
  );

  client = replaceRequired(
    client,
    'data-mr-network-input="${token}" ${controlsEnabled ? \'\' : \'disabled\'}',
    'data-mr-network-input="${token}" data-mr-displayed-expected="${escapeHtml(presentation.prompts[0] || \'\')}" data-mr-displayed-index="${Math.max(0, Math.trunc(Number(presentation.me?.promptIndex) || 0))}" data-mr-displayed-round="${escapeHtml(publicState.roundId || \'\')}" ${controlsEnabled ? \'\' : \'disabled\'}',
    'rendered prompt snapshot metadata'
  );
  client = replaceRequired(
    client,
    'window.MountainRaceMultiplayer = Object.freeze({ adopt, render, submit, acceptsSnapshot, snapshotVersion, compareSnapshotVersions, scheduleBotWake, flushInputQueue, clearInputQueue, mergeMountainRaceGame });',
    'window.MountainRaceMultiplayer = Object.freeze({ adopt, render, submit, acceptsSnapshot, snapshotVersion, compareSnapshotVersions, scheduleBotWake, flushInputQueue, clearInputQueue, mergeMountainRaceGame, authoritativeSlip, rebaseInputQueueAgainstGame });',
    'input rebase diagnostics export'
  );
}

if (!client.includes(marker)) throw new Error('Summit Sprint input-rebase client marker is missing.');
if (!client.includes('function authoritativeSlip(')) throw new Error('Summit Sprint does not recognize an authoritative slip.');
if (!client.includes('incomingOwnsRunway = ownSlip')) throw new Error('Summit Sprint still keeps the pre-slip prompt runway.');
if (!client.includes('function rebaseInputQueueAgainstGame(')) throw new Error('Summit Sprint does not clear queued moves from the old height.');
if (!client.includes('data-mr-displayed-expected=')) throw new Error('Summit Sprint taps are not tied to the arrow actually shown.');
if (!client.includes('The arrow refreshed during that tap. No mistake counted')) throw new Error('Summit Sprint can still score a visually stale tap.');
await writeFile(clientUrl, client);

let html = await readFile(indexUrl, 'utf8');
if (!html.includes(htmlMarker)) {
  const anchor = html.includes('</body>') ? '</body>' : html.includes('</html>') ? '</html>' : '';
  html = anchor ? html.replace(anchor, `${htmlMarker}\n${anchor}`) : `${html}\n${htmlMarker}\n`;
}
html = html
  .replaceAll('mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=7', 'mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=8')
  .replaceAll('&sync=8&sync=8', '&sync=8');

if (!html.includes(htmlMarker)) throw new Error('Summit Sprint input-rebase deployment marker is missing.');
if (!html.includes('mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=8')) throw new Error('Summit Sprint V8 cache boundary is missing.');
await writeFile(indexUrl, html);

console.log('Added Summit Sprint Input Rebase V8: authoritative slips move the client back to the real hold, queued moves from the old height are discarded, and taps are validated against the exact arrow shown before any mistake can be scored.');
