import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const M = require('../shared/games/bluff-model.js');
const { createHandler } = require('../netlify/functions/bluff-action.js');
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log('PASS', name); };
const rng = n => 0;
function game() {
  const s = M.create('ABCDEF123456', { id: 'a', name: 'Alice' }, 0);
  M.join(s, { id: 'b', name: 'Bob' }, 0);
  M.act(s, 'a', { action: 'ready' }, 0, rng); M.act(s, 'b', { action: 'ready' }, 0, rng);
  return s;
}
const action = (s, p, action, more = {}, now = 1) => M.act(s, p, { action, match: s.match, round: s.round, ...more }, now, rng);
function play(s, p, cards = s.hands[p].map(c=>c.id)) { action(s, s.players[p].id, 'play', { cards }); }
function decide(s, a, b) { action(s, 'a', 'decide', { choice: a }); action(s, 'b', 'decide', { choice: b }); }
await test('10 random cards each, 20 unique identities, exact 30-second deadline', () => {
  const s = game(); assert.deepEqual(s.hands.map(h=>h.length), [10,10]); assert.equal(new Set(s.hands.flat().map(c=>c.id)).size,20); assert.equal(s.deadline,30000);
  let i=0; const t=M.create('R',{id:'a'},0); M.join(t,{id:'b'},0); M.act(t,'a',{action:'ready'},0); M.act(t,'b',{action:'ready'},0,n=>(i++)%n);
  assert.equal(new Set(t.hands[0].map(c=>c.suit)).size,3);
});
await test('readiness does not start a clock early',()=>{const s=M.create('R',{id:'a'},0);M.join(s,{id:'b'},0);M.act(s,'a',{action:'ready'},5);assert.equal(s.phase,'waiting');});
await test('mixed play caught: entire play returns',()=>{const s=game();s.hands[0][0].suit='skull';play(s,0);play(s,1);decide(s,'believe','call');assert.equal(s.hands[0].length,10);assert.equal(s.hands[1].length,0);assert.equal(s.pendingWinner,1);assert.equal(s.reveal.entries[0].result,'caught');});
await test('believed fakes are discarded and still revealed',()=>{const s=game();s.hands[0][0].suit='skull';play(s,0);play(s,1);decide(s,'believe','believe');assert.deepEqual(s.hands,[[],[]]);assert.equal(s.pendingWinner,'draw');assert.equal(s.reveal.entries[0].cards[0].suit,'skull');M.advance(s,s.deadline,rng);assert.equal(s.winner,'draw');});
await test('false accuser receives every genuine card before win check',()=>{const s=game();play(s,0);play(s,1);decide(s,'call','believe');assert.equal(s.hands[0].length,10);assert.equal(s.hands[1].length,0);assert.equal(s.pendingWinner,1);assert.ok(s.hands[0].every(c=>c.id.startsWith('1-1-')));});
await test('simultaneous false accusations swap plays without deletion or duplication',()=>{const s=game();play(s,0);play(s,1);decide(s,'call','call');assert.deepEqual(s.hands.map(h=>h.length),[10,10]);assert.equal(new Set(s.hands.flat().map(c=>c.id)).size,20);assert.equal(s.pendingWinner,null);M.advance(s,s.deadline,rng);assert.equal(s.round,2);assert.equal(s.phase,'select');});
await test('server timeout cannot be dodged by late play or disconnect',()=>{const s=game();play(s,0);assert.throws(()=>action(s,'b','play',{cards:[s.hands[1][0].id]},30000),/deadline/);assert.equal(s.phase,'complete');assert.equal(s.winner,0);const t=game();M.advance(t,90000);assert.equal(t.winner,'draw');});
await test('decision deadline defaults only missing choices to Believe',()=>{const s=game();play(s,0);play(s,1);action(s,'a','decide',{choice:'call'});M.advance(s,s.deadline,rng);assert.deepEqual(s.decisions,['call','believe']);assert.equal(s.pendingWinner,1);});
await test('private hands, play sizes, decisions and bot schedule stay private',()=>{const s=game();play(s,1);let v=M.publicState(s,'a',1);assert.equal(v.playCounts[1],null);for(const k of ['hands','plays','decisions','botAt','pendingWinner'])assert.ok(!(k in v));assert.throws(()=>M.publicState(s,'stranger'),/Join/);play(s,0);action(s,'b','decide',{choice:'call'});v=M.publicState(s,'a',1);assert.equal(v.myDecision,null);assert.equal(v.reveal,null);assert.equal(v.playCounts[1],10);assert.equal(JSON.stringify(v).includes('1-1-0'),false);});
await test('duplicate and stale messages cannot replace locks or affect rematches',()=>{const s=game();play(s,0,[s.hands[0][0].id]);play(s,0,[s.hands[0][1].id]);assert.equal(s.plays[0][0].id,'1-0-0');assert.throws(()=>action(s,'b','play',{round:0,cards:[s.hands[1][0].id]}),/round/);M.advance(s,30000);action(s,'a','rematch');action(s,'b','rematch');assert.equal(s.match,2);assert.equal(s.hands[0].length,10);assert.throws(()=>action(s,'a','play',{match:1,cards:[s.hands[0][0].id]}),/round/);});
await test('invalid identities, card theft, empty and duplicate plays are rejected',()=>{const s=game();for(const cards of [[],['fake'],[s.hands[1][0].id],[s.hands[0][0].id,s.hands[0][0].id]])assert.throws(()=>play(s,0,cards));assert.throws(()=>action(s,'x','play',{cards:[s.hands[0][0].id]}),/belongs/);assert.throws(()=>action(s,'a','decide',{choice:'call'}),/Wait/);});
await test('leaving a live match forfeits, rematches require mutual consent',()=>{const s=game();action(s,'a','leave');assert.equal(s.winner,1);action(s,'a','rematch');assert.equal(s.phase,'complete');action(s,'b','rematch');assert.equal(s.phase,'select');});
await test('leaving during the final reveal cannot overwrite the resolved winner',()=>{const s=game();play(s,0);play(s,1);decide(s,'call','believe');assert.equal(s.pendingWinner,1);action(s,'b','leave');assert.equal(s.winner,1);});
await test('bot action never uses the opponent secret cards',()=>{const s=game();s.players[1].bot=true;const t=structuredClone(s);t.hands[0].forEach(c=>c.suit='skull');M.bot(s,5000,rng);M.bot(t,5000,rng);assert.deepEqual(s.plays[1],t.plays[1]);play(s,0);play(t,0);M.bot(s,6000,rng);M.bot(t,6000,rng);assert.deepEqual(s.decisions,t.decisions);});
await test('randomized matches preserve all 20 cards through hundreds of resolutions',()=>{
  for(let run=0;run<40;run++) {const s=game();s.hands.flat().forEach(c=>c.suit=M.SUITS[M.random(3)]);let now=2;for(let round=0;round<30&&s.phase!=='complete';round++) {
    for(let p=0;p<2;p++){const n=1+M.random(s.hands[p].length);action(s,s.players[p].id,'play',{cards:s.hands[p].slice(0,n).map(c=>c.id)},now);}
    for(let p=0;p<2;p++)action(s,s.players[p].id,'decide',{choice:M.random(2)?'call':'believe'},now);
    assert.equal(s.hands.flat().length+s.discards,20);assert.equal(new Set(s.hands.flat().map(c=>c.id)).size,s.hands.flat().length);
    now=s.deadline;M.advance(s,now,rng);now++;
  }}
});
await test('API authentication, payload bounds, methods, errors and redaction',async()=>{
  let calls=0;const s=game();const store={create:async()=>{calls++;return s;},action:async()=>{calls++;return s;}};
  const handler=createHandler(store,{authenticate:async token=>token==='valid'?{id:'a'}:null});
  const req=b=>new Request('https://test/bluff',{method:'POST',body:JSON.stringify(b)});
  assert.equal((await handler(new Request('https://test/bluff'))).status,405);
  assert.equal((await handler(req({action:'create'}))).status,401);assert.equal(calls,0);
  assert.equal((await handler(req({token:'valid',action:'get',gameId:'bad'}))).status,400);
  assert.equal((await handler(req({token:'valid',action:'wat'}))).status,400);
  assert.equal((await handler(new Request('https://test/bluff',{method:'POST',body:'x'.repeat(9000)}))).status,413);
  const response=await handler(req({token:'valid',action:'get',gameId:s.id}));assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');const data=await response.json();assert.ok(!data.game.hands);assert.equal(data.game.hand.length,10);
  const bad=createHandler({action:async()=>{throw Error('secret database URL');}},{authenticate:async()=>({id:'a'})});const failure=await bad(req({action:'get',gameId:s.id}));assert.equal(failure.status,503);assert.ok(!(await failure.text()).includes('secret database'));
});
console.log(`Bluff or Bust: ${passed} rule, privacy, lifecycle and API checks passed.`);
