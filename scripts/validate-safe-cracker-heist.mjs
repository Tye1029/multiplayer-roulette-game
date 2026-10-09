import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import crypto from 'node:crypto';
import vm from 'node:vm';
import rules from '../netlify/functions/safe-cracker/heist.js';

const plans = Array.from({length:40},()=>rules.create());
assert.ok(new Set(plans.map(h=>h.order.join())).size > 35);
assert.ok(new Set(plans.map(h=>h.screws.map(s=>s.type).join())).size > 30);
for(const h of plans) {assert.equal(h.screws.length,8);assert.equal(new Set(h.screws.map(s=>s.type)).size,6);assert.equal(new Set(h.order).size,12);}
let h = rules.create();
assert.throws(()=>rules.apply(h,'cut:red'),/panel/);
const type=h.screws[0].type, wrong=rules.shapes.find(s=>s!==type);
h=rules.apply(h,`screw:0:${wrong}`);
assert.equal(h.screws[0].stripped,true);
for(let i=1;i<=3;i++) {h=rules.apply(h,`screw:0:${type}`);assert.equal(h.screws[0].turns,i);assert.equal(h.screws[0].removed,i===3);}
assert.equal(rules.apply(h,`screw:0:${type}`),h,'Removed screws cannot be stripped again');
for(let i=1;i<8;i++)h=rules.apply(h,`screw:${i}:${h.screws[i].type}`);
assert.equal(h.phase,1);
assert.equal(rules.publicView(h,true).instructions,undefined,'Closed card must not leak its order');
h=rules.apply(h,'card:open');
assert.equal(rules.publicView(h,true).instructions.length,12);
assert.throws(()=>rules.apply(h,`cut:${h.order[0]}`),/Put the note away/);
h=rules.apply(h,'card:close');
for(let mistake=1;mistake<=3;mistake++) {
  h=rules.apply(h,`cut:${h.order.find(c=>!h.cut.includes(c)&&c!==rules.nextWire(h))}`);
  assert.equal(h.mistakes,mistake);
  assert.equal(rules.tier('yellow',h),mistake===1?'yellow':mistake===2?'orange':'off');
}
while(h.phase===1)h=rules.apply(h,`cut:${rules.nextWire(h)}`);
assert.equal(h.cut.length,12);assert.equal(h.phase,2);
assert.equal(rules.tier('green',h),'off');
assert.deepEqual(Object.keys(rules.publicView(h,false)).sort(),['cutCount','phase','removed']);
let bot=rules.create();let actions=0;
while(bot.phase<2) {bot=rules.apply(bot,rules.botCommand(bot));assert.ok(++actions<30);}
assert.equal(bot.mistakes,0);assert.equal(actions,22);

// Exercise the actual authenticated action dispatcher and revision/write path.
const source=await readFile(new URL('../netlify/functions/_data.js',import.meta.url),'utf8');
let now=100000,stored;class Clock extends Date {static now(){return now;}}
const sandbox=vm.createContext({crypto,Date:Clock,Math,Promise,require:name=>{assert.equal(name,'./safe-cracker/heist');return rules;},
  int:(v,d=0)=>Number.isFinite(Number(v))?Math.trunc(Number(v)):d,cleanUserId:v=>String(v||''),mpCleanId:v=>String(v||''),
  duelGetRawStrong:async()=>structuredClone(stored),duelGetRaw:async()=>structuredClone(stored),
  duelSaveGame:async g=>{stored=structuredClone({...g,revision:(g.revision||0)+1});return structuredClone(stored);},
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
