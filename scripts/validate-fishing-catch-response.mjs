// Deterministic latency/lifecycle tests of the actual scene controller.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('../assets/fishing/fishing-controller.js',import.meta.url),'utf8');
function fixture(reducedMotion=false){
  let now=0,nextTimer=0;
  const timers=new Map();
  const classes=()=>{const values=new Set();return {add:(...v)=>v.forEach(x=>values.add(x)),remove:(...v)=>v.forEach(x=>values.delete(x)),contains:v=>values.has(v)};};
  const hooks=Object.fromEntries(['left','right'].map(side=>[side,{classList:classes(),style:{},querySelector:()=>null}]));
  const paths=Object.fromEntries(['left','right'].map(side=>[side,{setAttribute(name,value){this[name]=value;}}]));
  const scene={classList:classes(),querySelector(selector){const side=selector.includes('.left')?'left':'right';return selector.includes('hook-node')?hooks[side]:selector.includes('line-svg')?paths[side]:null;}};
  const water={classList:classes(),getBoundingClientRect:()=>({left:0,top:0,width:1000,height:430}),querySelector:s=>s==='.fishing-scene-art'?scene:null};
  const root={isConnected:true,dataset:{},querySelector:s=>s==='[data-fishing-water]'?water:null,querySelectorAll:()=>[]};
  const window={matchMedia:()=>({matches:reducedMotion}),addEventListener(){},removeEventListener(){}};
  const context=vm.createContext({window,performance:{now:()=>now},setTimeout:(callback,delay)=>{const id=++nextTimer;timers.set(id,{at:now+delay,callback});return id;},clearTimeout:id=>timers.delete(id),requestAnimationFrame:()=>1,cancelAnimationFrame(){}});
  vm.runInContext(source,context);
  const controller=new window.FishingSceneController(root);
  controller.phase='waiting';
  function render(){for(const rig of Object.values(controller.rigs))controller.updateRig(rig,now);}
  function advance(ms){const until=now+ms;while(now<until){now=Math.min(until,now+16);render();for(const [id,timer] of timers)if(timer.at<=now){timers.delete(id);timer.callback();}}}
  render();
  return {controller,hooks,paths,water,timers,advance};
}

for(const latency of [0,80,650,1658,4000]){
  const {controller:c,hooks,paths,water,advance}=fixture();
  const rig=c.rigs.left;
  assert(c.beginPull('left','bite-1'));
  const pendingAnimation=rig.anim;
  assert(!c.beginPull('left','bite-2'),'Duplicate input cannot replace a pending pull');
  assert.equal(rig.anim,pendingAnimation);
  assert(water.classList.contains('pull-left'));
  assert(hooks.left.classList.contains('is-reeling'));
  c.syncCatch('left','');
  assert.equal(rig.anim,pendingAnimation,'An empty poll cannot clear pending movement');
  advance(latency);
  if(latency>0)assert(rig.y<.665,'Actual bobber must lift before confirmation');
  assert(!rig.caught&&!rig.catchId&&!hooks.left.classList.contains('has-catch'),'No invented fish before server confirmation');
  const y=rig.y;
  c.syncCatch('left','server-fish-1',true);
  assert.equal(rig.anim.fromY,y,'Confirmation must continue from the current position, not restart');
  const reelAnimation=rig.anim;
  assert.equal(rig.pending,null);
  c.syncCatch('left','server-fish-1',false);
  c.syncCatch('left','');
  assert.equal(rig.anim,reelAnimation,'Repeated and stale polls cannot cancel a confirmed reel');
  assert(!c.cancelPendingPull('left','bite-1'),'A late request error cannot undo a polling-confirmed catch');
  advance(600);
  assert.equal(rig.y,.48);
  assert.equal(rig.catchId,'server-fish-1');
  assert.equal(c.phase,'caught');
  assert(!water.classList.contains('pull-left'));
  assert(!hooks.left.classList.contains('is-reeling'));
  assert.equal(c.geometry.left.connectedDelta,0);
  assert.equal(Number(paths.left.d.split(' ').at(-1)),c.geometry.left.lineEnd.y,'Line follows the same bobber anchor throughout the pull');
  assert.equal(c.events.find(e=>e.type==='pull-confirmed').data.confirmationMs,latency);
  c.destroy();
}

{
  const {controller:c,advance,water}=fixture();
  c.beginPull('left','rejected-bite');advance(180);
  const y=c.rigs.left.y;
  assert(!c.cancelPendingPull('left','wrong-bite'));
  assert(c.cancelPendingPull('left','rejected-bite'));
  assert.equal(c.rigs.left.anim.fromY,y,'A rejection returns smoothly from the current height');
  c.syncCatch('left','');
  assert.equal(c.rigs.left.anim.kind,'return');
  advance(100);
  assert(c.rigs.left.y>y&&c.rigs.left.y<.665);
  advance(300);
  assert.equal(c.rigs.left.y,.665);
  assert(!c.rigs.left.caught&&!water.classList.contains('pull-left'));
  assert(c.beginPull('left','retry-bite'),'A rejected catch permits another valid attempt');
}

{
  const {controller:c,advance,water}=fixture();
  c.syncCatch('right','bot-fish',true);
  c.beginPull('left','player-bite');advance(200);
  c.cancelPendingPull('left','player-bite');
  assert.equal(c.phase,'reeling','A rejected player attempt must not stop the opponent reel');
  assert(water.classList.contains('pull-right'));
  c.beginPull('left','next-bite');c.syncCatch('left','player-fish',true);
  advance(500);
  assert(!water.classList.contains('pull-left'));
  assert(water.classList.contains('pull-right'),'Finishing one side cannot stop the other animation');
  c.setPhase('complete');advance(1000);
  assert.equal(c.phase,'complete','Late reel completion cannot leave the result phase');
}

for(const operation of ['reset','destroy']){
  const {controller:c,advance,timers}=fixture();
  c.beginPull('left','bite');c.syncCatch('left','fish',true);
  assert.equal(timers.size,1);
  if(operation==='reset'){c.resetRig('left',false);c.setPhase('waiting');}else c.destroy();
  const eventCount=c.events.length;
  advance(5000);
  assert.equal(timers.size,0);
  assert.equal(c.events.length,eventCount,`${operation} must cancel late reel callbacks`);
  assert.equal(c.rigs.left.pending,null);
  if(operation==='reset')assert(!c.rigs.left.caught&&!c.rigs.left.catchId);
}

{
  const {controller:c,advance}=fixture(true);
  c.beginPull('left','bite');assert.equal(c.rigs.left.anim.duration,80);advance(100);
  c.syncCatch('left','fish',false);assert.equal(c.rigs.left.anim.duration,80);advance(120);
  assert.equal(c.rigs.left.y,.48);
  assert.equal(c.phase,'caught');
}

console.log('Fishing catch-response tests passed: 0–4000ms latency, immediate motion, authoritative fish, polling continuity, rejection/retry, dual reels, reduced motion, reset/destroy, and line attachment.');

// Exercise the production pointer handler, including its asynchronous guards.
const page=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8').replace(/\r\n/g,'\n');
const bindStart=page.indexOf('    function duelBindFishing(');
assert(bindStart>=0);
const bindSource=page.slice(bindStart,page.indexOf('\n    }',bindStart)+6);
function inputFixture(){
  const scene=fixture(),c=scene.controller;
  let handler,resolveRequest,rejectRequest,requests=0,refreshes=0,patches=0,flops=0;
  const water={dataset:{fishId:'bite-1'},classList:scene.water.classList,getBoundingClientRect:()=>({left:0,top:0,right:1000,bottom:430}),addEventListener:(type,listener)=>{handler=listener;}};
  const root={isConnected:true,dataset:{fishingRuntimeKey:'round-1'},_fishingController:c,matches:()=>true,querySelector:s=>s==='[data-fishing-water]'?water:null};
  const game={gameId:'game-1',status:'playing',isCreator:true,fishingState:{}};
  const state={};
  const context=vm.createContext({window:{FishingSceneController:function(){}},startSiteAudio(){},duelFishingStartOcean(){},duelFishingLatestGame:game,duelCurrentGameId:game.gameId,duelFishingStableState:()=>state,duelFishingActiveEvent:()=>({id:'bite-1'}),duelFishingLocalCatchLock:{gameId:game.gameId,locked:false},duelFishingAudioState:{},duelFishingPlayFlop:()=>flops++,duelSetStatus(){},duelFishingBeginOptimisticPull:()=>{c.beginPull('left','bite-1');return {side:'left',eventId:'bite-1'};},duelFishingClearOptimisticPull:()=>c.cancelPendingPull('left','bite-1'),duelRequest:()=>{requests++;return new Promise((resolve,reject)=>{resolveRequest=resolve;rejectRequest=reject;});},duelRefresh:async()=>{refreshes++;},duelFishingPatchDom:g=>{patches++;c.syncCatch('left',g.fishingState.creatorCatch?.eventId||'',true);}});
  vm.runInContext(bindSource,context);context.duelBindFishing(root);
  return {...scene,context,root,water,game,state,click:()=>handler({target:{closest:()=>null},clientX:500,clientY:250,preventDefault(){}}),confirm:()=>resolveRequest({game:{...game,fishingState:{creatorCatch:{eventId:'bite-1'}}}}),fail:()=>rejectRequest(new Error('Fish already claimed')),counts:()=>({requests,refreshes,patches,flops})};
}
{
  const f=inputFixture(),request=f.click();
  assert.equal(f.controller.rigs.left.pending.eventId,'bite-1','Handler starts movement before waiting on HTTP');
  await f.click();assert.equal(f.counts().requests,1,'Double taps cannot submit another catch');
  f.advance(1658);f.confirm();await request;
  assert(f.controller.rigs.left.caught);
  assert(f.context.duelFishingLocalCatchLock.locked);
  assert.equal(f.counts().flops,1,'Confirmed fish sound plays once');
  assert(!f.water.dataset.busy);
}
{
  const f=inputFixture(),request=f.click();f.advance(800);f.fail();await request;
  assert(!f.context.duelFishingLocalCatchLock.locked);
  assert(!f.controller.rigs.left.caught);
  assert.equal(f.controller.rigs.left.anim.kind,'return');
  assert.equal(f.counts().refreshes,1);
  assert.equal(f.counts().flops,0,'Rejected catches never play a caught-fish sound');
}
{
  const f=inputFixture(),request=f.click();f.advance(500);
  f.controller.syncCatch('left','bite-1',true);f.fail();await request;
  assert(f.controller.rigs.left.caught&&f.context.duelFishingLocalCatchLock.locked);
  assert.equal(f.counts().refreshes,0,'A late HTTP failure cannot roll back a polling-confirmed catch');
}
for(const response of ['confirm','fail']){
  const f=inputFixture(),request=f.click();
  f.root.isConnected=false;f.context.duelCurrentGameId='new-game';
  const newLock={gameId:'new-game',locked:false};f.context.duelFishingLocalCatchLock=newLock;
  f[response]();await request;
  assert.equal(f.context.duelFishingLocalCatchLock,newLock,'An old request must not mutate the new round lock');
  assert.equal(f.counts().patches,0,'An old response must not repaint the new round');
  assert.equal(f.counts().refreshes,0);
  assert.equal(f.counts().flops,0);
}
console.log('Fishing pointer-handler tests passed: immediate pull, duplicate lock, server confirmation, rejection recovery, polling-before-response, and stale-round responses.');
