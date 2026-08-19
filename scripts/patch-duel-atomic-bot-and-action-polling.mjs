import { readFile, writeFile } from 'node:fs/promises';

const indexUrl = new URL('../index.html', import.meta.url);
const dataUrl = new URL('../netlify/functions/_data.js', import.meta.url);
const actionUrl = new URL('../netlify/functions/duel-action.js', import.meta.url);
let html = await readFile(indexUrl, 'utf8');
let data = await readFile(dataUrl, 'utf8');
let action = await readFile(actionUrl, 'utf8');

function replaceOnce(source, label, before, after) {
  if (source.includes(after)) return source;
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Atomic bot/action polling patch could not find ${label}.`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Atomic bot/action polling patch found more than one ${label}.`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

function replaceSection(source, label, startMarker, endMarker, replacement) {
  if (source.includes(replacement)) return source;
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0 || end <= start) {
    throw new Error(`Atomic bot/action polling patch could not isolate ${label}.`);
  }
  return source.slice(0, start) + replacement + source.slice(end);
}

const atomicServerBlock = `function duelRemoteBotProfileConfig(profile = "normal") {
  const profiles = {
    normal:{label:"Normal",minDelayMs:100,maxDelayMs:400,stallChance:0,duplicateChance:0,reconnectChance:0},
    mobile:{label:"Mobile",minDelayMs:300,maxDelayMs:1500,stallChance:.08,duplicateChance:.02,reconnectChance:.04},
    bad:{label:"Bad Connection",minDelayMs:500,maxDelayMs:3000,stallChance:.18,duplicateChance:.08,reconnectChance:.12},
    stress:{label:"Stress Test",minDelayMs:100,maxDelayMs:3500,stallChance:.25,duplicateChance:.18,reconnectChance:.18}
  };
  const key = Object.prototype.hasOwnProperty.call(profiles, String(profile)) ? String(profile) : "normal";
  return { key, network: profiles[key] };
}

function duelRebuildWaitingGameFromCreateResult(user, requestedMode, requestedWager, publicGame = {}) {
  const mode = String(publicGame.mode || requestedMode || "").toLowerCase();
  const wager = int(publicGame.wager, int(requestedWager, 0));
  const gameId = mpCleanId(publicGame.gameId || "");
  if (!gameId || !DUEL_MODES[mode]) return null;
  const at = String(publicGame.createdAt || publicGame.updatedAt || nowIso());
  return duelSanitizeGame({
    schemaVersion: DUEL_SCHEMA_VERSION,
    gameId,
    mode,
    modeName: DUEL_MODES[mode],
    status: String(publicGame.status || "waiting"),
    wager,
    pot: int(publicGame.pot, wager),
    createdAt: at,
    updatedAt: String(publicGame.updatedAt || at),
    creator: duelSanitizePlayer(publicGame.creator || { userId: user.id, name: user.name || "Unknown", tornId: user.tornId || user.id, avatarUrl: user.avatarUrl }),
    joiner: publicGame.joiner ? duelSanitizePlayer(publicGame.joiner) : null,
    actions: {},
    ledgerIds: { creator: \`duel:\${gameId}:creator-escrow\` }
  });
}

async function duelCreateRemoteNetworkBotGame(user, details = {}) {
  const viewer = cleanUserId(user.id);
  const mode = String(details.mode || "roulette").toLowerCase();
  const wager = int(details.wager, 0);
  const clientGameId = duelClientCreateGameId(mode, details.clientGameId || details.gameId || "");
  if (!clientGameId) throw new Error("The game request ID was invalid. Create the duel again.");

  let createResult = null;
  let game = await duelGetRawStrong(clientGameId, 1);
  if (!game) {
    createResult = await duelCreateGame(user, { mode, wager, clientGameId });
    const createdId = mpCleanId(createResult?.game?.gameId || clientGameId);
    game = await duelGetRawStrong(createdId, 1);
    if (!game) game = duelRebuildWaitingGameFromCreateResult(user, mode, wager, createResult?.game || {});
  }
  if (!game) throw new Error("The duel could not be created for the Remote Network Bot.");
  if (cleanUserId(game.creator?.userId) !== viewer) throw new Error("Only the creator can add the Remote Network Bot.");
  if (!["roulette", "draw", "fishing"].includes(String(game.mode || ""))) throw new Error("Remote Network Bot supports Roulette, Draw, and Fishing.");

  const { key, network } = duelRemoteBotProfileConfig(details.profile);
  const existingRemoteBot = String(game.joiner?.userId || "").startsWith("remote-bot-");
  if (existingRemoteBot) {
    return {
      game: duelPublicGame(game, viewer),
      record: await getUserRecord(viewer),
      remoteNetworkProfile: key,
      remoteNetworkConfig: network,
      recoveredExistingBot: true,
      recoveredCreate: Boolean(createResult?.recoveredCreate)
    };
  }
  if (game.status !== "waiting" || game.joiner) throw new Error("The Remote Network Bot can only join a waiting duel.");

  const botId = \`remote-bot-\${game.mode}-\${crypto.randomBytes(4).toString("hex")}\`;
  const bot = duelSanitizePlayer({
    userId: botId,
    name: \`Remote Bot (\${network.label})\`,
    tornId: botId,
    avatarUrl: "",
    isNpc: true,
    isRemoteBot: true,
    isTestPlayer: false
  });
  game = await duelSaveGame({
    ...game,
    status: "ready",
    pot: game.wager,
    npcTest: true,
    remoteNetworkTest: true,
    remoteNetworkProfile: key,
    remoteNetworkConfig: network,
    testPlayerMode: false,
    testControllerUserId: "",
    joiner: bot,
    ready: { [game.creator.userId]: false, [bot.userId]: false },
    readyWindowStartedAt: null,
    readyDeadlineAt: null,
    countdownStartedAt: null,
    startAt: null,
    npcReadyAt: null,
    npcActionAt: null,
    actions: {},
    blackjackState: null,
    drawState: null,
    fishingState: null,
    rouletteState: null,
    ledgerIds: { ...(game.ledgerIds || {}), creator: game.ledgerIds?.creator || \`duel:\${game.gameId}:creator-escrow\`, npc: \`duel:\${game.gameId}:remote-\${game.mode}-bot\` }
  });
  return {
    game: duelPublicGame(game, viewer),
    record: await getUserRecord(viewer),
    remoteNetworkProfile: key,
    remoteNetworkConfig: network,
    atomicCreateAndAttach: true,
    recoveredCreate: Boolean(createResult?.recoveredCreate)
  };
}

`;

if (!data.includes('async function duelCreateRemoteNetworkBotGame(user, details = {})')) {
  const marker = 'async function duelActionGame(user, gameId, details = {}) {';
  const at = data.indexOf(marker);
  if (at < 0) throw new Error('Atomic bot/action polling patch could not find the duel action function.');
  data = data.slice(0, at) + atomicServerBlock + data.slice(at);
}

data = replaceOnce(
  data,
  'the Remote Bot server export',
  `  duelAddRemoteNetworkBot,\n  duelActionGame,`,
  `  duelAddRemoteNetworkBot,\n  duelCreateRemoteNetworkBotGame,\n  duelActionGame,`
);

action = replaceOnce(
  action,
  'the Remote Bot function import',
  `  duelAddRemoteNetworkBot,\n  duelActionGame`,
  `  duelAddRemoteNetworkBot,\n  duelCreateRemoteNetworkBotGame,\n  duelActionGame`
);

action = replaceOnce(
  action,
  'the atomic Remote Bot action handler',
  `    else if (action === "remote-bot") result = await duelAddRemoteNetworkBot(user, body.gameId, body.profile);\n    else if (action === "act")`,
  `    else if (action === "remote-bot") result = await duelAddRemoteNetworkBot(user, body.gameId, body.profile);\n    else if (action === "create-remote-bot") result = await duelCreateRemoteNetworkBotGame(user, { gameId: body.gameId, clientGameId: body.clientGameId, mode: body.mode, wager: body.wager, profile: body.profile });\n    else if (action === "act")`
);

html = replaceOnce(
  html,
  'the atomic Remote Bot timeout',
  `      const timeoutMs = action === "create" ? 30000 : 10000;`,
  `      const timeoutMs = ["create", "create-remote-bot"].includes(action) ? 30000 : 10000;`
);

const atomicClientHelper = `  async function rnbAttachBotAtomically(gameId,profile){
    const current=rnbCurrentGame(gameId)||(typeof duelLastActiveGame!=='undefined'?duelLastActiveGame:null);
    const mode=String(current?.mode||selectedMode||'roulette');
    const wager=Math.max(0,Math.floor(Number(current?.wager||0)));
    if(!current||String(current.gameId||'')!==String(gameId||''))throw new Error('The current duel is not ready for a Remote Bot.');
    if(!mode||!wager)throw new Error('The current duel details are incomplete.');
    return await duelRequest('create-remote-bot',{gameId,clientGameId:gameId,mode,wager,profile});
   }
`;

html = replaceSection(
  html,
  'the retrying Remote Bot helper',
  `  async function rnbAttachBotWithRetry(gameId,profile){`,
  `  $('rnbAddBot').addEventListener('click'`,
  atomicClientHelper
);

html = replaceOnce(
  html,
  'the Remote Bot atomic client call',
  `const data=await rnbAttachBotWithRetry(gameId,profile);`,
  `const data=await rnbAttachBotAtomically(gameId,profile);`
);

html = replaceOnce(
  html,
  'the focused refresh mutation guard',
  `    async function duelRefresh(silent = false) {\n      if (!duelScreen || duelScreen.hidden || document.hidden) return;`,
  `    async function duelRefresh(silent = false) {\n      if (!duelScreen || duelScreen.hidden || document.hidden || Number(window.__duelMutationRequestsInFlight || 0) > 0) return;`
);

const mutationWrapper = `  const duelRequestBeforeMutationPause=duelRequest;
  const duelMutationActions=new Set(['act','create','create-remote-bot','remote-bot','npc','join','cancel','recover-npc']);
  let duelMutationResumeTimer=0;
  window.__duelMutationRequestsInFlight=0;
  function duelPausePollingForMutation(){
   if(duelPollTimer){clearInterval(duelPollTimer);duelPollTimer=null}
   window.__duelPollRate=0;
  }
  function duelAdoptMutationResponseGame(game){
   if(!game?.gameId)return game;
   const current=typeof duelLastActiveGame!=='undefined'?duelLastActiveGame:null;
   if(current&&String(current.gameId||'')===String(game.gameId||'')&&Number(game.revision??-1)<Number(current.revision??-1))return current;
   let adopted=game;
   if(game.mode==='roulette'){
    if(typeof rouletteAcceptSnapshot==='function'&&!rouletteAcceptSnapshot(game))return current||game;
    if(typeof rouletteNormalizeSnapshot==='function')adopted=rouletteNormalizeSnapshot(game);
    if(typeof rouletteLatestGame!=='undefined')rouletteLatestGame=adopted;
   }
   if(typeof duelRememberCurrentGame==='function')duelRememberCurrentGame(String(adopted.gameId));
   if(typeof duelLastActiveGame!=='undefined')duelLastActiveGame=adopted;
   return adopted;
  }
  duelRequest=async function(action,payload={}){
   const mutation=duelMutationActions.has(String(action||''));
   if(mutation){window.__duelMutationRequestsInFlight=Number(window.__duelMutationRequestsInFlight||0)+1;duelPausePollingForMutation()}
   try{
    const data=await duelRequestBeforeMutationPause(action,payload);
    if(mutation&&data?.game)data.game=duelAdoptMutationResponseGame(data.game);
    return data;
   }finally{
    if(mutation){
     window.__duelMutationRequestsInFlight=Math.max(0,Number(window.__duelMutationRequestsInFlight||0)-1);
     clearTimeout(duelMutationResumeTimer);
     duelMutationResumeTimer=setTimeout(()=>{
      if(Number(window.__duelMutationRequestsInFlight||0)>0)return;
      if(typeof duelSetPollRate==='function')duelSetPollRate(typeof duelLastActiveGame!=='undefined'?duelLastActiveGame:null);
     },0);
    }
   }
  };
`;

if (!html.includes('const duelRequestBeforeMutationPause=duelRequest;')) {
  const marker = 'const originalFetch=';
  const at = html.indexOf(marker);
  if (at < 0) throw new Error('Atomic bot/action polling patch could not find the multiplayer request wrapper insertion point.');
  const lineStart = html.lastIndexOf('\n', at) + 1;
  html = html.slice(0, lineStart) + mutationWrapper + html.slice(lineStart);
}

for (const required of [
  'async function duelCreateRemoteNetworkBotGame(user, details = {})',
  'duelRebuildWaitingGameFromCreateResult',
  'atomicCreateAndAttach: true',
  'duelCreateRemoteNetworkBotGame,',
  'action === "create-remote-bot"'
]) if (!data.includes(required) && !action.includes(required)) throw new Error(`Atomic Remote Bot server patch is missing ${required}`);

for (const required of [
  'async function rnbAttachBotAtomically(gameId,profile)',
  "duelRequest('create-remote-bot'",
  'const duelRequestBeforeMutationPause=duelRequest;',
  'window.__duelMutationRequestsInFlight',
  'duelPausePollingForMutation()',
  'duelAdoptMutationResponseGame(data.game)',
  'Number(window.__duelMutationRequestsInFlight || 0) > 0'
]) if (!html.includes(required)) throw new Error(`Atomic Remote Bot/action polling client patch is missing ${required}`);

for (const forbidden of [
  'async function rnbAttachBotWithRetry(gameId,profile)',
  'const delays=[0,900,1500,2200,3000,3500];',
  "line(botLogs,'attach retry scheduled'"
]) if (html.includes(forbidden)) throw new Error(`Old Remote Bot retry behavior remains: ${forbidden}`);

await writeFile(indexUrl, html);
await writeFile(dataUrl, data);
await writeFile(actionUrl, action);
console.log('Patched Remote Bot attachment to create/recover and attach atomically, and paused focused polling while mutations are in flight.');
