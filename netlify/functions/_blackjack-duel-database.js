"use strict";

const { getDatabase } = require("@netlify/database");

function cleanId(value, max = 160) {
  return String(value || "").trim().replace(/[^A-Za-z0-9._:-]/g, "").slice(0, max);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function database() {
  if (globalThis.__BLACKJACK_DUEL_DB_CONNECTION) return globalThis.__BLACKJACK_DUEL_DB_CONNECTION;
  const connectionString = String(process.env.NETLIFY_DB_URL || "").trim();
  if (!connectionString) throw new Error("NETLIFY_DB_URL is missing for authoritative Blackjack Duel state.");
  globalThis.__BLACKJACK_DUEL_DB_CONNECTION = getDatabase({ connectionString });
  return globalThis.__BLACKJACK_DUEL_DB_CONNECTION;
}

async function ensureSchema() {
  if (!globalThis.__BLACKJACK_DUEL_SCHEMA_PROMISE) {
    const pool = database().pool;
    globalThis.__BLACKJACK_DUEL_SCHEMA_PROMISE = (async () => {
      await pool.query(`CREATE TABLE IF NOT EXISTS blackjack_duel_matches (
        game_id TEXT PRIMARY KEY,
        round_id TEXT NOT NULL,
        state JSONB NOT NULL,
        revision BIGINT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
      await pool.query(`CREATE INDEX IF NOT EXISTS blackjack_duel_matches_updated_idx
        ON blackjack_duel_matches (updated_at DESC)`);
    })();
  }
  try {
    await globalThis.__BLACKJACK_DUEL_SCHEMA_PROMISE;
  } catch (error) {
    globalThis.__BLACKJACK_DUEL_SCHEMA_PROMISE = null;
    throw error;
  }
}

async function transaction(work) {
  await ensureSchema();
  const client = await database().pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    throw error;
  } finally {
    client.release();
  }
}

async function ensureLocked(client, gameId, initialState) {
  const safeGameId = cleanId(gameId);
  const initial = clone(initialState);
  const roundId = cleanId(initial.roundId);
  if (!safeGameId || !roundId) throw new Error("Blackjack Duel cannot initialize an invalid game state.");
  await client.query(
    `INSERT INTO blackjack_duel_matches (game_id, round_id, state, revision)
     VALUES ($1, $2, $3::jsonb, $4)
     ON CONFLICT (game_id) DO NOTHING`,
    [safeGameId, roundId, JSON.stringify(initial), Number(initial.revision || 0)]
  );
  const { rows } = await client.query(
    `SELECT game_id, round_id, state, revision
       FROM blackjack_duel_matches
      WHERE game_id = $1
      FOR UPDATE`,
    [safeGameId]
  );
  if (!rows[0]) throw new Error("Unable to initialize the Blackjack Duel database match.");
  if (String(rows[0].round_id) !== roundId) {
    await client.query(
      `UPDATE blackjack_duel_matches
          SET round_id = $2, state = $3::jsonb, revision = $4, updated_at = NOW()
        WHERE game_id = $1`,
      [safeGameId, roundId, JSON.stringify(initial), Number(initial.revision || 0)]
    );
    return { game_id: safeGameId, round_id: roundId, state: initial, revision: Number(initial.revision || 0) };
  }
  return rows[0];
}

async function getMatch({ gameId, initialState }) {
  return transaction(async client => {
    const row = await ensureLocked(client, gameId, initialState);
    return clone({ ...row.state, revision: Number(row.revision || row.state?.revision || 0) });
  });
}

async function updateMatch({ gameId, initialState, update }) {
  if (typeof update !== "function") throw new TypeError("Blackjack Duel database update requires a callback.");
  return transaction(async client => {
    const row = await ensureLocked(client, gameId, initialState);
    const current = clone({ ...row.state, revision: Number(row.revision || row.state?.revision || 0) });
    const result = await update(current);
    const next = clone(result?.state || result || current);
    const changed = JSON.stringify(next) !== JSON.stringify(current);
    const revision = changed ? Math.max(Number(row.revision || 0) + 1, Number(next.revision || 0)) : Number(row.revision || 0);
    next.revision = revision;
    if (changed) {
      await client.query(
        `UPDATE blackjack_duel_matches
            SET state = $2::jsonb, revision = $3, updated_at = NOW()
          WHERE game_id = $1`,
        [cleanId(gameId), JSON.stringify(next), revision]
      );
    }
    return { state: next, changed, meta: result?.meta || null };
  });
}

module.exports = { ensureSchema, getMatch, updateMatch };
