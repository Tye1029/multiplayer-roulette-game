'use strict';
const {createStore}=require('./yahtzee/database');
const auth=require('./rps/database');
function createHandler(store=createStore(),identity=auth) {
  return async(request,context={})=>{
    const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Yahtzee-Build':'YAHTZEE_DUEL_V2_20261011'}});
    if(request.method!=='POST')return reply(405,{error:'Use POST.'});
    const raw=await request.text();if(raw.length>4096)return reply(413,{error:'Request too large.'});
    let b;try{b=JSON.parse(raw);if(!b||Array.isArray(b)||typeof b!=='object')throw 0;}catch{return reply(400,{error:'Invalid request.'});}
    try{
      const player=await identity.authenticate(b.token);
      if(!player)return reply(401,{error:'Connect your public Torn API key on the main site to play.'});
      if(b.action==='profile')return reply(200,{ok:true,player});
      return reply(200,{ok:true,player,room:await store.run(b,player,context.ip||'unknown')});
    }
    catch(e){if(!e.status)console.error('Yahtzee storage failure',e.code||e.name);return reply(e.status||503,{error:e.status?e.message:'The table is temporarily unavailable. Please retry.'});}
  };
}
exports.default=createHandler();exports.createHandler=createHandler;
