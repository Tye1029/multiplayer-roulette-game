import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";
import { startPartyServer } from "./party-test-server.mjs";
const require = createRequire(import.meta.url),
  { chromium } = require(process.env.RPS_PLAYWRIGHT_MODULE || "playwright"),
  C = require("../assets/party/catalog"),
  M = require("../netlify/functions/party/model"),
  G = require("../netlify/functions/party/minigames");
const server = await startPartyServer(),
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.RPS_BROWSER || undefined,
    args: ["--enable-unsafe-swiftshader"],
  }),
  out = path.join(os.tmpdir(), "boardwalk-party-qa"),
  errors = [];
await fs.mkdir(out, { recursive: true });
async function page(width) {
  const ctx = await browser.newContext({
    viewport: { width, height: width < 600 ? 844 : 1000 },
    hasTouch: width < 600,
  });
  await ctx.addInitScript(() => {
    localStorage.setItem("boardwalk-sound", "off");
    localStorage.setItem("boardwalk-motion", "off");
    // Four software-rendered views share a CI CPU. Keep real UI rendering at
    // 10 Hz here; the deployed real-clock smoke uses the normal animation loop.
    const frame = requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) =>
      setTimeout(() => frame(callback), 100);
  });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(e.stack));
  await p.goto(server.origin + "/party.html");
  await p.locator("[data-create=party]").first().waitFor();
  return p;
}
async function fit(p, name) {
  await p.screenshot({
    path: path.join(out, "v4-" + name + ".png"),
    fullPage: true,
  });
  assert.equal(
    await p.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
    false,
    name + " horizontal overflow",
  );
  assert.deepEqual(
    await p.locator("button:visible,input:visible").evaluateAll((es) =>
      es
        .filter((e) => {
          const r = e.getBoundingClientRect();
          return r.left < -1 || r.right > innerWidth + 1;
        })
        .map((e) => e.textContent),
    ),
    [],
    name + " clipped controls",
  );
}
const wait = (p, selector) =>
  p.locator(selector).first().waitFor({ timeout: 20000 });
async function signup(p, name, mode = "party") {
  await p
    .locator("[data-create=" + mode + "]")
    .first()
    .click();
  await p.locator("#nickname").fill(name);
  await p.getByRole("button", { name: "Let’s play", exact: false }).click();
  if (mode === "party") await p.locator('[data-turns="10"]').click();
  await wait(p, "#share-code");
  assert.equal(await p.locator("[data-action=ready]").isDisabled(), true);
  await action(p, "[data-pick-character=ghost]", "pick-character");
  return new URL(p.url()).searchParams.get("room");
}
async function join(p, code, name, char) {
  await p.goto(server.origin + "/party.html?room=" + code);
  await wait(p, "#join-form");
  await p.getByRole("button", { name: "Join the party", exact: true }).click();
  await p.locator("#nickname").fill(name);
  await p.locator("[data-character-choice=" + char + "]").click();
  await p.getByRole("button", { name: "Let’s play", exact: false }).click();
  await wait(p, "#share-code");
  assert.equal(
    await p.locator("[data-pick-character=ghost]").isDisabled(),
    true,
  );
  await action(p, "[data-pick-character=" + char + "]", "pick-character");
}
async function wake(pages) {
  await Promise.all(
    pages.map((p) => p.evaluate(() => dispatchEvent(new Event("online")))),
  );
  await pages[0].waitForTimeout(180);
}
async function renderedRound(pages, start) {
  // A DB fixture update is not a browser acknowledgement. Probe the real
  // rendered state so inputs cannot race an earlier in-flight snapshot.
  for (const p of pages)
    await p.evaluate(() => {
      if (window.__roundRenderProbe) return;
      window.__roundRenderProbe = true;
      const render = PartyScene.render;
      PartyScene.render = function (...args) {
        window.__renderedPartyRound = {
          start: args[2]?.game?.start,
          phase: args[2]?.phase,
          revision: args[2]?.revision,
        };
        return render.apply(this, args);
      };
    });
  await wake(pages);
  await Promise.all(
    pages.map((p) =>
      p.waitForFunction(
        (start) =>
          window.__renderedPartyRound?.start === start &&
          window.__renderedPartyRound?.phase === "playing",
        start,
      ),
    ),
  );
}
async function roomState(code) {
  return (
    await server.pg.query("SELECT state FROM party_rooms WHERE id=$1", [code])
  ).rows[0].state;
}
async function expire(code, pages) {
  const s = await roomState(code);
  s.deadline = Date.now() - 1;
  if (s.phase === "playing") s.game.end = Date.now() - 1;
  if (s.phase === "finale") s.finale.at = Date.now() - 31000;
  if (s.phase === "countdown") {
    s.game.start = Date.now() - 1;
    s.game.end = s.game.start + s.game.duration;
  }
  await server.pg.query("UPDATE party_rooms SET state=$2::jsonb WHERE id=$1", [
    code,
    JSON.stringify(s),
  ]);
  await wake(pages);
}
async function action(p, selector, action) {
  const [r] = await Promise.all([
    p.waitForResponse(
      (r) =>
        r.url().includes("/party-action") &&
        r.request().postDataJSON()?.action === action,
      { timeout: 20000 },
    ),
    p.locator(selector).click(),
  ]);
  const body = await r.json();
  assert.equal(r.status(), 200, action + " HTTP: " + (body.error || ""));
  return body.game;
}
async function checkExpiredControls(pages, code) {
  const p = pages[0],
    s = await roomState(code);
  s.deadline = s.game.end = Date.now() + 10000;
  s.revision++;
  await server.pg.query("UPDATE party_rooms SET state=$2::jsonb WHERE id=$1", [
    code,
    JSON.stringify(s),
  ]);
  const refreshed = p.waitForResponse(
    async (r) =>
      r.url().includes("/party-action") &&
      r.request().postDataJSON()?.action === "get" &&
      (await r.json()).game?.deadline === s.deadline,
  );
  await wake(pages);
  await (await refreshed).finished();
  await p.waitForFunction(
    () => parseInt(document.querySelector("#timer").textContent) <= 10,
  );
  let release,
    plays = 0;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  const count = (r) => {
    if (
      r.url().includes("/party-action") &&
      r.postDataJSON()?.action === "play"
    )
      plays++;
  };
  p.on("request", count);
  await p.route("**/.netlify/functions/party-action", async (route) => {
    if (route.request().postDataJSON()?.action === "get") await held;
    await route.continue();
  });
  try {
    await p.waitForFunction(
      () => document.querySelector("#timer").textContent === "0s",
      { timeout: 20000 },
    );
    assert.equal(await p.locator("#timer").innerText(), "0s");
    const buttons = p.locator(".controls button");
    if (await buttons.count()) {
      assert.equal(
        await buttons.evaluateAll((bs) => bs.every((b) => b.disabled)),
        true,
      );
      await buttons.first().evaluate((b) => b.click());
    } else {
      assert.ok(
        ["bumper", "volcano", "putt"].includes(s.game.id),
        "pointer games have drag controls",
      );
      const box = await p.locator("#party-scene").boundingBox();
      await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await p.mouse.down();
      await p.mouse.move(
        box.x + box.width / 2 + 45,
        box.y + box.height / 2 + 35,
      );
      await p.waitForTimeout(250);
      await p.mouse.up();
    }
    await p.keyboard.press("ArrowUp");
    await p.keyboard.press("1");
    await p.keyboard.press("Space");
    assert.equal(plays, 0, "expired controls do not submit late inputs");
  } finally {
    release();
    p.off("request", count);
    await p.unrouteAll({ behavior: "wait" });
  }
  await wake(pages);
  await wait(p, "body:not([data-phase=playing])");
}
async function readyGame(pages, code) {
  const s = await roomState(code);
  await wake(pages);
  for (const [i, p] of pages.entries())
    if (s.game.participants.includes(s.players[i].id)) {
      await wait(p, "[data-action=game-ready]");
      if (!s.game.ready.includes(s.players[i].id))
        await action(p, "[data-action=game-ready]", "game-ready");
    }
  assert.equal((await roomState(code)).phase, "countdown");
}
async function playRound(pages, code, seen) {
  let s = await roomState(code);
  const game = s.game.id;
  console.log("Checking minigame:", game);
  // Four software-rendered browsers and screenshots can exceed the real round
  // timer on CI. Give this isolated UI fixture time to exercise every player;
  // expire() still takes the normal authoritative end-of-round path afterward.
  s.deadline = s.game.end = Date.now() + 240000;
  // This fixture covers every client's controls under a software GPU. Real
  // telegraphs, hazard timing and elimination are exercised by V8's tests.
  if (game === "volcano") s.game.rocks.forEach((r) => (r.at += 240000));
  if (
    G.handled(game) &&
    Array.isArray(s.game.beats) &&
    C.games.find((d) => d.id === game).engine !== "expansion" &&
    game !== "putt"
  ) {
    s.game.beats = [
      {
        ...s.game.beats[0],
        index: 0,
        at: Date.now() - s.game.start - 300,
        window: 240000,
      },
    ];
    if (game === "fish")
      s.game.fishBeats = s.players.map(() => [{ ...s.game.beats[0] }]);
  }
  await server.pg.query("UPDATE party_rooms SET state=$2::jsonb WHERE id=$1", [
    code,
    JSON.stringify(s),
  ]);
  await wake(pages);
  for (const p of pages) await wait(p, "body[data-phase=playing]");
  // Inspect live controls before inputs can legitimately finish a one-catch or
  // survival game. Software-rendered screenshots can outlast the result delay.
  if (!seen.has(game)) {
    seen.add(game);
    await fit(pages[0], game + "-desktop");
    await fit(pages[1], game + "-mobile");
    await pages[1].evaluate(() => scrollTo(0, 0));
    const rect = await pages[1].locator(".controls").boundingBox();
    assert.ok(rect.y + rect.height <= 844, game + " controls fit with scene");
    if (pages[2]) {
      await pages[2].setViewportSize({ width: 844, height: 390 });
      await fit(pages[2], game + "-landscape");
      await pages[2].setViewportSize({ width: 320, height: 844 });
    }
    if (seen.size === 1) {
      const before = await pages[1].context().cookies();
      await pages[1].reload();
      await wait(pages[1], "#share-code");
      const after = await pages[1].context().cookies();
      assert.equal(
        before.find((c) => c.name === "boardwalk_session").value,
        after.find((c) => c.name === "boardwalk_session").value,
      );
      await checkExpiredControls(pages, code);
      // The expiry assertion ends its isolated fixture. Restore the untouched
      // playing snapshot so every participant still exercises their controls.
      s.revision = (await roomState(code)).revision + 1;
      s.deadline = s.game.end = Date.now() + 240000;
      await server.pg.query(
        "UPDATE party_rooms SET state=$2::jsonb WHERE id=$1",
        [code, JSON.stringify(s)],
      );
      await wake(pages);
      for (const p of pages) await wait(p, "body[data-phase=playing]");
    }
  }
  if (game === "bomb") {
    // Software-GPU screenshots can span multiple normal fuses. Give the input
    // coverage fixture a long fuse, then pass right through every participant.
    // V7's separate real-time browser/model tests cover flight and expiry.
    s = await roomState(code);
    s.game.shared.holder = s.game.active[0];
    Object.assign(s.game.shared, {
      from: s.game.shared.holder,
      flight: null,
      passedAt: 0,
      popped: null,
      poppedAt: 0,
      respawnAt: 0,
      fuseStarted: Date.now(),
      fuseEnd: Date.now() + 240000,
    });
    s.game.progress.forEach((v) => {
      v.health = 3;
      v.eliminatedAt = 0;
      v.finished = 0;
    });
    s.revision++;
    await server.pg.query(
      "UPDATE party_rooms SET state=$2::jsonb WHERE id=$1",
      [code, JSON.stringify(s)],
    );
    await wake(pages);
  }
  for (let i = 0; i < pages.length; i++) {
    if (!s.game.participants.includes(s.players[i].id)) continue;
    const p = pages[i];
    const expansion = ["expansion","midway"].includes(C.games.find((d) => d.id === game).engine);
    if (expansion || game === "putt") {
      // Each player's isolated input gets a fresh clock after the screenshots.
      // V8 tests separately exercise real timers, movement, collisions and scoring.
      const fresh = await roomState(code),
        previousInputs = fresh.game.progress.map((v) => v.inputs);
      fresh.game.start = Date.now() - 1000;
      fresh.game.progress = previousInputs.map((inputs) => ({
        inputs,
        last: 0,
        finished: null,
        shot: null,
        step: 0,
        combo: 0,
        bonus: 0,
        attempts: 0,
        reverse: false,
        pattern: [0, 1, 2],
        cursor: 0,
        level: 3,
        showAt: fresh.game.start,
        feedback: "",
      }));
      G.setup(fresh.game);
      if (game === "volcano") fresh.game.rocks.forEach((r) => (r.at += 240000));
      fresh.phase = "playing";
      fresh.deadline = fresh.game.end = Date.now() + 240000;
      fresh.revision++;
      if (game === "putt")
        Object.assign(fresh.game.putt, { slot: i, turn: i, offset: 0 });
      await server.pg.query(
        "UPDATE party_rooms SET state=$2::jsonb WHERE id=$1",
        [code, JSON.stringify(fresh)],
      );
      await renderedRound(pages, fresh.game.start);
      if (["bumper", "volcano", "putt"].includes(game)) {
        const box = await p.locator("#party-scene").boundingBox(),
          x = box.x + box.width * 0.5,
          y = box.y + box.height * 0.45;
        const reply = p.waitForResponse(
          (r) =>
            r.url().includes("party-action") &&
            r.request().postDataJSON()?.action === "play",
        );
        await p.mouse.move(x, y);
        await p.mouse.down();
        await p.mouse.move(x + 45, y + 35, { steps: 6 });
        await p.waitForTimeout(200);
        await p.mouse.up();
        const result = await reply;
        assert.equal(result.status(), 200, await result.text());
      } else {
        let value = 0;
        if (game === "safe-panel") {
          const type = fresh.game.secrets[i].heist.screws[0].type;
          await p.locator(`[data-tool="${type}"]`).click();
          await p.waitForTimeout(160);
          value = `screw:0:${type}`;
        }
        if (game === "safe-wires") value = "card:open";
        if (game === "safe-dial") value = 8;
        if (game === "puzzle") {
          const blank = fresh.game.progress[i].tiles.indexOf(0);
          value = fresh.game.progress[i].tiles.findIndex((_, j) =>
            require("../assets/party/expansion-rules").adjacent(blank, j),
          );
        }
        if (game === "pizza") value = "shape:0";
        if (game === "mine") value = "down";
        if (game === "robots") value = "punch";
        if (game === "basket") value = "shoot";
        if (game === "baseball") value = "swing";
        await action(p, `[data-control="${value}"]:enabled`, "play");
      }
      assert.ok(
        (await roomState(code)).game.progress[i].inputs > previousInputs[i],
        game + " real player input",
      );
      continue;
    }
    if (game === "climb") {
      await wait(p, "#next-arrows");
      for (let n = 0; n < (i === 0 ? 5 : 2); n++) {
        const arrow = (await p.locator("#next-arrows").innerText()).trim()[0],
          dir = { "↑": "up", "↓": "down", "←": "left", "→": "right" }[arrow];
        await action(p, "[data-direction=" + dir + "]", "play");
        await p.waitForTimeout(150);
      }
    }
    if (G.festival.handled(game)) {
      const state = await roomState(code),
        v = state.game.progress[i];
      if (game === "bomb")
        assert.equal(
          state.game.shared.holder,
          i,
          "Each holder passes to the following player",
        );
      const def = C.games.find((g) => g.id === game),
        value =
          game === "bomb"
            ? "right"
            : game === "rope"
              ? state.game.beats[0].high
                ? "duck"
                : "jump"
              : def.controls[0][0];
      await action(p, '[data-control="' + value + '"]:enabled', "play");
    } else if (G.handled(game)) {
      const state = await roomState(code),
        cue = state.game.beats[0];
      if (["cascade", "dash"].includes(game)) {
        await action(p, '[data-control="left"]', "play");
        await p.waitForTimeout(180);
        await action(p, '[data-control="right"]', "play");
      } else {
        const value =
          game === "fish" ? "reel" : game === "hop" ? "jump" : cue.color;
        await action(p, '[data-control="' + value + '"]:enabled', "play");
      }
    }
    if (game === "memory") {
      await wait(p, "[data-pad]");
      s = await roomState(code);
      const count = i === 0 ? s.game.progress[i].pattern.length : 2;
      for (let n = 0; n < count; n++) {
        s = await roomState(code);
        const v = s.game.progress[i],
          value =
            v.pattern[v.reverse ? v.pattern.length - 1 - v.cursor : v.cursor];
        await action(p, '[data-pad="' + value + '"]:enabled', "play");
        await p.waitForTimeout(160);
      }
    }
  }
  await expire(code, pages);
}
try {
  for (const width of [320, 390, 768, 1440]) {
    const p = await page(width);
    await fit(p, "home-" + width);
    await p.getByRole("button", { name: "Settings", exact: true }).click();
    await fit(p, "settings-" + width);
    await p.context().close();
  }
  const pages = [
      await page(1440),
      await page(390),
      await page(320),
      await page(768),
    ],
    code = await signup(pages[0], "River");
  for (let i = 1; i < 4; i++)
    await join(
      pages[i],
      code,
      ["River", "Juniper", "Pip", "Sky"][i],
      C.characters[i + 4].id,
    );
  await pages[0].getByRole("heading", { name: "4/4 in the party" }).waitFor();
  await fit(pages[0], "lobby-desktop");
  await fit(pages[1], "lobby-mobile");
  for (const p of pages) await action(p, "[data-action=ready]", "ready");
  await action(pages[0], "[data-action=start]:enabled", "start");
  const seen = new Set();
  let guard = 0,
    sawRoll = false,
    sawChoice = false,
    sawShop = false,
    sawDuel = false;
  while (guard++ < 400) {
    let s = await roomState(code);
    if (s.phase === "complete") break;
    // Screenshots and four-player interactions must not race a short board
    // decision timer on a software GPU. Timeout behavior has separate checks.
    if (["board", "choice", "space", "intro"].includes(s.phase)) {
      s.deadline = Date.now() + 240000;
      await server.pg.query(
        "UPDATE party_rooms SET state=$2::jsonb WHERE id=$1",
        [code, JSON.stringify(s)],
      );
    }
    if (s.phase === "order-roll") {
      await wake(pages);
      for (const seat of s.orderPending)
        await action(
          pages[seat],
          '[data-action="order-roll"]:enabled',
          "order-roll",
        );
    } else if (s.phase === "board") {
      const p = pages[s.turn];
      await wake(pages);
      await wait(p, "[data-action=roll]");
      if (s.round === 1 && s.turn === 0) {
        await fit(pages[0], "board-desktop");
        await fit(pages[1], "board-mobile");
        await p.locator("[data-map]").click();
        await fit(p, "board-overview");
        await p.locator("[data-map]").click();
        assert.equal(s.players[0].items.length, 0, "No free starting items");
      }
      await action(p, "[data-action=roll]", "roll");
    } else if (s.phase === "rolling") {
      if (!sawRoll) {
        await wait(pages[0], "body[data-phase=rolling]");
        await fit(pages[0], "dice-desktop");
        sawRoll = true;
      }
      await expire(code, pages);
    } else if (s.phase === "choice") {
      const p = pages[s.turn];
      await wake(pages);
      await wait(p, "[data-next]");
      if (!sawChoice) {
        await fit(p, "crossroads");
        sawChoice = true;
      }
      const next = C.spaces[s.players[s.turn].position].next.at(-1);
      await action(p, '[data-next="' + next + '"]', "choose");
    } else if (s.phase === "space") {
      const p = pages[s.turn];
      await wake(pages);
      if (s.event.kind === "duel") {
        await wait(p, "[data-challenge]");
        if (!sawDuel) {
          await fit(p, "choose-rival");
          sawDuel = true;
        }
        const opponent = s.players.find((x) => x.id !== s.players[s.turn].id);
        await p
          .locator(`input[name="duel-rival"][value="${opponent.id}"]`)
          .check({ force: true });
        await action(p, "[data-challenge]", "challenge");
      } else {
        await wait(p, "[data-action=continue]");
        if (
          s.event.kind === "trophy-purchase" &&
          s.players[s.turn].tokens >= 20
        ) {
          await action(p, "[data-action=buy-trophy]", "buy-trophy");
          continue;
        }
        if (s.event.kind === "shop" && !sawShop) {
          await fit(p, "item-cart");
          if (
            s.players[s.turn].items.length < 3 &&
            (await p.locator("[data-buy-item]:enabled").count())
          )
            await action(p, "[data-buy-item]:enabled >> nth=0", "buy-item");
          sawShop = true;
        }
        await action(p, "[data-action=continue]", "continue");
      }
    } else if (s.phase === "intro") {
      await readyGame(pages, code);
    } else if (s.phase === "playing") await playRound(pages, code, seen);
    else if (
      [
        "walking",
        "board-end",
        "countdown",
        "round-end",
        "side-result",
        "measuring",
        "order-reveal",
        "selection",
        "trophy-flight",
        "finale",
      ].includes(s.phase)
    )
      await expire(code, pages);
    else throw Error("Unexpected phase " + s.phase);
  }
  const final = await roomState(code);
  assert.equal(final.phase, "complete");
  assert.ok(seen.size >= 5);
  assert.ok(sawRoll && sawChoice);
  await wake(pages);
  await wait(pages[0], "[data-action=rematch]");
  await fit(pages[0], "result-desktop");
  await fit(pages[1], "result-mobile");
  const profile = await pages[0].evaluate(async () => {
    const r = await fetch("/.netlify/functions/party-action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "profile" }),
    });
    return (await r.json()).profile;
  });
  assert.ok(profile.coins >= 12);
  assert.equal(profile.stats.played, 1);
  for (const p of pages) await action(p, "[data-action=rematch]", "rematch");
  await wait(pages[0], "[data-pick-character]");
  assert.equal((await roomState(code)).match, 2);
  for (let i = 0; i < 4; i++) {
    await action(
      pages[i],
      "[data-pick-character=" + C.characters[i].id + "]",
      "pick-character",
    );
    await action(pages[i], "[data-action=ready]", "ready");
  }
  await action(pages[0], "[data-action=start]:enabled", "start");
  for (let tries = 0; tries < 40; tries++) {
    const opening = await roomState(code);
    if (opening.phase === "board") break;
    if (opening.phase === "order-roll") {
      await wake(pages);
      for (const seat of opening.orderPending)
        await action(
          pages[seat],
          '[data-action="order-roll"]:enabled',
          "order-roll",
        );
    } else await expire(code, pages);
  }
  await wait(pages[0], "body[data-phase=board]");
  // Isolated missing-game fixtures keep the real handler, ready flow, inputs,
  // and rendering. Only the minigame selection is controlled for coverage.
  for (const def of C.games.filter((g) => !seen.has(g.id))) {
    let state = await roomState(code);
    state.phase = "board-end";
    state.deadline = Date.now() - 1;
    state.round = 1;
    state.usedGames = C.games.filter((g) => g.id !== def.id).map((g) => g.id);
    M.advance(state, Date.now());
    state.game.id = def.id;
    if (def.duelOnly) {
      state.game.sideDuel = true;
      state.game.participants = state.players.slice(0, 2).map((p) => p.id);
      state.game.active = [0, 1];
    }
    G.setup(state.game);
    state.revision++;
    await server.pg.query(
      "UPDATE party_rooms SET state=$2::jsonb WHERE id=$1",
      [code, JSON.stringify(state)],
    );
    await wake(pages);
    await expire(code, pages);
    await wait(pages[0], "body[data-phase=intro]");
    await readyGame(pages, code);
    await expire(code, pages);
    await playRound(pages, code, seen);
  }
  assert.equal(seen.size, C.games.length);
  for (const p of pages) await p.context().close();
  const duo = [await page(1280), await page(390)],
    duelCode = await signup(duo[0], "Duel QA", "duel");
  await join(duo[1], duelCode, "Rival QA", "fox");
  for (const p of duo) await action(p, "[data-action=ready]", "ready");
  await action(duo[0], "[data-action=start]:enabled", "start");
  const duelSeen = new Set();
  for (let n = 0; n < 35; n++) {
    const s = await roomState(duelCode);
    if (s.phase === "complete") break;
    if (s.phase === "intro") await readyGame(duo, duelCode);
    else if (s.phase === "playing") await playRound(duo, duelCode, duelSeen);
    else await expire(duelCode, duo);
  }
  assert.equal((await roomState(duelCode)).phase, "complete");
  await wake(duo);
  await wait(duo[1], "[data-action=rematch]");
  await fit(duo[1], "duel-result-mobile");
  for (const p of duo) await p.context().close();
  const delayed = await page(390);
  await signup(delayed, "Slow Network", "duel");
  await delayed.route("**/.netlify/functions/party-action", async (route) => {
    if (route.request().postDataJSON().action === "add-bot")
      await new Promise((resolve) => setTimeout(resolve, 1800));
    await route.continue();
  });
  await delayed.locator("[data-action=add-bot]").click();
  assert.equal(await delayed.locator("[data-action=ready]").isDisabled(), true);
  await delayed.locator("[data-action=ready]").click();
  await delayed
    .getByRole("button", { name: "Ready ✓ · undo", exact: true })
    .waitFor();
  await wait(delayed, "[data-action=start]:enabled");
  await action(delayed, "[data-action=start]:enabled", "start");
  await wait(delayed, "[data-action=game-ready]");
  await delayed.unrouteAll({ behavior: "wait" });
  // Delayed delivery must not pull the local countdown toward an old timestamp.
  let delayedDeadline = 0;
  await delayed.route("**/.netlify/functions/party-action", async (route) => {
    if (route.request().postDataJSON().action !== "get")
      return route.continue();
    const response = await route.fetch();
    delayedDeadline = (await response.json()).game.deadline;
    await new Promise((resolve) => setTimeout(resolve, 8000));
    await route.fulfill({ response });
  });
  const delivered = delayed.waitForResponse(
    (r) =>
      r.url().includes("/party-action") &&
      r.request().postDataJSON()?.action === "get",
  );
  await delayed.evaluate(() => dispatchEvent(new Event("online")));
  await (await delivered).finished();
  await delayed.waitForTimeout(150);
  const clock = Number(
    (await delayed.locator("#timer").innerText()).replace("s", ""),
  );
  const expected = Math.ceil((delayedDeadline - Date.now()) / 1000);
  assert.ok(
    Math.abs(clock - expected) <= 1,
    "slow responses preserve an accurate countdown",
  );
  await delayed.unrouteAll({ behavior: "wait" });
  await delayed.context().close();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: ten-turn four-player festival, on-scene dice and controls, crossroads, passing shops, stakes, all 43 minigames, readiness, live duel, reconnect, rewards, rematch, slow requests and desktop/mobile/landscape layouts. " +
      out,
  );
} finally {
  console.log("BROWSER ERRORS", errors);
  for (const [i, c] of browser.contexts().entries())
    for (const p of c.pages()) {
      await p
        .screenshot({
          path: path.join(out, "v3-debug-" + i + ".png"),
          fullPage: true,
        })
        .catch(() => {});
    }
  await browser.close();
  await server.close();
}
