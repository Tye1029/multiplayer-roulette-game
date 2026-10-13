import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {PGlite} from '@electric-sql/pglite';
const require=createRequire(import.meta.url),rules=require('../shared/games/minefield'),{draw,createStore,publicGame}=require('../netlify/functions/minefield/database'),{createWallet}=require('../netlify/functions/rps/wallet'),{createHandler}=require('../netlify/functions/minefield-action');
const body=(stake=50000,mineCount=3)=>({stake,mineCount,returnPercent:rules.returnPercent,requestId:crypto.randomUUID()}),move=(s,action='reveal',tile=24)=>({action,tile,gameId:s.id,revision:s.revision,requestId:crypto.randomUUID()});
async function fixture(){
 const pg=new PGlite();let tail=Promise.resolve(),crash=null;const pool={query:(s,a)=>pg.query(s,a),connect:async()=>{let release;const previous=tail;tail=new Promise(r=>release=r);await previous;return {query:(s,a)=>pg.query(s,a),release};}};
 const records=new Map(['101','202'].map(id=>['user/legacy-'+id+'.json',{version:1,data:{balanceUnit:'tickets',ledgerStartedAt:'today',balanceBaseline:2000000000,financialLedger:[]}}]));
 const blob={get:async key=>key.startsWith('torn-link/')?{userId:'legacy-'+key.match(/\d+/)[0]}:structuredClone(records.get(key)?.data),getWithMetadata:async key=>{const r=records.get(key);return {data:structuredClone(r.data),etag:String(r.version)};},set:async(key,value,options)=>{const r=records.get(key);if(String(r.version)!==options.onlyIfMatch)return {modified:false};r.data=JSON.parse(value);r.version++;if(crash&&r.data.financialLedger.at(-1).id.includes(':'+crash+':')){crash=null;throw Error('Lost wallet reply');}return {modified:true};}};
 const wallet=createWallet(blob),store=createStore(pool,wallet,()=>0),a={id:'101'},b={id:'202'};await store.ready();return {pg,pool,wallet,store,a,b,records,crash:kind=>crash=kind,entries:()=>records.get('user/legacy-101.json').data.financialLedger};
}
test('every mine count and cash-out depth has a 90% expected return within whole-chip rounding',()=>{
 for(const m of rules.mineCounts){let probability=1,prior=0;for(let k=1;k<=25-m;k++){probability*=(25-m-k+1)/(25-k+1);for(const stake of rules.stakes){const payout=rules.payout(stake,m,k);assert.ok(Number.isSafeInteger(payout));assert.ok(payout*probability/stake<=.9000000001);assert.ok(.90-payout*probability/stake<1/stake+1e-12);assert.ok(Math.abs(rules.multiplier(m,k)*probability-.90)<1e-10);}assert.ok(rules.payout(50000,m,k)>prior);prior=rules.payout(50000,m,k);}}
 assert.equal(rules.payout(50000,3,1),51136);assert.equal(rules.payout(50000,3,1),51136);assert.equal(rules.payout(50000,15,1),112500);assert.equal(rules.payout(50000,3,0),0);assert.throws(()=>rules.payout(1,3,1));assert.throws(()=>rules.ratio(25,1));
});
test('mine sampling produces unique positions with unbiased selectable first positions',()=>{
 for(const m of rules.mineCounts)for(const random of [()=>0,n=>n-1,n=>Math.floor(n/2)]){const a=draw(m,random);assert.equal(new Set(a).size,m);assert.ok(a.every(i=>i>=0&&i<25));}
 for(let i=0;i<25;i++)assert.ok(draw(3,n=>i%n).includes(i));for(const n of [0,1,2,4,5,7,10,24,25])assert.throws(()=>draw(n));
});
test('one active field, private board, immutable wager and idempotent cash-out with the existing ledger',async()=>{
 const f=await fixture();try{
  const first=body(),alias=body(100000,9),[s,t]=await Promise.all([f.store.start(f.a,first),f.store.start(f.a,alias)]);assert.equal(s.id,t.id);assert.equal(f.entries().length,1);assert.equal(await f.wallet.balance(f.a),1999950000);
  const view=publicGame(s);for(const key of ['mines','account','owner','actions'])assert.equal(view[key],undefined);assert.equal(view.revealed.length,0);assert.equal(view.cashout,0);assert.equal(view.nextPayout,51136);
  await assert.rejects(f.store.action(f.b,move(s)),e=>e.status===404);
  const reveal={...move(s),stake:1,payout:999999999,returnPercent:96,mines:[],owner:'202'};const safe=await f.store.action(f.a,reveal);assert.deepEqual(safe.revealed,[24]);assert.equal(publicGame(safe).cashout,51136);assert.equal((await f.store.action(f.a,reveal)).revision,1);
  const payout=move(safe,'cashout'),paid=await f.store.action(f.a,payout);assert.equal(paid.status,'settled');assert.equal(paid.payout,51136);assert.equal(await f.wallet.balance(f.a),2000001136);await f.store.action(f.a,payout);await f.store.start(f.a,first);await f.store.start(f.a,alias);assert.equal(f.entries().length,2);assert.deepEqual(publicGame(paid).mines,[0,1,2]);
  const next=await f.store.start(f.a,body());assert.notEqual(next.id,s.id);assert.equal(f.entries().length,3);
 }finally{await f.pg.close();}
});
test('mine losses cannot be cashed out; clearing the final safe tile automatically pays once',async()=>{
 const f=await fixture();try{
  const s=await f.store.start(f.a,body()),lost=await f.store.action(f.a,move(s,'reveal',0));assert.equal(lost.status,'settled');assert.equal(lost.outcome,'mine');assert.equal(lost.payout,0);assert.equal(publicGame(lost).hit,0);await assert.rejects(f.store.action(f.a,move(lost,'cashout')),e=>e.status===409);assert.equal(await f.wallet.balance(f.a),1999950000);
  let clear=await f.store.start(f.a,body(50000,3));for(let i=3;i<25;i++)clear=await f.store.action(f.a,move(clear,'reveal',i));assert.equal(clear.outcome,'clear');assert.equal(clear.payout,103500000);assert.equal(clear.status,'settled');const balance=await f.wallet.balance(f.a);await f.store.current(f.a);assert.equal(await f.wallet.balance(f.a),balance);
  let hard=await f.store.start(f.b,body(50000,15));for(let tile=15;tile<25;tile++)hard=await f.store.action(f.b,move(hard,'reveal',tile));assert.equal(hard.payout,147094200000);assert.equal(hard.outcome,'clear');
 }finally{await f.pg.close();}
});
test('stale/parallel reveals and cash-out races cannot spend a second move or change the winning amount',async()=>{
 const f=await fixture();try{
  let s=await f.store.start(f.a,body());await assert.rejects(f.store.action(f.a,move(s,'cashout')),e=>e.status===409);
  const results=await Promise.allSettled([f.store.action(f.a,move(s,'reveal',24)),f.store.action(f.a,move(s,'reveal',23))]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);s=await f.store.current(f.a);assert.equal(s.revealed.length,1);
  const race=await Promise.allSettled([f.store.action(f.a,move(s,'cashout')),f.store.action(f.a,move(s,'reveal',0))]);assert.equal(race.filter(r=>r.status==='fulfilled').length,1);const end=await f.store.current(f.a);assert.equal(end.outcome,'cashout');assert.equal(end.payout,51136);assert.equal(f.entries().length,2);
 }finally{await f.pg.close();}
});
test('lost debit/payout responses recover the immutable field without duplicate wallet entries',async()=>{
 const f=await fixture();try{
  f.crash('stake');const start=body();await assert.rejects(f.store.start(f.a,start),/Lost wallet/);assert.equal(await f.wallet.balance(f.a),1999950000);let s=await f.store.current(f.a);assert.equal(s.status,'active');assert.equal(f.entries().length,1);assert.equal((await f.store.start(f.a,start)).id,s.id);
  s=await f.store.action(f.a,move(s));f.crash('payout');const cashout=move(s,'cashout');await assert.rejects(f.store.action(f.a,cashout),/Lost wallet/);const stored=(await f.pg.query('SELECT state FROM minefield_games WHERE id=$1',[s.id])).rows[0].state;assert.equal(stored.status,'paying');assert.equal(stored.payout,51136);const balance=await f.wallet.balance(f.a);s=await f.store.current(f.a);assert.equal(s.status,'settled');await f.store.action(f.a,cashout);assert.equal(await f.wallet.balance(f.a),balance);assert.equal(f.entries().length,2);
  await assert.rejects(f.store.action(f.a,{...cashout,action:'reveal',tile:0}),e=>e.status===400);
 }finally{await f.pg.close();}
});
test('API authorization, invalid actions, insufficient funds and owner isolation',async()=>{
 const f=await fixture();try{
  const h=createHandler(f.store,{authenticate:async token=>token==='valid'?f.a:token==='other'?f.b:null},f.wallet),call=b=>h(new Request('http://local',{method:'POST',body:JSON.stringify(b)}));
  assert.equal((await call({action:'current'})).status,401);assert.equal((await call({action:'refund',token:'valid'})).status,400);for(const b of [body(1),body(50000,0),body(50000,25),body(50000,10),body(50000,1.5),{...body(),returnPercent:96},{...body(),returnPercent:undefined}])assert.equal((await call({action:'start',token:'valid',...b})).status,400);
  const s=(await (await call({action:'start',token:'valid',...body(),mines:[],payout:99})).json()).game;assert.equal(s.mines,undefined);assert.equal((await call({action:'reveal',token:'other',...move(s)})).status,404);for(const tile of [-1,25,1.5,'1'])assert.equal((await call({token:'valid',...move(s,'reveal',tile)})).status,400);
  const owner=f.records.get('user/legacy-202.json');owner.data.financialLedger.push({id:'external-spend',delta:-2000000000});await assert.rejects(f.store.start(f.b,body()),/Not enough/);assert.equal(await f.store.current(f.b),null);assert.equal(await f.wallet.balance(f.b),0);
  assert.equal((await h(new Request('http://local',{method:'GET'}))).status,405);assert.equal((await h(new Request('http://local',{method:'POST',body:'x'.repeat(4097)}))).status,413);
 }finally{await f.pg.close();}
});

test('five risk levels scale multipliers by survival probability; wager size cannot improve expected return',()=>{
 assert.deepEqual(rules.mineCounts,[3,6,9,12,15]);
 assert.deepEqual(rules.mineCounts.map(m=>rules.payout(50000,m,1)),[51136,59210,70312,86538,112500]);
 for(let k=1;k<=10;k++){let last=0;for(const m of rules.mineCounts){const value=rules.multiplier(m,k);assert.ok(value>last);last=value;}}
 const p=(16/25)*(15/24)*(14/23);assert.ok(Math.abs(rules.multiplier(9,3)*p-.9)<1e-12);
 assert.throws(()=>rules.ratio(3,1,100));assert.throws(()=>rules.payout(50000,3,-1));
});

test('unfinished legacy fields keep their old mine count and 96% payout through settlement and retries',async()=>{
 const f=await fixture();try{
  const purchase=body();let s=await f.store.start(f.a,purchase);s.mineCount=10;s.mines=Array.from({length:10},(_,i)=>i);delete s.returnPercent;
  await f.pg.query('UPDATE minefield_games SET state=$2::jsonb WHERE id=$1',[s.id,JSON.stringify(s)]);
  const retry={...purchase,mineCount:10};delete retry.returnPercent;
  const recovered=await f.store.start(f.a,retry);assert.equal(recovered.id,s.id);assert.equal(publicGame(recovered).returnPercent,96);assert.equal(publicGame(recovered).nextPayout,80000);assert.equal(f.entries().length,1);
  s=await f.store.action(f.a,move(recovered));const cashed=await f.store.action(f.a,move(s,'cashout'));assert.equal(cashed.payout,80000);assert.equal(publicGame(cashed).multiplier,1.6);
  await assert.rejects(f.store.start(f.a,{...body(),returnPercent:96}),e=>e.status===400);assert.equal(f.entries().length,2);
  const fresh=await f.store.start(f.a,body());assert.equal(fresh.returnPercent,90);assert.equal(publicGame(fresh).nextPayout,51136);
 }finally{await f.pg.close();}
});
