/* POCKET_PUTT_V2 — turns, deadlines, scores and rematches belong to the server. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./mini-golf-courses'),require('./mini-golf-physics'));else root.PuttRules=factory(root.PuttCourses,root.PuttPhysics);})(globalThis,(C,P)=>{
  'use strict';
  const TURN_MS=90000,STROKE_LIMIT=12;
  const fail=(message,status=409)=>{throw Object.assign(Error(message),{status});};
  const person=p=>({id:String(p.id),name:String(p.name||'Player').slice(0,48),avatar:p.avatar||'',bot:!!p.bot});
  function create(id,player,course='garden',now=Date.now()){
    if(!C.get(course))fail('Choose an available course.',400);
    return {id,build:'POCKET_PUTT_V2',course,players:[person(player)],phase:'waiting',ready:[],rematch:[],match:1,revision:1,hole:0,turn:0,createdAt:now,deadline:now+900000,readyDeadline:null,balls:[],scores:[],stats:[],winner:null,lastShot:null};
  }
  function join(s,p,now=Date.now()){if(s.players.some(x=>x.id===String(p.id)))return;if(s.phase!=='waiting'||s.players.length!==1||now>=s.deadline)fail('This game is no longer open.');s.players.push(person(p));s.revision++;}
  function newHole(s,now){const h=C.get(s.course).holes[s.hole];s.balls=s.players.map(()=>({position:[...h.tee],strokes:0,holed:false,capped:false}));s.turn=s.hole%s.players.length;s.phase='playing';s.lastShot=null;s.continue=[];s.deadline=now+TURN_MS;s.botAt=now+1300;s.revision++;}
  function start(s,now){s.hole=0;s.scores=s.players.map(()=>[]);s.stats=s.players.map(()=>({aces:0,birdies:0,portals:0,banks:0,water:0}));s.rematch=[];s.ready=[];s.winner=null;s.reason='';s.cancelled=false;s.forfeited=false;newHole(s,now);}
  function finish(s,winner,reason,now){s.phase='complete';s.winner=winner;s.reason=reason;s.completedAt=now;s.deadline=null;s.revision++;}
  function resolveShot(s,now){
    if(!s.lastShot||s.lastShot.resolved||now<s.lastShot.endsAt)return;
    // A late poll must not restart a player's clock or keep an abandoned stake alive.
    now=s.lastShot.endsAt;
    s.lastShot.resolved=true;
    if(s.balls.every(b=>b.holed||b.capped)){
      const par=C.get(s.course).holes[s.hole].par;
      s.balls.forEach((b,i)=>{s.scores[i].push(b.strokes);if(b.holed&&b.strokes===1)s.stats[i].aces++;if(b.holed&&b.strokes<par)s.stats[i].birdies++;});
      if(s.hole===C.get(s.course).holes.length-1){const totals=s.scores.map(a=>a.reduce((x,y)=>x+y,0));finish(s,totals.length===1?0:totals[0]===totals[1]?'draw':totals[0]<totals[1]?0:1,'Lowest total strokes wins.',now);}
      else{s.phase='hole-complete';s.continue=s.players.filter(p=>p.bot).map(p=>p.id);s.deadline=now+30000;s.revision++;}
      return;
    }
    let next=(s.turn+1)%s.players.length;if(s.balls[next].holed||s.balls[next].capped)next=s.turn;s.turn=next;s.deadline=now+TURN_MS;s.botAt=now+1400;s.revision++;
  }
  function advance(s,now=Date.now()){
    if(s.phase==='waiting'&&now>=s.deadline){s.cancelled=true;finish(s,'draw','The invitation expired.',now);}
    if(s.phase==='waiting'&&s.readyDeadline&&now>=s.readyDeadline){s.ready=[];s.readyDeadline=null;s.revision++;}
    if(s.phase==='playing'){resolveShot(s,now);if(s.phase==='playing'&&now>=s.deadline&&(!s.lastShot||s.lastShot.resolved)){s.forfeited=true;finish(s,s.players.length===1?'draw':1-s.turn,'The 90-second shot clock expired.',now);}}
    if(s.phase==='hole-complete'&&now>=s.deadline){s.hole++;newHole(s,now);}
    return s;
  }
  function shoot(s,id,b,now){
    if(s.phase!=='playing'||s.players[s.turn]?.id!==id)fail('Wait for your turn.');
    if(s.lastShot&&!s.lastShot.resolved)fail('Wait for the ball to stop.');
    if(b.revision!==s.revision)fail('The game changed. Your shot was not taken; aim again.');
    if(typeof b.angle!=='number'||!Number.isFinite(b.angle)||Math.abs(b.angle)>Math.PI*4||typeof b.power!=='number'||!Number.isFinite(b.power)||b.power<0.025||b.power>1)fail('Invalid shot strength or direction.',400);
    const ball=s.balls[s.turn];if(ball.holed||ball.capped)fail('This ball has finished the hole.');
    const r=P.simulate(C.get(s.course).holes[s.hole],ball.position,b.angle,b.power,now);
    ball.position=r.position;ball.strokes=Math.min(STROKE_LIMIT,ball.strokes+1+r.penalty);ball.holed=r.holed;ball.capped=!r.holed&&ball.strokes>=STROKE_LIMIT;
    const stats=s.stats[s.turn];stats.portals+=Number(r.portalUsed);stats.banks+=r.events.filter(e=>e.type==='bank').length;stats.water+=r.penalty;
    s.lastShot={id:b.requestId,player:s.turn,...r,startedAt:now,endsAt:now+r.duration+650,resolved:false};s.deadline=s.lastShot.endsAt+TURN_MS;s.revision++;
  }
  function act(s,id,b,now=Date.now()){
    id=String(id);if(!s.players.some(p=>p.id===id))fail('This game belongs to its players.',403);
    advance(s,now);
    // Retry-safe shot IDs also protect against a response lost after the commit.
    if(b.action==='shot'&&s.lastShot?.id===b.requestId&&s.players[s.lastShot.player]?.id===id)return s;
    if(b.action==='ready'){
      if(s.phase!=='waiting'||s.players.length<2)fail('Wait for an opponent.');
      if(!s.ready.includes(id))s.ready.push(id);for(const p of s.players)if(p.bot&&!s.ready.includes(p.id))s.ready.push(p.id);
      s.readyDeadline||=now+60000;s.revision++;if(s.ready.length===s.players.length)start(s,now);
    }else if(b.action==='add-bot'){
      if(s.players[0].id!==id||s.phase!=='waiting'||s.players.length!==1)fail('Add a bot to your empty game.');join(s,{id:'bot:putter',name:'Pip the Putter',bot:true},now);
    }else if(b.action==='cancel'){
      if(s.phase!=='waiting'||s.players[0].id!==id)fail('Only the creator can cancel before play starts.');s.cancelled=true;finish(s,'draw','Game cancelled.',now);
    }else if(b.action==='shot')shoot(s,id,b,now);
    else if(b.action==='continue'){
      if(s.phase!=='hole-complete')fail('Finish this hole first.');if(!s.continue.includes(id))s.continue.push(id);s.revision++;if(s.continue.length===s.players.length){s.hole++;newHole(s,now);}
    }else if(b.action==='rematch'){
      if(s.phase!=='complete'||s.cancelled)fail('Complete this match first.');if(!s.rematch.includes(id))s.rematch.push(id);for(const p of s.players)if(p.bot&&!s.rematch.includes(p.id))s.rematch.push(p.id);s.revision++;
      if(s.rematch.length===s.players.length){s.match++;start(s,now);}
    }else if(b.action==='forfeit'){
      if(!['playing','hole-complete'].includes(s.phase))fail('No active match to concede.');s.forfeited=true;finish(s,s.players.length===1?'draw':1-s.players.findIndex(p=>p.id===id),'Opponent conceded.',now);
    }else if(b.action!=='get')fail('Unknown action.',400);
    return s;
  }
  function bot(s,now=Date.now()){
    advance(s,now);if(s.phase!=='playing'||!s.players[s.turn]?.bot||now<s.botAt||(s.lastShot&&!s.lastShot.resolved))return s;
    const shot=P.botShot(C.get(s.course).holes[s.hole],s.balls[s.turn].position,now);
    shoot(s,s.players[s.turn].id,{...shot,revision:s.revision,requestId:`bot-${s.match}-${s.revision}`},now);return s;
  }
  function publicState(s,id,now=Date.now()){
    const {finance,...v}=s;return {...v,you:s.players.findIndex(p=>p.id===String(id)),serverNow:now,wager:s.wager||0,settlement:finance?.status||'free',funding:!!finance?.pending?.length,payouts:finance?.status==='settled'?finance.payouts:{}};
  }
  return {create,join,start,act,bot,advance,publicState,fail,TURN_MS,STROKE_LIMIT};
});
