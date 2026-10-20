'use strict';
const crypto=require('node:crypto'),{getDatabase}=require('@netlify/database'),rules=require('../../../shared/games/back-alley-derby');
const fail=(message,status=409)=>{throw Object.assign(Error(message),{status});};
function publicRound(s){return s?{id:s.id,stake:s.stake,rat:s.rat,status:s.status,createdAt:s.createdAt,...(['racing','awarded','settled'].includes(s.status)?{order:s.order,seed:s.seed,startedAt:s.startedAt,availableAt:s.availableAt}:{}),...(s.status==='settled'?{winner:s.winner,outcome:s.outcome,payout:s.payout,multiplier:s.multiplier}:{})}:null;}
function createStore(injectedPool,injectedWallet,random=crypto.randomInt,now=Date.now){
 let pool=injectedPool,schema;const wallet=injectedWallet||require('../rps/wallet'),db=()=>pool||(pool=getDatabase({connectionString:process.env.NETLIFY_DB_URL}).pool);
 async function ready(){schema||=db().query(`DO $derby$ BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('back-alley-derby-schema-v1'));
  CREATE TABLE IF NOT EXISTS back_alley_derby_rounds(id TEXT PRIMARY KEY,owner TEXT NOT NULL,state JSONB NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
  CREATE INDEX IF NOT EXISTS back_alley_derby_owner ON back_alley_derby_rounds(owner,created_at DESC);
  CREATE TABLE IF NOT EXISTS back_alley_derby_requests(owner TEXT NOT NULL,request_id TEXT NOT NULL,round_id TEXT NOT NULL,PRIMARY KEY(owner,request_id));
 END $derby$;`).catch(e=>{schema=null;throw e;});return schema;}
 async function tx(fn){await ready();const c=await db().connect();try{await c.query('BEGIN');const result=await fn(c);await c.query('COMMIT');return result;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
 const save=(c,s)=>c.query('UPDATE back_alley_derby_rounds SET state=$2::jsonb WHERE id=$1',[s.id,JSON.stringify(s)]);
 async function load(c,p,id){const s=(await c.query('SELECT state FROM back_alley_derby_rounds WHERE id=$1 AND owner=$2 FOR UPDATE',[id,p.id])).rows[0]?.state;if(!s)fail('Race not found.',404);return s;}
 async function recover(p,id){
  // Persist the race before wallet writes. A lost wallet reply reuses the
  // committed receipt and race instead of drawing again or charging twice.
  await tx(async c=>{const s=await load(c,p,id);if(s.status!=='funding')return;
   try{await wallet.apply(s.account,{id:`derby:${s.id}:stake:${s.owner}`,delta:-s.stake,reason:'Back Alley Derby · wager'});s.status='racing';s.startedAt=now();s.availableAt=s.startedAt+rules.totalMs;}
   catch(e){if(e.code!=='RPS_FUNDS')throw e;s.status='failed';s.error=e.message;}await save(c,s);
  });
  return tx(async c=>{const s=await load(c,p,id);if(s.status==='racing'&&now()>=s.availableAt){s.status='awarded';await save(c,s);}
   if(s.status==='awarded'){await wallet.apply(s.account,{id:`derby:${s.id}:payout:${s.owner}`,delta:s.payout,reason:'Back Alley Derby · '+(s.outcome==='win'?'winning ticket':'race finished')});s.status='settled';s.settledAt=now();await save(c,s);}return s;
  });
 }
 async function start(p,b){
  if(typeof b.requestId!=='string'||!/^[a-f0-9-]{24,40}$/i.test(b.requestId))fail('Missing race reference.',400);
  const account=await wallet.account(p),id=await tx(async c=>{
   await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',['back-alley-derby-owner:'+p.id]);
   const prior=(await c.query('SELECT round_id FROM back_alley_derby_requests WHERE owner=$1 AND request_id=$2',[p.id,b.requestId])).rows[0];if(prior)return prior.round_id;
   const recent=(await c.query("SELECT state FROM back_alley_derby_rounds WHERE owner=$1 AND state->>'status'<>'failed' ORDER BY created_at DESC LIMIT 1",[p.id])).rows[0]?.state;
   let s;if(recent&&['funding','racing','awarded'].includes(recent.status))s=recent;else{
    try{rules.quote(b.stake,b.rat);}catch(e){fail(e.message,400);}
    if(b.quote!==rules.build)fail('The derby has changed. Refresh before betting.',400);
    s={id:crypto.randomBytes(6).toString('hex').toUpperCase(),owner:p.id,account,stake:b.stake,...rules.outcome(b.stake,b.rat,rules.draw(random)),seed:crypto.randomBytes(8).toString('hex'),quote:rules.build,status:'funding',createdAt:now()};
    await c.query('INSERT INTO back_alley_derby_rounds(id,owner,state) VALUES($1,$2,$3::jsonb)',[s.id,p.id,JSON.stringify(s)]);
   }
   await c.query('INSERT INTO back_alley_derby_requests(owner,request_id,round_id) VALUES($1,$2,$3)',[p.id,b.requestId,s.id]);return s.id;
  });
  const s=await recover(p,id);if(s.status==='failed')fail(s.error||'Unable to fund this race.');return s;
 }
 async function current(p,b={}){if(b.raceId!==undefined){if(typeof b.raceId!=='string'||!/^[A-F0-9]{12}$/.test(b.raceId))fail('Invalid race reference.',400);return recover(p,b.raceId);}await ready();const s=(await db().query("SELECT id FROM back_alley_derby_rounds WHERE owner=$1 AND state->>'status'<>'failed' ORDER BY created_at DESC LIMIT 1",[p.id])).rows[0];return s?recover(p,s.id):null;}
 return {ready,start,current,recover,publicRound};
}
module.exports={...createStore(),createStore,publicRound};
