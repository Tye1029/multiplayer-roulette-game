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
    cup = C.holes[C.golfIndex(g.putt)].cup;
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
  G.advance(g, 0, at + 1700);
  const score = g.scores[0];
  G.advance(g, 0, at + 1900);
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
test("accepted delayed replies preserve lane clocks without overriding authoritative outcomes", () => {
  const v = { last: 1250, moveAt: 1250, chosen: 2, score: 25 };
  const input = {
    game: "lantern",
    at: 1000,
    serverAt: 1250,
    pending: false,
    fields: { chosen: 2, score: 99999 },
  };
  const shown = I.presentation(v, input);
  assert.equal(shown.moveAt, 1000);
  assert.equal(shown.score, 25);
  assert.equal(v.moveAt, 1250);
  assert.equal(I.presentation({ ...v, last: 1400 }, input).moveAt, 1250);
  assert.equal(I.presentation(v, { ...input, rejected: true }).moveAt, 1250);
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
test("Fish have eight spaced bites, honest lengths, and six landed species", () => {
  for (let species = 0; species < 6; species++) {
    const s = fixture("fish"),
      g = s.game,
      b = g.fishBeats[0][0];
    assert.equal(g.fishBeats[0].length, 8);
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
    input(s, 0, "jump", at + 100);
    assert.equal(
      prediction.fields.jumpDuration,
      s.game.progress[0].jumpDuration,
    );
    assert.equal(prediction.fields.jumpAt, at);
    G.advance(s.game, 0, s.game.start + b.at + 180);
    assert.ok(s.game.scores[0] > 0);
  }
});
test("hop scores physical clearance, rejects duplicate jumps and ignores forged input clocks", () => {
  for (const size of ["small", "medium", "large"])
    for (const delta of [-200, -80, 0, 80, 150]) {
      const s = fixture("hop"),
        b = s.game.beats[0];
      b.size = size;
      b.speed = 0.009;
      const contact = s.game.start + b.at,
        at = contact - R.hopDuration(size) / 2 + delta + 100;
      input(s, 0, "jump", at, {
        clientAt: contact - 400,
        inputAt: contact - 400,
      });
      assert.equal(
        s.game.scores[0],
        0,
        "points wait until the obstacle passes",
      );
      assert.throws(
        () => input(s, 0, "jump", at + 131),
        /next signal|next log/,
      );
      G.advance(s.game, 0, contact + 180);
      assert.equal(s.game.scores[0] > 0, R.hopClear(b, contact, at - 100));
    }
});
