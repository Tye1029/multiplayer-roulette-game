import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {PGlite} from '@electric-sql/pglite';
const require=createRequire(import.meta.url);
const rules=require('../assets/yahtzee/rules');
const model=require('../netlify/functions/yahtzee/model');
const {createStore}=require('../netlify/functions/yahtzee/database');
const {createHandler}=require('../netlify/functions/yahtzee-action');
test('standard scoring, straights with duplicates, upper bonus and forced Jokers',()=>{
  assert.equal(rules.score([1,2,3,3,4],'small'),30);
  assert.equal(rules.score([2,3,4,5,6],'large'),40);
  assert.equal(rules.score([2,2,3,3,3],'house'),25);
  assert.equal(rules.score([6,6,6,6,6],'house'),0);
  assert.equal(rules.score([1,1,1,2,3],'three'),8);
  assert.equal(rules.score([6,6,6,6,5],'four'),29);
  assert.equal(rules.score([6,6,6,5,5],'four'),0);
  assert.equal(rules.score([6,6,6,6,6],'yahtzee'),50);
  assert.equal(rules.score([2,3,3,4,5],'large'),0);
  assert.deepEqual(rules.options([3,3,3,3,3],{yahtzee:50}),{threes:15});
  assert.equal(rules.options([3,3,3,3,3],{yahtzee:0,threes:9}).large,40);
  assert.equal(rules.totals({card:{ones:3,twos:6,threes:9,fours:12,fives:15,sixes:18},bonus:100}).total,198);
  const card=Object.fromEntries(rules.keys.slice(6).map(k=>[k,0]));card.threes=9;
  assert.deepEqual(Object.values(rules.options([3,3,3,3,3],card)),[0,0,0,0,0]);
});
test('game state rejects illegal moves, preserves held dice, awards repeated Yahtzees',()=>{
  const s=model.fresh('12345678',model.player('a','Ada'));s.players.push(model.player('b','Bea'));
  assert.throws(()=>model.act(s,'b',{action:'start'}));model.act(s,'a',{action:'start'});
  assert.throws(()=>model.act(s,'b',{action:'roll'}));assert.throws(()=>model.act(s,'a',{action:'score',category:'chance'}));
  model.act(s,'a',{action:'roll'},()=>6);model.act(s,'a',{action:'hold',index:0,held:true});
  model.act(s,'a',{action:'roll'},()=>2);assert.deepEqual(s.dice,[6,2,2,2,2]);
  model.act(s,'a',{action:'roll'},()=>2);assert.throws(()=>model.act(s,'a',{action:'roll'}));
  model.act(s,'a',{action:'score',category:'chance'});assert.equal(s.players[0].card.chance,14);assert.equal(s.active,1);
  s.active=0;s.players[0].card.yahtzee=50;model.act(s,'a',{action:'roll'},()=>6);
  assert.throws(()=>model.act(s,'a',{action:'score',category:'house'}));model.act(s,'a',{action:'score',category:'sixes'});assert.equal(s.players[0].bonus,100);
  const publicPlayer=model.publicState(s,'a').players[0];assert.equal(publicPlayer.yahtzeeBonus,100);assert.equal(publicPlayer.total,194);
});
test('database: identity isolation, concurrent joins, stale/replayed moves, full match, consensual rematch',async()=>{
  const pg=new PGlite();let tail=Promise.resolve();
  const pool={query:(s,a)=>pg.query(s,a),connect:async()=>{let release;const prior=tail;tail=new Promise(r=>release=r);await prior;return{query:(s,a)=>pg.query(s,a),release};}};
  const db=createStore(pool,()=>3);let seq=0;
  const tokens=['a','b','c','d','e'].map(x=>x.repeat(64));
  const run=(action,n,extra={})=>db.run({action,token:tokens[n],requestId:'test-action-'+String(++seq).padStart(8,'0'),...extra},'test');
  try{
    let s=await run('create',0,{name:'Ada'}),code=s.id;
    await assert.rejects(run('get',1,{room:code}),/Join/);
    const joins=await Promise.all([run('join',1,{room:code,name:'Bea'}),run('join',2,{room:code,name:'Cy'}),run('join',3,{room:code,name:'Dee'})]);
    s=joins.at(-1);assert.equal(s.players.length,4);await assert.rejects(run('join',4,{room:code,name:'Extra'}),/full/);
    await assert.rejects(run('start',1,{room:code,revision:s.revision}),/host/);
    s=await run('start',0,{room:code,revision:s.revision});
    const roll={action:'roll',token:tokens[0],room:code,revision:s.revision,requestId:'replayed-action-00001'};
    await db.run(roll);s=await db.run(roll);assert.equal(s.rolls,1);
    await assert.rejects(run('roll',0,{room:code,revision:roll.revision}),/changed/);
    for(let turn=0;turn<52;turn++){
      const n=s.active;if(!s.rolls)s=await run('roll',n,{room:code,revision:s.revision});
      const category=Object.keys(rules.options(s.dice,s.players[n].card))[0];
      s=await run('score',n,{room:code,revision:s.revision,category});
    }
    assert.equal(s.phase,'complete');assert.ok(s.players.every(p=>Object.keys(p.card).length===13));assert.equal(s.requests,undefined);
    const finalRevision=s.revision;
    for(let n=0;n<4;n++){s=await run('rematch',n,{room:code,revision:finalRevision,game:1});assert.equal(s.phase,n===3?'playing':'complete');}
    assert.equal(s.game,2);assert.equal(s.active,1);assert.equal(s.players[0].total,0);
    s=await run('leave',1,{room:code,revision:s.revision});assert.equal(s.phase,'closed');
    await assert.rejects(run('roll',0,{room:code,revision:s.revision}));
    await pg.query("UPDATE yahtzee_rooms SET state=jsonb_set(state,'{expiresAt}','0') WHERE id=$1",[code]);
    await assert.rejects(run('get',0,{room:code}),/expired/);
    const handler=createHandler(db);
    assert.equal((await handler(new Request('http://test',{method:'POST',body:'{}'}))).status,401);
    assert.equal((await handler(new Request('http://test',{method:'POST',body:'null'}))).status,400);
    assert.equal((await handler(new Request('http://test',{method:'GET'}))).status,405);
  }finally{await pg.close();}
});
