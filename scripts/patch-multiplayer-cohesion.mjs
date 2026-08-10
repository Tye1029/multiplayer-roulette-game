import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = process.env.MULTIPLAYER_BUILD_ROOT
  ? path.resolve(process.env.MULTIPLAYER_BUILD_ROOT)
  : scriptRoot;
const dataPath = path.join(root, "netlify", "functions", "_data.js");
const actionPath = path.join(root, "netlify", "functions", "duel-action.js");
const indexPath = path.join(root, "index.html");
const MARKER = "MULTIPLAYER_COHESION_V1";

function replaceOnce(source, search, replacement, label) {
  const matches = typeof search === "string"
    ? source.split(search).length - 1
    : [...source.matchAll(new RegExp(search.source, search.flags.includes("g") ? search.flags : `${search.flags}g`))].length;
  if (matches === 0 && source.includes(replacement)) return source;
  if (matches !== 1) throw new Error(`${label}: expected one source match, found ${matches}.`);
  return source.replace(search, replacement);
}

let data = fs.readFileSync(dataPath, "utf8");

data = replaceOnce(
  data,
  "// ---------------- Multiplayer Arcade Duels ----------------\nconst DUEL_GAME_PREFIX",
  `// ---------------- Multiplayer Arcade Duels ----------------\n// ${MARKER}\nconst {\n  MULTIPLAYER_CONTRACT_VERSION,\n  MODE_NAMES: DUEL_MODES,\n  supportsRematch: duelSupportsRematch,\n  supportsSyntheticOpponent: duelSupportsSyntheticOpponent,\n  countdownMs: duelCountdownMs\n} = require("./multiplayer-contract");\nconst DUEL_GAME_PREFIX`,
  "shared contract import"
);

data = replaceOnce(
  data,
  /const DUEL_MODES = \{[\s\S]*?\n\};\n\nfunction duelGameKey/,
  "function duelGameKey",
  "legacy mode registry"
);

data = replaceOnce(
  data,
  /  const startMs = atMs \+ \(game\?\.mode === "safecracker" \? 3000 : DUEL_COUNTDOWN_MS\);\n  const effectiveStartMs = game\?\.mode === "mountainrace" \? atMs \+ 3000 : startMs;/,
  "  const effectiveStartMs = atMs + duelCountdownMs(game?.mode);",
  "countdown policy"
);

data = replaceOnce(
  data,
  /    if \(npcId && viewer === humanId && ready\[humanId\] && !ready\[npcId\]\) \{[\s\S]*?\n    \}\n\n    game = duelNormalizeReadyState/,
  `    if (npcId && viewer === humanId && ready[humanId] && !ready[npcId]) {\n      // Synthetic opponents share one Ready contract in every mode. Confirming\n      // both flags under this lock prevents delayed bot timers and GET polls\n      // from competing to own the countdown transition.\n      ready[npcId] = true;\n      game.npcReadyAt = null;\n      game.npcReadyWindowId = activeWindowId;\n    }\n\n    game = duelNormalizeReadyState`,
  "synthetic Ready policy"
);

data = data.replace(
  /if \(!\["fishing", "draw", "roulette", "safecracker", "mountainrace"\]\.includes\(game\.mode\)\) throw new Error\("The NPC is available for Fishing, DRAW!, Roulette, Safe Cracker, and Summit Sprint testing\."\);/g,
  "if (!duelSupportsSyntheticOpponent(game.mode)) throw new Error(\"This game does not support a synthetic opponent.\");"
);
data = data.replace(
  /if \(!\["roulette", "draw", "fishing", "safecracker", "mountainrace"\]\.includes\(String\(game\.mode \|\| ""\)\)\) throw new Error\("Remote Network Bot supports Roulette, Draw, Fishing, Safe Cracker, and Summit Sprint\."\);/g,
  "if (!duelSupportsSyntheticOpponent(game.mode)) throw new Error(\"This game does not support the Remote Network Bot.\");"
);

data = replaceOnce(
  data,
  "if (latest.status !== \"complete\" || ![\"draw\", \"fishing\", \"roulette\", \"safecracker\", \"mountainrace\"].includes(String(latest.mode || \"\"))) throw new Error(\"Rematches are only available after a completed supported duel.\");",
  "if (latest.status !== \"complete\" || !duelSupportsRematch(latest.mode)) throw new Error(\"Rematches are only available after a completed duel.\");",
  "rematch mode policy"
);

data = replaceOnce(
  data,
  /      let created;\n      try \{\n        created = await duelCreateGame\(playerFor\(firstId\), \{ mode: latest\.mode, wager: latest\.wager \}\);\n        const joined = await duelJoinGame\(playerFor\(secondId\), created\.game\.gameId\);\n        latest = await duelSaveGame\(\{ \.\.\.latest, rematch, rematchGameId: joined\.game\.gameId \}\);\n        return \{ game: duelPublicGame\(latest, viewer\), rematchGame: duelPublicGame\(await duelGetRaw\(joined\.game\.gameId\), viewer\), record: await getUserRecord\(user\.id\) \};\n      \} catch \(error\) \{\n        if \(created\?\.game\?\.gameId\) \{\n          try \{ await duelCancelGame\(playerFor\(firstId\), created\.game\.gameId\); \} catch \(_\) \{\}\n        \}\n        throw error;\n      \}/,
  `      let created;\n      let creatorForCleanup = playerFor(firstId);\n      try {\n        const syntheticPlayer = [latest.creator, latest.joiner].find(player => player?.isNpc || player?.isRemoteBot || String(player?.userId || "").startsWith("npc-") || String(player?.userId || "").startsWith("remote-bot-"));\n        let rematchGame;\n        if (syntheticPlayer) {\n          const humanId = playerIds.find(id => id !== cleanUserId(syntheticPlayer.userId));\n          const human = playerFor(humanId);\n          creatorForCleanup = human;\n          created = await duelCreateGame(human, { mode: latest.mode, wager: latest.wager });\n          const attached = syntheticPlayer.isRemoteBot || String(syntheticPlayer.userId || "").startsWith("remote-bot-")\n            ? await duelAddRemoteNetworkBot(human, created.game.gameId, latest.remoteNetworkProfile || "normal")\n            : await duelAddSimpleNpc(human, created.game.gameId);\n          rematchGame = attached.game;\n        } else {\n          created = await duelCreateGame(playerFor(firstId), { mode: latest.mode, wager: latest.wager });\n          const joined = await duelJoinGame(playerFor(secondId), created.game.gameId);\n          rematchGame = joined.game;\n        }\n        latest = await duelSaveGame({ ...latest, rematch, rematchGameId: rematchGame.gameId });\n        const authoritativeRematch = await duelGetRawStrong(rematchGame.gameId, 2) || await duelGetRaw(rematchGame.gameId) || rematchGame;\n        return { game: duelPublicGame(latest, viewer), rematchGame: duelPublicGame(authoritativeRematch, viewer), record: await getUserRecord(user.id) };\n      } catch (error) {\n        if (created?.game?.gameId) {\n          try { await duelCancelGame(creatorForCleanup, created.game.gameId); } catch (_) {}\n        }\n        throw error;\n      }`,
  "shared rematch creation"
);

data = replaceOnce(
  data,
  "async function duelActionGame(user, gameId, details = {}) {\n  const mountainRaceRequest = String(gameId || \"\").startsWith(\"duel-mountainrace-\");\n  let game = mountainRaceRequest\n    ? await duelGetRawStrong(gameId, 2) || await duelGetRaw(gameId)\n    : await duelGetRaw(gameId);\n  if (!game) throw new Error(\"That duel was not found.\");",
  "async function duelActionGame(user, gameId, details = {}) {\n  let game = await duelReadFocusedGame(user, gameId, 3);\n  if (!game) throw new Error(\"That duel was not found.\");",
  "action focused reader"
);

data = replaceOnce(
  data,
  "async function duelGetGame(user, gameId, options = {}) {\n  const mountainRaceRequest = String(gameId || \"\").startsWith(\"duel-mountainrace-\");\n  let game = mountainRaceRequest\n    ? await duelGetRawStrong(gameId, 2) || await duelGetRaw(gameId)\n    : await duelGetRaw(gameId);\n  if (!game) throw new Error(\"That duel was not found.\");",
  `async function duelReadFocusedGame(user, gameId, attempts = 3) {\n  const requestedGameId = mpCleanId(gameId);\n  if (!requestedGameId) return null;\n  const total = Math.max(1, Math.min(6, int(attempts, 3)));\n  for (let attempt = 0; attempt < total; attempt += 1) {\n    const game = await duelGetRawStrong(requestedGameId, 1) || await duelGetRaw(requestedGameId);\n    if (game) return game;\n    const active = await duelFindActiveGameForUser(user?.id, "", { scanFallback: false });\n    if (active?.gameId === requestedGameId) return active;\n    if (attempt + 1 < total) await sleep(120 * (attempt + 1));\n  }\n  return null;\n}\n\nasync function duelGetGame(user, gameId, options = {}) {\n  let game = await duelReadFocusedGame(user, gameId, 3);\n  if (!game) throw new Error("That duel was not found.");`,
  "focused game reader"
);

// The late Summit patch may leave these local branches inside duelGetGame.
data = data.replace(/      const latest = mountainRaceRequest\n        \? await duelGetRawStrong\(gameId, 1\) \|\| await duelGetRaw\(gameId\)\n        : await duelGetRaw\(gameId\);/g, "      const latest = await duelReadFocusedGame(user, gameId, 2);");

const getStart = data.indexOf("async function duelGetGame(user, gameId, options = {})");
const rouletteSection = data.indexOf("\n// ---------------- Russian Roulette Duel", getStart);
const getEnd = rouletteSection < 0 ? -1 : data.lastIndexOf("\n}", rouletteSection);
if (getStart < 0 || getEnd < 0) throw new Error("focused GET function boundaries were not found.");
const getBlock = data.slice(getStart, getEnd + 2);
const fastGetBlock = replaceOnce(
  getBlock,
  "return { game: duelPublicGame(game, controlledActor.id), record: await getUserRecord(user.id) };",
  "return { game: duelPublicGame(game, controlledActor.id), skipBalanceLookup: true, contractVersion: MULTIPLAYER_CONTRACT_VERSION };",
  "focused GET balance isolation"
);
data = `${data.slice(0, getStart)}${fastGetBlock}${data.slice(getEnd + 2)}`;

fs.writeFileSync(dataPath, data);

let action = fs.readFileSync(actionPath, "utf8");
action = action.replace(/const DUEL_FUNCTION_BUILD = "[^"]+";/, `const DUEL_FUNCTION_BUILD = "${MARKER.toLowerCase()}";`);
fs.writeFileSync(actionPath, action);

let index = fs.readFileSync(indexPath, "utf8");
index = replaceOnce(
  index,
  "    function duelSetPollRate(game = null) {",
  `    // ${MARKER}\n    function duelSetPollRate(game = null) {`,
  "client cohesion marker"
);
index = index.replace(
  "const completedAwaitingRematch = Boolean(game && game.status === \"complete\" && [\"draw\", \"fishing\", \"roulette\", \"safecracker\"].includes(String(game.mode || \"\")));",
  "const completedAwaitingRematch = Boolean(game && game.status === \"complete\" && DUEL_MODES_UI[String(game.mode || \"\")]);"
);
index = index.replace(
  /      if \(mountainRacePauseCompletedPolling\(game\)\) \{\n        duelSetSharedCountdown\(game\);\n        return;\n      \}\n/,
  ""
);
index = index.replace(
  "const desired = safeCrackerLive ? (game.status === \"playing\" ? 2200 : 650) : sharedLifecycleLive ? 200 : drawPlaying ? 650 : rouletteLive ? 800 : fishingLive ? 450 : completedAwaitingRematch ? completedPollRate : noFocusedGame ? 2000 : 1800;",
  "const desired = safeCrackerLive ? (game.status === \"playing\" ? 2200 : 650) : sharedLifecycleLive ? (game.status === \"countdown\" ? 250 : 350) : drawPlaying ? 650 : rouletteLive ? 800 : fishingLive ? 450 : game?.mode === \"mountainrace\" && game?.status === \"playing\" ? 700 : completedAwaitingRematch ? completedPollRate : noFocusedGame ? 2000 : 1800;"
);
index = index.replace(
  "if (!response.ok || !data.ok) throw new Error(data.error || \"Multiplayer Arcade request failed.\");",
  `if (!response.ok || !data.ok) {\n          const requestError = new Error(data.error || "Multiplayer Arcade request failed.");\n          requestError.status = response.status;\n          requestError.action = action;\n          requestError.gameId = String(payload?.gameId || "");\n          requestError.retryable = response.status >= 500 || response.status === 429;\n          throw requestError;\n        }`
);
index = index.replace(
  "if(tracked)line(logs,'request',{action});",
  "if(tracked)line(logs,'request',{action,gameId:String((()=>{try{return JSON.parse(init?.body||'{}').gameId||''}catch{return''}})())});"
);
index = index.replace(
  "line(logs,'response',{action,status:r.status,ms:Math.round(performance.now()-start)})",
  "line(logs,'response',{action,status:r.status,ms:Math.round(performance.now()-start)})"
);

index = replaceOnce(
  index,
  "Enter and verify your Torn API key, then choose one of the five multiplayer games.",
  "Enter and verify your Torn API key, then choose a multiplayer game.",
  "test launcher description"
);
index = replaceOnce(
  index,
  "#simpleTestHome{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:20px;",
  "#simpleTestHome{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:20px;",
  "scrollable all-mode launcher"
);
index = index.replace(
  ".sth-card{width:min(520px,100%);padding:26px;",
  ".sth-card{width:min(520px,100%);margin:auto;padding:26px;"
);
index = replaceOnce(
  index,
  `      <button class="sth-game" data-mode="roulette" disabled>Russian Roulette</button>\n      <button class="sth-game" data-mode="draw" disabled>Draw</button>\n      <button class="sth-game" data-mode="fishing" disabled>Fishing</button>\n      <button class="sth-game" data-mode="safecracker" disabled>Safe Cracker</button>\n      <button class="sth-game" data-mode="mountainrace" disabled>Summit Sprint</button>`,
  `      <button class="sth-game" data-mode="mines" disabled>Multiplayer Mines Race</button>\n      <button class="sth-game" data-mode="rps" disabled>Rock Paper Scissors</button>\n      <button class="sth-game" data-mode="draw" disabled>DRAW!</button>\n      <button class="sth-game" data-mode="fishing" disabled>Rumble Fishing</button>\n      <button class="sth-game" data-mode="roulette" disabled>Russian Roulette</button>\n      <button class="sth-game" data-mode="plinko" disabled>Plinko Duel</button>\n      <button class="sth-game" data-mode="blackjack" disabled>Blackjack 1v1</button>\n      <button class="sth-game" data-mode="memory" disabled>Memory Match</button>\n      <button class="sth-game" data-mode="safecracker" disabled>Safe Cracker</button>\n      <button class="sth-game" data-mode="mountainrace" disabled>Summit Sprint</button>\n      <button class="sth-game" data-mode="cardwar" disabled>Card War</button>\n      <button class="sth-game" data-mode="coin" disabled>Coin Flip</button>`,
  "all-mode test launcher"
);
index = replaceOnce(
  index,
  "if(sel){[...sel.options].forEach(o=>{if(!['roulette','draw','fishing','safecracker','mountainrace'].includes(o.value))o.remove()});sel.value=mode;sel.dispatchEvent(new Event('change',{bubbles:true}));}",
  "if(sel){sel.value=mode;sel.dispatchEvent(new Event('change',{bubbles:true}));}",
  "test launcher option retention"
);
index = replaceOnce(
  index,
  `<div class="rnb-games"><button data-rnb-game="roulette">Roulette</button><button data-rnb-game="draw">Draw</button><button data-rnb-game="fishing">Fishing</button><button data-rnb-game="safecracker">Safe Cracker</button><button data-rnb-game="mountainrace">Summit Sprint</button></div>`,
  `<div class="rnb-games"><button data-rnb-game="mines">Mines</button><button data-rnb-game="rps">RPS</button><button data-rnb-game="draw">DRAW!</button><button data-rnb-game="fishing">Fishing</button><button data-rnb-game="roulette">Roulette</button><button data-rnb-game="plinko">Plinko</button><button data-rnb-game="blackjack">Blackjack</button><button data-rnb-game="memory">Memory</button><button data-rnb-game="safecracker">Safe Cracker</button><button data-rnb-game="mountainrace">Summit Sprint</button><button data-rnb-game="cardwar">Card War</button><button data-rnb-game="coin">Coin Flip</button></div>`,
  "all-mode Remote Bot launcher"
);
index = index.replace(
  ".rnb-games button{min-height:36px;border:0;border-radius:8px;color:white;font-weight:900}",
  ".rnb-games button{min-height:36px;border:0;border-radius:8px;background:#334862;color:white;font-weight:900}"
);
fs.writeFileSync(indexPath, index);

console.log(`Applied ${MARKER}: unified lifecycle, polling, synthetic Ready, and rematches.`);
