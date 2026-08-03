'use strict';

const {
  MOUNTAIN_RACE_CONTROLS,
  MOUNTAIN_RACE_DEFAULT_STEPS,
  MOUNTAIN_RACE_DURATION_MS,
  normalizeMountainRaceControl,
  createMountainRaceState,
  applyMountainRaceInput
} = require('./state-model');

const MOUNTAIN_RACE_BOT_ERROR_RATE = 0.08;
const MOUNTAIN_RACE_BOT_CATCH_UP_LIMIT = 10;

function createMountainRaceIntegration(host = {}) {
  const {
    cleanUserId,
    int,
    mpCleanId,
    getRaw,
    getRawStrong,
    saveGame,
    publicGame,
    completeResolved,
    getUserRecord
  } = host;

  for (const [name, value] of Object.entries({
    cleanUserId,
    int,
    mpCleanId,
    getRaw,
    saveGame,
    publicGame,
    completeResolved,
    getUserRecord
  })) {
    if (typeof value !== 'function') throw new TypeError(`Summit Sprint integration requires ${name}.`);
  }

  const locks = globalThis.__MOUNTAIN_RACE_LOCKS || (globalThis.__MOUNTAIN_RACE_LOCKS = new Map());

  async function strongRead(gameId) {
    if (typeof getRawStrong === 'function') return await getRawStrong(gameId) || await getRaw(gameId);
    return await getRaw(gameId);
  }

  async function withLock(gameId, task) {
    const key = mpCleanId(gameId);
    const previous = locks.get(key) || Promise.resolve();
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const queued = previous.then(() => gate);
    locks.set(key, queued);
    await previous;
    try {
      return await task();
    } finally {
      release();
      if (locks.get(key) === queued) locks.delete(key);
    }
  }

  function playerIds(game) {
    return [cleanUserId(game?.creator?.userId), cleanUserId(game?.joiner?.userId)].filter(Boolean);
  }

  function gamePlayer(game, id) {
    if (cleanUserId(game?.creator?.userId) === id) return game.creator || {};
    if (cleanUserId(game?.joiner?.userId) === id) return game.joiner || {};
    return {};
  }

  function isBotProfile(profile = {}) {
    const id = String(profile?.userId || '');
    return Boolean(profile?.isNpc) || id.startsWith('npc-') || id.startsWith('remote-bot-');
  }

  function isRemoteBotProfile(profile = {}) {
    const id = String(profile?.userId || '');
    return Boolean(profile?.isRemoteBot) || id.startsWith('remote-bot-');
  }

  function botProfile(game) {
    return [game?.creator, game?.joiner].find(isBotProfile) || null;
  }

  function remoteNetworkConfig(game) {
    return game?.remoteNetworkConfig && typeof game.remoteNetworkConfig === 'object'
      ? game.remoteNetworkConfig
      : null;
  }

  function botDelay(game) {
    const network = remoteNetworkConfig(game);
    const min = network ? Math.max(100, int(network.minDelayMs, 100)) : 430;
    const max = network ? Math.max(min, int(network.maxDelayMs, min + 220)) : 690;
    let delay = min + Math.floor(Math.random() * (max - min + 1));

    if (network && Math.random() < Number(network.stallChance || 0)) {
      delay += 900 + Math.floor(Math.random() * 1300);
    }
    if (network && Math.random() < Number(network.reconnectChance || 0)) {
      delay += 600 + Math.floor(Math.random() * 1200);
    }
    return delay;
  }

  function botControl(state, botId) {
    const expected = normalizeMountainRaceControl(
      state.sequence[int(state.players?.[botId]?.promptIndex, 0)]
    ) || 'up';
    if (Math.random() >= MOUNTAIN_RACE_BOT_ERROR_RATE) return expected;
    const alternatives = MOUNTAIN_RACE_CONTROLS.filter(token => token !== expected);
    return alternatives[Math.floor(Math.random() * alternatives.length)] || 'left';
  }

  function firstBotActionAt(game, state, startMs = Date.now()) {
    const bot = botProfile(game);
    if (!bot) return null;
    const raceStart = Date.parse(state?.startAt || '');
    const anchor = Number.isFinite(raceStart) ? raceStart : Number(startMs) || Date.now();
    return new Date(anchor + botDelay(game)).toISOString();
  }

  function initialState(game, startMs = Date.now()) {
    const ids = playerIds(game);
    if (ids.length !== 2) return null;
    const state = createMountainRaceState({
      playerIds: ids,
      now: startMs,
      countdownMs: 0,
      sequenceLength: MOUNTAIN_RACE_DEFAULT_STEPS
    });
    return {
      ...state,
      npcActionAt: firstBotActionAt(game, state, startMs),
      botActionSequence: 0,
      botLastActionAt: null,
      botCatchUpCount: 0
    };
  }

  function ensureState(game) {
    const ids = playerIds(game);
    if (ids.length !== 2) return null;
    const existing = game?.mountainraceState && typeof game.mountainraceState === 'object'
      ? game.mountainraceState
      : null;
    const sequence = Array.isArray(existing?.sequence)
      ? existing.sequence.map(normalizeMountainRaceControl).filter(Boolean).slice(0, 80)
      : [];
    const startAtMs = Date.parse(existing?.startAt || '');
    const endAtMs = Date.parse(existing?.endAt || '');
    if (
      !existing?.roundId
      || sequence.length < 8
      || !Number.isFinite(startAtMs)
      || !Number.isFinite(endAtMs)
      || endAtMs - startAtMs !== MOUNTAIN_RACE_DURATION_MS
    ) {
      return initialState(game, Date.parse(game?.startAt || '') || Date.now());
    }

    const players = {};
    for (const id of ids) {
      const raw = existing.players?.[id] && typeof existing.players[id] === 'object'
        ? existing.players[id]
        : {};
      const promptIndex = Math.max(0, Math.min(sequence.length, int(raw.promptIndex, 0)));
      players[id] = {
        playerId: id,
        promptIndex,
        acceptedInputs: int(raw.acceptedInputs, 0),
        rejectedInputs: int(raw.rejectedInputs, 0),
        progress: sequence.length ? promptIndex / sequence.length : 0,
        lastInput: raw.lastInput && typeof raw.lastInput === 'object'
          ? {
              control: normalizeMountainRaceControl(raw.lastInput.control),
              expected: normalizeMountainRaceControl(raw.lastInput.expected),
              correct: Boolean(raw.lastInput.correct),
              at: raw.lastInput.at || null
            }
          : null,
        finishedAt: raw.finishedAt || null,
        sequenceLength: sequence.length
      };
    }

    const ensured = {
      roundId: String(existing.roundId),
      revision: int(existing.revision, 0),
      startAt: new Date(startAtMs).toISOString(),
      endAt: new Date(endAtMs).toISOString(),
      sequence,
      players,
      processedActionIds: Array.isArray(existing.processedActionIds)
        ? existing.processedActionIds.map(String).slice(-120)
        : [],
      winnerId: cleanUserId(existing.winnerId || ''),
      completedAt: existing.completedAt || null,
      npcActionAt: existing.npcActionAt || null,
      botActionSequence: int(existing.botActionSequence, 0),
      botLastActionAt: existing.botLastActionAt || null,
      botCatchUpCount: int(existing.botCatchUpCount, 0)
    };

    if (!ensured.completedAt && botProfile(game) && !ensured.npcActionAt) {
      ensured.npcActionAt = firstBotActionAt(game, ensured, startAtMs);
    }
    return ensured;
  }

  function hasValidState(game) {
    const state = ensureState(game);
    if (!state || state.sequence.length !== MOUNTAIN_RACE_DEFAULT_STEPS) return false;
    return playerIds(game).every(id => state.players?.[id]?.playerId === id);
  }

  function publicPlayer(game, id, raw, viewerId) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const profile = gamePlayer(game, id);
    const isBot = isBotProfile(profile);
    return {
      playerId: id,
      name: String(profile?.name || (id === viewerId ? 'You' : isBot ? 'Mountain Bot' : 'Opponent')),
      badge: id === viewerId ? 'YOU' : isBot ? 'CPU' : 'P2',
      isBot,
      promptIndex: int(source.promptIndex, 0),
      acceptedInputs: int(source.acceptedInputs, 0),
      rejectedInputs: int(source.rejectedInputs, 0),
      progress: Math.max(0, Math.min(1, Number(source.progress) || 0)),
      lastInput: source.lastInput
        ? {
            control: normalizeMountainRaceControl(source.lastInput.control),
            correct: Boolean(source.lastInput.correct),
            at: source.lastInput.at || null
          }
        : null,
      finishedAt: source.finishedAt || null
    };
  }

  function publicState(game, viewerUserId) {
    const viewer = cleanUserId(viewerUserId);
    const ids = playerIds(game);
    const opponentId = ids.find(id => id !== viewer) || '';
    const state = game?.mountainraceState ? ensureState(game) : null;
    if (!state) {
      return {
        roundId: '',
        revision: 0,
        startAt: game?.startAt || null,
        endAt: null,
        secondsLeft: 30,
        stepsTotal: MOUNTAIN_RACE_DEFAULT_STEPS,
        canSubmit: false,
        prompts: [],
        me: publicPlayer(game, viewer, {}, viewer),
        opponent: publicPlayer(game, opponentId, {}, viewer),
        winnerUserId: '',
        viewerWon: false,
        tie: false
      };
    }

    const me = state.players?.[viewer] || {};
    const opponent = state.players?.[opponentId] || {};
    const endAtMs = Date.parse(state.endAt || '');
    const winnerUserId = cleanUserId(state.winnerId || '');
    const complete = String(game?.status || '') === 'complete';
    return {
      roundId: state.roundId,
      revision: int(state.revision, 0),
      startAt: state.startAt,
      endAt: state.endAt,
      secondsLeft: Number.isFinite(endAtMs)
        ? Math.max(0, Math.ceil((endAtMs - Date.now()) / 1000))
        : 30,
      stepsTotal: state.sequence.length,
      canSubmit:
        String(game?.status || '') === 'playing'
        && ids.includes(viewer)
        && !me.finishedAt
        && !state.completedAt,
      prompts: state.sequence.slice(int(me.promptIndex, 0), int(me.promptIndex, 0) + 4),
      me: publicPlayer(game, viewer, me, viewer),
      opponent: publicPlayer(game, opponentId, opponent, viewer),
      winnerUserId,
      viewerWon: Boolean(winnerUserId && winnerUserId === viewer),
      tie: Boolean(complete && !winnerUserId),
      completedAt: state.completedAt || null
    };
  }

  function summary(game, state, winnerId, tie, reason) {
    const creatorId = cleanUserId(game?.creator?.userId);
    const joinerId = cleanUserId(game?.joiner?.userId);
    const stats = id => ({
      holds: int(state.players?.[id]?.promptIndex, 0),
      mistakes: int(state.players?.[id]?.rejectedInputs, 0)
    });
    return {
      mode: 'mountainrace',
      winnerRole: tie ? '' : winnerId === creatorId ? 'creator' : 'joiner',
      tie: Boolean(tie),
      text: reason || (
        tie
          ? 'Both climbers finished at the same height.'
          : 'First climber to the summit wins.'
      ),
      creator: stats(creatorId),
      joiner: stats(joinerId)
    };
  }

  async function complete(game, state, winnerId = '', reason = '') {
    const cleanWinner = cleanUserId(winnerId);
    const finalState = {
      ...state,
      winnerId: cleanWinner,
      completedAt: state.completedAt || new Date().toISOString(),
      npcActionAt: null,
      revision: int(state.revision, 0) + 1
    };
    return await completeResolved(
      { ...game, mountainraceState: finalState, npcActionAt: null },
      summary(game, finalState, cleanWinner, !cleanWinner, reason)
    );
  }

  async function resolveTimeout(game, state) {
    const ids = playerIds(game);
    const first = ids[0] || '';
    const second = ids[1] || '';
    const firstHeight = int(state.players?.[first]?.promptIndex, 0);
    const secondHeight = int(state.players?.[second]?.promptIndex, 0);
    if (firstHeight === secondHeight) {
      return await complete(
        game,
        state,
        '',
        'Time expired with both climbers at the same height.'
      );
    }
    const winnerId = firstHeight > secondHeight ? first : second;
    const winnerName = gamePlayer(game, winnerId)?.name || 'A climber';
    return await complete(game, state, winnerId, winnerName + ' was higher when time expired.');
  }

  async function applyControl(game, actorId, rawControl, actionId = '', options = {}) {
    const id = cleanUserId(actorId);
    const state = ensureState(game);
    if (!state?.players?.[id]) throw new Error('Summit Sprint could not find that climber.');

    const actionAtMs = Number.isFinite(Number(options.actionAtMs))
      ? Number(options.actionAtMs)
      : Date.now();
    const next = applyMountainRaceInput(state, id, rawControl, actionId, actionAtMs);
    if (next === state) return game;

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

    const candidate = { ...game, mountainraceState: next };
    if (next.winnerId) {
      const winnerName = gamePlayer(game, next.winnerId)?.name || 'A climber';
      return await complete(candidate, next, next.winnerId, winnerName + ' reached the summit first.');
    }
    return await saveGame(candidate);
  }

  async function applyActionUnlocked(user, game, rawChoice, details = {}, options = {}) {
    const viewer = cleanUserId(user?.id);
    if (!game) throw new Error('That Summit Sprint race was not found.');
    if (game.mode !== 'mountainrace') throw new Error('That duel is not Summit Sprint.');
    if (!playerIds(game).includes(viewer)) {
      throw new Error('You are not in this Summit Sprint race.');
    }
    if (game.status !== 'playing') {
      return { game, skipBalanceLookup: true };
    }

    const state = ensureState(game);
    if (!state) throw new Error('Summit Sprint could not initialize the mountain course.');

    const actionAtMs = Number.isFinite(Number(options.actionAtMs))
      ? Number(options.actionAtMs)
      : Date.now();
    const endAtMs = Date.parse(state.endAt || '');
    if (Number.isFinite(endAtMs) && actionAtMs >= endAtMs) {
      return { game: await resolveTimeout({ ...game, mountainraceState: state }, state) };
    }

    const actionId = String(details.actionId || '')
      .replace(/[^A-Za-z0-9._:-]/g, '')
      .slice(0, 120);
    if (actionId && state.processedActionIds.includes(actionId)) {
      return {
        game: { ...game, mountainraceState: state },
        skipBalanceLookup: true,
        ignoredAction: true,
        ignoreReason: 'duplicate'
      };
    }

    const expectedPromptIndex = Number(details.expectedPromptIndex);
    const actualPromptIndex = int(state.players?.[viewer]?.promptIndex, 0);
    if (
      Number.isFinite(expectedPromptIndex)
      && expectedPromptIndex >= 0
      && expectedPromptIndex !== actualPromptIndex
    ) {
      return {
        game: { ...game, mountainraceState: state },
        skipBalanceLookup: true,
        ignoredAction: true,
        ignoreReason: 'prompt-changed'
      };
    }

    const match = /^mountainrace:input:(up|left|right|down)$/.exec(
      String(rawChoice || '').toLowerCase()
    );
    if (!match) throw new Error('Choose one valid climbing direction.');

    const nextGame = await applyControl(
      { ...game, mountainraceState: state },
      viewer,
      match[1],
      actionId,
      {
        isBot: Boolean(options.isBot),
        actionAtMs,
        scheduleFromMs: options.scheduleFromMs,
        catchUpCount: options.catchUpCount
      }
    );
    return { game: nextGame, skipBalanceLookup: nextGame.status !== 'complete' };
  }

  async function advance(game) {
    const gameId = mpCleanId(game?.gameId);
    if (!gameId) return game;

    const observed = await strongRead(gameId) || game;
    if (!observed || observed.mode !== 'mountainrace' || observed.status !== 'playing') {
      return observed || game;
    }

    const observedState = ensureState(observed);
    if (!observedState) return observed;
    const endAtMs = Date.parse(observedState.endAt || '');
    const profile = botProfile(observed);
    const botId = cleanUserId(profile?.userId || '');
    const botFinished = !botId || Boolean(observedState.players?.[botId]?.finishedAt);
    const scheduledAt = Date.parse(observedState.npcActionAt || '');
    const now = Date.now();
    const needsMutation =
      Boolean(observedState.winnerId)
      || (Number.isFinite(endAtMs) && now >= endAtMs)
      || (!botFinished && (!Number.isFinite(scheduledAt) || now >= scheduledAt))
      || (botFinished && Boolean(observedState.npcActionAt));

    if (!needsMutation) return observed;

    return await withLock(gameId, async () => {
      let latest = await strongRead(gameId) || observed;
      if (!latest || latest.mode !== 'mountainrace' || latest.status !== 'playing') {
        return latest || observed;
      }

      let state = ensureState(latest);
      if (!state) return latest;
      if (state.winnerId) {
        return await complete(latest, state, state.winnerId, 'A climber reached the summit first.');
      }

      const npcProfile = botProfile(latest);
      const npcId = cleanUserId(npcProfile?.userId || '');
      if (!npcId || state.players?.[npcId]?.finishedAt) {
        if (state.npcActionAt) {
          state = {
            ...state,
            npcActionAt: null,
            revision: int(state.revision, 0) + 1
          };
          return await saveGame({ ...latest, mountainraceState: state });
        }
        const endMs = Date.parse(state.endAt || '');
        if (Number.isFinite(endMs) && Date.now() >= endMs) {
          return await resolveTimeout(latest, state);
        }
        return latest;
      }

      let scheduled = Date.parse(state.npcActionAt || '');
      if (!Number.isFinite(scheduled)) {
        const firstAt = firstBotActionAt(
          latest,
          state,
          Date.parse(state.startAt || '') || Date.now()
        );
        state = {
          ...state,
          npcActionAt: firstAt,
          revision: int(state.revision, 0) + 1
        };
        latest = await saveGame({ ...latest, mountainraceState: state });
        state = ensureState(latest);
        scheduled = Date.parse(state?.npcActionAt || '');
      }

      const currentNow = Date.now();
      const raceEndMs = Date.parse(state.endAt || '');
      const dueThrough = Number.isFinite(raceEndMs)
        ? Math.min(currentNow, raceEndMs - 1)
        : currentNow;
      let processed = 0;

      // Serverless functions do not have a permanent background process. A focused
      // GET wakes this driver, which replays every bot action whose network timestamp
      // became due. Each replay uses the same action validation, prompt-index guard,
      // action-id dedupe, persistence, and winner settlement as a player request.
      while (
        latest?.status === 'playing'
        && Number.isFinite(scheduled)
        && scheduled <= dueThrough
        && processed < MOUNTAIN_RACE_BOT_CATCH_UP_LIMIT
      ) {
        state = ensureState(latest);
        if (!state || state.players?.[npcId]?.finishedAt || state.winnerId) break;

        const promptIndex = int(state.players?.[npcId]?.promptIndex, 0);
        const sequenceNumber = int(state.botActionSequence, 0) + 1;
        const token = botControl(state, npcId);
        const actionId = `mountain-${isRemoteBotProfile(npcProfile) ? 'remote' : 'npc'}-${state.roundId}-${sequenceNumber}`;
        const result = await applyActionUnlocked(
          { id: npcId, name: npcProfile?.name || 'Mountain Bot' },
          latest,
          `mountainrace:input:${token}`,
          { actionId, expectedPromptIndex: promptIndex },
          {
            isBot: true,
            actionAtMs: scheduled,
            scheduleFromMs: scheduled,
            catchUpCount: processed + 1
          }
        );
        latest = result.game;
        processed += 1;

        if (!latest || latest.status !== 'playing') return latest || observed;

        // Network profiles can retry the same request. Reusing the exact action id
        // exercises the normal duplicate path without moving the bot twice.
        const network = remoteNetworkConfig(latest);
        if (network && Math.random() < Number(network.duplicateChance || 0)) {
          await applyActionUnlocked(
            { id: npcId, name: npcProfile?.name || 'Mountain Bot' },
            latest,
            `mountainrace:input:${token}`,
            { actionId, expectedPromptIndex: promptIndex },
            {
              isBot: true,
              actionAtMs: scheduled,
              scheduleFromMs: scheduled,
              catchUpCount: processed
            }
          );
        }

        state = ensureState(latest);
        scheduled = Date.parse(state?.npcActionAt || '');
      }

      state = ensureState(latest);
      if (!state) return latest;
      const finalEndMs = Date.parse(state.endAt || '');
      if (latest.status === 'playing' && Number.isFinite(finalEndMs) && Date.now() >= finalEndMs) {
        return await resolveTimeout(latest, state);
      }
      return latest;
    });
  }

  async function action(user, gameId, rawChoice, details = {}) {
    return await withLock(gameId, async () => {
      const viewer = cleanUserId(user.id);
      const game = await strongRead(gameId);
      const result = await applyActionUnlocked(user, game, rawChoice, details, {});
      const response = {
        game: publicGame(result.game, viewer),
        ...(result.ignoredAction
          ? { ignoredAction: true, ignoreReason: result.ignoreReason }
          : {})
      };
      if (result.game?.status === 'complete') {
        response.record = await getUserRecord(viewer);
      } else {
        response.skipBalanceLookup = true;
      }
      return response;
    });
  }

  return Object.freeze({
    initialState,
    ensureState,
    hasValidState,
    publicState,
    advance,
    action,
    playerIds
  });
}

module.exports = {
  MOUNTAIN_RACE_BOT_ERROR_RATE,
  MOUNTAIN_RACE_BOT_CATCH_UP_LIMIT,
  createMountainRaceIntegration
};
