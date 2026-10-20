'use strict';
const database=require('./rocket-run/database'),identity=require('./rps/database'),wallet=require('./rps/wallet');
const rules=require('../../shared/games/rocket-run');
function createHandler(store=database,auth=identity,funds=wallet){return async request=>{
 const reply=(status,value)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Rocket-Run-Build':rules.build}});
 if(request.method!=='POST')return reply(405,{ok:false,error:'Use POST.'});
 const raw=await request.text();if(raw.length>4096)return reply(413,{ok:false,error:'Request too large.'});let b;
 try{b=JSON.parse(raw);if(!b||typeof b!=='object'||Array.isArray(b))throw 0;}catch{return reply(400,{ok:false,error:'Invalid request.'});}
 try{
  if(!['start','current','cashout'].includes(b.action))return reply(400,{ok:false,error:'Unknown action.'});
  const requestAt=store.time();
  const player=await auth.authenticate(b.token);if(!player)return reply(401,{ok:false,error:'Connect your public Torn API key on the main page to play.'});
  // Capture verified receipt time before queueing for the flight lock. Never use
  // a timestamp or multiplier supplied by the browser.
  const receivedAt=store.time(),s=await store[b.action](player,b,receivedAt),stateAt=store.time();
  // Active polls must not wait on a second wallet/blob read. In particular,
  // never anchor the browser clock to a timestamp captured BEFORE that read.
  const balance=b.action==='current'&&s?.status==='active'?undefined:await funds.balance(player);
  return reply(200,{ok:true,game:store.publicGame(s),requestAt,receivedAt,stateAt,serverNow:store.time(),balance});
 }catch(e){return reply(e.status||503,{ok:false,error:e.status?e.message:'Connection interrupted. Reconnect to recover your flight.'});}
};}
exports.default=createHandler();exports.createHandler=createHandler;
