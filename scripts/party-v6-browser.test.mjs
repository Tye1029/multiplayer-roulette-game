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
      { data: { action: "register", name: "Polish QA", character: "ghost" } },
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
  base.phase = "board";
  base.turnIndex = 0;
  await server.pg.query(
    "INSERT INTO party_rooms(id,owner_id,request_id,state) VALUES($1,$2,$3,$4::jsonb)",
    [base.id, profile.id, crypto.randomUUID(), JSON.stringify(base)],
  );
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.stack));
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
      path: path.join(out, "v6-" + name + "-" + width + ".png"),
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
  // Route geometry and the same destination choices on the scene at both sizes.
  let s = structuredClone(base);
  s.phase = "choice";
  s.players[0].position = 5;
  s.movement = { remaining: 7 };
  s.deadline = Date.now() + 60000;
  await install(s);
  assert.equal(await page.locator("#scene-controls [data-next]").count(), 2);
  assert.match(await page.locator("#scene-controls").innerText(), /Land on/);
  await shot("routes");
  await shot("routes", 390);
  await click("[data-next='34']", "choose");
  assert.ok((await state()).lastMove.path.includes(34));
  // Illustrated stock, visible inventory, and a transactional replacement.
  s = structuredClone(base);
  s.players[0].position = 4;
  s.players[0].tokens = 40;
  s.players[0].items = ["boost", "shield", "swap"];
  s.movement = { remaining: 0, stopShop: true };
  s.dice = { values: [1], total: 1 };
  s.phase = "walking";
  s.deadline = Date.now();
  M.advance(s, Date.now());
  await install(s);
  assert.equal(await page.locator("[data-buy-item]").count(), 4);
  assert.equal(await page.locator("[data-buy-item=warp]").count(), 0);
  assert.equal(
    await page.locator(".score-chip.you .profile-pocket img").count(),
    3,
  );
  await shot("shop", 390);
  await page.locator("[data-buy-item=double]").click();
  await click("[data-replace-index='1']", "buy-item");
  assert.deepEqual((await state()).players[0].items, [
    "boost",
    "double",
    "swap",
  ]);
  await click("[data-action=continue]", "continue");
  assert.equal((await state()).players[0].position, 5);
  // Full gift pockets offer the same replacement interface without a purchase.
  s = structuredClone(base);
  s.players[0].position = 18;
  s.players[0].items = ["boost", "shield", "swap"];
  s.movement = { remaining: 0 };
  s.phase = "walking";
  s.deadline = Date.now();
  M.advance(s, Date.now());
  await install(s);
  const gift = s.event.pendingItem;
  await click("[data-replace-index='2']", "accept-item");
  assert.equal((await state()).players[0].items[2], gift);
  // An explicit trophy purchase and selectable rival profiles.
  s = structuredClone(base);
  s.players[0].position = 9;
  s.players[0].tokens = 20;
  s.movement = { remaining: 1 };
  s.dice = { values: [1], total: 1 };
  s.phase = "rolling";
  s.deadline = Date.now();
  M.advance(s, Date.now());
  M.advance(s, s.deadline);
  await install(s);
  await shot("trophy", 390);
  await click("[data-action=buy-trophy]", "buy-trophy");
  assert.equal((await state()).players[0].trophies, 1);
  s = structuredClone(base);
  s.players[0].position = 8;
  s.movement = { remaining: 0 };
  s.phase = "walking";
  s.deadline = Date.now();
  M.advance(s, Date.now());
  await install(s);
  assert.equal(await page.locator(".rival-card").count(), 3);
  await page.locator(".rival-card").nth(2).click();
  assert.equal(
    await page.locator('input[name="duel-rival"]:checked').inputValue(),
    "actor3",
  );
  await shot("rivals", 390);
  // No arena action before GO, and jump response before a delayed server answer.
  s = game("rope");
  s.phase = "countdown";
  s.game.start = Date.now() + 15000;
  s.game.end = s.game.start + 35000;
  s.deadline = s.game.start;
  s.game.simAt = s.game.start;
  s.game.beats[0].at = 2000;
  s.game.beats[0].high = false;
  s.game.beats[0].window = 1000;
  await install(s);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.waitForTimeout(250);
  // Element screenshots also capture sibling DOM overlays over the canvas.
  // The countdown digits must tick; only the underlying arena must be frozen.
  const freezeCapture = {
    style: "#scene-clock,#start-count{visibility:hidden!important}",
  };
  const frameA = await page.locator("#party-scene").screenshot(freezeCapture);
  await page.waitForTimeout(300);
  const frameB = await page.locator("#party-scene").screenshot(freezeCapture);
  await fs.writeFile(path.join(out, "v6-countdown-a.png"), frameA);
  await fs.writeFile(path.join(out, "v6-countdown-b.png"), frameB);
  console.log("Countdown", (await state()).phase);
  assert.ok(frameA.equals(frameB), "gameplay is stationary during countdown");
  await page.locator("body[data-phase=playing]").waitFor({ timeout: 25000 });
  await page.evaluate(() => {
    const render = PartyScene.render;
    window.feedbackFrames = [];
    window.inputPressed = 0;
    document.addEventListener(
      "keydown",
      () => (window.inputPressed = performance.now()),
      { capture: true, once: true },
    );
    PartyScene.render = (...args) => {
      if (args[4]?.localInput)
        window.feedbackFrames.push({
          at: performance.now(),
          value: args[4].localInput.value,
        });
      return render(...args);
    };
  });
  await page.route("**/party-action", async (route) => {
    if (route.request().postDataJSON()?.action === "play")
      await new Promise((r) => setTimeout(r, 550));
    await route.continue();
  });
  await page.waitForTimeout(Math.max(0, s.game.start + 1800 - Date.now()));
  const response = page.waitForResponse(
    (r) =>
      r.url().includes("party-action") &&
      r.request().postDataJSON()?.action === "play",
  );
  await page.keyboard.press("Space");
  await page.waitForTimeout(170);
  const feedback = await page.evaluate(() => ({
    press: inputPressed,
    frame: feedbackFrames[0],
  }));
  assert.ok(
    feedback.frame &&
      feedback.frame.value === "jump" &&
      feedback.frame.at - feedback.press < 150,
    "immediate jump preview while network is delayed",
  );
  assert.equal(
    (await state()).game.progress[0].inputs,
    0,
    "local visuals cannot award a score",
  );
  await shot("jump-local");
  assert.equal((await response).status(), 200);
  await page.unrouteAll({ behavior: "wait" });
  // Separate ripples, real single catches, docked fish and the measuring animation.
  s = game("fish");
  s.players.slice(1).forEach((p) => (p.bot = true));
  const first = Date.now() - s.game.start + 2200;
  s.game.fishBeats.forEach((beats, i) => {
    beats[0].at = first + i * 240;
  });
  await install(s);
  await shot("fish-ripples", 390);
  await page.waitForTimeout(
    Math.max(0, s.game.start + first + 140 - Date.now()),
  );
  await click('[data-control="reel"]', "play");
  assert.ok((await state()).game.progress[0].catch);
  await page.locator("body[data-phase=measuring]").waitFor({ timeout: 20000 });
  await shot("fish-measure", 390);
  await shot("fish-measure", 1440);
  assert.equal((await state()).game.progress.filter((v) => v.catch).length, 4);
  // Rock / paper / scissors and the smaller bomb with its flight arc.
  s = game("fencing");
  s.game.participants = [s.players[0].id, "actor1"];
  s.game.active = [0, 1];
  s.game.sideDuel = true;
  await install(s);
  assert.equal(await page.locator('[data-control="rock"]').count(), 1);
  await shot("rps", 390);
  s = game("bomb");
  s.game.shared.holder = 0;
  s.game.shared.fuseEnd = Date.now() + 20000;
  await install(s);
  await shot("bomb", 1440);
  await click('[data-control="left"]', "play");
  await page.waitForTimeout(160);
  await shot("bomb-flight", 390);
  // Touch instructions update from actual touch input; all local item assets are served.
  await page.touchscreen.tap(30, 30);
  assert.match(
    await page.locator(".control-guide").innerText(),
    /TOUCH CONTROLS/,
  );
  for (const item of C.items) {
    const r = await ctx.request.get(
      server.origin + `/assets/party/images/items/${item.id}.svg`,
    );
    assert.equal(r.status(), 200);
    assert.match(r.headers()["content-type"], /svg/);
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS: V6 route previews, distinct illustrated shops, item replacement, trophy prompts, rival cards, stationary countdown, immediate delayed-network jump feedback, separate fishing cues, docked single catches, measuring, RPS, bomb flight and desktop/mobile layouts.",
  );
} finally {
  await browser.close();
  await server.close();
}
