import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const client = await readFile(new URL('../assets/safe-cracker/safe-cracker.js', import.meta.url), 'utf8');
const section = (source, start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));

// A delayed remote-bot get cannot resurrect the completed match after rematch.
let resolveGet, adopted = [];
const focus = vm.createContext({duelCurrentGameId:'old', Date, String,
  rnbRematchRuntime:{monitoring:false,lastFocusedFetchAt:0},
  duelRequest:()=>new Promise(resolve=>{resolveGet=resolve;}),
  rnbAdoptGame:g=>{adopted.push(g);return g;},render:()=>{},line:()=>{},botLogs:[]});
vm.runInContext(section(html,'async function rnbFetchAuthoritativeGame(', ' function rnbScheduleRematch('), focus);
const pending = focus.rnbFetchAuthoritativeGame('old');
focus.duelCurrentGameId = 'rematch'; resolveGet({game:{gameId:'old',status:'complete'}});
assert.equal(await pending, null); assert.equal(adopted.length,0);
focus.rnbRematchRuntime.lastFocusedFetchAt=0;
const current = focus.rnbFetchAuthoritativeGame('rematch');
resolveGet({game:{gameId:'rematch',status:'ready'}}); await current;
assert.equal(adopted[0].gameId,'rematch');

// Starting again from a result must not leave an empty navigation intent.
const navigation=vm.createContext({window:{},duelLastActiveGame:{mode:'safecracker'},duelModeSelect:{value:'fishing'},
  duelRefreshSequence:0,duelRefreshPending:false,duelRememberCurrentGame:()=>{},duelAcceptedStatusByGame:new Map(),
  rouletteResetVisualRuntime:()=>{},duelFishingResetRuntime:()=>{},duelFishingHideResultPortal:()=>{},
  duelDrawSyncWesternMusic:()=>{},duelResetGenericRuntime:()=>{},duelRenderActive:()=>{},
  duelCreateBtn:null,duelWagerInput:null,duelSetStatus:()=>{}});
vm.runInContext(section(html,'function duelStartNewGame(', '    async function duelLeaveBlackjackResultForNewGame'),navigation);
navigation.duelStartNewGame();
assert.equal(navigation.window.__duelRequestedModeIntent,'safecracker');

const ready=vm.createContext({duelReadyUiState:{gameId:'old',clicked:true,confirmed:true,deadlineAt:new Date(Date.now()-1000).toISOString()},DUEL_STATUS_RANK:{ready:1},Date,String,Number,Math,Boolean});
vm.runInContext(section(html,'function duelResetReadyUi(', '    function duelPatchReadyDom('),ready);
const nextReady={gameId:'rematch',status:'ready',canReady:true,isCreator:true};
assert.equal(ready.duelReadyButtonState(nextReady).label,'READY');
assert.equal(ready.duelReadyButtonState(nextReady).disabled,false);
ready.duelReadyUiState.clicked=true;
assert.equal(ready.duelReadyButtonState(nextReady).disabled,true,'Same-match polls must preserve the Ready click');

// Real result handlers: no premature close, one request, expiry/retry recovery.
let handler, resolveRematch, requests=0, removed=0;
const game={gameId:'old',status:'complete',isCreator:true,creator:{userId:'me'}};
const button={textContent:'REMATCH',disabled:false,isConnected:true,
  addEventListener:(_,fn)=>{handler=fn;},closest:()=>portal};
const portal={querySelector:s=>s==='[data-sc-rematch]'?button:null};
const runtime={game,rematchPendingGameId:''};
const result=vm.createContext({runtime,Date,String,Boolean,Math,Error,
  safeCrackerSetText:(node,text)=>{node.textContent=text;},
  clearSafeCrackerResultPortal:()=>removed++,
  window:{__safeCrackerBridge:{rematch:()=>{requests++;return new Promise(r=>resolveRematch=r);}}}});
vm.runInContext(section(client,'function bindResultControls(', '  // A single explicitly requested next check'), result);
result.bindResultControls(portal);
const waiting=handler({currentTarget:button});await handler({currentTarget:button});
assert.equal(requests,1);assert.equal(removed,0);assert.equal(button.disabled,true);
game.rematch={expiresAt:new Date(Date.now()+9000).toISOString(),requestedBy:{me:true}};
resolveRematch();await waiting;
assert.match(button.textContent,/WAITING FOR OPPONENT/);assert.equal(button.disabled,true);
game.rematch.expiresAt=new Date(Date.now()-1000).toISOString();
result.syncSafeCrackerRematchControl(portal,game);assert.equal(button.disabled,false);
const retry=handler({currentTarget:button});resolveRematch({error:'Offline'});await retry;
assert.equal(button.disabled,false);assert.equal(button.title,'Offline');assert.equal(removed,0);

// Explicit completion-lag rejections must settle from one click, without
// replaying ambiguous network failures or carrying a retry into another game.
let settlingCalls=0;
result.window.setTimeout=fn=>fn();
result.window.__safeCrackerBridge.rematch=async()=>{
  settlingCalls++;
  return settlingCalls<3?{error:'Rematches are only available after a completed duel.'}:{};
};
await handler({currentTarget:button});
assert.equal(settlingCalls,3);
assert.equal(button.disabled,false);
assert.equal(button.title,'');
result.window.__safeCrackerBridge.rematch=async()=>({error:'Rematches are only available after a completed duel.'});
result.window.setTimeout=fn=>{runtime.game={gameId:'new',status:'ready'};fn();};
await handler({currentTarget:button});
assert.equal(runtime.rematchPendingGameId,'');
runtime.game=game;

for(const id of ['singlePlayerLayout','arcadeScreen','runnerScreen','horseScreen','multiplayerScreen'])
  assert.ok(!html.includes(`id="${id}"`),`Retired UI still mounted: ${id}`);
assert.ok(html.indexOf('id="duelShellStyles"')<html.indexOf('</head>'),'Current shell must load before first paint');
assert.ok(html.includes('id="apiKeyInput"') && html.includes('href="/admin.html"'));
assert.ok(html.includes('requestedFocusId !== String(duelCurrentGameId)'));
console.log('Rematch flow passed: stale reads rejected, result retained, duplicate clicks blocked, expiry/error retry, retired UI absent, account/admin retained.');
