import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Round, splitPot, relativeSeat, createPersonality, botDecision, VERSION } from '../assets/roulette-four/model.mjs';

const players = ['a', 'b', 'c', 'd'].map(id => ({ id, name: id }));
function rng(seed) { let s = seed; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; }; }
const six = () => 0.999;
const start = () => { const g = new Round(players, six); g.begin(); return g; };
const awards = counts => splitPot(counts.map((shots, i) => ({ id: String(i), shots })), 18000, six).map(p => p.cents);
assert.deepEqual(awards([1, 2, 3]), [5000, 6000, 7000]);
assert.deepEqual(awards([1, 1, 2]), [5500, 5500, 7000]);
assert.deepEqual(awards([1, 2, 2]), [5000, 6500, 6500]);
assert.deepEqual(awards([0, 0, 0]), [6000, 6000, 6000]);
for (let cents = 0; cents < 100; cents++) assert.equal(splitPot(players.slice(0, 3).map(p => ({ ...p, shots: 0 })), cents, rng(cents + 1)).reduce((s, p) => s + p.cents, 0), cents);
for (const viewer of players) {
  assert.equal(relativeSeat(players.map(p => p.id), viewer.id, viewer.id), 0);
  const i = players.indexOf(viewer);
  assert.equal(relativeSeat(players.map(p => p.id), players[(i + 3) % 4].id, viewer.id), 3, 'Previous player appears right');
  assert.equal(relativeSeat(players.map(p => p.id), players[(i + 1) % 4].id, viewer.id), 1, 'Next player appears left, clockwise from down');
}
{
  const game = start();
  assert.equal(game.act('b', 'shoot').ok, false);
  assert.equal(game.act('a', 'pass').ok, false);
  for (const award of [2000, 4000, 6000, 8000, 10000]) assert.equal(game.act('a', 'shoot').award, award);
  assert.equal(game.snapshot().players[0].bank, 30000);
  assert.equal(game.snapshot().pot, 10000);
  game.act('a', 'pass');
  assert.equal(game.snapshot().award, 10000, 'Remaining pot caps next reward');
  assert.equal(game.act('b', 'spin').ok, true);
  assert.equal(game.snapshot().award, 2000);
  assert.equal(game.act('b', 'spin').ok, false);
  assert.equal(game.act('b', 'pass').ok, false, 'Must shoot after spinning');
  assert.equal(game.act('b', 'shoot').award, 2000);
  assert.equal(game.act('b', 'pass').ok, true);
  assert.equal(game.snapshot().award, 4000, 'Passing preserves ladder');
}
{
  const game = start();
  for (let i = 0; i < 4; i++) game.act('a', 'shoot');
  game.act('a', 'spin');
  for (let i = 0; i < 4; i++) game.act('a', 'shoot');
  assert.equal(game.snapshot().phase, 'complete');
  assert.equal(game.snapshot().result.reason, 'empty');
  assert.equal(game.snapshot().players[0].bank, 40000);
  assert.equal(game.act('a', 'shoot').ok, false);
  assert.equal(game.vote('a', 0), false);
  game.openRematch(1000);
  assert.equal(game.vote('a', 1001), false);
  game.vote('a', 1002);
  assert.equal(game.snapshot().ready.length, 1);
  assert.equal(game.vote('unknown', 1003), false);
  game.vote('b', 1003); game.vote('c', 1004);
  assert.equal(game.vote('d', 10999), true, 'All four ready inside 10 seconds');
}
{
  const game = new Round(players, () => 0); game.begin();
  const first = game.snapshot().activeId;
  assert.equal(game.act(first, 'shoot').fatal, true);
  assert.equal(game.snapshot().players.find(p => p.id === first).bank, 0);
  assert.deepEqual(game.snapshot().players.filter(p => p.id !== first).map(p => p.bank).sort(), [13333, 13333, 13334]);
  game.openRematch(0);
  assert.equal(game.vote('a', 10000), false, 'Deadline is exclusive');
  assert.equal(game.snapshot().phase, 'expired');
  const next = new Round(players, rng(9876), 2);
  assert.equal(next.snapshot().pot, 40000);
  assert(next.snapshot().players.every(p => p.shots === 0 && p.bank === 0 && !p.spinUsed));
  assert.deepEqual(next.snapshot().ready, []);
}
const personalities = new Set(), orders = new Set();
for (let seed = 1; seed <= 1000; seed++) {
  const draw = rng(seed * 11717), game = new Round(players, draw), traits = Object.fromEntries(players.map(p => [p.id, createPersonality(draw)]));
  Object.values(traits).forEach(p => personalities.add(p.kind));
  orders.add(game.snapshot().order.join(''));
  game.begin();
  for (let actions = 0; game.snapshot().phase === 'playing'; actions++) {
    assert(actions < 150, 'Bot round must terminate');
    const s = game.snapshot();
    assert(!Object.keys(s).some(key => /bullet|secret/i.test(key)), 'Bots must not see bullet location');
    const action = botDecision(s, s.activeId, traits[s.activeId], draw);
    assert.equal(game.act(s.activeId, action).ok, true);
  }
  assert.equal(game.snapshot().players.reduce((sum, p) => sum + p.bank, 0), 40000);
}
assert.equal(personalities.size, 4); assert.equal(orders.size, 24);
const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const html = await read('games/multiplayer/roulette-four/index.html');
assert(html.includes(VERSION)); assert(html.includes('ready-bubbles')); assert(html.includes('shoot-value'));
const app = await read('assets/roulette-four/table.mjs');
assert(!app.includes('/.netlify/functions/'), 'Practice cannot mutate account or duel state');
assert(app.includes('createPersonality()')); assert(app.includes('stopTimers()'));
console.log('Four-player Roulette validated: six chambers, $20 ladder, cent-exact weighted/tied splits, all 24 orders, all viewer perspectives, 1,000 randomized bot rounds and rematch lifecycle.');
