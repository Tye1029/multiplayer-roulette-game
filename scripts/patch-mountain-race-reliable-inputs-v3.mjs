import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const integrationUrl = new URL('netlify/functions/mountain-race/integration.js', root);
const clientUrl = new URL('assets/mountain-race/mountain-race-multiplayer.js', root);
const actionUrl = new URL('netlify/functions/duel-action.js', root);
const indexUrl = new URL('index.html', root);
const integrationMarker = '// MOUNTAIN_RACE_RELIABLE_INPUTS_V3';
const clientMarker = '// MOUNTAIN_RACE_RELIABLE_INPUTS_V3';
const htmlMarker = '<!-- MOUNTAIN_RACE_RELIABLE_INPUTS_V3 -->';

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Summit Sprint reliable-input patch could not find ${label}.`);
  return source.replace(before, after);
}

function replaceFunction(source, signature, replacement, label) {
  const start = source.indexOf(signature);
  if (start < 0) throw new Error(`Summit Sprint reliable-input patch could not find ${label}.`);
  const bodyStart = source.indexOf('{', start);
  if (bodyStart < 0) throw new Error(`Summit Sprint reliable-input patch could not parse ${label}.`);
  let depth = 0;
  let quote = '';
  let escaped = false;
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
    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(0, start) + replacement + source.slice(index + 1);
    }
  }
  throw new Error(`Summit Sprint reliable-input patch could not close ${label}.`);
}

let integration = await readFile(integrationUrl, 'utf8');

if (!integration.includes(integrationMarker)) {
  integration = replaceRequired(
    integration,
    '// MOUNTAIN_RACE_BOT_PACING_AND_NETWORK_LOG_V2',
    `// MOUNTAIN_RACE_BOT_PACING_AND_NETWORK_LOG_V2\n${integrationMarker}\nconst MOUNTAIN_RACE_ACTION_CONFIRM_ATTEMPTS = 5;`,
    'integration marker and confirmation limit'
  );

  integration = replaceRequired(
    integration,
    `  function playerIds(game) {`,
    `  function optionalUserId(value) {
    const raw = String(value || '').trim();
    return raw ? cleanUserId(raw) : '';
  }

  function playerIds(game) {`,
    'nullable user id helper'
  );

  integration = integration
    .replaceAll("cleanUserId(existing.winnerId || '')", "optionalUserId(existing.winnerId)")
    .replaceAll("cleanUserId(state.winnerId || '')", "optionalUserId(state.winnerId)")
    .replaceAll("cleanUserId(winnerId)", "optionalUserId(winnerId)");

  const applyControl = `  async function applyControl(game, actorId, rawControl, actionId = '', options = {}) {
    const id = cleanUserId(actorId);
    const state = ensureState(game);
    if (!state?.players?.[id]) throw new Error('Summit Sprint could not find that climber.');

    const actionAtMs = Number.isFinite(Number(options.actionAtMs))
      ? Number(options.actionAtMs)
      : Date.now();
    const next = applyMountainRaceInput(state, id, rawControl, actionId, actionAtMs);
    if (next === state) return { game, changed: false };

    if (options.isBot) {
      const scheduleBaseMs = Number.isFinite(Number(options.scheduleFromMs))
        ? Number(options.scheduleFromMs)
        : actionAtMs;
      next.botActionSequence = int(state.botActionSequence, 0) + 1;
      next.botLastActionAt = new Date(actionAtMs).toISOString();
      next.botCatchUpCount = int(options.catchUpCount, 0);
      next.npcActionAt = next.completedAt
        ? null
        : new Date(scheduleBaseMs + botDelay(game)).toISOString();
    } else {
      next.npcActionAt = state.npcActionAt;
      next.botActionSequence = int(state.botActionSequence, 0);
      next.botLastActionAt = state.botLastActionAt || null;
      next.botCatchUpCount = int(state.botCatchUpCount, 0);
    }

    return {
      game: { ...game, mountainraceState: next },
      changed: true
    };
  }`;
  integration = replaceFunction(integration, '  async function applyControl(', applyControl, 'action candidate builder');

  const applyActionUnlocked = `  async function applyActionUnlocked(user, game, rawChoice, details = {}, options = {}) {
    const viewer = cleanUserId(user?.id);
    if (!game) throw new Error('That Summit Sprint race was not found.');
    if (game.mode !== 'mountainrace') throw new Error('That duel is not Summit Sprint.');
    if (!playerIds(game).includes(viewer)) throw new Error('You are not in this Summit Sprint race.');

    const match = /^mountainrace:input:(up|left|right|down)$/.exec(String(rawChoice || '').toLowerCase());
    if (!match) throw new Error('Choose one valid climbing direction.');

    const submittedControl = match[1];
    const expectedControl = normalizeMountainRaceControl(details.expectedControl);
    const expectedPromptIndex = Number(details.expectedPromptIndex);
    const actionId = String(details.actionId || '')
      .replace(/[^A-Za-z0-9._:-]/g, '')
      .slice(0, 120);
    let latest = game;

    for (let attempt = 0; attempt < MOUNTAIN_RACE_ACTION_CONFIRM_ATTEMPTS; attempt += 1) {
      if (attempt > 0) latest = await strongRead(game.gameId) || latest;
      if (!latest || latest.mode !== 'mountainrace') throw new Error('That Summit Sprint race was not found.');
      if (latest.status !== 'playing') return { game: latest, skipBalanceLookup: true };

      const state = ensureState(latest);
      if (!state) throw new Error('Summit Sprint could not initialize the mountain course.');
      const actionAtMs = Number.isFinite(Number(options.actionAtMs)) ? Number(options.actionAtMs) : Date.now();
      const endAtMs = Date.parse(state.endAt || '');
      if (Number.isFinite(endAtMs) && actionAtMs >= endAtMs) {
        return { game: await resolveTimeout({ ...latest, mountainraceState: state }, state) };
      }

      if (actionId && state.processedActionIds.includes(actionId)) {
        return { game: { ...latest, mountainraceState: state }, skipBalanceLookup: true, replayedAction: true };
      }

      const actualPromptIndex = int(state.players?.[viewer]?.promptIndex, 0);
      const currentExpectedControl = normalizeMountainRaceControl(state.sequence[actualPromptIndex]);
      if (Number.isFinite(expectedPromptIndex) && expectedPromptIndex >= 0 && expectedPromptIndex !== actualPromptIndex) {
        return {
          game: { ...latest, mountainraceState: state },
          skipBalanceLookup: true,
          ignoredAction: true,
          ignoreReason: 'prompt-changed'
        };
      }
      if (expectedControl && expectedControl !== currentExpectedControl) {
        return {
          game: { ...latest, mountainraceState: state },
          skipBalanceLookup: true,
          ignoredAction: true,
          ignoreReason: 'prompt-changed'
        };
      }

      const built = await applyControl(
        { ...latest, mountainraceState: state },
        viewer,
        submittedControl,
        actionId,
        {
          isBot: Boolean(options.isBot),
          actionAtMs,
          scheduleFromMs: options.scheduleFromMs,
          catchUpCount: options.catchUpCount
        }
      );
      if (!built.changed) return { game: built.game, skipBalanceLookup: true };

      const saved = await saveGame(built.game);
      if (!actionId) return { game: saved, skipBalanceLookup: saved.status !== 'complete' };

      const confirmed = await strongRead(game.gameId) || saved;
      const confirmedState = ensureState(confirmed);
      if (confirmedState?.processedActionIds.includes(actionId)) {
        let confirmedGame = { ...confirmed, mountainraceState: confirmedState };
        if (confirmedState.winnerId && confirmedGame.status === 'playing') {
          const winnerName = gamePlayer(confirmedGame, confirmedState.winnerId)?.name || 'A climber';
          confirmedGame = await complete(confirmedGame, confirmedState, confirmedState.winnerId, winnerName + ' reached the summit first.');
        }
        return { game: confirmedGame, skipBalanceLookup: confirmedGame.status !== 'complete' };
      }

      // A different serverless request saved over this move. Re-read the newest
      // state and reapply the same action id. The processed-action ledger makes
      // this safe even when the first save becomes visible during a retry.
      latest = confirmed;
    }

    throw new Error('That move could not be confirmed. No incorrect move was recorded; try the highlighted direction again.');
  }`;
  integration = replaceFunction(integration, '  async function applyActionUnlocked(', applyActionUnlocked, 'confirmed action loop');

  const actionFunction = `  async function action(user, gameId, rawChoice, details = {}) {
    const outcome = await withLock(gameId, async () => {
      const game = await strongRead(gameId);
      return await applyActionUnlocked(user, game, rawChoice, details, {});
    });

    let finalGame = outcome.game;
    if (finalGame?.status === 'playing' && !outcome.ignoredAction) {
      // Human input also wakes the Network Bot. Active tapping can otherwise
      // suppress focused GET polls and leave the opponent visually motionless.
      finalGame = await advance(finalGame);
    }

    const viewer = cleanUserId(user.id);
    const response = {
      game: publicGame(finalGame, viewer),
      ...(outcome.ignoredAction ? { ignoredAction: true, ignoreReason: outcome.ignoreReason } : {}),
      ...(outcome.replayedAction ? { replayedAction: true } : {})
    };
    if (finalGame?.status === 'complete') response.record = await getUserRecord(viewer);
    else response.skipBalanceLookup = true;
    return response;
  }`;
  integration = replaceFunction(integration, '  async function action(', actionFunction, 'confirmed public action endpoint');

  integration = replaceRequired(
    integration,
    `  MOUNTAIN_RACE_BOT_MIN_STEP_INTERVAL_MS,
  createMountainRaceIntegration`,
    `  MOUNTAIN_RACE_BOT_MIN_STEP_INTERVAL_MS,
  MOUNTAIN_RACE_ACTION_CONFIRM_ATTEMPTS,
  createMountainRaceIntegration`,
    'confirmation-attempt export'
  );
}

if (!integration.includes(integrationMarker)) throw new Error('Summit Sprint reliable-input integration marker is missing.');
if (!integration.includes('function optionalUserId(value)')) throw new Error('Nullable winner ids are not preserved.');
if (integration.includes("cleanUserId(existing.winnerId || '')")) throw new Error('An empty winner id can still become the synthetic unknown user.');
if (!integration.includes('MOUNTAIN_RACE_ACTION_CONFIRM_ATTEMPTS = 5')) throw new Error('Action persistence confirmation is missing.');
if (!integration.includes('confirmedState?.processedActionIds.includes(actionId)')) throw new Error('Saved actions are not confirmed from strong storage.');
if (!integration.includes('finalGame = await advance(finalGame)')) throw new Error('Player input does not wake the Network Bot.');
await writeFile(integrationUrl, integration);

let client = await readFile(clientUrl, 'utf8');
if (!client.includes(clientMarker)) {
  client = replaceRequired(
    client,
    '// MOUNTAIN_RACE_AUTHORITATIVE_ORDER_V2',
    `// MOUNTAIN_RACE_AUTHORITATIVE_ORDER_V2\n  ${clientMarker}`,
    'client reliability marker'
  );

  client = replaceFunction(
    client,
    '  function optimisticPresentation(',
    `  function optimisticPresentation(publicState, prompts, total) {
    const authoritativeMe = player(publicState.me, 'YOU', 'YOU');
    const pending = runtime.pendingInput;
    if (!pending || pending.fromIndex !== authoritativeMe.promptIndex) {
      return { authoritativeMe, me: authoritativeMe, prompts, animation: '', tone: '' };
    }
    // Keep the displayed arrow and altitude authoritative while the request is
    // traveling. Immediate feedback highlights the pressed control, but the next
    // prompt is not exposed until storage confirms this exact action id.
    return {
      authoritativeMe,
      me: authoritativeMe,
      prompts,
      animation: 'waiting',
      tone: pending.correct ? 'correct' : 'wrong'
    };
  }`,
    'non-speculative prompt presentation'
  );

  client = replaceRequired(
    client,
    `        expectedPromptIndex: fromIndex`,
    `        expectedPromptIndex: fromIndex,
        expectedControl: expected`,
    'visible prompt identity submission'
  );

  client = replaceRequired(
    client,
    `      if (data?.game) {
        adopt(data.game, {`,
    `      if (data?.game) {
        adopt(data.game, {`,
    'action response anchor'
  );
}

if (!client.includes(clientMarker)) throw new Error('Summit Sprint reliable-input client marker is missing.');
if (!client.includes('expectedControl: expected')) throw new Error('The client does not send the arrow identity it displayed.');
if (!client.includes('the next\n    // prompt is not exposed until storage confirms this exact action id')) throw new Error('The client still advances prompts speculatively.');
await writeFile(clientUrl, client);

let actionRoute = await readFile(actionUrl, 'utf8');
actionRoute = replaceRequired(
  actionRoute,
  'expectedPromptIndex: body.expectedPromptIndex, asTestPlayer:',
  'expectedPromptIndex: body.expectedPromptIndex, expectedControl: body.expectedControl, asTestPlayer:',
  'displayed arrow identity route'
);
if (!actionRoute.includes('expectedControl: body.expectedControl')) throw new Error('The Netlify route drops the displayed arrow identity.');
await writeFile(actionUrl, actionRoute);

let html = await readFile(indexUrl, 'utf8');
if (!html.includes(htmlMarker)) {
  const anchor = html.includes('</body>') ? '</body>' : html.includes('</html>') ? '</html>' : '';
  html = anchor ? html.replace(anchor, `${htmlMarker}\n${anchor}`) : `${html}\n${htmlMarker}\n`;
}
html = html
  .replaceAll('mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=2', 'mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=3')
  .replaceAll('&sync=3&sync=3', '&sync=3');
if (!html.includes('mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=3')) throw new Error('Fresh reliable-input runtime cache boundary is missing.');
await writeFile(indexUrl, html);

console.log('Fixed Summit Sprint input reliability: empty winner ids remain empty, no phantom winner competes with player saves, every move is confirmed by action id after persistence, stale visible arrows are ignored without a wrong penalty, prompt visuals wait for confirmation, and each player action wakes the Network Bot.');
