'use strict';
const { getDatabase } = require('@netlify/database');
const crypto = require('node:crypto');
const rules = require('../../../shared/games/rps-model');
function createStore(injectedPool, injectedWallet) {
const wallet = () => injectedWallet || require('./wallet');
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
    // One transactional block shares a lock across cold workers.
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
async function prepareCreate(player, bot = false, invited = null, wager = 0) {
  return transaction(async c => {
    // Serialize creates per verified identity, so request retries reuse an active arena.
    await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['rps:' + player.id]);
    const { rows } = await c.query(`SELECT state FROM rps_matches WHERE updated_at>NOW()-INTERVAL '20 minutes'
      AND state->'players' @> $1::jsonb ORDER BY updated_at DESC LIMIT 20 FOR UPDATE`, [JSON.stringify([{ id: player.id }])]);
    if(rows.some(r=>r.state.finance?.pending))error('A previous stake is still being confirmed. Retry shortly.');
    const active = rows.map(r => rules.advance(r.state)).find(s => ['waiting','choosing','reveal'].includes(s.phase));
    if (active) {
      if (active.phase === 'waiting' && bot && !active.invitedId) {
        if(active.wager) error('Leave your wagered duel before starting free bot practice.');
        const next = rules.join(active, { id:'bot:emperor', name:'Network Bot', character:'voss', bot:true });
        await c.query('UPDATE rps_matches SET state=$2::jsonb,updated_at=NOW() WHERE id=$1', [next.id,JSON.stringify(next)]);
        return next;
      }
      if (invited && active.invitedId !== invited.id) error('Leave your current duel before challenging your rival.');
      if (bot && !active.players.some(p => p.bot)) error('Leave your current duel before starting network practice.');
      return active;
    }
    let s = rules.create(id(), player);
    if(!bot && wager) {
      if(!Number.isSafeInteger(wager)||wager<1000||wager>50000||wager%1000)error('Choose 1,000–50,000 Chips in 1,000-Chip steps.');
      s.wager=wager;s.finance={accounts:{[player.id]:await wallet().account(player)},paid:[],pending:player.id,status:'funding',rate:await wallet().rate()};
    }
    if (invited) { s.invitedId = invited.id; s.invitedName = invited.name; }
    if (bot) s = rules.join(s, { id: 'bot:emperor', name: 'Network Bot', character:'voss', bot: true });
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
async function prepareAction(gameId, player, action, body = {}) {
  return transaction(async c => {
    if (action === 'join') {
      await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['rps:' + player.id]);
      const active = await c.query(`SELECT state FROM rps_matches WHERE id<>$1 AND updated_at>NOW()-INTERVAL '20 minutes'
        AND state->'players' @> $2::jsonb`,[gameId,JSON.stringify([{id:player.id}])]);
      if (active.rows.some(r => ['choosing','reveal'].includes(rules.advance(r.state).phase))) error('Leave your current duel before joining another.');
    }
    const row = (await c.query('SELECT state FROM rps_matches WHERE id=$1 FOR UPDATE', [gameId])).rows[0];
    if (!row) error('Arena not found. Check the invite code.', 404);
    let s = rules.advance(row.state), now = Date.now();
    if (action === 'decline') {
      if (s.invitedId !== player.id) error('This invitation belongs to its recipient.',403);
      if (s.phase === 'waiting') {
        s.phase = 'cancelled'; s.reason = 'The invitation was declined. Challenge another opponent.'; s.revision++;
        await c.query('UPDATE rps_matches SET state=$2::jsonb,updated_at=NOW() WHERE id=$1',[s.id,JSON.stringify(s)]);
      }
      return null;
    }
    if (action === 'join') {
      if(s.wager && body.wager !== s.wager && !s.players.some(p=>p.id===player.id))error('Review and accept this arena’s wager first.');
      if(s.finance?.pending && !s.players.some(p=>p.id===player.id))error('The arena is funding a stake. Try again shortly.');
      const joining=!s.players.some(p=>p.id===player.id), waitingDeadline=s.deadline;s=rules.join(s,player,now);
      if(joining && s.wager){
        const account=await wallet().account(player);
        if(Object.values(s.finance.accounts).includes(account))error('Both opponents must use different Chip accounts.');
        s.phase='waiting';s.finance.pending=player.id;s.finance.accounts[player.id]=account;s.finance.status='funding';s.finance.waitingDeadline=waitingDeadline;
      }
    }
    if (!s.players.some(p => p.id === player.id)) error('This duel belongs to its two players.', 403);
    if (action === 'pick') {
      if(s.finance?.pending)error('The stakes are still being confirmed.');
      // Bot locks a cryptographically random choice before processing the human pick.
      if (s.players[1]?.bot && s.phase === 'choosing' && !s.picks[1])
        s = rules.pick(s, s.players[1].id, rules.CHOICES[crypto.randomInt(3)], s.round, now);
      s = rules.pick(s, player.id, body.choice, body.round, now, crypto.randomInt(3));
    }
    if (row.state.winner === null && s.winner !== null) await record(c, s);
    if (action === 'leave' && !['complete','cancelled'].includes(s.phase) && s.winner === null) {
      if(s.wager && ['choosing','reveal'].includes(s.phase) && s.finance.paid.length===2) {
        s=rules.forfeit(s,1-s.players.findIndex(p=>p.id===player.id),'A challenger left the duel.',now);await record(c,s);
      } else {s.phase='cancelled';s.reason='A challenger left the arena. Any reserved Chips are returned.';s.revision++;}
    }
    if (action === 'rematch') {
      if (s.phase !== 'complete') error('Finish this match first.');
      if(s.wager && body.wager!==s.wager)error('Review and accept the rematch wager first.');
      if(s.wager && !s.nextMatch) {
        if(!s.rematchVoteUntil || s.rematchVoteUntil<=now){s.rematchVotes=[];s.rematchVoteUntil=now+120000;}
        const other=await c.query(`SELECT state FROM rps_matches WHERE id<>$1 AND updated_at>NOW()-INTERVAL '20 minutes'
          AND (state->'players' @> $2::jsonb OR state->'players' @> $3::jsonb)`,[s.id,JSON.stringify([{id:s.players[0].id}]),JSON.stringify([{id:s.players[1].id}])]);
        if(other.rows.some(r=>['choosing','reveal'].includes(rules.advance(r.state).phase)))error('An opponent already has an active duel.');
      }
      if (!s.rematchVotes.includes(player.id)) { s.rematchVotes.push(player.id); s.revision++; }
      if (s.players[1].bot && !s.rematchVotes.includes(s.players[1].id)) s.rematchVotes.push(s.players[1].id);
      if (s.rematchVotes.length === 2 && !s.nextMatch) {
        const next = rules.join(rules.create(id(), s.players[0], now), s.players[1], now);
        if(s.wager){next.wager=s.wager;next.phase='waiting';next.finance={accounts:{...s.finance.accounts},paid:[],pending:next.players[0].id,status:'funding',rate:await wallet().rate(),rematch:true};}
        await insert(c, next); s.nextMatch = next.id; s.revision++;
      }
    }
    if (JSON.stringify(s) !== JSON.stringify(row.state))
      await c.query('UPDATE rps_matches SET state=$2::jsonb,updated_at=NOW() WHERE id=$1', [s.id, JSON.stringify(s)]);
    return s;
  });
}
async function lobby(player) {
  await sweep(player.id);
  await ready();
  const { rows } = await db().query(`SELECT state FROM rps_matches WHERE state->>'phase'='waiting' AND COALESCE(state->'finance'->>'pending','')=''
    AND (state->>'deadline')::bigint>$1 ORDER BY updated_at DESC LIMIT 30`, [Date.now()]);
  return rows.filter(({state:s}) => !s.invitedId || s.players[0].id === player.id)
    .map(({state:s}) => ({ id:s.id, name:s.players[0].name, wager:s.wager||0, mine:s.players[0].id === player.id, expiresAt:s.deadline }));
}
async function ownedJoined(player) {
  await ready();
  const {rows}=await db().query(`SELECT state FROM rps_matches WHERE state->'players'->0->>'id'=$1 AND updated_at>NOW()-INTERVAL '1 day'`,[player.id]);
  return rows.filter(({state:s})=>s.players[1]&&!s.players[1].bot).map(({state:s})=>({id:s.id,mode:'rps',name:s.players[1].name,joiner:s.players[1].id,href:'/games/multiplayer/rps/?arena='+s.id}));
}
async function invitations(player) {
  await ready();
  const {rows} = await db().query(`SELECT state FROM rps_matches WHERE state->>'phase'='waiting'
    AND COALESCE(state->'finance'->>'pending','')=''
    AND state->>'invitedId'=$1 AND (state->>'deadline')::bigint>$2 ORDER BY updated_at DESC LIMIT 20`,[player.id,Date.now()]);
  return rows.map(({state:s}) => ({id:s.id,name:s.players[0].name,wager:s.wager||0,expiresAt:s.deadline}));
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
// Committed matches are durable payment intents. A wallet write may succeed
// before a DB commit fails; stable ledger IDs make recovery repeat-safe.
async function recover(gameId) {
  return transaction(async c=>{
    const row=(await c.query('SELECT state FROM rps_matches WHERE id=$1 FOR UPDATE',[gameId])).rows[0];
    if(!row)return null;
    let s=rules.advance(row.state);const f=s.finance;
    if(!s.wager||!f)return s;
    while(f.pending) {
      const who=f.pending;
      try {
        await wallet().apply(f.accounts[who],{id:'rps:'+s.id+':stake:'+who,delta:-s.wager,reason:'Rock Paper Scissors stake',meta:{gameId:s.id}});
        if(!f.paid.includes(who))f.paid.push(who);
        f.pending=null;
        if(f.rematch && f.paid.length===1)f.pending=s.players[1].id;
      } catch(e) {
        if(e.code!=='RPS_FUNDS')throw e;
        if(s.players[0].id===who || f.rematch) {s.phase='cancelled';s.reason=e.message;}
        else {s.players=s.players.filter(p=>p.id!==who);delete f.accounts[who];s.deadline=f.waitingDeadline||s.deadline;s.reason=e.message;}
        f.pending=null;f.rematch=false;
      }
      s.revision++;
    }
    delete f.waitingDeadline;
    if(s.phase==='waiting' && s.players.length===2 && f.paid.length===2){s.phase='choosing';s.deadline=Date.now()+rules.PICK_MS;s.revision++;}
    if(f.status==='funding')f.status='reserved';
    if(['cancelled','complete'].includes(s.phase) && f.status!=='settled') {
      if(s.phase==='complete' && s.winner!==null) {
        const pot=s.wager*2,cut=f.rate<=0?0:Math.max(1,Math.ceil(pot*f.rate/100));
        const winner=s.players[s.winner];
        if(f.paid.length!==2)throw new Error('Unfunded result.');
        f.payout=pot-cut;f.houseCut=cut;
        await wallet().apply(f.accounts[winner.id],{id:'rps:'+s.id+':payout:'+winner.id,delta:f.payout,reason:'Rock Paper Scissors win',meta:{gameId:s.id,houseCut:cut}});
      } else {
        for(const who of f.paid)await wallet().apply(f.accounts[who],{id:'rps:'+s.id+':refund:'+who,delta:s.wager,reason:'Rock Paper Scissors cancellation refund',meta:{gameId:s.id}});
        f.payout=0;
      }
      f.status='settled';s.revision++;
    }
    if(s.winner!==null && row.state.winner===null)await record(c,s);
    if(JSON.stringify(s)!==JSON.stringify(row.state))await c.query('UPDATE rps_matches SET state=$2::jsonb,updated_at=NOW() WHERE id=$1',[s.id,JSON.stringify(s)]);
    return s;
  });
}
async function create(player,bot=false,invited=null,wager=0) {
  await sweep(player.id);
  const s=await prepareCreate(player,bot,invited,wager);return await recover(s.id)||s;
}
async function act(gameId,player,action,body={}) {
  if(action==='join')await sweep(player.id);
  const s=await prepareAction(gameId,player,action,body);if(!s){await recover(gameId);return null;}
  const result=await recover(s.id)||s;
  if(action==='join' && !result.players.some(p=>p.id===player.id))error(result.reason||'Unable to reserve your wager.');
  if(result.nextMatch)await recover(result.nextMatch);
  return result;
}
async function sweep(playerId=null) {
  await ready();
  const {rows}=await db().query(`SELECT id FROM rps_matches WHERE COALESCE((state->>'wager')::int,0)>0
    AND state->'finance'->>'status'<>'settled'
    AND ($1::text IS NULL OR state->'players' @> jsonb_build_array(jsonb_build_object('id',$1::text)))
    AND (state->'finance'->>'pending' IS NOT NULL OR state->>'phase' IN ('complete','cancelled')
      OR (state->>'phase'='reveal' AND (state->>'nextAt')::bigint<$2)
      OR (state->>'phase' IN ('choosing','waiting') AND (state->>'deadline')::bigint<$2))
    ORDER BY updated_at LIMIT 40`,[playerId,Date.now()]);
  let recovered=0,failed=0;
  for(const {id} of rows)try{await recover(id);recovered++;}catch{failed++;}
  return {recovered,failed};
}
async function balance(player){return wallet().balance(player);}
async function quote(gameId,player) {
  await ready();
  const s=(await db().query('SELECT state FROM rps_matches WHERE id=$1',[gameId])).rows[0]?.state;
  if(!s || s.phase!=='waiting' || s.deadline<=Date.now() || s.finance?.pending)error('This arena is no longer open.');
  if(s.invitedId && s.invitedId!==player.id && s.players[0].id!==player.id)error('This challenge is reserved for its recipient.',403);
  return {id:s.id,name:s.players[0].name,wager:s.wager||0,houseCutPercent:s.finance?.rate||0};
}
return { session, authenticate, create, act, lobby, ownedJoined, rivals, invitations, balance, sweep, quote, rate:()=>wallet().rate() };
}
module.exports = { ...createStore(), createStore };
