import { readFile, writeFile } from 'node:fs/promises';

const indexUrl = new URL('../index.html', import.meta.url);
let html = await readFile(indexUrl, 'utf8');

const startMarker = " $('rnbAddBot').addEventListener('click',async()=>{";
const endMarker = "\n  const originalFetch=";

if (!html.includes('async function rnbAttachBotWithRetry(gameId,profile)')) {
  const start = html.indexOf(startMarker);
  const end = html.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) {
    throw new Error('Remote Bot attach retry patch could not find the existing button handler.');
  }

  const replacement = ` async function rnbAttachBotWithRetry(gameId,profile){
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
 $('rnbAddBot').addEventListener('click',async()=>{const b=$('rnbAddBot');try{const gameId=String((typeof duelLastActiveGame!=='undefined'&&duelLastActiveGame?.gameId)||(typeof duelCurrentGameId!=='undefined'&&duelCurrentGameId)||'');if(!gameId)throw new Error('Create a game first.');b.disabled=true;const profile=$('rnbProfile').value;line(botLogs,'attach requested',{gameId,profile});render();const data=await rnbAttachBotWithRetry(gameId,profile);if(typeof duelRememberCurrentGame==='function')duelRememberCurrentGame(data.game.gameId);if(typeof duelLastActiveGame!=='undefined')duelLastActiveGame=data.game;if(typeof duelResetReadyUi==='function')duelResetReadyUi(data.game);if(typeof duelRenderActive==='function')duelRenderActive({...data.game,status:'ready'},true);if(typeof duelSetPollRate==='function')duelSetPollRate(data.game);line(botLogs,data.recoveredExistingBot?'attached recovered':'attached',{profile:data.remoteNetworkProfile,bot:data.game.joiner?.name});render()}catch(err){line(botLogs,'attach failed',{error:String(err?.message||err)});if(typeof duelSetStatus==='function')duelSetStatus(err.message||'Unable to add Remote Network Bot.','bad');render()}finally{b.disabled=false}});`;

  html = html.slice(0, start) + replacement + html.slice(end);
}

for (const required of [
  'async function rnbAttachBotWithRetry(gameId,profile)',
  'const delays=[0,900,1500,2200,3000,3500];',
  "line(botLogs,'attach retry scheduled'",
  "const data=await rnbAttachBotWithRetry(gameId,profile);",
  "data.recoveredExistingBot?'attached recovered':'attached'"
]) {
  if (!html.includes(required)) throw new Error(`Remote Bot attach retry patch is missing ${required}`);
}

await writeFile(indexUrl, html);
console.log('Patched Remote Bot attachment: one click automatically retries the same new game until it is visible or a real error occurs.');