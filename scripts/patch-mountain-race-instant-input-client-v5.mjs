import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const clientUrl = new URL('assets/mountain-race/mountain-race-multiplayer.js', root);
const indexUrl = new URL('index.html', root);
const marker = '// MOUNTAIN_RACE_INSTANT_INPUT_QUEUE_V5';
const htmlMarker = '<!-- MOUNTAIN_RACE_INSTANT_INPUT_QUEUE_V5 -->';

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Summit Sprint instant-input client patch could not find ${label}.`);
  return source.replace(before, after);
}

function replaceFunction(source, signature, replacement, label) {
  const start = source.indexOf(signature);
  if (start < 0) throw new Error(`Summit Sprint instant-input client patch could not find ${label}.`);
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
  if (bodyStart < 0) throw new Error(`Summit Sprint instant-input client patch could not parse ${label}.`);

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
  throw new Error(`Summit Sprint instant-input client patch could not close ${label}.`);
}

function indentFunction(fn, replacementName) {
  const renamed = fn.toString().replace(fn.name, replacementName);
  return renamed.split('\n').map(line => `  ${line}`).join('\n');
}

function generatedOptimisticPresentation(publicState, prompts, total) {
  const authoritativeMe = player(publicState.me, 'YOU', 'YOU');
  const roundId = String(publicState.roundId || '');
  const pending = runtime.inputQueue
    .filter(item => item.roundId === roundId && item.fromIndex >= authoritativeMe.promptIndex)
    .sort((a, b) => a.order - b.order);
  if (!pending.length) {
    return { authoritativeMe, me: authoritativeMe, prompts, animation: '', tone: '', queueDepth: 0, blocked: false };
  }

  const me = { ...authoritativeMe };
  let consumedPrompts = 0;
  let last = null;
  let blocked = false;
  for (const item of pending) {
    if (item.fromIndex !== me.promptIndex) break;
    const currentExpected = prompts[consumedPrompts] || '';
    if (!currentExpected || item.expected !== currentExpected) {
      blocked = true;
      break;
    }
    const correct = item.token === item.expected;
    last = item;
    me.lastInput = { control: item.token, correct, at: item.at };
    if (correct) {
      me.promptIndex = Math.min(total, me.promptIndex + 1);
      consumedPrompts += 1;
    } else {
      me.promptIndex = Math.max(0, me.promptIndex - 1);
      me.rejectedInputs += 1;
      blocked = true;
      break;
    }
  }

  return {
    authoritativeMe,
    me,
    prompts: blocked ? [] : prompts.slice(consumedPrompts),
    animation: last ? (last.correct ? `climb-${last.token}` : 'slip') : '',
    tone: last ? (last.correct ? 'correct' : 'wrong') : '',
    queueDepth: pending.length,
    blocked
  };
}

function generatedStatusText(publicState) {
  if (runtime.syncNotice) return runtime.syncNotice;
  if (runtime.game?.status === 'complete' && !runtime.resultRevealReady) return 'Summit confirmed — finishing the climb!';
  if (runtime.inputQueue.length) {
    if (runtime.inputQueueBlocked) return 'Wrong direction queued — confirming the slip before the next arrow.';
    const count = runtime.inputQueue.length;
    return `${count} ${count === 1 ? 'move' : 'moves'} queued — keep pressing the highlighted arrows!`;
  }
  if (runtime.game?.status === 'countdown') return 'Get ready. The race begins at GO!';
  if (runtime.game?.status === 'complete') {
    if (publicState.tie) return 'Both climbers finished at the same height.';
    return publicState.viewerWon ? 'You reached the summit first!' : `${publicState.opponent?.name || 'Your opponent'} won the climb.`;
  }
  const last = publicState.me?.lastInput;
  if (!last) return 'Follow the highlighted direction. Wrong inputs cost one hold.';
  return last.correct ? 'Correct move. Keep climbing!' : 'Wrong direction. You slipped back one hold.';
}

function generatedSyncPendingCompatibility() {
  const first = runtime.inputQueue[0] || null;
  runtime.pendingInput = first ? {
    token: first.token,
    expected: first.expected,
    correct: first.correct,
    fromIndex: first.fromIndex,
    at: first.at
  } : null;
  runtime.pendingActionId = first?.actionId || '';
  runtime.busy = false;
}

function generatedClearInputQueue() {
  if (runtime.inputFlushTimer) window.clearTimeout(runtime.inputFlushTimer);
  runtime.inputFlushTimer = 0;
  runtime.inputQueue = [];
  runtime.inputBatchInFlight = [];
  runtime.inputQueueBlocked = false;
  syncPendingCompatibility();
}

function generatedScheduleInputFlush(immediate = false) {
  if (runtime.inputFlushTimer) window.clearTimeout(runtime.inputFlushTimer);
  runtime.inputFlushTimer = window.setTimeout(() => {
    runtime.inputFlushTimer = 0;
    flushInputQueue();
  }, immediate ? 0 : 220);
}

async function generatedFlushInputQueue() {
  if (runtime.inputBatchInFlight.length || runtime.game?.status !== 'playing') return;
  const batch = runtime.inputQueue.filter(item => item.status === 'queued').slice(0, 4);
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

    if (data?.game) adopt(data.game, { source: 'queued-action-response' });
    else window.__mountainRaceBridge?.refresh?.();
    if (data?.wakeBot) scheduleBotWake();
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
  const authoritativePrompts = Array.isArray(publicState.prompts) ? publicState.prompts.map(control).slice(0, 4) : [];
  const presentation = optimisticPresentation(publicState, authoritativePrompts, total);
  if (!presentation.prompts.length || presentation.blocked) {
    bridge.refresh?.();
    return;
  }

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
  scheduleInputFlush(!item.correct || queuedCount >= 4);
}

let client = await readFile(clientUrl, 'utf8');
if (!client.includes(marker)) {
  client = replaceRequired(
    client,
    '  // MOUNTAIN_RACE_LOW_LATENCY_INPUTS_V4',
    `  // MOUNTAIN_RACE_LOW_LATENCY_INPUTS_V4\n  ${marker}`,
    'client marker'
  );
  client = replaceRequired(
    client,
    `    botWakeTimer: 0,
    botWakeInFlight: false`,
    `    botWakeTimer: 0,
    botWakeInFlight: false,
    inputQueue: [],
    inputSequence: 0,
    inputFlushTimer: 0,
    inputBatchInFlight: [],
    inputQueueBlocked: false`,
    'queue runtime state'
  );

  client = replaceFunction(
    client,
    '  function optimisticPresentation(',
    indentFunction(generatedOptimisticPresentation, 'optimisticPresentation'),
    'optimistic queue presentation'
  );
  client = replaceFunction(
    client,
    '  function statusText(',
    indentFunction(generatedStatusText, 'statusText'),
    'queue status text'
  );
  client = replaceRequired(
    client,
    `    const controlsEnabled = runtime.game.status === 'playing' && publicState.canSubmit && !runtime.busy;`,
    `    const controlsEnabled = runtime.game.status === 'playing' && publicState.canSubmit && prompts.length > 0 && !presentation.blocked && !runtime.inputQueueBlocked;`,
    'immediate controls policy'
  );

  const helpers = [
    indentFunction(generatedSyncPendingCompatibility, 'syncPendingCompatibility'),
    indentFunction(generatedClearInputQueue, 'clearInputQueue'),
    indentFunction(generatedScheduleInputFlush, 'scheduleInputFlush'),
    indentFunction(generatedFlushInputQueue, 'flushInputQueue')
  ].join('\n\n');
  client = replaceRequired(
    client,
    '  async function submit(rawToken) {',
    `${helpers}\n\n  async function submit(rawToken) {`,
    'queue helpers'
  );
  client = replaceFunction(
    client,
    '  async function submit(',
    indentFunction(generatedSubmit, 'submit'),
    'queued submit'
  );

  client = replaceRequired(
    client,
    `    if (gameChanged) {
      finishPendingAction();
      runtime.syncNotice = '';`,
    `    if (gameChanged) {
      clearInputQueue();
      runtime.syncNotice = '';`,
    'new-game queue cleanup'
  );
  client = replaceRequired(
    client,
    `    scheduleResultReveal(previousGame, game);

    if (resolvingPending) {`,
    `    scheduleResultReveal(previousGame, game);
    if (String(game.status || '') !== 'playing' && runtime.inputQueue.length) clearInputQueue();

    if (resolvingPending) {`,
    'completed-game queue cleanup'
  );
  client = replaceRequired(
    client,
    `  window.MountainRaceMultiplayer = Object.freeze({ adopt, render, submit, acceptsSnapshot, snapshotVersion, compareSnapshotVersions, scheduleBotWake });`,
    `  window.MountainRaceMultiplayer = Object.freeze({ adopt, render, submit, acceptsSnapshot, snapshotVersion, compareSnapshotVersions, scheduleBotWake, flushInputQueue, clearInputQueue });`,
    'queue diagnostics export'
  );
}

if (!client.includes(marker)) throw new Error('Summit Sprint instant-input client marker is missing.');
if (!client.includes('inputQueue: []')) throw new Error('Summit Sprint client does not retain rapid taps.');
if (!client.includes('async function flushInputQueue()')) throw new Error('Summit Sprint client does not batch queued taps.');
if (!client.includes("choice: 'mountainrace:batch'")) throw new Error('Summit Sprint client still sends one request per arrow.');
if (!client.includes('prompts.length > 0 && !presentation.blocked && !runtime.inputQueueBlocked')) throw new Error('Summit Sprint controls still wait for each response.');
await writeFile(clientUrl, client);

let html = await readFile(indexUrl, 'utf8');
if (!html.includes(htmlMarker)) {
  const anchor = html.includes('</body>') ? '</body>' : html.includes('</html>') ? '</html>' : '';
  html = anchor ? html.replace(anchor, `${htmlMarker}\n${anchor}`) : `${html}\n${htmlMarker}\n`;
}
html = html
  .replaceAll('mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=4', 'mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=5')
  .replaceAll('&sync=5&sync=5', '&sync=5');
if (!html.includes('mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=5')) throw new Error('Fresh instant-input cache boundary is missing.');
await writeFile(indexUrl, html);

console.log('Enabled immediate Summit Sprint controls with optimistic prompt shifts and one queued batch request for up to four rapid taps.');
