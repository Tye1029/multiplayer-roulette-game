import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire(import.meta.url),
  M = require("../netlify/functions/party/model"),
  G = require("../netlify/functions/party/minigames"),
  C = require("../assets/party/catalog"),
  I = require("../assets/party/interaction");
function fixture(id) {
  const people = Array.from({ length: 4 }, (_, i) => ({
    id: String(i),
    name: "Friend " + i,
    character: C.characters[i].id,
    characterPicked: true,
  }));
  const s = M.create("ABC234", people[0], "party", 10000);
  people.slice(1).forEach((p) => M.join(s, p));
  s.ready = people.map((p) => p.id);
  M.begin(s, 10000);
  s.turn = s.startingSeat = 0;
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
const act = (s, action, more = {}, at = 12000, id = "0") =>
  M.act(
    s,
    id,
    { action, round: s.round, game: s.game?.id, start: s.game?.start, ...more },
    at,
  );
function visit(s, position, left = 0) {
  s.players[0].position = position;
  s.movement = { remaining: left, stopShop: true };
  s.dice = { values: [1], total: 1 };
  s.phase = "walking";
  s.deadline = 12000;
  M.advance(s, 12000);
}
test("ordinary party and quick-duel wins never mint trophies", () => {
  for (const mode of ["party", "duel"]) {
    const s = fixture("climb");
    s.mode = mode;
    s.players.forEach((p, i) => (p.trophies = i));
    s.game.scores = [900, 600, 300, 100];
    s.game.progress.forEach((v) => {
      v.inputs = 1;
      v.finished = 54000;
    });
    M.advance(s, 55001);
    assert.deepEqual(
      s.players.map((p) => p.trophies),
      [0, 1, 2, 3],
    );
    assert.deepEqual(s.game.trophyAwards, [0, 0, 0, 0]);
    assert.equal(s.players[0].tokens, 20);
  }
});
test("trophy host requires an explicit affordable purchase and rejects double purchases", () => {
  const s = fixture();
  s.players[0].position = 9;
  s.movement = { remaining: 3 };
  s.dice = { values: [3], total: 3 };
  s.phase = "rolling";
  s.deadline = 12000;
  M.advance(s, 12000);
  M.advance(s, s.deadline);
  assert.equal(s.event.kind, "trophy-purchase");
  assert.equal(s.movement.remaining, 2);
  assert.equal(s.players[0].tokens, 10);
  act(s, "buy-trophy", {}, 14000);
  assert.equal(s.players[0].trophies, 1);
  assert.equal(s.players[0].tokens, 0);
  assert.throws(() => act(s, "buy-trophy", {}, 14100), /host/);
  act(s, "continue", {}, 14200);
  assert.equal(s.players[0].position, 12);
});
test("declining or timing out a trophy keeps coins and resumes the original roll", () => {
  for (const timeout of [false, true]) {
    const s = fixture();
    s.players[0].items = ["warp"];
    act(s, "item", { item: "warp" });
    assert.equal(s.phase, "space");
    assert.equal(s.players[0].tokens, 10);
    if (timeout) M.advance(s, s.deadline);
    else act(s, "continue", {}, 12200);
    assert.equal(s.phase, "board");
    assert.equal(s.usedItem, true);
    assert.equal(s.players[0].trophies, 0);
    act(s, "roll", {}, 13000);
    assert.equal(s.phase, "rolling");
  }
});
test("shop stocks differ and an out-of-stock or invalid replacement purchase cannot change balances", () => {
  assert.equal(
    new Set(Object.values(C.shops).map((s) => s.stock.join())).size,
    3,
  );
  const s = fixture();
  visit(s, 4);
  s.players[0].items = ["boost", "shield", "swap"];
  s.players[0].tokens = 30;
  const before = structuredClone(s.players[0]);
  assert.throws(() => act(s, "buy-item", { item: "warp" }), /stock/);
  assert.throws(
    () => act(s, "buy-item", { item: "double", replace: 99 }),
    /replace/,
  );
  assert.deepEqual(s.players[0], before);
  act(s, "buy-item", { item: "double", replace: 1 });
  assert.deepEqual(s.players[0].items, ["boost", "double", "swap"]);
  assert.equal(s.players[0].tokens, 23);
  assert.throws(
    () => act(s, "buy-item", { item: "triple", replace: 0 }),
    /one item/,
  );
});
test("a shop cannot consume the final landing; departure moves onto the next normal space", () => {
  for (const [position, next] of [
    [4, 5],
    [15, 16],
    [26, 27],
  ]) {
    const s = fixture();
    visit(s, position);
    act(s, "continue", {}, 13000);
    assert.equal(s.phase, "walking");
    assert.equal(s.players[0].position, next);
    M.advance(s, s.deadline);
    assert.equal(s.phase, "space");
    assert.notEqual(s.event.kind, "shop");
  }
});
test("full pockets offer gift replacement and declining preserves the original inventory", () => {
  for (const accept of [true, false]) {
    const s = fixture();
    s.players[0].items = ["boost", "shield", "swap"];
    visit(s, 3);
    const item = s.event.pendingItem;
    assert.ok(item);
    assert.equal(s.deadline, 72000);
    if (accept) {
      act(s, "accept-item", { replace: 2 });
      assert.deepEqual(s.players[0].items, ["boost", "shield", item]);
      assert.throws(() => act(s, "accept-item", { replace: 0 }), /no item/);
    } else {
      act(s, "continue");
      assert.deepEqual(s.players[0].items, ["boost", "shield", "swap"]);
    }
    assert.equal(s.players[0].items.length, 3);
  }
});
test("route previews follow connected edges, include later forks and skip terminal shops", () => {
  const s = fixture();
  s.phase = "choice";
  s.players[0].position = 5;
  s.movement = { remaining: 12 };
  s.tide = 1;
  const routes = C.routePreviews(s);
  assert.equal(routes.length, 2);
  for (const route of routes) {
    assert.ok(route.landings.length);
    for (const path of route.paths) {
      for (let i = 1; i < path.length; i++)
        assert.ok(C.spaces[path[i - 1]].next.includes(path[i]));
      assert.notEqual(C.spaces[path.at(-1)].type, "shop");
    }
  }
  s.players[0].position = 27;
  s.tide = 0;
  assert.equal(C.routePreviews(s).length, 1);
  s.tide = 1;
  assert.equal(C.routePreviews(s).length, 2);
});
test("skybridge is level and connected without tilted overlapping tile planes", () => {
  const bridge = C.spaces.filter((n) => n.district === "Skybridge");
  assert.equal(bridge.length, 4);
  assert.ok(bridge.every((n) => n.y === C.spaces[5].y));
  assert.equal(bridge.at(-1).next[0], 11);
});
test("fishing gives separate public bite cues, one catch, and a measuring phase before awards", () => {
  const s = fixture("fish");
  const view = M.view(s, "0", 20500);
  assert.equal(view.game.fishBeats, undefined);
  assert.equal(view.game.fishBase, undefined);
  assert.notEqual(view.game.cues[0].at, view.game.cues[1].at);
  for (let i = 0; i < 4; i++) {
    const at = 20000 + s.game.fishBeats[i][0].at + 100 + i * 100;
    act(s, "play", { value: "reel", score: 999999 }, at, String(i));
    assert.equal(s.game.progress[i].attempts, 1);
    assert.throws(
      () => act(s, "play", { value: "reel" }, at + 200, String(i)),
      /finished/,
    );
  }
  assert.ok(s.game.scores[0] > s.game.scores[1]);
  assert.ok(s.game.scores[1] > s.game.scores[2]);
  assert.ok(
    s.game.progress.every((v) => v.catch.length >= 25 && v.catch.length <= 110),
  );
  M.advance(s, 30000);
  assert.equal(s.phase, "measuring");
  assert.equal(s.players[0].tokens, 10);
  M.advance(s, s.deadline);
  assert.equal(s.phase, "round-end");
  assert.equal(s.players[0].tokens, 20);
  assert.equal(s.players[0].trophies, 0);
});
test("rock paper scissors choices are sealed and the familiar cyclic rules resolve correctly", () => {
  for (const [a, b] of [
    ["rock", "scissors"],
    ["paper", "rock"],
    ["scissors", "paper"],
  ]) {
    const s = fixture("fencing");
    s.game.active = [0, 1];
    s.game.participants = ["0", "1"];
    act(s, "play", { value: a }, 21000);
    assert.equal(
      JSON.stringify(M.view(s, "1", 21100)).includes('"value":"' + a + '"'),
      false,
    );
    act(s, "play", { value: b }, 21200, "1");
    M.advance(s, 23000);
    assert.equal(s.game.scores[0], 300);
    assert.equal(s.game.scores[1], 0);
  }
});
test("local movement feedback never mutates authoritative state or awards points", () => {
  const s = fixture("rope"),
    publicState = M.view(s, "0", 21000),
    before = structuredClone(publicState);
  const input = I.predict(publicState, "jump", 21100);
  assert.equal(input.fields.jumpAt, 21100);
  assert.deepEqual(publicState, before);
  assert.equal(input.fields.score, undefined);
  const race = fixture("kart"),
    v = M.view(race, "0", 21000),
    first = I.predict(v, "left", 21100),
    second = I.predict(v, "right", 21300, first);
  assert.equal(first.fields.lane, 0);
  assert.equal(second.fields.lane, 1);
});
test("every minigame has real keyboard bindings and every item has a local illustration", () => {
  for (const g of C.games) {
    const map = I.bindings(g.id, C.games);
    for (const [value] of I.controls(g.id, C.games))
      assert.ok(Object.values(map).includes(value), g.id + " " + value);
  }
  for (const item of C.items)
    assert.match(
      fs.readFileSync(
        new URL(`../assets/party/images/items/${item.id}.svg`, import.meta.url),
        "utf8",
      ),
      /<svg/,
    );
});
