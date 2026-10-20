'use strict';
const db=require('./roulette-four/database'),rps=require('./rps/database'),model=require('./roulette-four/model');
function createHandler(database=db,auth=rps){return async request=>{
 const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Four-Build':'XAN_FOUR_ONLINE_V1'}});
 if(request.method!=='POST')return reply(405,{error:'Use POST.'});const raw=await request.text();if(raw.length>4096)return reply(413,{error:'Request too large.'});
 let b;try{b=JSON.parse(raw);if(!b||Array.isArray(b)||typeof b!=='object')throw 0;}catch{return reply(400,{error:'Invalid request.'});}
 try{const p=await auth.authenticate(b.token);if(!p)return reply(401,{error:'Connect your public API key on the main site first.'});let state;
  if(b.action==='create')state=await database.create(p,b);else{if(!/^[A-F0-9]{12}$/.test(b.gameId||''))return reply(400,{error:'Invalid table code.'});state=await database.action(b.gameId,p,b);}
  return reply(200,{ok:true,player:p,game:model.publicState(state,p.id)});
 }catch(e){return reply(e.status||503,{error:e.status?e.message:'The table is temporarily unavailable. Retry to recover your game.'});}
};}
exports.default=createHandler();exports.createHandler=createHandler;
