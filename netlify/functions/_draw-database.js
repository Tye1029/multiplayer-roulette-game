"use strict";

const { getDatabase } = require("@netlify/database");

const BOSS_GOAL = 3;
const BOSS_SCORE = 3;
const LEDGER_LIMIT = 240;

function cleanId(value, max = 120) {
  return String(value || "").replace(/[^a-zA-Z0-9._:-]/g, "").slice(0, max);
}
function clone(value) {
  return JSON.parse(JSON.stringify(value || {}));
}
function signedInt(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : fallback;
}
function eventScore(event, playerId) {
  if (!event || !playerId) return 0;
  if (event.kind === "boss") return String(event.claimedBy || "") === String(playerId) ? BOSS_SCORE : 0;
  if (String(event.claimedBy || "") !== String(playerId)) return 0;
  return signedInt(event.scoreValue, event.type === "civilian" ? -1 : 1);
}
function computeScores(events, playerIds) {
  const scores = Object.fromEntries(playerIds.filter(Boolean).map(id => [String(id), 0]));
  for (const event of events || []) {
    for (const playerId of Object.keys(scores)) scores[playerId] += eventScore(event, playerId);
  }
  return scores;
}
function activeAt(state, target, atMs, playerId) {
  if (!target) return false;
  if (target.claimedBy) return false;
  const startsAt = Date.parse(target.startsAt || "") || (Date.parse(state.startAt || "") + Number(target.startMs || 0));
  const endsAt = Date.parse(target.endsAt || "") || (startsAt + Number(target.durationMs || (target.kind === "boss" ? 5000 : 2000)));
  const roundEnd = Date.parse(state.endAt || "");
  return Number.isFinite(startsAt) && Number.isFinite(endsAt) && atMs >= startsAt && atMs < endsAt && (!Number.isFinite(roundEnd) || atMs < roundEnd);
}
function database() {
  const connectionString = String(process.env.NETLIFY_DB_URL || "").trim();
  if (!connectionString) {
    throw new Error("NETLIFY_DB_URL is missing. Add the production read-and-write Netlify Database connection string as a Functions environment variable, then redeploy.");
  }
  return getDatabase({ connectionString });
}
async function transaction(work) {
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
  const state = clone(initialState);
  const roundId = cleanId(state.roundId || `round-${Date.now()}`);
  await client.query(
    `INSERT INTO draw_matches (game_id, round_id, state, revision)
     VALUES ($1, $2, $3::jsonb, $4)
     ON CONFLICT (game_id) DO NOTHING`,
    [safeGameId, roundId, JSON.stringify(state), Number(state.revision || 0)]
  );
  const { rows } = await client.query(
    `SELECT game_id, round_id, state, revision
       FROM draw_matches
      WHERE game_id = $1
      FOR UPDATE`,
    [safeGameId]
  );
  if (!rows[0]) throw new Error("Unable to initialize the DRAW database match.");
  // A reused game id must never inherit a different round's state.
  if (String(rows[0].round_id) !== String(roundId)) {
    await client.query(`DELETE FROM draw_actions WHERE game_id = $1`, [safeGameId]);
    await client.query(
      `UPDATE draw_matches
          SET round_id = $2, state = $3::jsonb, revision = $4, updated_at = NOW()
        WHERE game_id = $1`,
      [safeGameId, roundId, JSON.stringify(state), Number(state.revision || 0)]
    );
    return { game_id: safeGameId, round_id: roundId, state, revision: Number(state.revision || 0) };
  }
  return rows[0];
}
async function recentLedger(client, gameId) {
  const { rows } = await client.query(
    `SELECT sequence, action_id AS "actionId", user_id AS "userId", target_id AS "targetId",
            action_kind AS kind, delta, action_payload AS payload, created_at AS at
       FROM draw_actions
      WHERE game_id = $1
      ORDER BY sequence DESC
      LIMIT $2`,
    [cleanId(gameId), LEDGER_LIMIT]
  );
  return rows.reverse().map(row => ({
    sequence: Number(row.sequence),
    actionId: row.actionId,
    userId: row.userId,
    targetId: row.targetId,
    kind: row.kind,
    delta: Number(row.delta || 0),
    at: new Date(row.at).toISOString(),
    bossProgress: row.payload?.bossProgress || null
  }));
}
function hydrate(state, revision, ledger, playerIds) {
  const next = clone(state);
  next.revision = Number(revision || 0);
  next.nextActionSequence = next.revision + 1;
  next.actionLedger = ledger;
  next.scores = computeScores(next.events || [], playerIds);
  return next;
}

async function peekMatchRevision(gameId) {
  const { rows } = await database().pool.query(
    `SELECT revision, state->>'endAt' AS "endAt"
       FROM draw_matches
      WHERE game_id = $1`,
    [cleanId(gameId)]
  );
  if (!rows[0]) return null;
  return { revision: Number(rows[0].revision || 0), endAt: rows[0].endAt || "" };
}

async function ensureMatch({ gameId, initialState, playerIds }) {
  return transaction(async client => {
    const row = await ensureLocked(client, gameId, initialState);
    const ledger = await recentLedger(client, gameId);
    return hydrate(row.state, row.revision, ledger, playerIds);
  });
}
async function getMatch({ gameId, initialState, playerIds }) {
  return ensureMatch({ gameId, initialState, playerIds });
}
async function claimTarget({ gameId, initialState, playerIds, userId, userName, targetId, actionId, clickedAt }) {
  return transaction(async client => {
    const row = await ensureLocked(client, gameId, initialState);
    const safeGameId = cleanId(gameId);
    const safeActionId = cleanId(actionId, 90);
    const safeUserId = cleanId(userId, 80);
    const safeTargetId = cleanId(targetId, 80);

    const duplicate = await client.query(
      `SELECT sequence, action_id AS "actionId", user_id AS "userId", target_id AS "targetId",
              action_kind AS kind, delta, action_payload AS payload, created_at AS at
         FROM draw_actions
        WHERE game_id = $1 AND action_id = $2`,
      [safeGameId, safeActionId]
    );
    if (duplicate.rows[0]) {
      const ledger = await recentLedger(client, safeGameId);
      const state = hydrate(row.state, row.revision, ledger, playerIds);
      const existing = duplicate.rows[0];
      return {
        state,
        delta: Number(existing.delta || 0),
        bossProgress: existing.payload?.bossProgress || null,
        actionRecord: ledger.find(item => item.actionId === safeActionId) || null,
        duplicate: true
      };
    }

    const state = clone(row.state);
    const events = Array.isArray(state.events) ? state.events : [];
    const target = events.find(event => String(event.id) === safeTargetId);
    if (!target) throw new Error("That target is gone.");

    const serverNow = Date.now();
    const reportedAt = Date.parse(String(clickedAt || ""));
    // Preserve the actual click time while rapid requests wait behind the global
    // Postgres row lock. A shot may arrive up to 6 seconds after it was tapped,
    // but may not claim a timestamp more than 500 ms in the future. This keeps
    // fast back-to-back hits accurate without allowing arbitrary backdating.
    const timestampIsTrusted = Number.isFinite(reportedAt)
      && reportedAt <= serverNow + 500
      && reportedAt >= serverNow - 6000;
    const actionAt = timestampIsTrusted ? reportedAt : serverNow;
    if (!activeAt(state, target, actionAt, safeUserId)) throw new Error("Too early or too late.");

    let delta = 0;
    let bossProgress = null;
    let kind = target.kind === "boss" ? "boss" : String(target.type || "standard");
    if (target.kind === "boss") {
      target.hitsBy = { ...(target.hitsBy || {}) };
      target.completedBy = { ...(target.completedBy || {}) };
      target.lastHitAtBy = { ...(target.lastHitAtBy || {}) };
      if (target.claimedBy) throw new Error("That boss was already defeated.");
      // Every distinct, deduplicated click counts. Postgres row locking and the
      // actionId unique constraint already prevent double-awards, so a timing
      // throttle would only make legitimate fast taps appear to be missed.
      const hits = Math.min(BOSS_GOAL, Math.max(0, Number(target.hitsBy[safeUserId] || 0)) + 1);
      target.hitsBy[safeUserId] = hits;
      target.lastHitAtBy[safeUserId] = new Date(actionAt).toISOString();
      const won = hits >= BOSS_GOAL;
      if (won) {
        const defeatedAt = new Date(actionAt).toISOString();
        target.completedBy[safeUserId] = defeatedAt;
        target.claimedBy = safeUserId;
        target.claimedName = String(userName || "Player").slice(0, 80);
        target.defeatedBy = safeUserId;
        target.defeatedAt = defeatedAt;
        delta = BOSS_SCORE;
      }
      target.globalHits = Object.values(target.hitsBy).reduce((sum, value) => sum + Math.min(BOSS_GOAL, Math.max(0, Number(value || 0))), 0);
      bossProgress = { playerHits: hits, totalHits: hits, hitGoal: BOSS_GOAL, won, defeatedBy: won ? safeUserId : "" };
    } else {
      // This row lock makes the shared card claim atomic across every Netlify Function instance.
      if (target.claimedBy) throw new Error("That target was already claimed.");
      target.claimedBy = safeUserId;
      target.claimedName = String(userName || "Player").slice(0, 80);
      target.at = new Date(actionAt).toISOString();
      delta = signedInt(target.scoreValue, target.type === "civilian" ? -1 : 1);
    }

    const sequence = Number(row.revision || 0) + 1;
    const actionPayload = { bossProgress };
    await client.query(
      `INSERT INTO draw_actions
        (game_id, action_id, sequence, user_id, target_id, action_kind, delta, action_payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
      [safeGameId, safeActionId, sequence, safeUserId, safeTargetId, kind, delta, JSON.stringify(actionPayload)]
    );
    await client.query(
      `UPDATE draw_matches
          SET state = $2::jsonb, revision = $3, updated_at = NOW()
        WHERE game_id = $1`,
      [safeGameId, JSON.stringify(state), sequence]
    );
    const ledger = await recentLedger(client, safeGameId);
    const hydrated = hydrate(state, sequence, ledger, playerIds);
    const actionRecord = ledger.find(item => item.actionId === safeActionId) || null;
    return { state: hydrated, delta, bossProgress, actionRecord, duplicate: false };
  });
}

async function npcAttempt({ gameId, initialState, playerIds, npcId, npcName }) {
  if (!npcId) return getMatch({ gameId, initialState, playerIds });
  return transaction(async client => {
    const row = await ensureLocked(client, gameId, initialState);
    const state = clone(row.state);
    const now = Date.now();
    const nextAt = Date.parse(state.npcNextActionAt || "") || (Date.parse(state.startAt || "") + 5000);
    if (now < nextAt || now >= Date.parse(state.endAt || "")) {
      const ledger = await recentLedger(client, gameId);
      return hydrate(state, row.revision, ledger, playerIds);
    }
    const active = (state.events || []).filter(event => event.kind !== "boss" && activeAt(state, event, now, npcId));
    let revision = Number(row.revision || 0);
    if (active.length) {
      const target = active[Math.floor(Math.random() * active.length)];
      target.claimedBy = npcId;
      target.claimedName = npcName || "NPC";
      target.at = new Date(now).toISOString();
      revision += 1;
      const delta = signedInt(target.scoreValue, target.type === "civilian" ? -1 : 1);
      const actionId = `npc-${npcId}-${revision}`;
      await client.query(
        `INSERT INTO draw_actions
          (game_id, action_id, sequence, user_id, target_id, action_kind, delta, action_payload)
         VALUES ($1, $2, $3, $4, $5, $6, $7, '{}'::jsonb)
         ON CONFLICT (game_id, action_id) DO NOTHING`,
        [cleanId(gameId), actionId, revision, npcId, String(target.id), String(target.type || "standard"), delta]
      );
    }
    let next = nextAt;
    while (next <= now) next += 5000;
    state.npcNextActionAt = new Date(next).toISOString();
    state.npcAttemptCount = Number(state.npcAttemptCount || 0) + 1;
    await client.query(
      `UPDATE draw_matches SET state = $2::jsonb, revision = $3, updated_at = NOW() WHERE game_id = $1`,
      [cleanId(gameId), JSON.stringify(state), revision]
    );
    const ledger = await recentLedger(client, gameId);
    return hydrate(state, revision, ledger, playerIds);
  });
}

module.exports = { ensureMatch, getMatch, peekMatchRevision, claimTarget, npcAttempt, computeScores };
