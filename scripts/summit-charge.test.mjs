import assert from 'node:assert/strict';
import model from '../netlify/functions/mountain-race/state-model.js';
import integrationModule from '../netlify/functions/mountain-race/integration.js';

const start=Date.now(), make=()=>model.createMountainRaceState({playerIds:['a','b'],now:start,countdownMs:0});
assert.equal(model.MOUNTAIN_RACE_DURATION_MS,60000);
for(let run=0;run<100;run++){
 const generated=make();
 assert.equal(Date.parse(generated.endAt)-Date.parse(generated.startAt),60000);
 for(let i=0;i<generated.sequence.length;i++){
  const window=generated.sequence.slice(i,i+4);
  assert.equal(new Set(window).size,window.length,'Every upcoming command must be unique');
  assert.ok(model.MOUNTAIN_RACE_CONTROLS.includes(generated.sequence[i]));
 }
}
for(const token of ['up+left','up+right','down+left','down+right']){
 const fresh=make();fresh.sequence[0]=token;
 const next=model.applyMountainRaceInput(fresh,'a',token,'pair',start);
 assert.equal(next.players.a.promptIndex,1);
 assert.equal(next.players.a.acceptedInputs,1);
}
assert.equal(model.normalizeMountainRaceControl('up+down'),'');
assert.equal(model.normalizeMountainRaceControl('up+left+right'),'');
let s=make();s.sequence=Array.from({length:30},(_,i)=>['up','left','right','down'][i%4]);
s=model.applyMountainRaceInput(s,'a','up','tap',start);
s=model.applyMountainRaceInput(s,'a','down','miss',start+10);
assert.equal(s.players.a.promptIndex,0);
assert.equal(Date.parse(s.players.a.recoverUntil),start+510);
for(const at of [11,509])assert.equal(model.applyMountainRaceInput(s,'a','up','too-fast',start+at),s);
assert.equal(model.applyMountainRaceCharge(s,'a','charge','left','blocked',{expectedPromptIndex:0},start+509),s);
s=model.applyMountainRaceInput(s,'a','up','recovered',start+510);assert.equal(s.players.a.promptIndex,1);
const begin=()=>model.applyMountainRaceCharge(s,'a','charge','right','jump',{expectedPromptIndex:1},start+600);
const charged=begin();assert.equal(charged.players.a.charge.startedAt,start+600);
assert.equal(model.applyMountainRaceInput(charged,'a','left','bypass',start+800),charged);
assert.equal(model.applyMountainRaceCharge(charged,'a','release','right','foreign',{},start+1600),charged);
assert.equal(model.applyMountainRaceCharge(charged,'b','release','right','jump',{},start+1600),charged);
assert.equal(model.applyMountainRaceCharge(charged,'a','charge','right','replacement',{expectedPromptIndex:1},start+800),charged);
for(const age of [0,899,1181,9000]){
 const miss=model.applyMountainRaceCharge(charged,'a','release','right','jump',{},start+600+age);
 assert.equal(miss.players.a.promptIndex,0);assert.equal(miss.players.a.rejectedInputs,2);
 assert.equal(Date.parse(miss.players.a.recoverUntil),start+600+age+500);
}
for(const distance of [2,3,4]){
 const fresh=make();fresh.sequence.fill('up'); // Repeated arrows still identify distinct landings.
 const [min,max]=model.MOUNTAIN_RACE_JUMP_WINDOWS[distance];
 const charged=model.applyMountainRaceCharge(fresh,'a','charge','up','card',{distance,expectedPromptIndex:0},start);
 for(const elapsed of [min,max]){
  const success=model.applyMountainRaceCharge(charged,'a','release','up','card',{chargeMs:elapsed},start+elapsed+900);
  assert.equal(success.players.a.promptIndex,distance,'Network jitter cannot turn a green release into a miss');
  assert.equal(success.players.a.acceptedInputs,1);
 }
 assert.equal(model.applyMountainRaceCharge(charged,'a','release','up','card',{chargeMs:min},start+min-1),charged,'Client timing cannot bypass minimum server duration');
 for(const elapsed of [min-1,max+1,NaN,Infinity]){
  const miss=model.applyMountainRaceCharge(charged,'a','release','up','card',{chargeMs:elapsed},start+1000);
  assert.equal(miss.players.a.rejectedInputs,1);
 }
 assert.equal(model.applyMountainRaceCharge(charged,'a','release','up','card',{chargeMs:min},start+min+2001).players.a.rejectedInputs,1);
}
assert.equal(model.applyMountainRaceCharge(s,'a','charge','right','bad-distance',{distance:5,expectedPromptIndex:1},start+600),s);
for(const age of [900,1050,1180]){
 const success=model.applyMountainRaceCharge(charged,'a','release','right','jump',{},start+600+age);
 assert.equal(success.players.a.promptIndex,3);assert.equal(success.players.a.lastInput.charged,true);
 assert.equal(success.players.a.charge,null);
 assert.equal(model.applyMountainRaceCharge(success,'a','release','right','jump',{},start+2000),success);
}
let canceled=model.applyMountainRaceCharge(charged,'a','cancel','right','jump',{},start+700);
assert.equal(canceled.players.a.charge,null);assert.equal(canceled.players.a.promptIndex,1);
assert.equal(model.applyMountainRaceCharge(canceled,'a','charge','right','jump',{expectedPromptIndex:1},start+800),canceled);
assert.equal(model.applyMountainRaceCharge(s,'a','charge','right','stale',{expectedPromptIndex:0},start+600),s);
assert.equal(model.applyMountainRaceCharge(s,'a','charge','right','pre',{expectedPromptIndex:1},start-1),s);
assert.equal(model.applyMountainRaceCharge(s,'a','charge','right','post',{expectedPromptIndex:1},start+60000),s);
s.players.a.promptIndex=28;s.players.a.recoverUntil=null;
let finish=model.applyMountainRaceCharge(s,'a','charge',s.sequence[29],'finish',{expectedPromptIndex:28},start+2000);
finish=model.applyMountainRaceCharge(finish,'a','release',s.sequence[29],'finish',{},start+3000);
assert.equal(finish.winnerId,'a');assert.equal(finish.players.a.promptIndex,30);
assert.ok(finish.players.a.finishedAt);assert.equal(model.publicMountainRaceState(charged,'b').players.a.charge,null);

// Exercise actual persistence, public projections, batching and completion with a server clock.
const realNow=Date.now;let now=start,stored,api;
Date.now=()=>now;
try{
 api=integrationModule.createMountainRaceIntegration({cleanUserId:String,mpCleanId:String,int:(v,d=0)=>Number.isFinite(Number(v))?Math.trunc(Number(v)):d,
 getRaw:async()=>structuredClone(stored),getRawStrong:async()=>structuredClone(stored),saveGame:async g=>(stored=structuredClone(g)),
 publicGame:(g,id)=>({...g,mountainraceState:api.publicState(g,id)}),getUserRecord:async()=>({}),
 completeResolved:async g=>(stored={...g,status:'complete'})});
 stored={gameId:'charge-integration',mode:'mountainrace',status:'playing',creator:{userId:'a'},joiner:{userId:'b'},mountainraceState:make()};
 const act=(choice,details={})=>api.action({id:'a'},stored.gameId,'mountainrace:'+choice,details);
 stored.mountainraceState.sequence.splice(0,4,'up','up+left','down+right','left');
 const target=stored.mountainraceState.sequence[1];
 let r=await act('charge:'+target,{actionId:'network',expectedPromptIndex:0});assert.equal(r.game.mountainraceState.me.charge.id,'network');
 assert.equal((await act('charge:'+target,{actionId:'network',expectedPromptIndex:0})).replayedAction,true);
 now+=1000;r=await act('release:'+target,{actionId:'network'});assert.equal(r.game.mountainraceState.me.promptIndex,2);
 const expected=stored.mountainraceState.sequence[2],wrong=model.MOUNTAIN_RACE_CONTROLS.find(x=>x!==expected);
 r=await act('batch',{inputBatch:[{control:wrong,expectedControl:expected,expectedPromptIndex:2,actionId:'fall'},
 {control:stored.mountainraceState.sequence[1],expectedControl:stored.mountainraceState.sequence[1],expectedPromptIndex:1,actionId:'exploit'}]});
 assert.deepEqual(r.confirmedActionIds,['fall']);assert.deepEqual(r.ignoredActionIds,['exploit']);assert.equal(r.game.mountainraceState.me.promptIndex,1);
 const input={control:stored.mountainraceState.sequence[1],expectedControl:stored.mountainraceState.sequence[1],expectedPromptIndex:1,actionId:'resume'};
 now+=499;r=await act('batch',{inputBatch:[input]});assert.deepEqual(r.ignoredActionIds,['resume']);
 now++;r=await act('batch',{inputBatch:[input]});assert.deepEqual(r.confirmedActionIds,['resume']);assert.equal(r.game.mountainraceState.me.promptIndex,2);
 stored.mountainraceState.players.a.promptIndex=26;
 const end=stored.mountainraceState.sequence[29];await act('charge:4:'+end,{actionId:'win',expectedPromptIndex:26});
 r=await act('release:4:'+end,{actionId:'win',chargeMs:540});assert.equal(r.ignoreReason,'charge-warming');
 now+=1200;r=await act('release:4:'+end,{actionId:'win',chargeMs:540});assert.equal(r.game.status,'complete');assert.equal(r.game.mountainraceState.viewerWon,true);
 stored={...stored,status:'playing',mountainraceState:make()};
 now=start+31000;r=await api.advance(stored);assert.equal(r.status,'playing','The race must continue past the old 30-second limit');
 now=start+60000;r=await api.advance(stored);assert.equal(r.status,'complete','The server settles at the new 60-second deadline');
}finally{Date.now=realNow;}
console.log('Summit charge/recovery passed: timing windows, server minimums, network jitter, repeated arrows, replay/stale/foreign protection, batch cooldown, cancellation, public state and charged finish.');
