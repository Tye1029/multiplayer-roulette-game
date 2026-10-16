"use strict";
const { randomInt: rnd } = require("node:crypto");
const defs = require("../../../assets/party/expansion-catalog");
const R = require("../../../assets/party/expansion-rules");
const H = require("../safe-cracker/heist");
const F = require("./festival-games");
const handled = (id) => defs.some((g) => g.id === id);
const shuffle = (a) => {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
function award(g, i, n, now, label) {
  const v = g.progress[i],
    before = g.scores[i];
  g.scores[i] = Math.max(0, before + n);
  v.popup = { at: now, value: g.scores[i] - before, label };
  v.feedback = label;
}
function eliminate(g, i, now, label) {
  const v = g.progress[i];
  if (v.finished) return;
  v.eliminatedAt = v.finished = v.hitAt = now;
  v.feedback = label;
  v.popup = { at: now, value: 0, label };
}
function puzzle() {
  const tiles = [1, 2, 3, 4, 5, 6, 7, 8, 0];
  let prev = -1;
  for (let k = 0; k < 100; k++) {
    const blank = tiles.indexOf(0),
      next = tiles
        .map((_, i) => i)
        .filter((i) => R.adjacent(i, blank) && i !== prev),
      at = next[rnd(next.length)];
    [tiles[at], tiles[blank]] = [tiles[blank], tiles[at]];
    prev = blank;
  }
  if (R.solved(tiles)) return puzzle();
  return tiles;
}
function question() {
  const nums = Array.from({ length: 5 }, () => 2 + rnd(13)),
    ops = Array.from({ length: 4 }, () => (rnd(3) ? "+" : "−"));
  const answer = nums.reduce(
    (v, n, i) => (i === 0 ? n : ops[i - 1] === "+" ? v + n : v - n),
    0,
  );
  const choices = shuffle([
    answer,
    answer + 1 + rnd(4),
    answer - 1 - rnd(4),
    answer + 5 + rnd(5),
  ]);
  return {
    text: nums.map((n, i) => (i ? ops[i - 1] + " " : "") + n).join(" "),
    choices,
    correct: choices.indexOf(answer),
  };
}
function setup(g) {
  const def = defs.find((d) => d.id === g.id);
  if (!def) return;
  g.duration = def.duration;
  g.end = g.start + g.duration;
  g.survival = ["bumper", "volcano"].includes(g.id);
  g.shared = { lastTick: 0 };
  g.secrets = {};
  const tiles = puzzle();
  if (g.id === "math") g.questions = Array.from({ length: 5 }, question);
  if (g.id === "band") {
    g.song = rnd(R.songs.length);
    const song = R.songs[g.song],
      beat = 60000 / song.bpm;
    g.notes = Array.from(
      { length: Math.floor((g.duration - 5000) / beat) },
      (_, i) => ({
        index: i,
        at: 2500 + i * beat,
        lane:
          (i % 16 < 8 ? i * 3 + Math.floor(i / 4) : i + Math.floor(i / 3)) % 4,
        midi: song.root + song.melody[i % song.melody.length],
      }),
    );
  }
  if (g.id === "baseball")
    g.pitches = Array.from({ length: 12 }, (_, i) => ({
      index: i,
      at: 3200 + i * 3650,
      type: ["fastball", "curve", "change-up"][rnd(3)],
    }));
  if (g.id === "volcano")
    g.rocks = Array.from({ length: 30 }, (_, i) => ({
      index: i,
      at: 2800 + i * 1450,
      x: (rnd(150) - 75) / 10,
      z: (rnd(140) - 70) / 10,
      radius: 1.25 + rnd(12) / 10,
      lead: Math.max(1050, 2200 - i * 30),
    }));
  for (const [i, v] of g.progress.entries()) {
    Object.assign(v, {
      botWait: g.id === "band" ? 170 + rnd(100) : 350 + rnd(350),
      resolved: -1,
      moveAt: 0,
      hitAt: 0,
      combo: 0,
      step: 0,
      tiles: [...tiles],
      tileAt: 0,
      roundScores: [],
      guesses: [],
      board: 0,
      strokes: 0,
      dir: { x: 0, z: 0 },
      motionAt: 0,
      vx: 0,
      vz: 0,
      x: Math.cos((i * Math.PI) / 2 + Math.PI / 4) * 5.6,
      z: Math.sin((i * Math.PI) / 2 + Math.PI / 4) * 5.6,
    });
    if (g.id.startsWith("safe-")) {
      g.secrets[i] = {
        heist: H.create(() => rnd(1000000) / 1000000),
        digits: shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, 6),
      };
      if (g.id === "safe-wires") g.secrets[i].heist.phase = 1;
    }
  }
}
function cue(g, now) {
  const elapsed = now - g.start;
  if (g.id === "math") {
    const index = R.mathRound(g, now),
      q = g.questions[index];
    return {
      index,
      text: q.text,
      choices: q.choices,
      at: index * 13000,
      window: 10000,
      reveal: elapsed % 13000 >= 10000,
      ...(elapsed % 13000 >= 10000 ? { correct: q.correct } : {}),
    };
  }
  if (g.id === "baseball")
    return g.pitches.find((p) => elapsed <= p.at + 500) || null;
  if (g.id === "band")
    return g.notes.find((n) => elapsed <= n.at + 230) || null;
  return null;
}
function tickMovement(g, now) {
  if (!["bumper", "volcano"].includes(g.id)) return;
  let t = g.shared.lastTick || g.start;
  const end = Math.min(now, g.end);
  if (end <= t) return;
  // Both cars receive the same impulse. Fixed small steps prevent tunnelling.
  while (t < end) {
    const ms = Math.min(1000 / 60, end - t),
      dt = ms / 1000;
    t += ms;
    for (const i of g.active) {
      const v = g.progress[i];
      if (v.finished) continue;
      const live = t - v.motionAt < 700,
        dx = live ? v.dir.x : 0,
        dz = live ? v.dir.z : 0;
      if (g.id === "bumper") {
        v.vx = (v.vx + dx * 15 * dt) * Math.exp(-1.6 * dt);
        v.vz = (v.vz + dz * 15 * dt) * Math.exp(-1.6 * dt);
        const speed = Math.hypot(v.vx, v.vz);
        if (speed > 8) {
          v.vx *= 8 / speed;
          v.vz *= 8 / speed;
        }
      } else {
        const blend = 1 - Math.exp(-14 * dt);
        v.vx += (dx * 6 - v.vx) * blend;
        v.vz += (dz * 6 - v.vz) * blend;
      }
      v.x += v.vx * dt;
      v.z += v.vz * dt;
      if (g.id === "volcano") {
        v.x = R.clamp(v.x, -8, 8);
        v.z = R.clamp(v.z, -7.5, 7.5);
      }
    }
    if (g.id === "bumper") {
      for (let a = 0; a < g.active.length; a++)
        for (let b = a + 1; b < g.active.length; b++) {
          const x = g.progress[g.active[a]],
            y = g.progress[g.active[b]];
          if (x.finished || y.finished) continue;
          const dx = y.x - x.x,
            dz = y.z - x.z,
            d = Math.hypot(dx, dz);
          if (d >= 1.65) continue;
          const nx = d > 0.001 ? dx / d : 1,
            nz = d > 0.001 ? dz / d : 0,
            overlap = (1.65 - d) / 2;
          x.x -= nx * overlap;
          x.z -= nz * overlap;
          y.x += nx * overlap;
          y.z += nz * overlap;
          const relative = (y.vx - x.vx) * nx + (y.vz - x.vz) * nz;
          if (relative < 0) {
            const impulse = (-(1 + 0.85) * relative) / 2;
            x.vx -= impulse * nx;
            x.vz -= impulse * nz;
            y.vx += impulse * nx;
            y.vz += impulse * nz;
            x.hitAt = y.hitAt = t;
          }
        }
      for (const i of g.active) {
        const v = g.progress[i];
        if (
          !v.finished &&
          (Math.hypot(v.x, v.z) > 9.25 ||
            R.holes.some(
              ([x, z, r]) => Math.hypot(v.x - x, v.z - z) < r - 0.18,
            ))
        )
          eliminate(g, i, t, "Over the edge!");
      }
    } else {
      for (const rock of g.rocks) {
        const at = g.start + rock.at;
        if (at > t || rock.done) continue;
        rock.done = true;
        for (const i of g.active) {
          const v = g.progress[i];
          if (
            !v.finished &&
            Math.hypot(v.x - rock.x, v.z - rock.z) < rock.radius + 0.35
          )
            eliminate(g, i, at, "Caught by the eruption!");
        }
      }
    }
  }
  g.shared.lastTick = end;
}
function advance(g, i, now) {
  tickMovement(g, now);
  const v = g.progress[i];
  if (v.finished) return;
  if (
    g.id === "basket" &&
    v.shot &&
    !v.shot.resolved &&
    now >= v.shot.at + R.ballFlight
  ) {
    v.shot.resolved = true;
    const dx = Math.abs(v.shot.hoop);
    const points = dx < 0.18 ? 500 : dx < 0.39 ? 300 : 0;
    award(
      g,
      i,
      points,
      v.shot.at + R.ballFlight,
      points === 500
        ? "SWISH! +500"
        : points
          ? "BASKET! +300"
          : dx < 0.85
            ? "Off the rim!"
            : "Wide — lead the hoop",
    );
  }
  if (g.id === "band")
    for (const n of g.notes) {
      if (n.index <= v.resolved || now < g.start + n.at + 230) continue;
      if (!(v.hitNotes || []).includes(n.index)) {
        v.combo = 0;
        v.hitAt = g.start + n.at + 230;
        v.feedback = "Missed note";
      }
      v.resolved = n.index;
    }
  if (g.id === "math")
    for (let k = 0; k < 5; k++) {
      if (k <= v.resolved || now < g.start + k * 13000 + 10000) continue;
      const a = v.answers?.[k],
        good = a?.value === g.questions[k].correct,
        points = good ? 100 + Math.floor(400 * (1 - a.elapsed / 10000)) : 0;
      v.roundScores[k] = points;
      award(
        g,
        i,
        points,
        g.start + k * 13000 + 10000,
        good
          ? "Correct! +" + points
          : "Answer: " + g.questions[k].choices[g.questions[k].correct],
      );
      v.resolved = k;
    }
  if (g.id === "puzzle" && !v.finished)
    g.scores[i] = v.tiles.filter((n, j) => n && n === j + 1).length * 75;
}
function play(g, i, b, now, fail) {
  const v = g.progress[i],
    id = g.id,
    value = b.value,
    elapsed = now - g.start;
  if (["bumper", "volcano"].includes(id)) {
    if (
      value !== "steer" ||
      !Number.isFinite(b.x) ||
      !Number.isFinite(b.z) ||
      Math.abs(b.x) > 1 ||
      Math.abs(b.z) > 1
    )
      fail("Choose a valid steering direction.", 400);
    const length = Math.max(1, Math.hypot(b.x, b.z));
    v.dir = { x: b.x / length, z: b.z / length };
    v.motionAt = now;
    return;
  }
  if (id === "basket") {
    if (value !== "shoot") fail("Press Shoot.", 400);
    if (v.shot && now - v.shot.at < 1550) fail("Wait for the ball to return.");
    v.shot = { at: now, hoop: R.hoop(g, now + R.ballFlight), resolved: false };
    v.moveAt = now;
  } else if (id === "band") {
    if (!Number.isInteger(value) || value < 0 || value > 3)
      fail("Choose one of the four notes.", 400);
    v.hitNotes ||= [];
    const n = g.notes
      .filter(
        (n) => !v.hitNotes.includes(n.index) && Math.abs(elapsed - n.at) <= 230,
      )
      .sort((a, b) => Math.abs(elapsed - a.at) - Math.abs(elapsed - b.at))[0];
    v.moveAt = now;
    v.noteLane = value;
    if (n && n.lane === value) {
      v.hitNotes.push(n.index);
      v.combo++;
      const perfect = Math.abs(elapsed - n.at) <= 90;
      award(
        g,
        i,
        (perfect ? 150 : 80) + Math.min(20, Math.floor(v.combo / 5) * 5),
        now,
        perfect ? "PERFECT!" : "Good rhythm!",
      );
    } else {
      v.combo = 0;
      v.hitAt = now;
      award(g, i, -30, now, "Wrong note");
    }
  } else if (id === "baseball") {
    if (value !== "swing") fail("Press Swing.", 400);
    const p = cue(g, now);
    if (!p || v.actedBeat === p.index) fail("Wait for the next pitch.");
    v.actedBeat = p.index;
    v.moveAt = now;
    const dt = Math.abs(elapsed - p.at),
      points = dt <= 80 ? 500 : dt <= 210 ? 200 : 0;
    v.batHit = { at: now, pitch: p.index, points };
    award(
      g,
      i,
      points,
      now,
      points === 500
        ? "HOME RUN! +500"
        : points
          ? "FAIR HIT! +200"
          : "Strike! Watch it reach the plate",
    );
  } else if (id === "math") {
    const k = R.mathRound(g, now);
    if (elapsed % 13000 >= 10000) fail("Next question is coming.");
    if (!Number.isInteger(value) || value < 0 || value > 3)
      fail("Choose an answer.", 400);
    v.answers ||= {};
    if (v.answers[k]) fail("Your answer is locked.");
    v.answers[k] = { value, elapsed: elapsed % 13000 };
    v.feedback = "Answer locked. Wait for the reveal.";
  } else if (id === "puzzle") {
    if (!Number.isInteger(value) || value < 0 || value > 8)
      fail("Choose a tile.", 400);
    const blank = v.tiles.indexOf(0);
    if (!R.adjacent(blank, value))
      fail("Slide a tile next to the empty square.");
    v.tileMove = { from: value, to: blank, number: v.tiles[value], at: now };
    [v.tiles[value], v.tiles[blank]] = [v.tiles[blank], v.tiles[value]];
    v.moveAt = now;
    if (R.solved(v.tiles)) F.finishRace(g, i, now);
  } else if (id === "safe-panel" || id === "safe-wires") {
    const secret = g.secrets[i];
    if (now - (v.toolAt || 0) < 350) fail("Let the tool finish its turn.");
    const h = secret.heist;
    if (typeof value !== "string" || value.length > 60)
      fail("Choose a tool action.", 400);
    if (id === "safe-panel" && !value.startsWith("screw:"))
      fail("Match a screwdriver to a screw.", 400);
    if (id === "safe-wires" && !/^(card:|cut:)/.test(value))
      fail("Read the note or cut a wire.", 400);
    let next;
    try {
      next = H.apply(h, value, now);
    } catch (e) {
      fail(e.message, 400);
    }
    if (next === h) fail("That part is already finished.");
    secret.heist = next;
    v.toolAt = v.moveAt = now;
    const correct =
      next.lastAction.effect === "remove" || next.lastAction.effect === "cut";
    if (correct) {
      v.step++;
      award(
        g,
        i,
        100,
        now,
        next.lastAction.effect === "remove"
          ? "Screw removed +100"
          : "Correct wire +100",
      );
    }
    if (["strip", "zap"].includes(next.lastAction.effect)) {
      v.hitAt = now;
      v.faults = (v.faults || 0) + 1;
      award(
        g,
        i,
        -50,
        now,
        next.lastAction.effect === "strip"
          ? "Stripped! Needs three turns"
          : "Wrong wire! −50",
      );
    }
    if (next.failed || (v.faults >= 5 && id === "safe-wires")) {
      v.finished = now;
      v.feedback = "Five faults — panel locked";
      return;
    }
    if (
      (id === "safe-panel" && next.phase === 1) ||
      (id === "safe-wires" && next.phase === 2)
    ) {
      v.board++;
      v.boardAt = now;
      if (v.board >= (id === "safe-panel" ? 3 : 2)) F.finishRace(g, i, now);
      else {
        secret.heist = H.create(() => rnd(1000000) / 1000000);
        if (id === "safe-wires") secret.heist.phase = 1;
      }
    }
  } else if (id === "safe-dial") {
    if (!Number.isInteger(value) || value < 0 || value > 9)
      fail("Choose a digit from 0 to 9.", 400);
    if (now - (v.checkAt || 0) < 700) fail("The tumbler is checking.");
    const target = g.secrets[i].digits[v.step],
      raw = Math.abs(target - value),
      d = Math.min(raw, 10 - raw),
      tier = d === 0 ? "green" : d === 1 ? "yellow" : d <= 3 ? "orange" : "red";
    v.checkAt = v.moveAt = now;
    v.guesses.push({ step: v.step, value, tier, at: now });
    v.feedback =
      tier === "green"
        ? "Click! Lock opened"
        : tier === "yellow"
          ? "One click away"
          : tier === "orange"
            ? "Two or three clicks away"
            : "Four or five clicks away";
    if (!d) {
      v.step++;
      award(g, i, 400, now, "LOCK OPEN! +400");
      if (v.step >= 6) F.finishRace(g, i, now);
    }
  }
}
function publicView(g, out, now, viewer) {
  delete out.secrets;
  delete out.questions;
  delete out.rocks;
  delete out.pitches;
  delete out.notes;
  out.cue = cue(g, now);
  if (g.id === "band")
    out.notes = g.notes.filter(
      (n) => n.at >= now - g.start - 350 && n.at <= now - g.start + 5000,
    );
  if (g.id === "volcano")
    out.rocks = g.rocks
      .filter(
        (r) => now - g.start >= r.at - r.lead && now - g.start < r.at + 1200,
      )
      .map(({ done, ...r }) => r);
  out.progress.forEach((v, i) => {
    delete v.botPlan;
    delete v.botAt;
    delete v.hitNotes;
    delete v.dir;
    if (g.id === "math") {
      v.locked = !!v.answers?.[R.mathRound(g, now)];
      delete v.answers;
    }
    if (i !== viewer) {
      delete v.tiles;
      delete v.guesses;
      delete v.tileMove;
    }
    if (g.id === "safe-panel" || g.id === "safe-wires")
      v.panel = H.publicView(g.secrets[i].heist, i === viewer);
  });
}
function solvePuzzle(tiles) {
  // A* on the eight-puzzle, used only to give bots a legal move sequence.
  const key = (a) => a.join(""),
    heuristic = (a) =>
      a.reduce(
        (s, n, i) =>
          s +
          (n
            ? Math.abs((i % 3) - ((n - 1) % 3)) +
              Math.abs(Math.floor(i / 3) - Math.floor((n - 1) / 3))
            : 0),
        0,
      ),
    open = [],
    seen = new Map();
  // A binary heap keeps bot planning bounded without sorting the entire
  // frontier on every step (which otherwise stalls a multiplayer request).
  const push = (node) => {
    let i = open.length;
    open.push(node);
    while (i) {
      const p = (i - 1) >> 1;
      if (open[p].cost <= node.cost) break;
      open[i] = open[p];
      i = p;
    }
    open[i] = node;
  };
  const pop = () => {
    const first = open[0],
      last = open.pop();
    if (open.length) {
      let i = 0;
      while (i * 2 + 1 < open.length) {
        let c = i * 2 + 1;
        if (c + 1 < open.length && open[c + 1].cost < open[c].cost) c++;
        if (last.cost <= open[c].cost) break;
        open[i] = open[c];
        i = c;
      }
      open[i] = last;
    }
    return first;
  };
  push({ a: tiles, path: [], cost: heuristic(tiles) });
  for (let k = 0; k < 30000 && open.length; k++) {
    const n = pop();
    if (R.solved(n.a)) return n.path;
    const code = key(n.a);
    if ((seen.get(code) ?? Infinity) <= n.path.length) continue;
    seen.set(code, n.path.length);
    const z = n.a.indexOf(0);
    for (let i = 0; i < 9; i++)
      if (R.adjacent(z, i)) {
        const a = [...n.a];
        [a[z], a[i]] = [a[i], a[z]];
        const path = [...n.path, i];
        push({ a, path, cost: path.length + heuristic(a) });
      }
  }
  return [];
}
function bot(g, i, now) {
  const v = g.progress[i],
    id = g.id;
  if (now - (v.botAt || 0) < (id === "band" ? 180 : 350)) return null;
  v.botAt = now;
  if (id === "basket")
    return !v.shot || now - v.shot.at >= 1600 ? { value: "shoot" } : null;
  if (id === "band") {
    const n = cue(g, now);
    return n &&
      Math.abs(now - g.start - n.at) < 180 &&
      !(v.hitNotes || []).includes(n.index)
      ? { value: n.lane }
      : null;
  }
  if (id === "baseball") {
    const p = cue(g, now);
    return p && now >= g.start + p.at - 90 && v.actedBeat !== p.index
      ? { value: "swing" }
      : null;
  }
  if (id === "math") {
    const c = cue(g, now);
    return !c.reveal && now - g.start - c.at > 2200 + i * 650
      ? { value: rnd(6) ? g.questions[c.index].correct : rnd(4) }
      : null;
  }
  if (id === "puzzle") {
    v.botPlan ||= [...(g.secrets.puzzlePlan ||= solvePuzzle(v.tiles))];
    return v.botPlan.length ? { value: v.botPlan.shift() } : null;
  }
  if (id === "safe-panel" || id === "safe-wires")
    return { value: H.botCommand(g.secrets[i].heist) };
  if (id === "safe-dial") {
    const guesses = v.guesses.filter((a) => a.step === v.step),
      possible = Array.from({ length: 10 }, (_, n) => n).filter((n) =>
        guesses.every((a) => {
          const raw = Math.abs(a.value - n),
            d = Math.min(raw, 10 - raw);
          return (
            a.tier ===
            (d === 0 ? "green" : d === 1 ? "yellow" : d <= 3 ? "orange" : "red")
          );
        }),
      );
    return { value: possible[rnd(possible.length || 1)] ?? 0 };
  }
  if (id === "bumper" || id === "volcano") {
    let tx = 0,
      tz = 0;
    if (id === "bumper") {
      const other = g.active
        .filter((j) => j !== i && !g.progress[j].finished)
        .map((j) => g.progress[j])
        .sort(
          (a, b) =>
            Math.hypot(a.x - v.x, a.z - v.z) - Math.hypot(b.x - v.x, b.z - v.z),
        )[0];
      if (other) {
        tx = other.x;
        tz = other.z;
      }
      if (Math.hypot(v.x, v.z) > 7) {
        tx = 0;
        tz = 0;
      }
      for (const [x, z, r] of R.holes)
        if (Math.hypot(v.x - x, v.z - z) < r + 2) {
          tx = v.x + (v.x - x) * 3;
          tz = v.z + (v.z - z) * 3;
        }
    } else {
      const rock = g.rocks.find(
        (r) =>
          !r.done &&
          now - g.start > r.at - r.lead &&
          Math.hypot(v.x - r.x, v.z - r.z) < r.radius + 1.4,
      );
      if (rock) {
        tx = R.clamp(v.x + (v.x - rock.x) * 3, -7, 7);
        tz = R.clamp(v.z + (v.z - rock.z) * 3, -6.5, 6.5);
      } else {
        tx = Math.cos(now / 3000 + i) * 5;
        tz = Math.sin(now / 3000 + i) * 5;
      }
    }
    const dx = tx - v.x,
      dz = tz - v.z,
      len = Math.max(1, Math.hypot(dx, dz));
    return { value: "steer", x: dx / len, z: dz / len };
  }
  return null;
}
module.exports = {
  handled,
  setup,
  cue,
  advance,
  play,
  publicView,
  bot,
  solvePuzzle,
};
