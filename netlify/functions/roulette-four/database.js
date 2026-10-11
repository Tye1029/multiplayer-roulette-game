'use strict';
const {getDatabase}=require('@netlify/database');
const crypto=require('node:crypto');
const model=require('./model');
const defaultWallet=require('../rps/wallet');
function createStore(injected,injectedWallet){
 let pool=injected,schema;const wallet=injectedWallet||defaultWallet;
 const db=()=>pool||(pool=getDatabase({connectionString:process.env.NETLIFY_DB_URL}).pool);
 async function ready(){schema ||= db().query(`DO $four$ BEGIN PERFORM pg_advisory_xact_lock(hashtext('xan-four-v1'));CREATE TABLE IF NOT EXISTS roulette_four_matches(id TEXT PRIMARY KEY,state JSONB NOT NULL,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());CREATE INDEX IF NOT EXISTS roulette_four_recent ON roulette_four_matches(updated_at DESC); END $four$;`).catch(e=>{schema=null;throw e;});return schema;}
 async function tx(fn){await ready();const c=await db().connect();try{await c.query('BEGIN');const v=await fn(c);await c.query('COMMIT');return v;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
 async function save(c,s){await c.query('UPDATE roulette_four_matches SET state=$2::jsonb,updated_at=NOW() WHERE id=$1',[s.id,JSON.stringify(s)]);}
 function fresh(id,player,wager,account,rate){return {id,phase:'waiting',players:[{id:player.id,name:player.name,avatar:player.avatar||null,account}],wager,rate,createdAt:Date.now(),deadline:Date.now()+900000,revision:1,actionNumber:0,paid:[],pending:player.id,requests:[]};}
 async function recover(id){
  return tx(async c=>{
   let s=(await c.query('SELECT state FROM roulette_four_matches WHERE id=$1 FOR UPDATE',[id])).rows[0]?.state;if(!s)model.fail('Table not found.',404);
   while(s.pending){
    const p=s.players.find(p=>p.id===s.pending);
    try{await wallet.apply(p.account,{id:`four:${s.id}:stake:${p.id}`,delta:-s.wager,reason:'Four-player Roulette stake'});if(!s.paid.includes(p.id))s.paid.push(p.id);s.pending=null;s.revision++;}
    catch(e){if(e.code!=='RPS_FUNDS')throw e;s.pending=null;s.reason=e.message;if(s.rematchFunding)s.phase='cancelled';else{s.players=s.players.filter(x=>x.id!==p.id);if(!s.players.length){s.players=[p];s.phase='cancelled';}}s.revision++;break;}
    if(s.rematchFunding)s.pending=s.players.find(p=>!s.paid.includes(p.id))?.id||null;
    if(s.players.length===4&&s.paid.length===4&&s.phase==='waiting')model.begin(s);
   }
   model.advance(s);
   if(['complete','cancelled'].includes(s.phase)&&!s.settled){
    s.payouts={};
    for(const p of s.players){if(!s.paid.includes(p.id))continue;const refund=s.phase==='cancelled',amount=refund?s.wager:Math.max(0,p.bank-Math.ceil(p.bank*s.rate/100));
     await wallet.apply(p.account,{id:`four:${s.id}:${refund?'refund':'payout'}:${p.id}`,delta:amount,reason:refund?'Unstarted four-player table refund':'Four-player Roulette winnings'});s.payouts[p.id]=amount;
    }
    s.settled=true;s.revision++;
   }
   await save(c,s);return s;
  });
 }
 async function create(player,body){
  const wager=body.wager;if(!Number.isSafeInteger(wager)||wager<1000||wager>50000||wager%1000)model.fail('Choose 1,000–50,000 Chips in 1,000-Chip steps.',400);
  if(!/^[a-f0-9]{24}$/i.test(body.requestId||''))model.fail('Missing create request ID.',400);
  const account=await wallet.account(player),rate=await wallet.rate();
  const id=await tx(async c=>{await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',['four-create:'+player.id]);const rows=(await c.query("SELECT state FROM roulette_four_matches WHERE state->'players'->0->>'id'=$1 AND updated_at>NOW()-INTERVAL '1 day'",[player.id])).rows;
   const duplicate=rows.find(r=>r.state.requestId===body.requestId);if(duplicate)return duplicate.state.id;
   if(rows.filter(r=>r.state.phase==='waiting'&&r.state.deadline>Date.now()).length>=5)model.fail('You already have five open tables.');
   const id=crypto.randomBytes(6).toString('hex').toUpperCase(),s=fresh(id,player,wager,account,rate);s.requestId=body.requestId;s.private=body.private===true;await c.query('INSERT INTO roulette_four_matches(id,state) VALUES($1,$2::jsonb)',[id,JSON.stringify(s)]);return id;
  });return recover(id);
 }
 async function action(id,player,body){
  await recover(id);
  const s=await tx(async c=>{
   const s=(await c.query('SELECT state FROM roulette_four_matches WHERE id=$1 FOR UPDATE',[id])).rows[0]?.state;if(!s)model.fail('Table not found.',404);
   if(body.action==='join'&&!s.players.some(p=>p.id===player.id)){
    if(s.phase!=='waiting'||s.pending||s.players.length>=4||s.deadline<=Date.now())model.fail('This table is no longer joinable.');
    if(body.wager!==s.wager)model.fail('Review and accept the wager before joining.');
    const account=await wallet.account(player);if(s.players.some(p=>p.account===account))model.fail('Each seat requires a different Chip account.');
    s.players.push({id:player.id,name:player.name,avatar:player.avatar||null,account});s.pending=player.id;s.revision++;
   }else if(body.action!=='get'){
    if(!s.players.some(p=>p.id===player.id))model.fail('You are not seated at this table.',403);
    if(body.action==='cancel'){if(s.players[0].id!==player.id||s.players.length!==1||s.phase!=='waiting')model.fail('Only an empty table can be cancelled by its creator.');s.phase='cancelled';s.revision++;}
    else if(body.action==='act'){
     if(!/^[a-zA-Z0-9-]{8,80}$/.test(body.actionId||''))model.fail('Missing action ID.',400);
     if(s.requests.includes(body.actionId))return s;
     if(body.revision!==s.revision)model.fail('The table changed. Please try again.');
     model.act(s,player.id,body.choice);s.requests.push(body.actionId);
    }else if(body.action==='rematch'){
     if(s.phase!=='complete'||!s.settled)model.fail('Wait for settlement before rematching.');if(body.wager!==s.wager)model.fail('Accept the rematch stake.');
     if(!s.rematchUntil||s.rematchUntil<Date.now()){s.rematchVotes=[];s.rematchUntil=Date.now()+15000;}
     s.rematchVotes||=[];if(!s.rematchVotes.includes(player.id))s.rematchVotes.push(player.id);s.revision++;
     if(s.rematchVotes.length===4&&!s.nextMatch){const next=crypto.randomBytes(6).toString('hex').toUpperCase(),n=fresh(next,s.players[0],s.wager,s.players[0].account,await wallet.rate());n.players=s.players.map(p=>({id:p.id,name:p.name,avatar:p.avatar||null,account:p.account}));n.private=s.private;n.rematchFunding=true;n.pending=n.players[0].id;await c.query('INSERT INTO roulette_four_matches(id,state) VALUES($1,$2::jsonb)',[next,JSON.stringify(n)]);s.nextMatch=next;}
    }else if(body.action!=='join')model.fail('Unknown action.',400);
   }else if(!s.players.some(p=>p.id===player.id)&&s.phase!=='waiting')model.fail('This table belongs to its players.',403);
   await save(c,s);return s;
  });
  return recover(s.id);
 }
 async function lobby(player){
  await sweep();await ready();const rows=(await db().query("SELECT state FROM roulette_four_matches WHERE updated_at>NOW()-INTERVAL '1 day' ORDER BY updated_at DESC LIMIT 100")).rows;
  return {games:rows.filter(({state:s})=>s.phase==='waiting'&&!s.private&&!s.pending&&s.players.length<4&&s.deadline>Date.now()).map(({state:s})=>({id:s.id,mode:'roulette-four',name:'Four-player Roulette',creator:s.players[0].name,wager:s.wager,mine:s.players[0].id===player.id,count:s.players.length,capacity:4,expiresAt:s.deadline})),
   joined:rows.filter(({state:s})=>s.players[0].id===player.id&&s.players.length>1).flatMap(({state:s})=>s.players.slice(1).map(p=>({id:s.id,mode:'roulette-four',name:p.name,joiner:p.id,href:'/games/multiplayer/roulette-four/?room='+s.id})))};
 }
 async function sweep(){await ready();const rows=(await db().query("SELECT id FROM roulette_four_matches WHERE COALESCE(state->>'settled','false')<>'true' ORDER BY updated_at LIMIT 30")).rows;for(const {id} of rows)try{await recover(id);}catch{}return {checked:rows.length};}
 return {ready,create,action,recover,lobby,sweep};
}
module.exports={...createStore(),createStore};
