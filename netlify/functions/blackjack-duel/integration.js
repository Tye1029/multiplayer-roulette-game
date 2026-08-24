"use strict";

const crypto = require("node:crypto");
const {
  BLACKJACK_DUEL_MODE,
  BLACKJACK_DUEL_STATE_VERSION,
  BLACKJACK_DUEL_DECISION_MS,
  createBlackjackDuelState,
  applyBlackjackDuelAction,
  expireBlackjackDuel,
  publicBlackjackDuelState
} = require("./state-model");

const BLACKJACK_DUEL_BOT_MIN_DELAY_MS = 650;
const BLACKJACK_DUEL_BOT_MAX_DELAY_MS = 1_150;

function createBlackjackDuelIntegration(host = {}) {
  const {
    cleanUserId,
    int,
    getRawStrong,
    getRaw,
    publicGame,
    completeResolved,
    getUserRecord,
    database
  } = host;
  for (const [name, value] of Object.entries({ cleanUserId, int, getRaw, publicGame, completeResolved, getUserRecord })) {
    if (typeof value !== "function") throw new TypeError(`Blackjack Duel integration requires ${name}.`);
  }
  if (!database || typeof database.getMatch !== "function" || typeof database.updateMatch !== "function") {
    throw new TypeError("Blackjack Duel integration requires an authoritative database service.");
  }

  function ids(game) {
    return [cleanUserId(game?.creator?.userId), cleanUserId(game?.joiner?.userId)].filter(Boolean);
  }

  function bot(game) {
    return [game?.creator, game?.joiner].find(player => {
      const id = String(player?.userId || "");
      return Boolean(player?.isNpc || player?.isRemoteBot || id.startsWith("npc-") || id.startsWith("remote-bot-"));
    }) || null;
  }

  function botDelay(game) {
    const network = game?.remoteNetworkConfig && typeof game.remoteNetworkConfig === "object" ? game.remoteNetworkConfig : null;
    const networkMin = network ? Math.min(3_500, Math.max(100, int(network.minDelayMs, 100))) : 0;
    const networkMax = network ? Math.min(3_500, Math.max(networkMin, int(network.maxDelayMs, networkMin))) : 0;
    const reaction = crypto.randomInt(BLACKJACK_DUEL_BOT_MIN_DELAY_MS, BLACKJACK_DUEL_BOT_MAX_DELAY_MS + 1);
    const transport = networkMax > networkMin ? crypto.randomInt(networkMin, networkMax + 1) : networkMin;
    let delay = reaction + transport;
    if (network && Math.random() < Number(network.stallChance || 0)) delay += crypto.randomInt(700, 1_500);
    if (network && Math.random() < Number(network.reconnectChance || 0)) delay += crypto.randomInt(500, 1_200);
    return delay;
  }

  function initialState(game, startMs = Date.now()) {
    const playerIds = ids(game);
    if (playerIds.length !== 2) return null;
    const state = createBlackjackDuelState({
      gameId: game.gameId,
      playerIds,
      startAt: Number(startMs),
      decisionMs: BLACKJACK_DUEL_DECISION_MS
    });
    const synthetic = bot(game);
    if (!synthetic) return state;
    return {
      ...state,
      botNextActionAt: new Date(Number(startMs) + botDelay(game)).toISOString()
    };
  }

  function ensureState(game) {
    const existing = game?.blackjackDuelState && typeof game.blackjackDuelState === "object" ? game.blackjackDuelState : null;
    if (existing?.version === BLACKJACK_DUEL_STATE_VERSION && existing?.roundId && existing?.hands && existing?.drawQueues) return existing;
    return initialState(game, Date.parse(game?.startAt || "") || Date.now());
  }

  function hasValidState(game) {
    const state = ensureState(game);
    const playerIds = ids(game);
    return Boolean(
      state?.version === BLACKJACK_DUEL_STATE_VERSION
      && state.roundId
      && playerIds.length === 2
      && playerIds.every(id => state.hands?.[id] && Array.isArray(state.drawQueues?.[id]))
      && Number.isFinite(Date.parse(state.deadlineAt || ""))
    );
  }

  function publicState(game, viewerId) {
    const state = ensureState(game);
    if (!state) return null;
    if (!["playing", "complete"].includes(String(game?.status || ""))) {
      return {
        version: BLACKJACK_DUEL_STATE_VERSION,
        roundId: "",
        revision: 0,
        startAt: game?.startAt || null,
        deadlineAt: null,
        secondsLeft: 0,
        me: { cards: [], total: null, soft: false, status: "hidden" },
        opponent: { cards: [{ hidden: true }, { hidden: true }], total: null, soft: false, status: "hidden" },
        canHit: false,
        canStand: false,
        deckCommitment: "",
        completedAt: null,
        resolution: null,
        botActionSequence: 0,
        opponentName: String((cleanUserId(game?.creator?.userId) === cleanUserId(viewerId) ? game?.joiner?.name : game?.creator?.name) || "Opponent"),
        networkBotLog: { enabled: false, userId: "", profile: "", actionSequence: 0, nextActionAt: null }
      };
    }
    const published = publicBlackjackDuelState(state, cleanUserId(viewerId), Date.now());
    const synthetic = bot(game);
    return {
      ...published,
      canHit: game?.status === "playing" && published.canHit,
      canStand: game?.status === "playing" && published.canStand,
      opponentName: String((cleanUserId(game?.creator?.userId) === cleanUserId(viewerId) ? game?.joiner?.name : game?.creator?.name) || "Opponent"),
      networkBotLog: {
        enabled: Boolean(synthetic?.isRemoteBot || String(synthetic?.userId || "").startsWith("remote-bot-")),
        userId: cleanUserId(synthetic?.userId),
        profile: String(game?.remoteNetworkProfile || ""),
        actionSequence: int(state.botActionSequence, 0),
        nextActionAt: state.botNextActionAt || null
      }
    };
  }

  function summary(game, state) {
    const playerIds = ids(game);
    const winnerId = cleanUserId(state?.resolution?.winnerId);
    const hand = id => {
      const value = state?.hands?.[id] || {};
      return {
        cards: Array.isArray(value.cards) ? value.cards : [],
        total: int(value.total, 0),
        soft: Boolean(value.soft),
        status: String(value.status || "")
      };
    };
    return {
      mode: BLACKJACK_DUEL_MODE,
      winnerRole: winnerId ? (winnerId === playerIds[0] ? "creator" : "joiner") : "",
      tie: Boolean(state?.resolution?.tie),
      text: String(state?.resolution?.reason || "Closest hand to 21 without busting wins."),
      deckCommitment: String(state?.deckCommitment || ""),
      creator: hand(playerIds[0]),
      joiner: hand(playerIds[1])
    };
  }

  async function complete(game, state) {
    if (String(game?.status || "") === "complete") return game;
    return await completeResolved({ ...game, blackjackDuelState: state }, summary(game, state));
  }

  function botAction(state, botId) {
    const hand = state?.hands?.[botId] || {};
    return Number(hand.total || 0) <= 16 ? "hit" : "stand";
  }

  async function hydrate(game, options = {}) {
    const initial = ensureState(game);
    if (!initial) return game;
    if (!options.advance) {
      const state = await database.getMatch({ gameId: game.gameId, initialState: initial });
      return { ...game, blackjackDuelState: state };
    }
    const synthetic = bot(game);
    const syntheticId = cleanUserId(synthetic?.userId);
    const updated = await database.updateMatch({
      gameId: game.gameId,
      initialState: initial,
      update: current => {
        let state = expireBlackjackDuel(current, Date.now());
        if (!state.completedAt && syntheticId && state.hands?.[syntheticId]?.status === "active") {
          const dueAt = Date.parse(state.botNextActionAt || "");
          if (!Number.isFinite(dueAt) || Date.now() >= dueAt) {
            const sequence = int(state.botActionSequence, 0) + 1;
            const applied = applyBlackjackDuelAction(state, syntheticId, botAction(state, syntheticId), `blackjack-bot-${sequence}`, Date.now());
            state = {
              ...applied.state,
              botActionSequence: sequence,
              botNextActionAt: applied.state.completedAt || applied.state.hands?.[syntheticId]?.status !== "active"
                ? null
                : new Date(Date.now() + botDelay(game)).toISOString()
            };
          }
        }
        state = expireBlackjackDuel(state, Date.now());
        return { state };
      }
    });
    const next = { ...game, blackjackDuelState: updated.state };
    return updated.state.completedAt ? await complete(next, updated.state) : next;
  }

  async function advance(game) {
    if (!game || game.mode !== BLACKJACK_DUEL_MODE || game.status !== "playing") return game;
    return await hydrate(game, { advance: true });
  }

  async function action(user, gameId, rawChoice, details = {}) {
    const read = typeof getRawStrong === "function" ? await getRawStrong(gameId) || await getRaw(gameId) : await getRaw(gameId);
    if (!read) throw new Error("That Blackjack Duel was not found.");
    if (read.mode !== BLACKJACK_DUEL_MODE) throw new Error("That is not a Blackjack Duel.");
    if (read.status !== "playing") throw new Error("Blackjack Duel is not accepting actions yet.");
    const viewer = cleanUserId(user?.id);
    if (!ids(read).includes(viewer)) throw new Error("You are not in this Blackjack Duel.");
    const actionName = String(rawChoice || "").toLowerCase().replace(/^blackjackduel:/, "");
    const actionId = String(details.actionId || `blackjack-${viewer}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`);
    const initial = ensureState(read);
    const updated = await database.updateMatch({
      gameId: read.gameId,
      initialState: initial,
      update: current => {
        const applied = applyBlackjackDuelAction(current, viewer, actionName, actionId, Date.now());
        return { state: applied.state, meta: { duplicate: applied.duplicate, expired: applied.expired } };
      }
    });
    let game = { ...read, blackjackDuelState: updated.state };
    if (updated.state.completedAt) game = await complete(game, updated.state);
    return {
      game: publicGame(game, viewer),
      skipBalanceLookup: true,
      duplicateAction: Boolean(updated.meta?.duplicate),
      timedOut: Boolean(updated.meta?.expired),
      record: await getUserRecord(viewer)
    };
  }

  return { initialState, ensureState, hasValidState, publicState, hydrate, advance, action, summary };
}

module.exports = {
  BLACKJACK_DUEL_BOT_MIN_DELAY_MS,
  BLACKJACK_DUEL_BOT_MAX_DELAY_MS,
  createBlackjackDuelIntegration
};
