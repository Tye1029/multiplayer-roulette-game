"use strict";
const { randomInt: rnd } = require("node:crypto");
const F = require("./festival-games");
const W = require("./midway-games");
const E = require("./expansion-games"),
  P = require("./putting");
const X = require("../../../assets/party/expansion-rules");
const R = require("../../../assets/party/rules");
const ids = ["fish", "lantern", "hop", "dash", "signal"];
const handled = (id) =>
  id === "putt" ||
  ids.includes(id) ||
  F.handled(id) ||
  E.handled(id) ||
  W.handled(id);
function setup(g) {
  if (W.handled(g.id)) return W.setup(g);
  if (g.id === "putt") return P.setup(g);
  if (E.handled(g.id)) return E.setup(g);
  if (F.handled(g.id)) return F.setup(g);
  if (g.id === "fish") {
    g.duration = 60000;
    g.end = g.start + g.duration;
  }
  g.survival = g.id === "lantern";
  if (!handled(g.id)) return;
  const count =
    g.id === "lantern" ? 10 : g.id === "dash" ? 14 : g.id === "fish" ? 4 : 8;
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
      return n < 2 ? -3 : n < 5 ? 3 : 1;
    }),
    size: ["small", "medium", "large"][rnd(3)],
    speed: 0.007 + rnd(6) * 0.001,
    rarity: rnd(100),
    fake: rnd(2) === 0,
  }));
  if (g.id === "lantern")
    g.beats.forEach((b, i) => {
      b.at = 2400 + (i * (g.duration - 5500)) / (count - 1);
      b.window = 650;
      b.fake = i === 2 || i === 5 || i === 8;
      b.decoy = (b.color + 1 + rnd(3)) % 4;
      b.layout = [0, 1, 2, 3];
      if (i >= 3)
        for (let j = 3; j > 0; j--) {
          const k = rnd(j + 1);
          [b.layout[j], b.layout[k]] = [b.layout[k], b.layout[j]];
        }
    });
  if (g.id === "signal") for (const b of g.beats) b.at += rnd(650);
  if (g.id === "fish") {
    g.fishBeats = g.progress.map((_, i) =>
      g.beats.map((b) => ({
        index: b.index,
        at: b.at + 1500 + i * 180 + rnd(140),
        window: 1100,
        size: 0.3 + rnd(131) / 100,
        species: rnd(R.fishSpecies.length),
      })),
    );
  }
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
function cue(g, now, i = 0) {
  if (W.handled(g.id)) return W.cue(g, now);
  if (E.handled(g.id)) return E.cue(g, now);
  if (F.handled(g.id)) return F.cue(g, now);
  if (g.id === "fish" && g.progress[i]?.catch) return null;
  const beats = g.id === "fish" ? g.fishBeats[i] : g.beats;
  const b = beats?.find((b) => now - g.start <= b.at + b.window) || null;
  if (g.id === "lantern" && b) {
    const reveal = Math.max(
      g.start + b.at - 1800,
      (g.lanternLast?.at || 0) + 1100,
    );
    const card = {
      ...b,
      color: b.fake && now < reveal + 850 ? b.decoy : b.color,
      reveal,
    };
    delete card.decoy;
    delete card.fake;
    return card;
  }
  return b;
}
function award(g, i, value, now, label) {
  const v = g.progress[i];
  const before = g.scores[i];
  g.scores[i] = Math.max(0, before + value);
  value = g.scores[i] - before;
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
  if (g.id === "lantern" || (["hop", "dash"].includes(g.id) && v.misses >= 3)) {
    v.eliminatedAt = v.finished = now;
  }
}
function advance(g, i, now) {
  if (W.handled(g.id)) return W.advance(g, i, now);
  if (g.id === "putt") return P.advance(g, i, now);
  if (E.handled(g.id)) return E.advance(g, i, now);
  if (F.handled(g.id)) return F.advance(g, i, now);
  if (!handled(g.id)) return;
  const v = g.progress[i];
  if (v.finished) return;
  const beats = g.id === "fish" ? g.fishBeats[i] : g.beats;
  for (const b of beats) {
    const due = g.start + b.at + (g.id === "hop" ? 180 : b.window);
    if (now < due || b.index <= v.resolved) continue;
    const active = v.inputs > 0 && due - v.last < 6500;
    if (g.id === "lantern") {
      g.lanternLast = {
        at: due,
        index: b.index,
        layout: b.layout,
        safeTile: R.lanternTile(b),
      };
      if (
        (v.chosen ?? i) === R.lanternTile(b) &&
        (!v.moveAt || v.moveAt + 420 <= due)
      ) {
        if (v.inputs === 0) {
          v.resolved = b.index;
          continue;
        }
        v.combo++;
        award(
          g,
          i,
          150 + v.combo * 25,
          due,
          "Safe landing! +" + (150 + v.combo * 25),
        );
      } else {
        v.fallTile =
          v.moveAt && v.moveAt + 420 > due ? v.fromLane : (v.chosen ?? i);
        miss(g, i, due, "Wrong platform!");
      }
    } else if (g.id === "hop") {
      const contact = g.start + b.at;
      if (v.hopAttempt?.index === b.index && R.hopClear(b, contact, v.jumpAt)) {
        v.combo++;
        const accuracy = Math.abs(
          v.jumpAt - (contact - R.hopDuration(b.size) / 2),
        );
        award(
          g,
          i,
          Math.max(180, Math.round(400 - accuracy * 0.7)),
          contact,
          "Clean hop!",
        );
      } else miss(g, i, contact, "Bumped by the driftwood!");
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
  if (W.handled(g.id)) return W.play(g, i, b, now, fail);
  if (g.id === "putt") return P.play(g, i, b, now, fail);
  if (E.handled(g.id)) return E.play(g, i, b, now, fail);
  if (F.handled(g.id)) return F.play(g, i, b, now, fail);
  const v = g.progress[i],
    beat = cue(g, now, i);
  if (!beat || v.finished) fail("Your round is finished.");
  if (g.id === "dash") {
    if (["left", "right"].includes(b.value)) {
      v.fromLane = v.lane;
      v.lane = Math.max(0, Math.min(2, v.lane + (b.value === "left" ? -1 : 1)));
      v.moveAt = now;
    } else if (g.id === "dash" && ["jump", "duck"].includes(b.value)) {
      const key = b.value === "jump" ? "jumpAt" : "duckAt";
      if (now - v[key] < 900) fail("Land before moving again.");
      v[key] = now;
    } else fail("Choose a valid movement.", 400);
  } else if (["lantern"].includes(g.id)) {
    if (
      !Number.isInteger(b.value) ||
      b.value < 0 ||
      b.value >= (g.id === "lantern" ? 4 : 3)
    )
      fail("Choose a platform.", 400);
    if (g.id === "lantern") {
      if (now - (v.moveAt || 0) < 420) fail("Land before jumping again.");
      if (g.lanternLast && now - g.lanternLast.at < 1100)
        fail("Wait for the hatches to rise.");
      if (b.value === (v.chosen ?? i)) {
        v.feedback = "Holding this platform";
        return;
      }
    }
    v.fromLane = v.chosen ?? (g.id === "lantern" ? i : 1);
    v.chosen = b.value;
    v.choiceBeat = beat.index;
    v.moveAt = now;
    v.feedback = "Ready on your platform.";
  } else {
    if (v.actedBeat === beat.index) fail("Wait for the next signal.");
    if (g.id === "hop") {
      if (beat.index <= v.resolved) fail("Wait for the next log.");
      if (b.value !== "jump") fail("Choose Jump.", 400);
      if (now - v.jumpAt < (v.jumpDuration || 600))
        fail("Land before jumping again.");
      v.actedBeat = beat.index;
      v.attempts++;
      v.jumpDuration = R.hopDuration(beat.size);
      // Fixed server-owned delivery credit. No client clock or outcome is trusted.
      v.jumpAt = now - 100;
      v.hopAttempt = { index: beat.index, size: beat.size };
      v.feedback = "Jump!";
      return;
    }
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
        // The visible ripple is an honest indication of the fish's size.
        score = Math.round(beat.size * 75);
        v.catch = {
          at: now,
          score,
          length: score,
          species: beat.species,
          rarity: R.fishSpecies[beat.species] || R.fishSpecies[0],
        };
        v.finished = now + 1800;
      }
      award(
        g,
        i,
        score,
        now,
        g.id === "fish"
          ? "Fish landed! Wait for the measure…"
          : "+" + score + " Perfect!",
      );
    }
  }
}
function bot(g, i, now) {
  if (W.handled(g.id)) return W.bot(g, i, now);
  if (g.id === "putt") return P.bot(g, i, now);
  if (E.handled(g.id)) return E.bot(g, i, now);
  if (F.handled(g.id)) return F.bot(g, i, now);
  const v = g.progress[i],
    b = cue(g, now, i);
  if (!b) return null;
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
  if (g.id === "lantern") {
    if (
      now - (v.moveAt || 0) < 450 ||
      (g.lanternLast && now - g.lanternLast.at < 1100) ||
      v.chosen === R.lanternTile(b)
    )
      return null;
    return { value: rnd(12) ? R.lanternTile(b) : rnd(4) };
  }
  if (
    now < g.start + b.at + (g.id === "hop" ? -X.waveLead(b.size) : 100) ||
    now > g.start + b.at + b.window ||
    v.actedBeat === b.index
  )
    return null;
  return {
    value: g.id === "fish" ? "reel" : g.id === "hop" ? "jump" : b.color,
  };
}
module.exports = {
  handled,
  setup,
  advance,
  play,
  bot,
  cue,
  publicView(g, out, now, viewer) {
    if (W.handled(g.id)) W.publicView(g, out, now, viewer);
    else if (E.handled(g.id)) E.publicView(g, out, now, viewer);
    else if (F.handled(g.id)) F.publicView(g, out, now, viewer);
    if (g.id === "hop")
      out.rollers = g.beats.filter((b) => {
        const z = 3.5 + (now - g.start - b.at) * b.speed;
        return z >= -23 && z <= 27;
      });
  },
  festival: F,
};
