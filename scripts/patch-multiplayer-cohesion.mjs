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
const MARKER = "MULTIPLAYER_COHESION_V4";

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
  `  const activeGame = await duelFindActiveGameForUser(user.id,"",{scanFallback:false});\n  if (activeGame) {\n    return {game:duelPublicGame(activeGame,user.id),record:await getUserRecord(user.id),resumedExisting:true};\n  }`,
  `  let activeGame = await duelFindActiveGameForUser(user.id,"",{scanFallback:false});\n  if (activeGame && activeGame.mode !== mode) {\n    const syntheticOpponent = [activeGame.creator, activeGame.joiner].find(player => player?.isNpc || player?.isRemoteBot || String(player?.userId || "").startsWith("npc-") || String(player?.userId || "").startsWith("remote-bot-"));\n    if (syntheticOpponent) {\n      // Switching test modes may safely retire an unfinished synthetic match.\n      // Real-player games are never cancelled or hidden automatically.\n      await duelAbandonNpcGame(user, activeGame.gameId);\n      activeGame = null;\n    } else {\n      return {\n        game: duelPublicGame(activeGame, user.id),\n        record: await getUserRecord(user.id),\n        activeModeConflict: true,\n        requestedMode: mode\n      };\n    }\n  }\n  if (activeGame) {\n    return {game:duelPublicGame(activeGame,user.id),record:await getUserRecord(user.id),resumedExisting:true};\n  }`,
  "cross-mode create routing"
);

data = replaceOnce(
  data,
  `    createResult = await duelCreateGame(user, { mode, wager, clientGameId });
    const createdId = mpCleanId(createResult?.game?.gameId || clientGameId);`,
  `    createResult = await duelCreateGame(user, { mode, wager, clientGameId });
    if (createResult?.activeModeConflict) {
      // Never let the atomic testing endpoint attach a bot to a different
      // real-player match returned by the shared active-game guard.
      return { ...createResult, atomicCreateAndAttach: false };
    }
    const createdId = mpCleanId(createResult?.game?.gameId || clientGameId);`,
  "atomic Remote Bot active-mode conflict"
);
data = replaceOnce(
  data,
  `  if (!game) throw new Error("The duel could not be created for the Remote Network Bot.");
  if (cleanUserId(game.creator?.userId) !== viewer)`,
  `  if (!game) throw new Error("The duel could not be created for the Remote Network Bot.");
  if (String(game.mode || "") !== mode) throw new Error("The Remote Network Bot request resolved to a different game mode.");
  if (cleanUserId(game.creator?.userId) !== viewer)`,
  "atomic Remote Bot requested-mode ownership"
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
  '<script id="simple-multiplayer-test-script">',
  '<script src="/shared/games/catalog.js?v=1"></script>\n<script id="simple-multiplayer-test-script">',
  "browser game catalog"
);
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
index = replaceOnce(
  index,
  `    function duelStartNewGame(){\n      duelRememberCurrentGame("");`,
  `    function duelStartNewGame(requestedMode = ""){\n      // Changing games invalidates every poll that began under the prior focus.\n      // The requested-mode intent also prevents a lobby list from auto-resuming\n      // an older server game while the player is setting up the new one.\n      duelRefreshSequence += 1;\n      duelRefreshPending = false;\n      window.__duelRequestedModeIntent = String(requestedMode || "");\n      duelRememberCurrentGame("");`,
  "new-game response ownership"
);
index = replaceOnce(
  index,
  `          if (!duelCurrentGameId) {\n            const resumable = duelCachedGames.find(g => g?.isPlayer && ["waiting","ready","countdown","playing"].includes(String(g.status || "")));`,
  `          if (!duelCurrentGameId && !String(window.__duelRequestedModeIntent || "")) {\n            const resumable = duelCachedGames.find(g => g?.isPlayer && ["waiting","ready","countdown","playing"].includes(String(g.status || "")));`,
  "requested-mode auto-resume guard"
);
index = replaceOnce(
  index,
  `        const mode = duelModeSelect?.value || "coin";\n        const wager = Math.max(0, Math.floor(Number(duelWagerInput?.value || 0)));`,
  `        const mode = duelModeSelect?.value || "coin";\n        window.__duelRequestedModeIntent = String(mode || "");\n        duelRefreshSequence += 1;\n        duelRefreshPending = false;\n        const wager = Math.max(0, Math.floor(Number(duelWagerInput?.value || 0)));`,
  "create response ownership"
);
index = replaceOnce(
  index,
  `      if (!game?.gameId) throw new Error("The server did not return the created game.");\n      duelResetGenericRuntime(null);`,
  `      if (!game?.gameId) throw new Error("The server did not return the created game.");\n      if (data?.activeModeConflict) {\n        window.__duelRequestedModeIntent = String(requestedMode || "");\n        duelRememberCurrentGame("");\n        duelLastActiveGame = null;\n        duelRenderActive(null, true);\n        throw new Error(\`You still have an unfinished \${game.modeName || "multiplayer game"}. Finish or cancel it before creating \${DUEL_MODES_UI[requestedMode]?.name || "another game"}.\`);\n      }\n      if (String(game.mode || "") !== String(requestedMode || "")) {\n        window.__duelRequestedModeIntent = String(requestedMode || "");\n        duelRememberCurrentGame("");\n        duelLastActiveGame = null;\n        duelRenderActive(null, true);\n        throw new Error(\`The server returned \${game.modeName || game.mode || "a different game"} while creating \${DUEL_MODES_UI[requestedMode]?.name || requestedMode}. The incorrect game was not opened.\`);\n      }\n      duelRefreshSequence += 1;\n      duelRefreshPending = false;\n      window.__duelRequestedModeIntent = "";\n      duelResetGenericRuntime(null);`,
  "cross-mode create conflict guard"
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
  '<button class="rnb-add" id="rnbAddBot" type="button">Add Remote Bot</button>',
  '<button class="rnb-add" id="rnbAddBot" type="button">Start / Add Remote Bot</button>',
  "one-click Remote Bot label"
);
index = replaceOnce(
  index,
  "Choose a game, create it normally, then add the bot. The bot is a separate synthetic server player and uses the same authoritative multiplayer records.",
  "Choose a game and wager, then start it here. One click creates or safely recovers the game and attaches the separate synthetic server player.",
  "one-click Remote Bot instructions"
);
index = replaceOnce(
  index,
  / const logs=\[\],botLogs=\[\]; let selectedMode='roulette',lastGameId='',lastRevision(?:Key)?=(?:-1|'');\n function line\(arr,msg,data\)\{arr\.unshift\(`\$\{new Date\(\)\.toLocaleTimeString\(\)\}  \$\{msg\}\$\{data\?' '\+JSON\.stringify\(data\):''\}`\);arr\.splice\(80\);\}/,
  ` const RNB_LOG_LIMIT=800,RNB_STARTUP_LOG_LIMIT=240,RNB_PENDING_START_KEY='rnbPendingStartV1';
 const logs=[],botLogs=[],startupLogs=[]; let selectedMode='roulette',selectedModeExplicit=false,lastGameId='',lastRevision=-1;
 function line(arr,msg,data){arr.unshift(\`${'${new Date().toLocaleTimeString()}  ${msg}${data?\' \'+JSON.stringify(data):\'\'}'}\`);arr.splice(RNB_LOG_LIMIT);}
 function startupLine(msg,data){startupLogs.unshift(\`${'${new Date().toLocaleTimeString()}  ${msg}${data?\' \'+JSON.stringify(data):\'\'}'}\`);startupLogs.splice(RNB_STARTUP_LOG_LIMIT);}
 function rnbLogText(arr,empty){const startup=\`STARTUP / LIFECYCLE (\${startupLogs.length}/\${RNB_STARTUP_LOG_LIMIT})\\n\${startupLogs.join('\\n')||'No startup events recorded.'}\`;const recent=\`RECENT ACTIVITY (\${arr.length}/\${RNB_LOG_LIMIT})\\n\${arr.join('\\n')||empty}\`;return \`\${startup}\\n\\n\${recent}\`;}`,
  "bounded diagnostic histories"
);
index = replaceOnce(
  index,
  "  gameLog.textContent=logs.join('\\n')||'No active game.';botLog.textContent=botLogs.join('\\n')||(g?.remoteNetworkTest?'Remote bot attached. Waiting for activity.':'Remote bot not attached.');",
  "  gameLog.textContent=rnbLogText(logs,'No active game.');botLog.textContent=rnbLogText(botLogs,g?.remoteNetworkTest?'Remote bot attached. Waiting for activity.':'Remote bot not attached.');",
  "diagnostic history rendering"
);
index = replaceOnce(
  index,
  "line(botLogs,'selected game',{mode:selectedMode});render()",
  "selectedModeExplicit=true;line(botLogs,'selected game',{mode:selectedMode});render()",
  "explicit Remote Bot mode selection"
);

index = replaceOnce(
  index,
  /  async function rnbAttachBotAtomically\(gameId,profile\)\{[\s\S]*?\n   \}\n(?=\s*\$\('rnbAddBot'\)\.addEventListener)/,
  `  function rnbReadPendingStart(mode,wager){
   try{const value=JSON.parse(sessionStorage.getItem(RNB_PENDING_START_KEY)||'null');if(value&&value.mode===mode&&Number(value.wager)===wager&&Date.now()-Number(value.createdAt||0)<180000&&/^duel-[a-z0-9_-]+-\\d{10,16}-[a-f0-9]{12}$/.test(String(value.gameId||'')))return value}catch{}
   return null;
  }
  function rnbPendingStart(mode,wager,current){
   const reusable=current&&String(current.mode||'')===mode&&['waiting','ready','countdown','playing'].includes(String(current.status||''));
   if(reusable)return{gameId:String(current.gameId),mode,wager,createdAt:Date.now(),reusedCurrent:true};
   const saved=rnbReadPendingStart(mode,wager);if(saved)return saved;
   const bytes=new Uint8Array(6);crypto.getRandomValues(bytes);const suffix=[...bytes].map(value=>value.toString(16).padStart(2,'0')).join('');
   const pending={gameId:\`duel-\${mode}-\${Date.now()}-\${suffix}\`,mode,wager,createdAt:Date.now(),reusedCurrent:false};sessionStorage.setItem(RNB_PENDING_START_KEY,JSON.stringify(pending));return pending;
  }
  async function rnbAttachBotAtomically(gameId,profile){
   const current=rnbCurrentGame(gameId)||(typeof duelLastActiveGame!=='undefined'?duelLastActiveGame:null);
   const mode=String(selectedMode||current?.mode||$('duelModeSelect')?.value||'roulette');
   const wager=Math.max(1000,Math.floor(Number($('duelWagerInput')?.value||current?.wager||1000)));
   const payload={gameId,clientGameId:gameId,mode,wager,profile};
   let lastError=null;
   for(let attempt=1;attempt<=3;attempt+=1){
    try{
     startupLine('create + attach request',{attempt,gameId,mode,wager,profile});render();
     const data=await duelRequest('create-remote-bot',payload);
     if(data?.activeModeConflict)throw new Error(\`Finish or cancel \${data.game?.modeName||data.game?.mode||'your current multiplayer game'} before starting \${mode}.\`);
     if(!data?.game)throw new Error('Server did not return the created Remote Bot game.');
     if(String(data.game.mode||'')!==mode)throw new Error('The server returned a different game mode. It was not opened.');
     startupLine('create + attach succeeded',{attempt,gameId:data.game.gameId,mode,status:data.game.status,recovered:Boolean(data.recoveredCreate||data.recoveredExistingBot)});
     return data;
    }catch(err){
     lastError=err;const retryable=Boolean(err?.retryable||err?.code==='DUEL_TIMEOUT'||/network|fetch|timeout|timed out/i.test(String(err?.message||err)));
     startupLine('create + attach failed',{attempt,gameId,status:err?.status||0,retryable,error:String(err?.message||err)});render();
     if(!retryable||attempt===3)break;
     const delay=attempt===1?600:1400;startupLine('retry scheduled',{attempt:attempt+1,delayMs:delay,gameId});render();await new Promise(resolve=>setTimeout(resolve,delay));
    }
   }
   throw lastError||new Error('Unable to start the Remote Bot game.');
  }
`,
  "idempotent one-click Remote Bot helper"
);
index = replaceOnce(
  index,
  / \$\('rnbAddBot'\)\.addEventListener\('click',[^\n]*\n/,
  ` $('rnbAddBot').addEventListener('click',async()=>{
  const b=$('rnbAddBot');const profile=$('rnbProfile').value;const current=(typeof duelLastActiveGame!=='undefined'&&duelLastActiveGame)||null;const mode=String(selectedModeExplicit?selectedMode:(current?.mode||$('duelModeSelect')?.value||selectedMode||'roulette'));selectedMode=mode;const wager=Math.max(1000,Math.floor(Number($('duelWagerInput')?.value||current?.wager||1000)));const pending=rnbPendingStart(mode,wager,current);
  try{
   b.disabled=true;window.__duelRequestedModeIntent=mode;startupLine('start requested',{gameId:pending.gameId,mode,wager,profile,reusedCurrent:Boolean(pending.reusedCurrent)});line(botLogs,'start requested',{gameId:pending.gameId,mode,profile});render();
   const data=await rnbAttachBotAtomically(pending.gameId,profile);selectedMode=mode;selectedModeExplicit=false;sessionStorage.removeItem(RNB_PENDING_START_KEY);window.__duelRequestedModeIntent='';if(typeof duelRememberCurrentGame==='function')duelRememberCurrentGame(data.game.gameId);if(typeof duelLastActiveGame!=='undefined')duelLastActiveGame=data.game;if(typeof duelResetReadyUi==='function')duelResetReadyUi(data.game);if(typeof duelRenderActive==='function')duelRenderActive({...data.game,status:'ready'},true);if(typeof duelSetPollRate==='function')duelSetPollRate(data.game);line(botLogs,'attached',{profile:data.remoteNetworkProfile,bot:data.game.joiner?.name,gameId:data.game.gameId,mode});startupLine('Ready screen mounted',{gameId:data.game.gameId,mode});if(typeof duelSetStatus==='function')duelSetStatus('Remote Bot game is ready. Click Ready to begin.','good');render();
  }catch(err){window.__duelRequestedModeIntent='';line(botLogs,'start failed',{gameId:pending.gameId,mode,error:String(err?.message||err)});startupLine('start stopped',{gameId:pending.gameId,mode,error:String(err?.message||err)});if(typeof duelSetStatus==='function')duelSetStatus(err.message||'Unable to start the Remote Network Bot game.','bad');render();
  }finally{b.disabled=false}
 });
`,
  "one-click Remote Bot handler"
);
index = replaceOnce(
  index,
  / const originalFetch=window\.fetch\.bind\(window\);window\.fetch=async\(input,init\)=>\{[^\n]*\n/,
  ` const originalFetch=window.fetch.bind(window);window.fetch=async(input,init)=>{
  const url=typeof input==='string'?input:input?.url||'';let body={},action='';try{body=JSON.parse(init?.body||'{}');action=body.action||''}catch{}const tracked=/duel-action/.test(url);const choice=String(body.choice||'');const lifecycle=tracked&&(['create','create-remote-bot','remote-bot','npc','join','cancel','recover-npc'].includes(action)||(action==='act'&&['ready','rematch','remote-bot-rematch'].includes(choice)));const requestData={action,choice:choice||undefined,gameId:String(body.gameId||''),mode:String(body.mode||'')||undefined};const start=performance.now();if(tracked)line(logs,'request',requestData);if(lifecycle)startupLine('network request',requestData);
  try{const r=await originalFetch(input,init);const responseData={...requestData,status:r.status,ms:Math.round(performance.now()-start)};if(tracked){line(logs,'response',responseData);if(lifecycle)startupLine('network response',responseData);if(action==='get'&&typeof duelLastActiveGame!=='undefined'&&duelLastActiveGame?.remoteNetworkTest)line(botLogs,'network bot poll',{status:r.status,ms:responseData.ms})}return r}catch(err){const failure={...requestData,error:String(err?.message||err),ms:Math.round(performance.now()-start)};if(tracked)line(logs,'network error',failure);if(lifecycle)startupLine('network failure',failure);throw err}finally{render()}
 };
`,
  "lifecycle-aware network diagnostics"
);
index = replaceOnce(
  index,
  "if(kind==='game')base.logs=[...logs];else base.logs=[...botLogs];return JSON.stringify(base,null,2)",
  "if(kind==='game')base.logs=[...logs];else base.logs=[...botLogs];base.startupLogs=[...startupLogs];base.history={recentLimit:RNB_LOG_LIMIT,startupLimit:RNB_STARTUP_LOG_LIMIT,recentCount:base.logs.length,startupCount:startupLogs.length};return JSON.stringify(base,null,2)",
  "debug snapshot startup history"
);
index = replaceOnce(
  index,
  "if(rouletteDebugLines.length>200)rouletteDebugLines.splice(0,rouletteDebugLines.length-200);",
  "if(rouletteDebugLines.length>800)rouletteDebugLines.splice(0,rouletteDebugLines.length-800);",
  "Roulette internal debug retention"
);
index = replaceOnce(
  index,
  "entries.push(item);if(entries.length>200)entries.shift();",
  "entries.push(item);if(entries.length>800)entries.shift();",
  "Roulette debug dock retention"
);

index = replaceOnce(
  index,
  "Enter and verify your Torn API key, then choose one of the five multiplayer games.",
  "Choose one of the five multiplayer games currently in active development.",
  "test launcher description"
);
index = replaceOnce(
  index,
  "#simpleTestHome{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:20px;",
  "#simpleTestHome{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:20px;",
  "scrollable multiplayer launcher"
);
index = index.replace(
  ".sth-card{width:min(520px,100%);padding:26px;",
  ".sth-card{width:min(520px,100%);margin:auto;padding:26px;"
);
index = replaceOnce(
  index,
  "function openGame(mode){if(!confirmed())return;const sel=document.getElementById('duelModeSelect');if(sel){[...sel.options].forEach(o=>{if(!['roulette','draw','fishing','safecracker','mountainrace'].includes(o.value))o.remove()});sel.value=mode;sel.dispatchEvent(new Event('change',{bubbles:true}));}home.hidden=true;if(typeof showDuelGames==='function')showDuelGames();else document.getElementById('duelGameMenuBtn')?.click();document.querySelectorAll('#duelNpcBtn,#duelNpcActiveBtn,#duelRecoverNpcBtn').forEach(e=>e.remove());}",
  `function openGame(mode){\n  if(!confirmed())return;\n  const testModes=Array.isArray(window.GAMBLING_SITE_CATALOG?.multiplayerTestModes)?window.GAMBLING_SITE_CATALOG.multiplayerTestModes:[];\n  if(!testModes.includes(mode))return;\n  // A launcher choice is a navigation intent, not permission for a persisted\n  // game from another mode to reclaim the screen. Server escrow remains intact.\n  if(typeof duelStartNewGame==='function')duelStartNewGame();\n  else if(typeof duelRememberCurrentGame==='function')duelRememberCurrentGame('');\n  home.hidden=true;\n  if(typeof showDuelGames==='function')showDuelGames();else document.getElementById('duelGameMenuBtn')?.click();\n  const sel=document.getElementById('duelModeSelect');\n  if(sel){[...sel.options].forEach(option=>{if(!testModes.includes(option.value))option.remove()});sel.value=mode;sel.dispatchEvent(new Event('change',{bubbles:true}));}\n  if(typeof duelSetStatus==='function')duelSetStatus(\`Selected \${sel?.selectedOptions?.[0]?.textContent||mode}. Choose a wager and create the game.\`,'good');\n  document.querySelectorAll('#duelNpcBtn,#duelNpcActiveBtn,#duelRecoverNpcBtn').forEach(e=>e.remove());\n }`,
  "mode-stable test launcher"
);
index = replaceOnce(
  index,
  "if(typeof duelStartNewGame==='function')duelStartNewGame();",
  "if(typeof duelStartNewGame==='function')duelStartNewGame(mode);",
  "launcher requested-mode intent"
);
index = index.replace(
  ".rnb-games button{min-height:36px;border:0;border-radius:8px;color:white;font-weight:900}",
  ".rnb-games button{min-height:36px;border:0;border-radius:8px;background:#334862;color:white;font-weight:900}"
);
fs.writeFileSync(indexPath, index);

console.log(`Applied ${MARKER}: unified lifecycle, polling, synthetic Ready, and rematches.`);
