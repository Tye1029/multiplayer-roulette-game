import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { startPartyServer } from "./party-test-server.mjs";
const require = createRequire(import.meta.url),
  { chromium } = require(process.env.RPS_PLAYWRIGHT_MODULE || "playwright"),
  M = require("../netlify/functions/party/model"),
  C = require("../assets/party/catalog"),
  R = require("../assets/party/rules"),
  server = await startPartyServer(),
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.RPS_BROWSER,
    args: ["--enable-unsafe-swiftshader"],
  }),
  out = path.join(os.tmpdir(), "boardwalk-party-qa"),
  errors = [];
await fs.mkdir(out, { recursive: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  page.on("pageerror", (e) => errors.push(e.stack));
  await page.goto(server.origin + "/party.html");
  await page.waitForFunction(() => globalThis.PartyScene);
  await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.id = "party-scene";
    Object.assign(canvas.style, {
      position: "fixed",
      inset: "0",
      width: "100vw",
      height: "100vh",
      zIndex: "9999",
    });
    document.body.append(canvas);
  });
  let serial = 0;
  function fixture(id) {
    const s = M.create(
      "ABC234",
      { id: "owner", name: "Tester", character: "ghost" },
      "party",
      1000,
    );
    M.testStart(s, id, 1000);
    s.id = "qa-" + serial++;
    s.phase = "playing";
    s.players.forEach((p) => (p.bot = false));
    s.game.start = 20000;
    s.game.end = 20000 + s.game.duration;
    s.game.progress.forEach((v) => (v.showAt = 20000));
    return s;
  }
  async function frame(s, at, extra = {}) {
    return page.evaluate(
      ({ s, at, extra }) => {
        PartyScene.render(
          document.querySelector("#party-scene"),
          s.game.id,
          s,
          at / 1000,
          extra,
        );
        return PartyScene.diagnostics();
      },
      { s: M.view(s, s.players[0].id, at), at, extra },
    );
  }
  async function shot(name, s, at, width = 1440, extra = {}) {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    const png = await page.evaluate(
      ({ s, at, extra }) => {
        const canvas = document.querySelector("#party-scene");
        PartyScene.render(canvas, s.game.id, s, at / 1000, extra);
        return canvas.toDataURL("image/png").split(",")[1];
      },
      { s: M.view(s, s.players[0].id, at), at, extra },
    );
    await fs.writeFile(
      path.join(out, `v11-${name}-${width}.png`),
      Buffer.from(png, "base64"),
    );
  }
  const climb = fixture("climb");
  await shot("mountain", climb, 21000);
  await shot("mountain", climb, 21000, 390);
  climb.game.progress.forEach((v) => (v.step = 24));
  for (let i = 0; i < 24; i++) {
    await frame(climb, 22000 + i * 50);
    await page.waitForTimeout(16);
  }
  await shot("summit", climb, 23400);

  const fish = fixture("fish"),
    cue = fish.game.fishBeats[0][0],
    start = fish.game.start;
  fish.phase = "countdown";
  const before = await frame(fish, start - 10);
  assert.ok(before.ripples.flat().every((r) => !r.visible));
  fish.phase = "playing";
  const after = await frame(fish, start + 10);
  assert.ok(
    Math.hypot(
      ...after.cameraPosition.map((n, i) => n - before.cameraPosition[i]),
    ) < 0.01,
    "no camera snap at GO",
  );
  const first = await frame(fish, start + cue.at - 1490),
    middle = await frame(fish, start + cue.at - 1280),
    full = await frame(fish, start + cue.at - 900);
  assert.ok(first.ripples[0][0].opacity < middle.ripples[0][0].opacity);
  assert.ok(middle.ripples[0][0].opacity < full.ripples[0][0].opacity);
  assert.deepEqual(
    first.ripples[0].map((r) => r.size),
    full.ripples[0].map((r) => r.size),
    "fish size doesn't change during entrance",
  );
  await shot("ripple-fade", fish, start + cue.at - 1280);

  const lantern = fixture("lantern"),
    g = lantern.game,
    fallAt = 22500;
  g.beats.forEach((b) => (b.at += 15000));
  Object.assign(g.progress[0], {
    eliminatedAt: fallAt,
    finished: fallAt,
    fallTile: 0,
  });
  g.lanternLast = { at: fallAt, index: 0, layout: [0, 1, 2, 3], safeTile: 3 };
  const late = await frame(lantern, fallAt + 900);
  assert.ok(
    late.actors[0].position[1] > 0.3,
    "late packet still shows the start of the fall",
  );
  const falling = await frame(lantern, fallAt + 1200);
  assert.ok(falling.actors[0].position[1] < late.actors[0].position[1]);
  await shot("fall", lantern, fallAt + 1200);
  const swimming = await frame(lantern, fallAt + 3000);
  assert.ok(
    Math.abs(swimming.actors[0].position[0]) > 9,
    "swimmer clears the platform frame",
  );
  await shot("swim", lantern, fallAt + 3000);
  const host = fixture("lantern"),
    hostAt = host.game.start + 1500,
    held = await frame(host, hostAt);
  assert.equal(held.cardVisible, true);
  assert.ok(
    Math.abs(held.cardPosition[0] - held.marshalPosition[0]) > 1,
    "card is outside the body",
  );
  await shot("card", host, hostAt, 390);

  const hop = fixture("hop"),
    b = hop.game.beats[0];
  b.size = "large";
  b.speed = 0.009;
  const contact = hop.game.start + b.at;
  Object.assign(hop.game.progress[0], {
    jumpAt: contact - 520,
    jumpDuration: 1040,
    hopAttempt: { index: 0, size: "large" },
  });
  const leap = await frame(hop, contact);
  assert.ok(
    leap.actors[0].position[1] > 0.42 + 2 * R.hopRadius("large"),
    "feet clear the actual log",
  );
  assert.ok(leap.rollers.some((r) => Math.abs(r.position[2] - 3.5) < 0.01));
  await shot("jump", hop, contact);
  const roll = await frame(hop, contact + 1000);
  assert.ok(
    roll.rollers.some((r) => r.position[2] > 12),
    "log continues after crossing the players",
  );
  await shot("logs-leaving", hop, contact + 1000, 390);
  const approach = await frame(hop, contact - 2500);
  assert.ok(
    approach.rollers.some((r) => r.position[1] < 0.32 + R.hopRadius("large")),
    "log rises out of water",
  );

  const putt = fixture("putt"),
    pv = putt.game.progress[0],
    cup = C.holes[0].cup;
  assert.equal(
    (await frame(putt, 21000)).arrowVisible,
    false,
    "no default half-filled arrow",
  );
  const angle = 0.7;
  const aimed = await frame(putt, 21010, {
    aim: { angle, power: 0.8, dragging: true },
  });
  assert.equal(aimed.arrowAngle, angle);
  assert.equal(aimed.arrowOverlays, true);
  await shot("aim", putt, 21010, 1440, {
    aim: { angle, power: 0.8, dragging: true },
  });
  pv.shot = {
    at: 21100,
    course: 0,
    duration: 1000,
    holed: true,
    position: cup,
    frames: [
      [0, cup[0] - 60, cup[1], 1, 0],
      [1000, ...cup, 0, 0],
    ],
  };
  pv.ball = [cup[0] - 60, cup[1]];
  const moving = await frame(putt, 21200);
  const ending = await frame(putt, 22220);
  assert.ok(ending.golfBall.position[0] > moving.golfBall.position[0]);
  assert.ok(ending.holeCelebration);
  const sunk = await frame(putt, 22700);
  assert.equal(sunk.golfBall.scale, 0);
  assert.deepEqual(
    sunk.golfBall.position.filter((_, i) => i !== 1),
    [(cup[0] - 360) / 25, (cup[1] - 360) / 25],
  );
  await shot("cup", putt, 22480);
  const next = structuredClone(putt);
  next.game.putt.turn = 1;
  assert.equal(
    (await frame(next, 22800)).golfBall.shotAt,
    ending.golfBall.shotAt,
    "hold the old cup celebration",
  );
  for (let course = 0; course < 3; course++) {
    const courseState = fixture("putt");
    courseState.game.putt.course = course;
    courseState.game.progress[0].ball = [...C.holes[course].tee];
    await shot("course-" + course, courseState, 21000);
    await shot("course-" + course, courseState, 21000, 390);
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS: smooth GO camera, ripple fade, delayed fall/swim, card clearance, physical log jump/travel, golf overlay/terminal shot/cup hold, mountain and all courses desktop/mobile.",
  );
} finally {
  await browser.close();
  await server.close();
}
