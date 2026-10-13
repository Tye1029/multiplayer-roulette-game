'use strict';
const crypto=require('node:crypto'),{getDatabase}=require('@netlify/database'),rules=require('../../../shared/games/minefield');
const fail=(message,status=409)=>{throw Object.assign(Error(message),{status});};
const validRequest=id=>typeof id==='string'&&/^[a-f0-9-]{24,40}$/i.test(id);
function draw(count,random=crypto.randomInt){
 if(!rules.validMines(count))fail('Choose between 1 and 24 mines.',400);
 const tiles=Array.from({length:rules.size},(_,i)=>i);
 for(let i=0;i<count;i++){const j=i+random(tiles.length-i);[tiles[i],tiles[j]]=[tiles[j],tiles[i]];}
 return tiles.slice(0,count).sort((a,b)=>a-b);
}
function publicGame(s){
 if(!s)return null;const playable=s.status==='active',finished=['paying','settled'].includes(s.status),count=s.revealed.filter(i=>!s.mines.includes(i)).length;
 return {id:s.id,stake:s.stake,mineCount:s.mineCount,status:s.status,revision:s.revision,revealed:s.revealed,safeCount:count,
  cashout:playable?rules.payout(s.stake,s.mineCount,count):0,nextPayout:playable&&count<rules.size-s.mineCount?rules.payout(s.stake,s.mineCount,count+1):0,
  multiplier:rules.multiplier(s.mineCount,count),outcome:finished?s.outcome:null,payout:finished?s.payout:null,
  mines:finished?s.mines:undefined,hit:finished?s.hit:null,createdAt:s.createdAt};
}
function createStore(injectedPool,injectedWallet,random=crypto.randomInt){
 let pool=injectedPool,schema;const wallet=injectedWallet||require('../rps/wallet'),db=()=>pool||(pool=getDatabase({connectionString:process.env.NETLIFY_DB_URL}).pool);
 async function ready(){schema||=db().query(`DO $minefield$ BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('minefield-schema-v1'));
  CREATE TABLE IF NOT EXISTS minefield_games(id TEXT PRIMARY KEY,owner TEXT NOT NULL,state JSONB NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
  CREATE INDEX IF NOT EXISTS minefield_owner ON minefield_games(owner,created_at DESC);
  CREATE TABLE IF NOT EXISTS minefield_requests(owner TEXT NOT NULL,request_id TEXT NOT NULL,game_id TEXT NOT NULL,PRIMARY KEY(owner,request_id));
 END $minefield$;`).catch(e=>{schema=null;throw e;});return schema;}
 async function tx(fn){await ready();const c=await db().connect();try{await c.query('BEGIN');const value=await fn(c);await c.query('COMMIT');return value;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
 const save=(c,s)=>c.query('UPDATE minefield_games SET state=$2::jsonb WHERE id=$1',[s.id,JSON.stringify(s)]);
 async function load(c,player,id){const s=(await c.query('SELECT state FROM minefield_games WHERE id=$1 AND owner=$2 FOR UPDATE',[id,player.id])).rows[0]?.state;if(!s)fail('Field not found.',404);return s;}
 async function recover(player,id){return tx(async c=>{
  const s=await load(c,player,id);
  if(s.status==='funding'){
   try{await wallet.apply(s.account,{id:`minefield:${s.id}:stake:${s.owner}`,delta:-s.stake,reason:'Minefield · '+s.mineCount+' mines'});s.status='active';}
   catch(e){if(e.code!=='RPS_FUNDS')throw e;s.status='failed';s.error=e.message;}
  }
  if(s.status==='paying'){
   await wallet.apply(s.account,{id:`minefield:${s.id}:payout:${s.owner}`,delta:s.payout,reason:'Minefield · '+(s.outcome==='mine'?'mine hit':s.outcome==='clear'?'field cleared':'cash out')});
   s.status='settled';s.settledAt=new Date().toISOString();
  }
  await save(c,s);return s;
 });}
 async function start(player,b){
  if(!rules.stakes.includes(b.stake)||!rules.validMines(b.mineCount))fail('Choose an available wager and between 1 and 24 mines.',400);
  if(!validRequest(b.requestId))fail('Missing purchase reference.',400);
  const account=await wallet.account(player);
  // The immutable board and purchase receipt are committed before wallet debit.
  // One active field per verified player, including simultaneous start requests.
  const id=await tx(async c=>{
   await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',['minefield-owner:'+player.id]);
   const prior=(await c.query('SELECT game_id FROM minefield_requests WHERE owner=$1 AND request_id=$2',[player.id,b.requestId])).rows[0];if(prior)return prior.game_id;
   const existing=(await c.query("SELECT id FROM minefield_games WHERE owner=$1 AND state->>'status' IN ('funding','active','paying') ORDER BY created_at DESC LIMIT 1",[player.id])).rows[0];
   let id=existing?.id;
   if(!id){id=crypto.randomBytes(6).toString('hex').toUpperCase();const s={id,owner:player.id,account,stake:b.stake,mineCount:b.mineCount,mines:draw(b.mineCount,random),revealed:[],revision:0,actions:[],status:'funding',createdAt:new Date().toISOString()};await c.query('INSERT INTO minefield_games(id,owner,state) VALUES($1,$2,$3::jsonb)',[id,player.id,JSON.stringify(s)]);}
   await c.query('INSERT INTO minefield_requests(owner,request_id,game_id) VALUES($1,$2,$3)',[player.id,b.requestId,id]);return id;
  });
  const s=await recover(player,id);if(s.status==='failed')fail(s.error||'Unable to fund this field.');return s;
 }
 async function action(player,b){
  if(!/^[A-F0-9]{12}$/.test(b.gameId||'')||!validRequest(b.requestId)||!Number.isInteger(b.revision)||b.revision<0)fail('Invalid field action.',400);
  if(!['reveal','cashout'].includes(b.action))fail('Unknown field action.',400);
  if(b.action==='reveal'&&(!Number.isInteger(b.tile)||b.tile<0||b.tile>=rules.size))fail('Choose a tile on the field.',400);
  await recover(player,b.gameId);
  await tx(async c=>{
   const s=await load(c,player,b.gameId),prior=s.actions.find(a=>a.id===b.requestId);
   if(prior){if(prior.action!==b.action||prior.tile!==(b.action==='reveal'?b.tile:null))fail('This action reference was already used.',400);return;}
   if(s.status!=='active')fail('This field has finished.');
   if(s.revision!==b.revision)fail('Your field changed in another window. Reconnect to see it.');
   if(b.action==='cashout'&&!s.revealed.length)fail('Find at least one safe tile before cashing out.');
   if(b.action==='reveal'){
    if(s.revealed.includes(b.tile))return;
    s.revealed.push(b.tile);
    if(s.mines.includes(b.tile)){s.outcome='mine';s.hit=b.tile;s.payout=0;s.status='paying';}
    else if(s.revealed.length===rules.size-s.mineCount){s.outcome='clear';s.status='paying';s.payout=rules.payout(s.stake,s.mineCount,s.revealed.length);}
   }else{s.outcome='cashout';s.status='paying';s.payout=rules.payout(s.stake,s.mineCount,s.revealed.length);}
   s.revision++;s.actions.push({id:b.requestId,action:b.action,tile:b.action==='reveal'?b.tile:null});
   // Reserve the final result before crediting the independent wallet. A failed
   // payout can only retry this same result; it can never reopen a lost field.
   await save(c,s);
  });
  return recover(player,b.gameId);
 }
 async function current(player){await ready();const row=(await db().query("SELECT id FROM minefield_games WHERE owner=$1 AND state->>'status'<>'failed' ORDER BY created_at DESC LIMIT 1",[player.id])).rows[0];return row?recover(player,row.id):null;}
 return {start,action,current,recover,ready,publicGame};
}
module.exports={...createStore(),createStore,draw,publicGame};
