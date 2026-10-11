'use strict';
const {randomInt}=require('node:crypto');
const rules=require('../../../assets/yahtzee/rules');
const ROUND_MS=30000, BREAK_MS=1800, COUNTDOWN_MS=3000;
const randomDie=()=>randomInt(1,7);
function fail(message,status=409){throw Object.assign(new Error(message),{status});}
function player(id,name,bot=false){
  return {id:String(id),name:String(name).slice(0,40),bot,card:{},bonus:0,dice:[],held:Array(5).fill(false),rolls:0,rollSerial:0,lastRollHeld:Array(5).fill(false),inputVersion:0,locked:false,last:null};
}
function fresh(id,who,now=Date.now()){
  return {version:2,id,phase:'waiting',players:[who],revision:1,round:1,requests:[],rematch:[],createdAt:now,expiresAt:now+86400000,game:1,deadline:0,nextAt:0,botAt:0,botStep:0};
}
function begin(s,now){
  s.phase='playing';s.deadline=now+ROUND_MS;s.nextAt=0;s.botAt=now+1300;s.botStep=0;
  for(const p of s.players){p.dice=[];p.held.fill(false);p.rolls=0;p.locked=false;p.last=null;p.inputVersion++;}
}
function countdown(s,now){
  begin(s,now+COUNTDOWN_MS);s.phase='countdown';s.startAt=now+COUNTDOWN_MS;s.finishedAt=0;
}
function rollDice(p,roll){
  p.lastRollHeld=[...p.held];p.dice=Array.from({length:5},(_,i)=>p.held[i]?p.dice[i]:roll());p.rolls++;p.rollSerial++;p.inputVersion++;
}
function bank(p,key,automatic=false){
  const options=rules.options(p.dice,p.card);
  if(!Object.hasOwn(options,key))fail('Choose an available category.',400);
  const extra=rules.score(p.dice,'yahtzee')===50&&p.card.yahtzee===50?100:0;
  p.card[key]=options[key];p.bonus+=extra;p.locked=true;p.inputVersion++;
  p.last={category:key,score:options[key],bonus:extra,automatic};
}
function best(p){return Object.entries(rules.options(p.dice,p.card)).sort((a,b)=>b[1]-a[1])[0][0];}
function finishRound(s,now){
  if(!s.players.every(p=>p.locked))return;
  if(s.round===13){s.phase='complete';s.deadline=0;s.botAt=0;s.finishedAt=now;}
  else{s.phase='between';s.nextAt=now+BREAK_MS;s.deadline=0;}
}
function botHold(p){
  const counts=Array(7).fill(0);p.dice.forEach(n=>counts[n]++);
  const target=[1,2,3,4,5,6].sort((a,b)=>counts[b]-counts[a]||b-a)[0];
  const options=rules.options(p.dice,p.card);
  p.held=p.dice.map(n=>(options.yahtzee===50||options.large===40||options.house===25)||n===target);
  p.inputVersion++;
}
function advance(s,now=Date.now(),roll=randomDie){
  // Fixed timestamps let sleeping browsers catch up without extending turns.
  for(let transitions=0;transitions<150;transitions++){
    if(s.phase==='countdown'){
      if(now<s.startAt)break;
      s.phase='playing';continue;
    }
    if(s.phase==='between'){
      if(now<s.nextAt)break;
      const at=s.nextAt;s.round++;begin(s,at);continue;
    }
    if(s.phase!=='playing')break;
    const bot=s.players.find(p=>p.bot&&!p.locked);
    if(bot&&s.botAt<=now&&s.botAt<s.deadline){
      const at=s.botAt;
      if(s.botStep%2===1){botHold(bot);}
      else if(bot.rolls===3||bot.held.every(Boolean)){bank(bot,best(bot));}
      else{rollDice(bot,roll);}
      s.botStep++;s.botAt=at+1300;finishRound(s,at);continue;
    }
    if(now>=s.deadline){const at=s.deadline;for(const p of s.players)if(!p.locked)bank(p,best(p),true);finishRound(s,at);continue;}
    break;
  }
}
function act(s,id,b,roll=randomDie,now=Date.now()){
  const p=s.players.find(p=>p.id===id&&!p.bot);if(!p)fail('Join this room first.',403);
  if(b.action==='cancel'){
    if(s.phase!=='waiting'||s.players.length!==1||s.players[0].id!==id)fail('Only an empty waiting room can be cancelled.');
    s.phase='closed';return;
  }
  if(b.action==='start'||b.action==='bot'){
    if(s.phase!=='waiting'||s.players[0].id!==id)fail('Only the host can start this room.');
    if(b.action==='bot'){
      if(s.players.length!==1)fail('The opponent seat is already taken.');
      s.players.push(player('bot:'+s.id,'House Bot',true));
    }
    if(s.players.length!==2)fail('Invite a friend or add a test bot.');countdown(s,now);return;
  }
  if(b.action==='leave'){s.phase='closed';return;}
  if(b.game!==s.game)fail('This game has changed. Refresh the table.');
  if(b.action==='rematch'){
    if(s.phase!=='complete')fail('Finish this game first.');
    if(!s.rematch.includes(id))s.rematch.push(id);
    if(s.players.filter(p=>!p.bot).every(p=>s.rematch.includes(p.id))){
      for(const p of s.players){p.card={};p.bonus=0;}s.game++;s.round=1;s.rematch=[];countdown(s,now);
    }
    return;
  }
  if(s.phase!=='playing'||b.round!==s.round||now>=s.deadline||p.locked)fail('This turn is locked. Wait for the next round.');
  // Opponent moves never invalidate your input revision.
  if(b.inputVersion!==p.inputVersion)fail('Your dice changed. Try that move again.');
  if(b.action==='roll'){
    if(p.rolls>=3)fail('Choose a score to finish this turn.');
    if(p.rolls&&p.held.every(Boolean))fail('Release a die or choose a score.');rollDice(p,roll);return;
  }
  if(b.action==='hold'){
    if(!p.rolls||p.rolls>=3||!Number.isInteger(b.index)||b.index<0||b.index>4||typeof b.held!=='boolean')fail('You cannot hold that die now.',400);
    p.held[b.index]=b.held;p.inputVersion++;return;
  }
  if(b.action==='score'){
    if(!p.rolls)fail('Roll the dice first.',400);bank(p,b.category);finishRound(s,now);return;
  }
  fail('Unknown action.',400);
}
function publicState(s,id,now=Date.now()){
  const {requests,botStep,botAt,finance,...view}=s;
  return {...view,...require('../shared/table-finance').publicState(s),you:id,serverNow:now,players:s.players.map(p=>({...p,yahtzeeBonus:p.bonus,...rules.totals(p)}))};
}
module.exports={fail,player,fresh,begin,act,advance,publicState,ROUND_MS,BREAK_MS,COUNTDOWN_MS};
