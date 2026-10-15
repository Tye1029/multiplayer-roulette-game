"use strict";
const { randomInt: rnd } = require("node:crypto");
const ids = ["fish", "cascade", "lantern", "hop", "dash", "signal", "treasure"];
const handled = (id) => ids.includes(id);
function setup(g) {
  if (!handled(g.id)) return;
  const count =
    g.id === "cascade" ? 20 : g.id === "dash" ? 14 : g.id === "fish" ? 6 : 8;
  const interval = (g.duration - 2500) / count;
  g.beats = Array.from({ length: count }, (_, i) => ({
    index: i,
    at:
      2000 +
      (g.id === "hop"
        ? (g.duration - 4500) * (1 - Math.pow(1 - i / (count - 1), 1.35))
        : i * interval),
    window: g.id === "fish" ? 1100 : g.id === "hop" ? 900 : 1000,
    color: rnd(4),
    lane: rnd(3),
    kind: ["barrel", "hurdle", "bunting"][rnd(3)],
    values: Array.from({ length: 3 }, () => {
      const n = rnd(10);
      return n < 2 ? -1 : n < 5 ? 3 : 1;
    }),
    rarity: rnd(100),
    fake: rnd(2) === 0,
  }));
  if (g.id === "signal") for (const b of g.beats) b.at += rnd(650);
  for (const v of g.progress)
    Object.assign(v, {
      lane: 1,
      resolved: -1,
      misses: 0,
      collected: 0,
      chosen: null,
      choiceBeat: -1,
      moveAt: 0,
      fromLane: 1,
      hitAt: 0,
      jumpAt: 0,
      duckAt: 0,
    });
}
function cue(g, now) {
  return g.beats?.find((b) => now - g.start <= b.at + b.window) || null;
}
function award(g, i, value, now, label) {
  const v = g.progress[i];
  g.scores[i] += value;
  if (["cascade", "treasure"].includes(g.id)) v.collected += value;
  v.popup = {
    at: now,
    value,
    label: label || (value > 0 ? "+" + value : "Splash!"),
  };
  v.feedback = v.popup.label;
}
function miss(g, i, now, label) {
  const v = g.progress[i];
  v.misses++;
  v.hitAt = now;
  v.combo = 0;
  v.feedback = label;
  v.popup = { at: now, value: 0, label };
  if (["hop", "dash", "lantern"].includes(g.id) && v.misses >= 3)
    v.finished = now;
}
function advance(g, i, now) {
  if (!handled(g.id)) return;
  const v = g.progress[i];
  if (v.finished) return;
  for (const b of g.beats) {
    const due = g.start + b.at + b.window;
    if (now < due || b.index <= v.resolved) continue;
    const active = v.inputs > 0 && due - v.last < 6500;
    if (g.id === "cascade") {
      if (active) {
        const n = b.values[v.lane];
        if (n > 0 && due >= (v.stunnedUntil || 0))
          award(g, i, n, due, "+" + n + " coins");
        else if (n < 0) {
          v.stunnedUntil = due + 1100;
          miss(g, i, due, "Crate! Keep moving");
        }
      }
    } else if (g.id === "treasure") {
      if (v.choiceBeat === b.index && b.index > (v.skipBeat ?? -1)) {
        const n = b.values[v.chosen];
        if (n > 0)
          award(g, i, n === 3 ? 4 : 2, due, n === 3 ? "+4 coins" : "+2 coins");
        else {
          v.skipBeat = b.index + 1;
          miss(g, i, due, "Crab trap! Miss one tide");
        }
      }
    } else if (g.id === "lantern") {
      if (v.choiceBeat === b.index && v.chosen === b.color) {
        v.combo++;
        award(
          g,
          i,
          150 + v.combo * 25,
          due,
          "Safe landing! +" + (150 + v.combo * 25),
        );
      } else miss(g, i, due, "Wrong platform!");
    } else if (g.id === "dash") {
      const action = b.kind === "hurdle" ? v.jumpAt : v.duckAt;
      const safe =
        active &&
        (v.lane !== b.lane ||
          (b.kind !== "barrel" &&
            Math.abs(action - (g.start + b.at)) <= b.window));
      if (safe) {
        v.combo++;
        award(
          g,
          i,
          100 + Math.min(5, v.combo) * 20,
          due,
          "Clean run! +" + (100 + Math.min(5, v.combo) * 20),
        );
      } else miss(g, i, due, "Bumped! Try another lane");
    } else if (v.actedBeat !== b.index)
      miss(g, i, due, g.id === "fish" ? "It swam away" : "Missed the timing");
    v.resolved = b.index;
    if (v.finished) break;
  }
  if (v.resolved === g.beats.length - 1) v.finished ||= now;
}
function play(g, i, b, now, fail) {
  const v = g.progress[i],
    beat = cue(g, now);
  if (!beat || v.finished) fail("Your round is finished.");
  if (["cascade", "dash"].includes(g.id)) {
    if (g.id === "cascade" && b.value === "stay") {
      /* Keep the basket in this lane. */
    } else if (["left", "right"].includes(b.value)) {
      v.fromLane = v.lane;
      v.lane = Math.max(0, Math.min(2, v.lane + (b.value === "left" ? -1 : 1)));
      v.moveAt = now;
    } else if (g.id === "dash" && ["jump", "duck"].includes(b.value)) {
      const key = b.value === "jump" ? "jumpAt" : "duckAt";
      if (now - v[key] < 900) fail("Land before moving again.");
      v[key] = now;
    } else fail("Choose a valid movement.", 400);
  } else if (["lantern", "treasure"].includes(g.id)) {
    if (
      !Number.isInteger(b.value) ||
      b.value < 0 ||
      b.value >= (g.id === "lantern" ? 4 : 3)
    )
      fail("Choose a platform.", 400);
    v.chosen = b.value;
    v.choiceBeat = beat.index;
    v.moveAt = now;
    v.feedback =
      g.id === "treasure"
        ? "Route chosen. Watch the tide!"
        : "Ready on your platform.";
  } else {
    if (v.actedBeat === beat.index) fail("Wait for the next signal.");
    if (
      g.id === "signal" &&
      (!Number.isInteger(b.value) || b.value < 0 || b.value > 3)
    )
      fail("Choose a signal color.", 400);
    if (g.id !== "signal" && b.value !== (g.id === "fish" ? "reel" : "jump"))
      fail("Choose the highlighted action.", 400);
    const dt = now - (g.start + beat.at);
    v.actedBeat = beat.index;
    v.attempts++;
    v.jumpAt = g.id === "hop" ? now : v.jumpAt;
    if (
      dt < -100 ||
      dt > beat.window ||
      (g.id === "signal" && b.value !== beat.color)
    ) {
      if (g.id === "signal") g.scores[i] = Math.max(0, g.scores[i] - 100);
      miss(g, i, now, dt < -100 ? "Too early!" : "Missed!");
    } else {
      v.combo++;
      let score = Math.round(180 + 220 * (1 - Math.max(0, dt) / beat.window));
      if (g.id === "fish") {
        score = beat.rarity < 65 ? 150 : beat.rarity < 90 ? 300 : 600;
        v.catch = {
          at: now,
          score,
          rarity:
            beat.rarity < 65
              ? "Sunny sprat"
              : beat.rarity < 90
                ? "Coral snapper"
                : "Festival koi",
        };
      }
      award(
        g,
        i,
        score,
        now,
        "+" + score + (g.id === "fish" ? " · " + v.catch.rarity : " Perfect!"),
      );
    }
  }
}
function bot(g, i, now) {
  const v = g.progress[i],
    b = cue(g, now);
  if (!b) return null;
  if (g.id === "cascade") {
    const best = b.values.indexOf(Math.max(...b.values));
    return { value: best < v.lane ? "left" : best > v.lane ? "right" : "stay" };
  }
  if (g.id === "dash") {
    if (b.lane !== v.lane) return { value: b.lane === 0 ? "right" : "left" };
    return {
      value:
        b.kind === "barrel"
          ? v.lane
            ? "left"
            : "right"
          : b.kind === "hurdle"
            ? "jump"
            : "duck",
    };
  }
  if (g.id === "lantern") return { value: rnd(10) ? b.color : rnd(4) };
  if (g.id === "treasure")
    return { value: b.values.indexOf(Math.max(...b.values)) };
  if (
    now < g.start + b.at + 100 ||
    now > g.start + b.at + b.window ||
    v.actedBeat === b.index
  )
    return null;
  return {
    value: g.id === "fish" ? "reel" : g.id === "hop" ? "jump" : b.color,
  };
}
module.exports = { handled, setup, advance, play, bot, cue };
