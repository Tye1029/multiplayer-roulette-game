import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const stateModel = require(path.join(root, "netlify/functions/blackjack-duel/state-model.js"));
const { createBlackjackDuelIntegration } = require(path.join(root, "netlify/functions/blackjack-duel/integration.js"));

const {
  BLACKJACK_DUEL_MODE,
  BLACKJACK_DUEL_STATE_VERSION,
  BLACKJACK_DUEL_DECISION_MS,
  createDeck,
  handValue,
  createBlackjackDuelState,
  applyBlackjackDuelAction,
  expireBlackjackDuel,
  resolveBlackjackDuel,
  publicBlackjackDuelState
} = stateModel;

assert.equal(BLACKJACK_DUEL_MODE, "blackjackduel");
assert.equal(BLACKJACK_DUEL_STATE_VERSION, 1);
assert.equal(BLACKJACK_DUEL_DECISION_MS, 25_000);
const deck = createDeck();
assert.equal(deck.length, 52, "authoritative deck must contain 52 cards");
assert.equal(new Set(deck.map(card => card.id)).size, 52, "authoritative deck must not contain duplicate cards");
assert.deepEqual(handValue([{ rank: "A" }, { rank: "A" }, { rank: "9" }]), { total: 21, soft: true });
assert.deepEqual(handValue([{ rank: "A" }, { rank: "K" }, { rank: "5" }]), { total: 16, soft: false });

const now = Date.now();
let base;
for (let attempt = 0; attempt < 100; attempt += 1) {
  const candidate = createBlackjackDuelState({ gameId: `blackjack-validator-${attempt}`, playerIds: ["player-a", "player-b"], startAt: now });
  if (candidate.hands["player-a"].status === "active" && candidate.hands["player-b"].status === "active") {
    base = candidate;
    break;
  }
}
assert.ok(base, "validator could not create two active opening hands");
assert.equal(base.seatOrder.length, 2);
assert.equal(base.hands["player-a"].cards.length, 2);
assert.equal(base.hands["player-b"].cards.length, 2);
assert.equal(base.drawQueues["player-a"].length + base.drawQueues["player-b"].length, 48);
const committed = [...base.hands["player-a"].cards, ...base.hands["player-b"].cards, ...base.drawQueues["player-a"], ...base.drawQueues["player-b"]];
assert.equal(new Set(committed.map(card => card.id)).size, 52, "deal and fixed hit lanes must consume one finite deck");

const publicA = publicBlackjackDuelState(base, "player-a", now);
assert.equal(publicA.me.cards.length, 2);
assert.deepEqual(publicA.opponent.cards, [{ hidden: true }, { hidden: true }], "opponent hand must stay completely private");
assert.equal(publicA.opponent.total, null);
assert.ok(!("drawQueues" in publicA), "private draw lanes leaked into the public snapshot");
assert.ok(!("seatOrder" in publicA), "private deal order leaked into the public snapshot");

// Network arrival order cannot change either player's next assigned card.
const hitAThenB = applyBlackjackDuelAction(base, "player-a", "hit", "order-a", now + 100).state;
const hitAThenBFinal = applyBlackjackDuelAction(hitAThenB, "player-b", "hit", "order-b", now + 200).state;
const hitBThenA = applyBlackjackDuelAction(base, "player-b", "hit", "order-b2", now + 100).state;
const hitBThenAFinal = applyBlackjackDuelAction(hitBThenA, "player-a", "hit", "order-a2", now + 200).state;
assert.equal(hitAThenBFinal.hands["player-a"].cards[2]?.id, hitBThenAFinal.hands["player-a"].cards[2]?.id);
assert.equal(hitAThenBFinal.hands["player-b"].cards[2]?.id, hitBThenAFinal.hands["player-b"].cards[2]?.id);

const naturalVsTwentyOne = resolveBlackjackDuel({
  ...base,
  hands: {
    "player-a": { cards: [{ rank: "A", suit: "spades" }, { rank: "K", suit: "hearts" }], status: "blackjack" },
    "player-b": { cards: [{ rank: "7", suit: "spades" }, { rank: "7", suit: "hearts" }, { rank: "7", suit: "clubs" }], status: "twentyone" }
  }
}, now + 500);
assert.equal(naturalVsTwentyOne.resolution.winnerId, "player-a", "natural blackjack must beat an ordinary 21");

const bothBust = resolveBlackjackDuel({
  ...base,
  hands: {
    "player-a": { cards: [{ rank: "K", suit: "spades" }, { rank: "Q", suit: "hearts" }, { rank: "2", suit: "clubs" }], status: "bust" },
    "player-b": { cards: [{ rank: "K", suit: "clubs" }, { rank: "J", suit: "hearts" }, { rank: "3", suit: "diamonds" }], status: "bust" }
  }
}, now + 500);
assert.equal(bothBust.resolution.tie, true, "two busted hands must push");

const expired = expireBlackjackDuel({
  ...base,
  deadlineAt: new Date(now - 1).toISOString(),
  hands: {
    "player-a": { ...base.hands["player-a"], status: "active" },
    "player-b": { ...base.hands["player-b"], status: "active" }
  }
}, now);
assert.equal(expired.hands["player-a"].status, "timeout");
assert.equal(expired.hands["player-b"].status, "timeout");
assert.ok(expired.completedAt, "decision deadline must complete disconnected hands");

const clone = value => structuredClone(value);
const games = new Map();
const matches = new Map();
const database = {
  async getMatch({ gameId, initialState }) {
    if (!matches.has(gameId)) matches.set(gameId, clone(initialState));
    return clone(matches.get(gameId));
  },
  async updateMatch({ gameId, initialState, update }) {
    if (!matches.has(gameId)) matches.set(gameId, clone(initialState));
    const result = await update(clone(matches.get(gameId)));
    const state = clone(result?.state || result);
    matches.set(gameId, state);
    return { state, changed: true, meta: result?.meta || null };
  }
};
const cleanUserId = value => String(value || "").replace(/[^A-Za-z0-9._:-]/g, "").slice(0, 120);
const int = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.max(0, Math.trunc(Number(value))) : fallback;
const getRaw = async gameId => clone(games.get(gameId));
const publicGame = (game, viewer) => ({ ...clone(game), blackjackDuelState: integration.publicState(game, viewer) });
const completeResolved = async (game, result) => {
  const completed = { ...game, status: "complete", result, tie: result.tie, winnerUserId: result.winnerRole === "creator" ? game.creator.userId : result.winnerRole === "joiner" ? game.joiner.userId : "" };
  games.set(game.gameId, clone(completed));
  return completed;
};
const integration = createBlackjackDuelIntegration({
  cleanUserId,
  int,
  getRaw,
  getRawStrong: getRaw,
  publicGame,
  completeResolved,
  getUserRecord: async userId => ({ userId, balance: 100_000 }),
  database
});
let integrationGame;
for (let attempt = 0; attempt < 100; attempt += 1) {
  const candidate = {
    gameId: `blackjack-integration-${attempt}`,
    mode: "blackjackduel",
    status: "playing",
    startAt: new Date(now).toISOString(),
    creator: { userId: "player-a", name: "Player A" },
    joiner: { userId: "player-b", name: "Player B" }
  };
  candidate.blackjackDuelState = integration.initialState(candidate, now);
  if (candidate.blackjackDuelState.hands["player-a"].status === "active") {
    integrationGame = candidate;
    break;
  }
}
assert.ok(integrationGame, "validator could not create an active integration hand");
games.set(integrationGame.gameId, clone(integrationGame));
assert.equal(integration.hasValidState(integrationGame), true);
const actionResponse = await integration.action({ id: "player-a" }, integrationGame.gameId, "blackjackduel:stand", { actionId: "integration-stand" });
assert.equal(actionResponse.game.blackjackDuelState.me.status, "stand");
assert.deepEqual(actionResponse.game.blackjackDuelState.opponent.cards, [{ hidden: true }, { hidden: true }]);
const duplicateResponse = await integration.action({ id: "player-a" }, integrationGame.gameId, "blackjackduel:stand", { actionId: "integration-stand" });
assert.equal(duplicateResponse.duplicateAction, true, "action IDs must be idempotent");

const requiredFiles = [
  "assets/blackjack-duel/blackjack-duel.js",
  "assets/blackjack-duel/blackjack-duel.css",
  "assets/blackjack-duel/images/table-felt.png",
  "assets/blackjack-duel/images/card-back.png",
  "assets/blackjack-duel/images/chip-stack.png",
  "games/multiplayer/blackjack-duel/index.html",
  "games/multiplayer/blackjack-duel/preview.html",
  "netlify/functions/_blackjack-duel-database.js",
  "netlify/functions/blackjack-duel/state-model.js",
  "netlify/functions/blackjack-duel/integration.js",
  "netlify/database/migrations/003_blackjack_duel_authoritative.sql"
];
for (const file of requiredFiles) assert.ok(fs.statSync(path.join(root, file)).size > 0, `${file} is missing or empty`);

const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const data = fs.readFileSync(path.join(root, "netlify/functions/_data.js"), "utf8");
for (const token of ["data-mode=\"blackjackduel\"", "data-rnb-game=\"blackjackduel\"", "data-blackjack-duel-mount", "window.__blackjackDuelBridge", "blackjackduel:state"]) {
  assert.ok(index.includes(token), `shared shell is missing ${token}`);
}
for (const token of ["BLACKJACK_DUEL_SERVER_START", "blackjackDuelInitialState", "blackjackDuelPublicState", "blackjackDuelAction", "blackjackDuelAdvanceAndSave"]) {
  assert.ok(data.includes(token), `server integration is missing ${token}`);
}

console.log("Blackjack Duel validation passed: finite deck, private simultaneous play, timeout resolution, idempotent actions, modular UI, and shared lifecycle integration.");
