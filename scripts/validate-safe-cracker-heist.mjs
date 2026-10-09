import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import crypto from 'node:crypto';
import vm from 'node:vm';
import rules from '../netlify/functions/safe-cracker/heist.js';

const plans = Array.from({length:40},()=>rules.create());
assert.ok(new Set(plans.map(h=>h.order.join())).size > 35);
assert.ok(new Set(plans.map(h=>h.screws.map(s=>s.type).join())).size > 30);
for(const h of plans) {assert.equal(h.screws.length,8);assert.equal(new Set(h.screws.map(s=>s.type)).size,6);assert.equal(new Set(h.order).size,10);}
let h = rules.create();
assert.throws(()=>rules.apply(h,'cut:red'),/panel/);
const type=h.screws[0].type, wrong=h.kit.find(s=>s!==type);
h=rules.apply(h,`screw:0:${wrong}`);
assert.equal(h.screws[0].stripped,true);
for(let i=1;i<=3;i++) {h=rules.apply(h,`screw:0:${type}`);assert.equal(h.screws[0].turns,i);assert.equal(h.screws[0].removed,i===3);}
assert.equal(rules.apply(h,`screw:0:${type}`),h,'Removed screws cannot be stripped again');
for(let i=1;i<8;i++)h=rules.apply(h,`screw:${i}:${h.screws[i].type}`);
assert.equal(h.phase,1);
assert.equal(rules.publicView(h,true).instructions,undefined,'Closed card must not leak its order');
h=rules.apply(h,'card:open');
assert.equal(rules.publicView(h,true).instructions.length,10);
assert.throws(()=>rules.apply(h,`cut:${h.order[0]}`),/Put the note away/);
h=rules.apply(h,'card:close');
for(let mistake=1;mistake<=3;mistake++) {
  h=rules.apply(h,`cut:${h.order.find(c=>!h.cut.includes(c)&&c!==rules.nextWire(h))}`);
  assert.equal(h.mistakes,mistake);
  assert.equal(rules.tier('yellow',h),mistake===1?'yellow':mistake===2?'orange':'off');
}
while(h.phase===1)h=rules.apply(h,`cut:${rules.nextWire(h)}`);
assert.equal(h.cut.length,10);assert.equal(h.phase,2);
assert.equal(rules.tier('green',h),'off');
assert.deepEqual(Object.keys(rules.publicView(h,false)).sort(),['cutCount','phase','removed','wireCount']);
let bot=rules.create();let actions=0;
while(bot.phase<2) {bot=rules.apply(bot,rules.botCommand(bot));assert.ok(++actions<30);}
assert.equal(bot.mistakes,0);assert.equal(actions,20);

// Exercise the actual authenticated action dispatcher and revision/write path.
const source=await readFile(new URL('../netlify/functions/_data.js',import.meta.url),'utf8');
let now=100000,stored;class Clock extends Date {static now(){return now;}}
const sandbox=vm.createContext({crypto,Date:Clock,Math,Promise,require:name=>{assert.equal(name,'./safe-cracker/heist');return rules;},
  int:(v,d=0)=>Number.isFinite(Number(v))?Math.trunc(Number(v)):d,cleanUserId:v=>String(v||''),mpCleanId:v=>String(v||''),
  duelGetRawStrong:async()=>structuredClone(stored),duelGetRaw:async()=>structuredClone(stored),
  duelSaveGame:async g=>{stored=structuredClone({...g,revision:(g.revision||0)+1});return structuredClone(stored);},
  nowIso:()=>new Date(now).toISOString(),
  duelCompleteWithResolved:async(g,result)=>{stored=structuredClone({...g,status:'complete',result,winnerUserId:result.tie ? '' : g[result.winnerRole].userId});return structuredClone(stored);},
  duelPublicGame:(g,id)=>({...g,safecrackerState:sandbox.safeCrackerPublicState(g,id)}),getUserRecord:async()=>({balance:0})
});
vm.runInContext(source.slice(source.indexOf('const SAFE_CRACKER_ROUND_MS'),source.indexOf('// SAFE_CRACKER_SERVER_END')),sandbox);
stored={gameId:'test',mode:'safecracker',status:'playing',creator:{userId:'me'},joiner:{userId:'remote-bot-test'},revision:1};
stored.safecrackerState=sandbox.safeCrackerInitialState(stored,now);
assert.equal(Date.parse(stored.safecrackerState.endAt)-now,180000);
assert.equal(sandbox.safeCrackerHasValidState(stored),true);
await assert.rejects(()=>sandbox.safeCrackerAction({id:'outsider'},'test','safecracker:card:open',{actionId:'x'}),/not in this/);
await assert.rejects(()=>sandbox.safeCrackerAction({id:'me'},'test','safecracker:guess:0',{actionId:'x'}),/panel and wiring/);
const own=stored.safecrackerState.players.me.heist;
await assert.rejects(()=>sandbox.safeCrackerAction({id:'me'},'test',`safecracker:screw:0:${own.screws[0].type}`),/request ID/);
let result=await sandbox.safeCrackerAction({id:'me'},'test',`safecracker:screw:0:${own.screws[0].type}`,{actionId:'once'});
const revision=stored.safecrackerState.revision;
assert.equal(result.game.safecrackerState.me.heist.removed,1);
result=await sandbox.safeCrackerAction({id:'me'},'test',`safecracker:screw:0:${own.screws[0].type}`,{actionId:'once'});
assert.equal(result.ignoreReason,'duplicate');assert.equal(stored.safecrackerState.revision,revision);
assert.equal(result.game.safecrackerState.opponent.heist.screws,undefined);
assert.equal(result.game.safecrackerState.me.code,undefined);
let count=0;
while(stored.safecrackerState.players.me.heist.phase<2) {
  const command=rules.botCommand(stored.safecrackerState.players.me.heist);
  result=await sandbox.safeCrackerAction({id:'me'},'test',`safecracker:${command}`,{actionId:`step-${++count}`});
}
assert.equal(result.game.safecrackerState.canSubmit,true);
// Old in-flight one-minute games remain valid and do not gain tool stages.
const legacy=structuredClone(stored);delete legacy.safecrackerState.version;
legacy.safecrackerState.endAt=new Date(Date.parse(legacy.safecrackerState.startAt)+60000).toISOString();
for(const player of Object.values(legacy.safecrackerState.players))delete player.heist;
assert.equal(sandbox.safeCrackerHasValidState(legacy),true);
const fresh=sandbox.safeCrackerInitialState(stored,now);
assert.equal(fresh.players.me.heist.phase,0);assert.equal(fresh.players.me.heist.mistakes,0);
// Deadline inside the write helper closes the race between initial check and save.
now=Date.parse(stored.safecrackerState.endAt)+1;
const before=JSON.stringify(stored);
await sandbox.safeCrackerApplyGuess(stored,'me',0,'late',false);
assert.equal(JSON.stringify(stored),before);
console.log('Safe heist validated: randomized puzzles, three-turn stripping, private note/card lock, irreversible cuts, all penalties, bot stages, actor/phase/deadline guards, idempotency, legacy rounds and fresh rematches.');

// Ten-wire public layout must not reveal the opponent's note or order.
assert.equal(rules.publicView(h,false).notePlan,undefined);
assert.equal(rules.publicView(h,true).notePlan.length,10);
assert.deepEqual(rules.publicView(h,true).wireColors,rules.colors.slice(0,10));
// Preserve already-started twelve-wire rounds across this deployment.
let old=rules.create();old.order=[...rules.colors];delete old.wireLayout;delete old.kit;
while(old.phase<2)old=rules.apply(old,rules.botCommand(old));
assert.equal(old.cut.length,12);
now=100000; stored={gameId:'failure',mode:'safecracker',status:'playing',creator:{userId:'me'},joiner:{userId:'other'},revision:1};
stored.safecrackerState=sandbox.safeCrackerInitialState(stored,now);
while(stored.safecrackerState.players.me.heist.phase===0){
  const cmd=rules.botCommand(stored.safecrackerState.players.me.heist);
  await sandbox.safeCrackerAction({id:'me'},'failure','safecracker:'+cmd,{actionId:'panel-'+(++count)});
}
for(let n=1;n<=5;n++){
  const current=stored.safecrackerState.players.me.heist;
  const wrongWire=current.order.find(c=>!current.cut.includes(c)&&c!==rules.nextWire(current));
  result=await sandbox.safeCrackerAction({id:'me'},'failure','safecracker:cut:'+wrongWire,{actionId:'wrong-'+n});
  assert.equal(stored.safecrackerState.players.me.heist.mistakes,n);
  assert.equal(stored.status,n===5?'complete':'playing');
}
assert.equal(result.game.winnerUserId,'other');assert.ok(result.record);
assert.equal(result.game.safecrackerState.me.heist.failed,true);
assert.equal(result.game.safecrackerState.me.heist.phase,1);
assert.equal(result.game.safecrackerState.opponent.stage,0,'Lockdown wins do not fabricate dial progress');
assert.match(stored.result.text,/Five wrong wires/);
const completed=JSON.stringify(stored);
await sandbox.safeCrackerAction({id:'me'},'failure','safecracker:cut:red',{actionId:'wrong-5'});
assert.equal(JSON.stringify(stored),completed,'Duplicate terminal action cannot repeat the loss or payment');
await sandbox.safeCrackerAdvanceAndSave(stored);
assert.equal(JSON.stringify(stored),completed,'Polling cannot reopen a failed vault');
assert.throws(()=>rules.apply(stored.safecrackerState.players.me.heist,'cut:red'),/lockdown/);
console.log('Five-fault loss, terminal idempotency, result record, private preloaded note and 12-wire compatibility validated.');

// Authoritative stage report: retries must not inflate mistakes or reset times.
now=500000;stored={gameId:'report',mode:'safecracker',status:'playing',creator:{userId:'me'},joiner:{userId:'other'},revision:1};
stored.safecrackerState=sandbox.safeCrackerInitialState(stored,now);
const reportStart=now;
let mine=stored.safecrackerState.players.me;
const wrongTool=mine.heist.kit.find(t=>t!==mine.heist.screws[0].type);
now+=1000;
await sandbox.safeCrackerAction({id:'me'},'report','safecracker:screw:0:'+wrongTool,{actionId:'strip-report'});
await sandbox.safeCrackerAction({id:'me'},'report','safecracker:screw:0:'+wrongTool,{actionId:'strip-report'});
assert.equal(stored.safecrackerState.players.me.heistMetrics.mistakes[0],1);
let reportAction=0;
while(stored.safecrackerState.players.me.heist.phase===0){
  now+=1000;
  await sandbox.safeCrackerAction({id:'me'},'report','safecracker:'+rules.botCommand(stored.safecrackerState.players.me.heist),{actionId:'report-'+(++reportAction)});
}
const panelEnd=now;
assert.equal(stored.safecrackerState.players.me.heistMetrics.finished[0],panelEnd);
assert.equal(sandbox.safeCrackerPublicState(stored,'me').report,undefined);
while(stored.safecrackerState.players.me.heist.phase===1){
  now+=1000;
  await sandbox.safeCrackerAction({id:'me'},'report','safecracker:'+rules.botCommand(stored.safecrackerState.players.me.heist),{actionId:'report-'+(++reportAction)});
}
const wireEnd=now;
now+=1000;
const code=stored.safecrackerState.players.me.code;
await sandbox.safeCrackerAction({id:'me'},'report','safecracker:guess:'+((Number(code[0])+1)%10),{actionId:'miss-report'});
await sandbox.safeCrackerAction({id:'me'},'report','safecracker:guess:'+((Number(code[0])+1)%10),{actionId:'miss-report'});
for(const digit of code){now+=1000;await sandbox.safeCrackerAction({id:'me'},'report','safecracker:guess:'+digit,{actionId:'report-'+(++reportAction)});}
assert.equal(stored.status,'complete');
const stats=sandbox.safeCrackerPublicState(stored,'me').report;
assert.deepEqual(Array.from(stats.me,s=>s.milliseconds),[panelEnd-reportStart,wireEnd-panelEnd,now-wireEnd]);
assert.deepEqual(Array.from(stats.me,s=>s.mistakes),[1,0,1]);
assert.ok(stats.me.every(s=>s.complete));
assert.equal(stats.opponent[0].complete,false);assert.equal(stats.opponent[1].milliseconds,null);
const frozen=JSON.stringify(stats);now+=30000;
assert.equal(JSON.stringify(sandbox.safeCrackerPublicState(stored,'me').report),frozen,'Result timings stay fixed after completion');
const swapped=sandbox.safeCrackerPublicState(stored,'other').report;
assert.equal(JSON.stringify(swapped.opponent),JSON.stringify(stats.me));
const oldPlayer=structuredClone(stored.safecrackerState.players.me);delete oldPlayer.heistMetrics;
assert.equal(rules.report(oldPlayer,now),null,'No made-up times for older games');
console.log('Stage reports validated: authoritative intervals, wrong-tool/dial deduplication, private live stats, unfinished and unreached stages, viewer mapping and stable terminal timings.');
