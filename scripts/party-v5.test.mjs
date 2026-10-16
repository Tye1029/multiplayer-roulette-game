import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url),
  M = require("../netlify/functions/party/model"),
  C = require("../assets/party/catalog"),
  G = require("../netlify/functions/party/minigames");
function fixture(id, count = 4) {
  const people = Array.from({ length: count }, (_, i) => ({
    id: String(i),
    name: "Friend " + i,
    character: C.characters[i].id,
    characterPicked: true,
    bot: true,
  }));
  const s = M.create("ABC234", people[0], "party", 10000);
  people.slice(1).forEach((p) => M.join(s, p));
  M.begin(s, 10000);
  s.phase = "board-end";
  s.deadline = 11000;
  M.advance(s, 11000);
  s.players.forEach((p) => (p.bot = false));
  Object.assign(s.game, {
    id,
    start: 20000,
    end: 55000,
    duration: 35000,
    simAt: 20000,
  });
  s.phase = "playing";
  s.deadline = 55000;
  G.setup(s.game);
  return s;
}
const play = (s, i, value, now, extra = {}) =>
  M.act(
    s,
    String(i),
    {
      action: "play",
      round: s.round,
      game: s.game.id,
      start: s.game.start,
      value,
      ...extra,
    },
    now,
  );

test("50 connected spaces include a central crossing, three shops and clear landmark footprints", () => {
  assert.equal(C.spaces.length, 50);
  assert.equal(C.spaces.filter((s) => s.type === "shop").length, 3);
  const cross = C.branches.find((b) => b.central);
  assert.ok(cross && cross.types.length === 8);
  const middle = C.spaces.filter((n) => n.district === cross.name);
  assert.ok(middle.some((n) => Math.hypot(n.x, n.z) < 3));
  for (const p of C.scenery)
    assert.ok(
      C.pathDistance(p.x, p.z) > p.radius + 1.4,
      p.kind + " touches a route",
    );
  for (const a of C.spaces)
    for (const b of C.spaces) {
      if (a.id >= b.id) continue;
      assert.ok(
        Math.hypot(a.x - b.x, a.z - b.z) > 2.24,
        `spaces ${a.id}/${b.id} overlap`,
      );
    }
});
test("33 party games and six exclusive duels have distinct complete instructions and controls", () => {
  assert.equal(C.games.length, 39);
  assert.equal(new Set(C.games.map((g) => g.id)).size, 39);
  assert.equal(C.games.filter((g) => g.duelOnly).length, 6);
  for (const d of C.games) {
    assert.ok(d.rules.length > 100);
    if (d.engine === "festival") assert.ok(d.controls.length > 0);
  }
  const s = fixture("fish");
  s.usedGames = [];
  for (let n = 0; n < 33; n++) {
    s.phase = "board-end";
    s.deadline = 12000 + n;
    M.advance(s, s.deadline);
    assert.ok(!C.games.find((g) => g.id === s.game.id).duelOnly);
  }
  const partyIds = s.usedGames.filter(
    (id) => !C.games.find((g) => g.id === id).duelOnly,
  );
  assert.equal(new Set(partyIds).size, 33);
});
test("board decisions allow 60 seconds and minigame results hold for 5", () => {
  const s = fixture("fish");
  s.phase = "round-end";
  s.deadline = 55000;
  M.advance(s, 55000);
  assert.equal(s.deadline - 55000, 60000);
  const r = fixture("fish");
  play(r, 0, "reel", 22200);
  M.advance(r, 55000);
  assert.equal(r.phase, "measuring");
  M.advance(r, r.deadline);
  assert.equal(r.phase, "round-end");
  assert.equal(r.deadline - r.game.resultAt, 5000);
});
test("Coin Cascade spikes subtract only collected coins", () => {
 const s=fixture("cascade"),g=s.game,v=g.progress[0];g.beats[0].values=[4,0,0];play(s,0,"left",21100);
 G.advance(g,0,g.start+g.beats[0].at+g.beats[0].window);assert.equal(v.collected,4);
 for(let i=1;i<3;i++){g.beats[i].values=[-3,0,0];G.advance(g,0,g.start+g.beats[i].at+g.beats[i].window);assert.equal(v.collected,i===1?1:0);}
 assert.equal(g.scores[0],0);const before=s.players[0].tokens;M.advance(s,g.end);assert.equal(s.players[0].tokens-before,v.collected);assert.equal(g.coinAwards[0],v.collected);
});
test("Lantern Landing eliminates on one wrong platform; an eliminated player cannot move", () => {
  const s = fixture("lantern"),
    g = s.game,
    b = g.beats[0];
  for (let i = 0; i < 4; i++)
    play(s, i, i === 0 ? (b.color + 1) % 4 : b.color, 21500);
  M.advance(s, g.start + b.at + b.window + 1);
  assert.ok(g.progress[0].eliminatedAt);
  assert.ok(!g.progress[1].finished);
  assert.throws(() => play(s, 0, b.color, 23500), /finished/);
});
test("finish bonuses rank earlier racers higher, exact-time ties share placement, and slips cannot farm milestones", () => {
  const s = fixture("climb"),
    g = s.game;
  for (const i of [0, 1]) {
    for (let n = 0; n < 24; n++)
      play(s, i, g.sequence[n], 21000 + n * 200 + i * 100);
  }
  assert.ok(g.scores[0] > g.scores[1]);
  assert.equal(g.progress[0].finishPlace, 1);
  const same = fixture("climb");
  G.festival.finishRace(same.game, 0, 30000);
  G.festival.finishRace(same.game, 1, 30000);
  assert.equal(same.game.scores[0], same.game.scores[1]);
  const farm = fixture("climb"),
    v = farm.game.progress[0];
  for (let n = 0; n < 5; n++)
    play(farm, 0, farm.game.sequence[n], 21000 + n * 200);
  const bonus = v.bonus;
  for (let n = 0; n < 8; n++) {
    const wrong = ["up", "down", "left", "right"].find(
      (x) => x !== farm.game.sequence[v.step],
    );
    play(farm, 0, wrong, 23000 + n * 1000);
    for (let k = 0; k < 2; k++)
      play(farm, 0, farm.game.sequence[v.step], 23200 + n * 1000 + k * 200);
  }
  assert.equal(v.bonus, bonus);
});
test("sealed duel moves and future confetti outcomes are absent from every public view", () => {
  const s = fixture("fencing", 2);
  play(s, 0, "rock", 21000);
  for (const who of ["0", "1"]) {
    const pub = M.view(s, who, 21100);
    assert.equal(pub.game.privateChoices, undefined);
    assert.equal(pub.game.orders, undefined);
    assert.equal(pub.game.beats, undefined);
    assert.equal(pub.game.progress[0].chosen, undefined);
    assert.equal(pub.game.progress[0].reveal, undefined);
  }
  assert.equal(M.view(s, "0", 21100).game.progress[0].locked, true);
  play(s, 1, "scissors", 21100);
  M.advance(s, 22251);
  assert.equal(s.game.scores[0], 300);
  assert.equal(s.game.scores[1], 0);
  assert.throws(() => play(s, 0, "rock", 21200), /Wait/);
  const c = fixture("confetti");
  assert.equal(M.view(c, "0", 21000).game.cue.trap, undefined);
});
test("coconut projectiles cancel on swept collisions even across a delayed update", () => {
  const s = fixture("cannon"),
    g = s.game;
  g.shared.shots = [
    { owner: 0, at: 21000, x: -5, z: 0, dx: 0.01, dz: 0 },
    { owner: 1, at: 21000, x: 5, z: 0, dx: -0.01, dz: 0 },
  ];
  G.advance(g, 0, 22200);
  assert.ok(g.shared.shots.every((x) => x.cancelled));
  assert.ok(g.progress.every((v) => v.health === 3));
});
test("Captain's Orders rewards restraint on fake orders and penalizes obeying them", () => {
  const s = fixture("simon"),
    g = s.game,
    b = g.beats[0];
  b.fake = true;
  g.progress[0].inputs = 1;
  g.scores[1] = 300;
  play(s, 1, b.action, 21700);
  G.advance(g, 0, g.start + b.at + b.window + 1);
  assert.equal(g.scores[0], 220);
  assert.equal(g.scores[1], 150);
});
test("all-bot skipping runs the rules, conserves escrow and rejects human showdowns and replays", () => {
  const s = fixture("draft");
  s.game.sideDuel = true;
  s.game.participants = ["1", "2"];
  s.game.active = [1, 2];
  s.players[1].bot = s.players[2].bot = true;
  s.game.stake = { amount: 3, currency: "coins", players: ["1", "2"] };
  s.players[1].tokens -= 3;
  s.players[2].tokens -= 3;
  G.setup(s.game);
  const b = {
    action: "skip-bots",
    preparedAt: s.game.preparedAt,
    round: s.round,
    game: "draft",
    start: 20000,
  };
  M.act(s, "0", b, 20500);
  assert.equal(s.phase, "side-result");
  assert.equal(s.deadline, 25500);
  assert.ok(s.game.progress[1].inputs > 0 && s.game.progress[2].inputs > 0);
  assert.equal(s.players[1].tokens + s.players[2].tokens, 20);
  assert.throws(() => M.act(s, "0", b, 20600), /all-bot/);
  const h = fixture("draft", 2);
  h.game.sideDuel = true;
  assert.throws(() => M.act(h, "0", b, 20500), /all-bot/);
});
test("all 39 games complete under sparse polls, validate controls and keep finite authoritative scores", () => {
  for (const def of C.games) {
    const s = fixture(def.id, def.duelOnly ? 2 : 4),
      g = s.game;
    if (G.handled(def.id))
      assert.throws(
        () => play(s, 0, { score: 999999 }, 21000),
        (e) => e.status === 400 || e.status === 409,
      );
    s.players.forEach((p) => (p.bot = true));
    for (let time = 20000; time <= g.end + 2000 && s.phase === "playing"; time += 1100)
      M.advance(s, time);
    if (def.id === "fish") {
      assert.equal(s.phase, "measuring");
      M.advance(s, s.deadline);
    }
    assert.equal(s.phase, "round-end", def.id);
    assert.ok(
      g.progress.some((v) => v.inputs > 0),
      def.id + " has no active play",
    );
    assert.ok(
      g.scores.every((n) => Number.isInteger(n) && n >= 0 && n < 100000),
      def.id,
    );
    assert.ok(
      g.matchPoints.every((n) => [0, 250, 400, 650, 1000].includes(n)),
      def.id,
    );
    assert.ok(s.players.every((p) => p.tokens >= 0));
    assert.equal(M.view(s, "0", 57000).game.orders, undefined);
  }
});

test("bot skip remains valid across the automatic ready-to-countdown transition", () => {
  const s = fixture("draft"),
    g = s.game;
  g.sideDuel = true;
  g.participants = ["1", "2"];
  g.active = [1, 2];
  g.duration = 20000;
  s.players[1].bot = s.players[2].bot = true;
  G.setup(g);
  s.phase = "intro";
  s.deadline = 80000;
  const request = {
    action: "skip-bots",
    round: s.round,
    game: g.id,
    start: g.start,
    preparedAt: g.preparedAt,
  };
  M.advance(s, 20500);
  assert.equal(s.phase, "countdown");
  assert.notEqual(request.start, g.start);
  M.act(s, "0", request, 20501);
  assert.equal(s.phase, "side-result");
  assert.equal(s.deadline, 25501);
  assert.equal(g.resultAt, 20501);
  assert.ok(g.progress[1].last <= 20501 && g.progress[2].last <= 20501);
});
