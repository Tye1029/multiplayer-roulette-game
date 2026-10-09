import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const rules = require('../shared/games/rps-model.js');
const { createHandler } = require('../netlify/functions/rps-action.js');
const a = { id:'100', name:'Alpha' }, b = { id:'200', name:'Beta' };
const start = () => rules.join(rules.create('ABCDEF123456',a,1000),b,1000);
const round = (s, ca, cb, now) => rules.pick(rules.pick(s,a.id,ca,s.round,now),b.id,cb,s.round,now);
test('all nine matchups, winner mapping, and no mutation of input',()=>{
  for (let i=0;i<3;i++) for(let j=0;j<3;j++) {
    const s = start(), resolved = round(s,rules.CHOICES[i],rules.CHOICES[j],2000);
    assert.deepEqual(s.picks,[null,null]);
    assert.equal(resolved.history.at(-1).winner,i===j ? null : (i-j+3)%3===1 ? 0 : 1);
  }
});
test('locked picks and scores stay secret until authoritative reveal timestamp',()=>{
  let s = rules.pick(start(),a.id,'paper',1,2000);
  let opponent = rules.publicState(s,b.id,2000);
  assert.equal(opponent.myChoice,null); assert.equal(opponent.picks,null); assert.deepEqual(opponent.history,[]);
  s = rules.pick(s,b.id,'rock',1,2100);
  for(const viewer of [a.id,b.id]) {
    const hidden = rules.publicState(s,viewer,s.revealAt-1);
    assert.deepEqual(hidden.scores,[0,0]); assert.equal(hidden.picks,null); assert.equal(hidden.winner,null); assert.deepEqual(hidden.history,[]);
    assert.deepEqual(rules.publicState(s,viewer,s.revealAt).picks,['paper','rock']);
  }
  assert.throws(()=>rules.publicState(s,'999'),/not a player/);
});
test('unlimited ties replay without points; 1–1 ends only at two wins',()=>{
  let s = start(), now = 2000;
  for(let i=0;i<12;i++) { s=round(s,'rock','rock',now); assert.deepEqual(s.scores,[0,0]); now+=3000; s=rules.advance(s,now); }
  assert.equal(s.round,13);
  s=round(s,'rock','scissors',now); now+=3000; s=rules.advance(s,now);
  s=round(s,'rock','paper',now); now+=3000; s=rules.advance(s,now);
  assert.equal(rules.publicState(s,a.id,now).suddenDeath,true);
  s=round(s,'scissors','paper',now); assert.equal(s.winner,0); assert.equal(s.phase,'reveal');
  const finalHidden=rules.publicState(s,b.id,now); assert.equal(finalHidden.winner,null); assert.deepEqual(finalHidden.scores,[1,1]);
  s=rules.advance(s,now+3000); assert.equal(s.phase,'complete'); assert.deepEqual(s.scores,[2,1]);
});
test('retry cannot change choice, score twice, advance early or act on stale round',()=>{
  const s=rules.pick(start(),a.id,'rock',1,2000);
  assert.deepEqual(rules.pick(s,a.id,'rock',1,2100),s);
  assert.throws(()=>rules.pick(s,a.id,'paper',1,2100),/already locked/);
  assert.throws(()=>rules.pick(s,'999','paper',1,2100),/not a player/);
  assert.throws(()=>rules.pick(s,b.id,'lizard',1,2100),/Choose rock/);
  const reveal=rules.pick(s,b.id,'scissors',1,2200);
  assert.deepEqual(rules.pick(reveal,b.id,'scissors',1,2201),reveal);
  assert.equal(rules.advance(reveal,reveal.nextAt-1).phase,'reveal');
  assert.throws(()=>rules.pick(reveal,a.id,'paper',1,reveal.nextAt),/round has already ended/);
});
test('waiting/choice expiration has no invented winner; duplicate join is harmless',()=>{
  const s=start(); assert.deepEqual(rules.join(s,a,2000),s);
  assert.throws(()=>rules.join(s,{id:'300',name:'Intruder'},2000),/no longer open/);
  const expired=rules.advance(s,s.deadline); assert.equal(expired.phase,'cancelled'); assert.equal(expired.winner,null);
  assert.throws(()=>rules.pick(expired,a.id,'rock',1,s.deadline),/locked/);
});
test('endpoint authenticates identity, rejects oversized/invalid requests, never reflects secrets',async()=>{
  let stored;
  const database={session:async p=>{stored=p;return 'a'.repeat(64);},authenticate:async()=>null};
  const handler=createHandler(database,async()=>({ok:true,json:async()=>({player_id:100,name:'Alpha'})}));
  const send=body=>handler({httpMethod:'POST',body:JSON.stringify(body)});
  assert.equal((await handler({httpMethod:'GET'})).statusCode,405);
  assert.equal((await handler({httpMethod:'POST',body:'{'})).statusCode,400);
  assert.equal((await handler({httpMethod:'POST',body:'a'.repeat(2049)})).statusCode,413);
  assert.equal((await send({action:'pick',playerId:'100'})).statusCode,401);
  const res=await send({action:'login',visitorKey:'examplekey123',playerId:'999',name:'Impostor'});
  assert.equal(res.statusCode,200); assert.deepEqual(stored,a); assert.ok(!res.body.includes('examplekey123'));
  const broken=createHandler({authenticate:async()=>{throw new Error('postgres://secret')}});
  const bad=await broken({httpMethod:'POST',body:'{"action":"get"}'}); assert.equal(bad.statusCode,503); assert.ok(!bad.body.includes('secret'));
});
test('endpoint publishes only redacted state and rejects invalid actions and room IDs',async()=>{
  const now=Date.now(), s=rules.pick(rules.join(rules.create('ABCDEF123456',a,now),b,now),a.id,'rock',1,now);
  const handler=createHandler({authenticate:async()=>b,act:async()=>s});
  const send=body=>handler({httpMethod:'POST',body:JSON.stringify(body)});
  assert.equal((await send({action:'get',gameId:'bad'})).statusCode,400);
  assert.equal((await send({action:'win',gameId:s.id})).statusCode,400);
  const res=JSON.parse((await send({action:'get',gameId:s.id})).body);
  assert.equal(res.game.picks,null); assert.equal(res.game.myChoice,null); assert.deepEqual(res.game.history,[]);
});
test('game media is isolated and public package includes the new route',()=>{
  const html=readFileSync(new URL('../games/multiplayer/rps/index.html',import.meta.url),'utf8');
  const shell=readFileSync(new URL('../shared/site/index.template.html',import.meta.url),'utf8');
  assert.ok(html.includes('HAND_OF_DOOM_V1_20261009')); assert.ok(html.includes('aria-live="polite"'));
  assert.ok(shell.includes('href="/games/multiplayer/rps/"')); assert.ok(!shell.includes('/assets/rps/'));
  assert.ok(readFileSync(new URL('../assets/rps/audio.js',import.meta.url),'utf8').includes("visibilitychange"));
});
