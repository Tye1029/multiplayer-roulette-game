/* POCKET_PUTT_V7 — turns, deadlines, scores and rematches belong to the server. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./mini-golf-courses'),require('./mini-golf-physics'));else root.PuttRules=factory(root.PuttCourses,root.PuttPhysics);})(globalThis,(C,P)=>{
  'use strict';
  const TURN_MS=60000,STROKE_LIMIT=12,CUP_FEEDBACK_MS=1600,COUNTDOWN_MS=3000,SUDDEN_LIMIT_MS=900000;
  const fail=(message,status=409)=>{throw Object.assign(Error(message),{status});};
  const person=p=>({id:String(p.id),name:String(p.name||'Player').slice(0,48),avatar:p.avatar||'',bot:!!p.bot,ballColor:p.ballColor||'pearl'});
  const finishedBall=b=>!!b&&(b.holed||b.capped);
  function nextPlayer(s,after){for(let n=1;n<=s.players.length;n++){const i=(after+n)%s.players.length;if(!finishedBall(s.balls[i]))return i;}return -1;}
  const holeFor=s=>s.suddenDeath?C.suddenHole(s.course):C.get(s.course).holes[s.hole];
  function create(id,player,course='garden',now=Date.now()){
    if(!C.get(course))fail('Choose an available course.',400);
    return {id,build:'POCKET_PUTT_V7',course,players:[person(player)],phase:'waiting',ready:[],rematch:[],match:1,revision:1,hole:0,turn:0,createdAt:now,deadline:now+900000,readyDeadline:null,balls:[],scores:[],stats:[],winner:null,lastShot:null};
  }
  function join(s,p,now=Date.now()){if(s.players.some(x=>x.id===String(p.id)))return;if(s.phase!=='waiting'||s.players.length!==1||now>=s.deadline)fail('This game is no longer open.');s.players.push(person(p));s.revision++;}
  function newHole(s,now){const h=C.get(s.course).holes[s.hole];s.balls=s.players.map(()=>({position:[...h.tee],strokes:0,holed:false,capped:false}));s.turn=s.hole%s.players.length;s.phase='playing';s.lastShot=null;s.turnEvent=null;s.holeReason='';s.continue=[];s.deadline=now+TURN_MS;s.botAt=now+1300;s.revision++;}
  function start(s,now){s.suddenDeath=false;s.suddenAttempt=0;s.shots=[];s.shotNumbers=[];s.suddenWinner=null;s.suddenFinishAt=null;s.suddenStartsAt=null;s.hole=0;s.scores=s.players.map(()=>[]);s.stats=s.players.map(()=>({aces:0,birdies:0,portals:0,banks:0,water:0}));s.holeResults=[];s.timedOut=false;s.rematch=[];s.ready=[];s.winner=null;s.reason='';s.cancelled=false;s.forfeited=false;newHole(s,now);}
  function finish(s,winner,reason,now){s.phase='complete';s.winner=winner;s.reason=reason;s.completedAt=now;s.deadline=null;s.revision++;}
  function suddenDeath(s,now){
    s.suddenDeath=true;s.suddenAttempt=(s.suddenAttempt||0)+1;s.hole=3;s.turn=null;s.phase='sudden-countdown';s.lastShot=null;s.turnEvent=null;
    s.balls=s.players.map(()=>({position:[...holeFor(s).tee],strokes:0,holed:false,capped:false}));s.shots=s.players.map(()=>null);s.shotNumbers=s.players.map(()=>0);
    s.suddenWinner=null;s.suddenFinishAt=null;s.suddenStartsAt=now+COUNTDOWN_MS;s.deadline=s.suddenStartsAt+SUDDEN_LIMIT_MS;s.botAt=s.suddenStartsAt+1400;s.revision++;
  }
  function advanceSudden(s,now){
    if(s.phase==='sudden-countdown'&&now>=s.suddenStartsAt){s.phase='sudden-death';s.revision++;}
    if(s.phase!=='sudden-death')return s;
    // Compare physical cup-arrival times, not request order or animation polling.
    const arrivals=s.shots.filter(shot=>shot?.holed).map(shot=>({player:shot.player,at:shot.startedAt+shot.events.find(e=>e.type==='cup').at})).filter(arrival=>arrival.at<=s.deadline).sort((a,b)=>a.at-b.at);
    if(s.suddenWinner===null&&arrivals.length&&arrivals[0].at<=now){
      if(arrivals[1]?.at===arrivals[0].at){suddenDeath(s,now);return s;}
      s.suddenWinner=arrivals[0].player;s.suddenFinishAt=arrivals[0].at+CUP_FEEDBACK_MS;s.revision++;
    }
    for(const shot of s.shots)if(shot&&!shot.resolved&&now>=shot.endsAt){shot.resolved=true;s.revision++;}
    if(s.suddenWinner!==null&&now>=s.suddenFinishAt){
      const winner=s.suddenWinner,ball=s.balls[winner];if(ball.strokes===1)s.stats[winner].aces++;if(ball.strokes<holeFor(s).par)s.stats[winner].birdies++;
      finish(s,winner,'First ball in the cup wins sudden death.',s.suddenFinishAt);
    }else if(s.suddenWinner===null&&now>=s.deadline){s.timedOut=true;finish(s,'draw','Sudden death expired after 15 minutes without a score.',s.deadline);}
    return s;
  }
  function completeHole(s,now){
    const par=C.get(s.course).holes[s.hole].par;
    s.balls.forEach((b,i)=>{s.scores[i].push(b.strokes);if(b.holed&&b.strokes===1)s.stats[i].aces++;if(b.holed&&b.strokes<par)s.stats[i].birdies++;});
    const strokes=s.balls.map(b=>b.strokes);s.holeResults||=[];s.holeResults.push({winner:strokes.length===1?0:strokes[0]===strokes[1]?'draw':strokes[0]<strokes[1]?0:1,reason:s.holeReason||'Lowest strokes wins the hole.'});
    if(s.hole===C.get(s.course).holes.length-1){const totals=s.scores.map(a=>a.reduce((x,y)=>x+y,0));if(totals.length===2&&totals[0]===totals[1])suddenDeath(s,now);else finish(s,totals.length===1?0:totals[0]<totals[1]?0:1,'Lowest total strokes wins.',now);}
    else{s.phase='hole-complete';s.continue=s.players.filter(p=>p.bot).map(p=>p.id);s.deadline=now+30000;s.revision++;}
  }
  function resolveShot(s,now){
    if(!s.lastShot||s.lastShot.resolved||now<s.lastShot.endsAt)return;
    // A late poll must not restart a player's clock or keep an abandoned stake alive.
    now=s.lastShot.endsAt;
    s.lastShot.resolved=true;
    if(s.balls.every(b=>b.holed||b.capped)){
      completeHole(s,now);
      return;
    }
    s.turn=nextPlayer(s,s.lastShot.player);s.deadline=now+TURN_MS;s.botAt=now+1400;s.revision++;
  }
  function advance(s,now=Date.now()){
    if(s.suddenDeath&&s.phase!=='complete')return advanceSudden(s,now);
    if(s.phase==='waiting'&&now>=s.deadline){s.cancelled=true;finish(s,'draw','The invitation expired.',now);}
    if(s.phase==='waiting'&&s.readyDeadline&&now>=s.readyDeadline){s.ready=[];s.readyDeadline=null;s.revision++;}
    // Deadlines are anchored to the expired turn, never extended by a late poll.
    // Fast-forward idle passes in O(1), so reconnecting after hours cannot hang.
    for(let i=0;i<=C.get(s.course).holes.length;i++){
      if(s.phase==='playing')resolveShot(s,now);
      // Recover an old/stale turn assignment without ever asking a sunk player
      // (including a bot) to shoot again. Keep the existing clock deadline.
      if(s.phase==='playing'&&(!s.lastShot||s.lastShot.resolved)&&finishedBall(s.balls[s.turn])){
        const next=nextPlayer(s,s.turn);if(next<0)completeHole(s,now);else{s.turn=next;s.revision++;}
      }
      if(s.phase==='playing'&&now>=s.deadline&&(!s.lastShot||s.lastShot.resolved)){
        const at=s.deadline,expired=s.turn,opponent=(expired+1)%s.players.length,other=s.balls[opponent];s.timedOut=true;
        if(opponent!==expired&&(other.holed||other.capped)){
          s.balls[expired].capped=true;s.balls[expired].conceded=true;s.balls[expired].strokes=STROKE_LIMIT+1;
          s.holeReason=`${s.players[expired].name}'s clock expired. ${s.players[opponent].name} wins this hole; the conceded hole scores 13.`;
          s.turnEvent={type:'conceded',player:expired,at};completeHole(s,at);
        }else{
          const passes=Math.floor((now-at)/TURN_MS)+1;s.turn=(expired+passes)%s.players.length;s.deadline=at+passes*TURN_MS;s.botAt=s.deadline-TURN_MS+1400;
          s.turnEvent={type:'timeout',player:(expired+passes-1)%s.players.length,at:s.deadline-TURN_MS};s.revision++;
        }
      }
      if(s.phase==='hole-complete'&&now>=s.deadline){const at=s.deadline;s.hole++;newHole(s,at);continue;}break;
    }
    return s;
  }
  function shoot(s,id,b,now){
    if(s.suddenDeath)return shootSudden(s,id,b,now);
    if(s.phase!=='playing'||s.players[s.turn]?.id!==id)fail('Wait for your turn.');
    if(s.lastShot&&!s.lastShot.resolved)fail('Wait for the ball to stop.');
    if(b.revision!==s.revision)fail('The game changed. Your shot was not taken; aim again.');
    if(typeof b.angle!=='number'||!Number.isFinite(b.angle)||Math.abs(b.angle)>Math.PI*4||typeof b.power!=='number'||!Number.isFinite(b.power)||b.power<0.025||b.power>1)fail('Invalid shot strength or direction.',400);
    const ball=s.balls[s.turn];if(ball.holed||ball.capped)fail('This ball has finished the hole.');
    const r=P.simulate(C.get(s.course).holes[s.hole],ball.position,b.angle,b.power,now);
    ball.position=r.position;ball.strokes=Math.min(STROKE_LIMIT,ball.strokes+1+r.penalty);ball.holed=r.holed;ball.capped=!r.holed&&ball.strokes>=STROKE_LIMIT;
    const stats=s.stats[s.turn];stats.portals+=Number(r.portalUsed);stats.banks+=r.events.filter(e=>e.type==='bank').length;stats.water+=r.penalty;
    s.lastShot={id:b.requestId,player:s.turn,...r,startedAt:now,endsAt:now+r.duration+(r.holed?CUP_FEEDBACK_MS+50:650),resolved:false};s.deadline=s.lastShot.endsAt+TURN_MS;s.revision++;
  }
  function shootSudden(s,id,b,now){
    const i=s.players.findIndex(p=>p.id===id);
    if(s.phase!=='sudden-death'||s.suddenWinner!==null)fail('Wait for the sudden-death countdown or result.');
    if(s.shots[i]&&!s.shots[i].resolved)fail('Wait for your ball to stop.');
    if(b.match!==s.match||b.hole!==3||b.suddenAttempt!==s.suddenAttempt||b.shotNumber!==s.shotNumbers[i])fail('The game changed. Your shot was not taken; aim again.');
    if(typeof b.angle!=='number'||!Number.isFinite(b.angle)||Math.abs(b.angle)>Math.PI*4||typeof b.power!=='number'||!Number.isFinite(b.power)||b.power<.025||b.power>1)fail('Invalid shot strength or direction.',400);
    const ball=s.balls[i];if(ball.holed)fail('This ball has finished the hole.');
    const r=P.simulate(holeFor(s),ball.position,b.angle,b.power,now);ball.position=r.position;ball.strokes+=1+r.penalty;ball.holed=r.holed;
    s.stats[i].banks+=r.events.filter(e=>e.type==='bank').length;s.stats[i].water+=r.penalty;
    s.shots[i]={id:b.requestId,player:i,...r,startedAt:now,endsAt:now+r.duration+(r.holed?CUP_FEEDBACK_MS+50:650),resolved:false};s.shotNumbers[i]++;s.revision++;
  }
  function act(s,id,b,now=Date.now()){
    id=String(id);if(!s.players.some(p=>p.id===id))fail('This game belongs to its players.',403);
    advance(s,now);
    // Retry-safe shot IDs also protect against a response lost after the commit.
    if(b.action==='shot'&&[s.lastShot,...(s.shots||[])].some(shot=>shot?.id===b.requestId&&s.players[shot.player]?.id===id))return s;
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
      if(!['playing','hole-complete','sudden-countdown','sudden-death'].includes(s.phase))fail('No active match to concede.');if(s.suddenWinner!==null&&s.suddenWinner!==undefined)fail('The winning ball is already in the cup.');s.forfeited=true;finish(s,s.players.length===1?'draw':1-s.players.findIndex(p=>p.id===id),s.players.find(p=>p.id===id).name+' conceded the match.',now);
    }else if(b.action!=='get')fail('Unknown action.',400);
    return s;
  }
  function bot(s,now=Date.now()){
    if(s.suddenDeath){advance(s,now);if(s.phase!=='sudden-death'||s.suddenWinner!==null||now<s.botAt)return s;for(let i=0;i<s.players.length;i++)if(s.players[i].bot&&!s.balls[i].holed&&(!s.shots[i]||s.shots[i].resolved)){
      if(s.shots[i]&&now<s.shots[i].endsAt+1400)continue;
      shootSudden(s,s.players[i].id,{...P.botShot(holeFor(s),s.balls[i].position,now),match:s.match,hole:3,suddenAttempt:s.suddenAttempt,shotNumber:s.shotNumbers[i],requestId:`bot-sudden-${s.match}-${s.suddenAttempt}-${s.shotNumbers[i]}`},now);
    }return s;}
    advance(s,now);if(s.phase!=='playing'||!s.players[s.turn]?.bot||now<s.botAt||(s.lastShot&&!s.lastShot.resolved))return s;
    const shot=P.botShot(C.get(s.course).holes[s.hole],s.balls[s.turn].position,now);
    shoot(s,s.players[s.turn].id,{...shot,revision:s.revision,requestId:`bot-${s.match}-${s.revision}`},now);return s;
  }
  function publicState(s,id,now=Date.now()){
    const {finance,...v}=s;return {...v,you:s.players.findIndex(p=>p.id===String(id)),serverNow:now,wager:s.wager||0,settlement:finance?.status||'free',funding:!!finance?.pending?.length,payouts:finance?.status==='settled'?finance.payouts:{}};
  }
  return {create,join,start,act,bot,advance,publicState,holeFor,fail,TURN_MS,STROKE_LIMIT,CUP_FEEDBACK_MS,COUNTDOWN_MS};
});
