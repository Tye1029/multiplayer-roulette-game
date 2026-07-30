import { readFile, writeFile } from 'node:fs/promises';

const indexUrl = new URL('../index.html', import.meta.url);
const guardStart = '// SAFE_CRACKER_SNAPSHOT_GUARD_START';
const guardEnd = '// SAFE_CRACKER_SNAPSHOT_GUARD_END';

function replaceRequired(source, search, replacement, label) {
  if (source.includes(replacement)) return source;
  if (!source.includes(search)) throw new Error(`Safe Cracker snapshot/debug patch could not find ${label}.`);
  return source.replace(search, replacement);
}

function replacePatternRequired(source, pattern, replacement, label) {
  if (source.includes(replacement)) return source;
  if (!pattern.test(source)) throw new Error(`Safe Cracker snapshot/debug patch could not find ${label}.`);
  return source.replace(pattern, replacement);
}

function upsertAfter(source, start, end, block, anchor, label) {
  const escapedStart = start.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedEnd = end.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`${escapedStart}[\\s\\S]*?${escapedEnd}\\s*`, 'm');
  let next = source.replace(pattern, '');
  if (!next.includes(anchor)) throw new Error(`Safe Cracker snapshot/debug patch could not find ${label}.`);
  return next.replace(anchor, `${anchor}\n${block}`);
}

const guardBlock = `${guardStart}
    const safeCrackerAcceptedSnapshotByGame = new Map();
    function safeCrackerSnapshotVersion(game) {
      return {
        statusRank: Number(DUEL_STATUS_RANK[String(game?.status || "waiting")] || 0),
        gameRevision: Math.max(0, Number(game?.revision || 0)),
        stateRevision: Math.max(0, Number(game?.safecrackerState?.revision || 0))
      };
    }
    function safeCrackerAcceptSnapshot(game) {
      if (String(game?.mode || "") !== "safecracker" || !game?.gameId) return true;
      const id = String(game.gameId);
      const incoming = safeCrackerSnapshotVersion(game);
      const accepted = safeCrackerAcceptedSnapshotByGame.get(id);
      if (accepted && (
        incoming.statusRank < accepted.statusRank ||
        incoming.gameRevision < accepted.gameRevision ||
        incoming.stateRevision < accepted.stateRevision
      )) {
        window.__safeCrackerRejectedSnapshots = Number(window.__safeCrackerRejectedSnapshots || 0) + 1;
        return false;
      }
      safeCrackerAcceptedSnapshotByGame.set(id, incoming);
      return true;
    }
    window.__safeCrackerAcceptSnapshot = safeCrackerAcceptSnapshot;
${guardEnd}`;

let html = await readFile(indexUrl, 'utf8');

html = upsertAfter(
  html,
  guardStart,
  guardEnd,
  guardBlock,
  '    const duelAcceptedStatusByGame = new Map();',
  'duel lifecycle snapshot map'
);

html = replaceRequired(
  html,
  '      if (game?.mode === "roulette" && !rouletteAcceptSnapshot(game)) return;',
  '      if (game?.mode === "safecracker" && !safeCrackerAcceptSnapshot(game)) return;\n      if (game?.mode === "roulette" && !rouletteAcceptSnapshot(game)) return;',
  'Safe Cracker render acceptance guard'
);

html = replaceRequired(
  html,
  `              if (got.game.mode === "roulette" && !rouletteAcceptSnapshot(got.game)) {
                active = duelLastActiveGame && String(duelLastActiveGame.gameId) === String(duelCurrentGameId) ? duelLastActiveGame : rouletteLatestGame;
              } else {
                active = got.game;
                duelLastActiveGame = got.game;
              }
              const acceptedRevision = got.syncRevision ?? got.game?.drawState?.revision;`,
  `              if (got.game.mode === "safecracker" && !safeCrackerAcceptSnapshot(got.game)) {
                active = duelLastActiveGame && String(duelLastActiveGame.gameId) === String(duelCurrentGameId) ? duelLastActiveGame : null;
              } else if (got.game.mode === "roulette" && !rouletteAcceptSnapshot(got.game)) {
                active = duelLastActiveGame && String(duelLastActiveGame.gameId) === String(duelCurrentGameId) ? duelLastActiveGame : rouletteLatestGame;
              } else {
                active = got.game;
                duelLastActiveGame = got.game;
              }
              const acceptedRevision = got.syncRevision ?? got.game?.drawState?.revision ?? got.game?.safecrackerState?.revision;`,
  'focused Safe Cracker polling acceptance'
);

html = replaceRequired(
  html,
  `          if(candidate?.mode === "roulette" && duelLastActiveGame?.mode === "roulette") active = candidateRouletteRevision >= acceptedRouletteRevision && rouletteAcceptSnapshot(candidate) ? candidate : duelLastActiveGame;
          else if (!duelLastActiveGame || candidate?.mode !== "draw" || candidateRevision >= acceptedRevision) active = candidate;`,
  `          if(candidate?.mode === "safecracker" && duelLastActiveGame?.mode === "safecracker") active = safeCrackerAcceptSnapshot(candidate) ? candidate : duelLastActiveGame;
          else if(candidate?.mode === "roulette" && duelLastActiveGame?.mode === "roulette") active = candidateRouletteRevision >= acceptedRouletteRevision && rouletteAcceptSnapshot(candidate) ? candidate : duelLastActiveGame;
          else if (!duelLastActiveGame || candidate?.mode !== "draw" || candidateRevision >= acceptedRevision) active = candidate;`,
  'Safe Cracker lobby fallback acceptance'
);

html = replaceRequired(
  html,
  `            const data = await duelRequest("act", { gameId: game.gameId, ...(details || {}) });
            duelLastActiveGame = data.game || duelLastActiveGame;
            if (data.game?.gameId) duelKnownRevisionByGame.set(String(data.game.gameId), String(data.game.safecrackerState?.revision || ""));
            duelRenderActive(data.game, true);
            return data;`,
  `            const data = await duelRequest("act", { gameId: game.gameId, ...(details || {}) });
            const acceptedGame = data.game && safeCrackerAcceptSnapshot(data.game) ? data.game : duelLastActiveGame;
            if (acceptedGame) duelLastActiveGame = acceptedGame;
            if (acceptedGame?.gameId) duelKnownRevisionByGame.set(String(acceptedGame.gameId), String(acceptedGame.safecrackerState?.revision || ""));
            if (acceptedGame) duelRenderActive(acceptedGame, true);
            return acceptedGame === data.game ? data : { ...data, game: acceptedGame };`,
  'Safe Cracker action response acceptance'
);

html = replaceRequired(
  html,
  `  function rnbScheduleRematch(game){`,
  `  const rnbFetchAuthoritativeGameBeforeSafeCrackerGuard=rnbFetchAuthoritativeGame;
  rnbFetchAuthoritativeGame=async function(gameId){
   const previous=typeof duelLastActiveGame!=='undefined'?duelLastActiveGame:null;
   if(previous?.mode==='safecracker'&&typeof window.__safeCrackerAcceptSnapshot==='function')window.__safeCrackerAcceptSnapshot(previous);
   const result=await rnbFetchAuthoritativeGameBeforeSafeCrackerGuard(gameId);
   if(result?.mode==='safecracker'&&typeof window.__safeCrackerAcceptSnapshot==='function'&&!window.__safeCrackerAcceptSnapshot(result)){
    if(typeof duelLastActiveGame!=='undefined')duelLastActiveGame=previous;
    return previous;
   }
   return result;
  };
  function rnbScheduleRematch(game){`,
  'Remote Bot focused Safe Cracker snapshot wrapper'
);

html = replaceRequired(
  html,
  `    if(game.mode==='roulette'){
     if(typeof rouletteAcceptSnapshot==='function'&&!rouletteAcceptSnapshot(game))return current||game;`,
  `    if(game.mode==='safecracker'){
     if(typeof window.__safeCrackerAcceptSnapshot==='function'&&!window.__safeCrackerAcceptSnapshot(game))return current||game;
    }
    if(game.mode==='roulette'){
     if(typeof rouletteAcceptSnapshot==='function'&&!rouletteAcceptSnapshot(game))return current||game;`,
  'shared mutation Safe Cracker snapshot adoption guard'
);

html = replaceRequired(
  html,
  `  function render(){
   const g=(typeof duelLastActiveGame!=='undefined'&&duelLastActiveGame)||(typeof rouletteLatestGame!=='undefined'&&rouletteLatestGame)||null, st=g?.rouletteState||g?.drawState||g?.fishingState||g?.safecrackerState||{};`,
  `  function render(){
   const g=(typeof duelLastActiveGame!=='undefined'&&duelLastActiveGame)||(typeof rouletteLatestGame!=='undefined'&&rouletteLatestGame)||null;
   if(g?.mode)selectedMode=String(g.mode);
   const st=g?.rouletteState||g?.drawState||g?.fishingState||g?.safecrackerState||{};`,
  'debug selected mode synchronization'
);

html = replaceRequired(
  html,
  `  function debugSnapshot(kind){const g=(typeof duelLastActiveGame!=='undefined'&&duelLastActiveGame)||(typeof rouletteLatestGame!=='undefined'&&rouletteLatestGame)||null;const st=g?.rouletteState||g?.drawState||g?.fishingState||g?.safecrackerState||{};const base={capturedAt:new Date().toISOString(),kind,selectedMode,game:g?{gameId:g.gameId,mode:g.mode,status:g.status,revision:g.revision,creator:g.creator,joiner:g.joiner,remoteNetworkTest:g.remoteNetworkTest,remoteNetworkProfile:g.remoteNetworkProfile,npcActionAt:g.npcActionAt,state:st}:null};if(kind==='game')base.logs=[...logs];else base.logs=[...botLogs];return JSON.stringify(base,null,2)}`,
  `  function rnbDebugState(g){
   if(!g)return{};
   if(g.mode!=='safecracker')return g.rouletteState||g.drawState||g.fishingState||{};
   const st=g.safecrackerState&&typeof g.safecrackerState==='object'?g.safecrackerState:{};
   const player=value=>value&&typeof value==='object'?{stage:Number(value.stage||0),attemptCount:Number(value.attemptCount||0),lastTier:String(value.lastTier||''),completed:Boolean(value.completed),completedAt:value.completedAt||null,lastResult:value.lastResult||null,attempts:Array.isArray(value.attempts)?value.attempts:undefined}:null;
   return{roundId:String(st.roundId||''),revision:Number(st.revision||0),startAt:st.startAt||null,endAt:st.endAt||null,secondsLeft:Number(st.secondsLeft||0),canSubmit:Boolean(st.canSubmit),cooldownMs:Number(st.cooldownMs||0),stagesTotal:Number(st.stagesTotal||3),me:player(st.me),opponent:player(st.opponent),revealedCodes:g.status==='complete'?st.revealedCodes:undefined,rejectedSnapshots:Number(window.__safeCrackerRejectedSnapshots||0)};
  }
  function debugSnapshot(kind){const g=(typeof duelLastActiveGame!=='undefined'&&duelLastActiveGame)||(typeof rouletteLatestGame!=='undefined'&&rouletteLatestGame)||null;if(g?.mode)selectedMode=String(g.mode);const st=rnbDebugState(g);const base={capturedAt:new Date().toISOString(),kind,selectedMode,game:g?{gameId:g.gameId,mode:g.mode,status:g.status,revision:g.revision,creator:g.creator,joiner:g.joiner,remoteNetworkTest:g.remoteNetworkTest,remoteNetworkProfile:g.remoteNetworkProfile,npcActionAt:g.npcActionAt,state:st}:null};if(kind==='game')base.logs=[...logs];else base.logs=[...botLogs];return JSON.stringify(base,null,2)}`,
  'redacted Safe Cracker debug state'
);

html = replaceRequired(
  html,
  `      const completedAwaitingRematch = Boolean(game && game.status === "complete" && ["draw", "fishing", "roulette"].includes(String(game.mode || "")));
      const noFocusedGame = !game && !duelCurrentGameId;`,
  `      const completedAwaitingRematch = Boolean(game && game.status === "complete" && ["draw", "fishing", "roulette"].includes(String(game.mode || "")));
      const safeCrackerCompleted = Boolean(game && game.mode === "safecracker" && game.status === "complete");
      const noFocusedGame = !game && !duelCurrentGameId;`,
  'completed Safe Cracker poll-rate state'
);

html = replaceRequired(
  html,
  `      const desired = sharedLifecycleLive ? 200 : drawPlaying ? 650 : rouletteLive ? 800 : fishingLive ? 450 : completedAwaitingRematch ? 700 : noFocusedGame ? 750 : 1800;`,
  `      const desired = sharedLifecycleLive ? 200 : drawPlaying ? 650 : rouletteLive ? 800 : fishingLive ? 450 : completedAwaitingRematch ? 700 : safeCrackerCompleted ? 5000 : noFocusedGame ? 750 : 1800;`,
  'completed Safe Cracker poll-rate backoff'
);

html = replaceRequired(
  html,
  `  const rnbRematchRuntime={gameId:'',timer:0,requesting:false,handledKey:'',monitoring:false,lastFocusedFetchAt:0};`,
  `  const rnbRematchRuntime={gameId:'',timer:0,requesting:false,handledKey:'',monitoring:false,lastFocusedFetchAt:0,lastCompleteFetchAt:0};`,
  'Remote Bot completed polling timestamp'
);

html = replaceRequired(
  html,
  `   if(g?.remoteNetworkTest&&g.status==='complete')g=await rnbFetchAuthoritativeGame(String(g.gameId||''))||g;
   rnbScheduleRematch(g);`,
  `   if(g?.remoteNetworkTest&&g.status==='complete'){
    const rem=g.rematch&&typeof g.rematch==='object'?g.rematch:{};
    const urgent=Boolean(g.rematchGameId)||(rem.requestedBy&&Object.keys(rem.requestedBy).length>0);
    const interval=g.mode==='safecracker'&&!urgent?5000:650;
    if(Date.now()-rnbRematchRuntime.lastCompleteFetchAt>=interval){rnbRematchRuntime.lastCompleteFetchAt=Date.now();g=await rnbFetchAuthoritativeGame(String(g.gameId||''))||g}
   }
   rnbScheduleRematch(g);`,
  'completed Safe Cracker polling backoff'
);

await writeFile(indexUrl, html);
console.log('Patched Safe Cracker monotonic snapshots, synced debug mode/state, and completed polling backoff.');
