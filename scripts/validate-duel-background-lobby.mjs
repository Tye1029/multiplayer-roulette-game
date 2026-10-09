import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync('index.html','utf8');
const backend=fs.readFileSync('netlify/functions/_data.js','utf8');
const section=(s,a,b)=>s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)));
let displayed=[],rendered=0;
const notice={hidden:true,innerHTML:'',querySelectorAll:()=>[]};
const owned={gameId:'mine',mode:'safecracker',isCreator:true,isPlayer:true,status:'ready',joiner:{name:'Guest'}};
const c=vm.createContext({window:{},duelCurrentGameId:'other',duelBusy:false,duelScreen:{hidden:false},
 document:{hidden:false,getElementById:()=>notice},escapeHtml:s=>s,duelRequest:async action=>action==='list'?{games:[owned]}:{game:owned},
 duelRenderLobby:g=>displayed=g,setInterval:()=>{},duelRememberCurrentGame:id=>{c.duelCurrentGameId=id},
 duelRenderActive:()=>rendered++,duelSetPollRate:()=>{},duelSetStatus:()=>{}});
vm.runInContext(section(html,'const duelOwnedWaiting =','    function duelCardHtml'),c);
await c.duelRefreshBackgroundLobby();
assert.equal(c.duelCurrentGameId,'other');assert.equal(rendered,0);assert.equal(displayed.length,1);
assert.match(notice.innerHTML,/Guest joined/);assert.equal(notice.hidden,false);
await c.duelReturnToGame('mine');assert.equal(c.duelCurrentGameId,'mine');assert.equal(rendered,1);
const r=vm.createContext({duelReadyUiState:{gameId:'g',requestPending:false},duelResetReadyUi:()=>{}});
vm.runInContext(section(html,'function duelReadyButtonState(', '    function duelPatchReadyDom('),r);
assert.equal(r.duelReadyButtonState({gameId:'g',status:'waiting'}).disabled,true);
const ready=r.duelReadyButtonState({gameId:'g',status:'ready',isCreator:true,joinerReady:true,canReady:true,readyDeadlineAt:new Date(Date.now()+10000).toISOString()});
assert.equal(ready.label,'Opponent Ready');assert.equal(ready.timerActive,true);assert.equal(ready.disabled,false);assert.ok(ready.seconds>0&&ready.seconds<=10);
let balance=1000,game={gameId:'join',status:'waiting',mode:'safecracker',creator:{userId:'host'},wager:1000};
const b=vm.createContext({duelEnsureSchemaMigration:async()=>{},duelGetRawStrong:async()=>game,cleanUserId:String,
 int:(n,d)=>Number(n??d),getUserRecord:async()=>({userId:'guest'}),prepareLedgerRecord:r=>r,getRecordBalance:()=>balance,
 formatTickets:String,nowIso:()=>new Date().toISOString(),makeLedgerEntry:e=>e,addLedgerEntry:(r,e)=>({record:{...r,entry:e}}),
 saveUserRecord:async r=>r,sanitizeRecord:r=>r,addEvent:()=>[],DUEL_MODES:{safecracker:'Safe Cracker'},duelSanitizePlayer:p=>p,
 duelSaveGame:async g=>g,duelPublicGame:g=>g});
vm.runInContext(section(backend,'async function duelJoinGame(', 'function duelCardValue('),b);
const joined=await b.duelJoinGame({id:'guest'},'join');assert.equal(joined.game.status,'ready');assert.equal(joined.record.entry.delta,-1000);
balance=0;await assert.rejects(()=>b.duelJoinGame({id:'guest'},'join'),/need/);
game={...game,creator:{userId:'guest'}};await assert.rejects(()=>b.duelJoinGame({id:'guest'},'join'),/own duel/);
console.log('Lobby checks passed: background notice preserves focus, explicit return, Ready countdown, join escrow and ownership.');

