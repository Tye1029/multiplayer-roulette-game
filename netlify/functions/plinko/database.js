'use strict';
const crypto=require('node:crypto'),{getDatabase}=require('@netlify/database'),rules=require('../../../shared/games/plinko');
const fail=(message,status=409)=>{throw Object.assign(Error(message),{status});};
function draw(stake,risk,random=crypto.randomInt){return rules.outcome(stake,risk,Array.from({length:rules.rows},()=>random(2)));}
function publicDrop(s){return s?{id:s.id,stake:s.stake,risk:s.risk,status:s.status,createdAt:s.createdAt,availableAt:s.createdAt+rules.dropMs,...(s.status==='settled'?{path:s.path,bucket:s.bucket,payout:s.payout,multiplier:s.multiplier}:{})}:null;}
function createStore(injectedPool,injectedWallet,random=crypto.randomInt,now=Date.now){
 let pool=injectedPool,schema;const wallet=injectedWallet||require('../rps/wallet'),db=()=>pool||(pool=getDatabase({connectionString:process.env.NETLIFY_DB_URL}).pool);
 async function ready(){schema||=db().query(`DO $plinko$ BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('plinko-schema-v1'));
  CREATE TABLE IF NOT EXISTS plinko_drops(id TEXT PRIMARY KEY,owner TEXT NOT NULL,state JSONB NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
  CREATE INDEX IF NOT EXISTS plinko_owner ON plinko_drops(owner,created_at DESC);
  CREATE TABLE IF NOT EXISTS plinko_requests(owner TEXT NOT NULL,request_id TEXT NOT NULL,drop_id TEXT NOT NULL,PRIMARY KEY(owner,request_id));
 END $plinko$;`).catch(e=>{schema=null;throw e;});return schema;}
 async function tx(fn){await ready();const c=await db().connect();try{await c.query('BEGIN');const result=await fn(c);await c.query('COMMIT');return result;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
 const save=(c,s)=>c.query('UPDATE plinko_drops SET state=$2::jsonb WHERE id=$1',[s.id,JSON.stringify(s)]);
 async function load(c,player,id){const s=(await c.query('SELECT state FROM plinko_drops WHERE id=$1 AND owner=$2 FOR UPDATE',[id,player.id])).rows[0]?.state;if(!s)fail('Drop not found.',404);return s;}
 async function recover(player,id){
  // Commit the immutable award before credit; lost responses retry the same receipts.
  await tx(async c=>{const s=await load(c,player,id);if(s.status!=='funding')return;
   try{await wallet.apply(s.account,{id:`plinko:${s.id}:stake:${s.owner}`,delta:-s.stake,reason:'Plinko · '+rules.risks[s.risk].name+' risk'});s.status='awarded';}
   catch(e){if(e.code!=='RPS_FUNDS')throw e;s.status='failed';s.error=e.message;}await save(c,s);
  });
  return tx(async c=>{const s=await load(c,player,id);if(s.status==='awarded'){await wallet.apply(s.account,{id:`plinko:${s.id}:payout:${s.owner}`,delta:s.payout,reason:'Plinko · '+s.multiplier+'× return'});s.status='settled';s.settledAt=now();await save(c,s);}return s;});
 }
 async function drop(player,b){
  if(!rules.stakes.includes(b.stake)||typeof b.risk!=='string'||!Object.hasOwn(rules.risks,b.risk))fail('Choose an available wager and risk level.',400);
  if(!/^[a-f0-9-]{24,40}$/i.test(b.requestId||''))fail('Missing drop reference.',400);
  const account=await wallet.account(player),id=await tx(async c=>{
   await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',['plinko-owner:'+player.id]);
   const prior=(await c.query('SELECT drop_id FROM plinko_requests WHERE owner=$1 AND request_id=$2',[player.id,b.requestId])).rows[0];if(prior)return prior.drop_id;
   const recent=(await c.query("SELECT state FROM plinko_drops WHERE owner=$1 AND state->>'status'<>'failed' ORDER BY created_at DESC LIMIT 1",[player.id])).rows[0]?.state;
   let s;if(recent&&['funding','awarded'].includes(recent.status))s=recent;else{
    if(b.quote!==rules.build)fail('Plinko has changed. Refresh before dropping a ball.',400);
    if(recent&&now()<recent.createdAt+rules.dropMs)fail('Let this ball land before dropping another.',429);
    s={id:crypto.randomBytes(6).toString('hex').toUpperCase(),owner:player.id,account,stake:b.stake,risk:b.risk,...draw(b.stake,b.risk,random),quote:rules.build,status:'funding',createdAt:now()};
    await c.query('INSERT INTO plinko_drops(id,owner,state) VALUES($1,$2,$3::jsonb)',[s.id,player.id,JSON.stringify(s)]);
   }
   await c.query('INSERT INTO plinko_requests(owner,request_id,drop_id) VALUES($1,$2,$3)',[player.id,b.requestId,s.id]);return s.id;
  });
  const s=await recover(player,id);if(s.status==='failed')fail(s.error||'Unable to fund this drop.');return s;
 }
 async function current(player){await ready();const s=(await db().query("SELECT id FROM plinko_drops WHERE owner=$1 AND state->>'status'<>'failed' ORDER BY created_at DESC LIMIT 1",[player.id])).rows[0];return s?recover(player,s.id):null;}
 async function history(player){await ready();return (await db().query("SELECT state FROM plinko_drops WHERE owner=$1 AND state->>'status'='settled' ORDER BY created_at DESC LIMIT 10",[player.id])).rows.map(r=>{const {path,...s}=publicDrop(r.state);return s;});}
 return {ready,drop,current,recover,history,publicDrop};
}
module.exports={...createStore(),createStore,draw,publicDrop};
