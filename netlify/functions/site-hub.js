'use strict';
const crypto=require('node:crypto');
const store=require('./site-hub/store');
const rps=require('./rps/database');
const data=require('./_data');
const wallet=require('./rps/wallet');
// Diagnostics deliberately exclude logs, request bodies, URLs, storage and hands.
function diagnostic(input={}){
  const numeric=v=>Number.isFinite(Number(v))?Math.max(0,Math.min(1e9,Number(v))):0;
  const word=v=>String(v||'').replace(/[^a-zA-Z0-9_./ -]/g,'').slice(0,100);
  return {build:word(input.build),page:word(input.page),mode:word(input.mode),phase:word(input.phase),
    online:Boolean(input.online),visibility:word(input.visibility),
    viewport:{width:numeric(input.viewport?.width),height:numeric(input.viewport?.height),pixelRatio:numeric(input.viewport?.pixelRatio)},
    errors:numeric(input.errors),networkErrors:numeric(input.networkErrors),slowFrames:numeric(input.slowFrames),frames:numeric(input.frames),revision:numeric(input.revision),round:numeric(input.round),longestFrameMs:numeric(input.longestFrameMs)};
}
const redact=text=>String(text||'').replace(/\b[A-Za-z0-9]{16,64}\b/g,'[redacted]').slice(0,4000);
function createHandler(deps={}){
 const storage=deps.store||store, arena=deps.rps||rps, runtime=deps.data||data, chips=deps.wallet||wallet, dice=deps.yahtzee||require('./yahtzee/database').createStore(),duelDice=deps.diceduel||require('./dice-duel-multiplayer/database').createStore();
 return async request=>{
  const reply=(status,value)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Xan-Build':'XAN_HUB_V1_20261011'}});
  if(request.method!=='POST')return reply(405,{error:'Use POST.'});
  const raw=await request.text();if(raw.length>16000)return reply(413,{error:'Report is too large.'});
  let body;try{body=JSON.parse(raw);if(!body||Array.isArray(body)||typeof body!=='object')throw 0;}catch{return reply(400,{error:'Invalid request.'});}
  try{
    if(body.action==='reports'){
      const expected=String(process.env.ADMIN_PASSWORD||process.env.ADMIN_PASS||process.env.ADMIN_KEY||'');
      const supplied=request.headers.get('x-admin-password')||'';
      const a=Buffer.from(expected),b=Buffer.from(supplied);
      if(!a.length||a.length!==b.length||!crypto.timingSafeEqual(a,b))return reply(401,{error:'Admin authentication required.'});
      if(body.before&&!Number.isFinite(Date.parse(body.before)))return reply(400,{error:'Invalid page cursor.'});
      return reply(200,{ok:true,reports:await storage.reports(body.before)});
    }
    const identity=body.token?await arena.authenticate(body.token):null;
    if(body.token&&!identity)return reply(401,{error:'Please reconnect your API key.'});
    if(body.action==='report'){
      const message=redact(body.message).trim(),debug=body.debug?diagnostic(body.debug):null;
      if(!message&&!debug)return reply(400,{error:'Write a report or attach debug information.'});
      return reply(200,{ok:true,id:await storage.report(identity&&{id:identity.id,name:identity.name},message,debug,request.headers.get('x-nf-client-connection-ip')||'guest')});
    }
    if(!identity)return reply(401,{error:'Connect your public API key first.'});
    if(body.action==='read'){await storage.read(identity.id,Array.isArray(body.ids)?body.ids.filter(x=>typeof x==='string'):[]);return reply(200,{ok:true});}
    const progression=deps.progression||require('./site-hub/progression');
    if(body.action==='progress')return reply(200,{ok:true,progress:await progression.profile(identity),board:await progression.leaderboard(body.mode),balance:await chips.balance(identity)});
    if(body.action==='preferences')return reply(200,{ok:true,settings:await progression.preferences(identity,body.settings||{})});
    if(body.action!=='sync')return reply(400,{error:'Unknown action.'});
    const siteUser={id:await chips.account(identity)};
    const [duels,arenas,joined]=await Promise.all([runtime.duelListGames({id:siteUser.id}),arena.lobby(identity),arena.ownedJoined(identity)]);
    const games=(duels.games||[]).filter(g=>g.status==='waiting'&&!g.private&&!g.joiner).map(g=>({id:g.gameId,mode:g.mode,name:g.modeName,creator:g.creator?.name,wager:g.wager,mine:g.isCreator,count:1,capacity:2,expiresAt:Date.parse(g.createdAt)+900000}));
    games.push(...arenas.map(g=>({...g,creator:g.name,name:'Rock Paper Scissors',mode:'rps',count:1,capacity:2})));
    for(const g of duels.games||[]){if(g.isCreator&&g.joiner&&(g.joinerReady||g.ready?.[g.joiner.userId])&&!g.joiner.isNpc&&!g.npcTest&&Date.parse(g.updatedAt)>Date.now()-86400000)joined.push({id:g.gameId,mode:g.mode,name:g.joiner.name,joiner:g.joiner.userId,href:'/?game='+encodeURIComponent(g.mode)+'&room='+encodeURIComponent(g.gameId)});}
    const four=deps.four||require('./roulette-four/database');
    const tables=await four.lobby(identity);games.push(...tables.games);joined.push(...tables.joined);
    games.push(...await duelDice.lobby(identity));joined.push(...await duelDice.readyOpponents(identity));
    games.push(...await dice.lobby(identity));if(dice.readyOpponents)joined.push(...await dice.readyOpponents(identity));
    const bluff=deps.bluff||require('./bluff/database');games.push(...await bluff.lobby(identity));if(bluff.readyOpponents)joined.push(...await bluff.readyOpponents(identity));
    const golf=deps.minigolf||require('./mini-golf/database');games.push(...await golf.lobby(identity));joined.push(...await golf.readyOpponents(identity));
    for(const g of joined)await storage.notify(identity.id,g,String(body.focus||''));
    return reply(200,{ok:true,player:identity,balance:await chips.balance(identity),games,notifications:await storage.notifications(identity.id)});
  }catch(error){return reply(error.status||503,{error:error.status?error.message:'The service is temporarily unavailable. Please retry.'});}
 };
}
exports.default=createHandler();exports.createHandler=createHandler;exports.diagnostic=diagnostic;
