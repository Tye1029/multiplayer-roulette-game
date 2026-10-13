import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {PGlite} from '@electric-sql/pglite';
const require=createRequire(import.meta.url),rules=require('../shared/games/rocket-run'),{createStore,publicGame}=require('../netlify/functions/rocket-run/database'),{createWallet}=require('../netlify/functions/rps/wallet'),{createHandler}=require('../netlify/functions/rocket-run-action');
const purchase=(stake=50000,autoCents=null)=>({stake,autoCents,quote:rules.build,requestId:crypto.randomUUID()});
const cash=s=>({gameId:s.id,requestId:crypto.randomUUID()});
async function fixture(){
 const pg=new PGlite();let tail=Promise.resolve(),failure=null,clock=Date.now(),draw=0;
 const pool={query:(s,a)=>pg.query(s,a),connect:async()=>{let release;const prior=tail;tail=new Promise(r=>release=r);await prior;return {query:(s,a)=>pg.query(s,a),release};}};
 const records=new Map(['101','202'].map(id=>['user/legacy-'+id+'.json',{version:1,data:{balanceUnit:'tickets',ledgerStartedAt:'today',balanceBaseline:2000000000,financialLedger:[]}}]));
 const blob={get:async key=>key.startsWith('torn-link/')?{userId:'legacy-'+key.match(/\d+/)[0]}:structuredClone(records.get(key)?.data),getWithMetadata:async key=>{const r=records.get(key);return {data:structuredClone(r.data),etag:String(r.version)};},set:async(key,value,options)=>{const r=records.get(key);if(String(r.version)!==options.onlyIfMatch)return {modified:false};r.data=JSON.parse(value);r.version++;if(failure&&r.data.financialLedger.at(-1).id.includes(':'+failure+':')){failure=null;throw Error('Lost wallet response');}return {modified:true};}};
 const wallet=createWallet(blob),store=createStore(pool,wallet,()=>draw,()=>clock),a={id:'101'},b={id:'202'};await store.ready();return {pg,pool,wallet,store,a,b,records,fail:kind=>failure=kind,at:n=>clock=n,draw:n=>draw=n,entries:()=>records.get('user/legacy-101.json').data.financialLedger};
}
test('all wagers and every hundredth multiplier: positive expected house return, integer capped payouts and monotonic flight clock',()=>{
 assert.equal(rules.crashFrom(rules.range-1),100);assert.equal(rules.crashFrom(0),90*rules.range);
 for(const stake of rules.stakes){for(let cents=100;cents<=rules.cap(stake);cents++){
  const p=rules.payout(stake,cents);assert.ok(Number.isSafeInteger(p)&&p<=rules.maxPayout);assert.ok(rules.survival(cents)*p/stake<.900001);
 }assert.equal(rules.payout(stake,rules.cap(stake)),rules.maxPayout);assert.ok(rules.validAuto(null,stake));assert.ok(!rules.validAuto(109,stake));assert.ok(!rules.validAuto(rules.cap(stake)+1,stake));}
 for(const n of [100,110,200,500,10000,100000])assert.equal(rules.centsAt(rules.timeAt(n)),n);
 for(const n of [-1,rules.range,NaN,1.5])assert.throws(()=>rules.crashFrom(n));assert.throws(()=>rules.payout(1,100));assert.throws(()=>rules.payout(50000,99));
});
test('real wallet: one funded flight, immutable inputs, hidden future, server-time cash-out and exactly-once settlement',async()=>{
 const f=await fixture();try{
  const b={...purchase(),payout:999999999,crashCents:100,launchAt:1};const [s,t]=await Promise.all([f.store.start(f.a,b),f.store.start(f.a,purchase(100000,200))]);assert.equal(s.id,t.id);assert.equal(s.stake,50000);assert.equal(s.autoCents,null);assert.equal(s.crashCents,90*rules.range);assert.equal(f.entries().length,1);assert.equal(await f.wallet.balance(f.a),1999950000);
  for(const k of ['crashCents','account','owner','payout'])assert.equal(publicGame(s)[k],undefined);
  await assert.rejects(f.store.cashout(f.b,cash(s)),e=>e.status===404);await assert.rejects(f.store.cashout(f.a,cash(s)),/Wait for liftoff/);
  f.at(s.launchAt+rules.timeAt(200));const [win,retry]=await Promise.all([f.store.cashout(f.a,{...cash(s),cashCents:99999,timestamp:s.launchAt}),f.store.cashout(f.a,cash(s))]);assert.equal(win.payout,100000);assert.equal(retry.payout,100000);assert.equal(win.cashCents,200);assert.equal(f.entries().length,2);assert.equal(await f.wallet.balance(f.a),2000050000);
  const old=await f.store.start(f.a,b);assert.equal(old.id,s.id);assert.equal(f.entries().length,2);const next=await f.store.start(f.a,purchase());assert.notEqual(next.id,s.id);
 }finally{await f.pg.close();}
});
test('immediate crash and exact ties beat cash-out; no client timestamp can reverse a loss',async()=>{
 const f=await fixture();try{
  f.draw(rules.range-1);let s=await f.store.start(f.a,purchase());f.at(s.launchAt);s=await f.store.cashout(f.a,{...cash(s),timestamp:0,cashCents:99999});assert.equal(s.outcome,'crash');assert.equal(s.payout,0);assert.equal(s.crashCents,100);assert.equal(await f.wallet.balance(f.a),1999950000);
  f.draw(Math.floor(90*rules.range/200)-1);s=await f.store.start(f.a,purchase(50000,200));assert.equal(s.crashCents,200);f.at(s.launchAt+rules.timeAt(200));assert.equal((await f.store.current(f.a)).outcome,'crash');assert.equal((await f.store.cashout(f.a,cash(s))).payout,0);
 }finally{await f.pg.close();}
});
test('automatic cash-out survives a long disconnect; cap settles without any client claim',async()=>{
 const f=await fixture();try{
  f.draw(Math.floor(90*rules.range/300)-1);let s=await f.store.start(f.a,purchase(50000,200));f.at(s.launchAt+3600000);s=await f.store.current(f.a);assert.equal(s.outcome,'auto');assert.equal(s.payout,100000);assert.equal(s.cashCents,200);
  f.draw(0);s=await f.store.start(f.a,purchase(10000000));f.at(s.launchAt+rules.timeAt(500)+1);s=await f.store.current(f.a);assert.equal(s.outcome,'limit');assert.equal(s.payout,50000000);assert.equal(f.entries().length,4);
 }finally{await f.pg.close();}
});
test('lost debit/payout responses and delayed retries cannot change the result or duplicate receipts',async()=>{
 for(const kind of ['stake','payout']){const f=await fixture();try{
  const b=purchase(50000,200);let s;if(kind==='stake'){f.fail(kind);await assert.rejects(f.store.start(f.a,b),/Lost wallet response/);const raw=(await f.pg.query('SELECT state FROM rocket_run_games')).rows[0].state;assert.equal(raw.status,'funding');s=await f.store.start(f.a,b);assert.equal(s.crashCents,raw.crashCents);}else s=await f.store.start(f.a,b);
  f.at(s.launchAt+rules.timeAt(150));if(kind==='payout'){f.fail(kind);await assert.rejects(f.store.cashout(f.a,cash(s)),/Lost wallet response/);assert.equal((await f.pg.query('SELECT state FROM rocket_run_games')).rows[0].state.status,'paying');f.at(s.launchAt+3600000);s=await f.store.current(f.a);assert.equal(s.cashCents,150);}else s=await f.store.cashout(f.a,cash(s));
  assert.equal(s.payout,75000);assert.equal(f.entries().length,2);assert.equal(await f.wallet.balance(f.a),2000025000);
 }finally{await f.pg.close();}}
});
test('insufficient funds cannot reveal a flight; API rejects invalid terms and keeps recovery owner-bound',async()=>{
 const f=await fixture();try{
  f.records.get('user/legacy-202.json').data.financialLedger.push({id:'external-spend',delta:-2000000000});await assert.rejects(f.store.start(f.b,purchase()),/Not enough/);assert.equal(await f.store.current(f.b),null);
  const handler=createHandler(f.store,{authenticate:async t=>t==='valid'?f.a:t==='other'?f.b:null},f.wallet),call=b=>handler(new Request('http://local',{method:'POST',body:JSON.stringify(b)}));
  assert.equal((await call({action:'current'})).status,401);
  for(const b of [{...purchase(),quote:null},{...purchase(),stake:1},{...purchase(),autoCents:'200'},{...purchase(),autoCents:100},{...purchase(10000000),autoCents:501},{...purchase(),requestId:'fake'}])assert.equal((await call({action:'start',token:'valid',...b})).status,400);
  assert.equal(f.entries().length,0);const response=await call({action:'start',token:'valid',...purchase()});assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('x-rocket-run-build'),rules.build);const data=await response.json();assert.ok(data.serverNow);assert.equal(data.game.crashCents,undefined);assert.equal(data.game.payout,undefined);
  assert.equal((await call({action:'cashout',token:'other',...cash(data.game)})).status,404);assert.equal((await call({action:'claim',token:'valid'})).status,400);assert.equal((await handler(new Request('http://local'))).status,405);assert.equal((await handler(new Request('http://local',{method:'POST',body:'x'.repeat(4097)}))).status,413);
 }finally{await f.pg.close();}
});
