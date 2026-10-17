'use strict';
const crypto=require('node:crypto'),{getDatabase}=require('@netlify/database'),rules=require('../../../shared/games/rocket-run');
const fail=(message,status=409)=>{throw Object.assign(Error(message),{status});};
const validRequest=id=>typeof id==='string'&&/^[a-f0-9-]{24,40}$/i.test(id);
function publicGame(s){
 if(!s)return null;
 return {id:s.id,stake:s.stake,autoCents:s.autoCents,status:s.status,launchAt:s.launchAt,capCents:rules.cap(s.stake),createdAt:s.createdAt,
  ...(s.status==='settled'?{outcome:s.outcome,payout:s.payout,cashCents:s.cashCents,endedAt:s.endedAt,...(s.outcome==='crash'?{crashCents:s.crashCents}:{})}:{})};
}
function createStore(injectedPool,injectedWallet,random=crypto.randomInt,now=Date.now){
 let pool=injectedPool,schema;const wallet=injectedWallet||require('../rps/wallet'),db=()=>pool||(pool=getDatabase({connectionString:process.env.NETLIFY_DB_URL}).pool);
 async function ready(){schema||=db().query(`DO $rocket$ BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('rocket-run-schema-v1'));
  CREATE TABLE IF NOT EXISTS rocket_run_games(id TEXT PRIMARY KEY,owner TEXT NOT NULL,state JSONB NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
  CREATE INDEX IF NOT EXISTS rocket_run_owner ON rocket_run_games(owner,created_at DESC);
  CREATE TABLE IF NOT EXISTS rocket_run_requests(owner TEXT NOT NULL,request_id TEXT NOT NULL,game_id TEXT NOT NULL,PRIMARY KEY(owner,request_id));
 END $rocket$;`).catch(e=>{schema=null;throw e;});return schema;}
 async function tx(fn){await ready();const c=await db().connect();try{await c.query('BEGIN');const r=await fn(c);await c.query('COMMIT');return r;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
 const save=(c,s)=>c.query('UPDATE rocket_run_games SET state=$2::jsonb WHERE id=$1',[s.id,JSON.stringify(s)]);
 async function load(c,player,id){const s=(await c.query('SELECT state FROM rocket_run_games WHERE id=$1 AND owner=$2 FOR UPDATE',[id,player.id])).rows[0]?.state;if(!s)fail('Flight not found.',404);return s;}
 async function recover(player,id,manualAt=null){
  // The secret outcome is committed before debit. A result is committed before
  // credit. Every wallet retry uses the same immutable receipt and amount.
  const prepared=await tx(async c=>{
   const s=await load(c,player,id),before=s.status;
   if(s.status==='funding'){
    try{await wallet.apply(s.account,{id:`rocket:${s.id}:stake:${s.owner}`,delta:-s.stake,reason:'Rocket Run · launch'});s.status='active';s.launchAt=now()+rules.countdownMs;}
    catch(e){if(e.code!=='RPS_FUNDS')throw e;s.status='failed';s.error=e.message;}
   }
   if(s.status==='active'){
    const stamp=manualAt??now(),target=s.autoCents??rules.cap(s.stake),crashAt=s.launchAt+rules.timeAt(s.crashCents),autoAt=s.launchAt+rules.timeAt(target);
    if(s.crashCents<=target&&stamp>=crashAt){s.outcome='crash';s.payout=0;s.cashCents=0;s.endedAt=crashAt;s.status='paying';}
    else if(target<s.crashCents&&stamp>=autoAt){s.outcome=target===rules.cap(s.stake)?'limit':'auto';s.cashCents=target;s.payout=rules.payout(s.stake,target);s.endedAt=autoAt;s.status='paying';}
    else if(manualAt!==null){
     if(stamp<s.launchAt)fail('Wait for liftoff before cashing out.');
     s.outcome='cashout';s.cashCents=rules.centsAt(stamp-s.launchAt);s.payout=rules.payout(s.stake,s.cashCents);s.endedAt=stamp;s.status='paying';
    }
   }
   if(s.status!==before)await save(c,s);
   return s;
  });
  if(prepared.status!=='paying')return prepared;
  return tx(async c=>{const s=await load(c,player,id);if(s.status==='paying'){await wallet.apply(s.account,{id:`rocket:${s.id}:payout:${s.owner}`,delta:s.payout,reason:'Rocket Run · '+(s.outcome==='crash'?'flight lost':s.cashCents/100+'× return')});s.status='settled';s.settledAt=now();await save(c,s);}return s;});
 }
 async function start(player,b){
  if(!rules.stakes.includes(b.stake)||!rules.validAuto(b.autoCents,b.stake))fail('Choose an available wager and automatic cash-out target.',400);
  if(!validRequest(b.requestId))fail('Missing launch reference.',400);
  const account=await wallet.account(player);
  const id=await tx(async c=>{
   await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',['rocket-owner:'+player.id]);
   const prior=(await c.query('SELECT game_id FROM rocket_run_requests WHERE owner=$1 AND request_id=$2',[player.id,b.requestId])).rows[0];if(prior)return prior.game_id;
   const existing=(await c.query("SELECT state FROM rocket_run_games WHERE owner=$1 AND state->>'status' IN ('funding','active','paying') ORDER BY created_at DESC LIMIT 1",[player.id])).rows[0]?.state;
   let s=existing;
   if(!s){
    if(b.quote!==rules.build)fail('Rocket Run has changed. Refresh before launching.',400);
    s={id:crypto.randomBytes(6).toString('hex').toUpperCase(),owner:player.id,account,stake:b.stake,autoCents:b.autoCents,quote:rules.build,crashCents:rules.crashFrom(random(rules.range)),status:'funding',createdAt:now(),launchAt:null};
    await c.query('INSERT INTO rocket_run_games(id,owner,state) VALUES($1,$2,$3::jsonb)',[s.id,player.id,JSON.stringify(s)]);
   }
   await c.query('INSERT INTO rocket_run_requests(owner,request_id,game_id) VALUES($1,$2,$3)',[player.id,b.requestId,s.id]);return s.id;
  });
  const s=await recover(player,id);if(s.status==='failed')fail(s.error||'Unable to fund this launch.');return s;
 }
 async function cashout(player,b,receivedAt=now()){if(!/^[A-F0-9]{12}$/.test(b.gameId||'')||!validRequest(b.requestId))fail('Invalid flight reference.',400);return recover(player,b.gameId,Math.min(receivedAt,now()));}
 async function current(player){await ready();const r=(await db().query("SELECT id FROM rocket_run_games WHERE owner=$1 AND state->>'status'<>'failed' ORDER BY created_at DESC LIMIT 1",[player.id])).rows[0];return r?recover(player,r.id):null;}
 return {ready,start,cashout,current,recover,publicGame,time:now};
}
module.exports={...createStore(),createStore,publicGame};
