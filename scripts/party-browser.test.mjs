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
async function roomState(code) {
  return (
    await server.pg.query("SELECT state FROM party_rooms WHERE id=$1", [code])
  ).rows[0].state;
}
async function expire(code, pages) {
  const s = await roomState(code);
  s.deadline = Date.now() - 1;
  if (s.phase === "playing") s.game.end = Date.now() - 1;
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
    assert.ok(
      await buttons.count(),
      "expired round still has its controls while reconnecting",
    );
    assert.equal(
      await buttons.evaluateAll((bs) => bs.every((b) => b.disabled)),
      true,
    );
    await buttons.first().evaluate((b) => b.click());
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
  if (G.handled(game)) {
    s.game.beats = [
      {
        ...s.game.beats[0],
        index: 0,
        at: Date.now() - s.game.start - 300,
        window: 240000,
      },
    ];
  }
  await server.pg.query("UPDATE party_rooms SET state=$2::jsonb WHERE id=$1", [
    code,
    JSON.stringify(s),
  ]);
  await wake(pages);
  for (const p of pages) await wait(p, "body[data-phase=playing]");
  for (let i = 0; i < pages.length; i++) {
    if (!s.game.participants.includes(s.players[i].id)) continue;
    const p = pages[i];
    if (game === "climb") {
      await wait(p, "#next-arrows");
      for (let n = 0; n < (i === 0 ? 5 : 2); n++) {
        const arrow = (await p.locator("#next-arrows").innerText()).trim()[0],
          dir = { "↑": "up", "↓": "down", "←": "left", "→": "right" }[arrow];
        await action(p, "[data-direction=" + dir + "]", "play");
        await p.waitForTimeout(150);
      }
    }
    if (game === "putt") {
      await wait(p, "#aim");
      await p.locator("#aim").fill("-62");
      await p.locator("#power").fill("57");
      await action(p, "[data-putt]", "play");
    }
    if (G.handled(game)) {
      const state = await roomState(code),
        cue = state.game.beats[0];
      if (["cascade", "dash"].includes(game)) {
        await action(p, '[data-control="left"]', "play");
        await p.waitForTimeout(180);
        await action(p, '[data-control="right"]', "play");
      } else {
        const value =
          game === "fish"
            ? "reel"
            : game === "hop"
              ? "jump"
              : game === "treasure"
                ? cue.values.indexOf(Math.max(...cue.values))
                : cue.color;
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
      return;
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
    if (s.phase === "board") {
      const p = pages[s.turn];
      await wake(pages);
      await wait(p, "[data-action=roll]");
      if (s.round === 1 && s.turn === 0) {
        await fit(pages[0], "board-desktop");
        await fit(pages[1], "board-mobile");
        await p.locator("[data-map]").click();
        await fit(p, "board-overview");
        await p.locator("[data-map]").click();
        await action(p, "[data-item=boost]", "item");
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
        await p.locator("#duel-rival").selectOption(opponent.id);
        await action(p, "[data-challenge]", "challenge");
      } else {
        await wait(p, "[data-action=continue]");
        if (s.event.kind === "shop" && !sawShop) {
          await fit(p, "item-cart");
          if (await p.locator("[data-buy-item]:enabled").count())
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
  await wait(pages[0], "body[data-phase=board]");
  // Isolated missing-game fixtures keep the real handler, ready flow, inputs,
  // and rendering. Only the minigame selection is controlled for coverage.
  for (const def of C.games.filter((g) => !seen.has(g.id))) {
    let state = await roomState(code);
    state.phase = "board-end";
    state.deadline = Date.now() - 1;
    state.round = 1;
    state.usedGames = C.games.filter((g) => g.id !== def.id).map((g) => g.id);
    state.revision++;
    await server.pg.query(
      "UPDATE party_rooms SET state=$2::jsonb WHERE id=$1",
      [code, JSON.stringify(state)],
    );
    await wake(pages);
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
    "PASS: ten-turn four-player festival, on-scene dice and controls, crossroads, passing shops, stakes, all ten minigames, readiness, live duel, reconnect, rewards, rematch, slow requests and desktop/mobile/landscape layouts. " +
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
