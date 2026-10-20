'use strict';
const {randomInt}=require('node:crypto');
const COUNTDOWN_MS=3000,ROUND_MS=60000,BREAK_MS=7000;
const randomDie=()=>randomInt(1,7);
function fail(message,status=409){throw Object.assign(Error(message),{status});}
function player(id,name,bot=false){return {id:String(id),name:String(name).slice(0,40),bot,dice:[],locked:false};}
function fresh(id,who,now=Date.now()){return {version:2,id,phase:'waiting',players:[who],revision:1,round:1,winsRequired:2,scores:[0,0],requests:[],rematch:[],ready:[],createdAt:now,expiresAt:now+86400000,game:1,deadline:0,nextAt:0,botAt:0,history:[],winner:null};}
function begin(s,now){s.phase='playing';s.startAt=0;s.deadline=now+ROUND_MS;s.nextAt=0;s.botAt=now+1800;for(const p of s.players){p.dice=[];p.locked=false;}}
function countdown(s,now){begin(s,now+COUNTDOWN_MS);s.phase='countdown';s.startAt=now+COUNTDOWN_MS;s.finishedAt=0;s.winner=null;delete s.reason;delete s.forfeitWinner;}
function finish(s,now){if(!s.players.every(p=>p.locked))return;const totals=s.players.map(p=>p.dice[0]+p.dice[1]),winner=totals[0]===totals[1]?null:totals[0]>totals[1]?0:1;s.scores||=[0,0];const scoresBefore=[...s.scores];if(winner!==null)s.scores[winner]++;s.history.push({round:s.round,dice:s.players.map(p=>[...p.dice]),totals,winner,scoresBefore});s.history=s.history.slice(-20);s.deadline=0;
 // Already-started legacy matches retain their one-win terms until the next rematch.
 if(winner!==null&&s.scores[winner]>=(s.winsRequired||1)){s.phase='complete';s.finishedAt=now;s.winner=winner;}else{s.phase='between';s.nextAt=now+BREAK_MS;}}
function advance(s,now=Date.now(),roll=randomDie){
 if(s.phase==='waiting'&&s.readyDeadline&&now>=s.readyDeadline){s.ready=[];s.readyDeadline=null;}
 for(let i=0;i<8;i++){
  if(s.phase==='countdown'&&now>=s.startAt){s.phase='playing';continue;}
  if(s.phase==='between'&&now>=s.nextAt){const at=s.nextAt;s.round++;begin(s,at);continue;}
  if(s.phase!=='playing')break;
  const bot=s.players.find(p=>p.bot&&!p.locked);
  if(bot&&now>=s.botAt&&s.botAt<s.deadline){bot.dice=[roll(),roll()];bot.locked=true;finish(s,s.botAt);continue;}
  if(now>=s.deadline){const locked=s.players.findIndex(p=>p.locked);s.winner=locked<0?null:locked;s.phase='complete';s.finishedAt=s.deadline;s.deadline=0;s.reason=locked<0?'Both players missed the roll. Wagers returned.':'Opponent missed the roll deadline.';}
  break;
 }
}
function act(s,id,b,roll=randomDie,now=Date.now()){
 const p=s.players.find(p=>p.id===id&&!p.bot);if(!p)fail('Join this room first.',403);
 if(b.action==='cancel'){if(s.phase!=='waiting'||s.players.length!==1||s.players[0].id!==id)fail('Only an empty waiting game can be cancelled.');s.phase='closed';return;}
 if(b.action==='start'||b.action==='bot'){
  if(s.phase!=='waiting')fail('This match has already started.');
  if(b.action==='bot'){if(s.players[0].id!==id||s.players.length!==1)fail('Only the host can fill an empty seat.');s.players.push(player('bot:'+s.id,'Dice Bot',true));}
  if(s.players.length!==2)fail('Wait for another player.');s.winsRequired=2;s.scores=[0,0];if(!s.ready.includes(id))s.ready.push(id);s.readyDeadline||=now+60000;if(s.players.every(p=>p.bot||s.ready.includes(p.id)))countdown(s,now);return;
 }
 if(b.action==='leave'){if(['playing','countdown','between'].includes(s.phase)){s.phase='complete';s.winner=s.players.findIndex(p=>p.id!==id);s.finishedAt=now;s.reason='Opponent left the game.';}else if(s.phase==='waiting')s.phase='closed';return;}
 if(b.game!==s.game)fail('This match has changed. Refresh the table.');
 if(b.action==='rematch'){if(s.phase!=='complete')fail('Finish this match first.');if(!s.rematch.includes(id))s.rematch.push(id);if(s.players.every(p=>p.bot||s.rematch.includes(p.id))){s.game++;s.round=1;s.winsRequired=2;s.scores=[0,0];s.history=[];s.rematch=[];countdown(s,now);}return;}
 if(b.action==='roll'){if(s.phase!=='playing'||b.round!==s.round||p.locked||now>=s.deadline)fail('This roll is locked.');p.dice=[roll(),roll()];p.locked=true;finish(s,now);return;}
 fail('Unknown action.',400);
}
function publicState(s,id,now=Date.now()){
 const {requests,botAt,finance,owner_key,...view}=s,reveal=['between','complete'].includes(s.phase);
 return {...view,...require('../shared/table-finance').publicState(s),you:id,serverNow:now,players:s.players.map(p=>({...p,dice:reveal?p.dice:[]}))};
}
module.exports={fail,player,fresh,begin,act,advance,publicState,ROUND_MS,BREAK_MS,COUNTDOWN_MS};
