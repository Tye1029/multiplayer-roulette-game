import assert from 'node:assert/strict';
import { CAST, pickCast } from '../assets/roulette-four/cast.mjs';
import { readFile } from 'node:fs/promises';
import { TURN_MS, REMATCH_MS, Round, splitPot, relativeSeat, createPersonality, botDecision, VERSION } from '../assets/roulette-four/model.mjs';

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
  assert.equal(game.vote('d', 15999), true, 'All four ready inside 15 seconds');
}
{
  const game = new Round(players, () => 0); game.begin();
  const first = game.snapshot().activeId;
  assert.equal(game.act(first, 'shoot').fatal, true);
  assert.equal(game.snapshot().players.find(p => p.id === first).bank, 0);
  assert.deepEqual(game.snapshot().players.filter(p => p.id !== first).map(p => p.bank).sort(), [13333, 13333, 13334]);
  game.openRematch(0);
  assert.equal(game.vote('a', 15000), false, 'Deadline is exclusive');
  assert.equal(game.snapshot().phase, 'expired');
  const next = new Round(players, rng(9876), 2);
  assert.equal(next.snapshot().pot, 40000);
  assert(next.snapshot().players.every(p => p.shots === 0 && p.bank === 0 && !p.spinUsed));
  assert.deepEqual(next.snapshot().ready, []);
}

assert.equal(TURN_MS, 60000); assert.equal(REMATCH_MS, 15000);
{
  const game = new Round(players, six); game.begin(0);
  game.act('a', 'shoot', 100); game.act('a', 'shoot', 200);
  assert.equal(game.snapshot().turnDeadline, 60000, 'Shots do not reset a turn');
  assert.equal(game.timeout(59999), null);
  assert.equal(game.act('a', 'shoot', 60000).ok, false, 'Late actions cannot beat the clock');
  const event = game.timeout(60000);
  assert.equal(event.returned, 6000); assert.equal(game.snapshot().pot, 34000);
  assert.deepEqual(game.snapshot().players.map(p => p.bank), [0, 2000, 2000, 2000]);
  assert.equal(game.snapshot().activeId, 'b'); assert.equal(game.snapshot().turnDeadline, 120000);
  assert.equal(game.timeout(60000), null, 'Timeout is idempotent');
  game.timeout(120000);
  assert.deepEqual(game.snapshot().players.map(p => p.bank), [0, 0, 3000, 3000]);
  game.timeout(180000);
  assert.equal(game.snapshot().result.reason, 'last-survivor');
  assert.deepEqual(game.snapshot().players.map(p => p.bank), [0, 0, 0, 40000]);
  assert.equal(game.timeout(240000), null);
}
{
  const game = new Round(players, six); game.begin(0);
  game.act('a', 'shoot', 1); game.act('a', 'spin', 2);
  assert.equal(game.snapshot().turnDeadline, 60000, 'Spin does not reset a turn');
  assert.equal(game.act('a', 'pass', 3).ok, true, 'A player may spin before passing after their mandatory shot');
  assert.equal(game.snapshot().award, 2000); assert.equal(game.snapshot().turnDeadline, 60003);
  game.timeout(60003); // B is skipped on future circuits.
  game.act('c', 'shoot', 60004); game.act('c', 'pass', 60005);
  game.act('d', 'shoot', 60006); game.act('d', 'pass', 60007);
  assert.equal(game.snapshot().activeId, 'a');
  game.act('a', 'shoot', 60008); game.act('a', 'pass', 60009);
  assert.equal(game.snapshot().activeId, 'c');
}
{
  const game = new Round(players, () => .2); game.begin(0);
  const first = game.snapshot().activeId; game.act(first, 'shoot', 1); game.timeout(60000);
  const next = game.snapshot().activeId; assert.equal(game.act(next, 'shoot', 60001).fatal, true);
  const s = game.snapshot(); assert.equal(s.phase, 'complete');
  assert.equal(s.players.filter(p => p.eliminated).length, 2);
  assert.equal(s.players.find(p => p.id === first).bank, 0);
  assert.equal(s.players.reduce((sum, p) => sum + p.bank, s.pot), 40000);
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
await import('./validate-roulette-four-profile.mjs');

const { rotationPlan } = await import('../assets/roulette-four/motion.mjs');
for (const current of [0, 90, 270, 1890]) for (const target of [0, 90, 180, 270]) {
  const turn = rotationPlan(current, target), opening = rotationPlan(current, target, true);
  assert(turn.angle >= current); assert.equal(turn.angle % 360, target);
  assert(turn.duration <= 1380); assert(opening.duration >= 4200 && opening.duration <= 5250);
  assert.equal(opening.angle - turn.angle, 1080);
}
assert(rotationPlan(0,270).duration > rotationPlan(0,90).duration, 'Skipped seats receive more rotation time');
const { normalizeProfile, loadProfile } = await import('../assets/roulette-four/profile.mjs');
assert.equal(normalizeProfile({ id: 1, name: '  Test  ', gender: '" onclick="bad', avatar: 'javascript:bad' }).gender, 'unknown');
assert.equal(normalizeProfile({ id: 1, name: 'Test', avatar: 'https://user:secret@example.com/p.png' }).avatar, null);
assert.equal(normalizeProfile({ id: 'invalid', name: 'Test' }), null);
const saved = { localStorage: globalThis.localStorage, sessionStorage: globalThis.sessionStorage, fetch: globalThis.fetch };
try {
  let requests = 0;
  globalThis.localStorage = { getItem: key => key === 'tornVisitorApiKey' ? 'TESTPROFILEKEY00' : '1' };
  globalThis.sessionStorage = { getItem: () => JSON.stringify({ at: Date.now() + 999999, profile: { id: '1', name: 'Stale' } }), setItem() {} };
  globalThis.fetch = async () => { requests++; return { ok: true, json: async () => ({ ok: true, profile: { id: '1', name: 'Fresh', gender: 'male' } }) }; };
  assert.equal((await loadProfile()).profile.name, 'Fresh'); assert.equal(requests, 1, 'Future-dated profile caches are rejected');
} finally { Object.assign(globalThis, saved); }
console.log('Four-player readiness validated: bounded rotation timings, normalized cached profiles and cache expiry.');

// Every cosmetic table has unique designs and a smoker; all designs are reachable.
const seenCast = new Set(), castRandom = rng(741938);
for (let seed = 1; seed <= 1000; seed++) {
 const cast = pickCast(castRandom);
 assert.equal(new Set(cast.map(c => c.id)).size, 3);
 assert.equal(cast.filter(c => c.smoker).length, 1);
 cast.forEach(c => seenCast.add(c.id));
}
assert.equal(seenCast.size, CAST.length);
console.log('Unique cast selection: 1,000 seeded tables passed');
