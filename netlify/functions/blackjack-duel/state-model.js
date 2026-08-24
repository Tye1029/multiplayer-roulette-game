"use strict";

const crypto = require("node:crypto");

const BLACKJACK_DUEL_MODE = "blackjackduel";
const BLACKJACK_DUEL_STATE_VERSION = 1;
const BLACKJACK_DUEL_DECISION_MS = 20_000;
const BLACKJACK_DUEL_RANKS = Object.freeze(["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]);
const BLACKJACK_DUEL_SUITS = Object.freeze(["clubs", "diamonds", "hearts", "spades"]);
const BLACKJACK_DUEL_TERMINAL_STATUSES = Object.freeze(["stand", "bust", "blackjack", "twentyone", "timeout"]);

function cleanId(value, max = 120) {
  return String(value || "").trim().replace(/[^A-Za-z0-9._:-]/g, "").slice(0, max);
}

function integer(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : fallback;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createDeck() {
  return BLACKJACK_DUEL_SUITS.flatMap(suit => BLACKJACK_DUEL_RANKS.map(rank => ({
    id: `${rank}-${suit}`,
    rank,
    suit
  })));
}

function shuffleDeck(deck = createDeck()) {
  const shuffled = clone(deck);
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swap = crypto.randomInt(0, index + 1);
    [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
  }
  return shuffled;
}

function cardValue(card) {
  const rank = String(card?.rank || "");
  if (rank === "A") return 11;
  if (["10", "J", "Q", "K"].includes(rank)) return 10;
  return integer(rank, 0);
}

function handValue(cards = []) {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    total += cardValue(card);
    if (card?.rank === "A") aces += 1;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return { total, soft: aces > 0 };
}

function isNatural(cards = []) {
  return cards.length === 2 && handValue(cards).total === 21;
}

function normalizeCard(card = {}) {
  const rank = BLACKJACK_DUEL_RANKS.includes(String(card.rank)) ? String(card.rank) : "A";
  const suit = BLACKJACK_DUEL_SUITS.includes(String(card.suit)) ? String(card.suit) : "spades";
  return { id: `${rank}-${suit}`, rank, suit };
}

function normalizeHand(hand = {}) {
  const cards = Array.isArray(hand.cards) ? hand.cards.map(normalizeCard).slice(0, 26) : [];
  const value = handValue(cards);
  let status = String(hand.status || "active");
  if (!BLACKJACK_DUEL_TERMINAL_STATUSES.includes(status) && status !== "active") status = "active";
  if (isNatural(cards)) status = "blackjack";
  else if (value.total > 21) status = "bust";
  else if (value.total === 21 && status === "active") status = "twentyone";
  return {
    cards,
    total: value.total,
    soft: value.soft,
    status,
    finishedAt: hand.finishedAt || null,
    lastActionAt: hand.lastActionAt || null
  };
}

function stableRoundId(gameId, startAt) {
  const digest = crypto.createHash("sha256").update(`${cleanId(gameId, 160)}:${String(startAt || "")}`).digest("hex").slice(0, 24);
  return `blackjack-duel-${digest}`;
}

function createBlackjackDuelState({ gameId, playerIds = [], startAt = Date.now(), decisionMs = BLACKJACK_DUEL_DECISION_MS } = {}) {
  const ids = [...new Set(playerIds.map(value => cleanId(value)).filter(Boolean))];
  if (ids.length !== 2) throw new Error("Blackjack Duel requires exactly two players.");
  const startMs = Number.isFinite(Number(startAt)) ? Number(startAt) : Date.parse(String(startAt || ""));
  const safeStartMs = Number.isFinite(startMs) ? startMs : Date.now();
  const duration = Math.max(5_000, Math.min(60_000, integer(decisionMs, BLACKJACK_DUEL_DECISION_MS)));
  const shuffled = shuffleDeck();
  const seatOrder = crypto.randomInt(0, 2) === 0 ? [...ids] : [ids[1], ids[0]];
  const hands = Object.fromEntries(ids.map(id => [id, { cards: [], status: "active", finishedAt: null, lastActionAt: null }]));
  let cursor = 0;
  for (let pass = 0; pass < 2; pass += 1) {
    for (const id of seatOrder) hands[id].cards.push(shuffled[cursor++]);
  }
  const drawQueues = Object.fromEntries(ids.map(id => [id, []]));
  for (let index = cursor; index < shuffled.length; index += 1) {
    drawQueues[seatOrder[(index - cursor) % seatOrder.length]].push(shuffled[index]);
  }
  for (const id of ids) hands[id] = normalizeHand(hands[id]);
  const startIso = new Date(safeStartMs).toISOString();
  const deckCommitment = crypto.createHash("sha256").update(JSON.stringify(shuffled.map(card => card.id))).digest("hex");
  const state = {
    version: BLACKJACK_DUEL_STATE_VERSION,
    roundId: stableRoundId(gameId, startIso),
    revision: 0,
    startAt: startIso,
    deadlineAt: new Date(safeStartMs + duration).toISOString(),
    seatOrder,
    hands,
    drawQueues,
    drawIndexes: Object.fromEntries(ids.map(id => [id, 0])),
    processedActionIds: [],
    deckCommitment,
    completedAt: null,
    resolution: null,
    botNextActionAt: null,
    botActionSequence: 0
  };
  // Naturals and locked hands remain private until the shared deadline. Ending
  // early would reveal useful information to a player who is still deciding.
  return state;
}

function playerIds(state = {}) {
  return Object.keys(state.hands || {}).map(value => cleanId(value)).filter(Boolean);
}

function allHandsFinished(state = {}) {
  const ids = playerIds(state);
  return ids.length === 2 && ids.every(id => normalizeHand(state.hands[id]).status !== "active");
}

function handStrength(hand = {}) {
  const clean = normalizeHand(hand);
  if (clean.status === "bust" || clean.total > 21) return { category: 0, total: 0 };
  if (clean.status === "blackjack" || isNatural(clean.cards)) return { category: 2, total: 21 };
  return { category: 1, total: clean.total };
}

function resolveBlackjackDuel(state = {}, at = Date.now()) {
  const ids = playerIds(state);
  if (ids.length !== 2) throw new Error("Blackjack Duel cannot resolve without two hands.");
  const first = handStrength(state.hands[ids[0]]);
  const second = handStrength(state.hands[ids[1]]);
  const tied = first.category === second.category && first.total === second.total;
  const winnerId = tied ? "" : (first.category !== second.category
    ? (first.category > second.category ? ids[0] : ids[1])
    : (first.total > second.total ? ids[0] : ids[1]));
  return {
    ...state,
    completedAt: state.completedAt || new Date(Number(at)).toISOString(),
    resolution: {
      winnerId,
      tie: tied,
      reason: tied
        ? (first.category === 0 ? "Both players busted." : "Both players finished with equal hands.")
        : "Closest hand to 21 without busting wins.",
      strengths: { [ids[0]]: first, [ids[1]]: second }
    }
  };
}

function expireBlackjackDuel(state = {}, now = Date.now()) {
  if (state.completedAt) return state;
  const deadline = Date.parse(state.deadlineAt || "");
  if (!Number.isFinite(deadline) || Number(now) < deadline) return state;
  const hands = { ...(state.hands || {}) };
  let changed = false;
  for (const id of playerIds(state)) {
    const hand = normalizeHand(hands[id]);
    if (hand.status === "active") {
      hands[id] = { ...hand, status: "timeout", finishedAt: new Date(deadline).toISOString(), lastActionAt: new Date(deadline).toISOString() };
      changed = true;
    }
  }
  const next = { ...state, hands, revision: integer(state.revision, 0) + (changed ? 1 : 0) };
  return resolveBlackjackDuel(next, deadline);
}

function applyBlackjackDuelAction(state = {}, playerId, rawAction, actionId = "", now = Date.now()) {
  const id = cleanId(playerId);
  const action = String(rawAction || "").trim().toLowerCase();
  const cleanActionId = cleanId(actionId, 100);
  if (!state.hands?.[id]) throw new Error("Blackjack Duel could not find that player hand.");
  if (state.completedAt) return { state, duplicate: false, completed: true };
  if (cleanActionId && state.processedActionIds?.includes(cleanActionId)) return { state, duplicate: true, completed: Boolean(state.completedAt) };
  const deadline = Date.parse(state.deadlineAt || "");
  if (Number.isFinite(deadline) && Number(now) >= deadline) {
    const expired = expireBlackjackDuel(state, now);
    return { state: expired, duplicate: false, completed: true, expired: true };
  }
  let hand = normalizeHand(state.hands[id]);
  if (hand.status !== "active") throw new Error("Your Blackjack Duel hand is already locked.");
  if (action === "hit") {
    const queue = Array.isArray(state.drawQueues?.[id]) ? state.drawQueues[id] : [];
    const drawIndex = integer(state.drawIndexes?.[id], 0);
    const card = queue[drawIndex];
    if (!card) throw new Error("The authoritative Blackjack Duel deck is exhausted.");
    hand = normalizeHand({ ...hand, cards: [...hand.cards, card], lastActionAt: new Date(Number(now)).toISOString() });
    if (hand.status !== "active") hand.finishedAt = new Date(Number(now)).toISOString();
    state = { ...state, drawIndexes: { ...(state.drawIndexes || {}), [id]: drawIndex + 1 } };
  } else if (action === "stand") {
    hand = { ...hand, status: "stand", finishedAt: new Date(Number(now)).toISOString(), lastActionAt: new Date(Number(now)).toISOString() };
  } else {
    throw new Error("Choose Hit or Stand.");
  }
  let next = {
    ...state,
    revision: integer(state.revision, 0) + 1,
    hands: { ...(state.hands || {}), [id]: hand },
    processedActionIds: cleanActionId
      ? [...(Array.isArray(state.processedActionIds) ? state.processedActionIds : []), cleanActionId].slice(-160)
      : (Array.isArray(state.processedActionIds) ? state.processedActionIds : [])
  };
  // Settle as soon as neither player can make another choice. A lone hidden
  // bust stays private while the opponent is active, but bust + stand and two
  // busted/locked hands no longer wait out the shared deadline.
  if (allHandsFinished(next)) next = resolveBlackjackDuel(next, now);
  return { state: next, duplicate: false, completed: Boolean(next.completedAt) };
}

function publicHand(hand = {}, reveal = true) {
  const clean = normalizeHand(hand);
  if (!reveal) return {
    // Card count is public, but values and whether the hand locked/busted are
    // not. This lets both players see cards leave the shared deck without
    // leaking the opponent's result before the reveal.
    cards: clean.cards.map(() => ({ hidden: true })),
    total: null,
    soft: false,
    status: "hidden",
    finishedAt: null
  };
  return clean;
}

function publicBlackjackDuelState(state = {}, viewerId = "", now = Date.now()) {
  const viewer = cleanId(viewerId);
  const ids = playerIds(state);
  const opponentId = ids.find(id => id !== viewer) || "";
  const complete = Boolean(state.completedAt);
  const me = publicHand(state.hands?.[viewer] || {}, true);
  const opponent = publicHand(state.hands?.[opponentId] || {}, complete);
  const deadline = Date.parse(state.deadlineAt || "");
  return {
    version: BLACKJACK_DUEL_STATE_VERSION,
    roundId: String(state.roundId || ""),
    revision: integer(state.revision, 0),
    startAt: state.startAt || null,
    deadlineAt: state.deadlineAt || null,
    secondsLeft: complete || !Number.isFinite(deadline) ? 0 : Math.max(0, Math.ceil((deadline - Number(now)) / 1000)),
    me,
    opponent,
    canHit: !complete && me.status === "active" && Number(now) < deadline,
    canStand: !complete && me.status === "active" && Number(now) < deadline,
    deckCommitment: String(state.deckCommitment || ""),
    completedAt: state.completedAt || null,
    resolution: complete ? clone(state.resolution || {}) : null,
    botActionSequence: integer(state.botActionSequence, 0)
  };
}

module.exports = {
  BLACKJACK_DUEL_MODE,
  BLACKJACK_DUEL_STATE_VERSION,
  BLACKJACK_DUEL_DECISION_MS,
  BLACKJACK_DUEL_RANKS,
  BLACKJACK_DUEL_SUITS,
  createDeck,
  shuffleDeck,
  handValue,
  isNatural,
  normalizeHand,
  createBlackjackDuelState,
  applyBlackjackDuelAction,
  expireBlackjackDuel,
  resolveBlackjackDuel,
  publicBlackjackDuelState,
  allHandsFinished
};
