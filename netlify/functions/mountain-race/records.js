'use strict';

// Times come exclusively from the authoritative state, never a client stopwatch.
function finishEntries(game, state) {
  const start = Date.parse(state.startAt), end = Date.parse(state.endAt);
  return [game.creator, game.joiner].filter(p => p?.userId && !p.isNpc && !p.isTestPlayer && !/^(npc-|remote-bot-|test-)/.test(p.userId)).map(p => {
    const run = state.players?.[p.userId] || {}, finish = Date.parse(run.finishedAt);
    const finished = run.promptIndex === state.sequence.length && Number.isFinite(start) && Number.isFinite(finish) && finish >= start && finish <= end;
    return {userId:String(p.userId), elapsedMs:finished ? finish-start : null};
  }).sort((a,b) => a.userId.localeCompare(b.userId));
}

function createRecorder(pool) {
  let schema;
  async function ready() {
    if (!schema) schema = pool.query(`DO $summit$ BEGIN
      PERFORM pg_advisory_xact_lock(hashtext('summit-record-schema-v1'));
      CREATE TABLE IF NOT EXISTS summit_personal_bests(user_id TEXT NOT NULL, course TEXT NOT NULL, best_ms BIGINT NOT NULL, PRIMARY KEY(user_id,course));
      CREATE TABLE IF NOT EXISTS summit_finishes(game_id TEXT NOT NULL, user_id TEXT NOT NULL, course TEXT NOT NULL, elapsed_ms BIGINT NOT NULL, previous_best_ms BIGINT, finished_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(game_id,user_id));
      END $summit$;`).catch(e => {schema=null;throw e;});
    await schema;
  }
  return async function recordRace(game, state) {
    await ready();
    const client=await pool.connect(), result={}, course='directional-v1-'+state.sequence.length;
    try {
      await client.query('BEGIN');
      for (const entry of finishEntries(game,state)) {
        const {userId,elapsedMs}=entry;
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',['summit-best:'+userId]);
        const bestRow=(await client.query('SELECT best_ms FROM summit_personal_bests WHERE user_id=$1 AND course=$2',[userId,course])).rows[0];
        const best=bestRow ? Number(bestRow.best_ms) : null;
        if (elapsedMs===null) {result[userId]={bestMs:best,elapsedMs:null};continue;}
        const previous=(await client.query('SELECT elapsed_ms,previous_best_ms FROM summit_finishes WHERE game_id=$1 AND user_id=$2',[game.gameId,userId])).rows[0];
        if (previous) {
          result[userId]={elapsedMs:Number(previous.elapsed_ms),previousBestMs:previous.previous_best_ms===null?null:Number(previous.previous_best_ms),bestMs:best};
          continue;
        }
        await client.query('INSERT INTO summit_finishes(game_id,user_id,course,elapsed_ms,previous_best_ms) VALUES($1,$2,$3,$4,$5)',[game.gameId,userId,course,elapsedMs,best]);
        await client.query('INSERT INTO summit_personal_bests(user_id,course,best_ms) VALUES($1,$2,$3) ON CONFLICT(user_id,course) DO UPDATE SET best_ms=LEAST(summit_personal_bests.best_ms,EXCLUDED.best_ms)',[userId,course,elapsedMs]);
        result[userId]={elapsedMs,previousBestMs:best,bestMs:best===null?elapsedMs:Math.min(best,elapsedMs)};
      }
      await client.query('COMMIT');return result;
    } catch(e) {await client.query('ROLLBACK');throw e;} finally {client.release();}
  };
}
let recorder;
async function recordRace(game,state) {
  if (!recorder) {
    const {getDatabase}=require('@netlify/database');
    const connectionString=process.env.NETLIFY_DB_URL;
    if (!connectionString) throw new Error('Summit record storage is unavailable. Please retry.');
    recorder=createRecorder(getDatabase({connectionString}).pool);
  }
  return recorder(game,state);
}
module.exports={recordRace,createRecorder,finishEntries};
