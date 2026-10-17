import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {PGlite} from '@electric-sql/pglite';
const require=createRequire(import.meta.url);
const {createStore}=require('../netlify/functions/site-hub/referrals');
const {createWallet}=require('../netlify/functions/rps/wallet');
const stats=require('../netlify/functions/site-hub/single-player-stats');
async function fixture(){
 const pg=new PGlite();let tail=Promise.resolve(),now=Date.now(),lost=false;
 const pool={query:(q,a)=>pg.query(q,a),connect:async()=>{let release;const previous=tail;tail=new Promise(r=>release=r);await previous;return {query:(q,a)=>pg.query(q,a),release};}};
 const records=new Map(['101','202','303','404'].map(id=>[id,{userId:id,version:1,firstConnectedAt:new Date(now-1000).toISOString(),balanceUnit:'tickets',ledgerStartedAt:'today',balanceBaseline:500000,financialLedger:[],customData:{keep:true}}]));
 records.get('404').firstConnectedAt='2020-01-01T00:00:00Z';
 const links=new Map(['101','202','303','404'].map(id=>[id,id]));
 const blob={get:async k=>k.startsWith('torn-link/')?{userId:links.get(k.match(/\d+/)[0])}:structuredClone(records.get(k.slice(5,-5))),getWithMetadata:async k=>{const r=records.get(k.slice(5,-5));return {data:structuredClone(r),etag:String(r.version)};},set:async(k,v,o)=>{const id=k.slice(5,-5),r=records.get(id);if(o.onlyIfMatch!==String(r.version))return {modified:false};const n=JSON.parse(v);n.version=r.version+1;records.set(id,n);if(lost){lost=false;throw Error('Lost wallet response');}return {modified:true};}};
 const wallet=createWallet(blob),store=createStore(pool,wallet,async id=>structuredClone(records.get(id)),()=>now);
 return {pg,pool,store,wallet,records,links,lose:()=>lost=true,clock:n=>now=n,now};
}
test('referrals: unique stable codes, concurrent claim/recovery, one 500K credit, private response',async()=>{
 const f=await fixture();try{
  const a={id:'101'},b={id:'202'},c={id:'303'},pa=await f.store.profile(a),pc=await f.store.profile(c);
  assert.match(pa.code,/^XD[A-F0-9]{10}$/);assert.notEqual(pa.code,pc.code);assert.equal((await f.store.profile({...a,apiKey:'replacement'})).code,pa.code);
  assert.deepEqual(Object.keys(pa).sort(),['canClaim','claimed','code','count','earned','reward']);
  f.lose();await assert.rejects(f.store.claim(b,pa.code),/Lost wallet/);assert.equal(await f.wallet.balance(a),1000000);
  await Promise.all([f.store.claim(b,pa.code.toLowerCase()),f.store.claim(b,pa.code),f.store.profile(a)]);
  assert.equal(await f.wallet.balance(a),1000000);assert.equal(await f.wallet.balance(b),500000);
  assert.equal(f.records.get('101').financialLedger.length,1);assert.deepEqual(f.records.get('101').customData,{keep:true});
  assert.equal((await f.store.profile(a)).count,1);assert.equal((await f.store.profile(b)).canClaim,false);
  await assert.rejects(f.store.claim(b,pc.code),/already/);assert.equal(await f.wallet.balance(c),500000);
  const fresh=await f.store.profile({...b,apiKey:'new-key',visitorId:'new-browser',firstConnectedAt:new Date().toISOString()});assert.equal(fresh.claimed,true);assert.equal(fresh.canClaim,false);
 }finally{await f.pg.close();}
});
test('self referrals, shared legacy account, old signups, forged identities and malformed codes cannot earn chips',async()=>{
 const f=await fixture();try{
  const a={id:'101'},pa=await f.store.profile(a);
  await assert.rejects(f.store.claim(a,pa.code),/yourself/);
  f.links.set('303','101');await assert.rejects(f.store.claim({id:'303'},pa.code),/yourself/);
  assert.equal((await f.store.profile({id:'404'})).canClaim,false);await assert.rejects(f.store.claim({id:'404',firstConnectedAt:new Date().toISOString()},pa.code),/24 hours/);
  for(const id of ['',0,'../101','101.json','a'])await assert.rejects(f.store.profile({id}),e=>e.status===401);
  for(const code of [null,{},[],true,'','XD123','XD0000000000','XD1234567890<script>'])await assert.rejects(f.store.claim({id:'202'},code));
  f.clock(f.now+86400001);await assert.rejects(f.store.claim({id:'202'},pa.code),/24 hours/);
  for(const r of f.records.values())assert.equal(r.financialLedger.length,0);
 }finally{await f.pg.close();}
});
test('two sponsors racing for one signup can receive only one reward',async()=>{
 const f=await fixture();try{
  const a=await f.store.profile({id:'101'}),b=await f.store.profile({id:'303'});
  const results=await Promise.allSettled([f.store.claim({id:'202'},a.code),f.store.claim({id:'202'},b.code)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(await f.wallet.balance({id:'101'})+await f.wallet.balance({id:'303'}),1500000);
 }finally{await f.pg.close();}
});
test('referral API ignores forged recipient/reward/account fields and requires a verified session',async()=>{
 const f=await fixture();try{
  const a=await f.store.profile({id:'101'}),handler=require('../netlify/functions/site-hub').createHandler({referrals:f.store,wallet:f.wallet,rps:{authenticate:async t=>t==='valid'?{id:'202'}:null}});
  const call=body=>handler(new Request('http://test',{method:'POST',body:JSON.stringify(body)}));
  assert.equal((await call({action:'referral',code:a.code,owner:'202'})).status,401);
  const r=await call({action:'referral',token:'valid',code:a.code,owner:'101',account:'101',reward:999999999});assert.equal(r.status,200);
  const data=await r.json();assert.equal(data.balance,500000);assert.equal(data.referral.claimed,true);assert.equal(await f.wallet.balance({id:'101'}),1000000);
  assert.equal(JSON.stringify(data).includes('financialLedger'),false);assert.equal(JSON.stringify(data).includes('account'),false);
  for(const id of ['referral:101:101','referral:101:202:extra','referral:../:202'])await assert.rejects(f.wallet.apply('101',{id,delta:500000}),/Invalid wallet/);
  await assert.rejects(f.wallet.apply('101',{id:'referral:101:202',delta:9999999}),/Invalid wallet/);
 }finally{await f.pg.close();}
});

test('mutual referral races and referral loops cannot mint circular signup rewards',async()=>{
 const f=await fixture();try{
  const a=await f.store.profile({id:'101'}),b=await f.store.profile({id:'202'});
  const results=await Promise.allSettled([f.store.claim({id:'101'},b.code),f.store.claim({id:'202'},a.code)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(await f.wallet.balance({id:'101'})+await f.wallet.balance({id:'202'}),1500000);
  f.records.get('303').firstConnectedAt=new Date(f.now).toISOString();const later=await f.store.profile({id:'303'});
  const unclaimed=results[0].status==='rejected'?'101':'202';await assert.rejects(f.store.claim({id:unclaimed},later.code),/joined before/);
 }finally{await f.pg.close();}
});
test('stats count only settled server ledger rounds, including losses, draws and refunds',()=>{
 const entries=[],receipt=(mode,id,kind,delta)=>entries.push({id:`${mode}:${id.toString(16).padStart(12,'0').toUpperCase()}:${kind}:101`,delta});
 for(const mode of stats.modes){receipt(mode,1,'stake',-10000);receipt(mode,1,'payout',30000);receipt(mode,2,'stake',-10000);receipt(mode,2,'payout',0);receipt(mode,3,'stake',-10000);receipt(mode,3,'payout',10000);receipt(mode,4,'stake',-10000);receipt(mode,4,'refund',10000);receipt(mode,5,'stake',-10000);}
 entries.push({id:'referral:101:202',delta:500000},{id:'client-score',delta:1e9},{...entries[0]});
 const summary=stats.summarize(entries);for(const mode of stats.modes)assert.deepEqual(summary[mode],{games:3,wins:1,losses:1,draws:1,wagered:30000,returned:40000,net:10000,bestReturn:30000,activeDays:0,qualifyingGames:3});
 for(const mode of stats.modes)assert.equal(require('../netlify/functions/site-hub/progression').qualifies(stats.catalog(mode)[0],summary[mode]),false);
});
test('every offered paid game supports a 10K minimum, smaller and fractional multiplayer bets are rejected',()=>{
 for(const mode of ['back-alley-derby','dice-duel','lucky-dice','midnight-run','minefield','jackpot-junction','plinko','rocket-run'])assert.equal(Math.min(...require('../shared/games/'+mode).stakes),10000,mode);
 assert.equal(Math.min(...require('../shared/games/lucky-scratch').tiers.map(t=>t.price)),10000);
 const finance=require('../netlify/functions/shared/table-finance');for(const n of [1,1000,9000,9999,10000.5,'10000',NaN,Infinity,-10000])assert.throws(()=>finance.wager(n));assert.equal(finance.wager(10000),10000);
});
test('unfunded multiplayer matches and bots cannot farm chip achievements',()=>{
 const p=require('../netlify/functions/site-hub/progression'),s={id:'AAAAAAAAAAAA',phase:'complete',players:[{id:'101'},{id:'202'}],winner:0,wager:0};
 for(const wager of [undefined,0,1000,9999])assert.deepEqual(p.outcomes('bluff',{...s,wager}),[]);
 assert.equal(p.outcomes('bluff',{...s,wager:10000}).length,2);assert.deepEqual(p.outcomes('bluff',{...s,wager:10000,players:[{id:'101'},{id:'202',bot:true}]}),[]);
});

test('reward catalogs preserve multiplayer awards and keep single-player bonuses below one percent of qualifying wagers',()=>{
 const cosmetics=require('../shared/games/mini-golf-cosmetics');for(const c of cosmetics.colors.filter(c=>c.achievement))assert.equal(c.challenge,'Unlock through a secret Pocket Putt achievement.');
 const p=require('../netlify/functions/site-hub/progression');assert.deepEqual(p.catalog('forged-mode'),[]);
 for(const mode of p.MODES){const list=p.catalog(mode);assert.equal(list.length,12);assert.equal(list.slice(0,8).reduce((n,a)=>n+a.reward,0),1000000);for(let i=8;i<list.length;i++){assert.ok(list[i].reward>Math.max(...list.slice(0,i).map(a=>a.reward)));assert.ok(list[i].minDays>list[i-1].minDays);}assert.equal(list.at(-1).target,20000);assert.equal(list.at(-1).minDays,730);assert.equal(list.reduce((n,a)=>n+a.reward,0),8500000);assert.equal(p.qualifies(list.at(-1),{wins:999999,activeDays:729}),false);}
 for(const mode of stats.modes){let total=0;const list=p.catalog(mode);assert.equal(list.length,12);for(const [i,a] of list.entries()){total+=a.reward;assert.ok(total<=a.target*10000*.01,mode+' cumulative promotional cost');if(i){assert.ok(a.reward>list[i-1].reward);assert.ok(a.target>list[i-1].target);assert.ok(a.minDays>list[i-1].minDays);}assert.equal(p.qualifies(a,{qualifyingGames:a.target,activeDays:a.minDays-1}),false);assert.equal(p.qualifies(a,{qualifyingGames:a.target-1,activeDays:a.minDays}),false);assert.equal(p.qualifies(a,{qualifyingGames:a.target,activeDays:a.minDays}),true);}assert.equal(list.at(-1).minDays,730);}
});

test('single-player chip awards survive lost responses, concurrent reads and API-key replacement without leaking requirements',async()=>{
 const f=await fixture();try{
  const p=require('../netlify/functions/site-hub/progression').createStore(f.pool,f.wallet),player={id:'101'};
  const entries=[];for(let i=0;i<100;i++){const id=i.toString(16).padStart(12,'0').toUpperCase(),at=new Date(f.now-(i%3)*86400000).toISOString();entries.push({id:`scratch:${id}:stake:101`,delta:-10000,at},{id:`scratch:${id}:payout:101`,delta:10000,at});}
  f.records.get('101').financialLedger=entries;const before=await f.wallet.balance(player);
  f.lose();await assert.rejects(p.profile(player),/Lost wallet/);assert.equal(await f.wallet.balance(player),before+1000);
  const profiles=await Promise.all([p.profile(player),p.profile({...player,apiKey:'new-key'}),p.profile(player)]);
  assert.equal(await f.wallet.balance(player),before+3000);assert.equal(f.records.get('101').financialLedger.filter(e=>e.id.startsWith('achievement:')).length,2);
  for(const profile of profiles){assert.equal(profile.stats.scratch.games,100);assert.equal(profile.stats.scratch.activeDays,3);assert.equal(profile.achievements.scratch.filter(a=>a.unlocked).length,2);for(const a of Object.values(profile.achievements).flat()){for(const key of ['description','target','minDays','minGames','metric'])assert.equal(key in a,false);}}
  const other=await p.profile({id:'202'});assert.equal(other.stats.scratch.games,0);assert.equal(other.achievements.scratch.some(a=>a.unlocked),false);assert.equal(await f.wallet.balance({id:'202'}),500000);
  const handler=require('../netlify/functions/site-hub').createHandler({wallet:f.wallet,progression:p,rps:{authenticate:async t=>t==='valid'?{id:'202'}:null}});
  const call=body=>handler(new Request('http://test',{method:'POST',body:JSON.stringify(body)}));
  assert.equal((await call({action:'progress',owner:'101'})).status,401);
  const reply=await (await call({action:'progress',token:'valid',owner:'101',stats:{scratch:{games:100000,activeDays:1000}},reward:1500000})).json();assert.equal(reply.progress.stats.scratch.games,0);assert.equal(reply.balance,500000);
  assert.equal((await call({action:'balance',owner:'101'})).status,401);assert.equal((await (await call({action:'balance',token:'valid',owner:'101'})).json()).balance,500000);
  for(const [id,delta] of [['achievement:101:fake:wins-1',5000],['achievement:101:scratch:career-1',1000000]])await assert.rejects(f.wallet.award('101',{id,delta}),/Invalid wallet/);
 }finally{await f.pg.close();}
});

test('refunded, unfinished, subminimum and duplicate rounds cannot inflate qualifying play days',()=>{
 const day='2020-01-01T00:00:00Z',rows=[];const add=(id,kind,delta,at=day)=>rows.push({id:`rocket:${id.padStart(12,'0')}:${kind}:101`,delta,at});
 add('1','stake',-9999);add('1','payout',20000);add('2','stake',-10000);add('2','payout',20000);add('2','refund',10000);add('3','stake',-10000);
 add('4','stake',-10000);add('4','payout',0);add('4','payout',0);add('5','stake',-10000);add('5','payout',0);add('6','stake',-10000);add('6','payout',0,'2999-01-01T00:00:00Z');
 const s=stats.summarize(rows).rocket;assert.equal(s.games,4);assert.equal(s.qualifyingGames,3);assert.equal(s.activeDays,1);assert.equal(s.wagered,39999);
});
