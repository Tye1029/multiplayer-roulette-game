import { readFile, writeFile } from 'node:fs/promises';

const clientUrl = new URL('../assets/safe-cracker/safe-cracker.js', import.meta.url);
const dataUrl = new URL('../netlify/functions/_data.js', import.meta.url);
const actionUrl = new URL('../netlify/functions/duel-action.js', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const marker = '// SAFE_CRACKER_RENDER_STABILITY_V1_START';
const latencyMarker = '// SAFE_CRACKER_FEEDBACK_LATENCY_V1_START';

function replaceOnce(source, before, after, label) {
  if (source.includes(after)) return source;
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Safe Cracker render-stability patch could not find ${label}.`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Safe Cracker render-stability patch found more than one ${label}.`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

function replaceInsideRender(source, pattern, replacement, label) {
  const start = source.indexOf('  function render(game) {');
  const end = source.indexOf('\n  function applyDialVisual()', start);
  if (start < 0 || end < 0) throw new Error('Safe Cracker render-stability patch could not isolate render(game).');
  const section = source.slice(start, end);
  if (section.includes(replacement)) return source;
  if (!pattern.test(section)) throw new Error(`Safe Cracker render-stability patch could not find ${label}.`);
  return source.slice(0, start) + section.replace(pattern, replacement) + source.slice(end);
}

function replaceSection(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0 || end <= start) {
    throw new Error(`Safe Cracker render-stability patch could not isolate ${label}.`);
  }
  return source.slice(0, start) + replacement + source.slice(end);
}

let client = await readFile(clientUrl, 'utf8');

for (const required of [
  '// SAFE_CRACKER_INPUT_CONTINUITY_V9_START',
  '// SAFE_CRACKER_LATCH_SEQUENCE_V1_HELPER',
  'function safeCrackerUpdateConfirmControl()',
  'class="sc-dial-reference-plate"',
  'function lockedCode(progress = {})',
  'function feedbackMeter(tier = \'\')'
]) {
  if (!client.includes(required)) {
    throw new Error(`Safe Cracker render stability requires the final generated runtime fragment: ${required}`);
  }
}

if (!client.includes(marker)) {
  const helper = String.raw`  ${marker}
  function safeCrackerReplaceMarkup(element, markup) {
    if (!element || !markup) return element;
    const template = document.createElement('template');
    template.innerHTML = String(markup).trim();
    const replacement = template.content.firstElementChild;
    if (!replacement) return element;
    element.replaceWith(replacement);
    return replacement;
  }

  function safeCrackerSetText(element, value) {
    if (!element) return;
    const next = String(value ?? '');
    if (element.textContent !== next) element.textContent = next;
  }

  function safeCrackerUpdateMountedBoard(game) {
    const mount = document.querySelector('[data-safe-cracker-mount]');
    const root = mount?.firstElementChild?.matches?.('.safe-cracker-game')
      ? mount.firstElementChild
      : mount?.querySelector?.('.safe-cracker-game');
    const gameId = String(game?.gameId || '');
    const mountedGameId = String(root?.dataset?.scGameId || '');
    const status = String(game?.status || '');
    const mountedStatus = String(root?.dataset?.scStatus || '');

    // Keep the already-painted, decoded dial and display DOM only while the same
    // active board remains in the playing lifecycle. Countdown and terminal
    // transitions still receive a clean full render and fresh event bindings.
    if (!root || !gameId || mountedGameId !== gameId || status !== 'playing' || mountedStatus !== 'playing') return false;

    const me = myState(game);
    const opponent = opponentState(game);
    const stage = Math.max(0, Math.min(STAGES, Number(me?.stage || 0)));
    const latest = runtime.feedbackResult || me?.lastResult || null;
    const displayTier = String(latest?.tier || 'idle');
    const displayText = latest ? tierLabel(latest.tier) : 'TURN THE DIAL';
    const attemptCount = Number(me?.attemptCount || 0);

    root.dataset.scStatus = status;
    root.classList.add('sc-stable-render');

    const meLights = root.querySelector('.sc-player-card.me .sc-progress-lights');
    if (meLights) meLights.innerHTML = progressLights(me);
    const opponentLights = root.querySelector('.sc-player-card.opponent .sc-progress-lights');
    if (opponentLights) opponentLights.innerHTML = progressLights(opponent);

    const playerCopy = root.querySelector('.sc-player-card.me .sc-player-copy');
    const existingCode = playerCopy?.querySelector('.sc-known-code');
    if (existingCode) {
      safeCrackerReplaceMarkup(existingCode, lockedCode(me));
    } else {
      playerCopy?.querySelector('.sc-progress-lights')?.insertAdjacentHTML('beforebegin', lockedCode(me));
    }

    const opponentStrip = root.querySelector('.sc-opponent-strip');
    if (opponentStrip) {
      for (const tier of ['red', 'orange', 'yellow', 'green']) opponentStrip.classList.remove(tier);
      const opponentTier = String(opponent?.lastTier || '');
      if (opponentTier) opponentStrip.classList.add(opponentTier);
      const raceProgress = opponentStrip.querySelector('.sc-race-progress');
      if (raceProgress) raceProgress.innerHTML = '<i aria-hidden="true"></i>' + Math.min(STAGES, Number(opponent?.stage || 0)) + ' / ' + STAGES + ' LOCKS';
      safeCrackerSetText(
        opponentStrip.querySelector('.sc-race-signal'),
        opponent?.completed ? 'SAFE OPEN' : opponentTier ? tierLabel(opponentTier) : 'SEARCHING'
      );
    }

    const display = root.querySelector('[data-sc-display]');
    if (display) {
      for (const tier of ['idle', 'red', 'orange', 'yellow', 'green', 'fresh']) display.classList.remove(tier);
      display.classList.add(displayTier);
      if (runtime.feedbackFresh) {
        void display.offsetWidth;
        display.classList.add('fresh');
      }
      safeCrackerSetText(display.querySelector('.sc-display-status'), displayText);
      safeCrackerSetText(display.querySelector('.sc-display-meta small'), 'TUMBLER ' + Math.min(STAGES, stage + 1) + ' OF ' + STAGES);
      safeCrackerSetText(display.querySelector('.sc-display-meta b'), attemptCount + ' ' + (attemptCount === 1 ? 'ATTEMPT' : 'ATTEMPTS'));
      const meter = display.querySelector('.sc-feedback-meter');
      if (meter) safeCrackerReplaceMarkup(meter, feedbackMeter(displayTier));
    }

    const previousLatchStage = runtime.latchGameId === gameId
      ? Math.max(0, Math.min(STAGES, Number(runtime.latchStage || 0)))
      : 0;
    const releasingLatch = stage > previousLatchStage ? stage : 0;
    root.querySelectorAll('.sc-bolts.right .sc-latch-mount > i').forEach((latch, index) => {
      const latchNumber = index + 1;
      latch.classList.remove('sc-latch-releasing');
      latch.classList.toggle('sc-latch-released', stage >= latchNumber);
      if (releasingLatch === latchNumber) {
        void latch.offsetWidth;
        latch.classList.add('sc-latch-releasing');
      }
    });
    runtime.latchGameId = gameId;
    runtime.latchStage = stage;

    root.querySelector('.sc-safe-shell')?.classList.toggle('open', stage >= STAGES);

    const attemptPanel = root.querySelector('.sc-attempt-panel');
    if (attemptPanel) {
      safeCrackerSetText(attemptPanel.querySelector('h3 span'), 'TUMBLER ' + Math.min(STAGES, stage + 1) + ' LOG');
      safeCrackerSetText(attemptPanel.querySelector('h3 b'), attemptCount + ' TOTAL');
      const attemptList = attemptPanel.querySelector('.sc-attempt-list');
      if (attemptList) attemptList.innerHTML = attemptRows(me?.attempts || [], stage);
    }

    applyDialVisual();
    safeCrackerUpdateConfirmControl();
    return true;
  }
  // SAFE_CRACKER_RENDER_STABILITY_V1_END

`;

  client = replaceOnce(
    client,
    '  function render(game) {',
    `${helper}  function render(game) {`,
    'render helper insertion point'
  );

  client = replaceOnce(
    client,
    '    mount.innerHTML = `',
    '    const reusedMountedBoard = safeCrackerUpdateMountedBoard(game);\n    if (!reusedMountedBoard) mount.innerHTML = `',
    'full-board HTML replacement'
  );

  client = replaceInsideRender(
    client,
    /\n(\s*)bindControls\(mount, game\);/,
    '\n$1if (!reusedMountedBoard) bindControls(mount, game);',
    'render control binding'
  );
}

await writeFile(clientUrl, client);

let data = await readFile(dataUrl, 'utf8');
if (!data.includes(latencyMarker)) {
  const fastApply = String.raw`${latencyMarker}
async function safeCrackerApplyGuess(game, actorId, guess, actionId = '', isBot = false) {
  const id = cleanUserId(actorId);
  const gameId = mpCleanId(game?.gameId);
  const cleanActionId = String(actionId || '').replace(/[^A-Za-z0-9._:-]/g, '').slice(0, 120);
  if (!id || !gameId) throw new Error('Safe Cracker could not identify that action.');
  let fallback = game;
  for (let writeAttempt = 0; writeAttempt < 4; writeAttempt += 1) {
    // safeCrackerAction and the bot preflight already supplied a strong snapshot.
    // Reusing it on the first attempt removes one complete Blob read from every
    // guess while retries still re-read authoritative storage.
    const latest = writeAttempt === 0 && fallback
      ? fallback
      : (await duelGetRawStrong(gameId, 1) || await duelGetRaw(gameId) || fallback);
    if (!latest) throw new Error('That Safe Cracker duel was not found.');
    if (latest.mode !== 'safecracker') throw new Error('That duel is not Safe Cracker.');
    if (latest.status !== 'playing') return latest;
    let state = safeCrackerEnsureState(latest);
    if (cleanActionId && state.processedActionIds.includes(cleanActionId)) return latest;
    const player = { ...(state.players?.[id] || {}) };
    if (!player.code) throw new Error('Safe Cracker could not find that player safe.');
    if (int(player.stage, 0) >= SAFE_CRACKER_STAGES) return latest;
    const now = Date.now();
    const nextGuessMs = Date.parse(player.nextGuessAt || '');
    if (!isBot && Number.isFinite(nextGuessMs) && now < nextGuessMs) return latest;
    const stage = int(player.stage, 0);
    const target = int(String(player.code)[stage], 0);
    const distance = safeCrackerCircularDistance(target, guess);
    const tier = safeCrackerTier(distance);
    const correct = tier === 'green';
    const at = new Date(now).toISOString();
    const result = { stage, guess, distance, tier, correct, at };
    player.attempts = [...(Array.isArray(player.attempts) ? player.attempts : []), result].slice(-80);
    player.lastResult = result;
    player.stage = correct ? Math.min(SAFE_CRACKER_STAGES, stage + 1) : stage;
    player.nextGuessAt = new Date(now + SAFE_CRACKER_VERIFY_MS).toISOString();
    if (player.stage >= SAFE_CRACKER_STAGES) player.completedAt = at;
    const baseStateRevision = int(state.revision, 0);
    const processed = cleanActionId ? [...(state.processedActionIds || []), cleanActionId].slice(-80) : (state.processedActionIds || []);
    state = {
      ...state,
      revision: baseStateRevision + 1,
      players: { ...(state.players || {}), [id]: player },
      processedActionIds: processed,
      npcActionAt: isBot && player.stage < SAFE_CRACKER_STAGES ? new Date(now + safeCrackerBotDelay(latest)).toISOString() : state.npcActionAt
    };
    const candidate = { ...latest, safecrackerState: state };

    // Keep the pre-save completion/revision guard. It prevents a late guess from
    // overwriting an opponent's authoritative win, but uses only one strong
    // attempt instead of the older duplicated read chain.
    const beforeSave = await duelGetRawStrong(gameId, 1) || await duelGetRaw(gameId);
    if (beforeSave) {
      if (beforeSave.status !== 'playing') return beforeSave;
      const beforeState = safeCrackerEnsureState(beforeSave);
      if (cleanActionId && beforeState.processedActionIds.includes(cleanActionId)) return beforeSave;
      if (int(beforeState.revision, 0) > baseStateRevision || int(beforeSave.revision, 0) > int(latest.revision, 0)) {
        fallback = beforeSave;
        continue;
      }
    }

    // Final digits still use the protected immediate-completion path so the bot
    // cannot write after the winning player and reopen the round.
    if (player.stage >= SAFE_CRACKER_STAGES) {
      return await safeCrackerComplete(candidate, state, id, ((latest.creator?.userId === id ? latest.creator?.name : latest.joiner?.name) || 'A player') + ' opened the safe first.');
    }

    const saved = await duelSaveGame(candidate);
    const confirmed = await duelGetRawStrong(gameId, 1) || await duelGetRaw(gameId) || saved;
    const confirmedState = safeCrackerEnsureState(confirmed);
    const kept = cleanActionId
      ? confirmedState.processedActionIds.includes(cleanActionId)
      : String(confirmedState.players?.[id]?.lastResult?.at || '') === at;
    if (kept) return confirmed;
    fallback = confirmed;
  }
  return await duelGetRawStrong(gameId, 1) || await duelGetRaw(gameId) || fallback;
}

`;
  data = replaceSection(
    data,
    "async function safeCrackerApplyGuess(game, actorId, guess, actionId = '', isBot = false) {",
    'async function safeCrackerAdvanceAndSave(game) {',
    fastApply,
    'fast authoritative guess writer'
  );

  const fastAdvance = String.raw`async function safeCrackerAdvanceAndSave(game) {
  const gameId = mpCleanId(game?.gameId);
  if (!gameId) return game;

  // Polling normally only observes the bot timer. Do that read outside the
  // mutation lock so an aborted/in-flight GET cannot queue in front of a player
  // pressing Check Number.
  const observed = await duelGetRawStrong(gameId, 1) || await duelGetRaw(gameId) || game;
  if (!observed || observed.status !== 'playing' || observed.mode !== 'safecracker') return observed || game;
  const observedState = safeCrackerEnsureState(observed);
  const observedCompletedPlayerId = safeCrackerCompletedPlayerId(observed, observedState);
  const observedEndMs = Date.parse(observedState.endAt || '');
  const observedNpcPlayer = [observed.creator, observed.joiner].find(player => player?.isNpc || String(player?.userId || '').startsWith('npc-') || String(player?.userId || '').startsWith('remote-bot-'));
  const observedNpcId = cleanUserId(observedNpcPlayer?.userId || '');
  const observedScheduled = Date.parse(observedState.npcActionAt || '');
  const observedNpcDone = !observedNpcId || int(observedState.players?.[observedNpcId]?.stage, 0) >= SAFE_CRACKER_STAGES;
  const needsMutation = Boolean(observedCompletedPlayerId)
    || (Number.isFinite(observedEndMs) && Date.now() >= observedEndMs)
    || (observedNpcDone ? Boolean(observedState.npcActionAt) : !Number.isFinite(observedScheduled) || Date.now() >= observedScheduled);
  if (!needsMutation) return observed;

  return await withSafeCrackerLock(gameId, async () => {
    let latest = await duelGetRawStrong(gameId, 1) || await duelGetRaw(gameId) || observed;
    if (!latest || latest.status !== 'playing' || latest.mode !== 'safecracker') return latest || observed;
    let state = safeCrackerEnsureState(latest);
    const alreadyCompletedPlayerId = safeCrackerCompletedPlayerId(latest, state);
    if (alreadyCompletedPlayerId) {
      const playerName = latest.creator?.userId === alreadyCompletedPlayerId ? latest.creator?.name : latest.joiner?.name;
      return await safeCrackerComplete({ ...latest, safecrackerState: state }, state, alreadyCompletedPlayerId, (playerName || 'A player') + ' opened the safe first.');
    }
    const endMs = Date.parse(state.endAt || '');
    if (Number.isFinite(endMs) && Date.now() >= endMs) {
      return await safeCrackerComplete({ ...latest, safecrackerState: state }, state, '', 'Time expired before either safe opened.');
    }
    const npcPlayer = [latest.creator, latest.joiner].find(player => player?.isNpc || String(player?.userId || '').startsWith('npc-') || String(player?.userId || '').startsWith('remote-bot-'));
    const npcId = cleanUserId(npcPlayer?.userId || '');
    if (!npcId || int(state.players?.[npcId]?.stage, 0) >= SAFE_CRACKER_STAGES) {
      if (state.npcActionAt) {
        state = { ...state, revision: int(state.revision, 0) + 1, npcActionAt: null };
        return await duelSaveGame({ ...latest, safecrackerState: state });
      }
      return latest;
    }
    const scheduled = Date.parse(state.npcActionAt || '');
    if (!Number.isFinite(scheduled)) {
      state = { ...state, revision: int(state.revision, 0) + 1, npcActionAt: new Date(Date.now() + safeCrackerBotDelay(latest)).toISOString() };
      return await duelSaveGame({ ...latest, safecrackerState: state });
    }
    if (Date.now() < scheduled) return latest;
    const guess = safeCrackerBotGuess(state.players[npcId]);
    return await safeCrackerApplyGuess({ ...latest, safecrackerState: state }, npcId, guess, 'bot-' + state.revision + '-' + guess, true);
  });
}

`;
  data = replaceSection(
    data,
    'async function safeCrackerAdvanceAndSave(game) {',
    'async function safeCrackerAction(user, gameId, rawChoice, details = {}) {',
    fastAdvance,
    'nonblocking Safe Cracker poll advancement'
  );

  const fastAction = String.raw`async function safeCrackerAction(user, gameId, rawChoice, details = {}) {
  return await withSafeCrackerLock(gameId, async () => {
    const viewer = cleanUserId(user.id);
    const actionStartedAt = Date.now();
    let game = await duelGetRawStrong(gameId, 1) || await duelGetRaw(gameId);
    if (!game) throw new Error('That Safe Cracker duel was not found.');
    if (game.mode !== 'safecracker') throw new Error('That duel is not Safe Cracker.');
    if (game.status !== 'playing') {
      const response = { game: duelPublicGame(game, viewer), feedbackPath: 'fast-authoritative-v1', feedbackServerMs: Date.now() - actionStartedAt };
      if (game.status === 'complete') response.record = await getUserRecord(viewer);
      else response.skipBalanceLookup = true;
      return response;
    }
    if (!safeCrackerPlayerIds(game).includes(viewer)) throw new Error('You are not in this Safe Cracker duel.');
    let state = safeCrackerEnsureState(game);
    const alreadyCompletedPlayerId = safeCrackerCompletedPlayerId(game, state);
    if (alreadyCompletedPlayerId) {
      const playerName = game.creator?.userId === alreadyCompletedPlayerId ? game.creator?.name : game.joiner?.name;
      game = await safeCrackerComplete({ ...game, safecrackerState: state }, state, alreadyCompletedPlayerId, (playerName || 'A player') + ' opened the safe first.');
      return { game: duelPublicGame(game, viewer), record: await getUserRecord(viewer), repairedCompletion: true, feedbackPath: 'fast-authoritative-v1', feedbackServerMs: Date.now() - actionStartedAt };
    }
    const endMs = Date.parse(state.endAt || '');
    if (Number.isFinite(endMs) && Date.now() >= endMs) {
      game = await safeCrackerComplete({ ...game, safecrackerState: state }, state, '', 'Time expired before either safe opened.');
      return { game: duelPublicGame(game, viewer), record: await getUserRecord(viewer), feedbackPath: 'fast-authoritative-v1', feedbackServerMs: Date.now() - actionStartedAt };
    }
    const actionId = String(details.actionId || '').replace(/[^A-Za-z0-9._:-]/g, '').slice(0, 120);
    if (actionId && state.processedActionIds.includes(actionId)) {
      return {
        game: duelPublicGame({ ...game, safecrackerState: state }, viewer),
        skipBalanceLookup: true,
        ignoredAction: true,
        ignoreReason: 'duplicate',
        feedbackPath: 'fast-authoritative-v1',
        feedbackServerMs: Date.now() - actionStartedAt
      };
    }
    const match = /^safecracker:guess:([0-9])$/.exec(String(rawChoice || '').toLowerCase());
    if (!match) throw new Error('Choose one dial number from 0 to 9.');
    const player = state.players?.[viewer] || {};
    const nextGuessMs = Date.parse(player.nextGuessAt || '');
    if (Number.isFinite(nextGuessMs) && Date.now() < nextGuessMs) {
      return {
        game: duelPublicGame({ ...game, safecrackerState: state }, viewer),
        skipBalanceLookup: true,
        ignoredAction: true,
        ignoreReason: 'verification-cooldown',
        retryAfterMs: Math.max(0, nextGuessMs - Date.now()),
        feedbackPath: 'fast-authoritative-v1',
        feedbackServerMs: Date.now() - actionStartedAt
      };
    }
    game = await safeCrackerApplyGuess({ ...game, safecrackerState: state }, viewer, int(match[1], 0), actionId, false);
    const response = {
      game: duelPublicGame(game, viewer),
      feedbackPath: 'fast-authoritative-v1',
      feedbackServerMs: Date.now() - actionStartedAt
    };
    if (game.status === 'complete') response.record = await getUserRecord(viewer);
    else response.skipBalanceLookup = true;
    return response;
  });
}
// SAFE_CRACKER_FEEDBACK_LATENCY_V1_END

`;
  data = replaceSection(
    data,
    'async function safeCrackerAction(user, gameId, rawChoice, details = {}) {',
    '// SAFE_CRACKER_SERVER_END',
    fastAction,
    'fast Safe Cracker action response'
  );
}
await writeFile(dataUrl, data);

let action = await readFile(actionUrl, 'utf8');
action = action.replace(/const DUEL_FUNCTION_BUILD = "[^"]+";/, 'const DUEL_FUNCTION_BUILD = "safecracker-feedback-fast-v10";');
action = replaceOnce(
  action,
  '    "X-Duel-Function-Build": DUEL_FUNCTION_BUILD',
  '    "X-Duel-Function-Build": DUEL_FUNCTION_BUILD,\n    "X-Safe-Cracker-Feedback": "fast-authoritative-v1"',
  'feedback-speed response header'
);
action = replaceOnce(
  action,
  '    if (result?.unchanged || result?.databaseAuthoritative) {',
  '    if (result?.unchanged || result?.databaseAuthoritative || result?.skipBalanceLookup) {',
  'active-guess balance lookup bypass'
);
await writeFile(actionUrl, action);

let html = await readFile(indexUrl, 'utf8');
html = html.replace(/&render=\d+/g, '');
html = html.replace(/(\/assets\/safe-cracker\/safe-cracker\.(?:css|js)\?[^"'\s>]+)/g, '$1&render=1');
await writeFile(indexUrl, html);

console.log('Applied Safe Cracker render stability and feedback latency v1: active board updates stay in place, normal polls no longer queue ahead of guesses, redundant authoritative reads are removed, and non-final guesses skip the unchanged balance lookup.');
