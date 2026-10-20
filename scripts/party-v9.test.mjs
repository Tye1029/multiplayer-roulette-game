import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { startPartyServer } from "./party-test-server.mjs";
const require = createRequire(import.meta.url),
  M = require("../netlify/functions/party/model"),
  G = require("../netlify/functions/party/minigames"),
  R = require("../assets/party/midway-rules"),
  C = require("../assets/party/catalog");
function fixture(id) {
  const s = M.create(
    "ABC234",
    { id: "owner", name: "Tester", character: "ghost" },
    "party",
    1000,
  );
  M.testStart(s, id, 1000);
  s.players.forEach((p) => (p.bot = false));
  if (id !== "board") {
    s.game.start = 20000;
    s.game.end = 20000 + s.game.duration;
    s.phase = "playing";
    s.deadline = s.game.end;
  }
  return s;
}
function play(s, i, value, at = 22000, extra = {}) {
  M.act(
    s,
    s.players[i].id,
    {
      action: "play",
      round: s.round,
      game: s.game.id,
      start: s.game.start,
      value,
      ...extra,
    },
    at,
  );
}
function debug(s, op, extra = {}) {
  M.act(s, s.host, { action: "debug", op, ...extra }, 23000);
}
test("individual tests support all 42 games, correct seat counts, restart and held results", () => {
  assert.equal(C.games.length, 42);
  for (const d of C.games) {
    const s = fixture(d.id);
    assert.equal(s.players.length, d.duelOnly ? 2 : 4);
    assert.equal(s.game.id, d.id);
    debug(s, "finish");
    M.advance(s, 400000);
    assert.equal(s.phase, "round-end", d.id);
    debug(s, "restart");
    assert.equal(s.phase, "intro");
    assert.equal(s.game.id, d.id);
    assert.equal(s.practice, true);
  }
});
test("debug is confined to test hosts, rejects invalid spaces and preserves regular matches", () => {
  const s = fixture("board");
  s.practice = false;
  const before = JSON.stringify(s);
  assert.throws(() => debug(s, "space", { space: 8 }), /only available/);
  assert.equal(JSON.stringify(s), before);
  s.practice = true;
  assert.throws(
    () => M.act(s, s.players[1].id, { action: "debug", op: "restart" }, 23000),
    /only available/,
  );
  assert.throws(() => debug(s, "space", { space: 999 }), /space/);
  assert.throws(() => debug(s, "game", { target: "roulette" }), /available/);
  debug(s, "space", { space: 39 });
  assert.equal(s.players[0].position, 39);
  debug(s, "roll", { value: 4 });
  assert.deepEqual(s.dice.values, [4]);
  assert.throws(() => M.join(s, { id: "stranger" }), /test session/);
});
test("pizza enforces preparation and five seconds baking; accuracy and speed affect score", () => {
  const s = fixture("pizza"),
    g = s.game,
    t = g.secrets.orders[0],
    p = g.progress[0];
  assert.throws(() => play(s, 0, "serve"), /Bake/);
  assert.throws(() => play(s, 0, "bake"), /dough/);
  let at = 22000;
  for (const value of [
    `shape:${t.shape}`,
    `cheese:${t.cheese}`,
    ...t.toppings.map((n) => `topping:${n}`),
    "bake",
  ]) {
    play(s, 0, value, at);
    at += 200;
  }
  const bakedAt = p.ovenAt;
  assert.throws(() => play(s, 0, "serve", bakedAt + 4999), /five seconds/);
  assert.throws(() => play(s, 0, "shape:0", bakedAt + 5000), /busy/);
  play(s, 0, "serve", bakedAt + 5000);
  assert.equal(p.delivery.accuracy, 100);
  assert.ok(g.scores[0] >= 480);
  assert.equal(p.order, 1);
  assert.throws(() => play(s, 0, "serve", bakedAt + 5200), /take their pizza/);
  assert.equal(M.view(s, s.host, at).game.secrets, undefined);
  assert.equal(
    R.pizzaAccuracy(t, {
      shape: (t.shape + 1) % 3,
      cheese: (t.cheese + 1) % 3,
      toppings: [],
    }),
    0,
  );
  const slower = fixture("pizza"),
    sg = slower.game;
  sg.secrets.orders[0] = t;
  let n = 40000;
  for (const value of [
    `shape:${t.shape}`,
    `cheese:${t.cheese}`,
    ...t.toppings.map((n) => `topping:${n}`),
    "bake",
  ]) {
    play(slower, 0, value, n);
    n += 200;
  }
  play(slower, 0, "serve", n + 5000);
  assert.ok(sg.scores[0] < g.scores[0]);
});
test("shared mining conserves deposits, enforces cargo capacity, adjacent movement and surface sales", () => {
  const s = fixture("mine"),
    g = s.game,
    w = R.mineWidth,
    a = g.progress[0],
    b = g.progress[1];
  a.x = 1;
  a.y = 0;
  b.x = 2;
  b.y = 1;
  g.mine.cells[w + 1] = { hp: 1, ore: 4 };
  play(s, 0, "down");
  assert.deepEqual(a.cargo, [4]);
  play(s, 1, "left", 22000);
  assert.deepEqual(b.cargo, []);
  assert.equal(g.mine.cells[w + 1].ore, null);
  assert.throws(() => play(s, 0, "sell", 22500), /surface/);
  a.cargo = [0, 1, 2];
  g.mine.cells[w + 2] = { hp: 1, ore: 3 };
  assert.throws(() => play(s, 0, "right", 22500), /full/);
  assert.throws(() => play(s, 0, "tile:89", 22500), /adjacent/);
  play(s, 0, "up", 22500);
  play(s, 0, "sell", 23000);
  assert.equal(g.scores[0], 190);
  assert.deepEqual(a.cargo, []);
  assert.throws(() => play(s, 0, "sell", 23500), /Collect/);
});
test("moles score once, friendly visitors stun for 2.5 seconds and future holes remain private", () => {
  const s = fixture("moles"),
    g = s.game;
  g.secrets.visitors = [
    { index: 0, at: 2000, hole: 3, kind: "mole", window: 900 },
    { index: 1, at: 3500, hole: 5, kind: "duck", window: 900 },
    { index: 2, at: 7000, hole: 0, kind: "flower", window: 900 },
  ];
  play(s, 0, 3);
  assert.equal(g.scores[0], 100);
  assert.throws(() => play(s, 0, 3, 22200), /already/);
  play(s, 0, 5, 23500);
  assert.equal(g.progress[0].stunUntil, 26000);
  assert.throws(() => play(s, 0, 0, 25000), /stunned/);
  const view = M.view(s, s.host, 24000);
  assert.equal(view.game.secrets, undefined);
  assert.equal(view.game.cue.kind, "duck");
  assert.ok(!JSON.stringify(view).includes("flower"));
});
test("robots run two simultaneous semifinals then only winners punch in the final", () => {
  const s = fixture("robots"),
    g = s.game,
    r = g.robots;
  const winners = r.pairs.map((p) => p[0]);
  for (let at = 20300; at < 35000; at += 300)
    for (const i of winners) play(s, i, "punch", at, { stage: 0, count: 3 });
  M.advance(s, 35000);
  assert.deepEqual(r.final, winners);
  const loser = r.pairs[0][1];
  assert.throws(
    () => play(s, loser, "punch", 43500, { stage: 1, count: 1 }),
    /Watch/,
  );
  assert.throws(
    () => play(s, winners[0], "punch", 43500, { stage: 0, count: 1 }),
    /earlier/,
  );
  assert.throws(
    () => play(s, winners[0], "punch", 43500, { stage: 1, count: 100 }),
    /Invalid/,
  );
  play(s, winners[0], "punch", 43500, { stage: 1, count: 4 });
  play(s, winners[1], "punch", 43600, { stage: 1, count: 2 });
  M.advance(s, 58000);
  assert.equal(r.champion, winners[0]);
  assert.ok(g.scores[winners[0]] > g.scores[winners[1]]);
  const scores = [...g.scores];
  M.advance(s, 59000);
  assert.deepEqual(g.scores, scores);
  assert.equal(M.view(s, s.host, 59000).game.secrets, undefined);
});
test("robot punch bursts enforce elapsed-time budget and ties favor the first to the total", () => {
  const s = fixture("robots"),
    g = s.game,
    [a, b] = g.robots.pairs[0];
  assert.throws(
    () => play(s, a, "punch", 20001, { stage: 0, count: 4 }),
    /quickly/,
  );
  play(s, a, "punch", 20300, { stage: 0, count: 4 });
  play(s, b, "punch", 20500, { stage: 0, count: 4 });
  M.advance(s, 35000);
  assert.ok(g.robots.final.includes(a));
  assert.ok(!g.robots.final.includes(b));
});

test("120 seeded-by-server bot games finish with bounded scores, cargo and punch totals", () => {
  for (const id of ["pizza", "mine", "moles", "robots"])
    for (let run = 0; run < 30; run++) {
      const s = fixture(id),
        g = s.game;
      s.players.forEach((p) => (p.bot = true));
      g.simAt = g.start;
      for (let at = g.start; at <= g.end + 500; at += 250) M.advance(s, at);
      assert.equal(s.phase, "round-end", id);
      assert.ok(g.scores.every(Number.isFinite), id);
      assert.ok(
        g.scores.some((n) => n > 0),
        id,
      );
      if (id === "pizza")
        for (const p of g.progress) assert.ok(p.order > 0 && p.order < 18);
      if (id === "mine") {
        assert.ok(g.progress.every((p) => p.cargo.length <= 3 && p.sold >= 0));
        assert.ok(g.mine.cells.every((c) => c.hp >= 0));
        const scores = [...g.scores];
        M.advance(s, g.end + 10000);
        assert.deepEqual(
          g.scores,
          scores,
          "unsold cargo cannot pay after the bell",
        );
      }
      if (id === "moles") assert.ok(g.scores.every((n) => n <= 9000));
      if (id === "robots") {
        assert.equal(g.robots.final.length, 2);
        assert.equal(g.robots.resolved.length, 2);
        assert.ok(g.robots.counts.flat().every((n) => n <= 250));
        assert.equal(
          g.scores.indexOf(Math.max(...g.scores)),
          g.robots.champion,
        );
      }
    }
});

test("two-player robot final and three-player bye finish without absent opponents", () => {
  for (const count of [2, 3]) {
    const s = fixture("robots"),
      g = s.game;
    s.players = s.players.slice(0, count);
    g.progress = g.progress.slice(0, count);
    g.scores = g.scores.slice(0, count);
    g.active = s.players.map((_, i) => i);
    g.participants = s.players.map((p) => p.id);
    G.setup(g);
    g.simAt = g.start;
    s.deadline = g.end;
    s.players.forEach((p) => (p.bot = true));
    if (count === 3)
      assert.equal(g.robots.pairs.filter((p) => p.length === 1).length, 1);
    for (let at = g.start; at <= g.end + 500; at += 250) M.advance(s, at);
    assert.equal(s.phase, "round-end");
    assert.equal(g.robots.resolved.length, count === 2 ? 1 : 2);
    assert.ok(g.robots.champion >= 0 && g.robots.champion < count);
    assert.ok(g.scores.every(Number.isFinite));
  }
});
test("Cookie Caper hides choices until reveal, publishes accurate split receipts and locks reveal inputs", () => {
  const s = fixture("draft"),
    g = s.game,
    b = g.beats[0];
  const at = g.start + b.at;
  play(s, 0, 1, at);
  assert.equal(M.view(s, s.players[1].id, at).game.privateChoices, undefined);
  assert.equal(
    M.view(s, s.players[1].id, at).game.shared.cookieReveal,
    undefined,
  );
  play(s, 1, 1, at);
  const due = at + b.window;
  M.advance(s, due);
  const receipt = g.shared.cookieReveal;
  assert.equal(receipt.picks[0], 1);
  assert.equal(receipt.picks[1], 1);
  assert.equal(receipt.awards[0], Math.floor(receipt.values[1] / 2) * 100);
  assert.equal(receipt.awards[0], g.scores[0]);
  assert.throws(() => play(s, 0, 0, due + 200), /reveal/);
});
test("test rooms cannot create account rewards even after a forced complete state", async () => {
  const server = await startPartyServer();
  try {
    const profile = await server.store.register(
        { name: "Debug Tester", character: "ghost" },
        "test-v9",
      ),
      p = await server.store.authenticate(profile.token),
      s = await server.store.create(p, {
        mode: "party",
        rounds: 10,
        practice: true,
        testGame: "pizza",
        requestId: crypto.randomUUID(),
      });
    assert.equal(s.practice, true);
    let state = (
      await server.pg.query("SELECT state FROM party_rooms WHERE id=$1", [s.id])
    ).rows[0].state;
    state.phase = "complete";
    state.winner = p.id;
    state.rewards = [200, 0, 0, 0];
    state.players[0].participation = 100;
    await server.pg.query(
      "UPDATE party_rooms SET state=$2::jsonb WHERE id=$1",
      [s.id, JSON.stringify(state)],
    );
    await server.store.action(p, { action: "get", room: s.id });
    assert.equal((await server.store.profile(p.id)).coins, 0);
    assert.equal(
      (await server.pg.query("SELECT * FROM party_rewards")).rows.length,
      0,
    );
  } finally {
    await server.close();
  }
});
