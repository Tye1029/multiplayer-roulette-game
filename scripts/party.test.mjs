import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { startPartyServer } from "./party-test-server.mjs";
const require = createRequire(import.meta.url),
  M = require("../netlify/functions/party/model"),
  C = require("../assets/party/catalog"),
  G = require("../netlify/functions/party/minigames");
const person = (id) => ({
    id,
    name: "Friend " + id,
    character: C.characters[Number(id) % 4]?.id || "raccoon",
  }),
  uuid = () => crypto.randomUUID();
function fixture(mode = "party", count = 2) {
  const s = M.create("ABC234", person("0"), mode, 10000);
  for (let i = 1; i < count; i++) M.join(s, person(String(i)));
  s.players.forEach((p, i) =>
    M.act(
      s,
      p.id,
      { action: "pick-character", character: C.characters[i].id },
      10500,
    ),
  );
  s.ready = s.players.map((p) => p.id);
  M.act(s, "0", { action: "start" }, 11000);
  s.startingSeat = s.turn = 0;
  return s;
}
function gameFixture(id) {
  const s = fixture("duel");
  s.game.id = id;
  s.phase = "playing";
  s.game.start = 20000;
  s.game.end = 55000;
  s.deadline = 55000;
  G.setup(s.game);
  for (const p of s.game.progress) p.showAt = 20000;
  return s;
}
const input = (s, id, value, at, more = {}) =>
  M.act(
    s,
    id,
    {
      action: "play",
      round: s.round,
      game: s.game.id,
      start: s.game.start,
      value,
      ...more,
    },
    at,
  );
function landing(type) {
  const s = fixture();
  s.phase = "walking";
  s.players[0].position = C.spaces.find((n) => n.type === type).id;
  s.movement = { remaining: 0 };
  s.deadline = 12000;
  M.advance(s, 12000);
  return s;
}

test("rooms enforce readiness, capacity and host ownership", () => {
  const s = M.create("ABC234", person("0"), "duel", 10000);
  M.join(s, person("1"));
  assert.throws(() => M.join(s, person("2")), /full/);
  assert.throws(() => M.act(s, "1", { action: "start" }, 11000), /host/);
  assert.throws(() => M.act(s, "0", { action: "start" }, 11000), /ready/);
});
test("dice are server-owned, uniform, single-use and animate before movement", () => {
  const counts = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < 12000; i++) {
    const s = fixture();
    M.act(s, "0", { action: "roll", round: 1, value: 6, total: 999 }, 12000);
    assert.equal(s.phase, "rolling");
    assert.equal(s.players[0].position, 0);
    assert.equal(s.turn, 0);
    assert.equal(s.dice.values.length, 1);
    counts[s.dice.values[0] - 1]++;
    assert.ok(s.dice.total >= 1 && s.dice.total <= 6);
    if (i === 0) {
      assert.throws(
        () => M.act(s, "0", { action: "roll", round: 1 }, 12100),
        /already/,
      );
      M.advance(s, s.deadline);
      assert.ok(["walking", "choice"].includes(s.phase));
    }
  }
  assert.ok(
    counts.every((n) => n > 1700 && n < 2300),
    JSON.stringify(counts),
  );
});
test("items enforce turn ownership, one use, coin costs and shop-only purchases", () => {
  const s = fixture();
  assert.throws(
    () => M.act(s, "1", { action: "roll", round: 1 }, 12000),
    /turn/,
  );
  assert.throws(
    () =>
      M.act(s, "0", { action: "buy-item", round: 1, item: "shield" }, 12000),
    /cart/,
  );
  M.act(s, "0", { action: "item", round: 1, item: "boost" }, 12000);
  assert.throws(
    () => M.act(s, "0", { action: "item", round: 1, item: "boost" }, 12200),
    /One item/,
  );
  M.act(s, "0", { action: "roll", round: 1 }, 13000);
  assert.equal(s.dice.total, s.dice.values[0] + 3);
  const shop = landing("shop");
  M.act(shop, "0", { action: "buy-item", round: 1, item: "double" }, 12100);
  assert.equal(shop.players[0].tokens, 3);
  assert.throws(
    () =>
      M.act(shop, "0", { action: "buy-item", round: 1, item: "shield" }, 12300),
    /one item/,
  );
  M.act(shop, "0", { action: "continue", round: 1 }, 12500);
  assert.equal(shop.turn, 1);
});
test("branch choices use real connected edges and preserve remaining dice steps", () => {
  const s = fixture();
  s.players[0].position = 6;
  s.phase = "rolling";
  s.dice = { values: [3], total: 3 };
  s.movement = { remaining: 3 };
  s.deadline = 12000;
  M.advance(s, 12000);
  assert.equal(s.phase, "choice");
  assert.equal(s.movement.remaining, 3);
  assert.throws(
    () => M.act(s, "0", { action: "choose", round: 1, next: 31 }, 12100),
    /highlighted/,
  );
  M.act(s, "0", { action: "choose", round: 1, next: 38 }, 12200);
  assert.deepEqual(s.lastMove.path, [6, 38, 39]);
  assert.equal(s.movement.remaining, 1);
  assert.equal(s.players[0].position, 39);
  M.advance(s, s.deadline);
  assert.equal(s.event.kind, "shop");
  M.act(s, "0", { action: "continue", round: 1 }, s.deadline - 1000);
  assert.deepEqual(s.lastMove.path, [39, 40]);
  assert.equal(s.movement.remaining, 0);
});
test("all space effects preserve nonnegative coins; gifts and shields have real effects", () => {
  const coin = landing("coins");
  assert.equal(coin.players[0].tokens, 13);
  const loss = landing("loss");
  assert.equal(loss.players[0].tokens, 7);
  const gift = landing("gift");
  assert.equal(gift.players[0].items.length, 2);
  const lucky = landing("lucky");
  assert.ok(lucky.players[0].tokens >= 15 && lucky.players[0].tokens <= 19);
  const shield = fixture();
  shield.players[0].shield = true;
  shield.players[0].position = C.spaces.find((n) => n.type === "loss").id;
  shield.phase = "walking";
  shield.movement = { remaining: 0 };
  shield.deadline = 12000;
  M.advance(shield, 12000);
  assert.equal(shield.players[0].tokens, 10);
  assert.equal(shield.players[0].shield, false);
  for (let i = 0; i < 100; i++) {
    const event = landing("event");
    assert.ok(
      event.players.every((p) => p.tokens >= 0 && C.spaces[p.position]),
    );
  }
});
test("passing the current trophy spends exactly ten coins and moves the host", () => {
  const s = fixture();
  s.players[0].position = C.trophyStops[0] - 1;
  s.phase = "rolling";
  s.dice = { values: [1], total: 1 };
  s.movement = { remaining: 1 };
  s.deadline = 12000;
  M.advance(s, 12000);
  assert.equal(s.players[0].trophies, 1);
  assert.equal(s.players[0].tokens, 0);
  assert.equal(s.goal, C.trophyStops[1]);
});
test("board duels restrict inputs to the two rivals and resume the same board round", () => {
  const s = landing("duel");
  const oldRound = s.round;
  M.act(
    s,
    "0",
    {
      action: "challenge",
      round: 1,
      opponent: "1",
      stake: 5,
      currency: "coins",
    },
    12100,
  );
  assert.equal(s.game.sideDuel, true);
  M.advance(s, s.deadline);
  M.advance(s, s.deadline);
  s.game.id = "climb";
  for (let n = 0; n < 3; n++)
    input(s, "0", s.game.sequence[n], s.game.start + 300 + n * 200);
  M.advance(s, s.game.end + 1);
  assert.equal(s.phase, "side-result");
  assert.equal(s.players[0].tokens, 15);
  assert.equal(s.players[0].trophies, 0);
  M.advance(s, s.deadline);
  assert.equal(s.turn, 1);
  assert.equal(s.phase, "board");
  assert.equal(s.round, oldRound);
  const four = fixture("party", 4);
  four.phase = "space";
  four.event = { kind: "duel" };
  M.act(
    four,
    "0",
    {
      action: "challenge",
      round: 1,
      opponent: "1",
      stake: 5,
      currency: "coins",
    },
    12000,
  );
  M.advance(four, four.deadline);
  M.advance(four, four.deadline);
  assert.throws(() => input(four, "2", "up", four.game.start + 500), /Watch/);
});
test("climbing checks server sequence, combos, checkpoints, spam and stale rounds", () => {
  const s = gameFixture("climb"),
    v = s.game.progress[0];
  for (let i = 0; i < 6; i++)
    input(s, "0", s.game.sequence[v.step], 21000 + i * 200, { score: 999999 });
  assert.equal(s.game.scores[0], 700);
  input(s, "0", s.game.sequence[v.step] === "up" ? "left" : "up", 23000);
  assert.equal(v.step, 6);
  assert.equal(v.combo, 0);
  assert.throws(() => input(s, "0", "up", 23001), /moment/);
  assert.throws(
    () =>
      M.act(
        s,
        "0",
        { action: "play", round: 0, game: "climb", start: 20000, value: "up" },
        23500,
      ),
    /earlier/,
  );
});
test("memory hides other and future patterns; reverse mode changes the correct order", () => {
  const s = gameFixture("memory"),
    early = M.view(s, "0", 20500);
  assert.ok(early.game.progress[0].pattern);
  assert.equal(early.game.progress[1].pattern, undefined);
  assert.equal(early.game.sequence, undefined);
  assert.equal(early.receipts, undefined);
  assert.equal(early.gameOrder, undefined);
  assert.throws(
    () => input(s, "0", s.game.progress[0].pattern[0], 20500),
    /Watch/,
  );
  assert.equal(M.view(s, "0", 24000).game.progress[0].pattern, undefined);
  input(s, "0", "replay", 25000);
  assert.equal(s.players[0].participation, 0);
  const v = s.game.progress[0];
  v.pattern = [0, 1, 2, 3, 0];
  v.level = 5;
  v.reverse = true;
  v.showAt = 20000;
  for (const [i, x] of [...v.pattern].reverse().entries())
    input(s, "0", x, 29000 + i * 200);
  assert.equal(s.game.scores[0], 550);
});
test("three putting courses use deterministic physics, sum scores and prevent extra shots", () => {
  const s = gameFixture("putt");
  assert.throws(
    () => input(s, "0", null, 21000, { angle: NaN, power: 1 }),
    /valid/,
  );
  let now = 21000,
    total = 0;
  for (let i = 0; i < 3; i++) {
    input(s, "0", null, now, { angle: -1.5, power: 0.4, score: 99999 });
    const v = s.game.progress[0];
    assert.equal(v.shot.course, i);
    assert.ok(v.shot.frames.length > 3);
    assert.ok(s.game.scores[0] >= total);
    total = s.game.scores[0];
    assert.throws(
      () => input(s, "0", null, now + 200, { angle: -1, power: 0.5 }),
      /rolling|finished/,
    );
    now += v.shot.duration + 600;
  }
  assert.ok(total <= 3000);
  assert.throws(
    () => input(s, "0", null, now, { angle: -1, power: 0.5 }),
    /finished/,
  );
});
test("ripple fishing accepts six timed bites, rejects early and duplicate pulls, and bounds rewards", () => {
  const s = gameFixture("fish"),
    v = s.game.progress[0];
  for (const beat of s.game.beats) {
    const at = s.game.start + beat.at + 200;
    M.advance(s, at);
    input(s, "0", "reel", at, { score: 999999, timestamp: 0 });
    assert.throws(() => input(s, "0", "reel", at + 150), /next signal/);
    M.advance(s, s.game.start + beat.at + beat.window + 1);
  }
  assert.equal(v.attempts, 6);
  assert.ok(s.game.scores[0] >= 900 && s.game.scores[0] <= 3600);
  const early = gameFixture("fish");
  input(early, "0", "reel", early.game.start + 200);
  assert.equal(early.game.scores[0], 0);
  assert.equal(early.game.progress[0].misses, 1);
});

test("timeouts cannot fast-forward phases or manufacture active participation", () => {
  const s = fixture();
  M.advance(s, 999999999);
  assert.equal(s.phase, "rolling");
  assert.equal(s.turn, 0);
  assert.equal(s.players[0].participation, 0);
  M.advance(s, 999999999);
  assert.equal(s.phase, "rolling");
});

test("minigame readiness is scoped, all-ready starts a shared countdown, and 60 seconds auto-starts", () => {
  const s = fixture("duel");
  const ready = (id, at) =>
    M.act(
      s,
      id,
      {
        action: "game-ready",
        round: s.round,
        game: s.game.id,
        start: s.game.start,
      },
      at,
    );
  const deadline = s.deadline;
  ready("0", 12000);
  assert.equal(s.phase, "intro");
  M.advance(s, deadline - 1);
  assert.equal(s.phase, "intro");
  assert.throws(
    () =>
      M.act(
        s,
        "1",
        {
          action: "game-ready",
          round: 99,
          game: s.game.id,
          start: s.game.start,
        },
        13000,
      ),
    /different minigame/,
  );
  ready("1", 14000);
  assert.equal(s.phase, "countdown");
  assert.equal(s.deadline, 17000);
  assert.throws(() => input(s, "0", "up", 16000), /not accepting/);
  M.advance(s, 17000);
  assert.equal(s.phase, "playing");
  assert.equal(s.game.start, 17000);
  const timeout = fixture("duel");
  M.advance(timeout, timeout.deadline);
  assert.equal(timeout.phase, "countdown");
  M.advance(timeout, timeout.deadline);
  assert.equal(timeout.phase, "playing");
  assert.ok(timeout.players.every((p) => p.participation === 0));
});

test("passing carts pause exactly once, buy exactly once, and resume the remaining roll", () => {
  const s = fixture();
  s.players[0].position = 3;
  s.phase = "rolling";
  s.dice = { values: [4], total: 4 };
  s.movement = { remaining: 4 };
  s.deadline = 12000;
  M.advance(s, 12000);
  assert.deepEqual(s.lastMove.path, [3, 4]);
  assert.equal(s.movement.remaining, 3);
  M.advance(s, s.deadline);
  assert.equal(s.event.passing, true);
  assert.equal(s.event.kind, "shop");
  M.act(s, "0", { action: "buy-item", round: 1, item: "double" }, 14000);
  assert.equal(s.players[0].tokens, 3);
  assert.throws(
    () =>
      M.act(s, "0", { action: "buy-item", round: 1, item: "double" }, 14200),
    /one item/,
  );
  M.act(s, "0", { action: "continue", round: 1 }, 14400);
  assert.deepEqual(s.lastMove.path, [4, 5, 6]);
  assert.equal(s.movement.remaining, 1);
  assert.equal(s.turn, 0);
});

test("three connected junctions obey the tide gate and reject arbitrary teleports", () => {
  assert.equal(C.spaces.length, 50);
  assert.equal(C.spaces.filter((n) => n.next.length > 1).length, 3);
  const reachable = new Set([0]),
    queue = [0];
  while (queue.length)
    for (const id of C.spaces[queue.shift()].next)
      if (!reachable.has(id)) {
        reachable.add(id);
        queue.push(id);
      }
  assert.equal(reachable.size, 50);
  const s = fixture();
  s.players[0].position = C.tideJunction;
  s.tide = 0;
  assert.deepEqual(M.view(s, "0", 12000).routes[C.tideJunction], [31]);
  s.tide = 1;
  assert.deepEqual(M.view(s, "0", 12000).routes[C.tideJunction], [31, 46]);
});

test("single-use triple dice, chosen dice and swaps enforce ownership and valid targets", () => {
  for (const item of ["triple", "custom", "swap", "warp"]) {
    const s = fixture();
    s.players[0].items = [item];
    s.players[1].position = 20;
    if (item === "custom")
      assert.throws(
        () =>
          M.act(s, "0", { action: "item", round: 1, item, value: 99 }, 12000),
        /1 to 6/,
      );
    if (item === "swap")
      assert.throws(
        () =>
          M.act(
            s,
            "0",
            { action: "item", round: 1, item, target: "outsider" },
            12000,
          ),
        /another player/,
      );
    M.act(
      s,
      "0",
      { action: "item", round: 1, item, value: 4, target: "1" },
      12200,
    );
    assert.deepEqual(s.players[0].items, []);
    if (item === "swap") {
      assert.equal(s.players[0].position, 20);
      assert.equal(s.players[1].position, 0);
    }
    M.act(s, "0", { action: "roll", round: 1, total: 999 }, 12400);
    if (item === "triple") {
      assert.equal(s.dice.values.length, 3);
      assert.ok(s.dice.total >= 3 && s.dice.total <= 18);
    }
    if (item === "custom") assert.deepEqual(s.dice.values, [4]);
  }
});

test("chance exchanges conserve coins and trophies and cannot resolve twice", () => {
  for (let n = 0; n < 100; n++) {
    const s = fixture("party", 4);
    s.players.forEach((p, i) => {
      p.tokens = i * 7;
      p.trophies = i;
    });
    s.phase = "walking";
    s.players[0].position = C.spaces.find((n) => n.type === "chance").id;
    s.movement = { remaining: 0 };
    s.deadline = 12000;
    M.advance(s, 12000);
    assert.equal(
      s.players.reduce((n, p) => n + p.tokens, 0),
      42,
    );
    assert.equal(
      s.players.reduce((n, p) => n + p.trophies, 0),
      6,
    );
    assert.ok(s.players.every((p) => p.tokens >= 0 && p.trophies >= 0));
    const state = JSON.stringify(s.players);
    M.advance(s, 12001);
    assert.equal(JSON.stringify(s.players), state);
  }
});

test("coin and final-three-turn trophy duels escrow stakes and refund a tie once", () => {
  const s = landing("duel");
  assert.throws(
    () =>
      M.act(
        s,
        "0",
        {
          action: "challenge",
          round: 1,
          opponent: "1",
          stake: 11,
          currency: "coins",
        },
        12100,
      ),
    /afford/,
  );
  assert.throws(
    () =>
      M.act(
        s,
        "0",
        {
          action: "challenge",
          round: 1,
          opponent: "1",
          stake: 1,
          currency: "trophy",
        },
        12100,
      ),
    /last three/,
  );
  M.act(
    s,
    "0",
    {
      action: "challenge",
      round: 1,
      opponent: "1",
      stake: 7,
      currency: "coins",
    },
    12200,
  );
  assert.deepEqual(
    s.players.map((p) => p.tokens),
    [3, 3],
  );
  M.advance(s, s.deadline);
  M.advance(s, s.deadline);
  M.advance(s, s.game.end + 1);
  assert.deepEqual(
    s.players.map((p) => p.tokens),
    [10, 10],
  );
  M.advance(s, s.deadline - 1);
  assert.deepEqual(
    s.players.map((p) => p.tokens),
    [10, 10],
  );
  const trophy = landing("duel");
  trophy.round = trophy.rounds - 2;
  trophy.players.forEach((p) => (p.trophies = 1));
  M.act(
    trophy,
    "0",
    {
      action: "challenge",
      round: trophy.round,
      opponent: "1",
      stake: 1,
      currency: "trophy",
    },
    12300,
  );
  assert.deepEqual(
    trophy.players.map((p) => p.trophies),
    [0, 0],
  );
  M.advance(trophy, trophy.deadline);
  M.advance(trophy, trophy.deadline);
  trophy.game.scores = [100, 0];
  M.advance(trophy, trophy.game.end + 1);
  assert.deepEqual(
    trophy.players.map((p) => p.trophies),
    [2, 0],
  );
  assert.deepEqual(trophy.game.trophyAwards, [1, -1]);
});

test("all six new games validate inputs, server scores, hidden future cues and coin awards", () => {
  for (const id of [
    "cascade",
    "lantern",
    "hop",
    "dash",
    "signal",
    "treasure",
  ]) {
    const s = gameFixture(id),
      g = s.game,
      v = g.progress[0],
      b = g.beats[0];
    assert.throws(() => input(s, "0", "invalid", 21000), /Choose/);
    const value = ["cascade", "dash"].includes(id)
      ? "left"
      : id === "hop"
        ? "jump"
        : id === "treasure"
          ? 0
          : b.color;
    input(s, "0", value, g.start + b.at + 200, {
      score: 999999,
      coins: 999999,
    });
    M.advance(s, g.start + b.at + b.window + 1);
    assert.ok(g.scores[0] < 1000);
    const pub = M.view(s, "0", g.start + b.at + 210);
    assert.equal(pub.game.beats, undefined);
    assert.ok(pub.game.cue);
    if (C.games.find((x) => x.id === id).coinGame) {
      const before = s.players[0].tokens;
      M.advance(s, g.end + 1);
      assert.equal(s.players[0].tokens - before, v.collected);
      assert.equal(g.coinAwards[0], v.collected);
      assert.equal(s.players[0].trophies, 0);
    }
  }
});
test("full four-player ten-turn festival completes with varied minigames", () => {
  const s = fixture("party", 4);
  let at = 12000,
    guard = 0;
  while (s.phase !== "complete" && guard++ < 600) {
    if (s.phase === "board")
      M.act(
        s,
        s.players[s.turn].id,
        { action: "roll", round: s.round },
        (at += 500),
      );
    else if (s.phase === "choice")
      M.act(
        s,
        s.players[s.turn].id,
        {
          action: "choose",
          round: s.round,
          next: C.spaces[s.players[s.turn].position].next[0],
        },
        (at += 500),
      );
    else if (s.phase === "playing") {
      for (const [i, p] of s.players.entries()) {
        if (!s.game.participants.includes(p.id)) continue;
        const v = s.game.progress[i];
        at = Math.max(at, s.game.start + 400);
        if (s.game.id === "climb") {
          for (let n = 0; n < (i === 0 ? 5 : 1); n++)
            input(s, p.id, s.game.sequence[v.step], (at += 200));
        } else if (s.game.id === "putt")
          input(s, p.id, null, (at += 200), {
            angle: -1.3 - i * 0.2,
            power: 0.5,
          });
        else if (G.handled(s.game.id)) {
          const beat = s.game.beats[0];
          at = s.game.start + beat.at + 200;
          const value = ["cascade", "dash"].includes(s.game.id)
            ? "left"
            : s.game.id === "fish"
              ? "reel"
              : s.game.id === "hop"
                ? "jump"
                : s.game.id === "treasure"
                  ? 1
                  : beat.color;
          input(s, p.id, value, at);
        } else {
          at = Math.max(at, v.showAt + v.pattern.length * 650 + 400);
          for (let n = 0; n < (i === 0 ? 3 : 1); n++)
            input(
              s,
              p.id,
              v.pattern[v.reverse ? v.pattern.length - 1 - v.cursor : v.cursor],
              (at += 200),
            );
        }
      }
      at = s.game.end + 1;
      M.advance(s, at);
    } else {
      at = s.deadline + 1;
      M.advance(s, at);
    }
  }
  assert.equal(s.phase, "complete");
  assert.equal(s.history.filter((h) => !h.tiebreak).length, 10);
  assert.ok(
    new Set(s.history.filter((h) => !h.tiebreak).map((h) => h.game)).size >= 5,
  );
  assert.ok(s.players.every((p) => p.tokens >= 0 && C.spaces[p.position]));
  assert.ok(s.rewards.every((n) => n >= 12));
});
test("drawn duel does not automatically choose the host", () => {
  const s = gameFixture("fish");
  s.round = 2;
  s.players.forEach((p) => (p.wins = 1));
  s.game.scores = [100, 100];
  s.game.progress.forEach((p) => (p.finished = 22000));
  M.advance(s, 56000);
  assert.notEqual(s.phase, "complete");
});

test("guest auth, room privacy, idempotent movement and atomic cosmetics in real SQL", async () => {
  const server = await startPartyServer();
  const origin = server.origin;
  const cookies = [];
  const call = async (index, action, data = {}, headers = {}) => {
    const response = await fetch(origin + "/.netlify/functions/party-action", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cookies[index] ? { Cookie: cookies[index] } : {}),
        ...headers,
      },
      body: JSON.stringify({ action, match: 1, ...data }),
    });
    if (response.headers.get("set-cookie"))
      cookies[index] = response.headers.get("set-cookie").split(";")[0];
    return { status: response.status, body: await response.json() };
  };
  try {
    assert.equal((await call(0, "profile")).status, 401);
    assert.equal(
      (
        await call(
          0,
          "register",
          { name: "Bad", character: "fox" },
          { Origin: "https://other.example" },
        )
      ).status,
      403,
    );
    const users = [];
    for (let i = 0; i < 3; i++) {
      const r = await call(i, "register", {
        name: "Friend " + i,
        character: C.characters[i].id,
      });
      assert.equal(r.status, 200);
      users.push(r.body.profile);
      assert.equal(r.body.profile.session_hash, undefined);
    }
    const createId = uuid(),
      first = await call(0, "create", { mode: "party", requestId: createId }),
      room = first.body.game.id;
    assert.equal(first.status, 200);
    assert.equal(
      (await call(0, "create", { mode: "party", requestId: createId })).body
        .game.id,
      room,
    );
    assert.equal((await call(2, "get", { room })).status, 403);
    await call(1, "join", { room });
    // Both contenders race to claim one character under the real row lock.
    const picks = await Promise.all(
      [0, 1].map((i) =>
        call(i, "pick-character", {
          room,
          character: "ghost",
          requestId: uuid(),
        }),
      ),
    );
    assert.deepEqual(picks.map((p) => p.status).sort(), [200, 409]);
    const loser = picks[0].status === 409 ? 0 : 1;
    assert.equal(
      (
        await call(loser, "pick-character", {
          room,
          character: "knight",
          requestId: uuid(),
        })
      ).status,
      200,
    );
    await call(0, "ready", { room, requestId: uuid() });
    await call(1, "ready", { room, requestId: uuid() });
    assert.equal(
      (await call(0, "start", { room, requestId: uuid() })).status,
      200,
    );
    // Fix the seat only for the movement/replay fixture below; creation randomizes it.
    await server.pg.query(
      "UPDATE party_rooms SET state=jsonb_set(jsonb_set(state,'{turn}','0'),'{startingSeat}','0') WHERE id=$1",
      [room],
    );
    const requestId = uuid(),
      a = await call(0, "move", { room, round: 1, route: "scenic", requestId }),
      b = await call(0, "move", { room, round: 1, route: "scenic", requestId });
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    assert.equal(
      a.body.game.players[0].position,
      b.body.game.players[0].position,
    );
    assert.equal(b.body.game.turn, 0);
    assert.equal(b.body.game.phase, "rolling");
    assert.deepEqual(a.body.game.dice, b.body.game.dice);
    assert.equal(
      (
        await call(1, "move", {
          room,
          match: 0,
          round: 1,
          route: "scenic",
          requestId: uuid(),
        })
      ).status,
      409,
    );
    // Settlement is exercised through the production SQL transaction boundary.
    const state = (
      await server.pg.query("SELECT state FROM party_rooms WHERE id=$1", [room])
    ).rows[0].state;
    state.phase = "complete";
    state.winner = users[0].id;
    state.finished = Date.now();
    state.players.forEach((p) => (p.participation = 4));
    state.rewards = [20, 12];
    await server.pg.query(
      "UPDATE party_rooms SET state=$2::jsonb WHERE id=$1",
      [room, JSON.stringify(state)],
    );
    await Promise.all(
      Array.from({ length: 8 }, () => call(0, "get", { room })),
    );
    assert.equal((await call(0, "profile")).body.profile.coins, 20);
    assert.equal((await call(1, "profile")).body.profile.coins, 12);
    assert.equal(
      (await server.pg.query("SELECT * FROM party_rewards")).rows.length,
      2,
    );
    assert.equal(
      (await call(0, "purchase", { skin: "sunset", coins: 99999 })).status,
      409,
    );
    await server.pg.query("UPDATE party_profiles SET coins=120 WHERE id=$1", [
      users[0].id,
    ]);
    await Promise.all(
      Array.from({ length: 5 }, () => call(0, "purchase", { skin: "sunset" })),
    );
    const equipped = (await call(0, "profile")).body.profile;
    assert.equal(equipped.coins, 60);
    assert.deepEqual(equipped.owned, ["classic", "sunset"]);
    assert.equal(equipped.skin, "sunset");
    assert.equal(
      (await call(0, "create", { mode: "cash", requestId: uuid() })).status,
      400,
    );
    assert.equal(
      (await call(0, "play", { room, requestId: uuid(), score: 99999 })).status,
      409,
    );
  } finally {
    await server.close();
  }
});

test("thirty simulated festivals finish without stuck turns or negative balances", () => {
  const seen = new Set();
  for (let run = 0; run < 30; run++) {
    const s = fixture("party", run % 2 ? 4 : 2);
    s.players.forEach((p) => (p.bot = true));
    let now = 12000,
      steps = 0;
    while (s.phase !== "complete" && steps++ < 10000) {
      now += 400;
      M.advance(s, now);
      if (s.game) seen.add(s.game.id);
      assert.ok(
        s.players.every(
          (p) =>
            Number.isInteger(p.tokens) &&
            p.tokens >= 0 &&
            p.trophies >= 0 &&
            C.spaces[p.position],
        ),
      );
    }
    assert.equal(
      s.phase,
      "complete",
      "simulation " + run + " stopped in " + s.phase,
    );
    assert.equal(s.history.filter((h) => !h.tiebreak).length, 10);
    assert.ok(s.players.every((p) => p.items.length <= 3));
  }
  assert.equal(seen.size, C.games.length);
});

test("a depleted showdown pool preserves the unplayed coin games", () => {
  const s = landing("duel");
  s.usedGames = C.games.filter((g) => !g.coinGame).map((g) => g.id);
  M.act(
    s,
    "0",
    { action: "challenge", round: 1, opponent: "1", stake: 0 },
    12100,
  );
  assert.ok(
    C.games.filter((g) => !g.coinGame).every((g) => s.usedGames.includes(g.id)),
  );
  s.phase = "board-end";
  s.deadline = 12200;
  M.advance(s, 12200);
  assert.ok(C.games.find((g) => g.id === s.game.id).coinGame);
});

test("V4 lengths, exclusive picks, rematch selection and standings are authoritative", () => {
  for (const turns of C.turnOptions)
    assert.equal(
      M.create("ABC234", person("0"), "party", 10000, turns).rounds,
      turns,
    );
  for (const bad of [0, 8, 11, 31, "20", null, Infinity])
    assert.throws(
      () => M.create("ABC234", person("0"), "party", 10000, bad),
      /10, 20, or 30/,
    );
  const s = M.create("ABC234", person("0"), "party", 10000, 30);
  M.join(s, person("1"));
  assert.throws(
    () => M.act(s, "0", { action: "ready" }, 11000),
    /Pick your character/,
  );
  M.act(s, "0", { action: "pick-character", character: "ghost" }, 11000);
  assert.throws(
    () =>
      M.act(s, "1", { action: "pick-character", character: "ghost" }, 11000),
    /already been picked/,
  );
  M.act(s, "1", { action: "pick-character", character: "skeleton" }, 11000);
  for (const p of s.players) M.act(s, p.id, { action: "ready" }, 11000);
  M.act(s, "0", { action: "start" }, 11000);
  assert.throws(
    () =>
      M.act(s, "0", { action: "pick-character", character: "knight" }, 12000),
    /before the match/,
  );
  s.phase = "complete";
  s.ready = [];
  M.act(s, "0", { action: "rematch" }, 12000);
  M.act(s, "1", { action: "rematch" }, 12000);
  assert.equal(s.phase, "waiting");
  assert.equal(s.rounds, 30);
  assert.ok(s.players.every((p) => !p.characterPicked));
  assert.deepEqual(
    C.standings([
      { id: "a", trophies: 2, total: 4 },
      { id: "b", trophies: 2, total: 4 },
      { id: "c", trophies: 1, total: 999 },
    ]),
    { a: 1, b: 1, c: 3 },
  );
});
test("board routes trade one step for risk and soundtrack has four full arrangements", () => {
  for (const b of C.branches) {
    assert.equal(b.to - b.from, 6);
    let n = C.spaces[b.from].next[1],
      count = 0,
      loss = 0;
    while (n !== b.to) {
      loss += C.spaces[n].type === "loss";
      n = C.spaces[n].next[0];
      count++;
      assert.ok(count < 10);
    }
    assert.equal(count, 4);
    assert.equal(loss, 1);
  }
  assert.equal(C.spaces.filter((n) => n.type === "chance").length, 2);
  assert.equal(C.characters.length, 8);
  assert.equal(new Set(C.characters.map((c) => c.id)).size, 8);
  const score = require("../assets/party/soundtrack");
  const signatures = score.themes.map((_, i) =>
    JSON.stringify(
      Array.from({ length: score.stepsPerTheme }, (_, j) => score.notes(i, j)),
    ),
  );
  assert.equal(new Set(signatures).size, 4);
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 128; j++)
      for (const [note, len, volume] of score.notes(i, j)) {
        assert.ok(note >= 24 && note <= 96);
        assert.ok(len > 0 && len <= 1);
        assert.ok(volume > 0 && volume <= 0.3);
      }
});
