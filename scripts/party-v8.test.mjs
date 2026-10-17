import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url),
  M = require("../netlify/functions/party/model"),
  G = require("../netlify/functions/party/minigames"),
  C = require("../assets/party/catalog"),
  E = require("../netlify/functions/party/expansion-games"),
  Ceremony = require("../netlify/functions/party/ceremony"),
  R = require("../assets/party/expansion-rules");
function fixture(id) {
  const s = M.create(
    "ABC234",
    { id: "0", name: "Friend 0", character: "ghost", characterPicked: true },
    "party",
    10000,
  );
  for (let i = 1; i < 4; i++)
    M.join(s, {
      id: String(i),
      name: "Friend " + i,
      character: C.characters[i].id,
      characterPicked: true,
    });
  s.ready = s.players.map((p) => p.id);
  M.begin(s, 10000);
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
    s.deadline = s.game.end;
  }
  return s;
}
const act = (s, i, action, b = {}, at = 22000) =>
  M.act(
    s,
    String(i),
    { action, round: s.round, game: s.game?.id, start: s.game?.start, ...b },
    at,
  );
const play = (s, i, value, at = 22000, more = {}) =>
  act(s, i, "play", { value, ...more }, at);
const fail = (message) => {
  throw Error(message);
};
test("opening dice are server-owned, tied seats reroll, and the full order persists", () => {
  const s = fixture();
  assert.equal(s.phase, "order-roll");
  assert.throws(() => act(s, 0, "roll"), /already/);
  act(s, 0, "order-roll", { value: 999 });
  assert.ok(s.orderRolls[0][0] >= 1 && s.orderRolls[0][0] <= 6);
  assert.throws(() => act(s, 0, "order-roll"), /already/);
  s.orderRolls = [[6], [6], [3], [1]];
  s.phase = "order-reveal";
  s.deadline = 25000;
  M.advance(s, 25000);
  assert.deepEqual(s.orderPending, [0, 1]);
  assert.throws(() => act(s, 2, "order-roll", {}, 25100), /already/);
  s.orderRolls = [[6, 2], [6, 5], [3], [1]];
  s.phase = "order-reveal";
  s.deadline = 26000;
  M.advance(s, 26000);
  assert.deepEqual(s.turnOrder, [1, 0, 2, 3]);
  assert.equal(s.turn, 1);
  for (const seat of [1, 0, 2, 3]) {
    assert.equal(s.turn, seat);
    s.phase = "space";
    s.event = { kind: "coins" };
    s.movement = null;
    act(s, seat, "continue", {}, 27000);
  }
  assert.equal(s.phase, "board-end");
  M.advance(s, s.deadline);
  assert.equal(s.phase, "selection");
  M.advance(s, s.deadline);
  assert.equal(s.phase, "intro");
  s.phase = "round-end";
  s.deadline = 95000;
  M.advance(s, 95000);
  assert.equal(s.turn, 1);
  assert.deepEqual(s.turnOrder, [1, 0, 2, 3]);
});
test("taxi is 25 coins and only sold on the bottom route; no starting parcel", () => {
  assert.equal(C.items.find((i) => i.id === "warp").cost, 25);
  assert.deepEqual(
    Object.entries(C.shops)
      .filter(([, s]) => s.stock.includes("warp"))
      .map(([id]) => +id),
    [39],
  );
  assert.equal(C.spaces[39].district, "Harbor loop");
  assert.ok(C.spaces.slice(0, 5).every((s) => s.type !== "gift"));
  assert.ok(!C.games.some((g) => g.id === "treasure"));
});
test("trophy costs 20, celebrates once, flies to its next stop and cannot consume the landing", () => {
  const s = fixture();
  s.turn = 0;
  s.turnIndex = 0;
  s.players[0].tokens = 25;
  s.players[0].position = 9;
  s.movement = { remaining: 1 };
  s.phase = "rolling";
  s.deadline = 22000;
  M.advance(s, 22000);
  M.advance(s, s.deadline);
  act(s, 0, "buy-trophy", {}, 24000);
  assert.equal(s.phase, "trophy-flight");
  assert.equal(s.players[0].tokens, 5);
  assert.equal(s.players[0].trophies, 1);
  assert.throws(() => act(s, 0, "buy-trophy", {}, 24100), /host/);
  assert.throws(() => act(s, 0, "continue", {}, 24100), /event/);
  M.advance(s, s.deadline);
  assert.equal(s.phase, "walking");
  assert.equal(s.players[0].position, 11);
});
test("routes disclose graph distance to the trophy and coin spaces record head popups", () => {
  const s = fixture();
  s.turn = 0;
  s.phase = "choice";
  s.players[0].position = 25;
  s.movement = { remaining: 3 };
  for (const r of C.routePreviews(s))
    assert.equal(r.trophyDistance, 1 + C.distanceTo(r.next, s.goal));
  s.phase = "walking";
  s.players[0].position = 1;
  s.movement = { remaining: 0 };
  s.deadline = 22000;
  M.advance(s, 22000);
  assert.deepEqual(s.players[0].boardPopup, { at: 22000, value: 3 });
  assert.equal(s.players[0].coinsEarned, 3);
});
test("bonus trophies apply one at a time, ties share awards, reconnects cannot repeat them", () => {
  const s = fixture();
  s.players[0].wins = 5;
  s.players[1].coinsEarned = 100;
  s.players[2].spacesMoved = 80;
  s.players[3].spacesMoved = 80;
  Ceremony.startFinale(s, 20000);
  M.advance(s, 25499);
  assert.deepEqual(
    s.players.map((p) => p.trophies),
    [0, 0, 0, 0],
  );
  M.advance(s, 25500);
  assert.deepEqual(
    s.players.map((p) => p.trophies),
    [1, 0, 0, 0],
  );
  M.advance(s, 33000);
  assert.deepEqual(
    s.players.map((p) => p.trophies),
    [1, 1, 0, 0],
  );
  M.advance(s, 40000);
  assert.deepEqual(
    s.players.map((p) => p.trophies),
    [1, 1, 1, 1],
  );
  M.advance(s, 49999);
  assert.equal(s.phase, "finale");
  M.advance(s, 50000);
  assert.equal(s.phase, "complete");
  M.advance(s, 80000);
  assert.deepEqual(
    s.players.map((p) => p.trophies),
    [1, 1, 1, 1],
  );
});
test("coin showers remain visible across collection boundaries and spikes only remove collected coins", () => {
  const s = fixture("cascade"),
    g = s.game,
    v = g.progress[0],
    b = g.beats[0];
  b.values = [1, 3, -3];
  play(s, 0, "stay", 21000);
  const at = g.start + b.at + b.window;
  const before = M.view(s, "0", at - 10).game.drops;
  G.advance(g, 0, at);
  assert.equal(v.collected, 3);
  const after = M.view(s, "0", at + 10).game.drops;
  assert.ok(
    before.some((b) => b.index === 0) && after.some((b) => b.index === 0),
  );
  v.lane = 2;
  g.beats[1].values = [1, 1, -3];
  G.advance(g, 0, g.start + g.beats[1].at + g.beats[1].window);
  assert.equal(v.collected, 0);
  assert.equal(v.stunnedUntil, undefined);
});
test("rival victories count toward bonus trophies without counting refunded stakes as earnings", () => {
  const s = fixture("fencing"),
    g = s.game;
  Object.assign(g, {
    sideDuel: true,
    participants: ["0", "1"],
    active: [0, 1],
    stake: { currency: "coins", amount: 5, players: ["0", "1"] },
  });
  g.scores = [500, 100, 0, 0];
  for (const i of [0, 1]) {
    s.players[i].tokens = 5;
    g.progress[i].inputs = 1;
    g.progress[i].finished = g.start + 1000;
  }
  M.advance(s, g.end + 1);
  assert.equal(s.phase, "side-result");
  assert.equal(s.players[0].wins, 1);
  assert.equal(s.players[0].tokens, 15);
  assert.equal(s.players[0].coinsEarned, 5);
  assert.equal(s.players[1].coinsEarned, 0);
});
test("fish ripple size predicts fish length under identical reaction times", () => {
  const s = fixture("fish"),
    g = s.game;
  g.fishBeats[0][0] = { index: 0, at: 2000, window: 1100, size: 0.6 };
  g.fishBeats[1][0] = { index: 0, at: 2000, window: 1100, size: 1.2 };
  play(s, 0, "reel", 22100);
  play(s, 1, "reel", 22100);
  assert.ok(
    Math.abs(g.progress[1].catch.length / g.progress[0].catch.length - 2) <
      0.06,
  );
  assert.throws(() => play(s, 0, "reel", 22400), /finished/);
});
test("basketball scores only at hoop arrival; rim contacts bounce and duplicate shots fail", () => {
  const s = fixture("basket"),
    g = s.game;
  const at = g.start + Math.PI * 1200 - R.ballFlight;
  play(s, 0, "shoot", at);
  assert.equal(g.scores[0], 0);
  assert.throws(() => play(s, 0, "shoot", at + 200), /return/);
  G.advance(g, 0, at + R.ballFlight);
  assert.equal(g.scores[0], 500);
  G.advance(g, 0, at + 2000);
  assert.equal(g.scores[0], 500);
  play(s, 0, "shoot", at + 2200);
  G.advance(g, 0, at + 2200 + R.ballFlight);
  assert.equal(g.scores[0], 500);
});
test("band uses one original chart, accepts only timed notes, and does not expose the whole future chart", () => {
  const s = fixture("band"),
    g = s.game,
    n = g.notes[0];
  for (let i = 0; i < 4; i++) play(s, i, n.lane, g.start + n.at);
  assert.deepEqual(g.scores, [150, 150, 150, 150]);
  play(s, 0, n.lane, g.start + n.at + 160);
  assert.equal(g.scores[0], 120);
  const v = M.view(s, "0", g.start);
  assert.ok(v.game.notes.length < g.notes.length);
  assert.equal(new Set(R.songs.map((s) => s.melody.join())).size, 3);
});
test("bumper collisions push both cars, reject forged positions and eliminate at real holes", () => {
  const s = fixture("bumper"),
    g = s.game,
    a = g.progress[0],
    b = g.progress[1];
  Object.assign(a, { x: -0.8, z: 0, vx: 6, vz: 0 });
  Object.assign(b, { x: 0.8, z: 0, vx: 0, vz: 0 });
  G.advance(g, 0, 20020);
  assert.ok(b.vx > 4);
  assert.ok(a.vx < 2);
  assert.throws(() => play(s, 0, "steer", 21000, { x: 999, z: 0 }), /valid/);
  play(s, 0, "steer", 21000, { x: 1, z: 1, score: 99999, position: [99, 99] });
  assert.ok(Math.hypot(a.dir.x, a.dir.z) <= 1.001);
  assert.equal(g.scores[0], 0);
  a.x = R.holes[0][0];
  a.z = R.holes[0][1];
  a.vx = a.vz = 0;
  G.advance(g, 0, 21020);
  assert.ok(a.eliminatedAt);
});
test("volcano only exposes currently visible shadow warnings and collision uses their exact radius", () => {
  const s = fixture("volcano"),
    g = s.game,
    r = g.rocks[0];
  assert.equal(M.view(s, "0", g.start).game.rocks.length, 0);
  const v = g.progress[0];
  Object.assign(v, { x: r.x, z: r.z, vx: 0, vz: 0 });
  G.advance(g, 0, g.start + r.at);
  assert.ok(v.eliminatedAt);
  assert.ok(
    !M.view(s, "0", g.start + r.at).game.rocks.some((x) => x.at > r.at + 3000),
  );
});
test("baseball perfect swings outscore ordinary contact and pitches cannot be replayed", () => {
  const s = fixture("baseball"),
    g = s.game,
    p = g.pitches[0];
  play(s, 0, "swing", g.start + p.at);
  play(s, 1, "swing", g.start + p.at + 160);
  play(s, 2, "swing", g.start + p.at - 500);
  assert.deepEqual(g.scores.slice(0, 3), [500, 200, 0]);
  assert.throws(() => play(s, 0, "swing", g.start + p.at + 300), /pitch/);
});
test("math has five ten-second questions, three-second reveals and faster correct scores", () => {
  const s = fixture("math"),
    g = s.game;
  assert.equal(g.duration, 65000);
  assert.equal(g.questions.length, 5);
  assert.equal(M.view(s, "0", 21000).game.cue.correct, undefined);
  play(s, 0, g.questions[0].correct, 21000);
  play(s, 1, g.questions[0].correct, 25000);
  assert.throws(() => play(s, 0, 0, 26000), /locked/);
  G.advance(g, 0, 30000);
  G.advance(g, 1, 30000);
  assert.equal(g.scores[0], 460);
  assert.equal(g.scores[1], 300);
  assert.equal(M.view(s, "0", 30000).game.cue.reveal, true);
  assert.throws(() => play(s, 2, 0, 31000), /coming/);
  assert.equal(M.view(s, "0", 33000).game.cue.index, 1);
  assert.equal(M.view(s, "0", 33000).game.questions, undefined);
});
test("sliding puzzle starts solvable, accepts only adjacent swaps, and earlier finishers rank higher", () => {
  const s = fixture("puzzle"),
    g = s.game;
  assert.equal(g.duration, 60000);
  assert.deepEqual(g.progress[0].tiles, g.progress[1].tiles);
  const solution = E.solvePuzzle(g.progress[0].tiles);
  assert.ok(solution.length > 0);
  let at = 21000;
  for (const value of solution) {
    play(s, 0, value, at);
    at += 200;
  }
  assert.ok(g.progress[0].finished);
  assert.throws(() => play(s, 0, 0, at + 200), /finished/);
  assert.equal(M.view(s, "0", at).game.progress[1].tiles, undefined);
  assert.ok(g.scores[0] > g.scores[1]);
});
test("tool games retain stripping, closed-note cuts and circular warmth without leaking opponents or digits", () => {
  const panel = fixture("safe-panel"),
    h = panel.game.secrets[0].heist;
  const wrong = h.kit.find((t) => t !== h.screws[0].type);
  play(panel, 0, `screw:0:${wrong}`, 21000);
  assert.equal(panel.game.secrets[0].heist.screws[0].stripped, true);
  for (let n = 0; n < 3; n++)
    play(panel, 0, `screw:0:${h.screws[0].type}`, 21500 + n * 500);
  assert.equal(panel.game.secrets[0].heist.screws[0].removed, true);
  const wires = fixture("safe-wires");
  play(wires, 0, "card:open", 21000);
  assert.throws(() => play(wires, 0, "cut:red", 21500), /note/);
  const view = M.view(wires, "0", 21600);
  assert.equal(view.game.secrets, undefined);
  assert.equal(view.game.progress[1].panel.notePlan, undefined);
  const dial = fixture("safe-dial");
  dial.game.secrets[0].digits[0] = 0;
  play(dial, 0, 9, 21000);
  assert.equal(dial.game.progress[0].guesses[0].tier, "yellow");
  play(dial, 0, 0, 22000);
  assert.equal(dial.game.progress[0].step, 1);
  assert.equal(M.view(dial, "0", 22000).game.secrets, undefined);
});
test("golf gives only one player thirty seconds per course, uses real course features and prevents concurrent shots", () => {
  const s = fixture("putt"),
    g = s.game;
  assert.equal(g.putt.turn, 0);
  assert.throws(
    () => play(s, 1, "putt", 21000, { angle: -1, power: 0.5 }),
    /turn/,
  );
  play(s, 0, "putt", 21000, { angle: -Math.PI / 2, power: 0.5 });
  assert.throws(
    () => play(s, 0, "putt", 21300, { angle: -1, power: 0.5 }),
    /stop/,
  );
  M.advance(s, 50000);
  assert.equal(g.putt.turn, 1);
  assert.equal(g.putt.course, 0);
  assert.equal(g.start + g.putt.offset, 50500);
  assert.ok(C.holes.some((h) => h.ramps));
  assert.ok(C.holes.some((h) => h.portal && h.conveyors));
  assert.ok(C.holes.some((h) => h.gate));
});
test("all catalog games finish under sparse polling and redact secrets for each viewer", () => {
  for (const def of C.games) {
    const s = fixture(def.id),
      g = s.game;
    s.players.forEach((p) => (p.bot = true));
    if (def.duelOnly) {
      g.active = [0, 1];
      g.participants = s.players.slice(0, 2).map((p) => p.id);
    }
    for (
      let t = g.start;
      t <= g.end + 15000 && ["playing", "measuring"].includes(s.phase);
      t += 700
    )
      M.advance(s, t);
    assert.ok(
      ["round-end", "side-result"].includes(s.phase),
      def.id + " " + s.phase,
    );
    assert.ok(
      g.scores.every((n) => Number.isFinite(n) && n >= 0),
      def.id,
    );
    for (const p of s.players) {
      const v = M.view(s, p.id, g.end);
      assert.equal(v.game.secrets, undefined, def.id);
      assert.equal(v.game.questions, undefined, def.id);
      assert.equal(v.game.sequence, undefined, def.id);
    }
  }
});
