import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {PGlite} from '@electric-sql/pglite';
const require=createRequire(import.meta.url),progress=require('../netlify/functions/site-hub/progression');
const fish=require('../shared/games/fishing-catalog');
test('every public game page loads the shared rules, art, wallet and progression before the menu',()=>{
 for(const file of ['shared/site/index.template.html',...['bluff','rps','yahtzee','roulette-four'].map(g=>'games/multiplayer/'+g+'/index.html')]){
  const html=readFileSync(new URL('../'+file,import.meta.url),'utf8');
  for(const name of ['public-polish','progression'])assert.ok(html.indexOf('/assets/site-hub/'+name+'.js')>=0&&html.indexOf('/assets/site-hub/'+name+'.js')<html.indexOf('/assets/site-hub/game-menu.js'),file+' loads '+name);
 }
});
function poolFixture(){const pg=new PGlite();let tail=Promise.resolve();return {pg,pool:{query:(s,a)=>pg.query(s,a),connect:async()=>{let release;const previous=tail;tail=new Promise(r=>release=r);await previous;return {query:(s,a)=>pg.query(s,a),release};}}};}
function accountFixture(){
 const rows=new Map(),versions=new Map(),store={get:async k=>structuredClone(rows.get(k)||null),getWithMetadata:async k=>rows.has(k)?{data:structuredClone(rows.get(k)),etag:String(versions.get(k)||0)}:null,setJSON:async(k,v)=>{rows.set(k,structuredClone(v));versions.set(k,(versions.get(k)||0)+1);},set:async(k,v,o)=>{if(o.onlyIfNew&&rows.has(k)||o.onlyIfMatch!==undefined&&o.onlyIfMatch!==String(versions.get(k)||0))return {modified:false};rows.set(k,JSON.parse(v));versions.set(k,(versions.get(k)||0)+1);return {modified:true};}};
 const module={exports:{}},localRequire=createRequire(new URL('../netlify/functions/_data.js',import.meta.url));
 const context=vm.createContext({module,exports:module.exports,require:id=>id==='@netlify/blobs'?{getStore:()=>store,connectLambda:()=>{}}:localRequire(id),process:{env:{}},console,Buffer,URL,setTimeout,clearTimeout,setInterval,clearInterval});
 vm.runInContext(readFileSync(new URL('../netlify/functions/_data.js',import.meta.url),'utf8'),context);
 return {data:module.exports,rows,store};
}
test('every game has an expanded catalog preserving the original million-Chip rewards, a modest first win, and demanding long-term goals',()=>{
 for(const mode of progress.MODES){const list=progress.catalog(mode);assert.equal(list.slice(0,8).reduce((n,a)=>n+a.reward,0),1000000,mode);assert.equal(list[0].target,1);assert.equal(list[0].reward,5000);assert.equal(list[4].target,1000);assert.equal(list[4].minDays,90);assert.equal(list[7].minDays,90);assert.equal(progress.qualifies(list[7],{games:499,activeDays:90,[list[7].metric]:1e9}),false);assert.equal(progress.qualifies(list[4],{wins:1000,activeDays:1}),false);}
});
test('legacy Torn principals, game metrics, winnings and bot exclusions are authoritative',()=>{
 const s={gameId:'rr:one',status:'complete',creator:{userId:'old-alias',tornId:'123',name:'Alice'},joiner:{userId:'second',tornId:'456',name:'Bob'},winnerUserId:'old-alias',wager:10000,payout:19340,rouletteState:{safeShots:{'old-alias':5},maxNoSpinStreak:{'old-alias':5}}};
 const rows=progress.outcomes('roulette',s);assert.equal(rows[0].id,'123');assert.equal(rows[0].values.wins,1);assert.equal(rows[0].values.earnings,9340);assert.equal(rows[0].values.streak,5);assert.equal(rows[1].values.earnings,0);
 assert.deepEqual(progress.outcomes('roulette',{...s,npcTest:true}),[]);assert.deepEqual(progress.outcomes('roulette',{...s,rouletteState:{timeoutExecution:true}}),[]);
 assert.deepEqual(progress.outcomes('roulette-four',{id:'time-out',phase:'complete',forfeited:true,players:[{id:'123'},{id:'456'}]}),[]);
 const rps={id:'ABABABABABAB',phase:'complete',players:[{id:'123',name:'A'},{id:'456',name:'B'}],winner:0,scores:[2,0],history:[{winner:0,picks:['rock','scissors']},{winner:0,picks:['paper','rock']}],wager:10000,finance:{payout:19340}};
 assert.equal(progress.outcomes('rps',rps)[0].values.rock,1);assert.equal(progress.outcomes('rps',rps)[0].values.paper,1);
});
test('achievement receipts survive retries; hidden conditions, combined gun wins and leaderboard ties',async()=>{
 const f=poolFixture(),ledger=new Map();let failOnce=true;
 const wallet={account:async p=>p.id,award:async(id,e)=>{if(!ledger.has(e.id))ledger.set(e.id,e.delta);if(failOnce){failOnce=false;throw Error('Response lost');}}},db=progress.createStore(f.pool,wallet);
 const player={id:'123',name:'Alice'},other={id:'456',name:'Bob'};
 const game={id:'AAAAAAAAAAAA',phase:'complete',players:[player,other],winner:0,wager:10000,finance:{id:'match:1',payouts:{123:19340}}};
 try{
  await db.observe('bluff',game);await db.observe('bluff',game);await assert.rejects(db.profile(player),/lost/);const p=await db.profile(player);assert.equal(p.stats.bluff.wins,1);assert.equal(ledger.size,1);assert.equal([...ledger.values()][0],5000);assert.equal(p.achievements.bluff[0].unlocked,true);assert.equal('description' in p.achievements.bluff[1],false);
  await db.observe('bluff',{...game,finance:{id:'match:2',payouts:{123:19340}}});assert.equal((await db.profile(player)).stats.bluff.wins,2);
  await db.observe('roulette',{gameId:'rr1',wager:10000,status:'complete',creator:{userId:'123',tornId:'123',name:'Alice'},joiner:{userId:'456',tornId:'456',name:'Bob'},winnerUserId:'123',rouletteState:{maxNoSpinStreak:{123:5}}});
  await db.observe('roulette-four',{id:'BBBBBBBBBBBB',wager:10000,phase:'complete',players:[player,other,{id:'789',name:'C'},{id:'999',name:'D',eliminated:true}]});
  assert.equal((await db.profile(player)).roulette.wins,2);assert.equal((await db.profile(player)).roulette.unlocked[7],true);await assert.rejects(db.preferences(player,{gun:'royal'}),/locked/);await db.preferences(player,{gun:'laser',character:'nyx'});assert.equal((await db.profile(player)).settings.character,'nyx');
  for(const [owner,rarity] of [['123',1],['456',3],['4300885',3]])await f.pool.query('INSERT INTO xan_progress(owner,mode,name,stats) VALUES($1,\'fishing\',$1,$2::jsonb)',[owner,JSON.stringify({size:95,rarity,fish:'Fish',earnings:200})]);
  const board=await db.leaderboard('fishing');assert.equal(board.game[0].owner,'456');assert.equal(board.game.length,2);assert.ok(board.overall.every(p=>p.owner!=='4300885'));assert.equal(Number(board.overall.find(p=>p.owner==='123').amount),18880);
 }finally{await f.pg.close();}
});
test('new API keys cannot repeat the welcome gift; overlapping deposits cannot mint extra Chips',async()=>{
 const {data,rows}=accountFixture();const a=await data.resolveSiteUser({id:123,name:'Alice'},'browser-one'),b=await data.resolveSiteUser({id:123,name:'Alice'},'browser-two');assert.equal(a.id,b.id);
 await Promise.all([data.recordConnect(a),data.recordConnect(b)]);let r=await data.getUserRecord(a.id);assert.equal(r.currentBalance,500000);assert.equal(r.financialLedger.length,1);
 await data.recordConnect(a);assert.equal((await data.getUserRecord(a.id)).currentBalance,500000);
 const details={addedXans:1,newLogIds:['receipt-1'],deposits:[{id:'receipt-1',amount:1}]};await Promise.all([data.recordCheck(a,details),data.recordCheck(a,details)]);
 r=await data.getUserRecord(a.id);assert.equal(r.currentBalance,1300000);assert.equal(r.totalTicketsDeposited,800000);assert.equal(r.totalXansDetected,1);
 await Promise.all([2,3].map(n=>data.recordCheck(a,{addedXans:1,newLogIds:['receipt-'+n],deposits:[{id:'receipt-'+n,amount:1}]})));
 r=await data.getUserRecord(a.id);assert.equal(r.currentBalance,2900000);assert.equal(r.totalTicketsDeposited,2400000);assert.equal(r.totalXansDetected,3);
 // Untrusted client recovery data may not invent a withdrawal request.
 await data.recordConnect(a,'save-key',{lastWithdrawal:{withdrawalId:'spoofed-id',amount:800000}});assert.equal((await data.getUserRecord(a.id)).currentBalance,2900000);
 rows.set('user/old.json',{userId:'old',currentBalance:2,totalXansDetected:3});assert.equal((await data.getUserRecord('old')).totalTicketsDeposited,3000);
});
test('withdrawal increments, receipt reuse and concurrent overspending are rejected',async()=>{
 const {data}=accountFixture(),p={id:'123',tornId:'123',name:'Alice'};await data.recordConnect(p);await data.recordCheck(p,{addedXans:1,newLogIds:['one'],deposits:[{id:'one',amount:1}]});
 await assert.rejects(data.recordWithdrawal(p,{amount:1000,withdrawalId:'tiny-request'}),/800,000/);await assert.rejects(data.recordWithdrawal(p,{amount:800000.2,withdrawalId:'decimal-request'}),/800,000/);
 const results=await Promise.allSettled(['request-one','request-two'].map(withdrawalId=>data.recordWithdrawal(p,{amount:800000,withdrawalId})));assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal((await data.getUserRecord(p.id)).currentBalance,500000);
 const w=results.find(r=>r.status==='fulfilled').value.withdrawal;await data.recordWithdrawal(p,{amount:800000,withdrawalId:w.withdrawalId});assert.equal((await data.getUserRecord(p.id)).currentBalance,500000);await assert.rejects(data.recordWithdrawal(p,{amount:1600000,withdrawalId:w.withdrawalId}),/different amount/);
});
test('new long fish share unchanged rarity odds at every size band',()=>{
 assert.equal(fish.entries.filter(f=>f.long&&f.rarity==='common').length,5);assert.equal(fish.entries.filter(f=>f.long&&f.rarity==='uncommon').length,3);assert.equal(fish.entries.filter(f=>f.long&&f.rarity==='rare').length,2);assert.equal(fish.resolve('Jerry Dose').rarity,'mythical');
 for(const size of [12,35,60,80,95]){const counts={common:0,uncommon:0,rare:0,mythical:0};for(let i=0;i<10000;i++){let n=0;const f=fish.pick(size,()=>n++===0?(i+.5)/10000:.4);counts[f.rarity]++;}assert.deepEqual(counts,{common:7000,uncommon:2400,rare:500,mythical:100});}
});

test('deposit endpoint credits only owner receives with the required message and follows bounded official pages',async()=>{
 const entries=[
  {id:'good',details:{id:4103,title:'Item receive'},data:{sender:123,items:{206:[2,0]},message:'XanDuel'}},
  {id:'other-player',details:{id:4103,title:'Item receive'},data:{sender:999,items:{206:[9,0]},message:'XanDuel'}},
  {id:'outgoing',details:{id:4102,title:'Item send'},data:{sender:123,items:{206:[9,0]},message:'XanDuel'}},
  {id:'no-message',details:{id:4103,title:'Item receive'},data:{sender:123,items:{206:[9,0]},message:'A gift'}},
  {id:'wrong-owner',details:{id:4103,title:'Item receive'},data:{sender:123,receiver:99,items:{206:[9,0]},message:'XanDuel'}}
 ];
 const captured=[],module={exports:{}},calls=[];let hostile=false,stalled=false;
 const data={initBlobs(){},getUserRecord:async()=>({claimedLogIds:[]}),recordConnect:async()=>{},resolveSiteUser:async p=>p,ticketsFromXans:n=>n*800000,recordCheck:async(p,d)=>{captured.push(d);return {userId:'123',claimedLogIds:d.newLogIds,totalXansDetected:d.addedXans,totalTicketsDeposited:d.addedXans*800000,currentBalance:500000+d.addedXans*800000};}};
 const context=vm.createContext({module,exports:module.exports,require:()=>data,process:{env:{TORN_OWNER_API_KEY:'OWNER_TEST_KEY'}},console:{log(){},error(){}},URL,URLSearchParams,fetch:async url=>{calls.push(new URL(url));const u=new URL(url),paged=u.searchParams.has('offset');const payload=url.includes('/v2/')&&stalled?{log:[],_metadata:{links:{next:'https://api.torn.com/v2/user/log'}}}:url.includes('/v2/')?{log:paged?[entries[0],{...entries[0],id:'second-page',data:{...entries[0].data,items:{206:[1,0]}}}]:entries,_metadata:{links:{next:paged?null:hostile?'https://example.invalid/steal?offset=100':'https://api.torn.com/v2/user/log?offset=100&target=999&key=untrusted'}}}:{player_id:123,name:'Alice'};return {ok:true,text:async()=>JSON.stringify(payload)};}});
 vm.runInContext(readFileSync(new URL('../netlify/functions/check-xans.js',import.meta.url),'utf8'),context);
 const response=await module.exports.handler({httpMethod:'POST',body:JSON.stringify({visitorKey:'VISITORTESTKEY'})});assert.equal(response.statusCode,200);const body=JSON.parse(response.body);assert.equal(body.addedTickets,2400000);assert.deepEqual([...captured[0].newLogIds],['good','second-page']);assert.equal(calls[2].searchParams.get('target'),'123');assert.equal(calls[2].searchParams.get('key'),'OWNER_TEST_KEY');assert.equal(calls[2].searchParams.get('offset'),'100');assert.equal(calls[1].searchParams.get('target'),'123');assert.equal(calls[1].searchParams.get('log'),'4103');assert.equal(body.debug.sampleItemReceiveLogs,undefined);hostile=true;const denied=await module.exports.handler({httpMethod:'POST',body:JSON.stringify({visitorKey:'VISITORTESTKEY'})});assert.equal(denied.statusCode,500);assert.equal(captured.length,1,'hostile pagination cannot reach accounting');assert.ok(calls.every(url=>url.origin==='https://api.torn.com'));hostile=false;stalled=true;const unchanged=await module.exports.handler({httpMethod:'POST',body:JSON.stringify({visitorKey:'VISITORTESTKEY'})});assert.equal(unchanged.statusCode,200);assert.equal(JSON.parse(unchanged.body).addedTickets,0,'Repeated pagination reports no new deposit instead of failing or crediting a guessed amount');
});
