import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {PGlite} from '@electric-sql/pglite';
const require=createRequire(import.meta.url),rules=require('../shared/games/plinko'),{createStore,draw,publicDrop}=require('../netlify/functions/plinko/database'),{createWallet}=require('../netlify/functions/rps/wallet'),{createHandler}=require('../netlify/functions/plinko-action');
const purchase=(stake=50000,risk='high')=>({stake,risk,quote:rules.build,requestId:crypto.randomUUID()});
async function fixture(){
 const pg=new PGlite();let tail=Promise.resolve(),crash=null,clock=Date.now();const pool={query:(s,a)=>pg.query(s,a),connect:async()=>{let release;const prior=tail;tail=new Promise(r=>release=r);await prior;return {query:(s,a)=>pg.query(s,a),release};}};
 const records=new Map(['101','202'].map(id=>['user/legacy-'+id+'.json',{version:1,data:{balanceUnit:'tickets',ledgerStartedAt:'today',balanceBaseline:2000000000,financialLedger:[]}}]));
 const blob={get:async key=>key.startsWith('torn-link/')?{userId:'legacy-'+key.match(/\d+/)[0]}:structuredClone(records.get(key)?.data),getWithMetadata:async key=>{const r=records.get(key);return {data:structuredClone(r.data),etag:String(r.version)};},set:async(key,value,options)=>{const r=records.get(key);if(String(r.version)!==options.onlyIfMatch)return {modified:false};r.data=JSON.parse(value);r.version++;if(crash&&r.data.financialLedger.at(-1).id.includes(':'+crash+':')){crash=null;throw Error('Lost wallet reply');}return {modified:true};}};
 const wallet=createWallet(blob),store=createStore(pool,wallet,()=>0,()=>clock),a={id:'101'},b={id:'202'};await store.ready();return {pg,pool,wallet,store,a,b,records,crash:kind=>crash=kind,tick:()=>clock+=rules.dropMs,entries:()=>records.get('user/legacy-101.json').data.financialLedger};
}
test('exhaustive 65,536 paths: fair binomial pockets, symmetric payouts, all stakes capped, positive expected house return',()=>{
 const observed=Array(17).fill(0);for(let mask=0;mask<65536;mask++){const path=Array.from({length:16},(_,i)=>mask>>i&1),s=rules.outcome(50000,'high',path);observed[s.bucket]++;assert.equal(s.payout,rules.payout(50000,'high',s.bucket));}
 assert.deepEqual(observed,rules.weights);assert.equal(observed.reduce((a,b)=>a+b),65536);
 for(const risk of Object.keys(rules.risks))for(const stake of rules.stakes){let weighted=0n;for(let k=0;k<17;k++){const p=rules.payout(stake,risk,k);assert.ok(Number.isSafeInteger(p)&&p>0&&p<=50000000);assert.equal(p,rules.payout(stake,risk,16-k));assert.equal(rules.multiplier(stake,risk,k),p/stake);weighted+=BigInt(p)*BigInt(observed[k]);}assert.ok(weighted*10n<=BigInt(stake)*65536n*9n);assert.ok(rules.expectedReturn(stake,risk)>0);}
 assert.equal(rules.payout(50000,'high',0),50000000);assert.equal(rules.payout(10000000,'high',0),50000000);assert.equal(rules.payout(50000,'high',8),5000);
 for(const risk of ['bad','__proto__','constructor',['low']])assert.throws(()=>rules.table(risk));assert.throws(()=>rules.outcome(50000,'low',[1]));assert.throws(()=>rules.outcome(50000,'low',Array(16).fill(2)));assert.throws(()=>rules.payout(1,'low',0));assert.throws(()=>rules.payout(50000,'low',17));
});
test('real wallet: capped server-owned result, immutable input, duplicate and concurrent purchases, cooldown and ownership',async()=>{
 const f=await fixture();try{
  const b={...purchase(),payout:999999999999,multiplier:999999,bucket:8,path:Array(16).fill(1),maxPayout:null};const [s,t]=await Promise.all([f.store.drop(f.a,b),f.store.drop(f.a,b)]);assert.equal(s.id,t.id);assert.equal(s.bucket,0);assert.equal(s.payout,50000000);assert.deepEqual(s.path,Array(16).fill(0));assert.equal(f.entries().length,2);assert.equal(await f.wallet.balance(f.a),2049950000);
  assert.equal(publicDrop(s).account,undefined);assert.equal(publicDrop(s).owner,undefined);assert.equal(publicDrop({...s,status:'funding'}).path,undefined);await assert.rejects(f.store.recover(f.b,s.id),e=>e.status===404);
  await assert.rejects(f.store.drop(f.a,purchase()),e=>e.status===429);assert.equal(f.entries().length,2);f.tick();const next=await f.store.drop(f.a,purchase(100000,'low'));assert.notEqual(next.id,s.id);assert.equal(next.payout,800000);assert.equal((await f.store.history(f.a)).length,2);assert.equal((await f.store.history(f.b)).length,0);
 }finally{await f.pg.close();}
});
test('lost debit and payout responses recover without duplicate charges or rerolling the path',async()=>{
 for(const kind of ['stake','payout']){const f=await fixture();try{
  f.crash(kind);const b=purchase();await assert.rejects(f.store.drop(f.a,b),/Lost wallet reply/);const held=(await f.pg.query('SELECT state FROM plinko_drops')).rows[0].state;assert.equal(held.status,kind==='stake'?'funding':'awarded');const originalPath=[...held.path];
  const [a,c]=await Promise.all([f.store.current(f.a),f.store.drop(f.a,b)]);assert.equal(a.id,c.id);assert.deepEqual(a.path,originalPath);assert.equal(a.status,'settled');assert.equal(f.entries().length,2);assert.equal(await f.wallet.balance(f.a),2049950000);
 }finally{await f.pg.close();}}
});
test('pending purchase aliases recover the same drop; failed funds cannot expose a playable result or prevent retry',async()=>{
 const f=await fixture();try{
  f.crash('stake');await assert.rejects(f.store.drop(f.a,purchase()),/Lost wallet/);const alias=purchase(100000,'low'),recovered=await f.store.drop(f.a,alias);assert.equal(recovered.stake,50000);assert.equal(recovered.risk,'high');assert.equal(f.entries().length,2);await f.store.drop(f.a,alias);assert.equal(f.entries().length,2);
  f.records.get('user/legacy-202.json').data.financialLedger.push({id:'external-spend',delta:-2000000000});await assert.rejects(f.store.drop(f.b,purchase()),/Not enough/);assert.equal(await f.store.current(f.b),null);assert.equal((await f.store.history(f.b)).length,0);
  f.records.get('user/legacy-202.json').data.financialLedger.push({id:'external-fund',delta:500000});assert.equal((await f.store.drop(f.b,purchase())).status,'settled');
 }finally{await f.pg.close();}
});
test('API validates authentication, quote, stakes and risk; current and history are owner-bound and no-store',async()=>{
 const f=await fixture();try{
  const handler=createHandler(f.store,{authenticate:async t=>t==='valid'?f.a:t==='other'?f.b:null},f.wallet),call=b=>handler(new Request('http://local',{method:'POST',body:JSON.stringify(b)}));
  assert.equal((await call({action:'current'})).status,401);for(const b of [{...purchase(),quote:undefined},{...purchase(),risk:'__proto__'},{...purchase(),risk:0},{...purchase(),stake:1},{...purchase(),requestId:'fake'}])assert.equal((await call({action:'drop',token:'valid',...b})).status,400);
  assert.equal(f.entries().length,0);const response=await call({action:'drop',token:'valid',...purchase()});assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('x-plinko-build'),'PLINKO_V1');const s=await response.json();assert.equal(s.drop.payout,50000000);assert.equal(s.history.length,1);assert.equal(s.history[0].path,undefined);assert.equal(s.drop.account,undefined);
  const other=await (await call({action:'current',token:'other'})).json();assert.equal(other.drop,null);assert.deepEqual(other.history,[]);assert.equal((await call({action:'claim',token:'valid'})).status,400);assert.equal((await handler(new Request('http://local'))).status,405);assert.equal((await handler(new Request('http://local',{method:'POST',body:'x'.repeat(4097)}))).status,413);
 }finally{await f.pg.close();}
});
test('production random sampler permits every direction without client control',()=>{
 assert.deepEqual(draw(50000,'low',()=>0).path,Array(16).fill(0));assert.deepEqual(draw(50000,'low',()=>1).path,Array(16).fill(1));let n=0;assert.equal(draw(50000,'medium',()=>n++%2).bucket,8);
});
