import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {PGlite} from '@electric-sql/pglite';
const require=createRequire(import.meta.url),rules=require('../assets/yahtzee/rules'),model=require('../netlify/functions/yahtzee/model');
const {createStore}=require('../netlify/functions/yahtzee/database'),{createHandler}=require('../netlify/functions/yahtzee-action');
test('final tally includes each category and both bonuses exactly once',()=>{
  const card={ones:3,twos:6,threes:9,fours:12,fives:15,sixes:18,three:24,four:25,house:25,small:30,large:40,yahtzee:50,chance:22};
  const parts=rules.breakdown(card,200);assert.equal(parts.length,15);assert.equal(parts[6].key,'upper-bonus');assert.equal(parts[6].points,35);assert.equal(parts.at(-1).points,200);
  assert.equal(parts.reduce((n,p)=>n+p.points,0),rules.totals({card,bonus:200}).total);
  assert.equal(rules.breakdown({ones:0},0).reduce((n,p)=>n+p.points,0),0);
});
test('dice impacts and Yahtzee fanfare respect mute, unlock and lifecycle',()=>{
  const sounds=require('../assets/yahtzee/audio');let muted=true,created=0,impacts=0,tones=0,closed=0;
  const param=()=>({value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}}),node=()=>({connect(){return this;},disconnect(){}});
  const context={state:'running',currentTime:1,sampleRate:48000,destination:{},resume:async()=>{},suspend:async()=>{},close:async()=>{closed++;},createBuffer:(channels,n)=>({getChannelData:()=>new Float32Array(n)}),createGain:()=>({...node(),gain:param()}),createBiquadFilter:()=>({...node(),frequency:param(),Q:param()}),createBufferSource:()=>({...node(),start(){impacts++;}}),createOscillator:()=>({...node(),frequency:param(),start(){tones++;},stop(){}})};
  const audio=sounds.create(()=>{created++;return context;},()=>muted);
  audio.unlock();audio.play('roll');assert.equal(created,0);muted=false;audio.play('roll');assert.equal(impacts,0);
  audio.unlock();audio.play('roll');assert.equal(created,1);assert.equal(impacts,9);const before=tones;audio.play('yahtzee');assert.equal(tones-before,7);
  muted=true;audio.play('roll');audio.play('yahtzee');assert.equal(impacts,9);assert.equal(tones,before+7);audio.close();assert.equal(closed,1);
});
test('classic categories, straights, upper bonus, repeat Yahtzee and forced Joker placement',()=>{
  for(const [dice,key,points] of [[[1,2,3,3,4],'small',30],[[2,3,4,5,6],'large',40],[[2,2,3,3,3],'house',25],[[6,6,6,6,6],'house',0],[[1,1,1,2,3],'three',8],[[6,6,6,6,5],'four',29],[[6,6,6,5,5],'four',0],[[6,6,6,6,6],'yahtzee',50],[[2,3,3,4,5],'large',0]])assert.equal(rules.score(dice,key),points);
  assert.deepEqual(rules.options([3,3,3,3,3],{yahtzee:50}),{threes:15});
  assert.equal(rules.options([3,3,3,3,3],{yahtzee:0,threes:9}).large,40);
  assert.equal(rules.totals({card:{ones:3,twos:6,threes:9,fours:12,fives:15,sixes:18},bonus:100}).total,198);
  const card=Object.fromEntries(rules.keys.slice(6).map(k=>[k,0]));card.threes=9;assert.deepEqual(Object.values(rules.options([3,3,3,3,3],card)),[0,0,0,0,0]);
});
function match(now=1000){const s=model.fresh('12345678',model.player('1','Alpha'),now);s.players.push(model.player('2','Bravo'));model.act(s,'1',{action:'start'},()=>6,now-model.COUNTDOWN_MS);model.advance(s,now);return s;}
function move(s,id,action,extra={},now=1001,roll=()=>6){const p=s.players.find(p=>p.id===id);model.act(s,id,{action,game:s.game,round:s.round,inputVersion:p.inputVersion,...extra},roll,now);}
test('both players roll independently; holds survive two rerolls and scores stay locked',()=>{
  const s=match();assert.equal(s.deadline,31000);move(s,'1','roll');move(s,'2','roll',{},1001,()=>2);
  assert.deepEqual(s.players[0].dice,[6,6,6,6,6]);assert.deepEqual(s.players[1].dice,[2,2,2,2,2]);
  move(s,'1','hold',{index:0,held:true});move(s,'1','roll',{},1002,()=>3);assert.deepEqual(s.players[0].dice,[6,3,3,3,3]);
  move(s,'1','roll',{},1003,()=>4);assert.throws(()=>move(s,'1','roll'),/Choose a score/);
  move(s,'1','score',{category:'chance'});assert.equal(s.players[0].card.chance,22);assert.equal(s.phase,'playing');
  assert.throws(()=>move(s,'1','score',{category:'ones'}),/locked/);assert.throws(()=>move(s,'1','roll'),/locked/);
  move(s,'2','score',{category:'yahtzee'});assert.equal(s.phase,'between');model.advance(s,s.nextAt);
  assert.equal(s.round,2);assert.ok(s.players.every(p=>p.rolls===0&&!p.locked));assert.equal(s.players[0].card.chance,22);
});
test('exact deadline, automatic best score, no-roll zero, idle catch-up and no extra bonus awards',()=>{
  const s=match();s.round=2;move(s,'1','roll');const p=s.players[0];p.card.yahtzee=50;s.players[1].card.chance=10;
  assert.throws(()=>move(s,'1','roll',{},31000),/locked/);model.advance(s,31000);
  assert.equal(p.card.sixes,30);assert.equal(p.bonus,100);assert.equal(s.players[1].card.ones,0);assert.equal(s.phase,'between');
  model.advance(s,31000);assert.equal(p.bonus,100);assert.equal(p.last.automatic,true);
  model.advance(s,1000000);assert.equal(s.phase,'complete');assert.ok(s.players.every(p=>Object.keys(p.card).length===13));
});
test('test bot has visible paced rolls, runs to completion, rematches, and cannot be impersonated',()=>{
  const s=model.fresh('12345678',model.player('1','Alpha'),1000);model.act(s,'1',{action:'bot'},()=>4,1000);
  assert.equal(s.players.length,2);assert.equal(s.phase,'countdown');assert.equal(s.deadline,34000);
  assert.throws(()=>move(s,'1','roll',{},3999),/locked/);model.advance(s,3999);assert.equal(s.phase,'countdown');
  model.advance(s,4000);assert.equal(s.phase,'playing');model.advance(s,5299,()=>4);assert.equal(s.players[1].rolls,0);
  model.advance(s,5300,()=>4);assert.equal(s.players[1].rolls,1);assert.deepEqual(s.players[1].dice,[4,4,4,4,4]);
  assert.throws(()=>model.act(s,s.players[1].id,{action:'roll'}),/Join/);
  model.advance(s,1000000,()=>4);assert.equal(s.phase,'complete');assert.equal(s.players[1].card.yahtzee,50);
  assert.ok(s.finishedAt>0);model.act(s,'1',{action:'rematch',game:1},()=>4,1000001);assert.equal(s.game,2);assert.equal(s.phase,'countdown');assert.equal(s.players[0].bonus,0);assert.equal(s.finishedAt,0);
});
test('database transactions: verified identities, concurrent moves, replay, stale own inputs, deadlines, 13 rounds and rematch',async()=>{
  const pg=new PGlite();let tail=Promise.resolve(),now=Date.now(),seq=0;
  const pool={query:(s,a)=>pg.query(s,a),connect:async()=>{let release;const prior=tail;tail=new Promise(r=>release=r);await prior;return{query:(s,a)=>pg.query(s,a),release};}};
  const db=createStore(pool,()=>3,()=>now),people=[{id:'1',name:'Verified Alpha'},{id:'2',name:'Verified Bravo'},{id:'3',name:'Third'}];
  const run=(action,n,extra={})=>db.run({action,requestId:'request-'+String(++seq).padStart(12,'0'),...extra},people[n],'test');
  try{
    let s=await run('create',0,{name:'Spoofed'}),code=s.id;assert.equal(s.players[0].name,'Verified Alpha');
    const listed=await db.lobby(people[1]);assert.equal(listed[0].id,code);assert.equal(listed[0].mine,false);assert.equal(listed[0].creator,'Verified Alpha');assert.equal(Object.hasOwn(listed[0],'state'),false);
    assert.equal((await db.lobby(people[0]))[0].mine,true);await assert.rejects(db.lobby(null),/Connect/);
    await assert.rejects(run('get',1,{room:code}),/Join/);
    s=await run('join',1,{room:code});await assert.rejects(run('join',2,{room:code}),/full/);
    assert.equal((await db.lobby(people[2])).length,0);await assert.rejects(run('cancel',0,{room:code}),/empty waiting/);
    await assert.rejects(run('start',1,{room:code}),/host/);s=await run('start',0,{room:code});
    assert.equal(s.phase,'countdown');now=s.startAt;s=await run('get',0,{room:code});
    const body=(action,n,extra={})=>({action,room:code,game:s.game,round:s.round,inputVersion:s.players[n].inputVersion,requestId:'request-'+String(++seq).padStart(12,'0'),...extra});
    const a=body('roll',0),b=body('roll',1);
    await Promise.all([db.run(a,people[0]),db.run(b,people[1])]);s=await db.run(a,people[0]);assert.ok(s.players.every(p=>p.rolls===1));
    await assert.rejects(db.run({...a,requestId:'different-request-001'},people[0]),/dice changed/);
    assert.equal(s.requests,undefined);
    for(let round=1;round<=13;round++){
      for(let n=0;n<2;n++){
        if(!s.players[n].rolls)s=await db.run(body('roll',n),people[n]);
        const category=Object.keys(rules.options(s.players[n].dice,s.players[n].card))[0];
        s=await db.run(body('score',n,{category}),people[n]);
      }
      if(round<13){assert.equal(s.phase,'between');now=s.nextAt;s=await run('get',0,{room:code});}
    }
    assert.equal(s.phase,'complete');assert.ok(s.players.every(p=>Object.keys(p.card).length===13));
    const votes=await Promise.all([run('rematch',0,{room:code,game:1}),run('rematch',1,{room:code,game:1})]);s=votes.at(-1);
    assert.equal(s.game,2);assert.equal(s.phase,'countdown');now=s.startAt;s=await run('get',0,{room:code});
    const late=body('roll',0);now=s.deadline;await assert.rejects(db.run(late,people[0]),/locked/);
    s=await run('get',0,{room:code});assert.equal(s.phase,'between');assert.equal(s.players[0].card.ones,0);
    const handler=createHandler(db,{authenticate:async t=>t==='verified'?people[0]:null});
    assert.equal((await handler(new Request('http://test',{method:'POST',body:JSON.stringify({action:'profile',token:'made-up',id:'1',name:'Fake'})}))).status,401);
    const response=await handler(new Request('http://test',{method:'POST',body:JSON.stringify({action:'profile',token:'verified'})}));assert.equal((await response.json()).player.name,'Verified Alpha');
    assert.equal((await handler(new Request('http://test',{method:'GET'}))).status,405);
    await pg.query("UPDATE yahtzee_rooms SET state=jsonb_set(state,'{version}','1') WHERE id=$1",[code]);await assert.rejects(run('get',0,{room:code}),/old rules/);
    const empty=await run('create',2);await assert.rejects(run('cancel',1,{room:empty.id}),/Join/);await run('cancel',2,{room:empty.id});assert.equal((await db.lobby(people[0])).length,0);
  }finally{await pg.close();}
});
