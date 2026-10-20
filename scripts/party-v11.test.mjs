import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url),
  M = require("../netlify/functions/party/model"),
  G = require("../netlify/functions/party/minigames"),
  C = require("../assets/party/catalog"),
  R = require("../assets/party/rules"),
  P = require("../assets/party/presentation");
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
  s.game.simAt = 20000;
  s.game.end = 20000 + s.game.duration;
  s.deadline = s.game.end;
  s.game.progress.forEach((v) => (v.showAt = 20000));
  return s;
}
function input(s, value, at) {
  M.act(
    s,
    s.players[0].id,
    {
      action: "play",
      round: s.round,
      game: s.game.id,
      start: s.game.start,
      value,
    },
    at,
  );
}
test("clock corrections slew without reversing or skipping animation time", () => {
  const c = P.clock();
  c.sample(1100, 1000, 1100);
  let previous = c.now(1100);
  for (let local = 1116; local < 5000; local += 16) {
    if (local % 5 === 0)
      c.sample(local + (local % 2 ? 800 : -800), local - 100, local);
    const now = c.now(local);
    assert.ok(now >= previous);
    assert.ok(now - previous <= 16.65);
    previous = now;
  }
  const before = c.info();
  c.sample(1e12, 5000, 8001);
  assert.deepEqual(c.info(), before, "ignore cold-start samples");
});
test("late falls start visibly and their clocks do not restart on each poll", () => {
  const cache = {};
  assert.equal(P.eventStart(cache, "fall", 1000, 1800), 1720);
  assert.equal(P.eventStart(cache, "fall", 1000, 2400), 1720);
  assert.equal(P.eventStart(cache, "fall", 3000, 3001), 3000);
});
test("golf never rewinds while waiting for a resolved-shot poll", () => {
  const shot = {
    frames: [
      [0, 0, 0, 1, 0],
      [500, 50, 20, 1, 0],
      [1000, 100, 40, 1, 0],
    ],
    duration: 1000,
  };
  assert.deepEqual(P.shotFrame(shot, 250), [250, 25, 10, 1, 0]);
  assert.deepEqual(P.shotFrame(shot, 3000), shot.frames.at(-1));
  assert.deepEqual(P.shotFrame(shot, -20), shot.frames[0]);
});
test("a water penalty disappears at the splash and reappears at the shot origin", () => {
  const shot = {
    frames: [
      [0, 0, 0, 1, 0],
      [500, 100, 100, 1, 0],
      [1150, 0, 0, 1, 0],
    ],
    duration: 1150,
    position: [0, 0],
    events: [{ type: "splash", at: 500, x: 100, y: 100 }],
  };
  assert.deepEqual(P.shotFrame(shot, 800).slice(1, 4), [100, 100, 0]);
  const back = P.shotFrame(shot, 1050);
  assert.deepEqual(back.slice(1, 3), [0, 0]);
  assert.ok(back[3] > 0 && back[3] < 1);
});
test("delayed golf replies preserve the entire shot and cup celebration before a new turn", () => {
  const a = fixture("putt"),
    v = a.game.progress[0];
  v.shot = {
    at: 21000,
    course: 0,
    duration: 500,
    holed: true,
    frames: [
      [0, 1, 1, 1, 0],
      [500, 5, 5, 0, 0],
    ],
  };
  const p = P.golfPlayback(),
    shown = p.update(a, 22000);
  assert.equal(shown.game.progress[0].shot.at, 21930);
  assert.equal(shown.game.progress[0].holed, false);
  const b = structuredClone(a);
  b.game.putt.turn = 1;
  b.game.progress[1].shot = null;
  assert.equal(p.update(b, 22500).game.putt.turn, 0);
  assert.equal(p.busy(22500), true);
  assert.equal(p.update(b, 24000).game.putt.turn, 1);
  assert.equal(p.busy(24000), false);
  assert.equal(
    a.game.progress[0].shot.at,
    21000,
    "presentation never mutates state",
  );
});
test("Mountain Climber replaces the old title and Coin Cascade cannot be started", () => {
  assert.equal(C.games.find((g) => g.id === "climb").name, "Mountain Climber");
  assert.equal(
    C.games.some((g) => g.id === "cascade"),
    false,
  );
  const s = fixture("fish");
  assert.throws(() => M.testStart(s, "cascade", 20000));
  s.game.id = "cascade";
  M.advance(s, 21000);
  assert.equal(s.phase, "expired");
  assert.equal(s.game, null);
});
test("fishing advertises a full minute and private catches stay server-owned", () => {
  const s = fixture("fish");
  assert.equal(s.game.duration, 60000);
  assert.equal(s.game.end - s.game.start, 60000);
  const out = M.view(s, s.players[0].id, 21000);
  assert.equal(out.game.fishBeats, undefined);
  assert.ok(s.game.fishBeats.flat().every((b) => b.at + b.window < 60000));
});
test("Afterglow reverses precisely two patterns, doubles rewards and keeps mistakes at 50", () => {
  const s = fixture("memory"),
    g = s.game,
    v = g.progress[0];
  g.end = 300000;
  const reverses = [];
  for (let round = 0; round < 8; round++) {
    const isReverse = v.reverse,
      level = v.level,
      combo = v.combo,
      score = g.scores[0];
    if (isReverse) reverses.push(round);
    const pattern = [...v.pattern];
    if (isReverse) pattern.reverse();
    let at = v.showAt + R.memoryReady + pattern.length * R.memoryBeat + 301;
    pattern.forEach((n) => {
      input(s, n, at);
      at += 160;
    });
    assert.equal(
      g.scores[0] - score,
      (level * 100 + (combo + 1) * 50) * (isReverse ? 2 : 1),
    );
  }
  assert.deepEqual(reverses, [2, 4]);
  v.reverse = true;
  v.pattern = [0, 1, 2];
  v.cursor = 0;
  v.showAt = 100000;
  const before = g.scores[0];
  input(s, 0, 103451); // forward first input is incorrect when reversing
  assert.equal(before - g.scores[0], 50);
});
test("Lantern decoys do not reveal the final color and leave time to jump after the switch", () => {
  const s = fixture("lantern"),
    g = s.game;
  for (const b of g.beats.filter((b) => b.fake)) {
    g.lanternLast = null;
    const reveal = g.start + b.at - 1800,
      decoy = G.cue(g, reveal + 1),
      final = G.cue(g, reveal + 851);
    assert.equal(decoy.index, b.index);
    assert.equal(decoy.color, b.decoy);
    assert.notEqual(decoy.color, b.color);
    assert.equal(decoy.decoy, undefined);
    assert.equal(decoy.fake, undefined);
    assert.equal(final.color, b.color);
    assert.ok(g.start + b.at + b.window - (reveal + 850) > 420 + 700);
  }
});
test("500 randomized log sequences have physical clearance, varied speed and size, and fair spacing", () => {
  const speeds = new Set(),
    sizes = new Set();
  for (let n = 0; n < 500; n++) {
    const g = fixture("hop").game;
    g.beats.forEach((b, i) => {
      speeds.add(b.speed);
      sizes.add(b.size);
      const contact = g.start + b.at,
        ideal = contact - R.hopDuration(b.size) / 2;
      assert.equal(R.hopClear(b, contact, ideal), true);
      assert.equal(R.hopClear(b, contact, contact), false);
      assert.equal(R.hopHeight(R.hopDuration(b.size), b.size), 0);
      if (i) assert.ok(b.at - g.beats[i - 1].at > R.hopDuration(b.size) + 500);
    });
  }
  assert.equal(sizes.size, 3);
  assert.equal(speeds.size, 6);
});
test("visible logs continue beyond collision instead of disappearing when the cue advances", () => {
  const g = fixture("hop").game,
    b = g.beats[0],
    out = {};
  G.publicView(g, out, g.start + b.at + 1000, 0);
  assert.ok(out.rollers.some((r) => r.index === 0));
  G.publicView(g, out, g.start + b.at + 6000, 0);
  assert.equal(
    out.rollers.some((r) => r.index === 0),
    false,
  );
});
test("reconnecting to a resolved golf shot does not replay it from its old origin", () => {
  const s = fixture("putt"),
    v = s.game.progress[0];
  v.shot = {
    at: 21000,
    course: 0,
    duration: 500,
    resolved: true,
    holed: false,
    frames: [
      [0, 1, 1, 1, 0],
      [500, 5, 5, 1, 0],
    ],
  };
  const p = P.golfPlayback(),
    shown = p.update(s, 24000);
  assert.equal(shown.game.progress[0].shot.at, 21000);
  assert.equal(p.busy(24000), false);
});
test("golf clips the displayed trajectory at the turn deadline", () => {
  const s = fixture("putt");
  M.act(
    s,
    s.players[0].id,
    {
      action: "play",
      round: s.round,
      game: "putt",
      start: s.game.start,
      value: "putt",
      angle: -1,
      power: 1,
    },
    49900,
  );
  const shot = s.game.progress[0].shot;
  assert.equal(shot.duration, 100);
  assert.ok(shot.frames.every((f) => f[0] <= 100));
  assert.equal(shot.holed, false);
  assert.deepEqual(shot.frames.at(-1).slice(1, 3), shot.position);
  G.advance(s.game, 0, 50000);
  assert.equal(s.game.putt.turn, 1);
});
