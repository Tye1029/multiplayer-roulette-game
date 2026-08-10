import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const scriptRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = process.env.MULTIPLAYER_BUILD_ROOT
  ? path.resolve(process.env.MULTIPLAYER_BUILD_ROOT)
  : scriptRoot;
const require = createRequire(import.meta.url);
const contractPath = path.join(root, "netlify", "functions", "multiplayer-contract.js");
const contract = require(fs.existsSync(contractPath)
  ? contractPath
  : path.join(scriptRoot, "netlify", "functions", "multiplayer-contract.js"));
const catalogPath = path.join(root, "shared", "games", "catalog.js");
const catalog = require(fs.existsSync(catalogPath)
  ? catalogPath
  : path.join(scriptRoot, "shared", "games", "catalog.js"));
const data = fs.readFileSync(path.join(root, "netlify", "functions", "_data.js"), "utf8");
const action = fs.readFileSync(path.join(root, "netlify", "functions", "duel-action.js"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");

const expectedModes = [
  "mines", "rps", "draw", "fishing", "roulette", "plinko",
  "blackjack", "memory", "safecracker", "mountainrace", "cardwar", "coin"
];

const activeTestModes = ["roulette", "draw", "fishing", "safecracker", "mountainrace"];
const legacyModes = ["mines", "rps", "plinko", "blackjack", "memory", "cardwar", "coin"];

assert.equal(catalog.version, "game-catalog-v1");
assert.deepEqual(catalog.multiplayerTestModes, activeTestModes);
assert.deepEqual(catalog.legacyMultiplayerModes, legacyModes);
assert.deepEqual(Object.keys(catalog.multiplayerModeNames), expectedModes);
assert.ok(catalog.singlePlayerSections.includes("scratch-ticket"));
assert.ok(catalog.multiplayerSections.includes("multiplayer-arcade"));
assert.equal(contract.MULTIPLAYER_CONTRACT_VERSION, "cohesion-v3");
assert.deepEqual(Object.keys(contract.MODE_NAMES), expectedModes);
for (const mode of expectedModes) {
  assert.equal(contract.hasMode(mode), true, `${mode} must be registered`);
  assert.equal(contract.supportsRematch(mode), true, `${mode} must support rematches`);
  assert.equal(contract.supportsSyntheticOpponent(mode), true, `${mode} must support synthetic opponents`);
}
assert.equal(contract.countdownMs("mountainrace"), 3000);
assert.equal(contract.countdownMs("safecracker"), 3000);
assert.equal(contract.countdownMs("roulette"), 5000);

for (const token of [
  "MULTIPLAYER_COHESION_V4",
  'require("./multiplayer-contract")',
  "async function duelReadFocusedGame",
  "skipBalanceLookup: true",
  "duelSupportsRematch(latest.mode)",
  "duelSupportsSyntheticOpponent(game.mode)",
  "const syntheticPlayer = [latest.creator, latest.joiner]",
  "await duelAddRemoteNetworkBot(human, created.game.gameId",
  "await duelAddSimpleNpc(human, created.game.gameId)",
  "activeModeConflict: true",
  "await duelAbandonNpcGame(user, activeGame.gameId)",
  "if (createResult?.activeModeConflict)",
  "atomicCreateAndAttach: false",
  'String(game.mode || "") !== mode'
]) assert.ok(data.includes(token), `server runtime is missing ${token}`);

assert.ok(!data.includes("Rematches are only available after a completed supported duel."));
assert.ok(!data.includes("const mountainRaceRequest = String(gameId"));
assert.ok(!data.includes("record: await getUserRecord(user.id) };\n}\n\n\n\n// ---------------- Russian Roulette Duel"));
assert.ok(action.includes('const DUEL_FUNCTION_BUILD = "multiplayer_cohesion_v4";'));

for (const token of [
  "MULTIPLAYER_COHESION_V4",
  'game.status === "complete" && DUEL_MODES_UI[String(game.mode || "")]',
  'game.status === "countdown" ? 250 : 350',
  "requestError.retryable = response.status >= 500",
  '/shared/games/catalog.js?v=1',
  'window.GAMBLING_SITE_CATALOG?.multiplayerTestModes',
  "if(typeof duelStartNewGame==='function')duelStartNewGame(mode)",
  'function duelStartNewGame(requestedMode = "")',
  'window.__duelRequestedModeIntent = String(requestedMode || "")',
  '!duelCurrentGameId && !String(window.__duelRequestedModeIntent || "")',
  'window.__duelRequestedModeIntent = String(mode || "")',
  'String(game.mode || "") !== String(requestedMode || "")',
  'The incorrect game was not opened.',
  'data-rnb-game="roulette"',
  'data-rnb-game="mountainrace"',
  'data-mode="safecracker"',
  'data-mode="mountainrace"',
  "You still have an unfinished",
  "align-items:flex-start;justify-content:center;overflow-y:auto",
  ".sth-card{width:min(520px,100%);margin:auto",
  "Start / Add Remote Bot",
  "One click creates or safely recovers the game",
  "RNB_LOG_LIMIT=800",
  "RNB_STARTUP_LOG_LIMIT=240",
  "RNB_PENDING_START_KEY='rnbPendingStartV1'",
  "startupLogs=[]",
  "selectedModeExplicit=false",
  "selectedModeExplicit=true;line(botLogs,'selected game'",
  "selectedModeExplicit?selectedMode:(current?.mode",
  "STARTUP / LIFECYCLE",
  "RECENT ACTIVITY",
  "function rnbPendingStart(mode,wager,current)",
  "sessionStorage.setItem(RNB_PENDING_START_KEY",
  "for(let attempt=1;attempt<=3;attempt+=1)",
  "duelRequest('create-remote-bot',payload)",
  "const data=await rnbAttachBotAtomically(pending.gameId,profile)",
  "startupLine('Ready screen mounted'",
  "base.startupLogs=[...startupLogs]",
  "startupLimit:RNB_STARTUP_LOG_LIMIT",
  "if(rouletteDebugLines.length>800)",
  "if(entries.length>800)entries.shift()"
]) assert.ok(index.includes(token), `client runtime is missing ${token}`);

assert.ok(!index.includes("if (mountainRacePauseCompletedPolling(game))"), "Summit completion must use shared rematch polling");
assert.ok(index.includes("one of the five multiplayer games currently in active development"));
assert.ok(!index.includes('data-rnb-game="mines"'));
assert.ok(!index.includes('class="sth-game" data-mode="blackjack"'));
assert.ok(!index.includes("Create a game first."), "Remote Bot startup must not require a separate create click");
assert.ok(!index.includes("arr.splice(80)"), "shared debug histories must not retain the old 80-entry cap");
assert.ok(!index.includes("entries.length>200"), "Roulette debug dock must not retain the old 200-entry cap");
assert.equal((index.match(/<button data-rnb-game=/g) || []).length, activeTestModes.length);
assert.equal((index.match(/class="sth-game" data-mode=/g) || []).length, activeTestModes.length);

const launcherStart = index.indexOf("function openGame(mode)");
const launcherEnd = index.indexOf("games.forEach(b=>b.addEventListener", launcherStart);
assert.ok(launcherStart >= 0 && launcherEnd > launcherStart, "test launcher function must be present");
const launcherSource = index.slice(launcherStart, launcherEnd);
const clearFocusAt = launcherSource.indexOf("duelStartNewGame(mode)");
const showMenuAt = launcherSource.indexOf("showDuelGames()");
const selectModeAt = launcherSource.indexOf("sel.value=mode");
assert.ok(clearFocusAt >= 0 && clearFocusAt < showMenuAt, "stale focused games must be cleared before opening the menu");
assert.ok(showMenuAt >= 0 && showMenuAt < selectModeAt, "the requested mode must be selected after the shared menu mounts");

console.log(`Multiplayer cohesion validation passed for ${expectedModes.length} registered modes and ${activeTestModes.length} active test modes.`);
