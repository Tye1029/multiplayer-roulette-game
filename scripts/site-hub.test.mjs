import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
const {createStore}=require('../netlify/functions/roulette-four/database');
const model=require('../netlify/functions/roulette-four/model');
const hub=require('../netlify/functions/site-hub');
const reports=require('../netlify/functions/site-hub/store');
function fixture(){const pg=new PGlite();let tail=Promise.resolve();const pool={query:(sql,args)=>pg.query(sql,args),connect:async()=>{let release;const previous=tail;tail=new Promise(r=>release=r);await previous;return {query:(sql,args)=>pg.query(sql,args),release};}};return {pg,pool};}
test('four-player seats, full lobby exclusion, wrong principal, cancellation, pot conservation and idempotent settlement',async()=>{
 const {pg,pool}=fixture(),players=[1,2,3,4,5].map(id=>({id:String(id),name:'Player '+id}));
 const balances=new Map(players.map(p=>[p.id,200000])),ledger=new Map();let failAfterWrite=false;
 const wallet={account:async p=>p.id,rate:async()=>3.3,apply:async(id,e)=>{if(ledger.has(e.id))return balances.get(id);const balance=balances.get(id);if(balance+e.delta<0){const x=new Error('Not enough Chips');x.code='RPS_FUNDS';throw x;}balances.set(id,balance+e.delta);ledger.set(e.id,e.delta);if(failAfterWrite){failAfterWrite=false;throw Error('response lost');}return balance+e.delta;}};
 const db=createStore(pool,wallet);let seq=0;const create=p=>db.create(p,{wager:10000,requestId:(++seq).toString(16).padStart(24,'0')});
 try{
  let s=await create(players[0]);assert.equal(balances.get('1'),190000);assert.equal((await db.lobby(players[1])).games[0].count,1);
  const kept=s.id;const second=await create(players[0]);assert.notEqual(second.id,kept);assert.equal((await db.lobby(players[0])).games.length,2);
  await assert.rejects(db.action(kept,players[1],{action:'cancel'}),/not seated/);
  await db.action(second.id,players[0],{action:'cancel'});assert.equal(balances.get('1'),190000);await db.action(second.id,players[0],{action:'get'});assert.equal(balances.get('1'),190000);
  for(const p of players.slice(1,4))s=await db.action(kept,p,{action:'join',wager:10000});
  assert.equal(s.players.length,4);assert.equal(s.phase,'waiting');for(const p of players.slice(0,3)){s=await db.action(kept,p,{action:'ready'});assert.equal(s.phase,'waiting');}s=await db.action(kept,players[3],{action:'ready'});assert.equal(s.phase,'opening');assert.equal(s.paid.length,4);
  assert.equal((await db.lobby(players[4])).games.length,0);await assert.rejects(db.action(kept,players[4],{action:'join',wager:10000}),/no longer joinable/);
  await assert.rejects(db.action(kept,players[0],{action:'cancel'}),/empty table/);
  await assert.rejects(db.action(kept,players[4],{action:'get'}),/belongs/);
  const publicGame=model.publicState(s,'1');assert.equal('bullet' in publicGame,false);assert.equal('account' in publicGame.players[0],false);assert.equal('paid' in publicGame,false);
  // Fix chamber and opening for a deterministic complete-game integration test.
  s.startAt=0;s.deadline=Date.now()+60000;s.bullet=2;await pg.query('UPDATE roulette_four_matches SET state=$2::jsonb WHERE id=$1',[kept,JSON.stringify(s)]);
  s=await db.action(kept,players[0],{action:'get'});const actor=players.find(p=>p.id===s.order[s.turn]);
  const body={action:'act',choice:'shoot',revision:s.revision,actionId:'first-shot'};s=await db.action(kept,actor,body);const revision=s.revision;
  s=await db.action(kept,actor,body);assert.equal(s.revision,revision);assert.equal(s.players.find(p=>p.id===actor.id).bank,2000);
  s.actionAfter=0;await pg.query('UPDATE roulette_four_matches SET state=$2::jsonb WHERE id=$1',[kept,JSON.stringify(s)]);
  failAfterWrite=true;await assert.rejects(db.action(kept,actor,{action:'act',choice:'shoot',revision:s.revision,actionId:'fatal-shot'}),/response lost/);
  s=await db.recover(kept);assert.equal(s.phase,'complete');assert.equal(s.settled,true);assert.equal(s.pot+s.players.reduce((n,p)=>n+p.bank,0),40000);
  const paid=[...balances.values()].reduce((a,b)=>a+b,0);await db.recover(kept);assert.equal([...balances.values()].reduce((a,b)=>a+b,0),paid);
  for(const p of players.slice(0,4))s=await db.action(kept,p,{action:'rematch',wager:10000});assert.ok(s.nextMatch);const rematch=await db.recover(s.nextMatch);assert.equal(rematch.paid.length,4);assert.equal(rematch.phase,'opening');
  const expired=await create(players[4]);expired.deadline=0;await pg.query('UPDATE roulette_four_matches SET state=$2::jsonb WHERE id=$1',[expired.id,JSON.stringify(expired)]);await db.recover(expired.id);assert.equal(balances.get('5'),200000);
 }finally{await pg.close();}
});
test('hub diagnostics exclude secrets, verified sender cannot be spoofed, admin access is checked before reads',async()=>{
 let sent,reads=0;const handler=hub.createHandler({rps:{authenticate:async token=>token==='valid'?{id:'123',name:'Verified'}:null},store:{report:async(...args)=>{sent=args;return 'ok';},reports:async()=>{reads++;return [];}}});
 const request=(b,headers={})=>handler(new Request('https://site.test/.netlify/functions/site-hub',{method:'POST',headers,body:JSON.stringify(b)}));
 let response=await request({action:'report',token:'valid',sender:{id:'999'},message:'test',debug:{build:'v1',viewport:{width:390},token:'secret',storage:{key:'secret'},picks:['rock','paper'],errors:2}});
 assert.equal(response.status,200);assert.deepEqual(sent[0],{id:'123',name:'Verified'});assert.equal(JSON.stringify(sent).includes('secret'),false);assert.equal(JSON.stringify(sent).includes('rock'),false);
 assert.equal((await request({action:'sync'})).status,401);assert.equal((await request({action:'report',token:'invalid',message:'test'})).status,401);
 const prior=process.env.ADMIN_PASSWORD;process.env.ADMIN_PASSWORD='test-admin-password';try{assert.equal((await request({action:'reports',password:'test-admin-password'})).status,401);assert.equal(reads,0);assert.equal((await request({action:'reports'},{'x-admin-password':'test-admin-password'})).status,200);assert.equal(reads,1);}finally{if(prior===undefined)delete process.env.ADMIN_PASSWORD;else process.env.ADMIN_PASSWORD=prior;}
});
test('notification deduplication, focused-game suppression, owner-bound read state and report throttling',async()=>{
 const {pg,pool}=fixture(),db=reports.createStore(pool);
 try{const game={id:'room1',mode:'rps',joiner:'2',name:'Opponent',href:'/'};await db.notify('1',game,'room1');await db.notify('1',game,'');assert.equal((await db.notifications('1'))[0].seen,true);await db.notify('1',{...game,id:'room2'},'');let n=await db.notifications('1');assert.equal(n.filter(x=>!x.seen).length,1);await db.read('2',n.map(x=>x.id));assert.equal((await db.notifications('1')).filter(x=>!x.seen).length,1);await db.read('1',n.map(x=>x.id));assert.equal((await db.notifications('1')).filter(x=>!x.seen).length,0);for(let i=0;i<12;i++)await db.report({id:'1',name:'A'},'test',null,'ip');await assert.rejects(db.report({id:'1'},'spam',null,'ip'),/wait/);}finally{await pg.close();}
});
test('legacy account resolution ignores attacker-controlled visitor aliases; conditional wallet writes reject overspending',async()=>{
 const source=readFileSync(new URL('../netlify/functions/_data.js',import.meta.url),'utf8');
 const resolver=source.slice(source.indexOf('async function resolveSiteUser('),source.indexOf('\n}',source.indexOf('async function resolveSiteUser('))+2);
 let visitorRead=false;const environment=vm.createContext({cleanUserId:String,cleanVisitorId:String,getVisitorLink:async()=>{visitorRead=true;return {userId:'victim'};},getTornUserLink:async()=>null,saveTornUserLink:async()=>{},saveVisitorLink:async()=>{}});
 vm.runInContext(resolver,environment);assert.equal((await environment.resolveSiteUser({id:'123',name:'Verified'},'stolen-browser-id')).id,'123');assert.equal(visitorRead,false);
 const saver=source.slice(source.indexOf('async function saveUserRecord('),source.indexOf('\nfunction uniqueByKey'));
 let state={userId:'1',ledgerStartedAt:'today',balanceBaseline:1000,financialLedger:[]},version=1;
 const store={getWithMetadata:async()=>({data:structuredClone(state),etag:String(version)}),set:async(k,value,options)=>{if(options.onlyIfMatch!==String(version))return {modified:false};state=JSON.parse(value);version++;return {modified:true};}};
 const sandbox=vm.createContext({getUsersStore:()=>store,userKey:String,sanitizeRecord:x=>x,mergeRecordsForSave:(a,b)=>({...a,...b,financialLedger:[...new Map([...a.financialLedger,...b.financialLedger].map(e=>[e.id,e])).values()]})});vm.runInContext(saver,sandbox);
 const results=await Promise.allSettled(['one','two'].map(id=>sandbox.saveUserRecord({...state,financialLedger:[{id,delta:-1000}]})));
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(state.financialLedger.length,1);
 assert.ok(!source.includes('map(sanitizeLedgerEntry).slice(-MAX_LEDGER)'),'Settlement history must not silently drop old debit or deduplication entries');
});
