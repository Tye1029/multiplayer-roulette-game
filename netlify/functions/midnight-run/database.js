'use strict';
const crypto=require('node:crypto'),{getDatabase}=require('@netlify/database'),rules=require('../../../shared/games/midnight-run');
const fail=(message,status=409)=>{throw Object.assign(Error(message),{status});};
const validRequest=id=>typeof id==='string'&&/^[a-f0-9-]{24,40}$/i.test(id);
function draw(stake,random=crypto.randomInt,difficulty='normal'){
 const last=rules.lastBlock(stake,difficulty);
 for(let block=1;block<=last;block++)if(random(100)>=rules.odds(difficulty)[block-1])return block;
 return last+1;
}
function publicGame(s){
 if(!s)return null;
 const corners=s.mode==='corners';
 const cleared=corners?s.cleared||0:s.status==='active'?Math.min(s.caughtBlock-1,rules.clearedAt((s.evaluatedAt??s.startedAt)-s.startedAt)):s.cleared||0;
 const phase=corners?s.phase:'running';
 const travelMs=corners?(s.status==='settled'?s.travelMs:cleared*rules.blockMs+(phase==='running'?Math.max(0,Math.min(rules.blockMs,(s.evaluatedAt??s.legStartedAt)-s.legStartedAt)):0)):Math.max(0,(s.endedAt??s.evaluatedAt??s.startedAt)-s.startedAt);
 return {id:s.id,stake:s.stake,difficulty:s.difficulty||'normal',status:s.status,mode:corners?'corners':'legacy',phase,startedAt:s.startedAt,legStartedAt:s.legStartedAt??s.startedAt,createdAt:s.createdAt,
  cleared,travelMs,bank:rules.payout(s.stake,cleared,s.difficulty),lastBlock:rules.lastBlock(s.stake,s.difficulty),
  ...(s.status==='settled'?{outcome:s.outcome,payout:s.payout,endedAt:s.endedAt}: {})};
}
function createStore(injectedPool,injectedWallet,random=crypto.randomInt,now=Date.now){
 let pool=injectedPool,schema;
 const wallet=injectedWallet||require('../rps/wallet'),db=()=>pool||(pool=getDatabase({connectionString:process.env.NETLIFY_DB_URL}).pool);
 async function ready(){schema||=db().query(`DO $midnight$ BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('midnight-run-schema-v1'));
  CREATE TABLE IF NOT EXISTS midnight_run_games(id TEXT PRIMARY KEY,owner TEXT NOT NULL,state JSONB NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
  CREATE INDEX IF NOT EXISTS midnight_run_owner ON midnight_run_games(owner,created_at DESC);
  CREATE TABLE IF NOT EXISTS midnight_run_requests(owner TEXT NOT NULL,request_id TEXT NOT NULL,game_id TEXT NOT NULL,PRIMARY KEY(owner,request_id));
 END $midnight$;`).catch(e=>{schema=null;throw e;});return schema;}
 async function tx(fn){await ready();const c=await db().connect();try{await c.query('BEGIN');const result=await fn(c);await c.query('COMMIT');return result;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
 const save=(c,s)=>c.query('UPDATE midnight_run_games SET state=$2::jsonb WHERE id=$1',[s.id,JSON.stringify(s)]);
 async function load(c,player,id){const s=(await c.query('SELECT state FROM midnight_run_games WHERE id=$1 AND owner=$2 FOR UPDATE',[id,player.id])).rows[0]?.state;if(!s)fail('Run not found.',404);return s;}
 async function recover(player,id,manualAt=null,command=null){
  const prepared=await tx(async c=>{
   const s=await load(c,player,id),before=JSON.stringify(s);
   if(s.status==='funding'){
    try{await wallet.apply(s.account,{id:`midnight:${s.id}:stake:${s.owner}`,delta:-s.stake,reason:'Midnight Run · entry'});s.status='active';s.startedAt=now()+rules.countdownMs;if(s.mode==='corners'){s.legStartedAt=s.startedAt;s.phase='running';s.cleared=0;}}
    catch(e){if(e.code!=='RPS_FUNDS')throw e;s.status='failed';s.error=e.message;}
   }
   const at=manualAt??now();
   if(command?.action==='continue'&&s.mode!=='corners')fail('Resume and cash out your previous run before starting a new one.');
   if(s.status==='active'&&s.mode==='corners'){
    const arrival=s.legStartedAt+rules.blockMs;
    if(s.phase==='running'&&at>=arrival){
     const block=s.cleared+1;s.travelMs=block*rules.blockMs;
     if(block>=s.caughtBlock){s.outcome='caught';s.payout=0;s.endedAt=arrival;s.status='paying';}
     else{s.cleared=block;s.phase='corner';if(block===rules.lastBlock(s.stake,s.difficulty)){s.outcome='limit';s.payout=rules.payout(s.stake,block,s.difficulty);s.endedAt=arrival;s.status='paying';}}
    }
    if(s.status==='active'&&command){
     const duplicate=command.action==='continue'&&s.lastContinue===command.requestId;
     if(!duplicate){
      if(s.phase!=='corner')fail('Reach the next corner before choosing.');
      if(command.cleared!==s.cleared)fail('This corner has changed. Reconnect to your run.');
      if(command.action==='continue'){s.phase='running';s.legStartedAt=now();s.lastContinue=command.requestId;}
      else{s.outcome='escape';s.payout=rules.payout(s.stake,s.cleared,s.difficulty);s.endedAt=at;s.travelMs=s.cleared*rules.blockMs;s.status='paying';}
     }
    }
   }else if(s.status==='active'){
    // Honor already-funded V1 contracts; new runs never accept an auto target.
    const target=s.autoBlock??rules.lastBlock(s.stake,s.difficulty),caughtAt=s.startedAt+s.caughtBlock*rules.blockMs,targetAt=s.startedAt+target*rules.blockMs;
    if(s.caughtBlock<=target&&at>=caughtAt){s.outcome='caught';s.cleared=s.caughtBlock-1;s.payout=0;s.endedAt=caughtAt;s.status='paying';}
    else if(target<s.caughtBlock&&at>=targetAt){s.outcome=target===rules.lastBlock(s.stake,s.difficulty)?'limit':'auto';s.cleared=target;s.payout=rules.payout(s.stake,target,s.difficulty);s.endedAt=targetAt;s.status='paying';}
    else if(manualAt!==null){
     const cleared=rules.clearedAt(at-s.startedAt);
     if(!cleared)fail('Clear the first block before escaping.');
     s.outcome='escape';s.cleared=cleared;s.payout=rules.payout(s.stake,cleared,s.difficulty);s.endedAt=at;s.status='paying';
    }
   }
   // Commit the immutable result before touching the independently stored wallet.
   if(JSON.stringify(s)!==before)await save(c,s);
   return {...s,evaluatedAt:at};
  });
  if(prepared.status!=='paying')return prepared;
  return tx(async c=>{const s=await load(c,player,id);if(s.status==='paying'){
   await wallet.apply(s.account,{id:`midnight:${s.id}:payout:${s.owner}`,delta:s.payout,reason:'Midnight Run · '+(s.outcome==='caught'?'caught':'escaped after '+s.cleared+' blocks')});
   s.status='settled';s.settledAt=now();await save(c,s);
  }return s;});
 }
 async function start(player,b){
  const difficulty=b.difficulty===undefined?'normal':b.difficulty;
  if(!rules.validDifficulty(difficulty))fail('Choose Normal, Medium or High Risk.',400);
  if(!rules.stakes.includes(b.stake)||b.autoBlock!=null)fail('Choose an available wager. Auto escape is no longer supported.',400);
  if(!validRequest(b.requestId))fail('Missing run reference.',400);
  const account=await wallet.account(player);
  const id=await tx(async c=>{
   await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',['midnight-owner:'+player.id]);
   const prior=(await c.query('SELECT game_id FROM midnight_run_requests WHERE owner=$1 AND request_id=$2',[player.id,b.requestId])).rows[0];if(prior)return prior.game_id;
   let s=(await c.query("SELECT state FROM midnight_run_games WHERE owner=$1 AND state->>'status' IN ('funding','active','paying') ORDER BY created_at DESC LIMIT 1",[player.id])).rows[0]?.state;
   if(!s){
    if(b.quote!==rules.build)fail('Midnight Run has changed. Refresh before starting.',400);
    s={id:crypto.randomBytes(6).toString('hex').toUpperCase(),owner:player.id,account,stake:b.stake,difficulty,mode:'corners',cleared:0,quote:rules.build,
     caughtBlock:draw(b.stake,random,difficulty),status:'funding',createdAt:now(),startedAt:null};
    await c.query('INSERT INTO midnight_run_games(id,owner,state) VALUES($1,$2,$3::jsonb)',[s.id,player.id,JSON.stringify(s)]);
   }
   await c.query('INSERT INTO midnight_run_requests(owner,request_id,game_id) VALUES($1,$2,$3)',[player.id,b.requestId,s.id]);return s.id;
  });
  const s=await recover(player,id);if(s.status==='failed')fail(s.error||'Unable to fund this run.');return s;
 }
 async function cashout(player,b,receivedAt=now()){
  if(!/^[A-F0-9]{12}$/.test(b.gameId||'')||!validRequest(b.requestId))fail('Invalid run reference.',400);
  return recover(player,b.gameId,Math.min(receivedAt,now()),{...b,action:'cashout'});
 }
 async function continueRun(player,b,receivedAt=now()){
  if(!/^[A-F0-9]{12}$/.test(b.gameId||'')||!validRequest(b.requestId)||!Number.isInteger(b.cleared))fail('Invalid corner reference.',400);
  return recover(player,b.gameId,Math.min(receivedAt,now()),{...b,action:'continue'});
 }
 async function current(player){await ready();const row=(await db().query("SELECT id FROM midnight_run_games WHERE owner=$1 AND state->>'status'<>'failed' ORDER BY created_at DESC LIMIT 1",[player.id])).rows[0];return row?recover(player,row.id):null;}
 return {ready,start,cashout,continue:continueRun,current,recover,publicGame,time:now};
}
module.exports={...createStore(),createStore,publicGame,draw};
