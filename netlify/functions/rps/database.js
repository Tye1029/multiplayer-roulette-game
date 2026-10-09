'use strict';
const { getDatabase } = require('@netlify/database');
const crypto = require('node:crypto');
const rules = require('../../../shared/games/rps-model');
function createStore(injectedPool) {
let pool = injectedPool, schema;
function db() {
  if (!pool) {
    if (!process.env.NETLIFY_DB_URL) throw new Error('Arena database is unavailable.');
    pool = getDatabase({ connectionString: process.env.NETLIFY_DB_URL }).pool;
  }
  return pool;
}
async function ready() {
  if (!schema) schema = (async () => {
    // IF NOT EXISTS alone still races while PostgreSQL creates composite types.
    // One transactional block shares a lock with deploy migrations/cold workers.
    await db().query(`DO $rps$ BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('hand-of-doom-schema-v1'));
    CREATE TABLE IF NOT EXISTS rps_sessions (
      token_hash TEXT PRIMARY KEY, player JSONB NOT NULL, expires_at TIMESTAMPTZ NOT NULL);
    CREATE TABLE IF NOT EXISTS rps_matches (
      id TEXT PRIMARY KEY, state JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS rps_results (
      game_id TEXT PRIMARY KEY, player_a TEXT NOT NULL, player_b TEXT NOT NULL,
      name_a TEXT NOT NULL, name_b TEXT NOT NULL, winner TEXT NOT NULL,
      completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE INDEX IF NOT EXISTS rps_results_a ON rps_results(player_a, completed_at DESC);
    CREATE INDEX IF NOT EXISTS rps_results_b ON rps_results(player_b, completed_at DESC);
    CREATE INDEX IF NOT EXISTS rps_matches_recent ON rps_matches(updated_at DESC);
    END $rps$;`);
  })().catch(e => { schema = null; throw e; });
  return schema;
}
const hash = token => crypto.createHash('sha256').update(token).digest('hex');
async function session(player) {
  await ready(); const token = crypto.randomBytes(32).toString('hex');
  await db().query("INSERT INTO rps_sessions VALUES ($1,$2::jsonb,NOW()+INTERVAL '12 hours')", [hash(token), JSON.stringify(player)]);
  return token;
}
async function authenticate(token) {
  if (!/^[a-f0-9]{64}$/.test(token || '')) return null;
  await ready();
  return (await db().query('SELECT player FROM rps_sessions WHERE token_hash=$1 AND expires_at>NOW()', [hash(token)])).rows[0]?.player || null;
}
async function transaction(work) {
  await ready(); const c = await db().connect();
  try { await c.query('BEGIN'); const result = await work(c); await c.query('COMMIT'); return result; }
  catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
}
const id = () => crypto.randomBytes(6).toString('hex').toUpperCase();
function error(message, status = 409) { const e = new Error(message); e.status = status; throw e; }
async function insert(c, state) {
  await c.query('INSERT INTO rps_matches(id,state) VALUES($1,$2::jsonb)', [state.id, JSON.stringify(state)]);
}
async function create(player, bot = false) {
  return transaction(async c => {
    // Serialize creates per verified identity, so request retries reuse an active arena.
    await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['rps:' + player.id]);
    const { rows } = await c.query(`SELECT state FROM rps_matches WHERE updated_at>NOW()-INTERVAL '20 minutes'
      AND state->'players' @> $1::jsonb ORDER BY updated_at DESC LIMIT 20`, [JSON.stringify([{ id: player.id }])]);
    const active = rows.map(r => rules.advance(r.state)).find(s => ['waiting','choosing','reveal'].includes(s.phase));
    if (active) return active;
    let s = rules.create(id(), player);
    if (bot) s = rules.join(s, { id: 'bot:emperor', name: 'Emperor Scissorius', bot: true });
    await insert(c, s); return s;
  });
}
async function record(c, s) {
  if (s.winner === null || !['reveal','complete'].includes(s.phase) || s.players.some(p => p.bot)) return;
  // Persist with the decisive pick, even if both browsers close during the finale.
  // The future timestamp keeps rivalry queries from spoiling the reveal.
  await c.query(`INSERT INTO rps_results(game_id,player_a,player_b,name_a,name_b,winner,completed_at)
    VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(game_id) DO NOTHING`,
  [s.id, s.players[0].id, s.players[1].id, s.players[0].name, s.players[1].name, s.players[s.winner].id, new Date(s.nextAt)]);
}
async function act(gameId, player, action, body = {}) {
  return transaction(async c => {
    const row = (await c.query('SELECT state FROM rps_matches WHERE id=$1 FOR UPDATE', [gameId])).rows[0];
    if (!row) error('Arena not found. Check the invite code.', 404);
    let s = rules.advance(row.state), now = Date.now();
    if (action === 'join') s = rules.join(s, player, now);
    if (!s.players.some(p => p.id === player.id)) error('This duel belongs to its two players.', 403);
    if (action === 'pick') {
      // Bot locks a cryptographically random choice before processing the human pick.
      if (s.players[1]?.bot && s.phase === 'choosing' && !s.picks[1])
        s = rules.pick(s, s.players[1].id, rules.CHOICES[crypto.randomInt(3)], s.round, now);
      s = rules.pick(s, player.id, body.choice, body.round, now, crypto.randomInt(3));
    }
    if (row.state.winner === null && s.winner !== null) await record(c, s);
    if (action === 'leave' && !['complete','cancelled'].includes(s.phase) && s.winner === null) {
      s.phase = 'cancelled'; s.reason = 'A challenger left the arena. No rivalry result was recorded.'; s.revision++;
    }
    if (action === 'rematch') {
      if (s.phase !== 'complete') error('Finish this match first.');
      if (!s.rematchVotes.includes(player.id)) { s.rematchVotes.push(player.id); s.revision++; }
      if (s.players[1].bot && !s.rematchVotes.includes(s.players[1].id)) s.rematchVotes.push(s.players[1].id);
      if (s.rematchVotes.length === 2 && !s.nextMatch) {
        const next = rules.join(rules.create(id(), s.players[0], now), s.players[1], now);
        await insert(c, next); s.nextMatch = next.id; s.revision++;
      }
    }
    if (JSON.stringify(s) !== JSON.stringify(row.state))
      await c.query('UPDATE rps_matches SET state=$2::jsonb,updated_at=NOW() WHERE id=$1', [s.id, JSON.stringify(s)]);
    return s;
  });
}
async function lobby(player) {
  await ready();
  const { rows } = await db().query(`SELECT state FROM rps_matches WHERE state->>'phase'='waiting'
    AND (state->>'deadline')::bigint>$1 ORDER BY updated_at DESC LIMIT 30`, [Date.now()]);
  return rows.map(({state:s}) => ({ id:s.id, name:s.players[0].name, mine:s.players[0].id === player.id }));
}
async function rivals(player) {
  await ready();
  const { rows } = await db().query(`SELECT
    CASE WHEN player_a=$1 THEN player_b ELSE player_a END AS id,
    (array_agg(CASE WHEN player_a=$1 THEN name_b ELSE name_a END ORDER BY completed_at DESC))[1] AS name,
    COUNT(*)::int AS matches, COUNT(*) FILTER(WHERE winner=$1)::int AS wins,
    COUNT(*) FILTER(WHERE winner<>$1)::int AS losses, MAX(completed_at) AS last_played
    FROM rps_results WHERE (player_a=$1 OR player_b=$1) AND completed_at<=NOW() GROUP BY 1
    ORDER BY matches DESC,last_played DESC,id ASC LIMIT 50`, [player.id]);
  return { archRival: rows[0] || null, opponents: rows };
}
return { session, authenticate, create, act, lobby, rivals };
}
module.exports = { ...createStore(), createStore };
