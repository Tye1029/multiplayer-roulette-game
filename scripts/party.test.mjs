import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { startPartyServer } from "./party-test-server.mjs";
const require = createRequire(import.meta.url),
  M = require("../netlify/functions/party/model"),
  C = require("../assets/party/catalog");
const person = (id) => ({
    id,
    name: "Friend " + id,
    character: C.characters[Number(id) % 4]?.id || "raccoon",
  }),
  uuid = () => crypto.randomUUID();
function fixture(mode = "party", count = 2) {
  const s = M.create("ABC234", person("0"), mode, 10000);
  for (let i = 1; i < count; i++) M.join(s, person(String(i)));
  s.ready = s.players.map((p) => p.id);
  M.act(s, "0", { action: "start" }, 11000);
  return s;
}
function gameFixture(id) {
  const s = fixture("duel");
  s.game.id = id;
  s.phase = "playing";
  s.game.start = 20000;
  s.game.end = 55000;
  s.deadline = 55000;
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
function hookTime(s, v, after) {
  for (let at = after; at < after + 5000; at += 10) {
    const pos = 0.5 + 0.46 * Math.sin(((at - s.game.start) / 1000) * 2.1),
      center = 0.5 + 0.2 * Math.sin(v.attempts * 2.1);
    if (Math.abs(pos - center) < 0.015) return at;
  }
  throw Error("No hook window");
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
  M.act(s, "0", { action: "choose", round: 1, next: 32 }, 12200);
  assert.deepEqual(s.lastMove.path, [6, 32, 33, 34]);
  assert.equal(s.movement.remaining, 0);
  assert.equal(s.players[0].position, 34);
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
  shield.players[0].position = 3;
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
  s.players[0].position = 7;
  s.phase = "rolling";
  s.dice = { values: [1], total: 1 };
  s.movement = { remaining: 1 };
  s.deadline = 12000;
  M.advance(s, 12000);
  assert.equal(s.players[0].trophies, 1);
  assert.equal(s.players[0].tokens, 0);
  assert.equal(s.goal, 16);
});
test("board duels restrict inputs to the two rivals and resume the same board round", () => {
  const s = landing("duel");
  const oldRound = s.round;
  M.act(s, "0", { action: "challenge", round: 1, opponent: "1" }, 12100);
  assert.equal(s.game.sideDuel, true);
  M.advance(s, s.deadline);
  s.game.id = "climb";
  for (let n = 0; n < 3; n++)
    input(s, "0", s.game.sequence[n], s.game.start + 300 + n * 200);
  M.advance(s, s.game.end + 1);
  assert.equal(s.phase, "side-result");
  assert.equal(s.players[0].tokens, 18);
  assert.equal(s.players[0].trophies, 0);
  M.advance(s, s.deadline);
  assert.equal(s.turn, 1);
  assert.equal(s.phase, "board");
  assert.equal(s.round, oldRound);
  const four = fixture("party", 4);
  four.phase = "space";
  four.event = { kind: "duel" };
  M.act(four, "0", { action: "challenge", round: 1, opponent: "1" }, 12000);
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
test("fishing has separate hook/reel timing, bounded scores, escape and five-cast limit", () => {
  const s = gameFixture("fish"),
    v = s.game.progress[0];
  let at = 21000;
  for (let i = 0; i < 5; i++) {
    at = hookTime(s, v, at);
    input(s, "0", null, at, { risk: "deep", score: 99999, time: 0 });
    assert.ok(v.hook);
    assert.equal(v.attempts, i);
    at += 355;
    input(s, "0", null, at, { risk: "deep" });
    assert.equal(v.attempts, i + 1);
    assert.equal(v.hook, null);
    at += 1000;
  }
  assert.ok(s.game.scores[0] > 2000 && s.game.scores[0] <= 3000);
  assert.throws(() => input(s, "0", null, at, { risk: "safe" }), /finished/);
  const escape = gameFixture("fish"),
    h = hookTime(escape, escape.game.progress[0], 21000);
  input(escape, "0", null, h, { risk: "safe" });
  M.advance(escape, h + 4001);
  assert.equal(escape.game.progress[0].attempts, 1);
  assert.equal(escape.game.scores[0], 0);
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
test("full four-player six-round festival completes with all four minigames", () => {
  const s = fixture("party", 4);
  let at = 12000,
    guard = 0;
  while (s.phase !== "complete" && guard++ < 300) {
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
        else if (s.game.id === "fish") {
          input(s, p.id, null, (at += 1000), { risk: "safe" });
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
  assert.equal(s.history.filter((h) => !h.tiebreak).length, 6);
  assert.equal(
    new Set(s.history.filter((h) => !h.tiebreak).map((h) => h.game)).size,
    4,
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
    await call(0, "ready", { room, requestId: uuid() });
    await call(1, "ready", { room, requestId: uuid() });
    assert.equal(
      (await call(0, "start", { room, requestId: uuid() })).status,
      200,
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
