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
    if (id === "putt") s.game.putt.holes = [0, 1, 2];
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
      path.join(out, `v12-${name}-${width}.png`),
      Buffer.from(png, "base64"),
    );
  }
  const climb = fixture("climb");
  const first = await frame(climb, 21000);
  assert.equal(first.ledgeArrows.length, 4);
  // Newly received prompts must be visible on the very next rendered frame.
  climb.game.progress[0].step = 1;
  const next = await frame(climb, 21016);
  assert.equal(next.ledgeArrows.length, 4);
  assert.ok(next.ledgeArrows.every((a) => a.position[1] > 2));
  await shot("meadow", climb, 21032);
  climb.game.progress[0].step = 24;
  climb.game.progress[0].finished = 22000;
  for (let n = 0; n < 60; n++) await frame(climb, 22000 + n * 30);
  const summit = await frame(climb, 23800);
  assert.ok(summit.actors[0].position[1] > 30.99);
  assert.ok(summit.actors[0].position[2] < 3.41);
  await shot("summit", climb, 23816, 390);
  const fish = fixture("fish");
  fish.game.progress.forEach((v, i) => {
    v.catch = {
      at: 22000,
      length: 30 + i * 30,
      score: 30 + i * 30,
      species: i,
    };
  });
  let before = await frame(fish, 25000);
  fish.phase = "measuring";
  fish.game.measureAt = 25000;
  const measuring = await frame(fish, 25016);
  fish.phase = "round-end";
  const result = await frame(fish, 25032);
  for (const d of [measuring, result])
    assert.deepEqual(d.cameraPosition, before.cameraPosition);
  for (let i = 1; i < 4; i++)
    assert.ok(
      Math.abs(measuring.fishSizes[i] / measuring.fishSizes[0] - (i + 1)) <
        0.0001,
    );
  await shot("fish-measure", fish, 27000, 390);
  for (let from = 0; from < 4; from++)
    for (let to = 0; to < 4; to++) {
      if (from === to) continue;
      const s = fixture("lantern"),
        v = s.game.progress[0];
      Object.assign(v, { fromLane: from, chosen: to, moveAt: 22000 });
      const start = await frame(s, 22000),
        apex = await frame(s, 22210),
        end = await frame(s, 22420);
      assert.ok(apex.actors[0].position[1] > 1.8);
      assert.ok(
        Math.abs(
          end.actors[0].position[0] - (R.lanternPositions[to][0] - 0.7),
        ) < 0.001,
      );
      assert.ok(
        Math.abs(
          end.actors[0].position[2] - (R.lanternPositions[to][1] - 0.5),
        ) < 0.001,
      );
      assert.ok(apex.actors[0].arms[0][0] < -1);
      if (from === 0 && to === 3) await shot("lantern-diagonal", s, 22210, 390);
    }
  const hop = fixture("hop"),
    contact = hop.game.start + hop.game.beats[0].at;
  await frame(hop, contact - 16);
  const hit = await frame(hop, contact + 16);
  assert.ok(
    hit.dizzy[0],
    "collision pose starts immediately before a server poll",
  );
  Object.assign(hop.game.progress[0], {
    hitAt: contact,
    stunUntil: contact + 2500,
    resolved: 0,
  });
  assert.ok((await frame(hop, contact + 2000)).dizzy[0]);
  await shot("dizzy", hop, contact + 2100, 390);
  assert.equal((await frame(hop, contact + 2501)).dizzy[0], false);
  for (let course = 0; course < C.holes.length; course++) {
    const s = fixture("putt");
    s.game.putt.holes = [course, (course + 1) % 9, (course + 2) % 9];
    s.game.progress[0].ball = [...C.holes[course].tee];
    assert.equal((await frame(s, 21000)).golfCourse, course);
    await shot("golf-" + course, s, 21016);
    await shot("golf-" + course, s, 21032, 390);
    const [tx, ty] = C.holes[course].tee;
    s.game.progress[0].shot = {
      at: 21100,
      course: 0,
      duration: 500,
      position: [tx + 25, ty - 50],
      holed: false,
      penalty: 0,
      events: [],
      frames: [
        [0, tx, ty, 1, 0],
        [500, tx + 25, ty - 50, 1, 0],
      ],
    };
    await frame(s, 21100);
    const flying = await frame(s, 21350);
    assert.ok(
      Math.abs(flying.golfBall.position[0] - (tx + 12.5 - 360) / 25) < 0.01,
      "course " + course + " must animate the selected layout's shot",
    );
    assert.ok(flying.golfBusy);
    s.game.progress[0].shot.holed = true;
    s.game.putt.holeEvent = { course: 0, player: 0, at: 21600 };
    assert.equal(
      (await frame(s, 21700)).holeCelebration,
      true,
      "selected course keeps its cup celebration",
    );
  }
  const memory = fixture("memory");
  await shot("afterglow", memory, 21500, 390);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: next-frame ledges, summit finish, stable fish cameras/sizing, all 12 platform jumps, immediate hit and 2.5s stun, nine golf courses desktop/mobile.",
  );
} finally {
  await browser.close();
  await server.close();
}
