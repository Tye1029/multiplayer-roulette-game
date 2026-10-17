import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {PGlite} from '@electric-sql/pglite';
const require=createRequire(import.meta.url),rules=require('../shared/games/jackpot-junction'),{draw,createStore,publicSpin}=require('../netlify/functions/jackpot-junction/database'),{createWallet}=require('../netlify/functions/rps/wallet'),{createHandler}=require('../netlify/functions/jackpot-junction-action');
test('exact 90% small-prize return, proportional jackpot probability, and honest displayed trios',()=>{
 assert.equal(rules.prizes.reduce((n,p)=>n+p.weight*p.multiplier,0)/rules.rollSize,.9);assert.equal(rules.housePercent+rules.jackpotPercent+rules.smallPrizePercent,100);
 for(const stake of rules.stakes){assert.ok(Number.isSafeInteger(rules.jackpotWeight(stake)));assert.equal(rules.jackpotWeight(stake)/stake,.0002);assert.ok(Number.isSafeInteger(stake*.06));let boundary=0;for(const prize of rules.prizes){let first=true;const d=draw(stake,n=>first?(first=false,boundary):0);assert.equal(d.smallPrize,stake*prize.multiplier);assert.deepEqual(d.reels,Array(3).fill(prize.symbol));boundary+=prize.weight;}
  let first=true;assert.equal(draw(stake,n=>first?(first=false,boundary+rules.jackpotWeight(stake)-1):0).kind,'jackpot');first=true;assert.equal(draw(stake,n=>first?(first=false,boundary+rules.jackpotWeight(stake)):0).kind,'miss');
 }
 const count={small:0,jackpot:0,miss:0};let paid=0;
 for(let roll=0;roll<rules.rollSize;roll++){let first=true;const d=draw(50000,n=>first?(first=false,roll):(roll+7)%n);count[d.kind]++;paid+=d.smallPrize;if(d.kind==='miss')assert.ok(!d.reels.every(v=>v===d.reels[0]));}
 assert.deepEqual(count,{small:399000,jackpot:10,miss:600990});assert.equal(paid/(50000*rules.rollSize),.9);
});
async function fixture(){
 const pg=new PGlite();let tail=Promise.resolve(),time=1800000000000,roll=999999,crashKind=null;
 const pool={query:(s,a)=>pg.query(s,a),connect:async()=>{let release;const prior=tail;tail=new Promise(r=>release=r);await prior;return {query:(s,a)=>pg.query(s,a),release};}};
 const records=new Map(['101','202'].map(id=>['user/old-'+id+'.json',{version:1,data:{balanceUnit:'tickets',ledgerStartedAt:'today',balanceBaseline:2000000000,financialLedger:[]}}]));
 const blob={get:async key=>key.startsWith('torn-link/')?{userId:'old-'+key.match(/\d+/)[0]}:structuredClone(records.get(key)?.data),getWithMetadata:async key=>{const r=records.get(key);return {data:structuredClone(r.data),etag:String(r.version)};},set:async(key,value,options)=>{const r=records.get(key);if(String(r.version)!==options.onlyIfMatch)return {modified:false};r.data=JSON.parse(value);r.version++;const last=r.data.financialLedger.at(-1);if(crashKind&&last.id.includes(':'+crashKind+':')){crashKind=null;throw Error('Lost wallet reply');}return {modified:true};}};
 const wallet=createWallet(blob),random=n=>n===rules.rollSize?roll:0,store=createStore(pool,wallet,random,()=>time),a={id:'101'},b={id:'202'},body=(stake=50000)=>({stake,requestId:crypto.randomUUID()});await store.ready();
 return {pg,pool,wallet,store,a,b,body,records,setRoll:n=>{roll=n;},advance:()=>{time+=5000;},crash:kind=>{crashKind=kind;},stats:async()=>(await pg.query('SELECT state FROM jackpot_junction_pool WHERE id=1')).rows[0].state};
}
test('shared pool seeds once, takes 6% per funded spin, pays regular wins separately, and awards the full jackpot once',async()=>{
 const f=await fixture();try{
  assert.deepEqual(await f.store.meter(),{amount:128338393,version:0,cycle:1});const body=f.body(),a=await f.store.spin(f.a,body);assert.equal(a.kind,'miss');assert.equal(await f.wallet.balance(f.a),1999950000);assert.equal((await f.store.meter()).amount,128341393);
  await f.store.spin(f.a,body);assert.equal((await f.store.meter()).version,1);assert.equal(f.records.get('user/old-101.json').data.financialLedger.length,2);
  await assert.rejects(f.store.spin(f.a,f.body()),e=>e.status===429);f.advance();f.setRoll(0);const small=await f.store.spin(f.a,f.body(100000));assert.equal(small.payout,100000);assert.equal((await f.store.meter()).amount,128347393);
  f.advance();f.setRoll(399000);const jackpot=await f.store.spin(f.a,f.body(10000000));assert.equal(jackpot.jackpotWon,128947393);assert.equal(jackpot.payout,128947393);assert.deepEqual(await f.store.meter(),{amount:0,version:3,cycle:2});await f.store.current(f.a);assert.equal((await f.store.meter()).amount,0);
  const stats=await f.stats();assert.equal(stats.contributed,609000);assert.equal(stats.house,406000);assert.equal(stats.smallPrizes,100000);assert.equal(stats.wagered,10150000);assert.equal(stats.smallReserve,9035000);assert.equal(stats.seed+stats.contributed-stats.paid,stats.amount);
  const another=createStore(f.pool,f.wallet);await another.ready();assert.equal((await another.meter()).amount,0,'Redeploy must not reseed the jackpot');
  f.advance();f.setRoll(999999);await f.store.spin(f.b,f.body());assert.equal((await f.store.meter()).amount,3000);assert.equal(publicSpin(jackpot).account,undefined);
 }finally{await f.pg.close();}
});
test('funding and payout crashes recover without duplicate contributions, jackpots, or wallet entries; parallel winners cannot claim the same pool',async()=>{
 const f=await fixture();try{
  f.crash('stake');const request=f.body();await assert.rejects(f.store.spin(f.a,request),/Lost wallet/);assert.equal(await f.wallet.balance(f.a),1999950000);assert.equal((await f.store.meter()).amount,rules.seed);const otherRequest=f.body();await f.store.spin(f.a,otherRequest);assert.equal((await f.store.meter()).amount,rules.seed+3000);await f.store.spin(f.a,request);assert.equal((await f.store.meter()).version,1);
  f.advance();f.setRoll(399000);f.crash('payout');const winning=f.body();await assert.rejects(f.store.spin(f.a,winning),/Lost wallet/);const paid=await f.wallet.balance(f.a);assert.equal((await f.store.meter()).amount,0);const recover=await f.store.current(f.a);assert.equal(recover.payout,rules.seed+6000);assert.equal(await f.wallet.balance(f.a),paid);assert.equal((await f.store.meter()).version,2);
  await f.store.spin(f.a,otherRequest);assert.equal((await f.store.meter()).version,2,'Old aliases cannot become new spins after settlement');
  f.advance();const wins=await Promise.all([f.store.spin(f.a,f.body()),f.store.spin(f.b,f.body())]);assert.equal(wins.reduce((n,s)=>n+s.payout,0),6000);assert.equal((await f.store.meter()).amount,0);assert.equal((await f.stats()).paid,rules.seed+12000);await assert.rejects(f.store.recover(f.b,recover.id),/not found/);
  const principal=f.records.get('user/old-202.json');principal.data.financialLedger.push({id:'external-spend',delta:-(await f.wallet.balance(f.b))});f.advance();const before=await f.store.meter();await assert.rejects(f.store.spin(f.b,f.body()),/Not enough/);assert.deepEqual(await f.store.meter(),before);
 }finally{await f.pg.close();}
});
test('API authentication, public jackpot, immutable stake/results, request validation and concurrent debits',async()=>{
 const f=await fixture();try{
  const h=createHandler(f.store,{authenticate:async token=>token==='valid'?f.a:null},f.wallet),call=b=>h(new Request('http://local',{method:'POST',body:JSON.stringify(b)}));
  assert.equal((await call({action:'meter'})).status,200);assert.equal((await call({action:'spin',...f.body()})).status,401);assert.equal((await call({action:'refund',token:'valid'})).status,400);assert.equal((await call({action:'spin',token:'valid',...f.body(1)})).status,400);
  const request={action:'spin',token:'valid',...f.body(),payout:9999999999,kind:'jackpot',owner:'202'};const responses=await Promise.all([call(request),call(request)]);assert.ok(responses.every(r=>r.status===200));const [a,b]=await Promise.all(responses.map(r=>r.json()));assert.equal(a.spin.id,b.spin.id);assert.equal(a.spin.payout,0);assert.equal(a.balance,1999950000);assert.equal((await f.store.meter()).version,1);
 }finally{await f.pg.close();}
});
