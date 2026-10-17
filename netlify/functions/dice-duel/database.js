'use strict';
const crypto=require('node:crypto'),{getDatabase}=require('@netlify/database'),rules=require('../../../shared/games/dice-duel');
const fail=(message,status=409)=>{throw Object.assign(Error(message),{status});};
function draw(stake,random=crypto.randomInt){return rules.outcome(stake,Array.from({length:4},()=>random(6)+1));}
function publicRound(s){return s?{id:s.id,stake:s.stake,status:s.status,createdAt:s.createdAt,...(s.status==='settled'?{availableAt:s.availableAt,dice:s.dice,playerTotal:s.playerTotal,houseTotal:s.houseTotal,outcome:s.outcome,payout:s.payout,multiplier:s.multiplier}:{})}:null;}
function createStore(injectedPool,injectedWallet,random=crypto.randomInt,now=Date.now){
 let pool=injectedPool,schema;const wallet=injectedWallet||require('../rps/wallet'),db=()=>pool||(pool=getDatabase({connectionString:process.env.NETLIFY_DB_URL}).pool);
 async function ready(){schema||=db().query(`DO $dice_duel$ BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('dice-duel-schema-v1'));
  CREATE TABLE IF NOT EXISTS dice_duel_rounds(id TEXT PRIMARY KEY,owner TEXT NOT NULL,state JSONB NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
  CREATE INDEX IF NOT EXISTS dice_duel_owner ON dice_duel_rounds(owner,created_at DESC);
  CREATE TABLE IF NOT EXISTS dice_duel_requests(owner TEXT NOT NULL,request_id TEXT NOT NULL,round_id TEXT NOT NULL,PRIMARY KEY(owner,request_id));
 END $dice_duel$;`).catch(e=>{schema=null;throw e;});return schema;}
 async function tx(fn){await ready();const c=await db().connect();try{await c.query('BEGIN');const result=await fn(c);await c.query('COMMIT');return result;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
 const save=(c,s)=>c.query('UPDATE dice_duel_rounds SET state=$2::jsonb WHERE id=$1',[s.id,JSON.stringify(s)]);
 async function load(c,player,id){const s=(await c.query('SELECT state FROM dice_duel_rounds WHERE id=$1 AND owner=$2 FOR UPDATE',[id,player.id])).rows[0]?.state;if(!s)fail('Round not found.',404);return s;}
 async function recover(player,id){
  // The outcome is committed before any wallet write. Retries always use the
  // same debit and award receipts, even after a lost cross-store response.
  await tx(async c=>{const s=await load(c,player,id);if(s.status!=='funding')return;
   try{await wallet.apply(s.account,{id:`diceduel:${s.id}:stake:${s.owner}`,delta:-s.stake,reason:'Dice Duel · wager'});s.status='awarded';}
   catch(e){if(e.code!=='RPS_FUNDS')throw e;s.status='failed';s.error=e.message;}await save(c,s);
  });
  return tx(async c=>{const s=await load(c,player,id);if(s.status==='awarded'){
   const kind=s.outcome==='tie'?'refund':'payout';
   await wallet.apply(s.account,{id:`diceduel:${s.id}:${kind}:${s.owner}`,delta:s.payout,reason:'Dice Duel · '+(s.outcome==='win'?'1.8× win':s.outcome==='tie'?'tie · wager returned':'house wins')});
   s.status='settled';s.settledAt=now();s.availableAt=s.settledAt+rules.rollMs;await save(c,s);
  }return s;});
 }
 async function roll(player,b){
  if(!rules.stakes.includes(b.stake))fail('Choose an available wager.',400);
  if(typeof b.requestId!=='string'||!/^[a-f0-9-]{24,40}$/i.test(b.requestId))fail('Missing roll reference.',400);
  const account=await wallet.account(player),id=await tx(async c=>{
   await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',['dice-duel-owner:'+player.id]);
   const prior=(await c.query('SELECT round_id FROM dice_duel_requests WHERE owner=$1 AND request_id=$2',[player.id,b.requestId])).rows[0];if(prior)return prior.round_id;
   const recent=(await c.query("SELECT state FROM dice_duel_rounds WHERE owner=$1 AND state->>'status'<>'failed' ORDER BY created_at DESC LIMIT 1",[player.id])).rows[0]?.state;
   let s;if(recent&&['funding','awarded'].includes(recent.status))s=recent;else{
    if(b.quote!==rules.build)fail('Dice Duel has changed. Refresh before rolling.',400);
    if(recent&&now()<recent.availableAt)fail('Let the dice settle before rolling again.',429);
    s={id:crypto.randomBytes(6).toString('hex').toUpperCase(),owner:player.id,account,stake:b.stake,...draw(b.stake,random),quote:rules.build,status:'funding',createdAt:now()};
    await c.query('INSERT INTO dice_duel_rounds(id,owner,state) VALUES($1,$2,$3::jsonb)',[s.id,player.id,JSON.stringify(s)]);
   }
   await c.query('INSERT INTO dice_duel_requests(owner,request_id,round_id) VALUES($1,$2,$3)',[player.id,b.requestId,s.id]);return s.id;
  });
  const s=await recover(player,id);if(s.status==='failed')fail(s.error||'Unable to fund this round.');return s;
 }
 async function current(player){await ready();const s=(await db().query("SELECT id FROM dice_duel_rounds WHERE owner=$1 AND state->>'status'<>'failed' ORDER BY created_at DESC LIMIT 1",[player.id])).rows[0];return s?recover(player,s.id):null;}
 return {ready,roll,current,recover,publicRound};
}
module.exports={...createStore(),createStore,draw,publicRound};
