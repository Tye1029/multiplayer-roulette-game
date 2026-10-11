// Real PostgreSQL semantics using PGlite in CI; no production keys or accounts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
const require = createRequire(import.meta.url);
const { createStore } = require('../netlify/functions/rps/database.js');
const a={id:'100',name:'Alpha'}, b={id:'200',name:'Beta'}, c={id:'300',name:'Gamma'};
test('transactional sessions, concurrent picks, exactly-once results and consensual rematches',async()=>{
  const pg=new PGlite(); let tail=Promise.resolve();
  // PGlite is single-connection: acquire/release serializes BEGIN/COMMIT like a pool.
  const pool={query:(sql,args)=>pg.query(sql,args),connect:async()=>{
    let release; const prior=tail; tail=new Promise(r=>release=r); await prior;
    return {query:(sql,args)=>pg.query(sql,args),release};
  }};
  const db=createStore(pool);
  try {
    const migration=readFileSync(new URL('../netlify/database/migrations/004_rps_arena.sql',import.meta.url),'utf8');
    await pg.exec(migration); await pg.exec(migration);
    const token=await db.session(a); assert.equal(token.length,64);
    assert.deepEqual(await db.authenticate(token),a); assert.equal(await db.authenticate('b'.repeat(64)),null);
    const stored=await pg.query('SELECT token_hash FROM rps_sessions'); assert.notEqual(stored.rows[0].token_hash,token);
    let s=await db.create(a); assert.equal((await db.create(a)).id,s.id);
    assert.equal((await db.lobby(b))[0].id,s.id);
    s=await db.act(s.id,b,'join'); await assert.rejects(db.act(s.id,c,'get'),/belongs/);
    const picks=await Promise.all([db.act(s.id,a,'pick',{choice:'rock',round:1}),db.act(s.id,b,'pick',{choice:'scissors',round:1})]);
    s=picks.at(-1); assert.deepEqual(s.scores,[1,0]);
    assert.deepEqual((await db.act(s.id,b,'pick',{choice:'scissors',round:1})).scores,[1,0]);
    // Advance server time through a persisted timestamp, avoiding wall-clock sleeps.
    await pg.query("UPDATE rps_matches SET state=jsonb_set(state,'{nextAt}','0') WHERE id=$1",[s.id]);
    s=await db.act(s.id,a,'get'); assert.equal(s.round,2);
    await db.act(s.id,a,'pick',{choice:'paper',round:2}); await db.act(s.id,b,'pick',{choice:'rock',round:2});
    assert.equal((await pg.query('SELECT * FROM rps_results')).rows.length,1,'decisive pick persists without a subsequent poll');
    assert.equal((await db.rivals(a)).archRival,null,'rivalry cannot spoil pending finale');
    await pg.query("UPDATE rps_results SET completed_at=NOW()-INTERVAL '1 second'");
    await pg.query("UPDATE rps_matches SET state=jsonb_set(state,'{nextAt}','0') WHERE id=$1",[s.id]);
    await Promise.all([db.act(s.id,a,'get'),db.act(s.id,b,'get'),db.act(s.id,a,'get')]);
    assert.equal((await pg.query('SELECT * FROM rps_results')).rows.length,1);
    assert.deepEqual((await db.rivals(a)).archRival.matches,1); assert.equal((await db.rivals(a)).archRival.wins,1);
    assert.equal((await db.rivals(b)).archRival.losses,1);
    assert.equal((await db.act(s.id,a,'rematch')).nextMatch,null);
    const next=(await db.act(s.id,b,'rematch')).nextMatch;
    assert.ok(next); assert.equal((await db.act(s.id,a,'rematch')).nextMatch,next);
    assert.equal((await db.act(next,a,'get')).round,1);
    assert.deepEqual((await db.act(next,a,'get')).scores,[0,0]);
    await db.act(next,a,'leave'); assert.equal((await db.act(next,b,'get')).phase,'cancelled');
    const bot=await db.create(c,true); await db.act(bot.id,c,'pick',{choice:'paper',round:1});
    const botState=await db.act(bot.id,c,'get'); assert.ok(botState.picks[1]);
    assert.equal((await db.rivals(c)).archRival,null);
    await pg.query("UPDATE rps_sessions SET expires_at=NOW()-INTERVAL '1 second'"); assert.equal(await db.authenticate(token),null);
    // Most matches determines nemesis even when another opponent is more recent.
    await pg.query("INSERT INTO rps_results(game_id,player_a,player_b,name_a,name_b,winner) VALUES('other','100','300','Alpha','Gamma','300'),('repeat','100','200','Alpha','Beta','200')");
    assert.equal((await db.rivals(a)).archRival.id,'200'); assert.equal((await db.rivals(a)).archRival.matches,2);
    // A waiting public duel can attach the bot, including retried requests.
    let waiting = await db.create(a);
    const attached = await db.create(a,true);
    assert.equal(attached.id,waiting.id); assert.equal(attached.phase,'choosing');
    assert.equal(attached.players[1].bot,true); assert.equal((await db.create(a,true)).id,attached.id);
    await db.act(attached.id,a,'pick',{choice:'rock',round:1});
    assert.equal((await db.act(attached.id,a,'get')).phase,'reveal');
    await db.act(attached.id,a,'leave');
    // Reserved invitations are durable, private, recipient-only and cancellable.
    const invite = await db.create({...a,character:'lyra'},false,{id:b.id,name:b.name});
    assert.equal((await db.create(a,false,b)).id,invite.id,'challenge retries do not duplicate invitations');
    assert.equal((await db.invitations(b))[0].id,invite.id);
    assert.equal((await db.lobby(b)).some(r=>r.id===invite.id),false);
    assert.equal((await db.lobby(c)).some(r=>r.id===invite.id),false);
    await assert.rejects(db.act(invite.id,c,'decline'),/recipient/);
    await db.act(bot.id,c,'leave');
    await assert.rejects(db.act(invite.id,c,'join'),/reserved/);
    await assert.rejects(db.create(a,true),/Leave/);
    const joined = await db.act(invite.id,{...b,character:'bryn'},'join');
    assert.deepEqual(joined.players.map(p=>p.character),['lyra','bryn']);
    assert.equal((await db.invitations(b)).length,0);
    await db.act(invite.id,a,'leave');
    const declined = await db.create(a,false,b);
    await db.act(declined.id,b,'decline');
    assert.equal((await db.act(declined.id,a,'get')).phase,'cancelled');
    assert.equal((await db.invitations(b)).length,0);
    const expired = await db.create(a,false,b);
    await pg.query("UPDATE rps_matches SET state=jsonb_set(state,'{deadline}','0') WHERE id=$1",[expired.id]);
    assert.equal((await db.invitations(b)).length,0);
    await assert.rejects(db.act(expired.id,b,'join'),/no longer open/);
  } finally { await pg.close(); }
});

// Real wallet adapter against an in-memory conditional Blobs store; no real Chips.
const {createWallet}=require('../netlify/functions/rps/wallet.js');
function fixtureWallet() {
  const rows=new Map(), versions=new Map();let collide=false, crash=false;
  for(const p of [a,b,c])rows.set(`user/${p.id}.json`,{userId:p.id,balanceUnit:'tickets',ledgerStartedAt:'2026-01-01',balanceBaseline:10000,financialLedger:[],activeTickets:{keep:'untouched'}});
  const store={get:async key=>structuredClone(rows.get(key)||null),getWithMetadata:async key=>({data:structuredClone(rows.get(key)),etag:String(versions.get(key)||0)}),setJSON:async(key,data,options)=>{
    if(collide){collide=false;versions.set(key,(versions.get(key)||0)+1);return {modified:false};}
    if(options.onlyIfMatch!==String(versions.get(key)||0))return {modified:false};
    rows.set(key,structuredClone(data));versions.set(key,(versions.get(key)||0)+1);
    if(crash){crash=false;throw new Error('Response lost after durable wallet write');}
    return {modified:true};
  }};
  return {wallet:createWallet(store,async()=>({multiplayer:{houseCutPercent:3.3}})),rows,collide:()=>{collide=true;},crash:()=>{crash=true;}};
}
test('wallet CAS, durable deduplication, insufficient funds and unrelated fields',async()=>{
  const f=fixtureWallet(),w=f.wallet,entry={id:'rps:ABCDEF123456:stake:100',delta:-1000};f.collide();
  await Promise.all([w.apply('100',entry),w.apply('100',entry)]);
  assert.equal(await w.balance(a),9000);assert.equal(f.rows.get('user/100.json').financialLedger.length,1);
  assert.deepEqual(f.rows.get('user/100.json').activeTickets,{keep:'untouched'});
  await assert.rejects(w.apply('100',{id:'rps:000000000001:stake:100',delta:-20000}),/Not enough/);
  f.rows.set('torn-link/100.json',{userId:'canonical-site-user'});assert.equal(await w.account(a),'canonical-site-user');
});
test('wager funding, crash recovery, payouts, refunds, forfeits and rematch consent',async()=>{
  const pg=new PGlite();let tail=Promise.resolve();
  const pool={query:(s,args)=>pg.query(s,args),connect:async()=>{let release;const prior=tail;tail=new Promise(r=>release=r);await prior;return{query:(s,args)=>pg.query(s,args),release};}};
  const f=fixtureWallet(),w=f.wallet,db=createStore(pool,w);
  const expire=async(id,field)=>pg.query(`UPDATE rps_matches SET state=jsonb_set(state,'{${field}}','0') WHERE id=$1`,[id]);
  try {
    f.crash();await assert.rejects(db.create(a,false,null,1000),/Response lost/);
    assert.equal(await w.balance(a),9000);
    let s=await db.create(a,false,null,1000);assert.equal(await w.balance(a),9000,'create retry debits once');
    assert.equal((await db.quote(s.id,b)).wager,1000);
    await assert.rejects(db.act(s.id,b,'join'),/Review and accept/);
    await assert.rejects(db.create(a,true),/Leave/);
    // A failed join releases the seat without disturbing the funded host.
    f.rows.get('user/200.json').balanceBaseline=0;
    await assert.rejects(db.act(s.id,b,'join',{wager:1000}),/Not enough/);
    assert.equal((await db.act(s.id,a,'get')).players.length,1);
    f.rows.get('user/200.json').balanceBaseline=10000;
    f.rows.set('torn-link/200.json',{userId:'100'});
    await assert.rejects(db.act(s.id,b,'join',{wager:1000}),/different Chip accounts/);f.rows.delete('torn-link/200.json');
    f.crash();await assert.rejects(db.act(s.id,b,'join',{wager:1000}),/Response lost/);
    s=await db.act(s.id,b,'join',{wager:1000});assert.equal(s.phase,'choosing');assert.equal(await w.balance(b),9000);
    await db.act(s.id,a,'pick',{choice:'rock',round:1});await db.act(s.id,b,'pick',{choice:'scissors',round:1});
    await expire(s.id,'nextAt');await db.act(s.id,a,'get');
    await db.act(s.id,a,'pick',{choice:'paper',round:2});await db.act(s.id,b,'pick',{choice:'rock',round:2});
    assert.equal(await w.balance(a),9000,'no early payout spoils the reveal');await expire(s.id,'nextAt');
    f.crash();await assert.rejects(db.act(s.id,a,'get'),/Response lost/);
    s=await db.act(s.id,a,'get');assert.equal(s.finance.payout,1934);assert.equal(await w.balance(a),10934,'payout retry credits once');
    const rules=require('../shared/games/rps-model');const view=rules.publicState(s,a.id);
    assert.equal(view.payout,1934);assert.equal(view.finance,undefined);assert.equal(view.accounts,undefined);
    await assert.rejects(db.act(s.id,a,'rematch'),/Review/);
    assert.equal((await db.act(s.id,a,'rematch',{wager:1000})).nextMatch,null);
    assert.equal(await w.balance(a),10934,'first rematch vote does not reserve a stake');
    const next=(await db.act(s.id,b,'rematch',{wager:1000})).nextMatch;
    assert.equal(await w.balance(a),9934);assert.equal(await w.balance(b),8000);
    // Leaving even between hand reveals forfeits; it cannot erase a loss.
    await db.act(next,a,'pick',{choice:'rock',round:1});await db.act(next,b,'pick',{choice:'paper',round:1});
    const forfeited=await db.act(next,a,'leave');assert.equal(forfeited.winner,1);assert.equal(forfeited.forfeit,true);assert.equal(await w.balance(b),9934);
    const invite=await db.create(a,false,b,1000);await db.act(invite.id,b,'decline');assert.equal(await w.balance(a),9934);
    const abandoned=await db.create(a,false,null,1000);await expire(abandoned.id,'deadline');await db.sweep();assert.equal(await w.balance(a),9934,'unjoined stake refunded');
    const timeout=await db.create(a,false,null,1000);await db.act(timeout.id,b,'join',{wager:1000});await db.act(timeout.id,a,'pick',{choice:'rock',round:1});await expire(timeout.id,'deadline');await db.sweep();
    assert.equal((await db.act(timeout.id,b,'get')).winner,0,'locked player wins opponent timeout');
    assert.equal(await w.balance(a),10868);
    // Both idle is a refund, not an invented winner.
    const idle=await db.create(a,false,null,1000);await db.act(idle.id,b,'join',{wager:1000});await expire(idle.id,'deadline');await db.sweep();assert.equal(await w.balance(a),10868);
    assert.equal((await db.act(idle.id,a,'get')).phase,'cancelled');
    // If the second rematch player cannot fund, the first stake is returned.
    f.rows.get('user/200.json').balanceBaseline=1000;
    await db.act(timeout.id,a,'rematch',{wager:1000});const cancelled=(await db.act(timeout.id,b,'rematch',{wager:1000})).nextMatch;
    assert.equal((await db.act(cancelled,a,'get')).phase,'cancelled');assert.equal(await w.balance(a),10868);
  } finally {await pg.close();}
});
