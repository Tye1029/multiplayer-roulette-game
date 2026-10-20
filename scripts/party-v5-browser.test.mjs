import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
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
  });
const out = path.join(os.tmpdir(), "boardwalk-party-qa"),
  errors = [];
await fs.mkdir(out, { recursive: true });
try {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  await ctx.addInitScript(() => {
    localStorage.setItem("boardwalk-sound", "off");
  });
  const registered = await ctx.request.post(
    server.origin + "/.netlify/functions/party-action",
    { data: { action: "register", name: "Polish QA", character: "ghost" } },
  );
  assert.equal(registered.status(), 200);
  const profile = (await registered.json()).profile;
  const s = M.create(
    "ABC234",
    { ...profile, characterPicked: true },
    "party",
    Date.now(),
  );
  for (let i = 1; i < 4; i++)
    M.join(s, {
      id: "actor" + i,
      name: ["", "Pippa", "Bones", "Rowan"][i],
      character: ["", "princess", "skeleton", "knight"][i],
      characterPicked: true,
    });
  s.ready = s.players.map((p) => p.id);
  M.begin(s, Date.now());
  await server.pg.query(
    "INSERT INTO party_rooms(id,owner_id,request_id,state) VALUES($1,$2,$3,$4::jsonb)",
    [s.id, profile.id, crypto.randomUUID(), JSON.stringify(s)],
  );
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.stack));
  async function install(id, participants = null) {
    const state = structuredClone(s),
      now = Date.now();
    state.phase = "board-end";
    state.deadline = now;
    M.advance(state, now);
    Object.assign(state.game, {
      id,
      start: now - 5000,
      end: now + 60000,
      duration: 65000,
      simAt: now,
      participants: participants || state.players.map((p) => p.id),
      sideDuel: !!participants,
    });
    state.game.active = state.players
      .map((p, i) => (state.game.participants.includes(p.id) ? i : -1))
      .filter((i) => i >= 0);
    G.setup(state.game);
    if (state.game.survival) state.game.beats.forEach((b) => (b.at += 7000));
    state.phase = "playing";
    state.deadline = state.game.end;
    state.revision++;
    await server.pg.query(
      "UPDATE party_rooms SET state=$2::jsonb WHERE id=$1",
      [s.id, JSON.stringify(state)],
    );
    await page.goto(server.origin + "/party.html?room=" + s.id);
    await page.locator(`body[data-game="${id}"][data-phase=playing]`).waitFor();
    return state;
  }
  for (const id of [
    "kart",
    "maze",
    "stack",
    "balloon",
    "fuse",
    "ricochet",
    "cannon",
    "rope",
    "lantern",
    "fencing",
  ]) {
    const duel = C.games.find((d) => d.id === id).duelOnly;
    await install(id, duel ? s.players.slice(0, 2).map((p) => p.id) : null);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      await page.waitForTimeout(250);
      await page.screenshot({
        path: path.join(out, `v5-final-${id}-${width}.png`),
        fullPage: true,
      });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        ),
        false,
        id + " overflow",
      );
      const controls = await page
        .locator("#scene-controls .controls")
        .boundingBox();
      if (width === 390)
        assert.ok(
          controls && controls.y + controls.height <= 844,
          id + " controls below viewport",
        );
    }
  }
  // Observe a real authoritative elimination, then sample both the fall and the hole.
  const fall = await install("lantern");
  fall.game.beats[0] = {
    ...fall.game.beats[0],
    at: Date.now() - fall.game.start + 600,
    window: 400,
    color: 1,
  };
  fall.game.progress[0].chosen = 0;
  fall.game.progress[0].inputs = 1;
  fall.game.progress[1].chosen = 1;
  fall.game.progress[1].inputs = 1;
  fall.game.simAt = Date.now();
  await server.pg.query("UPDATE party_rooms SET state=$2::jsonb WHERE id=$1", [
    s.id,
    JSON.stringify(fall),
  ]);
  await page.reload();
  await page.waitForTimeout(1400);
  await page.screenshot({
    path: path.join(out, "v5-lantern-fall.png"),
    fullPage: true,
  });
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: path.join(out, "v5-lantern-out.png"),
    fullPage: true,
  });
  const ended = (
    await server.pg.query("SELECT state FROM party_rooms WHERE id=$1", [s.id])
  ).rows[0].state;
  assert.ok(ended.game.progress[0].eliminatedAt);
  const skip = await install("draft", ["actor1", "actor2"]);
  skip.game.duration = 20000;
  G.setup(skip.game);
  skip.phase = "intro";
  skip.deadline = Date.now() + 60000;
  skip.players[1].bot = skip.players[2].bot = true;
  await server.pg.query("UPDATE party_rooms SET state=$2::jsonb WHERE id=$1", [
    s.id,
    JSON.stringify(skip),
  ]);
  await page.reload();
  const skipped = page.waitForResponse(
    (r) =>
      r.url().includes("/party-action") &&
      r.request().postDataJSON()?.action === "skip-bots",
  );
  await page.locator("[data-action=skip-bots]").click();
  const skipReply = await skipped;
  assert.equal(skipReply.status(), 200, await skipReply.text());
  await page.locator("body[data-phase=side-result]").waitFor();
  assert.equal(await page.locator(".result-row").count(), 2);
  await page.screenshot({
    path: path.join(out, "v5-bot-skip-results.png"),
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: final desktop/mobile puzzle cameras, shared kart track, two-player duel scenes, survival fall and all-bot skip results.",
  );
} finally {
  await browser.close();
  await server.close();
}
