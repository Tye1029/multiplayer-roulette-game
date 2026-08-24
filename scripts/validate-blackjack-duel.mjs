import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const CommonJsModule = require("node:module");
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
assert.equal(BLACKJACK_DUEL_DECISION_MS, 20_000);
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
const publicAfterOpponentHit = publicBlackjackDuelState(hitAThenB, "player-b", now + 300);
assert.equal(publicAfterOpponentHit.opponent.cards.length, 3, "opponent card count must be public");
assert.ok(publicAfterOpponentHit.opponent.cards.every(card => card.hidden), "opponent card faces must remain private");
assert.equal(publicAfterOpponentHit.opponent.status, "hidden", "opponent bust/lock state must remain private");

const bothLocked = applyBlackjackDuelAction(
  applyBlackjackDuelAction(base, "player-a", "stand", "lock-a", now + 100).state,
  "player-b",
  "stand",
  "lock-b",
  now + 200
).state;
assert.ok(bothLocked.completedAt, "two explicit Stand choices should settle immediately");

const bustThenStand = applyBlackjackDuelAction({
  ...base,
  hands: {
    "player-a": { cards: [{ rank: "K", suit: "spades" }, { rank: "Q", suit: "hearts" }, { rank: "2", suit: "clubs" }], status: "bust" },
    "player-b": { ...base.hands["player-b"], status: "active" }
  }
}, "player-b", "stand", "stand-after-bust", now + 250).state;
assert.ok(bustThenStand.completedAt, "bust plus stand must settle immediately once neither player can act");

const bothBustByAction = applyBlackjackDuelAction({
  ...base,
  hands: {
    "player-a": { cards: [{ rank: "K", suit: "spades" }, { rank: "Q", suit: "hearts" }, { rank: "2", suit: "clubs" }], status: "bust" },
    "player-b": { cards: [{ rank: "K", suit: "clubs" }, { rank: "Q", suit: "diamonds" }], status: "active" }
  },
  drawQueues: { ...base.drawQueues, "player-b": [{ rank: "2", suit: "hearts" }] },
  drawIndexes: { ...base.drawIndexes, "player-b": 0 }
}, "player-b", "hit", "second-player-bust", now + 260).state;
assert.equal(bothBustByAction.hands["player-b"].status, "bust");
assert.ok(bothBustByAction.completedAt, "two busted hands must settle immediately");
assert.equal(bothBustByAction.resolution.tie, true);

const loneBust = applyBlackjackDuelAction({
  ...base,
  hands: {
    "player-a": { cards: [{ rank: "K", suit: "spades" }, { rank: "Q", suit: "hearts" }], status: "active" },
    "player-b": { ...base.hands["player-b"], status: "active" }
  },
  drawQueues: { ...base.drawQueues, "player-a": [{ rank: "2", suit: "clubs" }] },
  drawIndexes: { ...base.drawIndexes, "player-a": 0 }
}, "player-a", "hit", "lone-bust", now + 275).state;
assert.equal(loneBust.hands["player-a"].status, "bust");
assert.equal(loneBust.completedAt, null, "a lone hidden bust must remain private while the opponent can still act");

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
  if (candidate.blackjackDuelState.hands["player-a"].status === "active" && candidate.blackjackDuelState.hands["player-b"].status === "active") {
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

// A deploy preview may receive the database connection before Netlify has run
// a newly-added migration. The first game transaction must bootstrap the table
// once per Function instance instead of trapping the match in countdown.
const databaseModulePath = path.join(root, "netlify/functions/_blackjack-duel-database.js");
const originalModuleLoad = CommonJsModule._load;
const originalDatabaseUrl = process.env.NETLIFY_DB_URL;
const schemaQueries = [];
try {
  CommonJsModule._load = function(request, parent, isMain) {
    if (request === "@netlify/database") return {
      getDatabase: () => ({ pool: { query: async sql => { schemaQueries.push(String(sql)); } } })
    };
    return originalModuleLoad.call(this, request, parent, isMain);
  };
  process.env.NETLIFY_DB_URL = "postgresql://blackjack-validator.invalid/test";
  delete require.cache[require.resolve(databaseModulePath)];
  const runtimeDatabase = require(databaseModulePath);
  await runtimeDatabase.ensureSchema();
  await runtimeDatabase.ensureSchema();
  assert.equal(schemaQueries.length, 2, "database schema bootstrap must run only once per Function instance");
  assert.ok(schemaQueries[0].includes("CREATE TABLE IF NOT EXISTS blackjack_duel_matches"));
  assert.ok(schemaQueries[1].includes("CREATE INDEX IF NOT EXISTS blackjack_duel_matches_updated_idx"));
} finally {
  CommonJsModule._load = originalModuleLoad;
  if (originalDatabaseUrl === undefined) delete process.env.NETLIFY_DB_URL;
  else process.env.NETLIFY_DB_URL = originalDatabaseUrl;
  delete require.cache[require.resolve(databaseModulePath)];
  delete globalThis.__BLACKJACK_DUEL_DB_CONNECTION;
  delete globalThis.__BLACKJACK_DUEL_SCHEMA_PROMISE;
}

const requiredFiles = [
  "assets/blackjack-duel/blackjack-duel.js",
  "assets/blackjack-duel/blackjack-duel.css",
  "assets/blackjack-duel/images/table-felt.png",
  "assets/blackjack-duel/images/card-back.png",
  "assets/blackjack-duel/images/chip-stack.png",
  "assets/blackjack-duel/images/casino-chip-pile.png",
  "assets/blackjack-duel/images/casino-chip-pile-crisp.svg",
  "games/multiplayer/blackjack-duel/index.html",
  "games/multiplayer/blackjack-duel/preview.html",
  "netlify/functions/_blackjack-duel-database.js",
  "netlify/functions/blackjack-duel/state-model.js",
  "netlify/functions/blackjack-duel/integration.js",
  "netlify/database/migrations/003_blackjack_duel_authoritative.sql"
];
for (const file of requiredFiles) assert.ok(fs.statSync(path.join(root, file)).size > 0, `${file} is missing or empty`);

const component = fs.readFileSync(path.join(root, "assets/blackjack-duel/blackjack-duel.js"), "utf8");
const componentCss = fs.readFileSync(path.join(root, "assets/blackjack-duel/blackjack-duel.css"), "utf8");
const componentPreview = fs.readFileSync(path.join(root, "games/multiplayer/blackjack-duel/preview.html"), "utf8");
for (const token of ["CARDS DEAL AT GO", "Draw one card", "Keep this total", "pendingAction", "data-clock-offset", "SHARED DECK", "lastRenderSignature", "just-dealt", "cardCountLabel"]) {
  assert.ok(component.includes(token), `Blackjack Duel interaction guidance is missing ${token}`);
}
for (const token of ["bjd-final-totals", "bjd-center-pot", "data-bjd-double", "animatePendingDeals", "canPatchComplete", "casino-chip-pile-crisp.svg", "awaiting-deal", "data-bjd-deal-sequence", "data-bjd-push-clock", "pushRestart", "dealAnimationLedger", "rememberAnimatedCards", "patchDoublePanel", "doubleOfferUi", "sharedPotView", "EACH", "HAND_DENSITY_CLASSES", "syncHandDensity", "data-card-count"]) {
  assert.ok(component.includes(token), `Blackjack Duel final layout is missing ${token}`);
}
assert.ok(component.includes("AUTOMATIC REMATCH") && component.includes("A new hand starts automatically — no action needed."), "Push results must clearly explain their automatic rematch countdown");
assert.ok(component.includes("OPTIONAL — DOUBLE OR NOTHING") && component.includes("Optional: both players can double the next stake"), "Push results must distinguish optional Double or Nothing from automatic rematching");
assert.ok(component.includes('state.me?.status === "bust" && state.opponent?.status === "bust"'), "Both-bust results must use their dedicated explanatory message");
assert.ok(component.includes("Both players accepted. The doubled hand starts when the timer reaches zero.") && component.includes("BOTH ACCEPTED") && component.includes("doubleStartRequestedFor"), "Double or Nothing must preserve both accepted portraits through the full timer before starting");
assert.ok(component.includes("OPPONENT LEFT THIS RESULT") && component.includes("REGULAR REMATCH REQUESTED") && component.includes("resultDepartures"), "completed Blackjack Duel results must explain opponent departures and regular rematch requests");
assert.ok(!component.includes("NO DEALER"), "the removed no-dealer label must stay out of the table header");
assert.ok(!component.includes("Deck commitment"), "the deck commitment footer must stay hidden from players");
assert.ok(!component.includes("Both hands came from the same server deck"), "the removed final-deck copy must stay out of the result");
assert.ok(!component.includes("A natural two-card blackjack beats"), "the removed natural-blackjack instruction must stay out of the table header");
assert.ok(!component.includes("Cards fly from this deck to each hand") && !component.includes("Cards arrive when the round begins"), "background deck guidance must stay out of the table");
assert.ok(!componentCss.includes("CARDS DEAL FROM THE CENTER DECK"), "empty opening hands must not contain background explanation text");
assert.ok(componentCss.includes("--deal-delay"), "card movement must be measured from the shared deck to the destination hand");
assert.ok(componentCss.includes("grid-template-rows:auto auto 36px 46px"), "Double or Nothing must reserve a stable panel height before the timer appears");
assert.ok(componentCss.includes(".bjd-double-countdown.is-active"), "Double or Nothing must reveal its timer without reflowing the result panel");
assert.ok(componentCss.includes("font-size:1.52rem") && componentCss.includes("grid-template-columns:112px minmax(112px,auto)"), "the shared pot amount and chip art must have stronger visual emphasis");
assert.ok(componentCss.includes("grid-template-columns:minmax(0,1fr) 270px minmax(0,1fr)") && componentCss.includes(".bjd-seat-label span{max-width:100%;min-width:0") && componentCss.includes(".bjd-center-pot{box-sizing:border-box"), "player names must stay inside their seats instead of entering the shared pot");
assert.ok(componentCss.includes(".bjd-card{box-sizing:border-box") && componentCss.includes(".bjd-hand-cards.cards-5") && componentCss.includes(".bjd-hand-cards.cards-8") && componentCss.includes(".bjd-hand-cards.cards-many"), "large hands must use count-aware border-box card fans that stay inside each seat");
assert.ok(!component.includes("currentDouble.replaceWith"), "Double or Nothing updates must preserve the mounted panel element");
assert.ok(!component.includes("currentDouble.innerHTML"), "Double or Nothing polling must patch the mounted panel without replacing its contents");
assert.ok(componentCss.includes("background:linear-gradient(180deg,#08231d 0,#061914 48%,#03100d 100%)"), "the completed result must retain the subdued dark-green table presentation");
assert.ok(componentCss.includes(".bjd-result.win,.bjd-result.lose,.bjd-result.tie") && componentCss.includes("animation:none!important") && componentCss.includes("filter:none!important"), "shared neon win styling and pulse animation must not recolor Blackjack Duel results");
assert.ok(!componentCss.includes("animation:bjdReveal"), "the completed result must not replay a flashing reveal animation");
assert.ok(component.indexOf('class="bjd-seat player"') < component.indexOf('class="bjd-seat opponent"'), "the local player must occupy the left seat before the opponent");
assert.ok(componentPreview.includes('get("autoDeal") === "1"'), "the component preview must exercise the countdown-to-opening-deal transition");
assert.ok(componentPreview.includes('get("repeatMount") === "1"') && componentPreview.includes("data-preview-deal-animation-starts"), "the component preview must verify that an opening deal cannot replay after a table remount");
assert.ok(componentPreview.includes('get("delayDouble") === "1"'), "the component preview must exercise a slow Double or Nothing response while the local timer is visible");
assert.ok(componentPreview.includes('previewOutcome === "both-bust"'), "the component preview must expose a both-bust automatic-rematch result");
assert.ok(componentPreview.includes('get("opponentLeft") === "1"') && componentPreview.includes('get("regularRematch")') && componentPreview.includes("data-preview-double-started"), "the component preview must exercise completed-result departures and timer-complete Double or Nothing starts");
assert.ok(componentPreview.includes('get("singlePot") === "1"') && componentPreview.includes("previewWager"), "the component preview must reproduce a Remote Bot's single escrowed wager");
assert.ok(componentPreview.includes("previewSharedPulse") && componentPreview.includes('get("opponentName")'), "the component preview must reproduce shared win CSS and long opponent names");
assert.ok(componentPreview.includes('get("myCards")') && componentPreview.includes('get("opponentCards")') && componentPreview.includes('get("growHands")'), "the component preview must exercise oversized player and opponent hands through the live patch path");

const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const data = fs.readFileSync(path.join(root, "netlify/functions/_data.js"), "utf8");
const blackjackDatabase = fs.readFileSync(path.join(root, "netlify/functions/_blackjack-duel-database.js"), "utf8");
for (const token of ["data-mode=\"blackjackduel\"", "data-rnb-game=\"blackjackduel\"", "data-blackjack-duel-mount", "window.__blackjackDuelBridge", "blackjackduel:state"]) {
  assert.ok(index.includes(token), `shared shell is missing ${token}`);
}
assert.ok(index.includes("blackjack-duel-v14"), "shared shell is missing the Blackjack Duel cache marker");
assert.ok(index.includes("game.mode==='blackjackduel'"), "Blackjack Duel must own its in-table countdown");
assert.ok(index.includes("blackjack-duel-focus"), "Blackjack Duel must use the focused active-round shell");
assert.ok(index.includes('document.body.classList.contains("blackjack-duel-focus")') && index.includes('document.querySelectorAll(".result-pop, .duel-big-result")'), "legacy bright result screens must stay out of the focused Blackjack Duel table");
assert.ok(index.includes("body.blackjack-duel-focus .result-pop") && index.includes("body.blackjack-duel-focus .duel-big-result { display:none!important; }"), "delayed shared result layers must remain hidden behind the Blackjack Duel result");
assert.ok(index.includes("canPatchMountedBlackjackDuel"), "Blackjack Duel must retain its mounted table between polls");
assert.ok(index.includes("shouldRequestFirst=game.mode!=='blackjackduel'"), "the Remote Bot must not repeatedly open unsolicited Double or Nothing windows");
assert.ok(index.includes('choice: "push-rematch"') && index.includes("pushRestart: () => duelRequestPushRestart()"), "a Push must automatically request its next round after five seconds");
assert.ok(index.includes('choice: "double-or-nothing-start"') && index.includes("doubleStart: () => duelStartAcceptedDoubleOrNothing()"), "both accepted Double or Nothing offers must start only after the visible timer expires");
assert.ok(index.includes("offerExpiresAt") && component.includes("doubleOfferUi.expiresAt"), "the authoritative acceptance window must share the same five-second deadline already visible to the player");
assert.ok(index.includes('choice: "blackjackduel-new-game"') && index.includes("Leaving this Blackjack Duel result"), "leaving a completed Blackjack Duel must notify the opponent before returning to game selection");
for (const token of ["BLACKJACK_DUEL_SERVER_START", "blackjackDuelInitialState", "blackjackDuelPublicState", "blackjackDuelAction", "blackjackDuelAdvanceAndSave"]) {
  assert.ok(data.includes(token), `server integration is missing ${token}`);
}
for (const token of ["double-or-nothing", "remote-bot-double-or-nothing", "DUEL_DOUBLE_OR_NOTHING_CREATE", "push-rematch", "isPushAutoRematch"]) {
  assert.ok(data.includes(token) || index.includes(token), `Double or Nothing integration is missing ${token}`);
}
assert.ok(data.includes('isDoubleOrNothing && latest.mode !== "blackjackduel"'), "all completed Blackjack Duel results must allow Double or Nothing");
assert.ok(!data.includes('latest.mode !== "blackjackduel" || !latest.tie'), "Double or Nothing must not be limited to ties");
assert.ok(data.includes("duelKnownRemoteBotAttachGames") && data.includes("rebuiltWaitingGame"), "Remote Bot Double or Nothing must hand the known rematch game into the existing attachment contract without an eventually-consistent reread");
assert.ok(data.includes("isSyntheticAcceptance"), "synthetic opponents must only accept an active human Double or Nothing offer");
assert.ok(data.includes("isDoubleFinalize") && data.includes("isDoubleOrNothing && !isDoubleFinalize") && data.includes("doubleAccepted: true"), "the server must record both Double or Nothing acceptances without starting before timer expiry");
assert.ok(data.includes("proposedDoubleExpiry") && data.includes("windowExpiresAt"), "the server must preserve the visible Double or Nothing deadline instead of restarting its timer after network latency");
assert.ok(data.includes("duelSanitizeResultDepartures") && data.includes("resultDepartures") && data.includes('rawChoice.toLowerCase() === "blackjackduel-new-game"'), "the server must publish completed-result departures to both players");
assert.ok(data.includes("isDoubleOrNothing || isPushAutoRematch") && data.includes("duelStartCountdown({ ...countdownGame"), "accepted Double or Nothing and automatic Push rematches must start directly in the next countdown");
for (const token of ["ensureSchema", "CREATE TABLE IF NOT EXISTS blackjack_duel_matches", "CREATE INDEX IF NOT EXISTS blackjack_duel_matches_updated_idx"]) {
  assert.ok(blackjackDatabase.includes(token), `database bootstrap is missing ${token}`);
}

console.log("Blackjack Duel validation passed: finite deck, private simultaneous play, timeout resolution, idempotent actions, modular UI, and shared lifecycle integration.");
