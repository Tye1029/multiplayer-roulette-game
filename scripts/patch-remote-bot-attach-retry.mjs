import { readFile, writeFile } from 'node:fs/promises';

const indexUrl = new URL('../index.html', import.meta.url);
let html = await readFile(indexUrl, 'utf8');

const startToken = "$('rnbAddBot').addEventListener('click',async()=>{";
const endToken = 'const originalFetch=';

if (!html.includes('async function rnbAttachBotWithRetry(gameId,profile)')) {
  const startTokenIndex = html.indexOf(startToken);
  const endTokenIndex = html.indexOf(endToken, startTokenIndex + startToken.length);
  const start = startTokenIndex < 0 ? -1 : html.lastIndexOf('\n', startTokenIndex) + 1;
  const end = endTokenIndex < 0 ? -1 : html.lastIndexOf('\n', endTokenIndex) + 1;
  if (start < 0 || end < 0 || end <= start) {
    throw new Error('Remote Bot attach retry patch could not find the existing button handler.');
  }

  const replacement = `  async function rnbAttachBotWithRetry(gameId,profile){
    const delays=[0,900,1500,2200,3000,3500];
    let lastError=null;
    for(let attempt=0;attempt<delays.length;attempt++){
     const delay=delays[attempt];
     if(delay){line(botLogs,'attach retry waiting',{attempt:attempt+1,delayMs:delay});render();await new Promise(resolve=>setTimeout(resolve,delay))}
     try{
      const data=await duelRequest('remote-bot',{gameId,profile});
      if(!data?.game)throw new Error('Server did not return the updated game.');
      return data;
     }catch(error){
      lastError=error;
      const message=String(error?.message||error||'');
      const retryable=/Create a duel before adding the Remote Network Bot|duel was not found|Server did not return the updated game/i.test(message);
      if(!retryable||attempt===delays.length-1)throw error;
      line(botLogs,'attach retry scheduled',{attempt:attempt+1,error:message});render();
     }
    }
    throw lastError||new Error('Unable to add Remote Network Bot.');
   }
   $('rnbAddBot').addEventListener('click',async()=>{const b=$('rnbAddBot');try{const gameId=String((typeof duelLastActiveGame!=='undefined'&&duelLastActiveGame?.gameId)||(typeof duelCurrentGameId!=='undefined'&&duelCurrentGameId)||'');if(!gameId)throw new Error('Create a game first.');b.disabled=true;const profile=$('rnbProfile').value;line(botLogs,'attach requested',{gameId,profile});render();const data=await rnbAttachBotWithRetry(gameId,profile);const adopted=rnbAdoptGame(data.game,true);if(!adopted)throw new Error('The Remote Bot response could not be adopted.');if(typeof duelResetReadyUi==='function')duelResetReadyUi(adopted);if(typeof duelSetPollRate==='function')duelSetPollRate(adopted);line(botLogs,data.recoveredExistingBot?'attached recovered':'attached',{profile:data.remoteNetworkProfile,bot:adopted.joiner?.name,gameRevision:Number(adopted.revision??-1),stateRevision:rnbStateRevision(adopted)});render()}catch(err){line(botLogs,'attach failed',{error:String(err?.message||err)});if(typeof duelSetStatus==='function')duelSetStatus(err.message||'Unable to add Remote Network Bot.','bad');render()}finally{b.disabled=false}});
`;

  html = html.slice(0, start) + replacement + html.slice(end);
}

for (const required of [
  'async function rnbAttachBotWithRetry(gameId,profile)',
  'const delays=[0,900,1500,2200,3000,3500];',
  "line(botLogs,'attach retry scheduled'",
  'const data=await rnbAttachBotWithRetry(gameId,profile);',
  'const adopted=rnbAdoptGame(data.game,true)',
  "data.recoveredExistingBot?'attached recovered':'attached'"
]) {
  if (!html.includes(required)) throw new Error(`Remote Bot attach retry patch is missing ${required}`);
}

await writeFile(indexUrl, html);
console.log('Patched Remote Bot attachment: one click automatically retries the same new game while preserving authoritative snapshot adoption.');
await import('./patch-duel-atomic-bot-and-action-polling.mjs');
