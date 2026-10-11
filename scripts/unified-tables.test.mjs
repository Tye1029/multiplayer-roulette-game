import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {PGlite} from '@electric-sql/pglite';
const require=createRequire(import.meta.url);
const bluff=require('../netlify/functions/bluff/database');
const dice=require('../netlify/functions/yahtzee/database');
const people=[{id:'11',name:'Alice'},{id:'22',name:'Bob'},{id:'33',name:'Carol'}];
function fixture(){
  const pg=new PGlite();let tail=Promise.resolve(),lost=false;
  const pool={query:(s,a)=>pg.query(s,a),connect:async()=>{let release;const before=tail;tail=new Promise(r=>release=r);await before;return{query:(s,a)=>pg.query(s,a),release};}};
  const balances=new Map(people.map(p=>[p.id,10000])),ledger=new Map();
  const wallet={account:async p=>p.id,rate:async()=>3.3,apply:async(id,e)=>{if(ledger.has(e.id))return balances.get(id);if(balances.get(id)+e.delta<0)throw Object.assign(new Error('Not enough Chips'),{code:'RPS_FUNDS',status:409});balances.set(id,balances.get(id)+e.delta);ledger.set(e.id,e);if(lost){lost=false;throw Error('Wallet response lost');}return balances.get(id);}};
  return {pg,pool,wallet,balances,ledger,loseResponse(){lost=true;}};
}
test('insufficient creation funds leave no playable or public table and no debit',async()=>{
  const f=fixture();f.balances.set('11',0);
  const b=bluff.createStore(f.pool,f.wallet),y=dice.createStore(f.pool,undefined,Date.now,f.wallet);
  try{
    await assert.rejects(b.create(people[0],{wager:1000,requestId:'a'.repeat(24)}),/Not enough/);
    await assert.rejects(y.run({action:'create',wager:1000,requestId:'a'.repeat(24)},people[0]),/Not enough/);
    assert.equal((await b.lobby(people[1])).length,0);assert.equal((await y.lobby(people[1])).length,0);assert.equal(f.ledger.size,0);
  }finally{await f.pg.close();}
});
test('Bluff public/private discovery, funding retry, explicit wager consent, settlement and newly funded rematches',async()=>{
  const f=fixture(),db=bluff.createStore(f.pool,f.wallet);let n=0;
  const create=(privateGame=false)=>db.create(people[0],{wager:1000,private:privateGame,requestId:('a'+(++n)).padEnd(24,'0')});
  const act=(s,p,action,more={})=>db.action(s.id,people[p],{action,match:s.match,round:s.round,...more});
  try{
    f.loseResponse();await assert.rejects(create(),/lost/);
    const row=(await f.pg.query('SELECT state FROM bluff_matches')).rows[0].state;
    let s=await db.recover(row.id);assert.equal(f.balances.get('11'),9000);assert.equal(s.finance.paid.length,1);
    assert.equal((await db.lobby(people[1]))[0].id,s.id);
    await assert.rejects(act(s,1,'join',{wager:2000}),/accept/);assert.equal(f.balances.get('22'),10000);
    s=await act(s,1,'join',{wager:1000});assert.equal(f.balances.get('22'),9000);
    await assert.rejects(act(s,0,'add-bot'),/0 Chips/);
    await act(s,0,'ready');s=await act(s,1,'ready');
    // Force known genuine cards to exercise the actual resolve/transfer rules.
    s.hands.flat().forEach(c=>c.suit=s.target);await f.pg.query('UPDATE bluff_matches SET state=$2::jsonb WHERE id=$1',[s.id,JSON.stringify(s)]);
    await act(s,0,'play',{cards:s.hands[0].map(c=>c.id)});s=await act(s,1,'play',{cards:s.hands[1].map(c=>c.id)});
    await act(s,0,'decide',{choice:'call'});s=await act(s,1,'decide',{choice:'believe'});assert.equal(s.pendingWinner,1);
    s.deadline=0;await f.pg.query('UPDATE bluff_matches SET state=$2::jsonb WHERE id=$1',[s.id,JSON.stringify(s)]);
    f.loseResponse();await assert.rejects(act(s,0,'get'),/lost/);s=await act(s,0,'get');
    assert.equal(s.finance.status,'settled');assert.equal(s.finance.payouts['22'],1934);assert.equal(f.balances.get('22'),10934);
    await act(s,0,'get');assert.equal(f.balances.get('22'),10934);
    await assert.rejects(act(s,0,'rematch',{wager:2000}),/accept/);
    await act(s,0,'rematch',{wager:1000});s=await act(s,1,'rematch',{wager:1000});assert.equal(s.match,2);assert.equal(s.phase,'select');
    assert.equal(f.balances.get('11'),8000);assert.equal(f.balances.get('22'),9934);assert.equal([...f.ledger.values()].filter(e=>e.delta===-1000).length,4);
    s=await act(s,1,'leave');assert.equal(s.finance.payouts['11'],1934);assert.equal(f.balances.get('11'),9934);
    let privateTable=await create(true);assert.equal((await db.lobby(people[1])).some(g=>g.id===privateTable.id),false);assert.equal((await db.quote(privateTable.id)).wager,1000);
    await act(privateTable,0,'leave');assert.equal(f.balances.get('11'),9934);
  }finally{await f.pg.close();}
});
test('Yahtzee reserves both stakes, pays out the first game and rematch, excludes private games and refunds failed rematches',async()=>{
  const f=fixture();let now=Date.now(),seq=0;const db=dice.createStore(f.pool,()=>6,()=>now,f.wallet);
  const run=(p,action,more={})=>db.run({action,requestId:'request-'+String(++seq).padStart(16,'0'),...more},people[p]);
  try{
    let s=await run(0,'create',{wager:1000,private:true});const id=s.id;
    assert.equal((await db.lobby(people[1])).length,0);assert.equal((await db.quote(id)).wager,1000);
    await assert.rejects(run(1,'join',{room:id,wager:2000}),/accept/);s=await run(1,'join',{room:id,wager:1000});
    assert.equal(s.finance,undefined);assert.equal(s.settlement,'reserved');assert.equal(f.balances.get('11'),9000);assert.equal(f.balances.get('22'),9000);
    async function complete(winner){const raw=(await f.pg.query('SELECT state FROM yahtzee_rooms WHERE id=$1',[id])).rows[0].state;raw.phase='complete';raw.finishedAt=now;raw.players[winner].card={chance:30};raw.players[1-winner].card={chance:10};await f.pg.query('UPDATE yahtzee_rooms SET state=$2::jsonb WHERE id=$1',[id,JSON.stringify(raw)]);return run(0,'get',{room:id});}
    s=await complete(0);assert.equal(s.payouts['11'],1934);assert.equal(f.balances.get('11'),10934);
    await run(0,'rematch',{room:id,game:1,wager:1000});s=await run(1,'rematch',{room:id,game:1,wager:1000});
    assert.equal(s.game,2);assert.equal(s.phase,'countdown');assert.equal(f.balances.get('11'),9934);assert.equal(f.balances.get('22'),8000);
    s=await complete(1);assert.equal(f.balances.get('22'),9934);
    f.balances.set('22',0);await run(0,'rematch',{room:id,game:2,wager:1000});s=await run(1,'rematch',{room:id,game:2,wager:1000});
    assert.equal(s.settlement,'settled');assert.equal(f.balances.get('11'),9934);assert.equal(f.balances.get('22'),0);assert.match(s.reason,/Not enough/);
  }finally{await f.pg.close();}
});
test('RPS and four-player private rooms stay off discovery; four-player rematches reserve and settle a new pot',async()=>{
  const f=fixture(),rps=require('../netlify/functions/rps/database').createStore(f.pool,f.wallet),four=require('../netlify/functions/roulette-four/database').createStore(f.pool,f.wallet);
  const players=[...people,{id:'44',name:'Dee'}];f.balances.set('44',10000);
  try{
    const duel=await rps.create(people[0],false,null,1000,true);
    assert.equal((await rps.lobby(people[1])).length,0);assert.equal((await rps.quote(duel.id,people[1])).wager,1000);
    await rps.act(duel.id,people[0],'leave');
    let s=await four.create(people[0],{wager:1000,private:true,requestId:'abcd'.repeat(6)});
    assert.equal((await four.lobby(people[1])).games.length,0);
    for(const p of players.slice(1))s=await four.action(s.id,p,{action:'join',wager:1000});
    const finish=async state=>{
      state.startAt=0;state.deadline=Date.now()+60000;state.bullet=1;
      await f.pg.query('UPDATE roulette_four_matches SET state=$2::jsonb WHERE id=$1',[state.id,JSON.stringify(state)]);
      state=await four.recover(state.id);const actor=players.find(p=>p.id===state.order[state.turn]);
      return four.action(state.id,actor,{action:'act',choice:'shoot',revision:state.revision,actionId:'fatal-shot-'+state.id});
    };
    s=await finish(s);assert.equal(s.settled,true);const first=s.id;
    const before=new Map(f.balances);
    for(const p of players)s=await four.action(first,p,{action:'rematch',wager:1000});
    assert.ok(s.nextMatch);s=await four.recover(s.nextMatch);assert.equal(s.private,true);assert.equal(s.paid.length,4);
    for(const p of players)assert.equal(f.balances.get(p.id),before.get(p.id)-1000);
    s=await finish(s);assert.equal(s.settled,true);const paid=new Map(f.balances);await four.recover(s.id);assert.deepEqual(f.balances,paid);
    assert.equal([...f.ledger.keys()].filter(id=>id.startsWith('four:')&&id.includes(':stake:')).length,8);
  }finally{await f.pg.close();}
});
