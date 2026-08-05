import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const integrationUrl = new URL('netlify/functions/mountain-race/integration.js', root);
const clientUrl = new URL('assets/mountain-race/mountain-race-multiplayer.js', root);
const actionUrl = new URL('netlify/functions/duel-action.js', root);
const indexUrl = new URL('index.html', root);
const integrationMarker = '// MOUNTAIN_RACE_INSTANT_INPUT_QUEUE_V5';
const clientMarker = '// MOUNTAIN_RACE_INSTANT_INPUT_QUEUE_V5';
const htmlMarker = '<!-- MOUNTAIN_RACE_INSTANT_INPUT_QUEUE_V5 -->';

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Summit Sprint instant-input patch could not find ${label}.`);
  return source.replace(before, after);
}

function replaceFunction(source, signature, replacement, label) {
  const start = source.indexOf(signature);
  if (start < 0) throw new Error(`Summit Sprint instant-input patch could not find ${label}.`);
  const paramsStart = source.indexOf('(', start);
  if (paramsStart < 0) throw new Error(`Summit Sprint instant-input patch could not parse ${label} parameters.`);

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
  if (bodyStart < 0) throw new Error(`Summit Sprint instant-input patch could not find ${label} body.`);

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
  throw new Error(`Summit Sprint instant-input patch could not close ${label}.`);
}

let integration = await readFile(integrationUrl, 'utf8');

if (!integration.includes(integrationMarker)) {
  integration = replaceRequired(
    integration,
    '// MOUNTAIN_RACE_LOW_LATENCY_INPUTS_V4',
    `// MOUNTAIN_RACE_LOW_LATENCY_INPUTS_V4\n${integrationMarker}`,
    'server marker'
  );

  const batchHelpers = `  function mountainRaceBatchItems(details = {}) {
    const rawItems = Array.isArray(details.inputBatch) ? details.inputBatch.slice(0, 4) : [];
    return rawItems.map((raw, order) => {
      const submittedControl = normalizeMountainRaceControl(raw?.control);
      const expectedControl = normalizeMountainRaceControl(raw?.expectedControl);
      const expectedPromptIndex = Number(raw?.expectedPromptIndex);
      const actionId = String(raw?.actionId || '')
        .replace(/[^A-Za-z0-9._:-]/g, '')
        .slice(0, 120);
      if (!submittedControl || !expectedControl || !actionId || !Number.isFinite(expectedPromptIndex) || expectedPromptIndex < 0) return null;
      return {
        submittedControl,
        expectedControl,
        expectedPromptIndex: Math.trunc(expectedPromptIndex),
        actionId,
        order
      };
    }).filter(Boolean);
  }

  async function applyBatchUnlocked(user, game, details = {}) {
    const viewer = cleanUserId(user?.id);
    const items = mountainRaceBatchItems(details);
    if (!items.length) throw new Error('Summit Sprint did not receive any queued moves.');
    if (!game) throw new Error('That Summit Sprint race was not found.');
    if (game.mode !== 'mountainrace') throw new Error('That duel is not Summit Sprint.');
    if (!playerIds(game).includes(viewer)) throw new Error('You are not in this Summit Sprint race.');

    const requestedActionIds = items.map(item => item.actionId);
    let latest = game;

    for (let attempt = 0; attempt < MOUNTAIN_RACE_ACTION_CONFIRM_ATTEMPTS; attempt += 1) {
      if (attempt > 0) latest = await strongRead(game.gameId) || latest;
      if (!latest || latest.mode !== 'mountainrace') throw new Error('That Summit Sprint race was not found.');
      if (latest.status !== 'playing') {
        const finalState = ensureState(latest);
        return {
          game: latest,
          confirmedActionIds: requestedActionIds.filter(id => finalState?.processedActionIds.includes(id)),
          ignoredActionIds: []
        };
      }

      let state = ensureState(latest);
      if (!state) throw new Error('Summit Sprint could not initialize the mountain course.');
      const now = Date.now();
      const endAtMs = Date.parse(state.endAt || '');
      if (Number.isFinite(endAtMs) && now >= endAtMs) {
        return { game: await resolveTimeout({ ...latest, mountainraceState: state }, state), confirmedActionIds: [], ignoredActionIds: requestedActionIds };
      }

      let workingGame = { ...latest, mountainraceState: state };
      let changed = false;
      let staleFrom = -1;

      for (let index = 0; index < items.length; index += 1) {
        const item = items[index];
        state = ensureState(workingGame);
        if (!state) break;
        if (state.processedActionIds.includes(item.actionId)) continue;

        const actualPromptIndex = int(state.players?.[viewer]?.promptIndex, 0);
        const currentExpectedControl = normalizeMountainRaceControl(state.sequence[actualPromptIndex]);
        if (item.expectedPromptIndex !== actualPromptIndex || item.expectedControl !== currentExpectedControl) {
          staleFrom = index;
          break;
        }

        const built = await applyControl(
          { ...workingGame, mountainraceState: state },
          viewer,
          item.submittedControl,
          item.actionId,
          { actionAtMs: now + index }
        );
        if (built.changed) {
          workingGame = built.game;
          changed = true;
        }
        state = ensureState(workingGame);
        if (state?.winnerId || state?.completedAt) break;
      }

      state = ensureState(workingGame);
      const ignoredActionIds = staleFrom >= 0 ? items.slice(staleFrom).map(item => item.actionId) : [];
      const targetActionIds = staleFrom >= 0 ? items.slice(0, staleFrom).map(item => item.actionId) : requestedActionIds;
      if (!changed) {
        return {
          game: workingGame,
          confirmedActionIds: requestedActionIds.filter(id => state?.processedActionIds.includes(id)),
          ignoredActionIds,
          ignoredAction: ignoredActionIds.length > 0,
          ignoreReason: ignoredActionIds.length ? 'prompt-changed' : ''
        };
      }

      let saved;
      if (state?.winnerId) {
        const winnerName = gamePlayer(workingGame, state.winnerId)?.name || 'A climber';
        saved = await complete(workingGame, state, state.winnerId, winnerName + ' reached the summit first.');
      } else {
        saved = await saveGame(workingGame);
      }

      let confirmed = await strongRead(game.gameId) || saved;
      let confirmedState = ensureState(confirmed);
      if (confirmedState?.winnerId && confirmed?.status === 'playing') {
        const winnerName = gamePlayer(confirmed, confirmedState.winnerId)?.name || 'A climber';
        confirmed = await complete(confirmed, confirmedState, confirmedState.winnerId, winnerName + ' reached the summit first.');
        confirmedState = ensureState(confirmed);
      }

      const confirmedActionIds = requestedActionIds.filter(id => confirmedState?.processedActionIds.includes(id));
      if (targetActionIds.every(id => confirmedActionIds.includes(id))) {
        return {
          game: confirmed,
          confirmedActionIds,
          ignoredActionIds,
          ignoredAction: ignoredActionIds.length > 0,
          ignoreReason: ignoredActionIds.length ? 'prompt-changed' : ''
        };
      }
      latest = confirmed;
    }

    throw new Error('Those queued Summit Sprint moves could not be confirmed. No extra mistake was recorded; the same action IDs can be retried safely.');
  }`;

  integration = replaceRequired(
    integration,
    '  async function action(user, gameId, rawChoice, details = {}) {',
    `${batchHelpers}\n\n  async function action(user, gameId, rawChoice, details = {}) {`,
    'queued batch helpers'
  );

  const actionFunction = `  async function action(user, gameId, rawChoice, details = {}) {
    const batchItems = mountainRaceBatchItems(details);
    const outcome = await withLock(gameId, async () => {
      const game = await strongRead(gameId);
      return batchItems.length
        ? await applyBatchUnlocked(user, game, { ...details, inputBatch: batchItems.map(item => ({
            control: item.submittedControl,
            expectedControl: item.expectedControl,
            expectedPromptIndex: item.expectedPromptIndex,
            actionId: item.actionId
          })) })
        : await applyActionUnlocked(user, game, rawChoice, details, {});
    });

    const finalGame = outcome.game;
    const viewer = cleanUserId(user.id);
    const confirmedActionIds = Array.isArray(outcome.confirmedActionIds) ? outcome.confirmedActionIds : [];
    const ignoredActionIds = Array.isArray(outcome.ignoredActionIds) ? outcome.ignoredActionIds : [];
    const wakeBot = Boolean(finalGame?.status === 'playing' && (confirmedActionIds.length || (!batchItems.length && !outcome.ignoredAction)));
    const response = {
      game: publicGame(finalGame, viewer),
      ...(outcome.ignoredAction ? { ignoredAction: true, ignoreReason: outcome.ignoreReason } : {}),
      ...(outcome.replayedAction ? { replayedAction: true } : {}),
      ...(batchItems.length ? { batchAccepted: true, confirmedActionIds, ignoredActionIds } : {}),
      ...(wakeBot ? { wakeBot: true } : {})
    };
    if (finalGame?.status === 'complete') response.record = await getUserRecord(viewer);
    else response.skipBalanceLookup = true;
    return response;
  }`;
  integration = replaceFunction(integration, '  async function action(', actionFunction, 'queued public action endpoint');
}

if (!integration.includes(integrationMarker)) throw new Error('Summit Sprint instant-input server marker is missing.');
if (!integration.includes('async function applyBatchUnlocked(')) throw new Error('Summit Sprint queued moves do not have a batch validator.');
if (!integration.includes('await saveGame(workingGame)')) throw new Error('Summit Sprint queued moves are not persisted in one authoritative save.');
if (!integration.includes('confirmedActionIds')) throw new Error('Summit Sprint queued action IDs are not returned to the client.');
await writeFile(integrationUrl, integration);

let client = await readFile(clientUrl, 'utf8');

if (!client.includes(clientMarker)) {
  client = replaceRequired(
    client,
    '  // MOUNTAIN_RACE_LOW_LATENCY_INPUTS_V4',
    `  // MOUNTAIN_RACE_LOW_LATENCY_INPUTS_V4\n  ${clientMarker}`,
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
    'instant input queue runtime state'
  );

  const optimisticFunction = `  function optimisticPresentation(publicState, prompts, total) {
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
  }`;
  client = replaceFunction(client, '  function optimisticPresentation(', optimisticFunction, 'queued optimistic presentation');

  const statusFunction = `  function statusText(publicState) {
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
  }`;
  client = replaceFunction(client, '  function statusText(', statusFunction, 'queued status text');

  client = replaceRequired(
    client,
    `    const controlsEnabled = runtime.game.status === 'playing' && publicState.canSubmit && !runtime.busy;`,
    `    const controlsEnabled = runtime.game.status === 'playing' && publicState.canSubmit && prompts.length > 0 && !presentation.blocked;`,
    'immediate controls policy'
  );

  const queueHelpers = `  function syncPendingCompatibility() {
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

  function clearInputQueue() {
    if (runtime.inputFlushTimer) window.clearTimeout(runtime.inputFlushTimer);
    runtime.inputFlushTimer = 0;
    runtime.inputQueue = [];
    runtime.inputBatchInFlight = [];
    runtime.inputQueueBlocked = false;
    syncPendingCompatibility();
  }

  function scheduleInputFlush(immediate = false) {
    if (runtime.inputFlushTimer) window.clearTimeout(runtime.inputFlushTimer);
    runtime.inputFlushTimer = window.setTimeout(() => {
      runtime.inputFlushTimer = 0;
      flushInputQueue();
    }, immediate ? 0 : 220);
  }

  async function flushInputQueue() {
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
  }`;

  client = replaceRequired(
    client,
    '  async function submit(rawToken) {',
    `${queueHelpers}\n\n  async function submit(rawToken) {`,
    'instant input queue helpers'
  );

  const submitFunction = `  async function submit(rawToken) {
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
  }`;
  client = replaceFunction(client, '  async function submit(', submitFunction, 'immediate queued submit');

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
    'instant queue diagnostics export'
  );
}

if (!client.includes(clientMarker)) throw new Error('Summit Sprint instant-input client marker is missing.');
if (!client.includes('inputQueue: []')) throw new Error('Summit Sprint client does not retain rapid taps.');
if (!client.includes('async function flushInputQueue()')) throw new Error('Summit Sprint client does not batch queued taps.');
if (!client.includes("choice: 'mountainrace:batch'")) throw new Error('Summit Sprint client still sends one network request per arrow.');
if (!client.includes('prompts.length > 0 && !presentation.blocked')) throw new Error('Summit Sprint controls still wait for each network response.');
await writeFile(clientUrl, client);

let actionRoute = await readFile(actionUrl, 'utf8');
actionRoute = replaceRequired(
  actionRoute,
  'expectedPromptIndex: body.expectedPromptIndex, expectedControl: body.expectedControl, asTestPlayer:',
  'expectedPromptIndex: body.expectedPromptIndex, expectedControl: body.expectedControl, inputBatch: body.inputBatch, asTestPlayer:',
  'queued input route'
);
if (!actionRoute.includes('inputBatch: body.inputBatch')) throw new Error('The Netlify route drops queued Summit Sprint inputs.');
await writeFile(actionUrl, actionRoute);

let html = await readFile(indexUrl, 'utf8');
if (!html.includes(htmlMarker)) {
  const anchor = html.includes('</body>') ? '</body>' : html.includes('</html>') ? '</html>' : '';
  html = anchor ? html.replace(anchor, `${htmlMarker}\n${anchor}`) : `${html}\n${htmlMarker}\n`;
}
html = html
  .replaceAll('mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=4', 'mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=5')
  .replaceAll('&sync=5&sync=5', '&sync=5');
if (!html.includes('mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=5')) throw new Error('Fresh instant-input runtime cache boundary is missing.');
await writeFile(indexUrl, html);

console.log('Enabled immediate Summit Sprint input: visible arrows advance locally with no per-tap button lock, up to four rapid taps are saved and strongly confirmed as one authoritative batch, stale queued prompts are ignored without mistakes, and the Network Bot still wakes after confirmation.');
