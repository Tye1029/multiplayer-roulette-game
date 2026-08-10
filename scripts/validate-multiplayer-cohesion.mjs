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
const data = fs.readFileSync(path.join(root, "netlify", "functions", "_data.js"), "utf8");
const action = fs.readFileSync(path.join(root, "netlify", "functions", "duel-action.js"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");

const expectedModes = [
  "mines", "rps", "draw", "fishing", "roulette", "plinko",
  "blackjack", "memory", "safecracker", "mountainrace", "cardwar", "coin"
];

assert.equal(contract.MULTIPLAYER_CONTRACT_VERSION, "cohesion-v1");
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
  "MULTIPLAYER_COHESION_V1",
  'require("./multiplayer-contract")',
  "async function duelReadFocusedGame",
  "skipBalanceLookup: true",
  "duelSupportsRematch(latest.mode)",
  "duelSupportsSyntheticOpponent(game.mode)",
  "const syntheticPlayer = [latest.creator, latest.joiner]",
  "await duelAddRemoteNetworkBot(human, created.game.gameId",
  "await duelAddSimpleNpc(human, created.game.gameId)"
]) assert.ok(data.includes(token), `server runtime is missing ${token}`);

assert.ok(!data.includes("Rematches are only available after a completed supported duel."));
assert.ok(!data.includes("const mountainRaceRequest = String(gameId"));
assert.ok(!data.includes("record: await getUserRecord(user.id) };\n}\n\n\n\n// ---------------- Russian Roulette Duel"));
assert.ok(action.includes('const DUEL_FUNCTION_BUILD = "multiplayer_cohesion_v1";'));

for (const token of [
  "MULTIPLAYER_COHESION_V1",
  'game.status === "complete" && DUEL_MODES_UI[String(game.mode || "")]',
  'game.status === "countdown" ? 250 : 350',
  "requestError.retryable = response.status >= 500",
  'data-rnb-game="mines"',
  'data-rnb-game="mountainrace"',
  'data-rnb-game="coin"',
  'data-mode="blackjack"',
  'data-mode="cardwar"',
  "align-items:flex-start;justify-content:center;overflow-y:auto",
  ".sth-card{width:min(520px,100%);margin:auto"
]) assert.ok(index.includes(token), `client runtime is missing ${token}`);

assert.ok(!index.includes("if (mountainRacePauseCompletedPolling(game))"), "Summit completion must use shared rematch polling");
assert.ok(!index.includes("one of the five multiplayer games"));
assert.ok(!index.includes("if(!['roulette','draw','fishing','safecracker','mountainrace'].includes(o.value))o.remove()"));
assert.equal((index.match(/<button data-rnb-game=/g) || []).length, expectedModes.length);
assert.equal((index.match(/class="sth-game" data-mode=/g) || []).length, expectedModes.length);

console.log(`Multiplayer cohesion validation passed for ${expectedModes.length} modes.`);
