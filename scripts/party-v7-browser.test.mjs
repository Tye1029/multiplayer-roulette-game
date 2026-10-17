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
      path: path.join(out, "v7-" + name + "-" + width + ".png"),
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

  // A full inventory must fit every profile at narrow phone widths.
  let s = structuredClone(base);
  for (const p of s.players) p.items = ["double", "shield", "swap"];
  await install(s);
  for (const width of [1440, 390, 320]) {
    await shot("inventory", width);
    const clips = await page.locator(".score-chip").evaluateAll((cards) =>
      cards.flatMap((card) => {
        const c = card.getBoundingClientRect();
        return [...card.querySelectorAll(".profile-pocket img")]
          .filter((img) => {
            const r = img.getBoundingClientRect();
            return r.left < c.left || r.right > c.right || r.bottom > c.bottom;
          })
          .map((x) => x.alt);
      }),
    );
    assert.deepEqual(clips, [], "inventory contained at " + width);
  }
  assert.match(
    await page.locator("#roll-order").innerText(),
    /Roll order[\s\S]*Polish QA/,
  );
  s = structuredClone(base);
  s.phase = "choice";
  s.players[0].position = 25;
  s.movement = { remaining: 4 };
  s.deadline = Date.now() + 60000;
  await install(s);
  await shot("harbor", 1440);
  await shot("harbor", 390);
  assert.equal(await page.locator("#scene-controls [data-next]").count(), 2);
  await click('[data-next="38"]', "choose");
  assert.ok((await state()).lastMove.path.includes(38));
  s = structuredClone(base);
  s.players[0].position = s.goal;
  s.phase = "space";
  s.event = {
    kind: "trophy-purchase",
    text: "A trophy for ten coins.",
    player: profile.id,
  };
  s.deadline = Date.now() + 60000;
  await install(s);
  await shot("trophy", 1440);
  s = structuredClone(base);
  s.players[0].position = C.ferry.from;
  s.phase = "space";
  s.event = { kind: "ferry", text: "Sail for four coins.", player: profile.id };
  s.deadline = Date.now() + 60000;
  await install(s);
  await shot("ferry-offer", 390);
  await click('[data-action="ride-ferry"]', "ride-ferry");
  assert.equal((await state()).players[0].tokens, 6);
  await shot("ferry-ride", 1440);
  await page.locator("body[data-phase=board]").waitFor({ timeout: 12000 });
  assert.equal((await state()).turn, 1);
  for (const id of [
    "ricochet",
    "cannon",
    "bomb",
    "lantern",
    "spotlight",
    "fish",
  ]) {
    s = game(id);
    if (id === "ricochet") {
      s.game.active = [0, 1];
      s.game.participants = s.players.slice(0, 2).map((p) => p.id);
      s.game.sideDuel = true;
    }
    if (id === "bomb") {
      s.game.shared.holder = 0;
      s.game.shared.fuseStarted = Date.now();
      s.game.shared.fuseEnd = Date.now() + 16000;
    }
    if (id === "fish")
      s.game.fishBeats.forEach((beats, i) => {
        beats[0].at = 6000;
        beats[0].size = 0.6 + i * 0.26;
      });
    if (id === "lantern") {
      s.game.beats[0].at = 12000;
      s.game.beats[0].layout = [2, 0, 3, 1];
      s.game.beats[0].color = 0;
    }
    if (id === "spotlight") s.game.beats[0].at = 16000;
    await install(s);
    await shot(id, 1440);
    await shot(id, 390);
    if (id === "ricochet") {
      assert.match(await page.locator("#room-title").innerText(), /Bullseyes/);
      await click('[data-control="fire"]', "play");
      assert.ok((await state()).game.progress[0].shot);
      await shot("arrow-flight", 390);
    }
    if (id === "cannon") {
      await click('[data-control="fire"]', "play");
      assert.ok((await state()).game.shared.shots.length);
      assert.equal(
        await page.locator('[data-control="fire"]').isDisabled(),
        true,
      );
    }
    if (id === "bomb") {
      await click('[data-control="right"]', "play");
      assert.equal((await state()).game.shared.flight.from, 0);
      s = await state();
      s.game.shared.fuseEnd = Date.now() + 2200;
      await install(s);
      await page.waitForTimeout(2250);
      await shot("bomb-pop", 390);
    }
    if (id === "lantern") {
      assert.match(
        await page.locator('[data-control="0"]').innerText(),
        /Mint/,
      );
      await click('[data-control="1"]', "play");
      assert.equal((await state()).game.progress[0].chosen, 1);
      s = await state();
      s.game.beats[0].at = Date.now() - s.game.start + 2000;
      s.game.beats[0].window = 100;
      await install(s);
      await page.waitForTimeout(2100);
      await shot("lantern-drop", 390);
    }
    if (id === "spotlight") {
      await click('[data-control="run"]', "play");
      await page.waitForTimeout(900);
      const before = (await state()).game.progress[0].distance;
      assert.ok(before > 0);
      await click('[data-control="freeze"]', "play");
      const frozen = (await state()).game.progress[0].distance;
      await page.waitForTimeout(700);
      assert.equal((await state()).game.progress[0].distance, frozen);
      await shot("spotlight-frozen", 390);
    }
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS: V7 empty/filled pockets, 320px inventory containment, roll order, harbor choice, trophy pedestal, paid ferry, archery, cannon reload, bomb flight/pop, lantern shuffles/fall, continuous Run and Freeze, uniform ripple colors; desktop and mobile.",
  );
} finally {
  await browser.close();
  await server.close();
}
