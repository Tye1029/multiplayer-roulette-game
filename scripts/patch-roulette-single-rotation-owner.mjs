import { readFile, writeFile } from 'node:fs/promises';

const indexUrl = new URL('../index.html', import.meta.url);
let html = await readFile(indexUrl, 'utf8');

function replaceOnce(source, label, before, after) {
  if (source.includes(after)) return source;
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Single rotation-owner patch could not find ${label}.`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Single rotation-owner patch found more than one ${label}.`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

html = replaceOnce(
  html,
  'the shot-followup rotation path',
  `      if(effectIsNew&&st.lastAction==='shoot'){
        rouletteVisualRuntime.processed.add(effectKey);
        const nextTurnId=turnChanged&&game.status==='playing'?incomingTurnId:'';
        rouletteQueueVisual(async()=>{
          await rouletteShotSequence(game,st,gameId);
          if(nextTurnId)await rouletteRotateToTurn(game,st,gameId,{duration:900,targetTurnId:nextTurnId});
        });
        return;
      }`,
  `      if(effectIsNew&&st.lastAction==='shoot'){
        rouletteVisualRuntime.processed.add(effectKey);
        // Shot visuals own recoil and hammer movement only. The authoritative
        // facing guard observes any real turn change after the shot completes.
        rouletteQueueVisual(()=>rouletteShotSequence(game,st,gameId));
        return;
      }`
);

html = replaceOnce(
  html,
  'the pass-owned rotation path',
  `      // Pass is the only non-shot action that ends a turn. A cylinder spin,
      // trigger pull that keeps the same turn, polling response, or remount
      // cannot move the revolver.
      if(turnChanged&&st.lastAction==='pass'){
        rouletteQueueVisual(()=>rouletteRotateToTurn(game,st,gameId,{duration:900,targetTurnId:incomingTurnId}));
      }
`,
  `      // Direction changes are owned exclusively by turn-facing-guard.js.
      // Pass, shoot, polling, and rerenders only publish authoritative state.
`
);

html = replaceOnce(
  html,
  'the debug snapshot export',
  ` function debugSnapshot(kind){const g=(typeof duelLastActiveGame!=='undefined'&&duelLastActiveGame)||(typeof rouletteLatestGame!=='undefined'&&rouletteLatestGame)||null;const st=g?.rouletteState||g?.drawState||g?.fishingState||{};const base={capturedAt:new Date().toISOString(),kind,selectedMode,game:g?{gameId:g.gameId,mode:g.mode,status:g.status,revision:g.revision,creator:g.creator,joiner:g.joiner,remoteNetworkTest:g.remoteNetworkTest,remoteNetworkProfile:g.remoteNetworkProfile,npcActionAt:g.npcActionAt,state:st}:null};if(kind==='game')base.logs=[...logs];else base.logs=[...botLogs];return JSON.stringify(base,null,2)}`,
  ` window.addEventListener('roulette-facing-diagnostic',event=>{line(logs,'rotation',event?.detail||{});render()});
 function debugSnapshot(kind){const g=(typeof duelLastActiveGame!=='undefined'&&duelLastActiveGame)||(typeof rouletteLatestGame!=='undefined'&&rouletteLatestGame)||null;const st=g?.rouletteState||g?.drawState||g?.fishingState||{};const rotationDiagnostics=Array.isArray(window.__rouletteFacingDiagnostics)?window.__rouletteFacingDiagnostics.slice(-120):[];const base={capturedAt:new Date().toISOString(),kind,selectedMode,game:g?{gameId:g.gameId,mode:g.mode,status:g.status,revision:g.revision,creator:g.creator,joiner:g.joiner,remoteNetworkTest:g.remoteNetworkTest,remoteNetworkProfile:g.remoteNetworkProfile,npcActionAt:g.npcActionAt,state:st}:null,rotationDiagnostics};if(kind==='game')base.logs=[...logs];else base.logs=[...botLogs];return JSON.stringify(base,null,2)}`
);

for (const required of [
  'Shot visuals own recoil and hammer movement only.',
  'Direction changes are owned exclusively by turn-facing-guard.js.',
  "window.addEventListener('roulette-facing-diagnostic'",
  'rotationDiagnostics=Array.isArray(window.__rouletteFacingDiagnostics)'
]) {
  if (!html.includes(required)) throw new Error(`Single rotation-owner output is missing ${required}`);
}

for (const forbidden of [
  'if(nextTurnId)await rouletteRotateToTurn',
  "rouletteQueueVisual(()=>rouletteRotateToTurn(game,st,gameId,{duration:900,targetTurnId:incomingTurnId}))"
]) {
  if (html.includes(forbidden)) throw new Error(`Duplicate rotation owner remains: ${forbidden}`);
}

await writeFile(indexUrl, html);
console.log('Patched Roulette so the authoritative facing guard is the sole turn-rotation owner and debug exports include rotation diagnostics.');
