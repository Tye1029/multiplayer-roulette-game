import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url),
  M = require("../netlify/functions/party/model"),
  G = require("../netlify/functions/party/minigames"),
  C = require("../assets/party/catalog"),
  R = require("../assets/party/rules");
function fixture(id) {
  const ps = C.characters.slice(0, 4).map((c, i) => ({
    id: String(i),
    name: "Friend " + i,
    character: c.id,
    characterPicked: true,
  }));
  const s = M.create("ABC234", ps[0], "party", 10000);
  ps.slice(1).forEach((p) => M.join(s, p));
  s.ready = ps.map((p) => p.id);
  M.begin(s, 10000);
  s.startingSeat = s.turn = 0;
  s.turnIndex = 0;
  if (s.mode === "party") s.phase = "board";
  else if (s.phase === "selection") M.advance(s, s.deadline);
  if (id) {
    s.phase = "board-end";
    s.deadline = 11000;
    M.advance(s, 11000);
    Object.assign(s.game, {
      id,
      start: 20000,
      end: 55000,
      duration: 35000,
      simAt: 20000,
    });
    G.setup(s.game);
    s.phase = "playing";
    s.deadline = 55000;
  }
  return s;
}
const act = (s, action, extra = {}, at = 12000, who = "0") =>
  M.act(
    s,
    who,
    {
      action,
      round: s.round,
      game: s.game?.id,
      start: s.game?.start,
      ...extra,
    },
    at,
  );
const fail = (message) => {
  throw new Error(message);
};
function play(g, i, value, at) {
  G.advance(g, i, at);
  G.play(g, i, { value }, at, fail);
  g.progress[i].inputs++;
  g.progress[i].last = at;
}

test("empty starting pockets, purchased items wait for next turn, and shield costs less than protected loss", () => {
  const s = fixture();
  assert.ok(s.players.every((p) => p.items.length === 0));
  assert.throws(() => act(s, "item", { item: "boost" }), /do not have/);
  s.phase = "space";
  s.event = { kind: "shop" };
  s.players[0].position = 4;
  act(s, "buy-item", { item: "double" });
  assert.deepEqual(s.players[0].items, ["double"]);
  assert.equal(s.players[0].tokens, 3);
  assert.throws(
    () => act(s, "item", { item: "double" }, 12100),
    /before rolling|turn|board/i,
  );
  assert.equal(C.items.find((i) => i.id === "shield").cost, 2);
  assert.ok(!C.items.some((i) => i.description.includes("this turn")));
});
test("four players retain one roll order across rounds; only the fourth completed turn queues a minigame", () => {
  const s = fixture();
  s.startingSeat = s.turn = 2;
  assert.deepEqual(M.view(s, "0").turnOrder, [2, 3, 0, 1]);
  for (let round = 1; round <= 3; round++) {
    assert.equal(s.turn, 2);
    assert.equal(s.turnIndex, 0);
    for (const [index, seat] of [2, 3, 0, 1].entries()) {
      assert.equal(s.turn, seat);
      s.phase = "space";
      s.event = { kind: "coins" };
      s.movement = null;
      act(s, "continue", {}, 12000 + round * 10000 + index * 100, String(seat));
      assert.equal(s.phase, index === 3 ? "board-end" : "board");
      assert.equal(s.turnIndex, index + 1);
    }
    M.advance(s, s.deadline);
    assert.equal(s.phase, "selection");
    M.advance(s, s.deadline);
    assert.equal(s.phase, "intro");
    s.phase = "round-end";
    s.deadline = 50000 + round * 10000;
    M.advance(s, s.deadline);
  }
  const waiting = M.create("ABC234", { id: "a", name: "A" }, "party", 10000);
  assert.deepEqual(M.view(waiting, "a").turnOrder, [0]);
});
test("ferry is optional, affordable, single-charge, turn-owned and ends on the opposite shore", () => {
  const s = fixture();
  s.players[0].position = C.ferry.from;
  s.phase = "space";
  s.event = { kind: "ferry" };
  assert.throws(() => act(s, "ride-ferry", {}, 12000, "1"), /turn/);
  s.players[0].tokens = 3;
  assert.throws(() => act(s, "ride-ferry"), /4 coins/);
  assert.equal(s.players[0].tokens, 3);
  s.players[0].tokens = 10;
  act(s, "ride-ferry");
  assert.equal(s.players[0].tokens, 6);
  assert.equal(s.phase, "ferry");
  assert.equal(s.players[0].position, C.ferry.to);
  assert.throws(() => act(s, "ride-ferry", {}, 12100), /landing/);
  assert.equal(s.players[0].tokens, 6);
  M.advance(s, 15199);
  assert.equal(s.phase, "ferry");
  M.advance(s, 15200);
  assert.equal(s.phase, "board");
  assert.equal(s.turn, 1);
  const decline = fixture();
  decline.phase = "space";
  decline.event = { kind: "ferry" };
  decline.players[0].position = C.ferry.from;
  act(decline, "continue");
  assert.equal(decline.players[0].position, C.ferry.from);
  assert.equal(decline.players[0].tokens, 10);
});
test("harbor branch never touches start, every route is selectable, and trophies clear all walkways", () => {
  const s = fixture(),
    b =
      C.branches.find((b) => b.name === "Harbor loop") ||
      C.branches.find((b) => b.from === 25);
  assert.equal(b.from, 25);
  assert.equal(b.to, 31);
  assert.ok(b.points);
  s.players[0].position = 25;
  s.phase = "choice";
  s.movement = { remaining: 3 };
  s.tide = 0;
  const preview = M.view(s, "0", 12000).routePreviews;
  assert.equal(preview.length, 2);
  act(s, "choose", { next: C.spaces[25].next[1] });
  assert.ok(s.lastMove.path.every((id) => id !== 0));
  const shop = C.spaces[26],
    len = Math.hypot(shop.x, shop.z),
    cx = shop.x + (shop.x / len) * 4.1,
    cz = shop.z + (shop.z / len) * 4.1;
  assert.ok(C.pathDistance(cx, cz) > 4, "Harbor loop clears the shop dock");
  for (const [id, p] of Object.entries(C.trophyPedestals)) {
    assert.ok(C.pathDistance(p.x, p.z) > 1.5);
    assert.ok(Math.hypot(p.x - C.spaces[id].x, p.z - C.spaces[id].z) >= 2.5);
  }
});
test("special showdown returns to the following seat without triggering an early regular minigame", () => {
  const s = fixture();
  s.startingSeat = s.turn = 2;
  s.phase = "space";
  s.event = { kind: "duel" };
  act(
    s,
    "challenge",
    { opponent: "3", stake: 0, currency: "coins" },
    12000,
    "2",
  );
  assert.equal(s.game.sideDuel, true);
  s.game.id = "climb";
  s.phase = "playing";
  s.game.start = 20000;
  s.game.end = 21000;
  s.game.simAt = 20000;
  s.deadline = 21000;
  s.game.active.forEach((i) => {
    s.game.progress[i].inputs = 1;
    s.game.scores[i] = i === 2 ? 600 : 100;
  });
  M.advance(s, 21001);
  assert.equal(s.phase, "side-result");
  assert.equal(s.deadline - s.game.resultAt, 5000);
  M.advance(s, s.deadline);
  assert.equal(s.phase, "board");
  assert.equal(s.turn, 3);
  assert.equal(s.turnIndex, 1);
});

test("straight arrows score at impact only, use matching concentric hit rings and reload independently of beats", () => {
  for (const [x, score] of [
    [0, 500],
    [0.23, 300],
    [0.53, 100],
    [0.901, 0],
  ])
    assert.equal(R.arrowScore(x, 0), score);
  const g = fixture("ricochet").game;
  let at = 21000;
  while (
    at < 23000 &&
    R.arrowScore(R.arrowAim(g, at), R.arrowTarget(g, at + 420)) === 0
  )
    at += 10;
  play(g, 0, "fire", at);
  assert.equal(g.scores[0], 0);
  const expected = g.progress[0].shot.score;
  assert.ok(expected > 0);
  G.advance(g, 0, at + 419);
  assert.equal(g.scores[0], 0);
  G.advance(g, 0, at + 420);
  assert.equal(g.scores[0], expected);
  assert.throws(() => play(g, 0, "fire", at + 899), /arrow|ready/i);
  play(g, 0, "fire", at + 900);
  assert.equal(g.progress[0].shot.at, at + 900);
});
test("cannon direct hits match visible radii; near misses and passive waiting cannot score", () => {
  for (const [offset, hit] of [
    [0, true],
    [0.759, true],
    [0.761, false],
    [1.1, false],
  ]) {
    const g = fixture("cannon").game,
      target = R.cannonPosition(g, 2);
    g.shared.shots = [
      {
        owner: 0,
        at: 21000,
        x: target.x + 3,
        z: target.z + offset,
        dx: -R.cannon.speed,
        dz: 0,
      },
    ];
    G.advance(g, 0, 21400);
    assert.equal(g.progress[2].health, hit ? 2 : 3);
    assert.equal(g.scores[0], hit ? 250 : 0);
    G.advance(g, 0, 21900);
    assert.equal(g.scores[0], hit ? 250 : 0);
  }
  const g = fixture("cannon").game;
  g.progress[0].inputs = 1;
  G.advance(g, 0, 22000);
  assert.equal(g.scores[0], 0);
  play(g, 0, "fire", 22100);
  const aim = R.cannonAngle(g, 0, 22100);
  assert.equal(R.cannonAngle(g, 0, 22300), aim);
  assert.throws(() => play(g, 0, "fire", 23899), /reload/i);
  play(g, 0, "fire", 23900);
  assert.ok(
    Math.abs(R.cannonAngle(g, 0, 23901) - R.cannonAngle(g, 0, 23900)) < 0.001,
  );
});
test("bomb flights finish before another pass, pops retain the actual flight and respawn is a visible pause", () => {
  const g = fixture("bomb").game;
  g.shared.holder = 0;
  G.advance(g, 0, 21000);
  play(g, 0, "right", 21000);
  const recipient = g.shared.holder;
  assert.deepEqual(g.shared.flight, {
    from: 0,
    to: recipient,
    at: 21000,
    duration: 700,
  });
  assert.throws(
    () => play(g, recipient, "left", 21699),
    /flight|catch|land|air/i,
  );
  play(g, recipient, "left", 21700);
  const flight = { ...g.shared.flight };
  g.shared.fuseEnd = 22000;
  G.advance(g, 0, 22000);
  assert.equal(g.progress[g.shared.holder].health, 2);
  assert.deepEqual(g.shared.popped.flight, flight);
  assert.equal(g.shared.popped.at, 22000);
  assert.throws(
    () => play(g, g.shared.holder, "right", 22100),
    /next bomb|fresh bomb|pause|incoming/i,
  );
  G.advance(g, 0, 23199);
  assert.equal(g.shared.respawnAt, 23200);
  G.advance(g, 0, 23200);
  assert.equal(g.shared.respawnAt, 0);
  assert.equal(g.shared.flight, null);
});
test("spotlight runs continuously after one tap, freeze stays still, red catches once with explicit setback", () => {
  const g = fixture("spotlight").game;
  play(g, 0, "run", 20500);
  G.advance(g, 0, 21500);
  assert.equal(g.progress[0].distance, 80);
  play(g, 0, "freeze", 21600);
  const stopped = g.progress[0].distance;
  G.advance(g, 0, 22500);
  assert.equal(g.progress[0].distance, stopped);
  play(g, 0, "run", 22550);
  G.advance(g, 0, 22600);
  assert.equal(g.progress[0].running, false);
  assert.equal(g.progress[0].distance, stopped - 60);
  G.advance(g, 0, 22900);
  assert.equal(g.progress[0].distance, stopped - 60);
  assert.match(g.progress[0].feedback, /CAUGHT/);
  assert.equal(R.spotlight(g, 21700).color, "amber");
  assert.equal(R.spotlight(g, 22600).color, "red");
});
test("lantern has ten clearly spaced bells, positional color shuffles and real landing deadlines", () => {
  const g = fixture("lantern").game;
  assert.equal(g.beats.length, 10);
  assert.ok(g.beats.slice(1).every((b, i) => b.at - g.beats[i].at >= 3200));
  for (const b of g.beats) assert.deepEqual([...b.layout].sort(), [0, 1, 2, 3]);
  g.beats[0].color = 3;
  const b = g.beats[0],
    due = g.start + b.at + b.window;
  play(g, 0, R.lanternTile(b), due - 420);
  play(g, 1, R.lanternTile(b), due - 419);
  G.advance(g, 0, due);
  assert.ok(!g.progress[0].eliminatedAt);
  assert.equal(g.lanternLast.safeTile, R.lanternTile(b));
  G.advance(g, 1, due);
  assert.ok(g.progress[1].eliminatedAt);
  assert.throws(() => play(g, 0, 2, due + 500), /hatches/);
});
test("fishing ripple sizes retain a bounded visible range", () => {
  const g = fixture("fish").game,
    sizes = g.fishBeats.flat().map((b) => b.size);
  assert.ok(new Set(sizes).size > 1);
  assert.ok(sizes.every((n) => n >= 0.3 && n <= 1.6));
});
