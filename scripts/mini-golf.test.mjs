import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {PGlite} from '@electric-sql/pglite';
const require=createRequire(import.meta.url),C=require('../shared/games/mini-golf-courses'),P=require('../shared/games/mini-golf-physics'),M=require('../shared/games/mini-golf-model');
const {createStore}=require('../netlify/functions/mini-golf/database'),{createHandler}=require('../netlify/functions/mini-golf-action'),progress=require('../netlify/functions/site-hub/progression');
const a={id:'101',name:'Alice'},b={id:'202',name:'Bob'},uuid=()=>crypto.randomUUID();
function match(course='garden'){const s=M.create('ABCDEF123456',a,course,0);M.join(s,b,0);M.act(s,a.id,{action:'ready'},0);M.act(s,b.id,{action:'ready'},0);return s;}
function tied(){const s=match('clover');s.hole=2;s.scores=[[3,3],[3,3]];s.balls.forEach(ball=>Object.assign(ball,{holed:true,strokes:2}));s.lastShot={resolved:false,endsAt:10,player:1};M.advance(s,10);assert.equal(s.phase,'hole-complete');M.act(s,a.id,{action:'continue'},10);M.act(s,b.id,{action:'continue'},10);return s;}
const suddenShot=(s,i,extra={})=>({action:'shot',angle:-Math.PI/2,power:.16,revision:s.revision,match:s.match,hole:3,suddenAttempt:s.suddenAttempt,shotNumber:s.shotNumbers[i],requestId:uuid(),...extra});
test('a regulation tie opens hole four with an authoritative three-second countdown',()=>{
  const s=tied();assert.equal(s.phase,'sudden-countdown');assert.equal(s.hole,3);assert.equal(s.suddenStartsAt,3010);assert.deepEqual(s.scores,[[3,3,2],[3,3,2]]);assert.equal(M.holeFor(s).name,'The Decider');
  assert.throws(()=>M.act(s,a.id,suddenShot(s,0),3009),/countdown/);assert.equal(s.balls[0].strokes,0);M.advance(s,3010);assert.equal(s.phase,'sudden-death');assert.equal(s.winner,null);
});
test('sudden death accepts concurrent shots with independent sequences and resolves actual cup arrival, not request order',()=>{
  const s=tied(),at=s.suddenStartsAt;M.advance(s,at);s.balls[0].position=[360,215];s.balls[1].position=[360,185];
  const first=suddenShot(s,0,{power:.24}),second=suddenShot(s,1);M.act(s,a.id,first,at);M.act(s,b.id,second,at+1);
  assert.equal(s.shots.length,2);assert.ok(s.shots.every(shot=>shot.holed));assert.equal(s.balls[0].strokes,1);assert.equal(s.balls[1].strokes,1);
  const arrival=shot=>shot.startedAt+shot.events.find(e=>e.type==='cup').at;assert.ok(arrival(s.shots[1])<arrival(s.shots[0]));
  M.act(s,a.id,first,at+2);assert.equal(s.balls[0].strokes,1,'Retry remains idempotent after opponent shot');
  assert.throws(()=>M.act(s,a.id,suddenShot(s,0),at+3),/ball to stop/);
  M.advance(s,arrival(s.shots[1]));assert.equal(s.suddenWinner,1);assert.equal(s.phase,'sudden-death');
  assert.throws(()=>M.act(s,b.id,{action:'forfeit'},arrival(s.shots[1])+1),/already in the cup/);
  M.advance(s,s.suddenFinishAt);assert.equal(s.phase,'complete');assert.equal(s.winner,1);assert.deepEqual(s.scores,[[3,3,2],[3,3,2]]);
  const stats=structuredClone(s.stats);M.advance(s,s.suddenFinishAt+10000);assert.deepEqual(s.stats,stats);
  M.act(s,a.id,{action:'rematch'},at+10000);M.act(s,b.id,{action:'rematch'},at+10000);assert.equal(s.suddenDeath,false);assert.equal(s.hole,0);assert.deepEqual(s.shots,[]);assert.equal(s.turn,0);
});
test('sudden-death misses permit independent retries, reject stale attempts and replay exact dead heats',()=>{
  const s=tied(),at=s.suddenStartsAt;M.advance(s,at);const stale=suddenShot(s,0,{power:.025});M.act(s,a.id,stale,at);const end=s.shots[0].endsAt;M.advance(s,end);
  assert.throws(()=>M.act(s,a.id,{...stale,requestId:uuid()},end),/game changed/);assert.throws(()=>M.act(s,a.id,suddenShot(s,0,{power:NaN}),end),/Invalid/);
  s.balls[0].strokes=12;M.act(s,a.id,suddenShot(s,0,{power:.025}),end);assert.equal(s.balls[0].strokes,13);assert.equal(s.balls[0].capped,false);
  M.advance(s,s.shots[0].endsAt);s.balls.forEach(ball=>ball.position=[360,185]);const t=s.shots[0].endsAt,one=suddenShot(s,0),two=suddenShot(s,1);M.act(s,a.id,one,t);M.act(s,b.id,two,t);
  M.advance(s,Math.max(...s.shots.map(shot=>shot.endsAt)));assert.equal(s.phase,'sudden-countdown');assert.equal(s.suddenAttempt,2);assert.equal(s.winner,null);assert.ok(s.balls.every(ball=>ball.strokes===0));
  M.advance(s,s.suddenStartsAt);assert.throws(()=>M.act(s,a.id,{...one,requestId:uuid()},s.suddenStartsAt),/game changed/);
  M.advance(s,s.deadline);assert.equal(s.phase,'complete');assert.equal(s.winner,'draw');assert.ok(s.timedOut);
});
test('bot sudden death runs independently of the human and every themed decider is finishable',()=>{
  for(const c of C.courses){const h=C.suddenHole(c.id);let p=h.tee,r;for(let n=0;n<12;n++){const shot=P.botShot(h,p,0);r=P.simulate(h,p,shot.angle,shot.power,0);p=r.position;if(r.holed)break;}assert.ok(r.holed,c.id);}
  const s=tied();s.players[1].bot=true;let now=s.suddenStartsAt;M.advance(s,now);M.act(s,a.id,suddenShot(s,0,{power:.025}),now);
  for(let n=0;n<15&&s.phase!=='complete';n++){now+=5000;M.bot(s,now);}assert.equal(s.phase,'complete');assert.equal(s.winner,1);assert.equal(s.balls[0].strokes,1);
});
test('abandoned sudden-death expiry cannot change outcome depending on when someone polls',()=>{
  const s=tied(),at=s.suddenStartsAt;M.advance(s,at);s.balls[0].position=[360,185];s.deadline=at+50;
  M.act(s,a.id,suddenShot(s,0),at);const late=structuredClone(s);M.advance(s,s.deadline);M.advance(late,late.shots[0].endsAt+10000);
  assert.equal(s.winner,'draw');assert.equal(late.winner,'draw');assert.equal(s.completedAt,late.completedAt);
});
test('all 60 holes across 20 varied courses are reachable through legal deterministic shots',()=>{
  assert.equal(C.courses.length,20);assert.equal(C.holes.length,60);assert.equal(new Set(C.holes.map(h=>h.id)).size,60);assert.ok(C.courses.every(c=>c.holes.length===3&&c.difficulty));assert.equal(new Set(C.courses.map(c=>c.difficulty)).size,5);
  for(const h of C.holes){assert.ok(P.safe(h,h.tee));assert.ok(P.safe(h,h.cup));let p=h.tee,strokes=0,now=0,r;while(strokes<12){const shot=P.botShot(h,p,now);r=P.simulate(h,p,shot.angle,shot.power,now);assert.deepEqual(P.simulate(h,p,shot.angle,shot.power,now),r);assert.ok(P.safe(h,r.position));strokes+=1+r.penalty;p=r.position;now+=r.duration+1400;if(r.holed)break;}assert.ok(r.holed,h.id+' must be finishable');}
});
test('pullback strength, banks, sand, water penalties, hippo transport, and capture speed',()=>{
  const empty={tee:[150,570],cup:[560,140],floor:C.rect(50,50,620,620),walls:[],bumpers:[],sand:[]};
  const soft=P.simulate(empty,empty.tee,-Math.PI/2,.2),hard=P.simulate(empty,empty.tee,-Math.PI/2,.4);assert.ok(hard.position[1]<soft.position[1]-80);
  const sandy=P.simulate({...empty,sand:[{x:50,y:50,w:620,h:620}]},empty.tee,-Math.PI/2,.4);assert.ok(sandy.position[1]>hard.position[1]);
  const bank=P.simulate(empty,[100,300],Math.PI,.6);assert.ok(bank.events.some(e=>e.type==='bank'));assert.ok(bank.position[0]>100);
  const water=P.simulate({...empty,water:[{x:90,y:350,w:120,h:100}]},empty.tee,-Math.PI/2,.6);assert.equal(water.penalty,1);assert.deepEqual(water.position,empty.tee);
  const h=C.holes[3],mouth=h.portal.mouth,portal=P.simulate(h,[mouth[0],mouth[1]+60],-Math.PI/2,.25);assert.ok(portal.portalUsed);assert.ok(portal.events.some(e=>e.type==='pop'));assert.ok(portal.frames.some(f=>f[3]===0));assert.ok(portal.position[1]<300);
  const gentle=P.simulate(empty,[560,190],-Math.PI/2,.17);assert.ok(gentle.holed);const blast=P.simulate(empty,[560,190],-Math.PI/2,1);assert.ok(!blast.events.some(e=>e.type==='cup'&&e.at<100));
});
test('new courses use varied playable silhouettes and keep ramps a minority',()=>{
  const fresh=['meadow','canyon','brook','highland','switchback'].flatMap(id=>C.get(id).holes);
  assert.equal(fresh.length,15);assert.ok(fresh.every(h=>h.floor.length>4&&!h.ramps?.length));
  assert.equal(new Set(fresh.map(h=>JSON.stringify(h.floor))).size,15);
  assert.ok(C.courses.filter(c=>c.holes.some(h=>h.ramps?.length)).length<=3);
  assert.ok(C.holes.filter(h=>h.ramps?.length).length<=6);
  for(const feature of ['sand','water','terrain'])assert.ok(fresh.some(h=>h[feature].length)&&fresh.some(h=>!h[feature].length));
});
test('water penalties keep the unfinished player active after an opponent sinks, including bot and reconnect paths',()=>{
  for(const bot of [false,true])for(const shooter of [0,1]){
    const s=match('skybridge'),other=1-shooter;s.players[other].bot=bot;s.turn=other;
    s.balls[other].position=[510,205];
    M.act(s,s.players[other].id,{action:'shot',angle:-Math.PI/2,power:.16,revision:s.revision,requestId:uuid()},1);
    assert.equal(s.balls[other].holed,true);let now=s.lastShot.endsAt;M.advance(s,now);assert.equal(s.turn,shooter);
    const sunk=structuredClone(s.balls[other]);
    for(let n=0;n<2;n++){
      M.act(s,s.players[shooter].id,{action:'shot',angle:-Math.PI/2,power:.4,revision:s.revision,requestId:uuid()},++now);
      assert.equal(s.lastShot.penalty,1);now=s.lastShot.endsAt;M.bot(s,now);
      assert.equal(s.turn,shooter);assert.equal(s.balls[shooter].strokes,(n+1)*2);assert.deepEqual(s.balls[other],sunk);assert.equal(s.deadline,now+M.TURN_MS);
      const revision=s.revision;M.bot(s,now+1500);assert.equal(s.revision,revision,'Sunk bot must not play');
    }
    s.turn=other;M.advance(s,now+2000);assert.equal(s.turn,shooter,'Repair an old finished-player turn on reconnect');
    M.advance(s,s.deadline);assert.equal(s.phase,'hole-complete');assert.equal(s.holeResults[0].winner,other);
  }
});
test('hills slow uphill shots and bend downhill; divots pull inward with smooth, deterministic edges',()=>{
  const flat={floor:C.rect(20,20,680,680),cup:[650,100]},hill={x:360,y:330,rx:110,ry:110,height:12};
  const green={...flat,terrain:[hill]},bowl={...flat,terrain:[{...hill,height:-12}]};
  const straight=P.simulate(flat,[200,300],0,.45),raised=P.simulate(green,[200,300],0,.45),lowered=P.simulate(bowl,[200,300],0,.45);
  assert.ok(raised.position[1]<straight.position[1]-30,'Hill deflects away from its crest');
  assert.ok(lowered.position[1]>straight.position[1]+20,'Divot draws the shot toward its center');
  assert.ok(raised.position[0]<straight.position[0],'Uphill travel costs distance');
  assert.deepEqual(P.simulate(green,[200,300],0,.45),raised);
  assert.deepEqual(P.terrainAt(green,470,330),{height:0,ax:0,ay:0});
  assert.ok(Math.abs(P.terrainAt(green,469.999,330).ax)<.01,'No force discontinuity at the edge');
  assert.ok(P.terrainAt(green,400,330).ax>0);assert.ok(P.terrainAt(bowl,400,330).ax<0);
  const mirrored=P.simulate(green,[200,360],0,.45);assert.ok(Math.abs(mirrored.position[1]+raised.position[1]-660)<.01);
  assert.ok(C.holes.filter(h=>h.terrain.length).length>=20);for(const h of C.holes)for(const t of h.terrain){assert.ok(P.safe(h,[t.x,t.y]));assert.ok(t.rx>0&&t.ry>0);}
});
test('wall collision cannot tunnel or escape at maximum power across sampled shots',()=>{
  for(const h of C.holes)for(let i=0;i<40;i++){const r=P.simulate(h,h.tee,i*Math.PI/20,1,i*113);assert.ok(P.safe(h,r.position),h.id+' escaped at '+i);assert.ok(r.duration<=13000);assert.ok(r.position.every(Number.isFinite));}
});
test('online turn enforcement, stale requests, duplicate shots, and authoritative score',()=>{
  const s=match(),shot={action:'shot',angle:-Math.PI/2,power:.4,revision:s.revision,requestId:uuid(),position:[550,170],strokes:0,holed:true};
  assert.throws(()=>M.act(s,b.id,shot,1),/turn/);M.act(s,a.id,shot,1);assert.equal(s.balls[0].strokes,1);assert.equal(s.balls[0].holed,false);const rev=s.revision;M.act(s,a.id,shot,2);assert.equal(s.revision,rev);
  assert.throws(()=>M.act(s,a.id,{...shot,requestId:uuid(),revision:rev},2),/stop/);M.advance(s,s.lastShot.endsAt+1);assert.equal(s.turn,1);
  assert.throws(()=>M.act(s,b.id,{...shot,requestId:uuid()},s.lastShot.endsAt+2),/changed/);assert.throws(()=>M.act(s,'intruder',{action:'get'},3),/belongs/);
  for(const power of [-1,0,NaN,Infinity,1.01,'0.5'])assert.throws(()=>M.act(s,b.id,{...shot,revision:s.revision,requestId:uuid(),power},s.lastShot.endsAt+2),/Invalid/);
});
test('full three-hole duel, score totals, mutual rematch and reset',()=>{
  const s=match('lagoon');let now=10,shots=0;
  while(s.phase!=='complete'&&shots<80){if(s.phase==='hole-complete'){M.act(s,a.id,{action:'continue'},now);M.act(s,b.id,{action:'continue'},now);continue;}if(s.phase==='sudden-countdown'){now=s.suddenStartsAt;M.advance(s,now);continue;}const i=s.suddenDeath?0:s.turn,h=M.holeFor(s),shot=P.botShot(h,s.balls[i].position,now);M.act(s,s.players[i].id,{action:'shot',...shot,revision:s.revision,match:s.match,hole:s.hole,suddenAttempt:s.suddenAttempt,shotNumber:s.shotNumbers[i],requestId:uuid()},now);now=(s.suddenDeath?s.shots[i]:s.lastShot).endsAt+1;M.advance(s,now);shots++;}
  assert.equal(s.phase,'complete');assert.equal(s.scores[0].length,3);assert.equal(s.scores[1].length,3);assert.ok(s.scores.flat().every(n=>n>=1&&n<=12));M.act(s,a.id,{action:'rematch'},now);assert.equal(s.match,1);M.act(s,b.id,{action:'rematch'},now);assert.equal(s.match,2);assert.equal(s.hole,0);assert.deepEqual(s.scores,[[],[]]);assert.ok(s.balls.every(x=>x.strokes===0));
});
test('waiting cancellation, readiness timeout, shot timeout, caps, and next-course confirmation',()=>{
  const wait=M.create('ABCDEF123456',a,'garden',0);M.act(wait,a.id,{action:'cancel'},10);assert.ok(wait.cancelled);assert.equal(wait.winner,'draw');
  const ready=M.create('ABCDEF123456',a,'garden',0);M.join(ready,b,0);M.act(ready,a.id,{action:'ready'},0);M.advance(ready,60001);assert.deepEqual(ready.ready,[]);
  const timed=match();assert.equal(M.TURN_MS,60000);M.advance(timed,59999);assert.equal(timed.turn,0);M.advance(timed,60000);assert.equal(timed.phase,'playing');assert.equal(timed.turn,1);assert.equal(timed.balls[0].strokes,0);assert.equal(timed.deadline,120000);assert.equal(timed.turnEvent.type,'timeout');
  const late=match();M.act(late,a.id,{action:'shot',angle:0,power:.2,revision:late.revision,requestId:uuid()},1);const end=late.lastShot.endsAt;M.advance(late,end+M.TURN_MS+1);assert.equal(late.phase,'playing');assert.equal(late.turn,0,'Late polling skips the expired opponent turn');assert.equal(late.deadline,end+M.TURN_MS*2);
  const s=match();assert.throws(()=>M.act(s,a.id,{action:'cancel'},10),/before/);s.balls.forEach(ball=>ball.strokes=11);let now=1;for(const p of [a,b]){M.act(s,p.id,{action:'shot',angle:0,power:.025,revision:s.revision,requestId:uuid()},now);now=s.lastShot.endsAt+1;M.advance(s,now);}assert.equal(s.phase,'hole-complete');assert.deepEqual(s.scores,[[12],[12]]);M.advance(s,s.deadline+1);assert.equal(s.hole,0);assert.equal(s.winner,'draw');
});
test('timeout after opponent sinks awards only that hole, preserves totals, catches up and resets on rematch',()=>{
  const s=match();s.balls[1].holed=true;s.balls[1].strokes=2;M.advance(s,60000);assert.equal(s.phase,'hole-complete');assert.equal(s.holeResults[0].winner,1);assert.deepEqual(s.scores,[[13],[2]]);assert.ok(s.balls[0].conceded);assert.match(s.holeReason,/wins this hole/);
  const rev=s.revision;M.advance(s,60001);assert.equal(s.revision,rev);assert.equal(s.scores[0].length,1);
  M.advance(s,90000);assert.equal(s.hole,0);M.act(s,a.id,{action:'continue'},90000);M.act(s,b.id,{action:'continue'},90000);assert.equal(s.hole,1);assert.equal(s.turn,1);assert.equal(s.deadline,150000);assert.ok(s.balls.every(b=>b.strokes===0));
  const idle=match();M.advance(idle,60000*100001+1);assert.equal(idle.turn,1);assert.equal(idle.deadline,60000*100002);assert.equal(idle.phase,'playing');
  const final=match();final.hole=2;final.scores=[[4,4],[3,3]];final.balls[1].holed=true;final.balls[1].strokes=12;M.advance(final,60000);assert.equal(final.phase,'complete');assert.equal(final.winner,1);assert.deepEqual(final.scores,[[4,4,13],[3,3,12]]);assert.deepEqual(progress.outcomes('minigolf',final),[],'Timeout rounds do not farm achievement rewards');
  M.act(final,a.id,{action:'rematch'},60001);M.act(final,b.id,{action:'rematch'},60001);assert.equal(final.timedOut,false);assert.equal(final.deadline,120001);assert.deepEqual(final.holeResults,[]);
});
test('a sunk shot leaves time for the shared cup animation before passing the turn',()=>{
  const s=match();s.balls[0].position=[550,205];M.act(s,a.id,{action:'shot',angle:-Math.PI/2,power:.16,revision:s.revision,requestId:uuid()},10);assert.ok(s.lastShot.holed);assert.ok(s.lastShot.events.some(e=>e.type==='cup'));assert.equal(s.lastShot.endsAt-s.lastShot.startedAt-s.lastShot.duration,M.CUP_FEEDBACK_MS+50);M.advance(s,s.lastShot.endsAt-1);assert.equal(s.turn,0);M.advance(s,s.lastShot.endsAt);assert.equal(s.turn,1);
});
test('golf ball unlocks are server-checked, persistent per player, and shared with the opponent',async()=>{
  const pg=new PGlite();let tail=Promise.resolve();const pool={query:(q,args)=>pg.query(q,args),connect:async()=>{let release;const before=tail;tail=new Promise(r=>release=r);await before;return {query:(q,args)=>pg.query(q,args),release};}};
  const ledger=new Map(),wallet={account:async p=>p.id,rate:async()=>3.3,apply:async(id,e)=>{ledger.set(e.id,e.delta);},award:async(id,e)=>{ledger.set(e.id,e.delta);}};
  const progression=progress.createStore(pool,wallet),db=createStore(pool,wallet,progression);
  try{
    await assert.rejects(progression.preferences(a,{golfBall:'gold'}),/still locked/);await assert.rejects(progression.preferences(a,{golfBall:'<script>'}),/still locked/);
    const won=match();won.phase='complete';won.wager=10000;won.winner=0;won.completedAt=100;won.scores=[[2,2,2],[3,3,3]];await progression.observe('minigolf',won);const profile=await progression.profile(a);assert.ok(profile.achievements.minigolf.find(x=>x.id==='wins-1').unlocked);
    await progression.preferences(a,{golfBall:'coral',character:'lyra'});assert.equal((await progression.profile(a)).settings.golfBall,'coral');assert.equal((await progression.profile(a)).settings.character,'lyra');
    let s=await db.create({...a,ballColor:'gold'},{course:'clover',wager:0,requestId:uuid()});assert.equal(s.players[0].ballColor,'coral','Request identity cannot bypass the equipped profile');s=await db.action(s.id,b,{action:'join',wager:0,ballColor:'gold'});assert.equal(s.players[1].ballColor,'pearl');assert.equal(M.publicState(s,b.id).players[0].ballColor,'coral');
    await assert.rejects(db.action(s.id,b,{action:'color',ballColor:'coral'}),/still locked/);await assert.rejects(db.action(s.id,{id:'303'},{action:'color',ballColor:'pearl'}),/belongs/);
    s=await db.action(s.id,a,{action:'color',ballColor:'pearl'});assert.equal(s.players[0].ballColor,'pearl');assert.equal((await progression.profile(a)).settings.golfBall,'pearl');
    s=await db.action(s.id,a,{action:'color',ballColor:'coral'});await db.action(s.id,a,{action:'ready'});await db.action(s.id,b,{action:'ready'});s=await db.action(s.id,b,{action:'forfeit'});await db.action(s.id,a,{action:'rematch',wager:0});s=await db.action(s.id,b,{action:'rematch',wager:0});assert.equal(s.players[0].ballColor,'coral','Rematch keeps each player’s ball');
    const newSession=await db.create({...a,name:'Same player, refreshed key'},{course:'garden',wager:0,requestId:uuid()});assert.equal(newSession.players[0].ballColor,'coral');await progression.observe('minigolf',won);await progression.profile(a);assert.equal(ledger.size,1,'Cosmetics never duplicate achievement rewards');
  }finally{await pg.close();}
});
test('authenticated HTTP boundary rejects malformed and oversized requests and server score cannot be supplied',async()=>{
  const s=match();let called=0;const handler=createHandler({action:async(id,p,body)=>{called++;M.act(s,p.id,body,10);return s;}},{authenticate:async token=>token==='valid'?a:null});
  const req=body=>handler(new Request('http://test',{method:'POST',body:typeof body==='string'?body:JSON.stringify(body)}));
  assert.equal((await req('{')).status,400);assert.equal((await req('x'.repeat(9000))).status,413);assert.equal((await req({action:'get',gameId:s.id,token:'bad'})).status,401);assert.equal(called,0);
  assert.equal((await req({action:'shot',gameId:s.id,token:'valid',power:.2,angle:0})).status,400);
  const response=await req({action:'shot',gameId:s.id,token:'valid',requestId:uuid(),power:.2,angle:0,revision:s.revision,strokes:0,winner:0});assert.equal(response.status,200);const pub=(await response.json()).game;assert.equal(pub.balls[0].strokes,1);assert.equal(pub.winner,null);assert.ok(!('finance' in pub));
});
test('SQL store: private/public discovery, owner-only access, atomic duplicate shots, stakes, refunds, and rematch recovery',async()=>{
  const pg=new PGlite();let tail=Promise.resolve();const pool={query:(q,a)=>pg.query(q,a),connect:async()=>{let release;const prev=tail;tail=new Promise(r=>release=r);await prev;return {query:(q,a)=>pg.query(q,a),release};}};
  const balances=new Map([[a.id,100000],[b.id,100000]]),ledger=new Map();let failAfterWrite=false;
  const wallet={account:async p=>p.id,rate:async()=>3.3,apply:async(id,e)=>{if(ledger.has(e.id))return;const amount=balances.get(id)+e.delta;if(amount<0)throw Object.assign(Error('Not enough Chips'),{code:'RPS_FUNDS'});balances.set(id,amount);ledger.set(e.id,e);if(failAfterWrite){failAfterWrite=false;throw Error('response lost');}}};
  const db=createStore(pool,wallet),write=s=>pg.query('UPDATE mini_golf_matches SET state=$2::jsonb WHERE id=$1',[s.id,JSON.stringify(s)]);
  try{
    const requestId=uuid();let s=await db.create(a,{requestId,course:'garden',wager:10000});assert.equal(balances.get(a.id),90000);assert.equal((await db.create(a,{requestId,course:'garden',wager:10000})).id,s.id);assert.equal(balances.get(a.id),90000);
    assert.equal((await db.lobby(b))[0].id,s.id);const secret=await db.create(a,{requestId:uuid(),course:'lagoon',wager:0,private:true});assert.ok(!(await db.lobby(b)).some(x=>x.id===secret.id));
    await assert.rejects(db.action(s.id,b,{action:'get'}),/belongs/);await assert.rejects(db.action(s.id,b,{action:'join',wager:0}),/accept/);s=await db.action(s.id,b,{action:'join',wager:10000});assert.equal(balances.get(b.id),90000);
    await db.action(s.id,a,{action:'ready'});s=await db.action(s.id,b,{action:'ready'});assert.equal(s.phase,'playing');await assert.rejects(db.action(s.id,a,{action:'cancel'}),/before/);
    const shot={action:'shot',requestId:uuid(),revision:s.revision,power:.3,angle:0};const both=await Promise.all([db.action(s.id,a,shot),db.action(s.id,a,shot)]);assert.ok(both.every(v=>v.balls[0].strokes===1));
    s=await db.recover(s.id);s.phase='complete';s.winner=0;s.completedAt=Date.now();s.scores=[[2,2,2],[3,3,3]];await write(s);failAfterWrite=true;await assert.rejects(db.recover(s.id),/response lost/);s=await db.recover(s.id);assert.equal(balances.get(a.id),109340);assert.equal(s.finance.status,'settled');await db.recover(s.id);assert.equal(balances.get(a.id),109340);
    await db.action(s.id,a,{action:'rematch',wager:10000});s=await db.action(s.id,b,{action:'rematch',wager:10000});assert.equal(s.match,2);assert.equal(s.phase,'playing');assert.equal(balances.get(a.id),99340);assert.equal(balances.get(b.id),80000);
    const cancelled=await db.create(a,{requestId:uuid(),course:'garden',wager:10000});await db.action(cancelled.id,a,{action:'cancel'});await db.recover(cancelled.id);assert.equal(balances.get(a.id),99340);
    s.balls.forEach(ball=>Object.assign(ball,{holed:true,strokes:2}));s.lastShot=null;M.advance(s,Date.now());assert.equal(s.phase,'hole-complete');s.deadline=Date.now()-1;await write(s);
    s=await db.recover(s.id);assert.equal(s.winner,'draw');assert.equal(s.finance.status,'settled');assert.equal(balances.get(a.id),109340);assert.equal(balances.get(b.id),90000);const refunded=[...balances];await db.recover(s.id);assert.deepEqual([...balances],refunded,'Both idle refunds each stake exactly once');
    assert.equal(progress.catalog('minigolf').slice(0,8).reduce((n,x)=>n+x.reward,0),1000000);assert.equal(progress.catalog('minigolf')[0].target,1);
  }finally{await pg.close();}
});


test('course menu progresses from beginner to expert',()=>{
  const levels=['Beginner','Easy','Intermediate','Challenging','Expert'];
  const ranks=C.courses.map(c=>levels.indexOf(c.difficulty));
  assert.deepEqual(ranks,[...ranks].sort((a,b)=>a-b));assert.equal(C.courses[0].id,'clover');assert.equal(C.courses.at(-1).id,'masters');
});

test('shot playback remains continuous across delayed, duplicate and resolved polls',()=>{
  const clock=require('../assets/mini-golf/playback').create();
  const s={id:'game',match:1,hole:0,serverNow:100100,lastShot:{id:'shot',startedAt:100000}};
  clock.accept(s,10);assert.equal(clock.elapsed(10),100);
  for(const [localTime,serverNow] of [[100,100110],[800,100150],[1000,102000],[1500,100200]]){
    const before=clock.elapsed(localTime);clock.accept({...s,serverNow},localTime);assert.equal(clock.elapsed(localTime),before,'Polling must never rewind, freeze or jump a shot');
  }
  clock.accept({...s,lastShot:{...s.lastShot,resolved:true}},1800);assert.equal(clock.elapsed(2000),2090);
  clock.accept({...s,match:2,serverNow:100050},2100);assert.equal(clock.elapsed(2100),50);
  clock.reset();clock.accept(s,3000);assert.equal(clock.elapsed(3016),116);
});

test('all courses create and cancel with the production wallet; golf stakes, winnings and rematches remain idempotent',async()=>{
  const pg=new PGlite();let tail=Promise.resolve();const pool={query:(q,a)=>pg.query(q,a),connect:async()=>{let release;const prev=tail;tail=new Promise(r=>release=r);await prev;return {query:(q,a)=>pg.query(q,a),release};}};
  const records=new Map([a,b].map(p=>['user/'+p.id+'.json',{balanceUnit:'tickets',ledgerStartedAt:'2026-01-01',balanceBaseline:100000,financialLedger:[]}]));let version=1;
  const blobs={get:async key=>structuredClone(records.get(key)||null),getWithMetadata:async key=>({data:structuredClone(records.get(key)),etag:String(version)}),set:async(key,value,options)=>{if(options.onlyIfMatch!==String(version))return {modified:false};records.set(key,JSON.parse(value));version++;return {modified:true};}};
  const wallet=require('../netlify/functions/rps/wallet').createWallet(blobs,async()=>({multiplayer:{houseCutPercent:3.3}})),db=createStore(pool,wallet);
  try{
    for(const course of C.courses){const requestId=uuid(),s=await db.create(a,{course:course.id,wager:10000,requestId});assert.equal(s.phase,'waiting');assert.equal(s.finance.status,'reserved');assert.equal(await wallet.balance(a),90000);assert.equal((await db.create(a,{course:course.id,wager:10000,requestId})).id,s.id);await db.action(s.id,a,{action:'cancel'});assert.equal(await wallet.balance(a),100000);}
    let s=await db.create(a,{course:'clover',wager:10000,requestId:uuid()});await db.action(s.id,b,{action:'join',wager:10000});await db.action(s.id,a,{action:'ready'});await db.action(s.id,b,{action:'ready'});s=await db.action(s.id,b,{action:'forfeit'});assert.equal(s.finance.status,'settled');assert.equal(await wallet.balance(a),109340);assert.equal(await wallet.balance(b),90000);await db.recover(s.id);assert.equal(await wallet.balance(a),109340);
    await db.action(s.id,a,{action:'rematch',wager:10000});s=await db.action(s.id,b,{action:'rematch',wager:10000});assert.equal(s.match,2);assert.equal(await wallet.balance(a),99340);assert.equal(await wallet.balance(b),80000);
    await assert.rejects(wallet.apply(a.id,{id:'unknown:ABCDEF123456:stake:101',delta:-1000}),/Invalid wallet/);
    await assert.rejects(wallet.apply(a.id,{id:'minigolf:bad:stake:101',delta:-1000}),/Invalid wallet/);
  }finally{await pg.close();}
});


test('ramps reward controlled power, punish short/long landings, and preserve authoritative flight',()=>{
  const h=C.get('skybridge').holes[0],shot=power=>P.simulate(h,h.tee,-Math.PI/2,power,1234);
  const short=shot(.4),good=shot(.5),hard=shot(.55),wild=shot(.8);
  assert.equal(short.penalty,1);assert.equal(good.penalty,0);assert.equal(wild.penalty,1);
  assert.ok(!h.sand.some(s=>good.position[0]>s.x&&good.position[0]<s.x+s.w&&good.position[1]>s.y&&good.position[1]<s.y+s.h),'Controlled landing stays on the green');
  assert.ok(h.sand.some(s=>hard.position[0]>s.x&&hard.position[0]<s.x+s.w&&hard.position[1]>s.y&&hard.position[1]<s.y+s.h),'Overpowered landing reaches the bunker');
  assert.ok(good.events.some(e=>e.type==='launch'));assert.ok(good.events.some(e=>e.type==='land'));assert.ok(good.frames.some(f=>f[4]>30));assert.equal(good.frames.at(-1)[4],0);assert.deepEqual(shot(.5),good);
  const reverse=P.simulate(h,[260,405],Math.PI/2,.2);assert.ok(!reverse.events.some(e=>e.type==='launch'),'Ramps launch only from the rising side');
  const flat={...h,water:[],sand:[],ramps:[]},belt={...flat,conveyors:[{x:100,y:100,w:500,h:500,angle:0,force:240}]};assert.ok(P.simulate(belt,[200,500],-Math.PI/2,.2).position[0]>P.simulate(flat,[200,500],-Math.PI/2,.2).position[0]+50);
  const s=match('skybridge');M.act(s,a.id,{action:'shot',requestId:uuid(),angle:-Math.PI/2,power:.5,revision:s.revision},1234);assert.ok(M.publicState(s,b.id,1234).lastShot.frames.some(f=>f[4]>30));
});

test('opponent view contrasts every ball pairing without changing saved choices or unlocking colors',()=>{
  const B=require('../shared/games/mini-golf-cosmetics');
  for(const a of B.colors)for(const b of B.colors){const ids=[a.id,b.id];for(const you of [0,1]){const shown=B.display(ids,you);assert.equal(shown[you],ids[you]);assert.notEqual(shown[0],shown[1]);assert.deepEqual(ids,[a.id,b.id]);}}
  assert.equal(B.available('obsidian',[]),false);assert.deepEqual(B.display(['pearl','pearl'],-1),['pearl','pearl']);
});

test('next-course consent has a fixed 60-second deadline, forfeits only the non-ready player, and never farms awards',()=>{
  function intermission(bot=false){const s=match();s.players[1].bot=bot;s.balls.forEach(b=>Object.assign(b,{holed:true,strokes:2}));M.advance(s,10);assert.equal(s.deadline,60010);return s;}
  for(const ready of [0,1]){const s=intermission();M.act(s,s.players[ready].id,{action:'continue'},100);const revision=s.revision;M.advance(s,60009);assert.equal(s.phase,'hole-complete');assert.equal(s.revision,revision);M.advance(s,60010);assert.equal(s.winner,ready);assert.equal(s.hole,0);assert.ok(s.timedOut);assert.deepEqual(progress.outcomes('minigolf',s),[]);assert.throws(()=>M.act(s,s.players[1-ready].id,{action:'continue'},60011),/Finish/);const snapshot=structuredClone(s);M.advance(s,999999);assert.deepEqual(s,snapshot);}
  const none=intermission();M.advance(none,60010);assert.equal(none.winner,'draw');
  const both=intermission();M.act(both,a.id,{action:'continue'},60008);M.act(both,b.id,{action:'continue'},60009);assert.equal(both.hole,1);assert.equal(both.phase,'playing');assert.equal(both.deadline,120009);
  const late=intermission();M.act(late,a.id,{action:'continue'},60009);assert.throws(()=>M.act(late,b.id,{action:'continue'},60010),/Finish/);assert.equal(late.winner,0);
  const bot=intermission(true);assert.deepEqual(bot.continue,[b.id]);M.advance(bot,60010);assert.equal(bot.winner,1);
  const solo=M.create('SOLO',a,'clover',0);M.start(solo,0);solo.balls[0].holed=true;solo.balls[0].strokes=1;M.advance(solo,10);M.act(solo,a.id,{action:'continue'},11);assert.equal(solo.hole,1);
});
test('every hippo chute follows its visible route and exits safely in the advertised direction',()=>{
  for(const h of C.holes.filter(h=>h.portal)){const p=h.portal;assert.deepEqual(P.portalPoint(h,1),p.exit);assert.ok(P.safe(h,p.exit),h.id);const r=P.simulate(h,[p.mouth[0],p.mouth[1]+45],-Math.PI/2,.24);assert.ok(r.portalUsed,h.id);assert.equal(r.penalty,0,h.id+' must not dump the ball in water');const gulp=r.events.find(e=>e.type==='gulp'),pop=r.events.find(e=>e.type==='pop');assert.deepEqual([pop.x,pop.y],p.exit);const journey=r.frames.filter(f=>f[0]>gulp.at+400&&f[0]<pop.at-50);assert.ok(journey.length>10&&journey.every(f=>f[3]===1),h.id+' has a visible journey');assert.ok(new Set(journey.map(f=>f[1]+','+f[2])).size>10);}
});

test('a late hippo entry completes transport even at the simulation limit',()=>{const h={floor:C.rect(20,20,680,680),cup:[650,650],portal:{mouth:[100,290],exit:[580,100],angle:0},conveyors:[{x:50,y:50,w:600,h:600,angle:-Math.PI/2,force:155}]};const r=P.simulate(h,[100,550],-Math.PI/2,.03);assert.ok(r.portalUsed);assert.ok(r.events.some(e=>e.type==='pop'));assert.deepEqual(r.position,h.portal.exit);assert.ok(P.safe(h,r.position));});
