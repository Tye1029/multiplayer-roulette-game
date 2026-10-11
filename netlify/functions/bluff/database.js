'use strict';
const { getDatabase } = require('@netlify/database');
const crypto = require('node:crypto');
const model = require('../../../shared/games/bluff-model');

function createStore(injectedPool) {
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
    return tx(async c => {
      await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['bluff-create:' + player.id]);
      const duplicate = (await c.query('SELECT state FROM bluff_matches WHERE owner_id=$1 AND request_id=$2', [player.id, body.requestId])).rows[0];
      if (duplicate) return duplicate.state;
      const active = (await c.query("SELECT id FROM bluff_matches WHERE owner_id=$1 AND updated_at>NOW()-INTERVAL '15 minutes' AND state->>'phase' NOT IN ('complete')", [player.id])).rows;
      if (active.length >= 5) model.fail('You already have five recent tables. Return to one or wait for it to expire.');
      const s = model.create(crypto.randomBytes(6).toString('hex').toUpperCase(), player);
      if (body.bot === true) model.join(s, { id: 'bot:velvet', name: 'The Velvet Fox', bot: true });
      await c.query('INSERT INTO bluff_matches(id,owner_id,request_id,state) VALUES($1,$2,$3,$4::jsonb)', [s.id, player.id, body.requestId, JSON.stringify(s)]);
      return s;
    });
  }
  async function action(id, player, body) {
    const result = await tx(async c => {
      const s = (await c.query('SELECT state FROM bluff_matches WHERE id=$1 FOR UPDATE', [id])).rows[0]?.state;
      if (!s) model.fail('Table not found. Check the invitation code.', 404);
      if (body.action === 'join') model.join(s, player);
      if (!s.players.some(p => p.id === player.id)) model.fail('This table belongs to its players.', 403);
      const before = JSON.stringify(s);
      model.bot(s);
      let error;
      try { if (!['get', 'join'].includes(body.action)) model.act(s, player.id, body); }
      catch (e) { if (!e.status) throw e; error = { message: e.message, status: e.status }; }
      // Persist clock expiry even when a late action is rejected.
      if (JSON.stringify(s) !== before || body.action === 'join') {
        await c.query('UPDATE bluff_matches SET state=$2::jsonb,updated_at=NOW() WHERE id=$1', [id, JSON.stringify(s)]);
      }
      return { state: s, error };
    });
    if (result.error) model.fail(result.error.message, result.error.status);
    return result.state;
  }
  return { ready, create, action };
}
module.exports = { ...createStore(), createStore };
