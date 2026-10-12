import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {PGlite} from '@electric-sql/pglite';
const require=createRequire(import.meta.url),rules=require('../shared/games/lucky-scratch'),{draw,createStore,publicTicket}=require('../netlify/functions/lucky-scratch/database'),{createWallet}=require('../netlify/functions/rps/wallet'),{createHandler}=require('../netlify/functions/lucky-scratch-action');
test('exhaustive prize distribution: exact 96% return, exactly one winning trio or none, every tier scales',()=>{
 const counts=new Map();let paid=0;
 assert.deepEqual(rules.tiers.map(t=>t.price),[50000,100000,500000,1000000,5000000,10000000]);
 for(let roll=0;roll<10000;roll++){let first=true;const s=draw(rules.tiers[0],n=>{if(first){first=false;return roll;}return (roll+17)%n;});paid+=s.payout;counts.set(s.payout,(counts.get(s.payout)||0)+1);const cells=new Map();for(const n of s.spots)cells.set(n,(cells.get(n)||0)+1);const triples=[...cells].filter(([,n])=>n>=3);assert.equal(s.spots.length,9);assert.deepEqual(triples,s.payout?[[s.payout,3]]:[]);}
 assert.equal(paid/(10000*rules.tiers[0].price),.96);for(const p of rules.prizes)assert.equal(counts.get(p.multiplier*rules.tiers[0].price),p.weight);
 for(const tier of rules.tiers){let first=true;assert.equal(draw(tier,n=>{if(first){first=false;return 9999;}return 0;}).payout,tier.price*100);}
});
test('real wallet and SQL: identity, retries, concurrent purchases, settlement, funds, and failure recovery',async()=>{
 const pg=new PGlite();let tail=Promise.resolve(),record={balanceUnit:'tickets',ledgerStartedAt:'today',balanceBaseline:20000000,financialLedger:[]},version=1,crash=false;
 const pool={query:(s,a)=>pg.query(s,a),connect:async()=>{let release;const prior=tail;tail=new Promise(r=>release=r);await prior;return {query:(s,a)=>pg.query(s,a),release};}};
 const blob={get:async k=>k.startsWith('torn-link/')?{userId:'legacy-account'}:structuredClone(record),getWithMetadata:async()=>({data:structuredClone(record),etag:String(version)}),set:async(k,value,opts)=>{assert.equal(k,'user/legacy-account.json');if(opts.onlyIfMatch!==String(version))return {modified:false};record=JSON.parse(value);version++;if(crash){crash=false;throw Error('Lost wallet response');}return {modified:true};}};
 const wallet=createWallet(blob),store=createStore(pool,wallet,()=>0),player={id:'123',name:'Test'},other={id:'456',name:'Other'},buy=()=>({tier:'copper',requestId:crypto.randomUUID()}),all=Array.from({length:9},(_,i)=>i);
 try{
  await store.ready();const body=buy(),second=buy();const [a,b]=await Promise.all([store.buy(player,body),store.buy(player,second)]);assert.equal(a.id,b.id);assert.equal(await wallet.balance(player),19900000);assert.equal(record.financialLedger.length,1);assert.equal(publicTicket(a).payout,null);assert.equal(publicTicket(a).account,undefined);
  await assert.rejects(store.reveal(other,{ticketId:a.id,spots:[0]}),/not found/);await assert.rejects(store.reveal(player,{ticketId:a.id,spots:[9]}),/valid/);
  await store.reveal(player,{ticketId:a.id,spots:[0,0,1],payout:9999999});assert.deepEqual((await store.current(player)).revealed,[0,1]);
  await Promise.all([store.reveal(player,{ticketId:a.id,spots:all}),store.reveal(player,{ticketId:a.id,spots:all})]);assert.equal(record.financialLedger.length,2);assert.equal(await wallet.balance(player),19900000);assert.equal((await store.buy(player,body)).id,a.id);assert.equal((await store.buy(player,second)).id,a.id);
  crash=true;await assert.rejects(store.buy(player,buy()),/Lost wallet/);assert.equal(await wallet.balance(player),19800000);const recovered=await store.current(player);assert.equal(recovered.status,'playing');assert.equal(await wallet.balance(player),19800000);
  await store.reveal(player,{ticketId:recovered.id,spots:all});
  let first=true;const winning=createStore(pool,wallet,n=>{if(first){first=false;return 9999;}return 0;});const win=await winning.buy(player,{...buy(),price:1,payout:9999999});assert.equal(win.price,100000);assert.equal(win.payout,10000000);crash=true;await assert.rejects(winning.reveal(player,{ticketId:win.id,spots:all}),/Lost wallet/);assert.equal(await wallet.balance(player),29700000);const paid=await winning.reveal(player,{ticketId:win.id,spots:all});assert.equal(paid.status,'settled');assert.equal(await wallet.balance(player),29700000);assert.equal(record.totalWagered,300000);assert.equal(record.totalWon,10000000);
  // A ticket bought before a pricing update must keep its original stake and prize.
  const legacy={id:'ABCDEF123456',owner:player.id,account:'legacy-account',name:'Copper Luck',tier:'copper',price:1000,spots:[1000,1000,1000,2000,2000,5000,5000,10000,10000],payout:1000,status:'funding',revealed:[],createdAt:new Date().toISOString()};
  await pg.query('INSERT INTO lucky_scratch_tickets(id,owner,request_id,state) VALUES($1,$2,$3,$4::jsonb)',[legacy.id,player.id,crypto.randomUUID(),JSON.stringify(legacy)]);assert.equal((await store.current(player)).price,1000);assert.equal(await wallet.balance(player),29699000);const old=await store.reveal(player,{ticketId:legacy.id,spots:all});assert.equal(old.payout,1000);assert.equal(await wallet.balance(player),29700000);
  record.financialLedger.push({id:'external-spend',delta:-29700000});await assert.rejects(store.buy(player,{tier:'gold',requestId:crypto.randomUUID()}),/Not enough/);assert.equal((await store.current(player)).id,legacy.id);
  await assert.rejects(store.buy(player,{...buy(),tier:'fake'}),/available/);
  const handler=createHandler(store,{authenticate:async token=>token==='valid'?player:null},wallet),call=async body=>handler(new Request('http://local',{method:'POST',body:JSON.stringify(body)}));
  assert.equal((await call({action:'buy',...buy()})).status,401);assert.equal((await call({action:'payout',token:'valid'})).status,400);const response=await call({action:'current',token:'valid'});assert.equal(response.status,200);assert.equal((await response.json()).ticket.payout,1000);
 }finally{await pg.close();}
});
