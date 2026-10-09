// Real PostgreSQL semantics using PGlite in CI; no production keys or accounts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
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
  } finally { await pg.close(); }
});
