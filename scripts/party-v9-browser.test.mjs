import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { startPartyServer } from "./party-test-server.mjs";
const require = createRequire(import.meta.url),
  { chromium } = require(process.env.RPS_PLAYWRIGHT_MODULE || "playwright"),
  server = process.env.PARTY_TEST_ORIGIN
    ? { origin: process.env.PARTY_TEST_ORIGIN, close: async () => {} }
    : await startPartyServer(),
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
  const page = await ctx.newPage();
  let latest;
  page.on("pageerror", (e) => {
    errors.push(e.stack);
    console.log("PAGE ERROR", e.stack);
  });
  page.on("response", async (r) => {
    if (r.url().includes("party-action")) {
      const b = await r.json().catch(() => ({}));
      if (
        b.game &&
        (!latest ||
          b.game.revision >= latest.revision ||
          b.game.id !== latest.id)
      )
        latest = b.game;
      if (r.status() >= 500) console.log("API ERROR", r.status(), b);
    }
  });
  async function click(selector, action) {
    const reply = page.waitForResponse(
      (r) =>
        r.url().includes("party-action") &&
        r.request().postDataJSON()?.action === action,
    );
    await page.locator(selector).first().click();
    const r = await reply;
    assert.equal(r.status(), 200, await r.text());
    return r.json();
  }
  async function shot(name, width = 390) {
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
      path: path.join(out, "v9-" + name + "-" + width + ".png"),
      fullPage: true,
    });
  }
  async function ready() {
    await click("[data-action=game-ready]", "game-ready");
    await page.locator("body[data-phase=playing]").waitFor({ timeout: 15000 });
    await page.locator("#midway-panel").waitFor();
    await page.waitForTimeout(200);
  }
  async function select(id) {
    await page.locator("[data-debug]").first().click();
    await page.locator("#debug-game").selectOption(id);
    await click("[data-debug-play]", "debug");
    await ready();
  }
  async function until(fn, ms = 12000) {
    const start = Date.now();
    while (!fn()) {
      if (Date.now() - start > ms)
        throw Error("Timed out waiting for gameplay condition");
      await page.waitForTimeout(50);
    }
  }
  await page.goto(server.origin + "/party.html");
  await page.locator("[data-rules=pizza]").click();
  await page.locator("[data-test-game=pizza]").click();
  await page.locator("#nickname").fill("Midway QA");
  await page.getByRole("button", { name: "Let’s play", exact: false }).click();
  await page.locator("#share-code").waitFor();
  assert.equal(latest.practice, true);
  assert.equal(latest.players.length, 4);
  await ready();
  console.log("PIZZA");
  let own = latest.players.findIndex((p) => p.id === latest.you),
    v = latest.game.progress[own],
    ticket = v.ticket;
  await click(`[data-control="shape:${ticket.shape}"]`, "play");
  await click(`[data-control="cheese:${ticket.cheese}"]`, "play");
  for (const top of ticket.toppings)
    await click(`[data-control="topping:${top}"]`, "play");
  await click("[data-control=bake]", "play");
  assert.equal(await page.locator("[data-control=serve]").isDisabled(), true);
  await shot("pizza-oven", 1440);
  await shot("pizza-oven");
  await page
    .locator("[data-control=serve]:enabled")
    .waitFor({ timeout: 10000 });
  await click("[data-control=serve]", "play");
  assert.equal(latest.game.progress[own].delivery.accuracy, 100);
  assert.ok(latest.game.scores[own] > 0);
  await shot("pizza-delivered", 320);
  console.log("MINE");
  await select("mine");
  await shot("mine", 1440);
  await shot("mine");
  const testRoom = latest.id;
  await page.reload();
  await page.locator(".midway-mine").waitFor();
  assert.equal(latest.id, testRoom, "reload reconnects to the same test room");
  await page.locator("#party-scene").tap({ position: { x: 20, y: 90 } });
  await page.waitForFunction(() =>
    document
      .querySelector(".control-guide")
      ?.textContent.includes("TAP TO DIG"),
  );
  v = latest.game.progress[own];
  await click("[data-control=down]", "play");
  await until(() => latest.game.progress[own].y === 1);
  await click("[data-control=up]", "play");
  await until(() => latest.game.progress[own].y === 0);
  await shot("mine-surface", 320);
  console.log("MOLES");
  await select("moles");
  await shot("moles", 1440);
  await shot("moles");
  async function hitFreshVisitor(friendly) {
    // Screenshots can finish near the end of a visitor's window. React to a
    // newly arriving, visibly raised visitor instead of a stale poll snapshot.
    for (let attempt = 0; attempt < 4; attempt++) {
      const previous = latest.game.cue?.index ?? -1;
      await until(
        () =>
          latest.game.cue &&
          latest.game.cue.index > previous &&
          (latest.game.cue.kind !== "mole") === friendly,
      );
      const hole = latest.game.cue.hole;
      await page
        .locator(`.mole-hole.up[data-control="${hole}"]:enabled`)
        .waitFor({ timeout: 2000 });
      await click(`[data-control="${hole}"]`, "play");
      if (
        friendly
          ? latest.game.progress[own].stunUntil > latest.serverTime
          : latest.game.scores[own] > 0
      )
        return;
    }
    assert.fail("Visible visitor was not accepted within four attempts");
  }
  await hitFreshVisitor(true);
  await page.waitForTimeout(100);
  assert.equal(await page.locator(".mole-hole:enabled").count(), 0);
  await shot("moles-stunned");
  await page.waitForTimeout(2600);
  await hitFreshVisitor(false);
  assert.ok(latest.game.scores[own] > 0);
  console.log("ROBOTS");
  await select("robots");
  await shot("robots-semifinal", 1440);
  await shot("robots-semifinal");
  const gameStart = latest.game.start,
    robotStart = Date.now();
  let semiShot = false,
    finalShot = false;
  while (Date.now() - robotStart < 48000 && latest.phase === "playing") {
    const button = page.locator("[data-control=punch]:enabled");
    // Use real key presses for rapid punches: Playwright's click stabilization
    // otherwise waits on the button's press animation until the bout ends.
    if (await button.count()) await page.keyboard.press("Space");
    if (latest.game.robots.resolved.includes(0) && !semiShot) {
      semiShot = true;
      await shot("robots-knockout");
    }
    if (latest.game.robots.stage.index === 1 && !finalShot) {
      finalShot = true;
      await shot("robots-final", 1440);
      await shot("robots-final");
    }
    await page.waitForTimeout(65);
  }
  assert.equal(latest.game.start, gameStart);
  assert.equal(latest.phase, "round-end");
  assert.equal(latest.game.robots.resolved.length, 2);
  assert.ok(latest.game.robots.final.length === 2);
  assert.ok(latest.game.robots.counts[own][0] > 0);
  await shot("robots-result");
  console.log("COOKIES");
  await select("draft");
  assert.equal(latest.players.length, 2);
  own = latest.players.findIndex((p) => p.id === latest.you);
  await shot("cookies-choice", 1440);
  await shot("cookies-choice");
  await click('[data-control="1"]', "play");
  assert.equal(latest.game.privateChoices, undefined);
  await until(() => latest.game.shared.cookieReveal);
  await shot("cookies-reveal");
  assert.ok(latest.game.shared.cookieReveal.values.length === 3);
  console.log("BOARD DEBUG");
  await page.locator("[data-debug]").first().click();
  await click("[data-test-game=board]", "debug");
  assert.equal(latest.game, null);
  await page.locator("[data-debug]").first().click();
  await page.locator("#debug-space").selectOption("39");
  await click("[data-debug-op=space]", "debug");
  assert.equal(latest.players[0].position, 39);
  await page.locator("[data-debug]").first().click();
  await shot("board-debug");
  await click('[data-debug-roll="3"]', "debug");
  assert.deepEqual(latest.dice.values, [3]);
  await page.locator("[data-debug]").first().click();
  await click("[data-leave]", "leave");
  await page.locator("[data-rules=pizza]").waitFor();
  const p = await ctx.request.post(
    server.origin + "/.netlify/functions/party-action",
    { data: { action: "profile" } },
  );
  assert.equal((await p.json()).profile.coins, 0);
  assert.deepEqual(errors, []);
  console.log(
    "PASS V9 real UI: isolated launch/debug, pizza, shared mining, mole stun, full robot bracket, cookies, mobile and desktop; no page errors.",
  );
} finally {
  await browser.close();
  await server.close();
}
