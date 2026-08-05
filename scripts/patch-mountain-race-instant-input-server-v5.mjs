import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const integrationUrl = new URL('netlify/functions/mountain-race/integration.js', root);
const actionUrl = new URL('netlify/functions/duel-action.js', root);
const marker = '// MOUNTAIN_RACE_INSTANT_INPUT_QUEUE_V5';

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Summit Sprint queued-input server patch could not find ${label}.`);
  return source.replace(before, after);
}

function replaceFunction(source, signature, replacement, label) {
  const start = source.indexOf(signature);
  if (start < 0) throw new Error(`Summit Sprint queued-input server patch could not find ${label}.`);
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
  if (bodyStart < 0) throw new Error(`Summit Sprint queued-input server patch could not parse ${label}.`);

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
  throw new Error(`Summit Sprint queued-input server patch could not close ${label}.`);
}

function indentFunction(fn, replacementName) {
  const renamed = fn.toString().replace(fn.name, replacementName);
  return renamed.split('\n').map(line => `  ${line}`).join('\n');
}

function generatedMountainRaceBatchItems(details = {}) {
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
        ignoredActionIds: []
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
        ignoredActionIds: requestedActionIds
      };
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
}

let integration = await readFile(integrationUrl, 'utf8');
if (!integration.includes(marker)) {
  integration = replaceRequired(
    integration,
    '// MOUNTAIN_RACE_LOW_LATENCY_INPUTS_V4',
    `// MOUNTAIN_RACE_LOW_LATENCY_INPUTS_V4\n${marker}`,
    'server marker'
  );

  const helpers = [
    indentFunction(generatedMountainRaceBatchItems, 'mountainRaceBatchItems'),
    indentFunction(generatedApplyBatchUnlocked, 'applyBatchUnlocked')
  ].join('\n\n');
  integration = replaceRequired(
    integration,
    '  async function action(user, gameId, rawChoice, details = {}) {',
    `${helpers}\n\n  async function action(user, gameId, rawChoice, details = {}) {`,
    'batch helpers'
  );
  integration = replaceFunction(
    integration,
    '  async function action(',
    indentFunction(generatedAction, 'action'),
    'public action endpoint'
  );
}

if (!integration.includes(marker)) throw new Error('Summit Sprint queued-input server marker is missing.');
if (!integration.includes('async function applyBatchUnlocked(')) throw new Error('Summit Sprint batch validator is missing.');
if (!integration.includes('await saveGame(workingGame)')) throw new Error('Summit Sprint batch is not persisted with one save.');
if (!integration.includes('confirmedActionIds')) throw new Error('Summit Sprint confirmed batch IDs are missing.');
await writeFile(integrationUrl, integration);

let actionRoute = await readFile(actionUrl, 'utf8');
actionRoute = replaceRequired(
  actionRoute,
  'expectedPromptIndex: body.expectedPromptIndex, expectedControl: body.expectedControl, asTestPlayer:',
  'expectedPromptIndex: body.expectedPromptIndex, expectedControl: body.expectedControl, inputBatch: body.inputBatch, asTestPlayer:',
  'queued input route'
);
if (!actionRoute.includes('inputBatch: body.inputBatch')) throw new Error('The Netlify route drops queued Summit Sprint inputs.');
await writeFile(actionUrl, actionRoute);

console.log('Added Summit Sprint server-side queued input batches with one authoritative save and strong action-id confirmation.');
