import { readFile, writeFile } from 'node:fs/promises';

const indexUrl = new URL('../index.html', import.meta.url);
const dataUrl = new URL('../netlify/functions/_data.js', import.meta.url);
let html = await readFile(indexUrl, 'utf8');
let data = await readFile(dataUrl, 'utf8');

function replaceOnce(source, label, before, after) {
  if (source.includes(after)) return source;
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Multiplayer network cleanup could not find ${label}.`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Multiplayer network cleanup found more than one ${label}.`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

function replaceSection(source, label, startMarker, endMarker, replacement) {
  if (source.includes(replacement)) return source;
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error(`Multiplayer network cleanup could not find ${label}.`);
  return source.slice(0, start) + replacement + source.slice(end);
}

html = replaceOnce(
  html,
  'the lobby cache state',
  `    let duelCachedGames = [];
    let duelLastLobbyFetchAt = 0;
    let duelLastActiveGame = null;`,
  `    let duelCachedGames = [];
    let duelLastLobbyFetchAt = 0;
    let duelLobbyLoaded = false;
    let duelLastActiveGame = null;`
);

html = replaceOnce(
  html,
  'the lobby refresh gate',
  `        const focusedGameOpen = Boolean(duelCurrentGameId);
        const lobbyRefreshAge = focusedGameOpen ? 15000 : 1200;
        const needLobby = !duelCachedGames.length || !focusedGameOpen || now - duelLastLobbyFetchAt >= lobbyRefreshAge;
        let listData = null;
        if (needLobby) {
          listData = await duelRequest("list");
          if (refreshSequence !== duelRefreshSequence) return;
          duelCachedGames = Array.isArray(listData.games) ? listData.games : [];
          duelLastLobbyFetchAt = now;`,
  `        const focusedGameOpen = Boolean(duelCurrentGameId);
        const lobbyRefreshAge = 5000;
        // A focused match is refreshed only through its exact game ID. The full
        // lobby scan is intentionally paused so a slow list response can never
        // delay or race the active game's authoritative get response.
        const needLobby = !focusedGameOpen && (!duelLobbyLoaded || now - duelLastLobbyFetchAt >= lobbyRefreshAge);
        let listData = null;
        if (needLobby) {
          listData = await duelRequest("list");
          if (refreshSequence !== duelRefreshSequence) return;
          duelCachedGames = Array.isArray(listData.games) ? listData.games : [];
          duelLobbyLoaded = true;
          duelLastLobbyFetchAt = Date.now();`
);

if (!html.includes('// MULTIPLAYER_COHESION_V6') || !html.includes('noFocusedGame ? 2000 : 1800')) {
  html = replaceOnce(
    html,
    'the idle lobby poll rate',
    `const desired = sharedLifecycleLive ? 200 : drawPlaying ? 650 : rouletteLive ? 800 : fishingLive ? 450 : completedAwaitingRematch ? 700 : noFocusedGame ? 750 : 1800;`,
    `const desired = sharedLifecycleLive ? 200 : drawPlaying ? 650 : rouletteLive ? 800 : fishingLive ? 450 : completedAwaitingRematch ? 700 : noFocusedGame ? 2000 : 1800;`
  );
}

if (!html.includes('revisionKey=[gameRevision,stateRevision')) html = replaceOnce(
  html,
  'the Remote Bot debug revision state',
  `const logs=[],botLogs=[]; let selectedMode='roulette',lastGameId='',lastRevision=-1;`,
  `const logs=[],botLogs=[]; let selectedMode='roulette',lastGameId='',lastRevisionKey='';`
);

if (!html.includes('<b>Game revision</b>')) html = replaceOnce(
  html,
  'the Remote Bot debug revision display',
  `<b>Revision</b><span>\${st?.revision??g?.revision??'—'}</span>`,
  `<b>Game revision</b><span>\${g?.revision??'—'}</span><b>State revision</b><span>\${st?.revision??'—'}</span>`
);

if (!html.includes('revisionKey=[gameRevision,stateRevision')) html = replaceOnce(
  html,
  'the Remote Bot state log revision',
  `if(g){const rev=Number(st?.revision??g?.revision??0);if(g.gameId!==lastGameId||rev!==lastRevision){line(logs,'state',{mode:g.mode,status:g.status,revision:rev,turnId:st?.turnId,lastAction:st?.lastAction});lastGameId=g.gameId;lastRevision=rev}}`,
  `if(g){const gameRevision=Number(g?.revision??-1),stateRevision=Number(st?.revision??-1),revisionKey=[gameRevision,stateRevision,String(g.status||'')].join(':');if(g.gameId!==lastGameId||revisionKey!==lastRevisionKey){line(logs,'state',{mode:g.mode,status:g.status,gameRevision,stateRevision,turnId:st?.turnId,lastAction:st?.lastAction});lastGameId=g.gameId;lastRevisionKey=revisionKey}}`
);

const adoptionBlock = `  function rnbStateRevision(game){
   const state=game?.rouletteState||game?.drawState||game?.fishingState||{};
   return Number(state?.revision??-1);
  }
  function rnbSnapshotStamp(game){return {gameRevision:Number(game?.revision??-1),stateRevision:rnbStateRevision(game),updatedAt:Date.parse(String(game?.updatedAt||''))||0}}
  function rnbCompareSnapshots(left,right){
   const a=rnbSnapshotStamp(left),b=rnbSnapshotStamp(right);
   if(a.gameRevision!==b.gameRevision)return a.gameRevision-b.gameRevision;
   if(a.stateRevision!==b.stateRevision)return a.stateRevision-b.stateRevision;
   return a.updatedAt-b.updatedAt;
  }
  function rnbCurrentGame(gameId){
   const id=String(gameId||''),candidates=[];
   try{if(typeof duelLastActiveGame!=='undefined'&&String(duelLastActiveGame?.gameId||'')===id)candidates.push(duelLastActiveGame)}catch{}
   try{if(typeof rouletteLatestGame!=='undefined'&&String(rouletteLatestGame?.gameId||'')===id)candidates.push(rouletteLatestGame)}catch{}
   return candidates.reduce((newest,game)=>!newest||rnbCompareSnapshots(game,newest)>0?game:newest,null);
  }
  function rnbAdoptGame(game,force=false){
   if(!game?.gameId)return null;
   const current=rnbCurrentGame(game.gameId);
   if(current&&rnbCompareSnapshots(game,current)<0){
    line(botLogs,'ignored stale game snapshot',{gameId:String(game.gameId),incoming:rnbSnapshotStamp(game),accepted:rnbSnapshotStamp(current)});
    return current;
   }
   if(game.mode==='roulette'&&typeof rouletteAcceptSnapshot==='function'&&!rouletteAcceptSnapshot(game)){
    line(botLogs,'ignored rejected roulette snapshot',{gameId:String(game.gameId),incoming:rnbSnapshotStamp(game)});
    return current;
   }
   const adopted=game.mode==='roulette'&&typeof rouletteNormalizeSnapshot==='function'?rouletteNormalizeSnapshot(game):game;
   if(typeof duelRememberCurrentGame==='function')duelRememberCurrentGame(String(adopted.gameId));
   if(typeof duelLastActiveGame!=='undefined')duelLastActiveGame=adopted;
   if(adopted.mode==='roulette'&&typeof rouletteLatestGame!=='undefined')rouletteLatestGame=adopted;
   if(force&&typeof duelRenderActive==='function'){duelLastRenderKey='';duelRenderActive(adopted,true)}
   return adopted;
  }
`;

html = replaceSection(
  html,
  'the Remote Bot snapshot adoption helper',
  `function rnbAdoptGame(game,force=false){`,
  `async function rnbFetchAuthoritativeGame(gameId){`,
  adoptionBlock
);

if (!html.includes('async function rnbAttachBotAtomically')) {
  html = replaceOnce(
    html,
    'the Remote Bot attach response adoption',
    `$('rnbAddBot').addEventListener('click',async()=>{const b=$('rnbAddBot');try{const gameId=String((typeof duelLastActiveGame!=='undefined'&&duelLastActiveGame?.gameId)||(typeof duelCurrentGameId!=='undefined'&&duelCurrentGameId)||'');if(!gameId)throw new Error('Create a game first.');b.disabled=true;const profile=$('rnbProfile').value;line(botLogs,'attach requested',{gameId,profile});render();const data=await duelRequest('remote-bot',{gameId,profile});if(!data?.game)throw new Error('Server did not return the updated game.');if(typeof duelRememberCurrentGame==='function')duelRememberCurrentGame(data.game.gameId);if(typeof duelLastActiveGame!=='undefined')duelLastActiveGame=data.game;if(typeof duelResetReadyUi==='function')duelResetReadyUi(data.game);if(typeof duelRenderActive==='function')duelRenderActive({...data.game,status:'ready'},true);if(typeof duelSetPollRate==='function')duelSetPollRate(data.game);line(botLogs,'attached',{profile:data.remoteNetworkProfile,bot:data.game.joiner?.name});render()}catch(err){line(botLogs,'attach failed',{error:String(err?.message||err)});if(typeof duelSetStatus==='function')duelSetStatus(err.message||'Unable to add Remote Network Bot.','bad');render()}finally{b.disabled=false}});`,
    `$('rnbAddBot').addEventListener('click',async()=>{const b=$('rnbAddBot');try{const gameId=String((typeof duelLastActiveGame!=='undefined'&&duelLastActiveGame?.gameId)||(typeof duelCurrentGameId!=='undefined'&&duelCurrentGameId)||'');if(!gameId)throw new Error('Create a game first.');b.disabled=true;const profile=$('rnbProfile').value;line(botLogs,'attach requested',{gameId,profile});render();const data=await duelRequest('remote-bot',{gameId,profile});if(!data?.game)throw new Error('Server did not return the updated game.');const adopted=rnbAdoptGame(data.game,true);if(!adopted)throw new Error('The Remote Bot response could not be adopted.');if(typeof duelResetReadyUi==='function')duelResetReadyUi(adopted);if(typeof duelSetPollRate==='function')duelSetPollRate(adopted);line(botLogs,'attached',{profile:data.remoteNetworkProfile,bot:adopted.joiner?.name,gameRevision:Number(adopted.revision??-1),stateRevision:rnbStateRevision(adopted)});render()}catch(err){line(botLogs,'attach failed',{error:String(err?.message||err)});if(typeof duelSetStatus==='function')duelSetStatus(err.message||'Unable to add Remote Network Bot.','bad');render()}finally{b.disabled=false}});`
  );
}

html = replaceOnce(
  html,
  'the focused Remote Bot get adoption',
  `if(data?.game){rnbAdoptGame(data.game,false);return data.game}`,
  `if(data?.game){const adopted=rnbAdoptGame(data.game,false);if(adopted)return adopted}`
);

data = replaceOnce(
  data,
  'the completed Roulette turn flag',
  `isMyTurn:cleanUserId(st.turnId)===id,`,
  `isMyTurn:game?.status==="playing"&&cleanUserId(st.turnId)===id,`
);

const optimizedList = `async function duelListGames(user) {
  await duelEnsureSchemaMigration();
  const viewer = cleanUserId(user.id);
  const store = getUsersStore();
  const games = [];
  const recordPromise = getUserRecord(viewer);
  try {
    const listed = await store.list({ prefix: DUEL_GAME_PREFIX });
    const entries = Array.isArray(listed?.blobs) ? listed.blobs : [];
    const batchSize = 8;
    for (let offset = 0; offset < entries.length; offset += batchSize) {
      const batch = await Promise.all(entries.slice(offset, offset + batchSize).map(async entry => {
        try {
          const game = await store.get(entry.key, { type: "json" });
          if (!game) return null;
          let clean = duelSanitizeGame(game);
          if (duelIsActiveStatus(clean.status) && (duelIsExpired(clean) || !duelHasValidSchema(clean))) {
            clean = await duelInvalidateLegacyGame(clean, "Expired or incompatible multiplayer game state.");
          }
          if (["ready", "countdown"].includes(clean.status)) {
            const normalized = duelNormalizeReadyState(clean);
            if (JSON.stringify(normalized) !== JSON.stringify(clean)) clean = await duelSaveGame(normalized);
          }
          if (!["waiting", "ready", "countdown", "playing", "complete"].includes(clean.status)) return null;
          const viewerIsPlayer = clean.creator?.userId === viewer || clean.joiner?.userId === viewer;
          if (clean.mode === "draw" && clean.status === "playing" && viewerIsPlayer) {
            try {
              const databaseState = await drawDatabaseState(clean, { runNpc: true });
              clean = { ...clean, drawState: databaseState };
              clean = await drawMaybeCompleteDatabase(clean);
            } catch (error) {
              console.error("[duel list draw hydrate]", error.message || error);
              return null;
            }
          }
          if (clean.mode === "fishing" && clean.status === "playing" && viewerIsPlayer) {
            try {
              const databaseState = await fishingDatabaseState(clean, { runNpc: true });
              clean = { ...clean, fishingState: databaseState };
              clean = await fishingMaybeCompleteDatabase(clean);
            } catch (error) {
              console.error("[duel list fishing hydrate]", error.message || error);
              return null;
            }
          }
          return duelPublicGame(clean, viewer);
        } catch {
          return null;
        }
      }));
      for (const publicGame of batch) if (publicGame) games.push(publicGame);
    }
  } catch {}
  games.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  return { games: games.slice(0, 40), record: await recordPromise };
}

`;

data = replaceSection(
  data,
  'the serial multiplayer lobby scan',
  `async function duelListGames(user) {`,
  `async function duelFindActiveFishingGameForUser`,
  optimizedList
);

for (const required of [
  'let duelLobbyLoaded = false;',
  'const needLobby = !focusedGameOpen && (!duelLobbyLoaded',
  'const lobbyRefreshAge = 5000;',
  'noFocusedGame ? 2000',
  'function rnbCompareSnapshots(left,right)',
  "line(botLogs,'ignored stale game snapshot'",
  '<b>Game revision</b>',
  '<b>State revision</b>'
]) {
  if (!html.includes(required)) throw new Error(`Final multiplayer client cleanup is missing ${required}`);
}
for (const forbidden of [
  'const lobbyRefreshAge = focusedGameOpen ? 15000 : 1200;',
  '!duelCachedGames.length || !focusedGameOpen',
  "lastRevision=-1",
  "if(data?.game){rnbAdoptGame(data.game,false);return data.game}"
]) {
  if (html.includes(forbidden)) throw new Error(`Old multiplayer client behavior remains: ${forbidden}`);
}
for (const required of [
  'isMyTurn:game?.status==="playing"&&cleanUserId(st.turnId)===id',
  'const recordPromise = getUserRecord(viewer);',
  'const batchSize = 8;',
  'Promise.all(entries.slice(offset, offset + batchSize).map'
]) {
  if (!data.includes(required)) throw new Error(`Final multiplayer server cleanup is missing ${required}`);
}

await writeFile(indexUrl, html);
await writeFile(dataUrl, data);
console.log('Patched multiplayer networking: stale bot snapshots rejected, completed turns cleared, lobby polling isolated, and Blob listing batched.');
