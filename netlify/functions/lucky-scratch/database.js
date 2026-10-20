'use strict';
const crypto=require('node:crypto'),{getDatabase}=require('@netlify/database'),rules=require('../../../shared/games/lucky-scratch');
const fail=(message,status=409)=>{throw Object.assign(Error(message),{status});};
function draw(tier,random=crypto.randomInt){
  let roll=random(10000),multiplier=0;
  for(const prize of rules.prizes){if(roll<prize.weight){multiplier=prize.multiplier;break;}roll-=prize.weight;}
  const choices=rules.prizes.filter(p=>p.multiplier&&p.multiplier!==multiplier).map(p=>p.multiplier),spots=multiplier?[multiplier,multiplier,multiplier]:[],counts={};
  while(spots.length<9){const available=choices.filter(n=>(counts[n]||0)<2),n=available[random(available.length)];spots.push(n);counts[n]=(counts[n]||0)+1;}
  for(let i=spots.length-1;i>0;i--){const j=random(i+1);[spots[i],spots[j]]=[spots[j],spots[i]];}
  return {spots:spots.map(n=>n*tier.price),payout:multiplier*tier.price};
}
function publicTicket(s){if(!s)return null;return {id:s.id,tier:s.tier,price:s.price,status:s.status,revealed:s.revealed,spots:['playing','settled'].includes(s.status)?s.spots.map((amount,i)=>s.status==='settled'||s.revealed.includes(i)?amount:null):[],payout:s.status==='settled'?s.payout:null,createdAt:s.createdAt};}
function createStore(injectedPool,injectedWallet,random=crypto.randomInt){
  let pool=injectedPool,schema;const wallet=injectedWallet||require('../rps/wallet'),db=()=>pool||(pool=getDatabase({connectionString:process.env.NETLIFY_DB_URL}).pool);
  async function ready(){schema||=db().query(`DO $scratch$ BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('lucky-scratch-schema-v1'));
    CREATE TABLE IF NOT EXISTS lucky_scratch_tickets(id TEXT PRIMARY KEY,owner TEXT NOT NULL,request_id TEXT NOT NULL,state JSONB NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(owner,request_id));
    CREATE INDEX IF NOT EXISTS lucky_scratch_owner ON lucky_scratch_tickets(owner,created_at DESC);
    CREATE TABLE IF NOT EXISTS lucky_scratch_requests(owner TEXT NOT NULL,request_id TEXT NOT NULL,ticket_id TEXT NOT NULL,PRIMARY KEY(owner,request_id));
    END $scratch$;`).catch(e=>{schema=null;throw e;});return schema;}
  async function tx(fn){await ready();const c=await db().connect();try{await c.query('BEGIN');const value=await fn(c);await c.query('COMMIT');return value;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
  const save=(c,s)=>c.query('UPDATE lucky_scratch_tickets SET state=$2::jsonb WHERE id=$1',[s.id,JSON.stringify(s)]);
  async function recover(player,id,spots=[]){return tx(async c=>{
    const s=(await c.query('SELECT state FROM lucky_scratch_tickets WHERE id=$1 AND owner=$2 FOR UPDATE',[id,player.id])).rows[0]?.state;if(!s)fail('Ticket not found.',404);
    if(s.status==='funding'){
      try{await wallet.apply(s.account,{id:`scratch:${s.id}:stake:${s.owner}`,delta:-s.price,reason:'Lucky Scratch · '+s.name+' ticket'});s.status='playing';}
      catch(e){if(e.code!=='RPS_FUNDS')throw e;s.status='failed';s.error=e.message;}
    }
    if(s.status==='playing'){
      s.revealed=[...new Set([...s.revealed,...spots])].sort((a,b)=>a-b);
      if(s.revealed.length===9){await wallet.apply(s.account,{id:`scratch:${s.id}:payout:${s.owner}`,delta:s.payout,reason:'Lucky Scratch · '+s.name+' prize'});s.status='settled';s.settledAt=new Date().toISOString();}
    }
    await save(c,s);return s;
  });}
  async function buy(player,b){
    const tier=rules.get(b.tier);if(!tier)fail('Choose an available ticket.',400);
    if(!/^[a-f0-9-]{24,40}$/i.test(b.requestId||''))fail('Missing purchase reference.',400);
    const account=await wallet.account(player);
    // Commit the purchase intent BEFORE touching the separate shared wallet.
    // A lost response can always replay the same immutable ledger entry.
    const id=await tx(async c=>{
      await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',['scratch-owner:'+player.id]);
      const prior=(await c.query('SELECT ticket_id FROM lucky_scratch_requests WHERE owner=$1 AND request_id=$2',[player.id,b.requestId])).rows[0];if(prior)return prior.ticket_id;
      const active=(await c.query("SELECT id FROM lucky_scratch_tickets WHERE owner=$1 AND state->>'status' IN ('funding','playing') ORDER BY created_at DESC LIMIT 1",[player.id])).rows[0];if(active){await c.query('INSERT INTO lucky_scratch_requests(owner,request_id,ticket_id) VALUES($1,$2,$3)',[player.id,b.requestId,active.id]);return active.id;}
      const s={id:crypto.randomBytes(6).toString('hex').toUpperCase(),owner:player.id,account,name:tier.name,tier:tier.id,price:tier.price,...draw(tier,random),status:'funding',revealed:[],createdAt:new Date().toISOString()};
      await c.query('INSERT INTO lucky_scratch_tickets(id,owner,request_id,state) VALUES($1,$2,$3,$4::jsonb)',[s.id,player.id,b.requestId,JSON.stringify(s)]);await c.query('INSERT INTO lucky_scratch_requests(owner,request_id,ticket_id) VALUES($1,$2,$3)',[player.id,b.requestId,s.id]);return s.id;
    });
    const s=await recover(player,id);if(s.status==='failed')fail(s.error||'Unable to buy this ticket.');return s;
  }
  async function current(player){await ready();const row=(await db().query("SELECT id FROM lucky_scratch_tickets WHERE owner=$1 AND state->>'status'<>'failed' ORDER BY created_at DESC LIMIT 1",[player.id])).rows[0];return row?recover(player,row.id):null;}
  async function reveal(player,b){if(!/^[A-F0-9]{12}$/.test(b.ticketId||''))fail('Invalid ticket.',400);if(!Array.isArray(b.spots)||!b.spots.length||b.spots.length>9||b.spots.some(n=>!Number.isInteger(n)||n<0||n>8))fail('Choose valid scratch spots.',400);return recover(player,b.ticketId,b.spots);}
  return {buy,current,reveal,publicTicket,ready};
}
module.exports={...createStore(),createStore,draw,publicTicket};
