import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const integrationUrl = new URL('netlify/functions/mountain-race/integration.js', root);
const marker = '// MOUNTAIN_RACE_CONTINUOUS_SYNC_V6';

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Summit Sprint continuous-sync server patch could not find ${label}.`);
  return source.replace(before, after);
}

function replaceFunction(source, signature, replacement, label) {
  const start = source.indexOf(signature);
  if (start < 0) throw new Error(`Summit Sprint continuous-sync server patch could not find ${label}.`);
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
  if (bodyStart < 0) throw new Error(`Summit Sprint continuous-sync server patch could not parse ${label}.`);

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
  throw new Error(`Summit Sprint continuous-sync server patch could not close ${label}.`);
}

function indentFunction(fn, replacementName) {
  const renamed = fn.toString().replace(fn.name, replacementName);
  return renamed.split('\n').map(line => `  ${line}`).join('\n');
}

function generatedMountainRaceBatchItems(details = {}) {
  const rawItems = Array.isArray(details.inputBatch) ? details.inputBatch.slice(0, 8) : [];
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

async function generatedFoldDueBotActions(game, nowMs = Date.now(), maxActions = 4) {
  let workingGame = game;
  let state = ensureState(workingGame);
  const npcProfile = botProfile(workingGame);
  const npcId = cleanUserId(npcProfile?.userId || '');
  const actionIds = [];
  let changed = false;
  let processed = 0;

  if (!state || !npcId || state.players?.[npcId]?.finishedAt || state.winnerId || state.completedAt) {
    return { game: workingGame, changed, processed, actionIds };
  }

  const raceEndMs = Date.parse(state.endAt || '');
  const dueThrough = Number.isFinite(raceEndMs)
    ? Math.min(Number(nowMs) || Date.now(), raceEndMs - 1)
    : Number(nowMs) || Date.now();
  let scheduled = Date.parse(state.npcActionAt || '');

  while (
    workingGame?.status === 'playing'
    && Number.isFinite(scheduled)
    && scheduled <= dueThrough
    && processed < Math.max(1, int(maxActions, 4))
  ) {
    state = ensureState(workingGame);
    if (!state || state.players?.[npcId]?.finishedAt || state.winnerId || state.completedAt) break;

    const sequenceNumber = int(state.botActionSequence, 0) + 1;
    const token = botControl(state, npcId);
    const actionId = `mountain-${isRemoteBotProfile(npcProfile) ? 'remote' : 'npc'}-${state.roundId}-${sequenceNumber}`;
    const built = await applyControl(
      { ...workingGame, mountainraceState: state },
      npcId,
      token,
      actionId,
      {
        isBot: true,
        actionAtMs: scheduled,
        scheduleFromMs: scheduled,
        catchUpCount: processed + 1
      }
    );
    if (!built.changed) break;

    workingGame = built.game;
    changed = true;
    processed += 1;
    actionIds.push(actionId);
    state = ensureState(workingGame);
    scheduled = Date.parse(state?.npcActionAt || '');
  }

  return { game: workingGame, changed, processed, actionIds };
}

async function generatedApplyBatchUnlocked(user, game, details = {}) {
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
        ignoredActionIds: [],
        opponentAdvanced: false
      };
    }

    let state = ensureState(latest);
    if (!state) throw new Error('Summit Sprint could not initialize the mountain course.');
    const now = Date.now();
    const endAtMs = Date.parse(state.endAt || '');
    if (Number.isFinite(endAtMs) && now >= endAtMs) {
      return {
        game: await resolveTimeout({ ...latest, mountainraceState: state }, state),
        confirmedActionIds: [],
        ignoredActionIds: requestedActionIds,
        opponentAdvanced: false
      };
    }

    const folded = await foldDueBotActions({ ...latest, mountainraceState: state }, now, 4);
    let workingGame = folded.game;
    let changed = Boolean(folded.changed);
    const botActionIds = folded.actionIds;
    let staleFrom = -1;

    state = ensureState(workingGame);
    if (state?.winnerId || state?.completedAt) {
      const winnerName = gamePlayer(workingGame, state.winnerId)?.name || 'A climber';
      const completed = await complete(workingGame, state, state.winnerId, winnerName + ' reached the summit first.');
      return {
        game: completed,
        confirmedActionIds: [],
        ignoredActionIds: requestedActionIds,
        opponentAdvanced: botActionIds.length > 0
      };
    }

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
    const persistenceIds = [...targetActionIds, ...botActionIds];
    if (!changed) {
      return {
        game: workingGame,
        confirmedActionIds: requestedActionIds.filter(id => state?.processedActionIds.includes(id)),
        ignoredActionIds,
        ignoredAction: ignoredActionIds.length > 0,
        ignoreReason: ignoredActionIds.length ? 'prompt-changed' : '',
        opponentAdvanced: false
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
    const persistenceConfirmed = persistenceIds.every(id => confirmedState?.processedActionIds.includes(id));
    if (persistenceConfirmed) {
      return {
        game: confirmed,
        confirmedActionIds,
        ignoredActionIds,
        ignoredAction: ignoredActionIds.length > 0,
        ignoreReason: ignoredActionIds.length ? 'prompt-changed' : '',
        opponentAdvanced: botActionIds.length > 0
      };
    }
    latest = confirmed;
  }

  throw new Error('Those queued Summit Sprint moves could not be confirmed. No extra mistake was recorded; the same action IDs can be retried safely.');
}

async function generatedAction(user, gameId, rawChoice, details = {}) {
  const batchItems = mountainRaceBatchItems(details);
  const outcome = await withLock(gameId, async () => {
    const game = await strongRead(gameId);
    return batchItems.length
      ? await applyBatchUnlocked(user, game, {
          ...details,
          inputBatch: batchItems.map(item => ({
            control: item.submittedControl,
            expectedControl: item.expectedControl,
            expectedPromptIndex: item.expectedPromptIndex,
            actionId: item.actionId
          }))
        })
      : await applyActionUnlocked(user, game, rawChoice, details, {});
  });

  const finalGame = outcome.game;
  const viewer = cleanUserId(user.id);
  const confirmedActionIds = Array.isArray(outcome.confirmedActionIds) ? outcome.confirmedActionIds : [];
  const ignoredActionIds = Array.isArray(outcome.ignoredActionIds) ? outcome.ignoredActionIds : [];
  const wakeBot = Boolean(!batchItems.length && finalGame?.status === 'playing' && !outcome.ignoredAction);
  const response = {
    game: publicGame(finalGame, viewer),
    ...(outcome.ignoredAction ? { ignoredAction: true, ignoreReason: outcome.ignoreReason } : {}),
    ...(outcome.replayedAction ? { replayedAction: true } : {}),
    ...(batchItems.length ? {
      batchAccepted: true,
      confirmedActionIds,
      ignoredActionIds,
      opponentAdvanced: Boolean(outcome.opponentAdvanced)
    } : {}),
    ...(wakeBot ? { wakeBot: true } : {})
  };
  if (finalGame?.status === 'complete') response.record = await getUserRecord(viewer);
  else response.skipBalanceLookup = true;
  return response;
}

let integration = await readFile(integrationUrl, 'utf8');
if (!integration.includes(marker)) {
  integration = replaceRequired(
    integration,
    '// MOUNTAIN_RACE_INSTANT_INPUT_QUEUE_V5',
    `// MOUNTAIN_RACE_INSTANT_INPUT_QUEUE_V5\n${marker}`,
    'server marker'
  );
  integration = replaceRequired(
    integration,
    `        prompts: [],
        me: publicPlayer(game, viewer, {}, viewer),`,
    `        prompts: [],
        inputPrompts: [],
        me: publicPlayer(game, viewer, {}, viewer),`,
    'empty private runway'
  );
  integration = replaceRequired(
    integration,
    `      prompts: state.sequence.slice(int(me.promptIndex, 0), int(me.promptIndex, 0) + 4),
      me: publicPlayer(game, viewer, me, viewer),`,
    `      prompts: state.sequence.slice(int(me.promptIndex, 0), int(me.promptIndex, 0) + 4),
      inputPrompts: state.sequence.slice(int(me.promptIndex, 0)),
      me: publicPlayer(game, viewer, me, viewer),`,
    'continuous private input runway'
  );

  integration = replaceFunction(
    integration,
    '  function mountainRaceBatchItems(',
    indentFunction(generatedMountainRaceBatchItems, 'mountainRaceBatchItems'),
    'eight-move batch parser'
  );
  integration = replaceRequired(
    integration,
    '  async function applyBatchUnlocked(user, game, details = {}) {',
    `${indentFunction(generatedFoldDueBotActions, 'foldDueBotActions')}\n\n  async function applyBatchUnlocked(user, game, details = {}) {`,
    'inline opponent driver'
  );
  integration = replaceFunction(
    integration,
    '  async function applyBatchUnlocked(',
    indentFunction(generatedApplyBatchUnlocked, 'applyBatchUnlocked'),
    'continuous authoritative batch'
  );
  integration = replaceFunction(
    integration,
    '  async function action(',
    indentFunction(generatedAction, 'action'),
    'continuous action response'
  );
}

if (!integration.includes(marker)) throw new Error('Summit Sprint continuous-sync server marker is missing.');
if (!integration.includes('inputPrompts: state.sequence.slice')) throw new Error('Summit Sprint does not expose a continuous private input runway.');
if (!integration.includes('details.inputBatch.slice(0, 8)')) throw new Error('Summit Sprint does not accept eight queued moves per save.');
if (!integration.includes('async function foldDueBotActions(')) throw new Error('Summit Sprint action batches do not advance due opponent moves.');
if (!integration.includes('const persistenceIds = [...targetActionIds, ...botActionIds]')) throw new Error('Summit Sprint does not strongly confirm folded opponent moves.');
if (!integration.includes('opponentAdvanced: Boolean(outcome.opponentAdvanced)')) throw new Error('Summit Sprint action responses do not report opponent progress.');
await writeFile(integrationUrl, integration);

console.log('Added Summit Sprint Continuous Sync V6: full private input runway, eight-move saves, and due Network Bot movement folded into each player batch with strong persistence confirmation.');
