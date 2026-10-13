'use strict';
const database=require('./midnight-run/database'),identity=require('./rps/database'),wallet=require('./rps/wallet'),rules=require('../../shared/games/midnight-run');
function createHandler(store=database,auth=identity,funds=wallet){return async request=>{
 const reply=(status,value)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Midnight-Run-Build':rules.build}});
 if(request.method!=='POST')return reply(405,{ok:false,error:'Use POST.'});
 const raw=await request.text();if(raw.length>4096)return reply(413,{ok:false,error:'Request too large.'});let b;
 try{b=JSON.parse(raw);if(!b||typeof b!=='object'||Array.isArray(b))throw 0;}catch{return reply(400,{ok:false,error:'Invalid request.'});}
 try{
  if(!['start','current','cashout'].includes(b.action))return reply(400,{ok:false,error:'Unknown action.'});
  const requestAt=store.time(),player=await auth.authenticate(b.token);
  if(!player)return reply(401,{ok:false,error:'Connect your public Torn API key on the main page to play.'});
  // Verified receipt time, before waiting on the game lock. Client clocks and prizes are never trusted.
  const receivedAt=store.time(),state=await store[b.action](player,b,receivedAt),stateAt=store.time();
  const game=store.publicGame(state),balance=b.action==='current'&&state?.status==='active'?undefined:await funds.balance(player);
  return reply(200,{ok:true,game,balance,requestAt,receivedAt,stateAt,serverNow:store.time()});
 }catch(e){return reply(e.status||503,{ok:false,error:e.status?e.message:'Connection interrupted. Reconnect to recover your run.'});}
};}
exports.default=createHandler();exports.createHandler=createHandler;
