import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {PGlite} from '@electric-sql/pglite';
const require=createRequire(import.meta.url),rules=require('../shared/games/dice-duel'),{createStore,draw,publicRound}=require('../netlify/functions/dice-duel/database'),{createWallet}=require('../netlify/functions/rps/wallet'),{createHandler}=require('../netlify/functions/dice-duel-action');
const purchase=(stake=50000)=>({stake,quote:rules.build,requestId:crypto.randomUUID()});
async function fixture(){
 const pg=new PGlite();let tail=Promise.resolve(),failure=null,clock=Date.now(),dice=[5,5,0,0],cursor=0;
 const pool={query:(s,a)=>pg.query(s,a),connect:async()=>{let release;const prior=tail;tail=new Promise(r=>release=r);await prior;return {query:(s,a)=>pg.query(s,a),release};}};
 const records=new Map(['101','202'].map(id=>['user/legacy-'+id+'.json',{version:1,data:{balanceUnit:'tickets',ledgerStartedAt:'today',balanceBaseline:2000000000,financialLedger:[]}}]));
 const blob={get:async key=>key.startsWith('torn-link/')?{userId:'legacy-'+key.match(/\d+/)[0]}:structuredClone(records.get(key)?.data),getWithMetadata:async key=>{const r=records.get(key);return {data:structuredClone(r.data),etag:String(r.version)};},set:async(key,value,options)=>{const r=records.get(key);if(String(r.version)!==options.onlyIfMatch)return {modified:false};r.data=JSON.parse(value);r.version++;if(failure&&r.data.financialLedger.at(-1).id.includes(':'+failure+':')){failure=null;throw Error('Lost wallet reply');}return {modified:true};}};
 const wallet=createWallet(blob),store=createStore(pool,wallet,()=>dice[cursor++%4],()=>clock),a={id:'101'},b={id:'202'};await store.ready();return {pg,pool,wallet,store,a,b,records,fail:kind=>failure=kind,roll:values=>{dice=values.map(n=>n-1);cursor=0;},tick:()=>clock+=rules.rollMs+1,entries:()=>records.get('user/legacy-101.json').data.financialLedger};
}
test('all 1,296 fair outcomes at every stake: equal wins/losses, full ties and exactly 91.1265432% return',()=>{
 for(const stake of rules.stakes){const counts={win:0,tie:0,loss:0};let returned=0;
  for(let a=1;a<=6;a++)for(let b=1;b<=6;b++)for(let c=1;c<=6;c++)for(let d=1;d<=6;d++){
   const s=rules.outcome(stake,[a,b,c,d]);counts[s.outcome]++;returned+=s.payout;assert.ok(Number.isSafeInteger(s.payout));assert.ok(s.payout>=0&&s.payout<=18000000);
   assert.equal(s.playerTotal,a+b);assert.equal(s.houseTotal,c+d);assert.equal(s.payout,s.playerTotal>s.houseTotal?stake*1.8:s.playerTotal===s.houseTotal?stake:0);
  }
  assert.deepEqual(counts,{win:575,tie:146,loss:575});assert.ok(Math.abs(returned/(1296*stake)-rules.expectedReturn)<1e-12);assert.ok(rules.expectedReturn<1);
 }
 for(const dice of [[0,2,3,4],[7,1,1,1],[1,1,1],['1',1,1,1],[1.5,2,3,4],null])assert.throws(()=>rules.outcome(50000,dice));assert.throws(()=>rules.outcome(1,[1,1,1,1]));
});
test('funded rounds: server owns dice and payout; duplicate calls, cooldown, owner and ledger protection',async()=>{
 const f=await fixture();try{
  const b={...purchase(),dice:[1,1,6,6],payout:999999999,playerTotal:999,outcome:'win'};
  const [s,t]=await Promise.all([f.store.roll(f.a,b),f.store.roll(f.a,b)]);assert.equal(s.id,t.id);assert.deepEqual(s.dice,[6,6,1,1]);assert.equal(s.payout,90000);assert.equal(f.entries().length,2);assert.equal(await f.wallet.balance(f.a),2000040000);
  for(const key of ['owner','account','quote'])assert.equal(publicRound(s)[key],undefined);for(const key of ['dice','payout','outcome'])assert.equal(publicRound({...s,status:'funding'})[key],undefined);
  await assert.rejects(f.store.recover(f.b,s.id),e=>e.status===404);await assert.rejects(f.store.roll(f.a,purchase()),e=>e.status===429);assert.equal((await f.store.current(f.b)),null);
  f.tick();const next=await f.store.roll(f.a,purchase(10000000));assert.notEqual(next.id,s.id);assert.equal(next.payout,18000000);assert.equal(f.entries().length,4);
  assert.equal((await f.store.roll(f.a,{...b,stake:10000000})).id,s.id);assert.equal(f.entries().length,4,'Old receipt cannot buy or pay a second round');
 }finally{await f.pg.close();}
});
test('ties refund once and losses pay zero, with correct wallet totals',async()=>{
 const f=await fixture();try{
  f.roll([2,5,6,1]);const b=purchase(),tie=await f.store.roll(f.a,b);assert.equal(tie.outcome,'tie');assert.equal(tie.payout,50000);assert.match(f.entries()[1].id,/:refund:/);assert.equal(await f.wallet.balance(f.a),2000000000);await f.store.roll(f.a,b);assert.equal(f.entries().length,2);
  f.tick();f.roll([1,2,5,6]);const loss=await f.store.roll(f.a,purchase());assert.equal(loss.outcome,'loss');assert.equal(loss.payout,0);assert.equal(await f.wallet.balance(f.a),1999950000);assert.equal(f.entries().length,4);
 }finally{await f.pg.close();}
});
test('lost debit, win credit and tie refund responses recover the original roll exactly once',async()=>{
 for(const kind of ['stake','payout','refund']){const f=await fixture();try{
  if(kind==='refund')f.roll([1,6,3,4]);f.fail(kind);const b=purchase();await assert.rejects(f.store.roll(f.a,b),/Lost wallet reply/);
  const saved=(await f.pg.query('SELECT state FROM dice_duel_rounds')).rows[0].state;assert.equal(saved.status,kind==='stake'?'funding':'awarded');f.roll([1,1,6,6]);
  const [s,t]=await Promise.all([f.store.current(f.a),f.store.roll(f.a,b)]);assert.equal(s.id,t.id);assert.deepEqual(s.dice,saved.dice);assert.equal(f.entries().length,2);assert.equal(await f.wallet.balance(f.a),kind==='refund'?2000000000:2000040000);
 }finally{await f.pg.close();}}
});
test('pending requests with another ID recover the same terms; insufficient funds reveal no result',async()=>{
 const f=await fixture();try{
  f.fail('stake');await assert.rejects(f.store.roll(f.a,purchase()),/Lost wallet/);const alias=purchase(100000),s=await f.store.roll(f.a,alias);assert.equal(s.stake,50000);assert.equal((await f.store.roll(f.a,alias)).id,s.id);assert.equal(f.entries().length,2);
  f.records.get('user/legacy-202.json').data.financialLedger.push({id:'external-spend',delta:-2000000000});await assert.rejects(f.store.roll(f.b,purchase()),/Not enough/);assert.equal(await f.store.current(f.b),null);
  f.records.get('user/legacy-202.json').data.financialLedger.push({id:'external-fund',delta:500000});assert.equal((await f.store.roll(f.b,purchase())).status,'settled');
 }finally{await f.pg.close();}
});
test('authenticated API validates quotes, wagers and references; no claims or client settlement',async()=>{
 const f=await fixture();try{
  const handler=createHandler(f.store,{authenticate:async t=>t==='valid'?f.a:t==='other'?f.b:null},f.wallet),call=b=>handler(new Request('http://local',{method:'POST',body:JSON.stringify(b)}));
  assert.equal((await call({action:'roll',...purchase()})).status,401);
  for(const b of [{...purchase(),quote:null},{...purchase(),stake:'50000'},{...purchase(),stake:0},{...purchase(),requestId:'x'},{...purchase(),requestId:[crypto.randomUUID()]}])assert.equal((await call({action:'roll',token:'valid',...b})).status,400);
  assert.equal(f.entries().length,0);const response=await call({action:'roll',token:'valid',...purchase()});assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('x-dice-duel-build'),rules.build);const body=await response.json();assert.equal(body.round.payout,90000);assert.equal(body.balance,2000040000);
  assert.equal((await (await call({action:'current',token:'other'})).json()).round,null);assert.equal((await call({action:'claim',token:'valid'})).status,400);assert.equal((await handler(new Request('http://local'))).status,405);assert.equal((await handler(new Request('http://local',{method:'POST',body:'x'.repeat(4097)}))).status,413);
  await assert.rejects(f.wallet.apply('legacy-101',{id:'diceduel:fake:payout:101',delta:1}),/Invalid wallet/);
 }finally{await f.pg.close();}
});
test('sampler uses four separate uniform six-way draws and can produce every face',()=>{
 let calls=0;assert.deepEqual(draw(50000,n=>{assert.equal(n,6);calls++;return 0;}).dice,[1,1,1,1]);assert.equal(calls,4);assert.deepEqual(draw(50000,()=>5).dice,[6,6,6,6]);
});
