import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const source=await readFile(new URL('../netlify/functions/_data.js',import.meta.url),'utf8');
const records=new Map(); let releaseLate, enteredLate, delayLate=false, receiptReads=0;
const store={get:async key=>{if(key.startsWith('safecracker-result:'))receiptReads++;return structuredClone(records.get(key)||null);},
  setJSON:async(key,value)=>{if(delayLate && key==='game:test' && value.status==='playing'){
    delayLate=false;enteredLate();await new Promise(resolve=>{releaseLate=resolve;});
  } records.set(key,structuredClone(value));}};
const sandbox=vm.createContext({console,Promise,Math,Date,process:{env:{}},STORE_NAME:'test',DUEL_SCHEMA_VERSION:1,
  mpCleanId:x=>String(x||''),int:(x,f)=>Number.isFinite(Number(x))?Number(x):f,
  duelSanitizeGame:g=>g,duelGameKey:id=>'game:'+id,getUsersStore:()=>store,getStore:()=>store,
  nowIso:()=>new Date().toISOString(),sleep:async()=>{},
  duelIsActiveStatus:s=>['ready','playing'].includes(s),duelSetActivePointer:async()=>{},duelClearPointers:async()=>{}});
vm.runInContext(source.slice(source.indexOf('function safeCrackerResultKey('),source.indexOf('async function duelInvalidateLegacyGame(')),sandbox);
const active={gameId:'test',mode:'safecracker',status:'playing',revision:5,creator:{userId:'one'}};
await sandbox.duelSaveGame(active);
assert.equal((await sandbox.duelGetRawStrong('test')).status,'playing');
// A separate worker already passed its pre-save read before the win arrived.
delayLate=true;const entered=new Promise(resolve=>{enteredLate=resolve;});
const staleWrite=sandbox.duelSaveGame(active);await entered;
const complete={...active,status:'complete',revision:8,winnerUserId:'one',safecrackerState:{revision:9,players:{one:{stage:3}}}};
await sandbox.duelSaveGame(complete);releaseLate();await staleWrite;
assert.equal(records.get('game:test').status,'playing','Fixture must reproduce an actual late overwrite');
for(const read of ['duelGetRaw','duelGetRawStrong']){
  const restored=await sandbox[read]('test');assert.equal(restored.status,'complete');assert.equal(restored.winnerUserId,'one');
}
const ignored=await sandbox.duelSaveGame({...active,revision:30});assert.equal(ignored.status,'complete');
await sandbox.duelSaveGame({...complete,rematchGameId:'next'});
assert.equal((await sandbox.duelGetRawStrong('test')).rematchGameId,'next','Rematch metadata must remain writable');
records.delete('game:test');assert.equal(await sandbox.duelGetRawStrong('test'),null,'A deleted game must not be resurrected by its receipt');
receiptReads=0;
await sandbox.duelSaveGame({...active,mode:'roulette'});await sandbox.duelGetRawStrong('test');
assert.equal(receiptReads,0,'Other games must not use Safe Cracker completion storage');
console.log('Safe Cracker storage passed: cross-worker late saves cannot undo completion, rematches preserve metadata, deleted games stay deleted, other games unchanged.');
