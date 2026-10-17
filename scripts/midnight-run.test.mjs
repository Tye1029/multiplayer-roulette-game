import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {PGlite} from '@electric-sql/pglite';
const require=createRequire(import.meta.url),rules=require('../shared/games/midnight-run');
const {createStore,publicGame,draw}=require('../netlify/functions/midnight-run/database');
const {createWallet}=require('../netlify/functions/rps/wallet'),{createHandler}=require('../netlify/functions/midnight-run-action');
const purchase=(stake=50000,difficulty='normal')=>({stake,difficulty,quote:rules.build,requestId:crypto.randomUUID()});
const cash=(s,cleared=s.cleared)=>({gameId:s.id,cleared,requestId:crypto.randomUUID()});
test('camera clock stays continuous through backwards polls and multi-second network delays',()=>{
 const {Clock}=require('../assets/midnight-run/motion'),clock=new Clock();
 const game={id:'city',cleared:0,legStartedAt:10000,status:'active',phase:'running',blockMs:4000};
 assert.equal(clock.sample(game,1000,-3000),0);assert.equal(clock.sample(game,4000,-3000),0);
 let previous=0;
 for(let stamp=4020;stamp<=8000;stamp+=20){
  const elapsed=clock.sample(game,stamp,stamp%1400<700?900:-400);
  assert.equal(elapsed-previous,20,'Poll corrections never stall or jump the camera');previous=elapsed;
 }
 assert.equal(clock.sample(game,14000,1000),4000,'Never travel beyond an unconfirmed corner');
 const corner={...game,phase:'corner',cleared:1};assert.equal(clock.sample(corner,15000,5000),4000);
 const next={...corner,phase:'running',legStartedAt:20000};assert.equal(clock.sample(next,16000,100),4100);
 assert.equal(clock.sample(next,17000,-900),5100);assert.equal(clock.sample({...next,status:'settled',travelMs:8000},17500,0),8000);
 clock.reset();assert.equal(clock.sample({...game,id:'old',blockMs:4500},20000,4300),4300);
});

test('lightning is one bounded fade, thunder follows once, and hidden/reduced motion are respected',()=>{
 const {Storm}=require('../assets/midnight-run/weather'),storm=new Storm(()=>0);
 assert.deepEqual(storm.sample(1),{light:0,thunder:false});assert.equal(storm.sample(12001).light,0);
 assert.ok(storm.sample(12071).light>0);assert.equal(storm.sample(12501,true,true).light,0);
 assert.equal(storm.sample(13001).thunder,true);assert.equal(storm.sample(13002).thunder,false);assert.equal(storm.flashes,1);
 for(let t=13003;t<36001;t+=20){const state=storm.sample(t);assert.equal(state.light,0);assert.equal(state.thunder,false);}
 storm.sample(36001);assert.equal(storm.flashes,2);storm.sample(36100,false);assert.deepEqual(storm.sample(38000),{light:0,thunder:false});
 storm.reset();assert.equal(storm.flashes,0);
});
async function fixture(){
 const pg=new PGlite();let tail=Promise.resolve(),failure=null,clock=Date.now(),random=()=>0;
 const pool={query:(s,a)=>pg.query(s,a),connect:async()=>{let release;const prior=tail;tail=new Promise(r=>release=r);await prior;return {query:(s,a)=>pg.query(s,a),release};}};
 const records=new Map(['101','202'].map(id=>['user/legacy-'+id+'.json',{version:1,data:{balanceUnit:'tickets',ledgerStartedAt:'today',balanceBaseline:2000000000,financialLedger:[]}}]));
 const blob={get:async key=>key.startsWith('torn-link/')?{userId:'legacy-'+key.match(/\d+/)[0]}:structuredClone(records.get(key)?.data),getWithMetadata:async key=>{const r=records.get(key);return {data:structuredClone(r.data),etag:String(r.version)};},set:async(key,value,options)=>{const r=records.get(key);if(String(r.version)!==options.onlyIfMatch)return {modified:false};r.data=JSON.parse(value);r.version++;if(failure&&r.data.financialLedger.at(-1).id.includes(':'+failure+':')){failure=null;throw Error('Lost wallet response');}return {modified:true};}};
 const wallet=createWallet(blob),store=createStore(pool,wallet,n=>random(n),()=>clock),a={id:'101'},b={id:'202'};
 await store.ready();return {pg,pool,wallet,store,a,b,records,blob,fail:kind=>failure=kind,at:n=>clock=n,random:fn=>random=fn,entries:()=>records.get('user/legacy-101.json').data.financialLedger};
}
test('all difficulties and wagers have exact increasing capped payouts and the same entry edge',()=>{
 for(const difficulty of rules.difficulties)for(const stake of rules.stakes){
  const odds=rules.odds(difficulty);let pn=1n,pd=1n,previous=0;
  const last=rules.lastBlock(stake,difficulty);
  for(let block=1;block<=last;block++){
   pn*=BigInt(odds[block-1]);pd*=100n;
   const exact=BigInt(stake)*90n*pd/(100n*pn),expected=Number(exact>50000000n?50000000n:exact);
   const paid=rules.payout(stake,block,difficulty);assert.equal(paid,expected);assert.ok(Number.isSafeInteger(paid)&&paid<=rules.maxPayout&&paid>previous);previous=paid;
   assert.ok(BigInt(paid)*pn*10n<=BigInt(stake)*pd*9n);
   if(difficulty!=='normal')assert.ok(paid>=rules.payout(stake,block));
  }
  assert.equal(rules.payout(stake,last,difficulty),rules.maxPayout);
  let best=rules.payout(stake,last,difficulty);for(let block=last-1;block>=1;block--)best=Math.max(rules.payout(stake,block,difficulty),odds[block]/100*best);
  assert.ok(best*odds[0]/100/stake<=.90000000001,'Adaptive stopping cannot remove the entry edge');
 }
 assert.deepEqual(rules.odds('normal'),[80,88,86,84,82,80,78,76,74,72,70,68,66,64,62,60,58,56,54,52,50,48,46,44]);
 assert.deepEqual(rules.difficulties.map(d=>rules.payout(50000,1,d)),[56250,64285,75000]);
 for(const n of [-1,1.5,25,NaN])assert.throws(()=>rules.ratio(n));assert.throws(()=>rules.payout(1,1));assert.throws(()=>rules.odds('__proto__'));
 assert.equal(rules.clearedAt(rules.blockMs-1),0);assert.equal(rules.clearedAt(rules.blockMs),1);
});

test('street plans mix individual sides, disperse neon, vary runs and reproduce a resumed run',()=>{
 const streets=require('../assets/midnight-run/streets'),signatures=new Set();
 for(let i=0;i<100;i++){
  const id='run-'+i,rows=streets.plan(id);assert.deepEqual(rows,streets.plan(id));signatures.add(JSON.stringify(rows.slice(1,8)));
  for(let r=1;r<rows.length;r++){
   const neon=rows[r].filter(l=>l.image===0).length;assert.ok(neon<=1,'never a full neon row');
   if(neon)assert.ok(rows[r-1].every(l=>l.image!==0),'leave ordinary properties between neon venues');
   for(let side=0;side<2;side++){assert.notEqual(rows[r][side].image,rows[r-1][side].image);assert.ok(rows[r][side].section>=0&&rows[r][side].section<3);}
  }
  assert.ok(rows.flat().filter(l=>l.image===0).length>=40);assert.equal(new Set(rows.flat().map(l=>l.image)).size,4);
 }
 assert.equal(signatures.size,100);
});

test('route draws have exact thresholds and never reveal a future block',()=>{
 assert.equal(draw(50000,()=>99),1);assert.equal(draw(50000,()=>79),7);
 assert.equal(draw(50000,()=>0),rules.lastBlock(50000)+1);
 const s={id:'ABCDEF123456',owner:'101',account:'private',stake:50000,autoBlock:null,caughtBlock:5,status:'active',startedAt:1000,evaluatedAt:1000+4500*3};
 const p=publicGame(s);assert.equal(p.cleared,3);assert.equal(p.bank,rules.payout(50000,3));
 for(const key of ['caughtBlock','owner','account','payout','endedAt','evaluatedAt'])assert.equal(p[key],undefined);
});
test('real wallet, simultaneous purchases, ownership, ignored client prizes and exactly-once escape',async()=>{
 const f=await fixture();try{
  const body={...purchase(),caughtBlock:1,startedAt:0,payout:900000000};const [s,t]=await Promise.all([f.store.start(f.a,body),f.store.start(f.a,purchase(100000))]);
  assert.equal(s.id,t.id);assert.equal(s.stake,50000);assert.equal(f.entries().length,1);assert.equal(await f.wallet.balance(f.a),1999950000);
  await assert.rejects(f.store.cashout(f.b,cash(s)),e=>e.status===404);await assert.rejects(f.store.cashout(f.a,cash(s)),/Reach the next corner/);
  f.at(s.startedAt+rules.blockMs+200);const [win,retry]=await Promise.all([f.store.cashout(f.a,{...cash(s,1),payout:900000000}),f.store.cashout(f.a,cash(s,1))]);
  assert.equal(win.payout,56250);assert.equal(retry.payout,56250);assert.equal(win.cleared,1);assert.equal(f.entries().length,2);assert.equal(await f.wallet.balance(f.a),2000006250);
  assert.equal((await f.store.start(f.a,body)).id,s.id);assert.equal(f.entries().length,2);
  assert.notEqual((await f.store.start(f.a,purchase())).id,s.id);
 }finally{await f.pg.close();}
});
test('each corner waits indefinitely; continue is authoritative and duplicate/stale requests cannot skip blocks',async()=>{
 const f=await fixture();try{
  const s=await f.store.start(f.a,purchase());f.at(s.startedAt+86400000);
  let corner=await f.store.current(f.a);assert.equal(corner.phase,'corner');assert.equal(corner.cleared,1);
  f.at(s.startedAt+172800000);corner=await f.store.current(f.a);assert.equal(corner.cleared,1);
  const body=cash(corner);await assert.rejects(f.store.continue(f.b,body),e=>e.status===404);
  const [next,duplicate]=await Promise.all([f.store.continue(f.a,body),f.store.continue(f.a,body)]);
  assert.equal(next.phase,'running');assert.equal(next.legStartedAt,duplicate.legStartedAt);
  await assert.rejects(f.store.cashout(f.a,cash(corner)),/Reach the next corner/);
  await assert.rejects(f.store.continue(f.a,cash(corner)),/Reach the next corner/);
  f.at(next.legStartedAt+rules.blockMs);corner=await f.store.current(f.a);assert.equal(corner.cleared,2);
  const retry=await f.store.continue(f.a,body);assert.equal(retry.phase,'corner');assert.equal(retry.cleared,2);
  await assert.rejects(f.store.continue(f.a,cash(s,1)),/corner has changed/);
  await assert.rejects(f.store.cashout(f.a,cash(s,1)),/corner has changed/);
  const win=await f.store.cashout(f.a,cash(corner));assert.equal(win.payout,rules.payout(s.stake,2));assert.equal(f.entries().length,2);
 }finally{await f.pg.close();}
});

test('capture at the next attempted corner wins; client timestamps cannot reverse it',async()=>{
 const f=await fixture();try{
  let count=0;f.random(()=>++count===2?99:0);const s=await f.store.start(f.a,purchase());
  f.at(s.startedAt+rules.blockMs);const corner=await f.store.current(f.a);
  const next=await f.store.continue(f.a,cash(corner));f.at(next.legStartedAt+rules.blockMs);
  const loss=await f.store.cashout(f.a,{...cash(next),receivedAt:s.startedAt,timestamp:1,payout:50000000});
  assert.equal(loss.outcome,'caught');assert.equal(loss.payout,0);assert.equal(loss.cleared,1);
  assert.equal((await f.store.cashout(f.a,cash(s))).payout,0);assert.equal(f.entries().length,2);
 }finally{await f.pg.close();}
});

test('corner cashout is safe through database delays',async()=>{
 const f=await fixture();try{
  let n=0;f.random(()=>++n===2?99:0);const s=await f.store.start(f.a,purchase());f.at(s.startedAt+rules.blockMs+100);
  const connect=f.pool.connect;f.pool.connect=async()=>{f.at(s.startedAt+rules.blockMs*300);return connect();};
  const win=await f.store.cashout(f.a,cash(s,1));assert.equal(win.outcome,'escape');assert.equal(win.payout,56250);
 }finally{await f.pg.close();}
});

test('every wager reaches the cap only after explicit continue choices',async()=>{
 const f=await fixture();try{
  for(const difficulty of rules.difficulties)for(const stake of rules.stakes){
   let s=await f.store.start(f.a,purchase(stake,difficulty));
   for(let block=1;block<=rules.lastBlock(stake,difficulty);block++){
    f.at(s.legStartedAt+3600000);s=await f.store.current(f.a);assert.equal(s.cleared,block);
    if(block<rules.lastBlock(stake,difficulty)){assert.equal(s.phase,'corner');s=await f.store.continue(f.a,cash(s));}
   }
   assert.equal(s.outcome,'limit');assert.equal(s.payout,50000000);assert.equal((await f.store.cashout(f.a,cash(s))).payout,50000000);
  }
 }finally{await f.pg.close();}
});

test('lost debit and credit replies recover immutable receipts without rerolls',async()=>{
 const f=await fixture();try{
  const body=purchase();f.fail('stake');await assert.rejects(f.store.start(f.a,body),/Lost wallet/);assert.equal(f.entries().length,1);
  f.random(()=>99);let s=await f.store.start(f.a,body);assert.ok(s.caughtBlock>1);assert.equal(f.entries().length,1);
  f.at(s.startedAt+rules.blockMs);f.fail('payout');await assert.rejects(f.store.cashout(f.a,cash(s,1)),/Lost wallet/);assert.equal(f.entries().length,2);
  s=await f.store.current(f.a);assert.equal(s.status,'settled');assert.equal(s.payout,56250);assert.equal(f.entries().length,2);
  await f.store.start(f.a,body);assert.equal(f.entries().length,2);
 }finally{await f.pg.close();}
});

test('already-funded V1 contracts still recover, but new auto targets are rejected',async()=>{
 const f=await fixture();try{
  await assert.rejects(f.store.start(f.a,{...purchase(),autoBlock:1}),e=>e.status===400);
  const s=await f.store.start(f.a,purchase());delete s.mode;s.autoBlock=2;
  await f.pool.query('UPDATE midnight_run_games SET state=$2::jsonb WHERE id=$1',[s.id,JSON.stringify(s)]);
  f.at(s.startedAt+86400000);const win=await f.store.current(f.a);
  assert.equal(win.outcome,'auto');assert.equal(win.payout,rules.payout(s.stake,2));
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


test('difficulty is fixed before funding, survives lost replies and ignores action overrides',async()=>{
 const f=await fixture();try{
  for(const difficulty of ['invalid',null,'__proto__'])await assert.rejects(f.store.start(f.a,purchase(50000,difficulty)),e=>e.status===400);
  for(const difficulty of rules.difficulties){
   f.random(()=>0);const body=purchase(50000,difficulty);f.fail('stake');await assert.rejects(f.store.start(f.a,body),/Lost wallet/);
   f.random(()=>99);const s=await f.store.start(f.a,{...body,difficulty:'normal'});assert.equal(s.difficulty,difficulty);assert.ok(s.caughtBlock>1);
   f.at(s.startedAt+rules.blockMs);const corner=await f.store.current(f.a);assert.equal(publicGame(corner).difficulty,difficulty);
   const next=await f.store.continue(f.a,{...cash(corner),difficulty:'normal',safePercent:[100]});assert.equal(next.difficulty,difficulty);
   f.at(next.legStartedAt+rules.blockMs);const win=await f.store.cashout(f.a,{...cash(next,2),difficulty:'high',payout:50000000});assert.equal(win.payout,rules.payout(50000,2,difficulty));
   const threshold=rules.odds(difficulty)[0];assert.equal(draw(50000,()=>threshold,difficulty),1);assert.ok(draw(50000,()=>threshold-1,difficulty)>1);
  }
  assert.equal(f.entries().length,6);
 }finally{await f.pg.close();}
});

test('existing V2 corner runs with no difficulty keep original odds and payouts',async()=>{
 const f=await fixture();try{
  const s=await f.store.start(f.a,purchase());delete s.difficulty;
  await f.pool.query('UPDATE midnight_run_games SET state=$2::jsonb WHERE id=$1',[s.id,JSON.stringify(s)]);
  f.at(s.startedAt+rules.blockMs);const corner=await f.store.current(f.a);assert.equal(publicGame(corner).difficulty,'normal');
  assert.equal((await f.store.cashout(f.a,{...cash(corner),difficulty:'high'})).payout,56250);
 }finally{await f.pg.close();}
});

test('new blocks take four seconds, while existing funded runs retain their quoted timing',async()=>{
 const f=await fixture();try{
  const fresh=await f.store.start(f.a,{...purchase(),blockMs:1});assert.equal(fresh.blockMs,4000);assert.equal(publicGame(fresh).blockMs,4000);
  f.at(fresh.startedAt+3999);assert.equal((await f.store.current(f.a)).phase,'running');
  f.at(fresh.startedAt+4000);const corner=await f.store.current(f.a);assert.equal(corner.phase,'corner');
  const next=await f.store.continue(f.a,{...cash(corner),blockMs:1});assert.equal(next.blockMs,4000);
  f.at(next.legStartedAt+4000);await f.store.cashout(f.a,cash(next,2));
  for(const legacy of [false,true]){
   const old=await f.store.start(f.a,purchase());delete old.blockMs;if(legacy){delete old.mode;old.autoBlock=1;}
   await f.pool.query('UPDATE midnight_run_games SET state=$2::jsonb WHERE id=$1',[old.id,JSON.stringify(old)]);
   f.at(old.startedAt+4000);const before=await f.store.current(f.a);assert.equal(before.status,'active');assert.equal(publicGame(before).cleared,0);assert.equal(publicGame(before).blockMs,4500);
   f.at(old.startedAt+4500);const arrived=await f.store.current(f.a);assert.equal(arrived.cleared,1);
   if(!legacy)await f.store.cashout(f.a,cash(arrived));else assert.equal(arrived.status,'settled');
  }
 }finally{await f.pg.close();}
});

test('competing Continue and Cash out cannot undo a choice, skip a block or credit twice',async()=>{
 const f=await fixture();try{
  for(const difficulty of rules.difficulties)for(const continueFirst of [true,false]){
   const start=await f.store.start(f.a,purchase(50000,difficulty));f.at(start.startedAt+rules.blockMs);
   const corner=await f.store.current(f.a);assert.ok(corner.revision>start.revision);
   assert.equal((await f.store.current(f.a)).revision,corner.revision,'Read-only polls preserve revision');
   const before=f.entries().length,advance=()=>f.store.continue(f.a,cash(corner)),escape=()=>f.store.cashout(f.a,cash(corner));
   const results=await Promise.allSettled(continueFirst?[advance(),escape()]:[escape(),advance()]);
   assert.equal(results[0].status,'fulfilled');assert.ok(results[0].value.revision>corner.revision);
   if(continueFirst){
    assert.equal(results[1].status,'rejected');assert.equal(f.entries().length,before);
    const moving=results[0].value;assert.equal(moving.cleared,1);f.at(moving.legStartedAt+rules.blockMs);
    const next=await f.store.current(f.a);await f.store.cashout(f.a,cash(next));
   }else{assert.equal(results[1].status,'fulfilled');assert.equal(results[1].value.status,'settled');}
   const final=await f.store.current(f.a);assert.equal(final.status,'settled');assert.equal(f.entries().length,before+1);
   assert.equal(publicGame(final).revision,final.revision);
  }
 }finally{await f.pg.close();}
});
