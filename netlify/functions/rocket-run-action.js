'use strict';
const database=require('./rocket-run/database'),identity=require('./rps/database'),wallet=require('./rps/wallet');
function createHandler(store=database,auth=identity,funds=wallet){return async request=>{
 const reply=(status,value)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Rocket-Run-Build':'ROCKET_RUN_V1'}});
 if(request.method!=='POST')return reply(405,{ok:false,error:'Use POST.'});
 const raw=await request.text();if(raw.length>4096)return reply(413,{ok:false,error:'Request too large.'});let b;
 try{b=JSON.parse(raw);if(!b||typeof b!=='object'||Array.isArray(b))throw 0;}catch{return reply(400,{ok:false,error:'Invalid request.'});}
 try{
  if(!['start','current','cashout'].includes(b.action))return reply(400,{ok:false,error:'Unknown action.'});
  const player=await auth.authenticate(b.token);if(!player)return reply(401,{ok:false,error:'Connect your public Torn API key on the main page to play.'});
  const s=await store[b.action](player,b);
  return reply(200,{ok:true,game:store.publicGame(s),serverNow:store.time(),balance:await funds.balance(player)});
 }catch(e){return reply(e.status||503,{ok:false,error:e.status?e.message:'Connection interrupted. Reconnect to recover your flight.'});}
};}
exports.default=createHandler();exports.createHandler=createHandler;
