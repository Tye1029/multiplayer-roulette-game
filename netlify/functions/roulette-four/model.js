'use strict';
const crypto=require('node:crypto');
const roll=()=>crypto.randomInt(1,7);
function fail(message,status=409){const e=new Error(message);e.status=status;throw e;}
function begin(s,now=Date.now()){
 s.order=s.players.map(p=>p.id);
 for(let i=3;i>0;i--){const j=crypto.randomInt(i+1);[s.order[i],s.order[j]]=[s.order[j],s.order[i]];}
 s.phase='opening';s.startAt=now+6000;s.deadline=s.startAt+60000;s.turn=0;s.turnShots=0;s.safeSinceSpin=0;s.bullet=roll();s.pot=s.wager*4;s.base=s.wager/5;s.nextPayout=s.base;
 for(const p of s.players)Object.assign(p,{bank:0,shots:0,spinUsed:false,eliminated:false});
}
function next(s,now){do{s.turn=(s.turn+1)%4;}while(s.players.find(p=>p.id===s.order[s.turn]).eliminated);s.turnShots=0;s.deadline=now+60000;}
function split(players,pot,equal=false){
 const sorted=[...players].sort((a,b)=>a.shots-b.shots),weights=equal?sorted.map(()=>1):sorted.length===3?[25,30,35]:sorted.length===2?[25,35]:[1];
 const total=weights.reduce((a,b)=>a+b,0);let used=0;const awards=[];
 for(let i=0;i<sorted.length;){let end=i+1;while(end<sorted.length&&sorted[end].shots===sorted[i].shots)end++;const weight=weights.slice(i,end).reduce((a,b)=>a+b,0)/(end-i);for(let j=i;j<end;j++){const amount=Math.floor(pot*weight/total);awards.push({p:sorted[j],amount});used+=amount;}i=end;}
 // Randomize equal remainders so no fixed seat receives rounding priority.
 while(used<pot){awards[crypto.randomInt(awards.length)].amount++;used++;}
 for(const a of awards)a.p.bank+=a.amount;
}
function advance(s,now=Date.now()){
 if(s.rematchUntil&&s.rematchUntil<=now&&!s.nextMatch&&(s.rematchVotes||[]).length){s.rematchVotes=[];s.rematchUntil=null;s.revision++;}
 if(s.phase==='waiting'&&now>=s.deadline){s.phase='cancelled';s.reason='The 15-minute waiting period ended.';s.revision++;}
 if(s.phase==='opening'&&now>=s.startAt){s.phase='playing';s.revision++;}
 if(s.phase==='playing'&&now>=s.deadline){const p=s.players.find(p=>p.id===s.order[s.turn]);const bank=p.bank;p.bank=0;p.eliminated=true;const live=s.players.filter(p=>!p.eliminated);split(live,bank,true);s.lastAction={id:p.id,action:'timeout',number:++s.actionNumber};if(live.length===1){live[0].bank+=s.pot;s.pot=0;s.phase='complete';}else next(s,now);s.revision++;}
 return s;
}
function act(s,id,action,now=Date.now()){
 if(s.phase!=='playing'||s.order[s.turn]!==id)fail('Wait for your turn.');
 if(now<s.actionAfter)fail('Wait for the current action to finish.');
 const p=s.players.find(p=>p.id===id),event={id,action,number:s.actionNumber+1};
 if(action==='pass'){if(!s.turnShots)fail('Take a shot before passing.');next(s,now);}
 else if(action==='spin'){if(p.spinUsed)fail('You have used your spin.');p.spinUsed=true;s.bullet=roll();s.safeSinceSpin=0;s.nextPayout=s.base;}
 else if(action==='shoot'){
  s.bullet--;
  if(!s.bullet){event.fatal=true;p.eliminated=true;s.pot+=p.bank;p.bank=0;split(s.players.filter(p=>!p.eliminated),s.pot);s.pot=0;s.phase='complete';}
  else{event.award=Math.min(s.nextPayout,s.pot);p.bank+=event.award;s.pot-=event.award;p.shots++;s.turnShots++;s.safeSinceSpin++;s.nextPayout+=s.base;if(!s.pot)s.phase='complete';}
 }else fail('Unknown table action.',400);
 s.actionNumber++;s.lastAction=event;s.actionAfter=now+1200;s.revision++;
 if(s.pot+s.players.reduce((n,p)=>n+p.bank,0)!==s.wager*4)throw Error('Pot conservation failed');
 return s;
}
function publicState(s,viewer){
 const seated=s.players.some(p=>p.id===viewer);
 return {id:s.id,phase:s.phase,wager:s.wager,rate:s.rate,revision:s.revision,createdAt:s.createdAt,deadline:s.deadline,startAt:s.startAt,serverNow:Date.now(),
  players:s.players.map(({id,name,bank,shots,spinUsed,eliminated})=>({id,name,bank:bank||0,shots:shots||0,spinUsed:!!spinUsed,eliminated:!!eliminated})),
  order:s.order||s.players.map(p=>p.id),activeId:s.order?.[s.turn],turnShots:s.turnShots||0,safeSinceSpin:s.safeSinceSpin||0,pot:s.pot||0,nextPayout:s.nextPayout||s.wager/5,
  actionAfter:s.actionAfter||0,lastAction:s.lastAction||null,reason:s.reason||'',settled:!!s.settled,payouts:s.payouts||{},mine:s.players[0].id===viewer,seated,
  rematchUntil:s.rematchUntil||null,rematchVotes:s.rematchVotes||[],nextMatch:s.nextMatch||null};
}
module.exports={begin,advance,act,publicState,fail,split};
