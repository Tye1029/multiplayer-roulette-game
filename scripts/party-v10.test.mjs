import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url),
  M = require("../netlify/functions/party/model"),
  G = require("../netlify/functions/party/minigames"),
  R = require("../assets/party/rules"),
  I = require("../assets/party/interaction");

test("party golf has curved hazards and safe tee/cup positions without changing legacy courses", () => {
  const C = require("../assets/party/catalog"),
    P = require("../shared/games/mini-golf-physics"),
    legacy = require("../shared/games/mini-golf-courses");
  assert.equal(legacy.get("skybridge").holes[0].floor.length, 4);
  C.holes.forEach((h) => {
    assert.ok(h.floor.length > 4);
    assert.ok(P.safe(h, h.tee));
    assert.ok(P.safe(h, h.cup));
    for (const r of h.visualWater) {
      assert.equal(P.safe(h, [r.x + r.w / 2, r.y + r.h / 2]), false);
      assert.equal(P.safe(h, [r.x + 2, r.y + 2]), true);
    }
  });
});
test("a real golf shot creates one hole celebration and cannot score twice", () => {
  const s = fixture("putt"),
    C = require("../assets/party/catalog"),
    g = s.game,
    v = g.progress[0],
    cup = C.holes[0].cup;
  v.ball = [cup[0] - 20, cup[1]];
  input(s, 0, "putt", 21000, { angle: 0, power: 0.06 });
  assert.equal(v.shot.holed, true);
  const at = v.shot.at + v.shot.duration;
  G.advance(g, 0, at);
  assert.deepEqual(g.putt.holeEvent, { at, course: 0, player: 0 });
  assert.throws(
    () => input(s, 0, "putt", at + 400, { angle: 0, power: 0.06 }),
    /cup/,
  );
  G.advance(g, 0, at + 750);
  const score = g.scores[0];
  G.advance(g, 0, at + 900);
  assert.equal(g.scores[0], score);
  assert.ok(score > 0);
});
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
  s.game.start = 20000;
  s.game.end = 20000 + s.game.duration;
  s.deadline = s.game.end;
  s.game.progress.forEach((v) => (v.showAt = 20000));
  return s;
}
function input(s, i, value, at, extra = {}) {
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
test("accepted delayed replies preserve pose clocks without overriding authoritative outcomes", () => {
  const v = { last: 1250, jumpAt: 1250, step: 4, score: 25 },
    input = {
      game: "hop",
      at: 1000,
      serverAt: 1250,
      pending: false,
      fields: { jumpAt: 1000, score: 99999 },
    };
  const shown = I.presentation(v, input);
  assert.equal(shown.jumpAt, 1000);
  assert.equal(shown.score, 25);
  assert.equal(v.jumpAt, 1250);
  assert.equal(I.presentation({ ...v, last: 1400 }, input).jumpAt, 1250);
  assert.equal(I.presentation(v, { ...input, rejected: true }).jumpAt, 1250);
  assert.equal(
    I.presentation(
      { last: 1250, lane: 2, moveAt: 1250 },
      { ...input, game: "cascade", fields: { lane: 2 } },
    ).moveAt,
    1000,
  );
});
test("Afterglow has an authoritative preparation beat, visible current steps, and sealed other patterns", () => {
  const s = fixture("memory"),
    v = s.game.progress[0],
    open = v.showAt + R.memoryReady + v.pattern.length * R.memoryBeat + 300;
  assert.throws(() => input(s, 0, v.pattern[0], open - 1), /Watch/);
  input(s, 0, v.pattern[0], open);
  assert.equal(v.padAt, open);
  assert.equal(v.cursor, 1);
  const out = M.view(s, s.host, 21300);
  assert.equal(out.game.progress[1].pattern, undefined);
  assert.equal(out.game.progress[1].demoPad, s.game.progress[1].pattern[0]);
  assert.equal(M.view(s, s.host, 20500).game.progress[1].demoPad, null);
  const current = v.pattern.slice(1);
  current.forEach((n, j) => input(s, 0, n, open + 200 * (j + 1)));
  assert.ok(v.showAt > open);
  assert.equal(v.cursor, 0);
});
test("500 Cascade layouts leave a safe lane across overlapping rows", () => {
  for (let n = 0; n < 500; n++) {
    const g = fixture("cascade").game;
    for (const b of g.beats) {
      const visible = g.beats.filter((x) => x.at <= b.at && x.at > b.at - 2200);
      // The visible collision approach lasts 2s; a disappearing row lasts .2s.
      const hazards = visible.reduce(
        (n, x) => n + x.values.filter((v) => v < 0).length,
        0,
      );
      assert.ok(
        hazards <= 2,
        "never three simultaneous spike balls per player",
      );
      assert.ok(
        [0, 1, 2].some((lane) => visible.every((x) => x.values[lane] >= 0)),
      );
    }
  }
});
test("Cascade stun cannot be bypassed and grants immunity while the player cannot move", () => {
  const s = fixture("cascade"),
    g = s.game,
    v = g.progress[0];
  g.scores[0] = v.collected = 10;
  v.inputs = 1;
  g.beats[0].values = [1, -3, 1];
  const due = g.start + g.beats[0].at + g.beats[0].window;
  G.advance(g, 0, due);
  assert.equal(g.scores[0], 7);
  assert.equal(v.stunUntil, due + 2000);
  assert.throws(() => input(s, 0, "left", due + 300), /stars/);
  g.beats[1].values = [1, -3, 1];
  G.advance(g, 0, g.start + g.beats[1].at + g.beats[1].window);
  assert.equal(g.scores[0], 7);
  input(s, 0, "left", due + 2001);
  assert.equal(v.lane, 0);
});
test("Fish have four spaced bites, honest lengths, and six landed species", () => {
  for (let species = 0; species < 6; species++) {
    const s = fixture("fish"),
      g = s.game,
      b = g.fishBeats[0][0];
    assert.equal(g.fishBeats[0].length, 4);
    assert.ok(g.fishBeats[0][1].at - b.at > 7000);
    b.size = 0.3 + species * 0.26;
    b.species = species;
    input(s, 0, "reel", g.start + b.at + 500);
    assert.equal(g.progress[0].catch.length, Math.round(b.size * 75));
    assert.equal(g.progress[0].catch.rarity, R.fishSpecies[species]);
    assert.throws(() => input(s, 0, "reel", g.start + b.at + 800), /finished/);
  }
});
test("instant hop prediction follows the same size-dependent airborne time", () => {
  globalThis.PartyExpansionRules = require("../assets/party/expansion-rules");
  for (const size of ["small", "medium", "large"]) {
    const s = fixture("hop"),
      b = s.game.beats[0];
    b.size = size;
    const at =
        s.game.start + b.at - globalThis.PartyExpansionRules.waveLead(size),
      view = M.view(s, s.host, at);
    const prediction = I.predict(view, "jump", at);
    input(s, 0, "jump", at);
    assert.equal(
      prediction.fields.jumpDuration,
      s.game.progress[0].jumpDuration,
    );
    assert.equal(prediction.fields.jumpAt, at);
    assert.ok(s.game.scores[0] > 0);
  }
});
test("hop tolerates delivery delay without trusting client timestamps or duplicate jumps", () => {
  const X = require("../assets/party/expansion-rules");
  for (const delta of [-141, -140, 175, 320, 321]) {
    const s = fixture("hop"),
      b = s.game.beats[0];
    const at = s.game.start + b.at - X.waveLead(b.size) + delta;
    input(s, 0, "jump", at, { clientAt: at - delta, inputAt: at - delta });
    assert.equal(s.game.scores[0] > 0, delta >= -140 && delta <= 320);
    const score = s.game.scores[0];
    assert.throws(() => input(s, 0, "jump", at + 131), /next signal/);
    assert.equal(s.game.scores[0], score);
  }
});
