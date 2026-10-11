'use strict';
const {getDatabase}=require('@netlify/database');
const {createHash}=require('node:crypto');
const model=require('./model');
const hash=s=>createHash('sha256').update(s).digest('hex');
function createStore(injected, roll) {
  let pool=injected, schema;
  const db=()=>pool||(pool=getDatabase({connectionString:process.env.NETLIFY_DB_URL}).pool);
  async function ready() {
    schema ||= db().query(`DO $yahtzee$ BEGIN PERFORM pg_advisory_xact_lock(hashtext('yahtzee-schema-v1')); CREATE TABLE IF NOT EXISTS yahtzee_rooms(id TEXT PRIMARY KEY, owner_key TEXT NOT NULL, state JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()); END $yahtzee$;`).catch(e=>{schema=null;throw e;});
    await schema;
  }
  async function run(b, ip='local') {
    if (!/^[a-f0-9]{64}$/.test(b.token||'')) model.fail('Your session is missing. Reload this page.',401);
    const id=hash(b.token).slice(0,24);
    if (b.action!=='get' && !/^[a-zA-Z0-9-]{16,64}$/.test(b.requestId||'')) model.fail('Missing request ID.',400);
    const code=b.action==='create'?hash(b.token+b.requestId).slice(0,8).toUpperCase():String(b.room||'').toUpperCase();
    if (!/^[A-F0-9]{8}$/.test(code)) model.fail('Enter the 8-character room code.',400);
    await ready();
    // Reads do not take a write lock or rewrite game state.
    if (b.action==='get') {
      const s=(await db().query('SELECT state FROM yahtzee_rooms WHERE id=$1',[code])).rows[0]?.state;
      if (!s || s.expiresAt<Date.now()) model.fail('This room has expired or does not exist.',404);
      if (!s.players.some(p=>p.id===id)) model.fail('Join this room first.',403);
      return model.publicState(s,id);
    }
    const c=await db().connect();
    try {
      await c.query('BEGIN');
      if (b.action==='create') {
        const owner=hash(ip); await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',['yahtzee-create:'+owner]);
        const existing=(await c.query('SELECT state FROM yahtzee_rooms WHERE id=$1',[code])).rows[0]?.state;
        if (!existing) {
          const count=(await c.query("SELECT COUNT(*)::int AS n FROM yahtzee_rooms WHERE owner_key=$1 AND created_at>NOW()-INTERVAL '1 hour'",[owner])).rows[0].n;
          if (count>=10) model.fail('Too many new rooms. Please use an existing room or try later.',429);
          await c.query("DELETE FROM yahtzee_rooms WHERE created_at<NOW()-INTERVAL '2 days'");
          const s=model.fresh(code,model.player(id,b.name));
          await c.query('INSERT INTO yahtzee_rooms(id,owner_key,state) VALUES($1,$2,$3::jsonb)',[code,owner,JSON.stringify(s)]);
        } else if (existing.players[0]?.id!==id) model.fail('Please try creating another room.');
      }
      const s=(await c.query('SELECT state FROM yahtzee_rooms WHERE id=$1 FOR UPDATE',[code])).rows[0]?.state;
      if (!s || s.expiresAt<Date.now()) model.fail('This room has expired or does not exist.',404);
      const requestKey=id+':'+b.requestId;
      if (!s.requests.includes(requestKey) && b.action!=='create') {
        if (b.action==='join') {
          if (!s.players.some(p=>p.id===id)) {
            if (s.phase!=='waiting' || s.players.length>=4) model.fail('This room has started or is full.');
            s.players.push(model.player(id,b.name));
          }
        } else {
          // Rematch votes commute, but a delayed vote cannot carry into a later game.
          if (b.action==='rematch' ? b.game!==s.game : b.revision!==s.revision) model.fail('The table changed. Try that move again.');
          model.act(s,id,b,roll);
        }
        s.revision++; s.requests.push(requestKey); s.requests=s.requests.slice(-256);
        await c.query('UPDATE yahtzee_rooms SET state=$2::jsonb WHERE id=$1',[code,JSON.stringify(s)]);
      }
      await c.query('COMMIT');return model.publicState(s,id);
    } catch(e) { await c.query('ROLLBACK');throw e; } finally { c.release(); }
  }
  return {run};
}
module.exports={createStore};
