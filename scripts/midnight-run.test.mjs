import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {PGlite} from '@electric-sql/pglite';
const require=createRequire(import.meta.url),rules=require('../shared/games/midnight-run');
const {createStore,publicGame,draw}=require('../netlify/functions/midnight-run/database');
const {createWallet}=require('../netlify/functions/rps/wallet'),{createHandler}=require('../netlify/functions/midnight-run-action');
const purchase=(stake=50000,autoBlock=null)=>({stake,autoBlock,quote:rules.build,requestId:crypto.randomUUID()});
const cash=s=>({gameId:s.id,requestId:crypto.randomUUID()});
async function fixture(){
 const pg=new PGlite();let tail=Promise.resolve(),failure=null,clock=Date.now(),random=()=>0;
 const pool={query:(s,a)=>pg.query(s,a),connect:async()=>{let release;const prior=tail;tail=new Promise(r=>release=r);await prior;return {query:(s,a)=>pg.query(s,a),release};}};
 const records=new Map(['101','202'].map(id=>['user/legacy-'+id+'.json',{version:1,data:{balanceUnit:'tickets',ledgerStartedAt:'today',balanceBaseline:2000000000,financialLedger:[]}}]));
 const blob={get:async key=>key.startsWith('torn-link/')?{userId:'legacy-'+key.match(/\d+/)[0]}:structuredClone(records.get(key)?.data),getWithMetadata:async key=>{const r=records.get(key);return {data:structuredClone(r.data),etag:String(r.version)};},set:async(key,value,options)=>{const r=records.get(key);if(String(r.version)!==options.onlyIfMatch)return {modified:false};r.data=JSON.parse(value);r.version++;if(failure&&r.data.financialLedger.at(-1).id.includes(':'+failure+':')){failure=null;throw Error('Lost wallet response');}return {modified:true};}};
 const wallet=createWallet(blob),store=createStore(pool,wallet,n=>random(n),()=>clock),a={id:'101'},b={id:'202'};
 await store.ready();return {pg,pool,wallet,store,a,b,records,blob,fail:kind=>failure=kind,at:n=>clock=n,random:fn=>random=fn,entries:()=>records.get('user/legacy-101.json').data.financialLedger};
}
test('every reachable block and stake: exact capped arithmetic, increasing returns and optimal-stopping house advantage',()=>{
 for(const stake of rules.stakes){
  let probabilityNumerator=1n,probabilityDenominator=1n,previous=0;
  const last=rules.lastBlock(stake);
  for(let block=1;block<=last;block++){
   probabilityNumerator*=BigInt(rules.safePercent[block-1]);probabilityDenominator*=100n;
   const exact=BigInt(stake)*90n*probabilityDenominator/(100n*probabilityNumerator),expected=Number(exact>50000000n?50000000n:exact);
   const paid=rules.payout(stake,block);assert.equal(paid,expected);assert.ok(Number.isSafeInteger(paid)&&paid<=rules.maxPayout&&paid>previous);previous=paid;
   assert.ok(BigInt(paid)*probabilityNumerator*10n<=BigInt(stake)*probabilityDenominator*9n);
  }
  assert.equal(rules.payout(stake,last),rules.maxPayout);
  let best=rules.payout(stake,last);for(let block=last-1;block>=1;block--)best=Math.max(rules.payout(stake,block),rules.safePercent[block]/100*best);
  assert.ok(best*.8/stake<=.90000000001,'Adaptive stopping cannot remove the entry edge');
  assert.ok(rules.validAuto(null,stake));assert.ok(!rules.validAuto(0,stake));assert.ok(!rules.validAuto(last+1,stake));
 }
 for(const n of [-1,1.5,25,NaN])assert.throws(()=>rules.ratio(n));assert.throws(()=>rules.payout(1,1));
 assert.equal(rules.clearedAt(rules.blockMs-1),0);assert.equal(rules.clearedAt(rules.blockMs),1);
});
test('route draws have exact thresholds and never reveal a future block',()=>{
 assert.equal(draw(50000,()=>99),1);assert.equal(draw(50000,()=>79),7);
 assert.equal(draw(50000,()=>0),rules.lastBlock(50000)+1);
 const s={id:'ABCDEF123456',owner:'101',account:'private',stake:50000,autoBlock:null,caughtBlock:5,status:'active',startedAt:1000,evaluatedAt:1000+rules.blockMs*3};
 const p=publicGame(s);assert.equal(p.cleared,3);assert.equal(p.bank,rules.payout(50000,3));
 for(const key of ['caughtBlock','owner','account','payout','endedAt','evaluatedAt'])assert.equal(p[key],undefined);
});
test('real wallet, simultaneous purchases, ownership, ignored client prizes and exactly-once escape',async()=>{
 const f=await fixture();try{
  const body={...purchase(),caughtBlock:1,startedAt:0,payout:900000000};const [s,t]=await Promise.all([f.store.start(f.a,body),f.store.start(f.a,purchase(100000,2))]);
  assert.equal(s.id,t.id);assert.equal(s.stake,50000);assert.equal(f.entries().length,1);assert.equal(await f.wallet.balance(f.a),1999950000);
  await assert.rejects(f.store.cashout(f.b,cash(s)),e=>e.status===404);await assert.rejects(f.store.cashout(f.a,cash(s)),/Clear the first block/);
  f.at(s.startedAt+rules.blockMs+200);const [win,retry]=await Promise.all([f.store.cashout(f.a,{...cash(s),cleared:24,payout:900000000}),f.store.cashout(f.a,cash(s))]);
  assert.equal(win.payout,56250);assert.equal(retry.payout,56250);assert.equal(win.cleared,1);assert.equal(f.entries().length,2);assert.equal(await f.wallet.balance(f.a),2000006250);
  assert.equal((await f.store.start(f.a,body)).id,s.id);assert.equal(f.entries().length,2);
  assert.notEqual((await f.store.start(f.a,purchase())).id,s.id);
 }finally{await f.pg.close();}
});
test('capture wins exact boundary; tampered timestamps cannot reverse losses',async()=>{
 const f=await fixture();try{
  let count=0;f.random(()=>++count===2?99:0);const s=await f.store.start(f.a,purchase(50000,2));assert.equal(s.caughtBlock,2);
  f.at(s.startedAt+rules.blockMs*2);const loss=await f.store.cashout(f.a,{...cash(s),receivedAt:s.startedAt,timestamp:1,autoBlock:1});
  assert.equal(loss.outcome,'caught');assert.equal(loss.payout,0);assert.equal(loss.cleared,1);
  assert.equal((await f.store.cashout(f.a,cash(s))).payout,0);assert.equal(f.entries().length,2);
 }finally{await f.pg.close();}
});
test('manual escape uses verified receipt time before queueing for the database',async()=>{
 const f=await fixture();try{
  let n=0;f.random(()=>++n===2?99:0);const s=await f.store.start(f.a,purchase());f.at(s.startedAt+rules.blockMs+100);
  const connect=f.pool.connect;f.pool.connect=async()=>{f.at(s.startedAt+rules.blockMs*3);return connect();};
  const win=await f.store.cashout(f.a,cash(s));assert.equal(win.outcome,'escape');assert.equal(win.payout,56250);
 }finally{await f.pg.close();}
});
test('saved escape and maximum return settle after disconnect at every wager',async()=>{
 const f=await fixture();try{
  for(const stake of rules.stakes){
   const s=await f.store.start(f.a,purchase(stake));f.at(s.startedAt+3600000);const win=await f.store.current(f.a);
   assert.equal(win.outcome,'limit');assert.equal(win.payout,50000000);assert.equal(win.cleared,rules.lastBlock(stake));
   assert.equal((await f.store.cashout(f.a,cash(s))).payout,50000000);
  }
  let count=0;f.random(()=>++count===3?99:0);const s=await f.store.start(f.a,purchase(50000,2));f.at(s.startedAt+86400000);
  assert.equal((await f.store.current(f.a)).payout,rules.payout(50000,2));assert.equal(f.entries().length,14);
 }finally{await f.pg.close();}
});
test('lost wallet debit or credit responses recover immutable receipts without rerolls',async()=>{
 const f=await fixture();try{
  const body=purchase(50000,1);f.fail('stake');await assert.rejects(f.store.start(f.a,body),/Lost wallet/);assert.equal(f.entries().length,1);
  f.random(()=>99);let s=await f.store.start(f.a,body);assert.ok(s.caughtBlock>1);assert.equal(f.entries().length,1);
  f.at(s.startedAt+rules.blockMs);f.fail('payout');await assert.rejects(f.store.current(f.a),/Lost wallet/);assert.equal(f.entries().length,2);
  s=await f.store.current(f.a);assert.equal(s.status,'settled');assert.equal(s.payout,56250);assert.equal(f.entries().length,2);
  await f.store.start(f.a,body);assert.equal(f.entries().length,2);
 }finally{await f.pg.close();}
});
test('failed funding is not playable and cannot block a later funded run',async()=>{
 const f=await fixture();try{
  f.records.get('user/legacy-101.json').data.balanceBaseline=0;
  await assert.rejects(f.store.start(f.a,purchase()),/Not enough/);assert.equal(await f.store.current(f.a),null);assert.equal(f.entries().length,0);
  f.records.get('user/legacy-101.json').data.balanceBaseline=500000;const s=await f.store.start(f.a,purchase());assert.equal(s.status,'active');
 }finally{await f.pg.close();}
});
test('endpoint validates auth and quotes, excludes secrets, and active polls skip wallet reads',async()=>{
 const f=await fixture();try{
  let reads=0;const handler=createHandler(f.store,{authenticate:async token=>token==='valid'?f.a:null},{balance:async p=>{reads++;return f.wallet.balance(p);}});
  const request=b=>handler(new Request('http://local',{method:'POST',body:JSON.stringify(b)}));
  assert.equal((await request({action:'current'})).status,401);assert.equal((await request({action:'grant',token:'valid'})).status,400);
  assert.equal((await request({action:'start',token:'valid',...purchase(),quote:'stale'})).status,400);
  assert.equal((await request({action:'start',token:'valid',...purchase(1)})).status,400);
  const response=await request({action:'start',token:'valid',...purchase()});assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('x-midnight-run-build'),rules.build);
  const start=await response.json();assert.equal(start.game.caughtBlock,undefined);const previous=reads;
  await request({action:'current',token:'valid'});assert.equal(reads,previous);
  assert.equal((await handler(new Request('http://local'))).status,405);
  assert.equal((await handler(new Request('http://local',{method:'POST',body:'['}))).status,400);
  assert.equal((await handler(new Request('http://local',{method:'POST',body:'x'.repeat(5000)}))).status,413);
  await assert.rejects(f.wallet.apply('legacy-101',{id:'midnight:forged:payout:101',delta:50000000}),/Invalid wallet/);
 }finally{await f.pg.close();}
});
