'use strict';
const crypto=require('node:crypto'),{getDatabase}=require('@netlify/database'),rules=require('../../../shared/games/jackpot-junction');
const fail=(message,status=409)=>{throw Object.assign(Error(message),{status});};
function draw(stake,random=crypto.randomInt){
 let roll=random(rules.rollSize);for(const prize of rules.prizes){if(roll<prize.weight)return {kind:'small',symbol:prize.symbol,reels:Array(3).fill(prize.symbol),smallPrize:stake*prize.multiplier};roll-=prize.weight;}
 if(roll<rules.jackpotWeight(stake))return {kind:'jackpot',symbol:'jackpot',reels:Array(3).fill('jackpot'),smallPrize:0};
 const symbols=rules.prizes.map(p=>p.symbol),reels=Array.from({length:3},()=>symbols[random(symbols.length)]);
 // A losing result cannot display a paying trio. No forced near-miss sequence.
 if(reels.every(v=>v===reels[0])){const others=symbols.filter(v=>v!==reels[0]);reels[2]=others[random(others.length)];}
 return {kind:'miss',reels,smallPrize:0};
}
function publicSpin(s){if(!s)return null;return {id:s.id,stake:s.stake,status:s.status,createdAt:s.createdAt,...(s.status==='settled'?{kind:s.kind,reels:s.reels,payout:s.payout,jackpotWon:s.jackpotWon||0}:{} )};}
function createStore(injectedPool,injectedWallet,random=crypto.randomInt,now=Date.now){
 let pool=injectedPool,schema;const wallet=injectedWallet||require('../rps/wallet'),db=()=>pool||(pool=getDatabase({connectionString:process.env.NETLIFY_DB_URL}).pool);
 async function ready(){schema||=db().query(`DO $junction$ BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('jackpot-junction-schema-v1'));
 CREATE TABLE IF NOT EXISTS jackpot_junction_pool(id INTEGER PRIMARY KEY CHECK(id=1),state JSONB NOT NULL);
 CREATE TABLE IF NOT EXISTS jackpot_junction_spins(id TEXT PRIMARY KEY,owner TEXT NOT NULL,state JSONB NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
 CREATE INDEX IF NOT EXISTS jackpot_junction_owner ON jackpot_junction_spins(owner,created_at DESC);
 CREATE TABLE IF NOT EXISTS jackpot_junction_requests(owner TEXT NOT NULL,request_id TEXT NOT NULL,spin_id TEXT NOT NULL,PRIMARY KEY(owner,request_id));
 INSERT INTO jackpot_junction_pool(id,state) VALUES(1,'{"amount":128338393,"seed":128338393,"contributed":0,"paid":0,"house":0,"smallPrizes":0,"smallReserve":0,"wagered":0,"spins":0,"version":0,"cycle":1}'::jsonb) ON CONFLICT(id) DO NOTHING;
 END $junction$;`).catch(e=>{schema=null;throw e;});return schema;}
 async function tx(fn){await ready();const c=await db().connect();try{await c.query('BEGIN');const value=await fn(c);await c.query('COMMIT');return value;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
 const save=(c,s)=>c.query('UPDATE jackpot_junction_spins SET state=$2::jsonb WHERE id=$1',[s.id,JSON.stringify(s)]);
 async function meter(){await ready();const s=(await db().query('SELECT state FROM jackpot_junction_pool WHERE id=1')).rows[0].state;return {amount:s.amount,version:s.version,cycle:s.cycle};}
 async function recover(player,id){
  // Reserve the pool result durably BEFORE crediting the separate blob wallet.
  // A later spin may change the pool, but can never change an already owed prize.
  await tx(async c=>{const s=(await c.query('SELECT state FROM jackpot_junction_spins WHERE id=$1 AND owner=$2 FOR UPDATE',[id,player.id])).rows[0]?.state;if(!s)fail('Spin not found.',404);if(s.status!=='funding')return;
   try{await wallet.apply(s.account,{id:`junction:${s.id}:stake:${s.owner}`,delta:-s.stake,reason:'Jackpot Junction · spin'});}catch(e){if(e.code!=='RPS_FUNDS')throw e;s.status='failed';s.error=e.message;await save(c,s);return;}
   const p=(await c.query('SELECT state FROM jackpot_junction_pool WHERE id=1 FOR UPDATE')).rows[0].state;
   const contribution=s.stake*rules.jackpotPercent/100;p.amount+=contribution;p.contributed+=contribution;p.house+=s.stake*rules.housePercent/100;p.wagered+=s.stake;p.spins++;p.version++;
   p.smallPrizes+=s.smallPrize;p.smallReserve+=s.stake*rules.smallPrizePercent/100-s.smallPrize;
   s.jackpotWon=s.kind==='jackpot'?p.amount:0;s.payout=s.smallPrize+s.jackpotWon;if(s.jackpotWon){p.paid+=s.jackpotWon;p.amount=0;p.cycle++;}
   if(Object.values(p).some(n=>!Number.isSafeInteger(n)))throw Error('Jackpot accounting limit reached.');
   s.status='awarded';s.awardedAt=now();s.poolVersion=p.version;await c.query('UPDATE jackpot_junction_pool SET state=$1::jsonb WHERE id=1',[JSON.stringify(p)]);await save(c,s);
  });
  return tx(async c=>{const s=(await c.query('SELECT state FROM jackpot_junction_spins WHERE id=$1 AND owner=$2 FOR UPDATE',[id,player.id])).rows[0]?.state;if(!s)fail('Spin not found.',404);if(s.status==='awarded'){await wallet.apply(s.account,{id:`junction:${s.id}:payout:${s.owner}`,delta:s.payout,reason:s.jackpotWon?'Jackpot Junction · jackpot':'Jackpot Junction · prize'});s.status='settled';s.settledAt=now();await save(c,s);}return s;});
 }
 async function spin(player,b){
  if(!rules.stakes.includes(b.stake))fail('Choose an available spin price.',400);if(!/^[a-f0-9-]{24,40}$/i.test(b.requestId||''))fail('Missing spin reference.',400);
  const account=await wallet.account(player),id=await tx(async c=>{
   await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',['junction-owner:'+player.id]);
   const prior=(await c.query('SELECT spin_id FROM jackpot_junction_requests WHERE owner=$1 AND request_id=$2',[player.id,b.requestId])).rows[0];if(prior)return prior.spin_id;
   const recent=(await c.query("SELECT state FROM jackpot_junction_spins WHERE owner=$1 AND state->>'status'<>'failed' ORDER BY created_at DESC LIMIT 1",[player.id])).rows[0]?.state;
   let s;if(recent&&['funding','awarded'].includes(recent.status))s=recent;else{if(recent&&now()-recent.createdAt<rules.spinMs)fail('Let the reels finish before spinning again.',429);s={id:crypto.randomBytes(6).toString('hex').toUpperCase(),owner:player.id,account,stake:b.stake,...draw(b.stake,random),status:'funding',createdAt:now()};await c.query('INSERT INTO jackpot_junction_spins(id,owner,state) VALUES($1,$2,$3::jsonb)',[s.id,player.id,JSON.stringify(s)]);}
   await c.query('INSERT INTO jackpot_junction_requests(owner,request_id,spin_id) VALUES($1,$2,$3)',[player.id,b.requestId,s.id]);return s.id;
  });
  const s=await recover(player,id);if(s.status==='failed')fail(s.error||'Unable to fund this spin.');return s;
 }
 async function current(player){await ready();const row=(await db().query("SELECT id FROM jackpot_junction_spins WHERE owner=$1 AND state->>'status'<>'failed' ORDER BY created_at DESC LIMIT 1",[player.id])).rows[0];return row?recover(player,row.id):null;}
 return {ready,meter,spin,current,recover,publicSpin};
}
module.exports={...createStore(),createStore,draw,publicSpin};
