'use strict';
const { getDatabase } = require('@netlify/database');
const crypto = require('node:crypto');
const model = require('../../../shared/games/bluff-model');
const finance = require('../shared/table-finance');

function createStore(injectedPool, injectedWallet) {
  const wallet = injectedWallet || require('../rps/wallet');
  let pool = injectedPool, schema;
  const db = () => pool || (pool = getDatabase({ connectionString: process.env.NETLIFY_DB_URL }).pool);
  async function ready() {
    schema ||= db().query(`DO $bluff$ BEGIN
      PERFORM pg_advisory_xact_lock(hashtext('bluff-or-bust-v1'));
      CREATE TABLE IF NOT EXISTS bluff_matches(id TEXT PRIMARY KEY, owner_id TEXT NOT NULL,
        request_id TEXT NOT NULL, state JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(owner_id,request_id));
      CREATE INDEX IF NOT EXISTS bluff_recent ON bluff_matches(updated_at DESC);
      END $bluff$;`).catch(e => { schema = null; throw e; });
    return schema;
  }
  async function tx(fn) {
    await ready(); const c = await db().connect();
    try { await c.query('BEGIN'); const result = await fn(c); await c.query('COMMIT'); return result; }
    catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
  }
  async function create(player, body) {
    if (!/^[a-f0-9-]{24,40}$/i.test(body.requestId || '')) model.fail('Missing create request ID.', 400);
    const created = await tx(async c => {
      await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['bluff-create:' + player.id]);
      const duplicate = (await c.query('SELECT state FROM bluff_matches WHERE owner_id=$1 AND request_id=$2', [player.id, body.requestId])).rows[0];
      if (duplicate) return duplicate.state;
      const active = (await c.query("SELECT id FROM bluff_matches WHERE owner_id=$1 AND updated_at>NOW()-INTERVAL '15 minutes' AND state->>'phase' NOT IN ('complete')", [player.id])).rows;
      if (active.length >= 5) model.fail('You already have five recent tables. Return to one or wait for it to expire.');
      const s = model.create(crypto.randomBytes(6).toString('hex').toUpperCase(), player);
      s.private = body.private === true;
      if (body.bot === true && body.wager) finance.fail('Bot practice uses 0 Chips.');
      await finance.prepare(s, 'bluff', s.players, body.wager || 0, wallet);
      if (body.bot === true) model.join(s, { id: 'bot:velvet', name: 'The Velvet Fox', bot: true });
      await c.query('INSERT INTO bluff_matches(id,owner_id,request_id,state) VALUES($1,$2,$3,$4::jsonb)', [s.id, player.id, body.requestId, JSON.stringify(s)]);

      return s;
    });
    const settled=await recover(created.id);
    if(settled.finance?.aborted)finance.fail(settled.reason||'Unable to reserve Chips.');
    return settled;
  }
  async function action(id, player, body) {
    await recover(id);
    const result = await tx(async c => {
      const s = (await c.query('SELECT state FROM bluff_matches WHERE id=$1 FOR UPDATE', [id])).rows[0]?.state;
      if (!s) model.fail('Table not found. Check the invitation code.', 404);
      if (body.action === 'join' && !s.players.some(p => p.id === player.id)) {
        model.join(s, player); await finance.join(s, player, body.wager, wallet);
      }
      if (!s.players.some(p => p.id === player.id)) model.fail('This table belongs to its players.', 403);
      const before = JSON.stringify(s);
      if (s.finance?.pending.length && body.action !== 'join') finance.fail('Funding is still being confirmed. Retry shortly.');
      model.bot(s);
      const match = s.match;
      const beforeAction = JSON.parse(JSON.stringify(s));
      let error;
      try {
        if (body.action === 'add-bot' && s.wager) finance.fail('Bot practice uses 0 Chips. Create a free practice table.');
        if (body.action === 'rematch') finance.consent(s, body);
        if (!['get', 'join'].includes(body.action)) model.act(s, player.id, body);
        if (s.match !== match && s.wager) {
          await finance.prepare(s, 'bluff', s.players, s.wager, wallet, true); s.phase = 'funding';
        }
      }
      catch (e) { if (!e.status) throw e; for (const key of Object.keys(s)) delete s[key]; Object.assign(s,beforeAction); error = { message: e.message, status: e.status }; }
      // Persist clock expiry even when a late action is rejected.
      if (JSON.stringify(s) !== before || body.action === 'join') {
        await c.query('UPDATE bluff_matches SET state=$2::jsonb,updated_at=NOW() WHERE id=$1', [id, JSON.stringify(s)]);
      }
      return { state: s, error };
    });
    const settled = await recover(id);
    if (result.error) model.fail(result.error.message, result.error.status);
    if (body.action === 'join' && !settled.players.some(p => p.id === player.id)) finance.fail(settled.reason || 'Unable to reserve Chips.');
    return settled;
  }
  const outcome = s => ({ done: s.phase === 'complete', winner: Number.isInteger(s.winner) ? s.players[s.winner]?.id : null });
  async function recover(id) {
    const result=await tx(async c => {
      const s = (await c.query('SELECT state FROM bluff_matches WHERE id=$1 FOR UPDATE', [id])).rows[0]?.state;
      if (!s) model.fail('Table not found.', 404);
      const before = JSON.stringify(s);
      await finance.recover(s, wallet, outcome);
      if (s.phase === 'funding' && s.finance.status === 'reserved') { s.phase = 'select'; s.deadline = Date.now() + model.PLAY_MS; s.botAt = Date.now() + 3000; }
      if (JSON.stringify(s) !== before) { s.revision++; await c.query('UPDATE bluff_matches SET state=$2::jsonb,updated_at=NOW() WHERE id=$1', [id, JSON.stringify(s)]); }

      return s;
    });
 if(!injectedPool&&result.phase==='complete')try{await require('../site-hub/progression').observe('bluff',result);}catch(e){console.error('Progress receipt pending',e.name);}
 return result;
  }
  async function readyOpponents(player){await ready();const rows=(await db().query("SELECT state FROM bluff_matches WHERE state->'players'->0->>'id'=$1",[player.id])).rows;return rows.filter(({state:s})=>s.players[1]&&!s.players[1].bot&&s.ready?.includes(s.players[1].id)&&Number(s.createdAt||0)>Date.now()-86400000).map(({state:s})=>({id:s.id,mode:'bluff',name:s.players[1].name,joiner:s.players[1].id,href:'/games/multiplayer/bluff/?room='+s.id}));}
  async function quote(id) {
    await ready(); const s = (await db().query('SELECT state FROM bluff_matches WHERE id=$1', [id])).rows[0]?.state;
    if (!s || s.phase !== 'waiting' || s.players.length !== 1 || s.deadline <= Date.now()) model.fail('This table is no longer open.');
    return { id:s.id, name:s.players[0].name, wager:s.wager||0, houseCutPercent:s.finance?.rate||0 };
  }
  async function sweep() {
    await ready(); const rows = (await db().query("SELECT state FROM bluff_matches WHERE COALESCE(state->'finance'->>'status','free') NOT IN ('free','settled') AND (state->'finance'->>'status'='funding' OR state->>'phase'='complete' OR (state->>'deadline')::bigint<=$1) ORDER BY updated_at LIMIT 40", [Date.now()])).rows;
    for (const {state:s} of rows) try { await action(s.id, s.players[0], {action:'get'}); } catch {}
  }
  async function lobby(player) {
    await sweep(); await ready();
    const rows = (await db().query("SELECT state FROM bluff_matches WHERE state->>'phase'='waiting' AND jsonb_array_length(state->'players')=1 AND (state->>'deadline')::bigint>$1 ORDER BY updated_at DESC LIMIT 100", [Date.now()])).rows;
    return rows.filter(({state:s}) => !s.private && !s.finance?.pending.length).map(({state:s}) => ({id:s.id,mode:'bluff',name:'Bluff or Bust',creator:s.players[0].name,mine:s.players[0].id===player.id,wager:s.wager||0,count:1,capacity:2,expiresAt:s.deadline}));
  }
  return {readyOpponents, ready, create, action, recover, quote, lobby, sweep };
}
module.exports = { ...createStore(), createStore };
