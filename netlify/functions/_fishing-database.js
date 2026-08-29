"use strict";

const { getDatabase } = require("@netlify/database");

const LEDGER_LIMIT = 120;
function cleanId(value,max=120){return String(value||"").replace(/[^a-zA-Z0-9._:-]/g,"").slice(0,max)}
function clone(value){return JSON.parse(JSON.stringify(value||{}))}
function database(){
  const connectionString=String(process.env.NETLIFY_DB_URL||"").trim();
  if(!connectionString) throw new Error("NETLIFY_DB_URL is missing. Add the production read-and-write Netlify Database connection string, then redeploy.");
  return getDatabase({connectionString});
}
async function transaction(work){
  const client=await database().pool.connect();
  try{await client.query("BEGIN");const result=await work(client);await client.query("COMMIT");return result}
  catch(error){try{await client.query("ROLLBACK")}catch{}throw error}
  finally{client.release()}
}
async function ensureLocked(client,gameId,initialState){
  const safeGameId=cleanId(gameId),state=clone(initialState),roundId=cleanId(state.roundId||`fish-${Date.now()}`);
  await client.query(`INSERT INTO fishing_matches (game_id,round_id,state,revision) VALUES ($1,$2,$3::jsonb,$4) ON CONFLICT (game_id) DO NOTHING`,[safeGameId,roundId,JSON.stringify(state),Number(state.revision||0)]);
  const {rows}=await client.query(`SELECT game_id,round_id,state,revision FROM fishing_matches WHERE game_id=$1 FOR UPDATE`,[safeGameId]);
  if(!rows[0]) throw new Error("Unable to initialize the fishing database match.");
  if(String(rows[0].round_id)!==String(roundId)){
    await client.query(`DELETE FROM fishing_actions WHERE game_id=$1`,[safeGameId]);
    await client.query(`UPDATE fishing_matches SET round_id=$2,state=$3::jsonb,revision=$4,updated_at=NOW() WHERE game_id=$1`,[safeGameId,roundId,JSON.stringify(state),Number(state.revision||0)]);
    return {game_id:safeGameId,round_id:roundId,state,revision:Number(state.revision||0)};
  }
  return rows[0];
}
async function ledger(client,gameId){
  const {rows}=await client.query(`SELECT sequence,action_id AS "actionId",user_id AS "userId",event_id AS "eventId",accepted,reason,created_at AS at FROM fishing_actions WHERE game_id=$1 ORDER BY sequence DESC LIMIT $2`,[cleanId(gameId),LEDGER_LIMIT]);
  return rows.reverse().map(r=>({...r,sequence:Number(r.sequence),at:new Date(r.at).toISOString()}));
}
function hydrate(state,revision,actions){const next=clone(state);next.revision=Number(revision||0);next.actionLedger=actions;return next}
async function getMatch({gameId,initialState}){return transaction(async client=>{const row=await ensureLocked(client,gameId,initialState);return hydrate(row.state,row.revision,await ledger(client,gameId))})}
async function claimRipple({gameId,initialState,userId,eventId,actionId,clickedAt}){
  return transaction(async client=>{
    const row=await ensureLocked(client,gameId,initialState),safeGameId=cleanId(gameId),safeUserId=cleanId(userId,80),safeEventId=cleanId(eventId,90),safeActionId=cleanId(actionId,90);
    const duplicate=await client.query(`SELECT accepted,reason FROM fishing_actions WHERE game_id=$1 AND action_id=$2`,[safeGameId,safeActionId]);
    if(duplicate.rows[0]) return {state:hydrate(row.state,row.revision,await ledger(client,safeGameId)),duplicate:true,accepted:Boolean(duplicate.rows[0].accepted),reason:duplicate.rows[0].reason||""};
    const state=clone(row.state),events=Array.isArray(state.events)?state.events:[],catches={...(state.catches||{})};
    if(catches[safeUserId]) throw new Error("You already pulled your one fish.");
    const target=events.find(e=>String(e.id)===safeEventId);if(!target) throw new Error("That fish is gone.");
    if(target.claimedBy) throw new Error("Your opponent hooked that fish first.");
    const now=Date.now(),reported=Date.parse(String(clickedAt||""));
    const trusted=Number.isFinite(reported)&&reported<=now+500&&reported>=now-2500;
    const at=trusted?reported:now,begin=Date.parse(target.at||""),finish=Date.parse(target.endAt||""),roundEnd=Date.parse(state.endAt||"");
    if(!Number.isFinite(begin)||!Number.isFinite(finish)||at<begin-180||at>finish+180||(Number.isFinite(roundEnd)&&at>roundEnd+180)) throw new Error("That fish is no longer biting.");
    target.claimedBy=safeUserId;target.claimedAt=new Date(at).toISOString();
    const catchData={eventId:target.id,size:Number(target.size),measuredSize:Number(target.size),name:target.name,baseName:target.baseName||target.name,variant:target.variant||"standard",rarity:target.rarity||"regular",special:Boolean(target.special||target.rarity&&target.rarity!=="regular"),at:target.claimedAt,ripple:target.ripple,rippleSpeed:target.rippleSpeed,rippleThickness:target.rippleThickness,rippleWobble:target.rippleWobble,rumble:target.rumble};
    catches[safeUserId]=catchData;state.catches=catches;
    const sequence=Number(row.revision||0)+1;
    await client.query(`INSERT INTO fishing_actions (game_id,action_id,sequence,user_id,event_id,accepted,reason,action_payload) VALUES ($1,$2,$3,$4,$5,TRUE,'',$6::jsonb)`,[safeGameId,safeActionId,sequence,safeUserId,safeEventId,JSON.stringify({clickedAt:new Date(at).toISOString(),catch:catchData})]);
    await client.query(`UPDATE fishing_matches SET state=$2::jsonb,revision=$3,updated_at=NOW() WHERE game_id=$1`,[safeGameId,JSON.stringify(state),sequence]);
    return {state:hydrate(state,sequence,await ledger(client,safeGameId)),catch:catchData,accepted:true,duplicate:false};
  });
}
async function npcAttempt({gameId,initialState,npcId}){
  if(!npcId)return getMatch({gameId,initialState});
  return transaction(async client=>{
    const row=await ensureLocked(client,gameId,initialState),state=clone(row.state),catches={...(state.catches||{})};
    if(catches[npcId]) return hydrate(state,row.revision,await ledger(client,gameId));
    const now=Date.now();
    if(!state.npcCatchEventId||!state.npcCatchAt){
      const candidates=(state.events||[]).filter(e=>!e.claimedBy);
      if(candidates.length){const target=candidates[Math.floor(Math.random()*candidates.length)],begin=Date.parse(target.at),finish=Date.parse(target.endAt);state.npcCatchEventId=target.id;state.npcCatchAt=new Date(begin+Math.floor((finish-begin)*(.32+Math.random()*.35))).toISOString();}
      const revision=Number(row.revision||0)+1;await client.query(`UPDATE fishing_matches SET state=$2::jsonb,revision=$3,updated_at=NOW() WHERE game_id=$1`,[cleanId(gameId),JSON.stringify(state),revision]);return hydrate(state,revision,await ledger(client,gameId));
    }
    const target=(state.events||[]).find(e=>String(e.id)===String(state.npcCatchEventId)),catchAt=Date.parse(state.npcCatchAt||"");
    if(target&&!target.claimedBy&&Number.isFinite(catchAt)&&now>=catchAt&&now<=Date.parse(target.endAt||"")){
      target.claimedBy=npcId;target.claimedAt=new Date(now).toISOString();catches[npcId]={eventId:target.id,size:Number(target.size),measuredSize:Number(target.size),name:target.name,baseName:target.baseName||target.name,variant:target.variant||"standard",rarity:target.rarity||"regular",special:Boolean(target.special||target.rarity&&target.rarity!=="regular"),at:target.claimedAt,ripple:target.ripple,rippleSpeed:target.rippleSpeed,rippleThickness:target.rippleThickness,rippleWobble:target.rippleWobble,rumble:target.rumble};state.catches=catches;
      const revision=Number(row.revision||0)+1;await client.query(`UPDATE fishing_matches SET state=$2::jsonb,revision=$3,updated_at=NOW() WHERE game_id=$1`,[cleanId(gameId),JSON.stringify(state),revision]);return hydrate(state,revision,await ledger(client,gameId));
    }
    return hydrate(state,row.revision,await ledger(client,gameId));
  });
}
module.exports={getMatch,claimRipple,npcAttempt};
