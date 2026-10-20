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
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      hasTouch: true,
      permissions: ["clipboard-read", "clipboard-write"],
    }),
    page = await context.newPage();
  let latest;
  page.on("pageerror", (e) => {
    errors.push(e.stack);
    console.log(e.stack);
  });
  page.on("response", async (r) => {
    if (r.url().includes("party-action")) {
      const b = await r.json().catch(() => ({}));
      if (
        b.game &&
        (!latest ||
          b.game.id !== latest.id ||
          b.game.revision >= latest.revision)
      )
        latest = b.game;
    }
  });
  async function click(sel, action) {
    const response = page.waitForResponse(
      (r) =>
        r.url().includes("party-action") &&
        r.request().postDataJSON()?.action === action,
    );
    await page.locator(sel).first().click();
    const r = await response;
    assert.equal(r.status(), 200, await r.text());
    return r.json();
  }
  async function shot(name, width = 1440) {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    await page.waitForTimeout(220);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      ),
      false,
      name + " overflow",
    );
    await page.screenshot({
      path: path.join(out, `v10-${name}-${width}.png`),
      fullPage: true,
    });
  }
  async function diag() {
    return page.evaluate(() => PartyScene.diagnostics());
  }
  async function waitUntil(fn, timeout = 12000) {
    const at = Date.now();
    while (!fn()) {
      if (Date.now() - at > timeout)
        throw Error("Timed out waiting for game condition");
      await page.waitForTimeout(50);
    }
  }
  await page.goto(server.origin + "/party.html");
  await page.locator("[data-rules=climb]").click();
  await page.locator("[data-test-game=climb]").click();
  await page.locator("#nickname").fill("Polish Test");
  await page.getByRole("button", { name: "Let’s play", exact: false }).click();
  await page.locator("#share-code").waitFor();
  for (const id of process.env.PARTY_POLISH_GAMES?.split(",") || [
    "climb",
    "fish",
    "memory",
    "lantern",
    "hop",
    "putt",
  ]) {
    console.log("TEST", id);
    if (id !== "climb") {
      await page.locator("[data-debug]").first().click();
      await page.locator("#debug-game").selectOption(id);
      await click("[data-debug-play]", "debug");
    }
    await shot(id + "-ready");
    let d = await diag();
    assert.equal(d.renderer, true);
    assert.equal(d.scene, id);
    if (id === "fish")
      assert.ok(
        d.ripples.flat().every((r) => !r.visible),
        "no pregame fishing ripples",
      );
    if (id === "lantern") assert.equal(d.cardVisible, false, "no pregame card");
    if (id === "hop") assert.equal(d.rollerVisible, false, "no pregame roller");
    await click("[data-action=game-ready]", "game-ready");
    assert.equal(latest.phase, "countdown");
    await page.locator("body[data-phase=playing]").waitFor({ timeout: 15000 });
    await page.waitForTimeout(150);
    const own = latest.players.findIndex((p) => p.id === latest.you);
    if (id === "climb") {
      await click(
        `[data-direction=${latest.game.progress[own].next[0]}]`,
        "play",
      );
      assert.equal(latest.game.progress[own].step, 1);
      if (process.env.PARTY_FINISH_CLIMB) {
        for (let step = 1; step < 24; step++) {
          await page.waitForTimeout(155);
          await click(
            `[data-direction=${latest.game.progress[own].next[0]}]`,
            "play",
          );
        }
        assert.equal(latest.game.progress[own].step, 24);
        assert.ok(latest.game.progress[own].finished);
        await page.waitForFunction(
          (own) => PartyScene.diagnostics().actors[own].position[1] > 30.99,
          own,
        );
        await shot("live-summit", 390);
      }
    }
    if (id === "fish") {
      const cue = latest.game.cues[own];
      await waitUntil(() => Date.now() >= latest.game.start + cue.at + 80);
      d = await diag();
      assert.ok(d.ripples[own].every((r) => r.visible));
      const sizes = d.ripples[own].map((r) => r.size);
      await page.waitForTimeout(100);
      assert.deepEqual(
        (await diag()).ripples[own].map((r) => r.size),
        sizes,
        "ripples do not grow",
      );
      await click("[data-control=reel]", "play");
      assert.ok(latest.game.progress[own].catch);
      await page.waitForTimeout(1800);
    }
    if (id === "memory") {
      const v = latest.game.progress[own],
        pattern = [...v.pattern];
      assert.ok(await page.locator("[data-pad='0']").isDisabled());
      await waitUntil(
        () => Date.now() >= v.showAt + 1200 + pattern.length * 650 + 350,
      );
      for (const n of pattern) {
        await click(`[data-pad='${n}']`, "play");
        await page.waitForTimeout(70);
      }
      assert.ok(latest.game.scores[own] > 0);
    }
    if (id === "lantern") {
      await page.waitForTimeout(850);
      assert.equal((await diag()).cardVisible, true);
      const layout = latest.game.cue.layout;
      const tile = layout.indexOf(latest.game.cue.color);
      await click(`[data-control='${tile}']`, "play");
    }
    if (id === "hop") {
      const b = latest.game.cue,
        lead = { small: 300, medium: 410, large: 520 }[b.size];
      // Follow the same synchronized presentation clock as the player. A live
      // server and the test host can differ by more than this timing window.
      const target = latest.game.start + b.at - lead;
      await page.waitForFunction(
        (at) => PartyScene.diagnostics().renderStamp >= at,
        target,
        { polling: "raf" },
      );
      await click("[data-control=jump]", "play");
      assert.ok(latest.game.progress[own].jumpAt);
      await waitUntil(() => latest.game.progress[own].resolved >= b.index);
      assert.ok(
        latest.game.scores[own] > 0,
        `Jump received ${latest.game.progress[own].last - target}ms from the target: ${latest.game.progress[own].feedback}`,
      );
    }
    if (id === "putt") {
      await page.setViewportSize({ width: 1440, height: 1000 });
      const rect = await page.locator("#party-scene").boundingBox();
      const x = rect.x + rect.width * 0.45,
        y = rect.y + rect.height * 0.5;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + 10, y + 10, { steps: 3 });
      const small = (await diag()).arrowLength;
      await page.mouse.move(x + 120, y + 100, { steps: 8 });
      await page.waitForTimeout(100);
      assert.ok(
        (await diag()).arrowLength > small,
        "pullback charges visible arrow",
      );
      await shot("putt-charge");
      await page.mouse.up();
      await waitUntil(() => !!latest.game.progress[own].shot);
      assert.equal(
        await page.getByText("Watch their shot", { exact: false }).count(),
        0,
      );
    }
    await shot(id + "-playing");
    await shot(id + "-playing", 390);
    await shot(id + "-playing", 320);
    await page.locator("[data-debug]").first().click();
    await page.locator("[data-copy-debug]").click();
    await page.waitForFunction(() =>
      document
        .querySelector("#debug-copy-status")
        ?.textContent.includes("Copied"),
    );
    assert.match(
      await page.locator("#debug-copy-status").innerText(),
      /Copied/,
    );
    const report = JSON.parse(
      await page.evaluate(() => navigator.clipboard.readText()),
    );
    console.log(
      "SCENE",
      id,
      report.scene.drawCalls,
      "draw calls",
      report.scene.triangles,
      "triangles",
    );
    assert.equal(report.build, "BOARDWALK_CARNIVAL_V12");
    assert.equal(report.game.id, id);
    assert.ok(report.scene.renderer);
    assert.equal(report.game.sequence, undefined);
    assert.ok(report.game.progress.every((v) => !v.pattern));
    await click("[data-debug-op=finish]", "debug");
    await page.locator("body[data-phase=round-end]").waitFor();
    assert.ok(latest.game.placements.every((p) => p >= 1 && p <= 4));
    await shot(id + "-results", 390);
  }
  if (server.pg && !process.env.PARTY_POLISH_GAMES) {
    const M = require("../netlify/functions/party/model"),
      C = require("../assets/party/catalog");
    async function fixture(id, edit) {
      const state = (
        await server.pg.query("SELECT state FROM party_rooms WHERE id=$1", [
          latest.id,
        ])
      ).rows[0].state;
      M.testStart(state, id, Date.now());
      state.players.forEach((p) => (p.bot = false));
      const g = state.game;
      state.phase = "playing";
      g.start = Date.now() - 500;
      g.end = Date.now() + 90000;
      g.simAt = Date.now();
      state.deadline = g.end;
      edit(g, state);
      state.revision++;
      await server.pg.query(
        "UPDATE party_rooms SET state=$2::jsonb WHERE id=$1",
        [state.id, JSON.stringify(state)],
      );
      await page.reload();
      await page.locator("body[data-phase=playing]").waitFor();
      await page.waitForTimeout(150);
    }
    for (let course = 0; course < 3; course++) {
      await fixture("putt", (g) => {
        g.putt.holes = [0, 1, 2];
        g.putt.course = course;
        g.progress[0].ball = [...C.holes[course].tee];
      });
      await shot("golf-course-" + course, 1440);
      await shot("golf-course-" + course, 390);
    }
    await fixture("putt", (g) => {
      g.putt.holes = [0, 1, 2];
      const at = Date.now(),
        cup = C.holes[0].cup;
      g.progress[0].holed = true;
      g.progress[0].ball = [...cup];
      g.progress[0].shot = {
        at,
        course: 0,
        resolved: true,
        duration: 10000,
        frames: [
          [0, ...cup, 1, 0],
          [10000, ...cup, 1, 0],
        ],
      };
      g.putt.holeEvent = { at: at - 100, course: 0, player: 0 };
    });
    await shot("golf-hole-in", 1440);
    for (const age of [250, 1900, 4700]) {
      await fixture("lantern", (g) => {
        g.beats.forEach((b) => (b.at += 20000));
        const at = Date.now() - age;
        Object.assign(g.progress[0], {
          eliminatedAt: at,
          finished: at,
          fallTile: 0,
        });
        g.lanternLast = { at, index: 0, layout: [0, 1, 2, 3], safeTile: 3 };
      });
      await shot("lantern-swim-" + age, 1440);
      const a = (await diag()).actors[0];
      assert.equal(a.visible, true);
      assert.ok(a.position.every(Number.isFinite));
    }
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS: revised games, live controls, idle pregame scenes, stable ripple sizes, visible charge arrow, desktop/390/320 layouts, placements, safe copied diagnostics.",
  );
} finally {
  await browser.close();
  await server.close();
}
