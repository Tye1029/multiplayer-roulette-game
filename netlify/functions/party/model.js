'use strict';
const crypto=require('node:crypto');
const C=require('../../../assets/party/catalog');
const physics=require('../../../shared/games/mini-golf-physics');
const rnd=n=>crypto.randomInt(n);
const fail=(message,status=409)=>{throw Object.assign(new Error(message),{status});};
const pick=xs=>xs[rnd(xs.length)];
const directions=['up','left','right','down'];
function player(p){return {id:p.id,name:p.name,character:p.character,skin:p.skin||'classic',bot:!!p.bot,position:0,tokens:8,trophies:0,wins:0,total:0,items:['boost'],shield:false,participation:0};}
function create(id,p,mode,now=Date.now()){
  if(!['party','duel'].includes(mode))fail('Choose a party or a duel.',400);
  return {id,host:p.id,mode,phase:'waiting',players:[player(p)],ready:[],round:0,rounds:mode==='duel'?3:4,match:1,revision:1,deadline:now+1800000,receipts:[],history:[],gameOrder:[],turn:0,goal:6,log:'The boardwalk is yours. Invite your friends.',created:now};
}
function join(s,p){if(s.players.some(x=>x.id===p.id))return;if(s.phase!=='waiting')fail('This party has already started.');if(s.players.length>=(s.mode==='duel'?2:4))fail('This room is full.');s.players.push(player(p));s.revision++;}
function enterBoard(s,now){s.phase='board';s.turn=0;s.usedItem=false;s.lastMove=null;s.deadline=now+25000;s.log=`Round ${s.round}: choose a route and chase the trophy.`;}
function begin(s,now){if(s.players.length<2)fail('Invite a friend or add a bot first.');if(s.players.some(p=>!p.bot&&!s.ready.includes(p.id)))fail('Everyone needs to be ready.');s.gameOrder=[...C.games.map(g=>g.id)];for(let i=s.gameOrder.length-1;i>0;i--){const j=rnd(i+1);[s.gameOrder[i],s.gameOrder[j]]=[s.gameOrder[j],s.gameOrder[i]];}s.round=1;s.history=[];s.winner=null;s.finished=null;s.tied=null;s.tieAgain=false;s.tieCount=0;s.players=s.players.map(player);s.receipts=[];if(s.mode==='party')enterBoard(s,now);else enterGame(s,now);}
function enterGame(s,now,tiebreak=false){
  s.phase='intro';s.deadline=now+6000;s.game={id:tiebreak?'climb':s.gameOrder[(s.round-1)%4],start:now+6000,end:now+41000,tiebreak,sequence:Array.from({length:36},()=>pick(directions)),scores:s.players.map(()=>0),progress:s.players.map(()=>({step:0,last:0,attempts:0,inputs:0,finished:null,shot:null,pattern:Array.from({length:3},()=>rnd(4)),cursor:0,level:3,showAt:now+6000,feedback:''}))};s.lastMove=null;
}
function move(s,p,route,now){
  if(!['scenic','shortcut'].includes(route))fail('Choose a route.',400);
  if(route==='shortcut'&&p.tokens<2)fail('The shortcut costs 2 match tokens.');
  const roll=2+rnd(4),steps=roll+(route==='shortcut'?2:0)+(p.boost||0);p.boost=0;if(route==='shortcut')p.tokens-=2;else p.tokens+=2;
  const from=p.position;let trophies=0;
  for(let j=1;j<=steps;j++)if((from+j)%24===s.goal&&p.tokens>=6){p.tokens-=6;p.trophies++;trophies++;s.goal=(s.goal+8)%24;}
  p.position=(from+steps)%24;const tile=C.spaces[p.position].type;let event='';
  if(tile==='tokens'){p.tokens+=3;event='Found 3 match tokens.';}
  if(tile==='gift'){if(p.items.length<3){const gift=pick(C.items);p.items.push(gift.id);event=`Picked up ${gift.name}.`;}else{p.tokens+=2;event='Pockets full: collected 2 tokens.';}}
  if(tile==='rain'){if(p.shield){p.shield=false;event='Your umbrella kept your tokens dry.';}else{const loss=Math.min(2,p.tokens);p.tokens-=loss;event=`A rainy detour cost ${loss} tokens.`;}}
  s.lastMove={player:p.id,from,to:p.position,steps,roll,at:now,route};s.log=`${p.name} rolled ${roll}. ${trophies?'Trophy collected! ':''}${event}`;s.turn++;s.usedItem=false;s.deadline=now+25000;
  if(s.turn>=s.players.length){s.phase='board-end';s.deadline=now+2500;}
}
function finish(s,now,winner){s.phase='complete';s.winner=winner;s.finished=now;s.deadline=now+86400000;s.ready=[];s.rewards=s.players.map(p=>p.bot||p.participation<2?0:12+(p.id===winner?8:0));}
function conclude(s,now){
  const g=s.game,rank=s.players.map((p,i)=>({id:p.id,score:g.scores[i],finished:g.progress[i].finished||g.end})).sort((a,b)=>b.score-a.score||a.finished-b.finished);
  const top=rank.filter(r=>r.score===rank[0].score&&r.finished===rank[0].finished);
  const winners=rank[0].score>0?top.map(r=>r.id):[];
  for(const [i,p] of s.players.entries()){p.total+=g.scores[i];p.tokens+=Math.max(2,6-rank.findIndex(r=>r.id===p.id));if(winners.includes(p.id)){p.wins++;p.trophies++;}}
  s.history.push({round:s.round,game:g.id,scores:[...g.scores],winners,tiebreak:g.tiebreak});
  if(g.tiebreak){if(winners.length===1){finish(s,now,winners[0]);return;}if(++s.tieCount>=3){finish(s,now,null);s.log='The tiebreakers ended level. Share the honors and try a rematch.';return;}s.phase='round-end';s.deadline=now+8000;s.log='Still tied. Another rooftop sprint decides it.';s.tieAgain=true;return;}
  const leaders=[...s.players].sort((a,b)=>b.wins-a.wins);
  const duelWinner=s.mode==='duel'&&leaders[0].wins>=2&&leaders[0].wins>leaders[1].wins?leaders[0]:null;
  if(duelWinner){finish(s,now,duelWinner.id);return;}
  if(s.round>=s.rounds){const ranking=[...s.players].sort((a,b)=>b.trophies-a.trophies||b.total-a.total),tied=ranking.filter(p=>p.trophies===ranking[0].trophies&&p.total===ranking[0].total);if(tied.length===1){finish(s,now,ranking[0].id);return;}
    // A fully idle match ends without inventing a winner or granting rewards.
    if(s.players.every(p=>p.participation===0)){finish(s,now,null);s.log='The party ended with no completed play.';return;}
    s.tied=tied.map(p=>p.id);s.tieAgain=true;
  }
  s.phase='round-end';s.deadline=now+9000;s.log=winners.length?`${s.players.filter(p=>winners.includes(p.id)).map(p=>p.name).join(' & ')} won this minigame!`:'No points this round. Next round is a fresh start.';
}
function play(s,p,b,now){
  const g=s.game,i=s.players.indexOf(p),v=g.progress[i];
  if(s.phase!=='playing'||now<g.start||now>=g.end)fail('This minigame is not accepting moves.');
  if(g.tiebreak&&!s.tied.includes(p.id))fail('Watch the finalists in the tiebreaker.');
  if(v.finished)fail('Your round is finished.');
  if(now-v.last<130)fail('Give your last move a moment.');
  if(g.id==='climb'){
    if(!directions.includes(b.value))fail('Choose an arrow.',400);
    if(b.value===g.sequence[v.step]){v.step++;v.feedback='Nice climb!';}else{v.step=Math.max(0,v.step-1);v.feedback='Slip! Match the highlighted arrow.';}
    g.scores[i]=v.step*100;if(v.step>=24)v.finished=now;
  }else if(g.id==='memory'){
    if(b.value==='replay'){if(now-v.showAt<2000)fail('Give the lights a moment.');v.cursor=0;v.showAt=now;v.last=now;v.feedback='Watch the lights again.';return;}
    if(!Number.isInteger(b.value)||b.value<0||b.value>3)fail('Choose a light.',400);
    if(now<v.showAt+v.pattern.length*650+300)fail('Watch the pattern first.');
    if(b.value===v.pattern[v.cursor]){v.cursor++;v.feedback='Keep going';if(v.cursor===v.pattern.length){g.scores[i]+=v.level*100;v.level=Math.min(8,v.level+1);v.pattern=Array.from({length:v.level},()=>rnd(4));v.cursor=0;v.showAt=now+800;v.feedback='Pattern complete!';}}
    else{v.cursor=0;v.pattern=Array.from({length:v.level},()=>rnd(4));v.showAt=now+800;v.feedback='Watch the new pattern.';}
  }else if(g.id==='fish'){
    if(now-v.last<1200&&v.attempts)fail('Wait for the next cast.');
    if(v.attempts>=5)fail('All five casts are complete.');
    const center=.5+.23*Math.sin(v.attempts*2.1),pos=.5+.46*Math.sin((now-g.start)/1000*2.1);const score=Math.max(0,Math.round(300*(1-Math.abs(center-pos)/.28)));
    g.scores[i]+=score;v.feedback=score>230?'Perfect catch!':score>80?'Fish on!':'Just missed. Watch the gold zone.';v.attempts++;v.catch={score,at:now};if(v.attempts===5)v.finished=now;
  }else if(g.id==='putt'){
    if(v.shot&&now<v.shot.at+v.shot.duration+300)fail('Let the ball finish rolling.');
    if(v.attempts>=3)fail('All three attempts are complete.');
    if(!Number.isFinite(b.angle)||b.angle< -Math.PI||b.angle>Math.PI||!Number.isFinite(b.power)||b.power<.05||b.power>1)fail('Choose valid aim and power.',400);
    const shot=physics.simulate(C.hole,C.hole.tee,b.angle,b.power,now),score=shot.holed?1000:Math.max(0,Math.round(900-Math.hypot(shot.position[0]-C.hole.cup[0],shot.position[1]-C.hole.cup[1])*1.6));
    g.scores[i]=Math.max(g.scores[i],score);v.shot={...shot,at:now};v.attempts++;v.feedback=shot.holed?'In the cup!':`${score} points. Your best attempt counts.`;if(v.attempts===3)v.finished=now+shot.duration;
  }
  v.last=now;v.inputs++;p.participation++;return true;
}
function advance(s,now=Date.now()){
  // Bounded catch-up: deadlines are based on NOW when advancing, so reconnects
  // never fast-forward through several unplayed games or manufacture results.
  if(s.phase==='waiting'&&now>=s.deadline){s.phase='expired';return;}
  if(s.phase==='board'){
    const p=s.players[s.turn];if(now>=s.deadline||(p?.bot&&now>=s.deadline-23000))move(s,p,'scenic',now);
  }else if(s.phase==='board-end'&&now>=s.deadline)enterGame(s,now);
  else if(s.phase==='intro'&&now>=s.deadline){s.phase='playing';s.game.start=now;s.game.end=now+35000;s.deadline=s.game.end;for(const v of s.game.progress)v.showAt=now;}
  else if(s.phase==='playing'){
    const g=s.game;
    for(const [i,p] of s.players.entries())if(p.bot&&!g.progress[i].finished&&now<g.end&&now-g.progress[i].last>850){const v=g.progress[i];try{if(g.id==='climb')play(s,p,{value:rnd(9)?g.sequence[v.step]:pick(directions)},now);if(g.id==='memory'&&now>v.showAt+v.pattern.length*650+300)play(s,p,{value:rnd(12)?v.pattern[v.cursor]:rnd(4)},now);if(g.id==='fish'&&now-v.last>3500)play(s,p,{},now);if(g.id==='putt')play(s,p,{angle:-1.2-rnd(8)/10,power:.3+rnd(55)/100},now);}catch(e){if(!e.status)throw e;}}
    const active=s.players.map((p,i)=>g.tiebreak&&!s.tied.includes(p.id)?null:g.progress[i]).filter(Boolean);
    if(now>=g.end||active.every(v=>v.finished&&now>=v.finished+1500))conclude(s,now);
  }else if(s.phase==='round-end'&&now>=s.deadline){if(s.tieAgain){s.tieAgain=false;enterGame(s,now,true);}else{s.round++;if(s.mode==='party')enterBoard(s,now);else enterGame(s,now);}}
}
function act(s,id,b,now=Date.now()){
  const p=s.players.find(p=>p.id===id);if(!p)fail('Only room members can do that.',403);
  if(b.action==='get')return;
  if(b.action==='ready'){if(s.phase!=='waiting')fail('The party is already underway.');s.ready=s.ready.includes(id)?s.ready.filter(v=>v!==id):[...s.ready,id];}
  else if(b.action==='start'){if(id!==s.host)fail('Only the host can start.',403);if(s.phase!=='waiting')fail('The match already started.');begin(s,now);}
  else if(b.action==='add-bot'){if(id!==s.host)fail('Only the host can add bots.',403);const n=s.players.length;join(s,{id:'bot:'+crypto.randomUUID(),name:['Pip','Dizzy','Nova'][n-1]||'Pip',bot:true,character:C.characters[n%4].id});}
  else if(b.action==='move'||b.action==='item'||b.action==='buy-item'){
    if(s.phase!=='board'||s.players[s.turn].id!==id||b.round!==s.round)fail('Wait for your board turn.');
    if(b.action==='move')move(s,p,b.route,now);
    else{const item=C.items.find(x=>x.id===b.item);if(!item)fail('Unknown item.',400);if(b.action==='buy-item'){if(p.items.length>=3)fail('Your pockets are full.');if(p.tokens<item.cost)fail('Not enough match tokens.');p.tokens-=item.cost;p.items.push(item.id);}else{if(s.usedItem)fail('One item per turn.');const index=p.items.indexOf(item.id);if(index<0)fail('You do not have that item.');p.items.splice(index,1);if(item.id==='boost')p.boost=3;if(item.id==='shield')p.shield=true;if(item.id==='magnet')p.tokens+=5;s.usedItem=true;s.log=`${p.name} used ${item.name}.`;}}
  }else if(b.action==='play'){if(b.round!==s.round||b.game!==s.game?.id||b.start!==s.game?.start)fail('That move belongs to an earlier round.');play(s,p,b,now);}
  else if(b.action==='leave'){
    if(s.phase!=='waiting'&&s.phase!=='complete'&&s.phase!=='expired')fail('Your seat is kept until this match ends. You can reconnect from this device.');
    s.players=s.players.filter(x=>x.id!==id);s.ready=s.ready.filter(v=>v!==id);if(s.host===id)s.host=s.players.find(x=>!x.bot)?.id||'';if(!s.host)s.phase='expired';
  }else if(b.action==='rematch'){
    if(s.phase!=='complete')fail('Finish this match first.');if(!s.ready.includes(id))s.ready.push(id);
    if(s.players.every(x=>x.bot||s.ready.includes(x.id))){s.match++;s.phase='waiting';begin(s,now);}
  }else fail('Unknown room action.',400);
  s.revision++;
}
function view(s,id,now=Date.now()){
  const index=s.players.findIndex(p=>p.id===id);if(index<0)fail('Join this room to see the match.',403);
  const {receipts,gameOrder,...out}=structuredClone(s);out.you=id;out.serverTime=now;delete out.created;
  if(out.game){const original=s.game;delete out.game.sequence;
    out.game.progress=out.game.progress.map((v,i)=>{if(i!==index){delete v.pattern;delete v.cursor;delete v.level;return v;}
      v.next=original.sequence.slice(v.step,v.step+4);if(now>=v.showAt+v.pattern.length*650+300)delete v.pattern;return v;});
  }
  return out;
}
module.exports={create,join,begin,act,advance,view,fail};
