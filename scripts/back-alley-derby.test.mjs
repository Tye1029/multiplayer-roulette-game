import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {PGlite} from '@electric-sql/pglite';
const require=createRequire(import.meta.url),R=require('../shared/games/back-alley-derby'),M=require('../assets/back-alley-derby/motion');
const {createStore,publicRound}=require('../netlify/functions/back-alley-derby/database'),{createHandler}=require('../netlify/functions/back-alley-derby-action'),{createWallet}=require('../netlify/functions/rps/wallet');
const ticket=(rat=0,stake=50000)=>({rat,stake,quote:R.build,requestId:crypto.randomUUID()});
test('exact weighted thresholds, all wagers/racers, integer payouts and immutable rules',()=>{
 const counts=Array(6).fill(0);for(let n=0;n<100;n++){let first=true;const order=R.draw(max=>{if(first){first=false;return n;}return max-1;});counts[order[0]]++;assert.equal(new Set(order).size,6);}
 assert.deepEqual(counts,R.rats.map(r=>r.chance));for(const rat of R.rats)for(const stake of R.stakes){const q=R.quote(stake,rat.id);assert.equal(q.payout,Number(BigInt(stake)*90n/BigInt(rat.chance)));assert.ok(q.payout*q.chance/stake<=.900000000001);const win=R.outcome(stake,rat.id,[rat.id,...R.rats.filter(r=>r.id!==rat.id).map(r=>r.id)]);assert.equal(win.payout,q.payout);assert.ok(Number.isSafeInteger(win.payout));}
 for(const rat of [-1,6,'0',0.5,NaN,'__proto__'])assert.throws(()=>R.quote(50000,rat));for(const stake of [-1,0,1,50000.1,'50000',Infinity])assert.throws(()=>R.quote(stake,0));assert.throws(()=>R.draw(()=>100));assert.throws(()=>R.outcome(50000,0,[0,0,1,2,3,4]));assert.ok(Object.isFrozen(R.rats[0]));
});
test('race curves are smooth, strictly forward and cross once in the saved order for 250 seeds',()=>{
 for(let seed=0;seed<250;seed++){const order=[0,1,2,3,4,5].sort((a,b)=>M.hash(seed+':'+a)-M.hash(seed+':'+b)),cross=[];for(let id=0;id<6;id++){let previous=0,crossed=false;for(let t=10;t<=R.raceMs;t+=10){const p=M.position(id,order,seed,t);assert.ok(p>=previous);if(p<1)assert.ok(p-previous>=.000249,'Every runner keeps at least 30% of the base forward pace');assert.ok(p-previous<.004,'No jumps');if(!crossed&&p>=1){cross.push([id,t]);crossed=true;}previous=p;}assert.equal(previous,1);}assert.deepEqual(cross.sort((a,b)=>a[1]-b[1]).map(x=>x[0]),order);}
});
async function fixture(){const pg=new PGlite();let tail=Promise.resolve(),now=100000,lost='',random=()=>0;const pool={query:(q,a)=>pg.query(q,a),connect:async()=>{let release;const prev=tail;tail=new Promise(r=>release=r);await prev;return {query:(q,a)=>pg.query(q,a),release};}};
 const records=new Map(['101','202'].map(id=>['user/'+id+'.json',{version:1,data:{balanceUnit:'tickets',ledgerStartedAt:'today',balanceBaseline:200000000,financialLedger:[]}}]));
 const blob={get:async k=>k.startsWith('torn-link/')?{userId:k.match(/\d+/)[0]}:structuredClone(records.get(k)?.data),getWithMetadata:async k=>({data:structuredClone(records.get(k).data),etag:String(records.get(k).version)}),set:async(k,v,o)=>{const r=records.get(k);if(String(r.version)!==o.onlyIfMatch)return {modified:false};r.data=JSON.parse(v);r.version++;if(lost&&r.data.financialLedger.at(-1).id.includes(':'+lost+':')){lost='';throw Error('Lost wallet response');}return {modified:true};}};
 const wallet=createWallet(blob),store=createStore(pool,wallet,n=>random(n),()=>now),a={id:'101'},b={id:'202'};return {pg,pool,wallet,store,a,b,records,clock:n=>now=n,random:f=>random=f,lose:s=>lost=s,entries:()=>records.get('user/101.json').data.financialLedger};}
test('locked ticket, server outcome, two windows, deadline, ownership and exactly-once payout',async()=>{const f=await fixture();try{
 const t=ticket(),[s,other]=await Promise.all([f.store.start(f.a,{...t,payout:999999999,order:[5,4,3,2,1,0],availableAt:0}),f.store.start(f.a,ticket(5))]);assert.equal(s.id,other.id);assert.equal(s.rat,0);assert.equal(s.status,'racing');assert.deepEqual(s.order,[0,1,2,3,4,5]);assert.equal(f.entries().length,1);assert.equal(await f.wallet.balance(f.a),199950000);
 const pub=publicRound(s);for(const field of ['account','owner','payout','winner','outcome'])assert.equal(pub[field],undefined);await assert.rejects(f.store.recover(f.b,s.id),e=>e.status===404);
 f.clock(s.availableAt-1);assert.equal((await f.store.current(f.a)).status,'racing');assert.equal(f.entries().length,1);f.clock(s.availableAt);const [x,y]=await Promise.all([f.store.current(f.a),f.store.recover(f.a,s.id)]);assert.equal(x.status,'settled');assert.equal(y.id,s.id);assert.equal(x.payout,150000);assert.equal(f.entries().length,2);assert.equal(await f.wallet.balance(f.a),200100000);
 assert.equal((await f.store.start(f.a,{...t,rat:5,stake:10000000})).id,s.id);assert.equal(f.entries().length,2);f.clock(s.availableAt+100);const next=await f.store.start(f.a,ticket(1));assert.notEqual(next.id,s.id);f.clock(next.availableAt);const loss=await f.store.current(f.a);assert.equal(loss.payout,0);assert.equal(await f.wallet.balance(f.a),200050000);
 }finally{await f.pg.close();}});
for(const lost of ['stake','payout'])test('lost '+lost+' wallet response recovers without reroll or duplicate money',async()=>{const f=await fixture();try{const b=ticket();let s;if(lost==='stake'){f.lose('stake');await assert.rejects(f.store.start(f.a,b),/Lost wallet/);f.random(n=>n-1);s=await f.store.start(f.a,b);assert.equal(s.winner,0);}else s=await f.store.start(f.a,b);f.clock(s.availableAt);if(lost==='payout'){f.lose('payout');await assert.rejects(f.store.current(f.a),/Lost wallet/);}const result=await f.store.current(f.a);assert.equal(result.payout,150000);assert.equal(f.entries().length,2);assert.equal(await f.wallet.balance(f.a),200100000);}finally{await f.pg.close();}});
test('invalid/stale tickets and insufficient funds never start a paid race',async()=>{const f=await fixture();try{for(const body of [{...ticket(),rat:6},{...ticket(),stake:'50000'},{...ticket(),quote:'old'},{...ticket(),requestId:'bad'}])await assert.rejects(f.store.start(f.a,body),e=>e.status===400);assert.equal(f.entries().length,0);f.records.get('user/101.json').data.balanceBaseline=1;await assert.rejects(f.store.start(f.a,ticket()),/Not enough/);assert.equal(f.entries().length,0);assert.equal(await f.store.current(f.a),null);await assert.rejects(f.wallet.apply('101',{id:'derby:fake:payout:101',delta:1}),/Invalid wallet/);}finally{await f.pg.close();}});
test('handler validates request/auth, hides private state, and ignores payout/timing input',async()=>{const f=await fixture();try{const handler=createHandler(f.store,{authenticate:async t=>t==='valid'?f.a:null},f.wallet),call=body=>handler(new Request('http://local',{method:'POST',body:JSON.stringify(body)}));assert.equal((await handler(new Request('http://local'))).status,405);assert.equal((await call(null)).status,400);assert.equal((await call({action:'pay'})).status,400);assert.equal((await call({action:'start',...ticket()})).status,401);assert.equal((await call({action:'start',token:'valid',...ticket(),junk:'x'.repeat(5000)})).status,413);const response=await call({action:'start',token:'valid',...ticket(),payout:9999999});assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('x-back-alley-derby-build'),R.build);const d=await response.json();assert.equal(d.round.payout,undefined);assert.equal(d.balance,199950000);}finally{await f.pg.close();}});

test('wide race gaps, repeatable paths and changing leaders without speed discontinuities',()=>{
 const order=[2,5,0,4,1,3],leaders=new Set();
 for(let seed=0;seed<1000;seed++){
  const plans=M.plan(order,seed),checkpoints=[1700,4000,6600,8700];let previousLeader=-1;
  for(const t of checkpoints){const ranking=M.ranking(order,seed,t);assert.notEqual(ranking[0],previousLeader,'Each burst produces a different leader');previousLeader=ranking[0];leaders.add(ranking.join());const gap=M.position(ranking[0],order,seed,t)-M.position(ranking[5],order,seed,t);assert.ok(gap>=.0839,'Pack visibly spreads out');}
  for(let id=0;id<6;id++)for(const t of plans[id].x.slice(1,-1)){const p=M.position(id,order,seed,t),left=p-M.position(id,order,seed,t-1),right=M.position(id,order,seed,t+1)-p;assert.ok(Math.abs(left-right)<.000001,'Continuous velocity through each change of pace');}
  assert.deepEqual(M.plan(order,seed),plans);
 }
 assert.ok(leaders.size>600,'Seeds produce varied formations');
});

test('an older tab confirms its own result after a second tab has started the next race',async()=>{
 const f=await fixture();try{
  const first=await f.store.start(f.a,ticket());f.clock(first.availableAt);
  await f.store.current(f.a);const next=await f.store.start(f.a,ticket(5));
  assert.equal((await f.store.current(f.a)).id,next.id);
  const recovered=await f.store.current(f.a,{raceId:first.id});assert.equal(recovered.id,first.id);assert.equal(recovered.status,'settled');assert.equal(recovered.payout,150000);
  assert.equal(f.entries().length,3,'Two debits, only the first result credited');
  await assert.rejects(f.store.current(f.b,{raceId:first.id}),e=>e.status===404);
  for(const raceId of [null,{},'../../../','a'.repeat(12),first.id+'x'])await assert.rejects(f.store.current(f.a,{raceId}),e=>e.status===400);
  assert.equal((await f.store.current(f.a,{raceId:next.id})).status,'racing');assert.equal(f.entries().length,3);
 }finally{await f.pg.close();}
});

test('a funded race from the previous build preserves its saved award across deployment',async()=>{
 const f=await fixture();try{
  const t=ticket(0),s=await f.store.start(f.a,t);s.quote='BACK_ALLEY_DERBY_V1';
  await f.pool.query('UPDATE back_alley_derby_rounds SET state=$2::jsonb WHERE id=$1',[s.id,JSON.stringify(s)]);
  f.clock(s.availableAt);const recovered=await f.store.start(f.a,{...t,quote:'BACK_ALLEY_DERBY_V1'});assert.equal(recovered.id,s.id);assert.equal(recovered.payout,s.payout);assert.equal(recovered.status,'settled');
  await assert.rejects(f.store.start(f.a,{...ticket(),quote:'BACK_ALLEY_DERBY_V1'}),e=>e.status===400);
 }finally{await f.pg.close();}
});
