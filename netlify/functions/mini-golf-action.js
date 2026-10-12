'use strict';
const database=require('./mini-golf/database');
const auth=require('./rps/database');
const model=require('../../shared/games/mini-golf-model');
function createHandler(store=database,identity=auth){return async request=>{
  const reply=(status,value)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Golf-Build':'POCKET_PUTT_V7'}});
  if(request.method!=='POST')return reply(405,{error:'Use POST.'});
  const raw=await request.text();if(raw.length>8192)return reply(413,{error:'Request too large.'});
  let b;try{b=JSON.parse(raw);if(!b||typeof b!=='object'||Array.isArray(b))throw 0;}catch{return reply(400,{error:'Invalid request.'});}
  try{
    const p=await identity.authenticate(b.token);if(!p)return reply(401,{error:'Connect your public Torn API key on the home page to play online. Solo practice needs no account.'});
    if(!['create','quote','join','get','add-bot','ready','shot','continue','rematch','cancel','forfeit','color'].includes(b.action))return reply(400,{error:'Unknown action.'});
    if(b.action!=='create'&&!/^[A-F0-9]{12}$/.test(b.gameId||''))return reply(400,{error:'Invalid private game code.'});
    if(b.action==='shot'&&!/^[a-f0-9-]{24,40}$/i.test(b.requestId||''))return reply(400,{error:'Missing shot request ID.'});
    if(b.action==='quote')return reply(200,{ok:true,quote:await store.quote(b.gameId)});
    const s=b.action==='create'?await store.create(p,b):await store.action(b.gameId,p,b);
    return reply(200,{ok:true,game:model.publicState(s,p.id)});
  }catch(e){return reply(e.status||503,{error:e.status?e.message:'The course is temporarily unavailable. Retry to recover your game.'});}
};}
exports.default=createHandler();exports.createHandler=createHandler;
