import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url),
  M = require("../netlify/functions/party/model"),
  G = require("../netlify/functions/party/minigames"),
  C = require("../assets/party/catalog"),
  R = require("../assets/party/rules"),
  I = require("../assets/party/interaction");
function fixture(id) {
  const s = M.create(
    "ABC234",
    { id: "owner", name: "Tester", character: "ghost" },
    "party",
    1000,
  );
  M.testStart(s, id, 1000);
  s.players.forEach((p) => (p.bot = false));
  s.phase = "playing";
  s.game.start = s.game.simAt = 20000;
  s.game.end = s.deadline = 20000 + s.game.duration;
  return s;
}
const fail = (message) => {
  throw Error(message);
};

test("golf deals three unique courses fairly from nine and preserves them for all viewers", () => {
  const seen = new Set(),
    orders = new Set();
  for (let run = 0; run < 300; run++) {
    const s = fixture("putt"),
      g = s.game;
    assert.equal(new Set(g.putt.holes).size, 3);
    orders.add(g.putt.holes.join(","));
    g.putt.holes.forEach((n) => {
      assert.ok(n >= 0 && n < 9);
      seen.add(n);
    });
    for (const p of s.players)
      assert.deepEqual(M.view(s, p.id, 20000).game.putt.holes, g.putt.holes);
    for (const course of [0, 1, 2]) {
      g.putt.course = course;
      const index = C.golfIndex(g.putt);
      assert.equal(index, g.putt.holes[course]);
    }
  }
  assert.equal(seen.size, 9);
  assert.ok(orders.size > 150);
  assert.equal(
    C.golfIndex({ course: 1 }),
    1,
    "older active rooms remain compatible",
  );
});

test("all three selected golf courses use matching authoritative tees, cups and turns", () => {
  const g = fixture("putt").game;
  const picked = [...g.putt.holes];
  for (let turn = 0; turn < 12; turn++) {
    const i = g.putt.turn,
      v = g.progress[i],
      h = C.holes[C.golfIndex(g.putt)];
    assert.deepEqual(v.ball, h.tee);
    const at = g.start + g.putt.offset + 30000;
    G.advance(g, i, at);
    assert.deepEqual(g.putt.holes, picked);
  }
  assert.ok(g.progress.every((v) => v.finished));
});

test("new authoritative climb replies replenish pending ledge prompts without leaking future holds", () => {
  const authority = { step: 3, next: ["up", "left", "down", "right"] };
  const prediction = { step: 4, next: [] };
  assert.deepEqual(I.climbNext(authority, prediction), [
    "left",
    "down",
    "right",
  ]);
  assert.deepEqual(I.climbNext(authority, { step: 7, next: [] }), []);
});

test("eight fishing bites allow a premature tug to recover on the same fish, with exact visible length", () => {
  for (const size of [0.3, 0.7, 1.1, 1.6]) {
    const g = fixture("fish").game,
      v = g.progress[0],
      b = g.fishBeats[0][0];
    b.size = size;
    assert.equal(g.fishBeats[0].length, 8);
    G.play(g, 0, { value: "reel" }, g.start + b.at - 300, fail);
    assert.equal(v.catch, undefined);
    assert.equal(v.actedBeat, undefined);
    G.play(g, 0, { value: "reel" }, g.start + b.at + 100, fail);
    assert.equal(v.catch.length, Math.round(size * 75));
    assert.throws(
      () => G.play(g, 0, { value: "reel" }, g.start + b.at + 400, fail),
      /finished/,
    );
  }
});

test("every lantern fake-out resolves against the second card even for a last-moment jump", () => {
  const g = fixture("lantern").game;
  for (const b of g.beats.filter((b) => b.fake)) {
    g.lanternLast = null;
    g.progress.forEach((v) =>
      Object.assign(v, {
        finished: null,
        eliminatedAt: null,
        moveAt: 0,
        chosen: null,
        resolved: b.index - 1,
        inputs: 1,
      }),
    );
    const finalTile = R.lanternTile(b),
      wrongTile = b.layout.indexOf(b.decoy),
      due = g.start + b.at + b.window;
    G.play(g, 0, { value: finalTile }, due - 81, fail);
    G.play(g, 1, { value: wrongTile }, due - 500, fail);
    G.advance(g, 0, due);
    G.advance(g, 1, due);
    assert.ok(!g.progress[0].eliminatedAt);
    assert.equal(g.progress[1].eliminatedAt, due);
    assert.equal(g.lanternLast.safeTile, finalTile);
  }
});

test("hop resolves on contact, awards exactly 300, and enforces 2.5 seconds of recovery", () => {
  for (const size of ["small", "medium", "large"]) {
    const g = fixture("hop").game,
      b = g.beats[0],
      v = g.progress[0];
    b.size = size;
    const contact = g.start + b.at;
    G.play(
      g,
      0,
      { value: "jump" },
      contact - R.hopDuration(size) / 2 + 100,
      fail,
    );
    G.advance(g, 0, contact - 1);
    assert.equal(g.scores[0], 0);
    G.advance(g, 0, contact);
    assert.equal(g.scores[0], 300);
    const missed = fixture("hop").game,
      c = missed.start + missed.beats[0].at;
    G.advance(missed, 0, c);
    assert.equal(missed.progress[0].hitAt, c);
    assert.equal(missed.progress[0].stunUntil, c + 2500);
    assert.throws(
      () => G.play(missed, 0, { value: "jump" }, c + 1400, fail),
      /Dizzy/,
    );
    const next = missed.beats[1];
    assert.ok(
      next.at - missed.beats[0].at > 2500 + R.hopDuration(next.size) / 2,
    );
    assert.doesNotThrow(() =>
      G.play(
        missed,
        0,
        { value: "jump" },
        missed.start + next.at - R.hopDuration(next.size) / 2 + 100,
        fail,
      ),
    );
  }
});
