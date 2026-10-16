import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { startPartyServer } from "./party-test-server.mjs";
const require = createRequire(import.meta.url),
  { chromium } = require(process.env.RPS_PLAYWRIGHT_MODULE || "playwright"),
  M = require("../netlify/functions/party/model"),
  C = require("../assets/party/catalog"),
  G = require("../netlify/functions/party/minigames");
const server = await startPartyServer(),
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.RPS_BROWSER,
    args: ["--enable-unsafe-swiftshader"],
  }),
  out = path.join(os.tmpdir(), "boardwalk-party-qa"),
  errors = [];
await fs.mkdir(out, { recursive: true });
try {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    hasTouch: true,
  });
  await ctx.addInitScript(() => localStorage.setItem("boardwalk-sound", "off"));
  const reg = await ctx.request.post(
      server.origin + "/.netlify/functions/party-action",
      {
        data: { action: "register", name: "Expansion QA", character: "ghost" },
      },
    ),
    profile = (await reg.json()).profile;
  const base = M.create(
    "ABC234",
    { ...profile, characterPicked: true },
    "party",
    Date.now(),
  );
  for (let i = 1; i < 4; i++)
    M.join(base, {
      id: "actor" + i,
      name: ["", "Pippa", "Bones", "Rowan"][i],
      character: ["", "princess", "skeleton", "knight"][i],
      characterPicked: true,
    });
  base.ready = base.players.map((p) => p.id);
  M.begin(base, Date.now());
  base.turn = base.startingSeat = 0;
  await server.pg.query(
    "INSERT INTO party_rooms(id,owner_id,request_id,state) VALUES($1,$2,$3,$4::jsonb)",
    [base.id, profile.id, crypto.randomUUID(), JSON.stringify(base)],
  );
  const page = await ctx.newPage();
  page.on("pageerror", (e) => {
    errors.push(e.stack);
    console.log("PAGE ERROR", e.stack);
  });
  page.on("response", async (r) => {
    if (r.status() >= 500)
      console.log("HTTP ERROR", r.status(), await r.text());
  });
  async function state() {
    return (
      await server.pg.query("SELECT state FROM party_rooms WHERE id=$1", [
        base.id,
      ])
    ).rows[0].state;
  }
  async function install(s) {
    s.revision = (await state()).revision + 1;
    await server.pg.query(
      "UPDATE party_rooms SET state=$2::jsonb WHERE id=$1",
      [base.id, JSON.stringify(s)],
    );
    await page.goto(server.origin + "/party.html?room=" + base.id);
    await page.locator("#share-code").waitFor();
    await page.waitForTimeout(200);
    return s;
  }
  async function shot(name, width = 1440) {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    await page.waitForTimeout(250);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      ),
      false,
      name + " overflow",
    );
    await page.screenshot({
      path: path.join(out, "v8-" + name + "-" + width + ".png"),
      fullPage: true,
    });
  }
  async function click(selector, action) {
    const response = page.waitForResponse(
      (r) =>
        r.url().includes("party-action") &&
        r.request().postDataJSON()?.action === action,
    );
    await page.locator(selector).first().click();
    const r = await response;
    assert.equal(r.status(), 200, await r.text());
    return r.json();
  }
  function game(id) {
    const s = structuredClone(base),
      now = Date.now();
    s.phase = "board-end";
    s.deadline = now;
    M.advance(s, now);
    Object.assign(s.game, {
      id,
      start: now - 1000,
      end: now + 90000,
      duration: 91000,
      simAt: now,
    });
    G.setup(s.game);
    s.phase = "playing";
    s.deadline = s.game.end;
    return s;
  }

  for (const id of process.env.PARTY_GAMES
    ? process.env.PARTY_GAMES.split(",")
    : process.env.PARTY_PHASES_ONLY
      ? []
      : [
          "cascade",
          "hop",
          "lantern",
          "balloon",
          "stack",
          "ricochet",
          "confetti",
          "kart",
          "putt",
          ...C.games.filter((g) => g.engine === "expansion").map((g) => g.id),
        ]) {
    console.log("RENDER", id);
    const s = game(id);
    await install(s);
    await shot(id, 1440);
    await shot(id, 390);
    assert.deepEqual(errors, [], id + " browser errors");
    if (
      C.games.find((d) => d.id === id).engine === "expansion" ||
      id === "putt"
    ) {
      const fresh = game(id);
      await install(fresh);
      await page.setViewportSize({ width: 390, height: 844 });
      if (["bumper", "volcano", "putt"].includes(id)) {
        const box = await page.locator("#party-scene").boundingBox(),
          x = box.x + box.width * 0.5,
          y = box.y + box.height * 0.48;
        const response = page.waitForResponse(
          (r) =>
            r.url().includes("party-action") &&
            r.request().postDataJSON()?.action === "play",
        );
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x + 55, y + 40, { steps: 8 });
        await page.waitForTimeout(230);
        await page.mouse.up();
        const reply = await response;
        assert.equal(reply.status(), 200, await reply.text());
        await page.waitForTimeout(600);
        const actual = await state();
        assert.ok(actual.game.progress[0].inputs > 0, id + " pointer input");
        if (id === "putt") assert.ok(actual.game.progress[0].shot);
        else
          assert.ok(
            Math.abs(actual.game.progress[0].x - fresh.game.progress[0].x) >
              0.01,
          );
      } else if (id === "safe-panel") {
        const type = fresh.game.secrets[0].heist.screws[0].type;
        await page.locator(`[data-tool="${type}"]`).click();
        await page.waitForTimeout(100);
        await click(`[data-control="screw:0:${type}"]`, "play");
        assert.ok((await state()).game.secrets[0].heist.screws[0].removed);
      } else if (id === "safe-wires") {
        await click('[data-control="card:open"]', "play");
        await page.locator(".wire-note").waitFor();
        await page.waitForTimeout(380);
        await click('[data-control="card:close"]', "play");
        await page.waitForTimeout(380);
        await click(
          `[data-control="cut:${fresh.game.secrets[0].heist.order[0]}"]`,
          "play",
        );
        assert.equal((await state()).game.progress[0].step, 1);
      } else if (id === "puzzle") {
        const tiles = fresh.game.progress[0].tiles,
          blank = tiles.indexOf(0),
          tile = tiles.findIndex((_, i) =>
            require("../assets/party/expansion-rules").adjacent(blank, i),
          );
        await click(`[data-control="${tile}"]`, "play");
        assert.notDeepEqual((await state()).game.progress[0].tiles, tiles);
      } else {
        const value =
          id === "safe-dial"
            ? 8
            : id === "basket"
              ? "shoot"
              : id === "baseball"
                ? "swing"
                : 0;
        await click(`[data-control="${value}"]`, "play");
        assert.ok(
          (await state()).game.progress[0].inputs > 0,
          id + " control input",
        );
      }
    }
  }
  // The last confetti signal can expire before the round timer. Rendering
  // that real interval must not dereference a missing cue and stall frames.
  const lastSignal = game("confetti");
  lastSignal.game.beats = [{ index: 0, at: 0, window: 100, color: 0 }];
  await install(lastSignal);
  await page.waitForTimeout(600);
  await shot("confetti-after-last-signal", 390);
  assert.deepEqual(errors, [], "empty cue at the end of Confetti Factory");
  for (const phase of [
    "order-roll",
    "selection",
    "trophy-flight",
    "finale",
    "complete",
  ]) {
    console.log("PHASE", phase);
    let s = structuredClone(base);
    s.orderAt = Date.now();
    s.deadline = Date.now() + 60000;
    if (phase === "selection") {
      s = game("basket");
      s.phase = "selection";
      s.selectionAt = Date.now();
      s.deadline = Date.now() + 4800;
    } else if (phase === "trophy-flight") {
      s.phase = phase;
      s.trophyFlight = { from: 10, to: 22, at: Date.now(), duration: 6200 };
      s.event = { kind: "trophy-purchase", bought: true };
      s.movement = { remaining: 1 };
      s.deadline = Date.now() + 6200;
    } else if (phase === "finale") {
      require("../netlify/functions/party/ceremony").startFinale(s, Date.now());
    } else if (phase === "complete") {
      s.phase = phase;
      s.winner = s.players[0].id;
      s.finished = Date.now();
      s.rewards = [0, 0, 0, 0];
      s.deadline = Date.now() + 100000;
      s.game = game("basket").game;
      s.game.coinAwards = [10, 6, 3, 2];
    }
    await install(s);
    await shot(phase, 1440);
    await shot(phase, 390);
    assert.deepEqual(errors, [], phase + " errors");
  }
  console.log("V8 RENDER SMOKE PASS", errors);
} finally {
  await browser.close();
  await server.close();
}
