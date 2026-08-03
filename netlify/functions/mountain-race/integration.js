'use strict';

const {
  MOUNTAIN_RACE_CONTROLS,
  MOUNTAIN_RACE_DEFAULT_STEPS,
  MOUNTAIN_RACE_DURATION_MS,
  normalizeMountainRaceControl,
  createMountainRaceState,
  applyMountainRaceInput
} = require('./state-model');

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

  for (const [name, value] of Object.entries({ cleanUserId, int, mpCleanId, getRaw, saveGame, publicGame, completeResolved, getUserRecord })) {
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
    try { return await task(); }
    finally {
      release();
      if (locks.get(key) === queued) locks.delete(key);
    }
  }

  function playerIds(game) {
    return [cleanUserId(game?.creator?.userId), cleanUserId(game?.joiner?.userId)].filter(Boolean);
  }

  function initialState(game, startMs = Date.now()) {
    const ids = playerIds(game);
    if (ids.length !== 2) return null;
    return createMountainRaceState({
      playerIds: ids,
      now: startMs,
      countdownMs: 0,
      sequenceLength: MOUNTAIN_RACE_DEFAULT_STEPS
    });
  }

  function ensureState(game) {
    const ids = playerIds(game);
    if (ids.length !== 2) return null;
    const existing = game?.mountainraceState && typeof game.mountainraceState === 'object' ? game.mountainraceState : null;
    const sequence = Array.isArray(existing?.sequence)
      ? existing.sequence.map(normalizeMountainRaceControl).filter(Boolean).slice(0, 80)
      : [];
    const startAtMs = Date.parse(existing?.startAt || '');
    const endAtMs = Date.parse(existing?.endAt || '');
    if (!existing?.roundId || sequence.length < 8 || !Number.isFinite(startAtMs) || !Number.isFinite(endAtMs) || endAtMs - startAtMs !== MOUNTAIN_RACE_DURATION_MS) {
      return initialState(game, Date.parse(game?.startAt || '') || Date.now());
    }
    const players = {};
    for (const id of ids) {
      const raw = existing.players?.[id] && typeof existing.players[id] === 'object' ? existing.players[id] : {};
      const promptIndex = Math.max(0, Math.min(sequence.length, int(raw.promptIndex, 0)));
      players[id] = {
        playerId: id,
        promptIndex,
        acceptedInputs: int(raw.acceptedInputs, 0),
        rejectedInputs: int(raw.rejectedInputs, 0),
        progress: sequence.length ? promptIndex / sequence.length : 0,
        lastInput: raw.lastInput && typeof raw.lastInput === 'object' ? {
          control: normalizeMountainRaceControl(raw.lastInput.control),
          expected: normalizeMountainRaceControl(raw.lastInput.expected),
          correct: Boolean(raw.lastInput.correct),
          at: raw.lastInput.at || null
        } : null,
        finishedAt: raw.finishedAt || null,
        sequenceLength: sequence.length
      };
    }
    return {
      roundId: String(existing.roundId),
      revision: int(existing.revision, 0),
      startAt: new Date(startAtMs).toISOString(),
      endAt: new Date(endAtMs).toISOString(),
      sequence,
      players,
      processedActionIds: Array.isArray(existing.processedActionIds) ? existing.processedActionIds.map(String).slice(-120) : [],
      winnerId: cleanUserId(existing.winnerId || ''),
      completedAt: existing.completedAt || null,
      npcActionAt: existing.npcActionAt || null
    };
  }

  function hasValidState(game) {
    const state = ensureState(game);
    if (!state || state.sequence.length !== MOUNTAIN_RACE_DEFAULT_STEPS) return false;
    return playerIds(game).every(id => state.players?.[id]?.playerId === id);
  }

  function gamePlayer(game, id) {
    if (cleanUserId(game?.creator?.userId) === id) return game.creator || {};
    if (cleanUserId(game?.joiner?.userId) === id) return game.joiner || {};
    return {};
  }

  function publicPlayer(game, id, raw, viewerId) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const profile = gamePlayer(game, id);
    const isBot = Boolean(profile?.isNpc || String(profile?.userId || '').startsWith('npc-') || String(profile?.userId || '').startsWith('remote-bot-'));
    return {
      playerId: id,
      name: String(profile?.name || (id === viewerId ? 'You' : isBot ? 'Mountain Bot' : 'Opponent')),
      badge: id === viewerId ? 'YOU' : isBot ? 'CPU' : 'P2',
      isBot,
      promptIndex: int(source.promptIndex, 0),
      acceptedInputs: int(source.acceptedInputs, 0),
      rejectedInputs: int(source.rejectedInputs, 0),
      progress: Math.max(0, Math.min(1, Number(source.progress) || 0)),
      lastInput: source.lastInput ? {
        control: normalizeMountainRaceControl(source.lastInput.control),
        correct: Boolean(source.lastInput.correct),
        at: source.lastInput.at || null
      } : null,
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
        roundId: '', revision: 0, startAt: game?.startAt || null, endAt: null,
        secondsLeft: 30, stepsTotal: MOUNTAIN_RACE_DEFAULT_STEPS, canSubmit: false,
        prompts: [], me: publicPlayer(game, viewer, {}, viewer),
        opponent: publicPlayer(game, opponentId, {}, viewer), winnerUserId: '', viewerWon: false, tie: false
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
      secondsLeft: Number.isFinite(endAtMs) ? Math.max(0, Math.ceil((endAtMs - Date.now()) / 1000)) : 30,
      stepsTotal: state.sequence.length,
      canSubmit: String(game?.status || '') === 'playing' && ids.includes(viewer) && !me.finishedAt && !state.completedAt,
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
      text: reason || (tie ? 'Both climbers finished at the same height.' : 'First climber to the summit wins.'),
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
    if (firstHeight === secondHeight) return await complete(game, state, '', 'Time expired with both climbers at the same height.');
    const winnerId = firstHeight > secondHeight ? first : second;
    const winnerName = gamePlayer(game, winnerId)?.name || 'A climber';
    return await complete(game, state, winnerId, winnerName + ' was higher when time expired.');
  }

  function botDelay(game) {
    const network = game?.remoteNetworkConfig && typeof game.remoteNetworkConfig === 'object' ? game.remoteNetworkConfig : null;
    const min = network ? Math.max(180, int(network.minDelayMs, 180)) : 430;
    const max = network ? Math.max(min, int(network.maxDelayMs, min + 220)) : 690;
    let delay = min + Math.floor(Math.random() * (max - min + 1));
    if (network && Math.random() < Number(network.stallChance || 0)) delay += 900 + Math.floor(Math.random() * 1300);
    return delay;
  }

  function botControl(state, botId) {
    const expected = normalizeMountainRaceControl(state.sequence[int(state.players?.[botId]?.promptIndex, 0)]) || 'up';
    if (Math.random() >= 0.08) return expected;
    const alternatives = MOUNTAIN_RACE_CONTROLS.filter(token => token !== expected);
    return alternatives[Math.floor(Math.random() * alternatives.length)] || 'left';
  }

  async function applyControl(game, actorId, rawControl, actionId = '', isBot = false) {
    const id = cleanUserId(actorId);
    const state = ensureState(game);
    if (!state?.players?.[id]) throw new Error('Summit Sprint could not find that climber.');
    const next = applyMountainRaceInput(state, id, rawControl, actionId, Date.now());
    if (next === state) return game;
    next.npcActionAt = isBot && !next.completedAt ? new Date(Date.now() + botDelay(game)).toISOString() : state.npcActionAt;
    const candidate = { ...game, mountainraceState: next };
    if (next.winnerId) {
      const winnerName = gamePlayer(game, next.winnerId)?.name || 'A climber';
      return await complete(candidate, next, next.winnerId, winnerName + ' reached the summit first.');
    }
    return await saveGame(candidate);
  }

  async function advance(game) {
    const gameId = mpCleanId(game?.gameId);
    if (!gameId) return game;
    const observed = await strongRead(gameId) || game;
    if (!observed || observed.mode !== 'mountainrace' || observed.status !== 'playing') return observed || game;
    const observedState = ensureState(observed);
    if (!observedState) return observed;
    const endAtMs = Date.parse(observedState.endAt || '');
    const botProfile = [observed.creator, observed.joiner].find(profile => profile?.isNpc || String(profile?.userId || '').startsWith('npc-') || String(profile?.userId || '').startsWith('remote-bot-'));
    const botId = cleanUserId(botProfile?.userId || '');
    const botFinished = !botId || Boolean(observedState.players?.[botId]?.finishedAt);
    const scheduledAt = Date.parse(observedState.npcActionAt || '');
    const needsMutation = Boolean(observedState.winnerId)
      || (Number.isFinite(endAtMs) && Date.now() >= endAtMs)
      || (!botFinished && (!Number.isFinite(scheduledAt) || Date.now() >= scheduledAt))
      || (botFinished && Boolean(observedState.npcActionAt));
    if (!needsMutation) return observed;

    return await withLock(gameId, async () => {
      let latest = await strongRead(gameId) || observed;
      if (!latest || latest.mode !== 'mountainrace' || latest.status !== 'playing') return latest || observed;
      let state = ensureState(latest);
      if (!state) return latest;
      if (state.winnerId) return await complete(latest, state, state.winnerId, 'A climber reached the summit first.');
      const endMs = Date.parse(state.endAt || '');
      if (Number.isFinite(endMs) && Date.now() >= endMs) return await resolveTimeout(latest, state);
      const npcProfile = [latest.creator, latest.joiner].find(profile => profile?.isNpc || String(profile?.userId || '').startsWith('npc-') || String(profile?.userId || '').startsWith('remote-bot-'));
      const npcId = cleanUserId(npcProfile?.userId || '');
      if (!npcId || state.players?.[npcId]?.finishedAt) {
        if (state.npcActionAt) {
          state = { ...state, npcActionAt: null, revision: int(state.revision, 0) + 1 };
          return await saveGame({ ...latest, mountainraceState: state });
        }
        return latest;
      }
      const scheduled = Date.parse(state.npcActionAt || '');
      if (!Number.isFinite(scheduled)) {
        state = { ...state, npcActionAt: new Date(Date.now() + botDelay(latest)).toISOString(), revision: int(state.revision, 0) + 1 };
        return await saveGame({ ...latest, mountainraceState: state });
      }
      if (Date.now() < scheduled) return latest;
      const token = botControl(state, npcId);
      return await applyControl({ ...latest, mountainraceState: state }, npcId, token, 'mountain-bot-' + state.revision + '-' + token, true);
    });
  }

  async function action(user, gameId, rawChoice, details = {}) {
    return await withLock(gameId, async () => {
      const viewer = cleanUserId(user.id);
      let game = await strongRead(gameId);
      if (!game) throw new Error('That Summit Sprint race was not found.');
      if (game.mode !== 'mountainrace') throw new Error('That duel is not Summit Sprint.');
      if (!playerIds(game).includes(viewer)) throw new Error('You are not in this Summit Sprint race.');
      if (game.status !== 'playing') return { game: publicGame(game, viewer), skipBalanceLookup: true };
      const state = ensureState(game);
      if (!state) throw new Error('Summit Sprint could not initialize the mountain course.');
      const endAtMs = Date.parse(state.endAt || '');
      if (Number.isFinite(endAtMs) && Date.now() >= endAtMs) {
        game = await resolveTimeout({ ...game, mountainraceState: state }, state);
        return { game: publicGame(game, viewer), record: await getUserRecord(viewer) };
      }
      const actionId = String(details.actionId || '').replace(/[^A-Za-z0-9._:-]/g, '').slice(0, 120);
      if (actionId && state.processedActionIds.includes(actionId)) {
        return { game: publicGame({ ...game, mountainraceState: state }, viewer), skipBalanceLookup: true, ignoredAction: true, ignoreReason: 'duplicate' };
      }
      const match = /^mountainrace:input:(up|left|right|down)$/.exec(String(rawChoice || '').toLowerCase());
      if (!match) throw new Error('Choose one valid climbing direction.');
      game = await applyControl({ ...game, mountainraceState: state }, viewer, match[1], actionId, false);
      const response = { game: publicGame(game, viewer) };
      if (game.status === 'complete') response.record = await getUserRecord(viewer);
      else response.skipBalanceLookup = true;
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

module.exports = { createMountainRaceIntegration };
