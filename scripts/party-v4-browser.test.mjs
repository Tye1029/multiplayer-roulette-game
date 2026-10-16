import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { startPartyServer } from "./party-test-server.mjs";
const require = createRequire(import.meta.url),
  { chromium } = require(process.env.RPS_PLAYWRIGHT_MODULE || "playwright");
const server = await startPartyServer(),
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.RPS_BROWSER || undefined,
    args: ["--enable-unsafe-swiftshader"],
  });
const out = path.join(os.tmpdir(), "boardwalk-party-qa"),
  errors = [];
await fs.mkdir(out, { recursive: true });
try {
  for (const [turns, width] of [
    [10, 1440],
    [20, 390],
    [30, 320],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      hasTouch: width < 600,
    });
    await context.addInitScript(() => {
      localStorage.setItem("boardwalk-motion", "off");
      localStorage.setItem("boardwalk-sound", "off");
    });
    const p = await context.newPage();
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(server.origin + "/party.html");
    await p.locator("[data-create=party]").first().click();
    await p.locator("#nickname").fill("Festival " + turns);
    await p.getByRole("button", { name: "Let’s play", exact: false }).click();
    await p.locator(`[data-turns="${turns}"]`).click();
    await p.locator("#share-code").waitFor();
    const code = new URL(p.url()).searchParams.get("room");
    const state = async () =>
      (
        await server.pg.query("SELECT state FROM party_rooms WHERE id=$1", [
          code,
        ])
      ).rows[0].state;
    assert.equal((await state()).rounds, turns);
    assert.equal(await p.locator("[data-action=ready]").isDisabled(), true);
    for (const character of ["ghost", "skeleton", "knight", "princess"]) {
      await p.locator(`[data-pick-character=${character}]`).click();
      await p
        .locator(`[data-pick-character=${character}][aria-pressed=true]`)
        .waitFor();
    }
    await p.locator("[data-action=add-bot]").click();
    await p.getByRole("heading", { name: "2/4 in the party" }).waitFor();
    assert.equal(await p.locator("[data-pick-character]:disabled").count(), 1);
    await p.locator("[data-action=ready]").click();
    await p.locator("[data-action=start]:enabled").click();
    for (let attempts = 0; attempts < 100; attempts++) {
      const opening = await state();
      if (opening.phase === "board") break;
      const roll = p.locator('[data-action="order-roll"]:enabled');
      if (await roll.count()) await roll.click();
      await p.waitForTimeout(500);
    }
    await p.locator("body[data-phase=board]").waitFor();
    const s = await state();
    s.deadline = Date.now() + 180000;
    s.revision++;
    await server.pg.query(
      "UPDATE party_rooms SET state=$2::jsonb WHERE id=$1",
      [code, JSON.stringify(s)],
    );
    await p.evaluate(() => dispatchEvent(new Event("online")));
    assert.match(
      await p.locator(".turns-left").innerText(),
      new RegExp(`Turn 1 / ${turns}`),
    );
    assert.equal(await p.locator(".standing").count(), 2);
    await p.locator("[data-map]").click();
    await p.waitForTimeout(350);
    const point = await p.evaluate(() => {
      const canvas = document.querySelector("#party-scene"),
        r = canvas.getBoundingClientRect();
      for (let y = r.top + 100; y < r.bottom - 40; y += 4)
        for (let x = r.left + 10; x < r.right - 10; x += 4) {
          const id = PartyScene.spaceAt(canvas, x, y);
          if (id !== null && PartyCatalog.spaces[id].type === "loss")
            return { x, y, id };
        }
    });
    assert.ok(point, "a visible rain space can be hit-tested");
    if (width < 600) await p.touchscreen.tap(point.x, point.y);
    else await p.mouse.click(point.x, point.y);
    await p.locator("#space-inspector:not([hidden])").waitFor();
    assert.match(await p.locator("#space-inspector").innerText(), /Rain cloud/);
    assert.match(
      await p.locator("#space-inspector").innerText(),
      /Lose up to 3 coins/,
    );
    await p.screenshot({
      path: path.join(out, `v4-inspect-${width}-${turns}.png`),
      fullPage: true,
    });
    assert.equal(
      await p.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      ),
      false,
    );
    await p.locator("[data-close-space]").click();
    assert.equal(await p.locator("#space-inspector").isHidden(), true);
    // Exercise the live audio graph after a real user gesture (quiet by default).
    await p.evaluate(() => {
      PartyAudio.set(true, true);
      PartyAudio.play("coin");
      PartyAudio.voice("yup", "ghost");
    });
    await p.waitForTimeout(500);
    if (turns === 30) {
      const legacy = await state();
      legacy.version = 3;
      legacy.goal = 58;
      legacy.players.forEach((player) => (player.position = 65));
      legacy.lastMove = {
        player: legacy.players[0].id,
        path: [64, 65],
        at: Date.now(),
        duration: 30000,
      };
      await server.pg.query(
        "UPDATE party_rooms SET state=$2::jsonb WHERE id=$1",
        [code, JSON.stringify(legacy)],
      );
      await p.reload();
      await p.locator("body[data-phase=expired]").waitFor();
      await p.locator("[data-leave]").click();
      await p.locator("[data-create=party]").first().waitFor();
    }
    await context.close();
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS: 10/20/30-turn creation, all four new picks, bot exclusivity, standings, desktop click/mobile tap inspection and audio graph.",
  );
} finally {
  await browser.close();
  await server.close();
}
