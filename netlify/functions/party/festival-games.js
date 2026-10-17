"use strict";
const { randomInt: rnd } = require("node:crypto");
const defs = require("../../../assets/party/festival-catalog");
const R = require("../../../assets/party/rules");
const handled = (id) => defs.some((d) => d.id === id);
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const TAU = Math.PI * 2;
const active = (g) => g.active || g.progress.map((_, i) => i);
const alive = (g) => active(g).filter((i) => !g.progress[i].eliminatedAt);
const angle = R.cannonAngle;
const stackX = (g, v, now) =>
  Math.sin((now - g.start) / (650 - Math.min(200, v.step * 12))) * 2.5;
const aimX = R.arrowAim,
  targetX = (g, b, now) => R.arrowTarget(g, now);
function award(g, i, n, now, label) {
  const v = g.progress[i],
    before = g.scores[i];
  g.scores[i] = Math.max(0, before + Math.round(n));
  v.popup = { at: now, value: g.scores[i] - before, label };
  v.feedback = label;
}
function out(g, i, now, reason) {
  const v = g.progress[i];
  if (v.eliminatedAt) return;
  v.eliminatedAt = v.finished = v.hitAt = now;
  v.feedback = reason;
  v.popup = { at: now, value: 0, label: reason };
}
function finishRace(g, i, now) {
  const v = g.progress[i];
  if (v.finished) return;
  const place =
    active(g).filter(
      (j) => g.progress[j].finishPlace && g.progress[j].finished < now,
    ).length + 1;
  v.finishPlace = place;
  v.finished = now;
  // Separate placement bands guarantee first > second, even with different combo histories.
  const score =
    4000 +
    (active(g).length - place) * 1000 +
    Math.floor(clamp((g.end - now) / g.duration, 0, 1) * 900);
  award(g, i, score - g.scores[i], now, `Finished #${place}!`);
}
function setup(g) {
  if (!handled(g.id)) return;
  g.survival = ["bomb", "cannon", "rope"].includes(g.id);
  const count =
    {
      kart: 26,
      simon: 12,
      rope: 16,
      orchard: 10,
      rhythm: 18,
      boats: 9,
      spotlight: 8,
      volley: 10,
    }[g.id] || 8;
  if (g.id === "kart") {
    g.duration = 60000;
    g.end = g.start + g.duration;
  }
  const interval = (g.duration - 2000) / count;
  g.beats = Array.from({ length: count }, (_, index) => ({
    index,
    at: 1500 + index * interval,
    window: Math.min(750, interval * 0.42),
    lane: rnd(3),
    color: rnd(4),
    fake: rnd(3) === 0,
    action: ["left", "right", "jump", "duck"][rnd(4)],
    values: Array.from({ length: 3 }, () => 2 + rnd(7)),
    trap: rnd(3),
    boost: rnd(3),
    high: rnd(4) === 0,
  }));
  if (g.id === "spotlight")
    g.beats.forEach((b, i) => {
      b.at = 2600 + (i * (g.duration - 4600)) / count;
      b.window = 900;
    });
  if (g.id === "kart")
    for (const b of g.beats)
      if (b.boost === b.lane) b.boost = (b.lane + 1 + rnd(2)) % 3;
  if (g.id === "rope")
    g.beats.forEach((b, i) => {
      b.at =
        1500 + (g.duration - 3000) * (1 - Math.pow(1 - i / (count - 1), 1.3));
      b.window = 650;
    });
  g.orders = Array.from({ length: 40 }, () =>
    Array.from({ length: 3 }, () => rnd(4)),
  );
  g.maze = Array.from({ length: 25 }, () => []);
  const visited = new Set([0]),
    todo = [0];
  while (todo.length) {
    const cell = todo.at(-1),
      x = cell % 5,
      y = Math.floor(cell / 5);
    const next = [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ]
      .filter(([a, b]) => a >= 0 && a < 5 && b >= 0 && b < 5)
      .map(([a, b]) => a + b * 5)
      .filter((n) => !visited.has(n));
    if (!next.length) {
      todo.pop();
      continue;
    }
    const n = next[rnd(next.length)];
    g.maze[cell].push(n);
    g.maze[n].push(cell);
    visited.add(n);
    todo.push(n);
  }
  g.shared = {
    holder: active(g)[rnd(active(g).length)],
    fuseEnd: 0,
    explosions: 0,
    passedAt: 0,
    shots: [],
    rope: 0,
    resolved: -1,
    lastTick: 0,
    jackpot: 2,
  };
  g.privateChoices = {};
  for (const v of g.progress)
    Object.assign(v, {
      resolved: -1,
      lane: 1,
      fromLane: 1,
      moveAt: 0,
      health: 3,
      stamina: 100,
      pressure: 0,
      pot: 0,
      distance: 0,
      speed: 1,
      width: 3,
      stack: [],
      cell: 0,
      target: 24,
      step: 0,
      rings: [0, 0, 0],
      order: 0,
      cursor: 0,
      boosted: 0,
      botWait: 190 + rnd(230),
      chosen: null,
      choiceBeat: -1,
      actedBeat: -1,
      lastTick: 0,
    });
}
function cue(g, now) {
  const b = g.beats?.find((x) => now - g.start <= x.at + x.window);
  if (!b) return null;
  const { trap, ...safe } = b;
  // The confetti popper is hidden; all other fields are deliberately visible telegraphs.
  return safe;
}
function publicView(g, out, now, viewer) {
  delete out.orders;
  delete out.privateChoices;
  if (g.id !== "maze") delete out.maze;
  out.cue = cue(g, now);
  out.progress.forEach((v, i) => {
    delete v.chosen;
    delete v.choiceBeat;
    if (["fencing", "draft"].includes(g.id) && i === viewer)
      v.locked = !!g.privateChoices[i];
    if (["bakery", "fuse"].includes(g.id)) {
      const p = g.progress[i];
      if (g.id === "fuse" || p.order < 3 || now < (p.orderAt || g.start) + 4500)
        v.recipe = g.orders[p.order % g.orders.length];
    }
  });
}
function settleBeat(g, b, now) {
  const ids = active(g),
    sh = g.shared;
  if (g.id === "fencing") {
    const [a, c] = ids,
      av =
        g.privateChoices[a]?.beat === b.index
          ? g.privateChoices[a].value
          : undefined,
      cv =
        g.privateChoices[c]?.beat === b.index
          ? g.privateChoices[c].value
          : undefined;
    const wins = { rock: "scissors", scissors: "paper", paper: "rock" };
    for (const [i, value, rival] of [
      [a, av, cv],
      [c, cv, av],
    ]) {
      const n = !value
        ? 0
        : value === rival
          ? 50
          : !rival || wins[value] === rival
            ? 300
            : 0;
      award(
        g,
        i,
        n,
        now,
        n === 300
          ? "Winning read! +300"
          : n === 50
            ? "Matched! +50"
            : "Outplayed",
      );
      g.progress[i].reveal = { value: value || "miss", at: now };
      g.progress[i].hitAt = n ? 0 : now;
    }
  } else if (g.id === "draft") {
    const [a, c] = ids,
      av =
        g.privateChoices[a]?.beat === b.index
          ? g.privateChoices[a].value
          : undefined,
      cv =
        g.privateChoices[c]?.beat === b.index
          ? g.privateChoices[c].value
          : undefined;
    sh.cookieReveal = {
      at: now,
      round: b.index,
      values: b.values.map((n, j) => n + (j === b.lane ? sh.jackpot : 0)),
      gold: b.lane,
      picks: { [a]: av ?? null, [c]: cv ?? null },
      awards: {},
    };
    for (const [i, val] of [
      [a, av],
      [c, cv],
    ]) {
      const amount =
        val == null ? 0 : b.values[val] + (val === b.lane ? sh.jackpot : 0);
      const n = (av === cv ? Math.floor(amount / 2) : amount) * 100;
      sh.cookieReveal.awards[i] = n;
      award(g, i, n, now, av === cv ? `Shared tray +${n}` : `Cookies +${n}`);
      g.progress[i].reveal = { value: val, at: now };
    }
    sh.jackpot =
      av !== b.lane && cv !== b.lane ? Math.min(10, sh.jackpot + 2) : 2;
  }
  g.privateChoices = {};
}
function tick(g, now) {
  const sh = g.shared;
  if (sh.lastTick === now) return;
  const previousTick = sh.lastTick || g.start;
  sh.lastTick = now;
  if (["fencing", "draft"].includes(g.id))
    for (const b of g.beats) {
      if (b.index > sh.resolved && now >= g.start + b.at + b.window) {
        settleBeat(g, b, g.start + b.at + b.window);
        sh.resolved = b.index;
      }
    }
  if (g.id === "volley")
    for (const b of g.beats) {
      const due = g.start + b.at + b.window;
      if (b.index <= sh.resolved || now < due) continue;
      const ids = active(g),
        returns = ids.map((i) => g.progress[i].returnLane ?? b.boost);
      for (const [slot, i] of ids.entries()) {
        const v = g.progress[i],
          rival = ids[1 - slot];
        if (v.catchBeat === b.index && v.ballCaught)
          award(g, i, 150, due, "Returned! +150");
        else {
          if (g.progress[rival].inputs)
            award(g, rival, 300, due, "Point! +300");
          v.hitAt = due;
        }
        v.ballLane = returns[1 - slot];
        v.returnLane = null;
      }
      sh.resolved = b.index;
    }
  if (g.id === "bomb") {
    if (sh.respawnAt && now >= sh.respawnAt) {
      const ids = alive(g);
      sh.holder = ids[rnd(Math.max(1, ids.length))] ?? sh.holder;
      sh.from = sh.holder;
      sh.passedAt = 0;
      sh.flight = null;
      sh.fuseStarted = sh.respawnAt;
      sh.fuseEnd = sh.respawnAt + 5000 + rnd(1200);
      sh.respawnAt = 0;
    }
    if (!sh.fuseEnd && !sh.respawnAt) {
      sh.fuseStarted = g.start;
      sh.fuseEnd = g.start + 6000;
      sh.from = sh.holder;
    }
    if (!sh.respawnAt && now >= sh.fuseEnd && sh.explosions < 20) {
      const at = sh.fuseEnd,
        victim = sh.holder,
        holder = g.progress[victim];
      holder.health--;
      holder.hitAt = at;
      holder.feedback = "POP! Lost one heart";
      if (holder.health <= 0)
        out(g, victim, at, "Out of hearts — cheer on the others!");
      for (const i of alive(g))
        if (i !== victim) award(g, i, 180, at, "Safe! +180");
      sh.popped = {
        at,
        holder: victim,
        flight: sh.flight ? { ...sh.flight } : null,
      };
      sh.poppedAt = at;
      sh.explosions++;
      sh.respawnAt = at + R.bombPause;
      sh.fuseEnd = 0;
    }
  }
  if (g.id === "cannon") {
    const shots = sh.shots,
      events = [],
      cfg = R.cannon;
    for (const shot of shots) {
      if (shot.done) continue;
      const from = Math.max(previousTick, shot.at),
        to = Math.min(now, shot.at + cfg.life);
      if (to < from) continue;
      for (const i of alive(g)) {
        if (i === shot.owner) continue;
        const p = R.cannonPosition(g, i),
          x = shot.x + shot.dx * (from - shot.at) - p.x,
          z = shot.z + shot.dz * (from - shot.at) - p.z;
        const q = R.segmentHit(
          x,
          z,
          shot.dx,
          shot.dz,
          cfg.bodyRadius + cfg.shotRadius,
          to - from,
        );
        if (q !== null) events.push({ at: from + q, shot, target: i });
      }
    }
    for (let a = 0; a < shots.length; a++)
      for (let b = a + 1; b < shots.length; b++) {
        const x = shots[a],
          y = shots[b];
        if (x.done || y.done || x.owner === y.owner) continue;
        const from = Math.max(previousTick, x.at, y.at),
          to = Math.min(now, x.at + cfg.life, y.at + cfg.life);
        if (to < from) continue;
        const q = R.segmentHit(
          x.x + x.dx * (from - x.at) - y.x - y.dx * (from - y.at),
          x.z + x.dz * (from - x.at) - y.z - y.dz * (from - y.at),
          x.dx - y.dx,
          x.dz - y.dz,
          cfg.shotRadius * 2,
          to - from,
        );
        if (q !== null) events.push({ at: from + q, shot: x, other: y });
      }
    events.sort((a, b) => a.at - b.at);
    sh.impacts ||= [];
    for (const event of events) {
      const { shot, other, target, at } = event;
      if (
        shot.done ||
        other?.done ||
        (target !== undefined && g.progress[target].eliminatedAt)
      )
        continue;
      shot.done = at;
      const impact = {
        at,
        x: shot.x + shot.dx * (at - shot.at),
        z: shot.z + shot.dz * (at - shot.at),
        owner: shot.owner,
        target,
        points: other ? 0 : 250,
      };
      sh.impacts.push(impact);
      if (other) {
        other.done = at;
        shot.cancelled = other.cancelled = true;
      } else {
        const v = g.progress[target];
        v.health--;
        v.hitAt = at;
        v.feedback = "Direct hit! Lost one heart";
        award(g, shot.owner, 250, at, "DIRECT HIT +250");
        if (v.health <= 0) out(g, target, at, "Cannon knocked out!");
      }
    }
    for (const shot of shots)
      if (!shot.done && now >= shot.at + cfg.life)
        shot.done = shot.at + cfg.life;
    sh.shots = shots.filter((shot) => now - (shot.done || shot.at) < 1400);
    sh.impacts = sh.impacts.filter((hit) => now - hit.at < 1400).slice(-12);
  }
}
function cannonPosition(g, i) {
  return R.cannonPosition(g, i);
}
function caught(g, i, now) {
  const v = g.progress[i];
  v.running = false;
  v.distance = Math.max(0, v.distance - 60);
  v.stunnedUntil = now + 1000;
  v.hitAt = now;
  g.scores[i] = Math.round(v.distance);
  v.feedback = "CAUGHT — back 60! Wait for green.";
  v.popup = { at: now, value: -60, label: v.feedback };
}
function advance(g, i, now) {
  if (!handled(g.id)) return;
  tick(g, now);
  const v = g.progress[i];
  if (v.finished) return;
  const end = Math.min(now, g.end),
    dt = clamp(end - (v.lastTick || g.start), 0, g.duration);
  v.lastTick = end;
  v.stamina = Math.min(100, v.stamina + dt * 0.018);
  if (
    g.id === "ricochet" &&
    v.shot &&
    !v.shot.resolved &&
    end >= v.shot.at + R.archery.flight
  ) {
    v.shot.resolved = true;
    award(
      g,
      i,
      v.shot.score,
      v.shot.at + R.archery.flight,
      v.shot.score === 500
        ? "BULLSEYE +500"
        : v.shot.score
          ? "TARGET HIT +" + v.shot.score
          : "Miss — aim ahead of the target",
    );
  }
  if (g.id === "spotlight") {
    if (v.running && end >= (v.stunnedUntil || 0)) {
      const light = R.spotlight(g, end);
      if (light.color === "red") caught(g, i, end);
      else {
        v.distance = Math.min(1200, v.distance + dt * 0.08);
        g.scores[i] = Math.round(v.distance);
        if (v.distance >= 1200) finishRace(g, i, end);
      }
    }
  }
  if (g.id === "balloon") v.pressure = Math.max(0, v.pressure - dt * 0.002);
  for (const b of g.beats) {
    const due = g.start + b.at + b.window;
    if (b.index <= v.resolved || now < due) continue;
    if (g.id === "simon") {
      if (v.actedBeat !== b.index)
        award(
          g,
          i,
          b.fake && v.inputs ? 220 : 0,
          due,
          b.fake ? "Good restraint! +220" : "Missed order",
        );
    } else if (g.id === "kart") {
      if (v.lane === b.lane) {
        v.speed = 0.55;
        v.boosted = 0;
        v.hitAt = due;
      } else if (v.lane === b.boost) {
        v.speed = 1.9;
        v.boosted = 3;
        v.boostAt = due;
      } else {
        v.boosted = Math.max(0, v.boosted - 1);
        v.speed = v.boosted ? 1.9 : Math.min(1.25, v.speed + 0.2);
      }
      if (v.inputs) {
        v.distance += Math.round(v.speed * 85);
        award(
          g,
          i,
          Math.round(v.speed * 85),
          due,
          v.lane === b.lane
            ? "Barrel! Speed lost"
            : v.boosted
              ? "BOOST!"
              : "Clean gate",
        );
      }
    } else if (g.id === "rope") {
      if (v.actedBeat !== b.index) out(g, i, due, "Caught by the rope!");
    } else if (g.id === "orchard") {
      if (v.actedBeat !== b.index) {
        v.combo = 0;
        v.feedback = "Delivery missed";
      }
      v.caught = null;
    } else if (g.id === "boats") {
      if (Math.abs((v.braceAt || 0) - (g.start + b.at)) > b.window) {
        v.distance = Math.max(0, v.distance - 60);
        v.hitAt = due;
        g.scores[i] = Math.round(v.distance);
      }
    }
    v.resolved = b.index;
    if (v.finished) break;
  }
  if (g.id === "orchard") {
    const b = cue(g, now);
    if (b && now >= g.start + b.at - 300 && v.caughtBeat !== b.index) {
      v.caughtBeat = b.index;
      v.caught = v.lane === b.lane ? b.color : -1;
    }
  }
  if (g.id === "volley") {
    const b = cue(g, now);
    if (b && now >= g.start + b.at - 300 && v.catchBeat !== b.index) {
      v.catchBeat = b.index;
      v.ballCaught = v.inputs > 0 && v.lane === (v.ballLane ?? b.lane);
    }
  }
  // Survival scoring uses elapsed survival time, so eliminated players never beat a survivor.
  if (g.survival && g.id !== "cannon" && v.inputs)
    g.scores[i] = Math.max(g.scores[i], Math.floor((end - g.start) / 100));
}
function play(g, i, input, now, fail) {
  const v = g.progress[i],
    value = input.value,
    b = cue(g, now),
    id = g.id;
  if (!b) fail("This round has ended.");
  const since = now - g.start - b.at;
  const chooseOnce = (values) => {
    if (!values.includes(value)) fail("Choose one of the shown controls.", 400);
    if (v.actedBeat === b.index) fail("Wait for the next beat.");
    v.actedBeat = b.index;
  };
  if (["kart", "orchard"].includes(id) && ["left", "right"].includes(value)) {
    if (now - v.moveAt < (id === "kart" && v.boosted ? 600 : 230))
      fail("Finish steering before changing lanes again.");
    v.fromLane = v.lane;
    v.lane = clamp(v.lane + (value === "left" ? -1 : 1), 0, 2);
    v.moveAt = now;
  } else if (id === "simon") {
    chooseOnce(["left", "right", "jump", "duck"]);
    const good = !b.fake && value === b.action;
    award(
      g,
      i,
      good ? 250 + Math.round(100 * (1 - clamp(since / b.window, 0, 1))) : -150,
      now,
      good
        ? "Aye, captain!"
        : b.fake
          ? "The captain didn't say!"
          : "Wrong order!",
    );
    v.pose = value;
    v.moveAt = now;
  } else if (id === "confetti") {
    chooseOnce([0, 1, 2]);
    v.popper = value;
    v.popperAt = now;
    v.moveAt = now;
    const good = value === b.color % 3 && since >= -180 && since <= b.window;
    if (good) {
      v.combo++;
      award(
        g,
        i,
        200 + Math.min(6, v.combo) * 40,
        now,
        "CONFETTI! +" + (200 + Math.min(6, v.combo) * 40),
      );
    } else {
      v.combo = 0;
      v.hitAt = now;
      award(
        g,
        i,
        -50,
        now,
        value !== b.color % 3 ? "Wrong color!" : "Wait for READY!",
      );
    }
  } else if (id === "bomb") {
    if (!["left", "right"].includes(value))
      fail("Choose a toss direction.", 400);
    if (g.shared.respawnAt) fail("A fresh bomb is coming.");
    if (g.shared.holder !== i) fail("The bomb is with another player.");
    if (g.shared.flight && now < g.shared.flight.at + R.bombFlight)
      fail("The bomb is still in the air.");
    const players = alive(g),
      slot = players.indexOf(i),
      next =
        players[
          (slot + (value === "left" ? -1 : 1) + players.length) % players.length
        ];
    g.shared.from = i;
    g.shared.holder = next;
    g.shared.passedAt = now;
    g.shared.flight = { from: i, to: next, at: now, duration: R.bombFlight };
    v.throwAt = now;
  } else if (id === "cannon") {
    if (value !== "fire") fail("Press Fire.", 400);
    if (now - (v.fireAt || 0) < R.cannon.reload) fail("Reloading!");
    const a = angle(g, i, now),
      p = cannonPosition(g, i),
      cfg = R.cannon;
    g.shared.shots.push({
      owner: i,
      at: now,
      x: p.x + Math.cos(a) * cfg.muzzle,
      z: p.z + Math.sin(a) * cfg.muzzle,
      dx: Math.cos(a) * cfg.speed,
      dz: Math.sin(a) * cfg.speed,
    });
    v.aimPaused = (v.aimPaused || 0) + (v.fireAt ? cfg.recoil : 0);
    v.fireAt = now;
  } else if (id === "rope" || id === "rhythm") {
    const expected =
      id === "rope"
        ? b.high
          ? "duck"
          : "jump"
        : b.color % 2
          ? "right"
          : "left";
    if (id === "rhythm" && b.color === 3 && v.actedBeat !== b.index) {
      if (!["left", "right"].includes(value)) fail("Choose a drum.", 400);
      if (!v.firstDrum || v.firstDrum.beat !== b.index) {
        v.firstDrum = { beat: b.index, value, at: now };
        v.feedback = "Now the other drum!";
        return;
      }
      if (v.firstDrum.value === value || now - v.firstDrum.at > 700) {
        v.combo = 0;
        v.actedBeat = b.index;
        award(g, i, -50, now, "Use both drums together");
        return;
      }
    }
    chooseOnce(id === "rope" ? ["jump", "duck"] : ["left", "right"]);
    const good =
      since >= (id === "rope" ? -350 : -100) &&
      since <= b.window &&
      (value === expected || (id === "rhythm" && b.color === 3));
    if (good) {
      v.combo++;
      award(
        g,
        i,
        180 +
          Math.min(8, v.combo) * 20 +
          Math.round(100 * (1 - clamp(since / b.window, 0, 1))),
        now,
        "Perfect rhythm!",
      );
    } else if (id === "rope") out(g, i, now, "Tangled up! You're out");
    else {
      v.combo = 0;
      award(g, i, -50, now, "Off beat");
    }
    v.jumpAt = value === "jump" ? now : v.jumpAt;
    v.duckAt = value === "duck" ? now : v.duckAt;
    v.pose = value;
    v.moveAt = now;
  } else if (id === "stack") {
    if (value !== "drop") fail("Drop the block.", 400);
    if (now - (v.dropAt || g.start) < 700) fail("Wait for the next block.");
    const x = stackX(g, v, now),
      last = v.stack.at(-1)?.x || 0,
      overlap = v.width - Math.abs(x - last);
    v.dropAt = now;
    if (overlap <= 0.08) {
      v.finished = now;
      v.failedAt = now;
      v.feedback = "Your block missed the tower!";
      v.fallenBlock = { x, at: now };
    } else {
      v.width = overlap;
      v.step++;
      v.stack.push({ x: (x + last) / 2, dropX: x, width: overlap, at: now });
      award(g, i, 100 + Math.round(overlap * 70), now, `Level ${v.step}!`);
    }
  } else if (id === "orchard") {
    if (![0, 1, 2, 3].includes(value)) fail("Choose a fruit basket.", 400);
    if (since < -300) fail("Catch the fruit before sorting it.");
    chooseOnce([0, 1, 2, 3]);
    if (v.caught === value) {
      v.combo++;
      award(g, i, 200 + Math.min(6, v.combo) * 40, now, "Fresh delivery!");
    } else {
      v.combo = 0;
      award(g, i, -50, now, "Wrong basket or missed catch");
      v.hitAt = now;
    }
  } else if (id === "maze") {
    const offsets = { up: -5, down: 5, left: -1, right: 1 };
    if (!Object.hasOwn(offsets, value)) fail("Choose an arrow.", 400);
    const next = v.cell + offsets[value];
    if (g.maze[v.cell].includes(next)) {
      v.previousCell = v.cell;
      v.cell = next;
      v.moveAt = now;
    } else {
      v.feedback = "A wall blocks that route";
      return;
    }
    if (v.cell === v.target) {
      const elapsed = now - (v.goalAt || g.start);
      v.goalAt = now;
      v.step++;
      award(
        g,
        i,
        300 + Math.max(0, 500 - Math.floor(elapsed / 35)),
        now,
        "Flag found!",
      );
      v.target = [4, 20, 24, 0][(v.step - 1) % 4];
    }
  } else if (id === "balloon") {
    if (!["pump", "release"].includes(value)) fail("Pump or release.", 400);
    if (now - (v.pumpAt || 0) < 350) fail("Let the pump recover.");
    if (now < (v.stunnedUntil || 0)) fail("Startled! Give yourself a second.");
    v.pumpAt = now;
    if (value === "release") {
      award(
        g,
        i,
        Math.round((v.pressure * v.pressure) / 10),
        now,
        "Balloon away!",
      );
      v.released = { size: v.pressure, at: now };
      v.pressure = 0;
    } else {
      v.pressure += 12;
      if (v.pressure > 85 && rnd(100) < (v.pressure - 80) * 3) {
        v.pressure = 0;
        v.hitAt = now;
        v.stunnedUntil = now + 1000;
        v.feedback = "POP! Take a breath…";
      }
    }
  } else if (id === "spotlight") {
    if (!["run", "freeze"].includes(value)) fail("Run or freeze.", 400);
    if (value === "freeze") {
      v.running = false;
      v.feedback = "Frozen — safe while the light is red.";
    } else {
      if (now < (v.stunnedUntil || 0)) fail("Recover before running again.");
      if (R.spotlight(g, now).color === "red") caught(g, i, now);
      else {
        v.running = true;
        v.runAt = now;
        v.feedback = "Running — tap Freeze before red!";
      }
    }
  } else if (id === "boats") {
    if (!["left", "right", "brace"].includes(value))
      fail("Paddle or brace.", 400);
    if (value === "brace") {
      v.braceAt = now;
      v.feedback = "Braced for the wave";
    } else {
      if (now - (v.strokeAt || 0) < 450) fail("Finish the paddle stroke.");
      v.strokeAt = now;
      const good = value !== v.lastSide && v.stamina >= 14;
      const n = good ? 90 : 15;
      v.stamina = Math.max(0, v.stamina - 14);
      v.lastSide = value;
      v.moveAt = now;
      v.distance += n;
      award(g, i, n, now, good ? "Strong stroke!" : "Rest and alternate sides");
      if (v.distance >= 2400) finishRace(g, i, now);
    }
  } else if (id === "bakery") {
    const order = g.orders[v.order % g.orders.length];
    if (now < (v.spoiledUntil || 0)) fail("Clear the spoiled pastry first.");
    if (value === "serve") {
      if (v.cursor === 3) {
        v.order++;
        v.cursor = 0;
        v.orderAt = now;
        award(g, i, 300 + Math.min(8, v.order) * 30, now, "Order served!");
      } else {
        v.cursor = 0;
        v.spoiledUntil = now + 900;
        award(g, i, -50, now, "Finish the recipe first");
      }
    } else {
      if (![0, 1, 2, 3].includes(value)) fail("Choose an ingredient.", 400);
      if (value === order[v.cursor]) {
        v.cursor++;
        v.moveAt = now;
      } else {
        v.cursor = 0;
        v.spoiledUntil = now + 900;
        v.hitAt = now;
        award(g, i, -50, now, "Spoiled! Try the recipe again");
      }
    }
  } else if (["fencing", "draft"].includes(id)) {
    if (
      id === "draft" &&
      g.shared.cookieReveal &&
      now - g.shared.cookieReveal.at < 1100
    )
      fail("Watch both picks reveal first.");
    const opts = id === "fencing" ? ["rock", "paper", "scissors"] : [0, 1, 2];
    chooseOnce(opts);
    g.privateChoices[i] = { value, beat: b.index };
    v.feedback = "Locked in · choices reveal together";
  } else if (id === "tug") {
    if (!["pull", "rest"].includes(value)) fail("Pull or rest.", 400);
    if (value === "rest") {
      v.stamina = Math.min(100, v.stamina + 8);
      v.combo = 0;
    } else {
      if (now - (v.pullAt || 0) < 650) fail("Wait for the next pull.");
      v.pullAt = now;
      const phase = ((now - g.start) % 1600) / 1600,
        good = Math.abs(phase - 0.5) < 0.24 && v.stamina >= 20;
      v.stamina = Math.max(0, v.stamina - 20);
      v.combo = good ? v.combo + 1 : 0;
      const amount = good ? 1 + Math.min(3, v.combo) * 0.2 : 0;
      g.shared.rope += (active(g).indexOf(i) ? 1 : -1) * amount;
      award(
        g,
        i,
        Math.round(amount * 120),
        now,
        good ? "Heave!" : "Off rhythm · rest",
      );
      if (Math.abs(g.shared.rope) >= 8) {
        finishRace(g, i, now);
        for (const j of active(g)) g.progress[j].finished ||= now;
      }
    }
  } else if (id === "ricochet") {
    if (value !== "fire") fail("Loose an arrow.", 400);
    if (v.shot && now - v.shot.at < R.archery.cooldown)
      fail("Nocking the next arrow.");
    const hit = aimX(g, now),
      target = targetX(g, b, now + R.archery.flight),
      score = R.arrowScore(hit, target);
    v.shot = {
      at: now,
      hit,
      target,
      score,
      duration: R.archery.flight,
      resolved: false,
    };
    v.feedback = "Arrow away…";
  } else if (id === "volley") {
    if (![0, 1, 2].includes(value)) fail("Choose a court lane.", 400);
    if (since < -300) {
      v.fromLane = v.lane;
      v.lane = value;
      v.moveAt = now;
    } else {
      v.returnLane = value;
      v.feedback = `Return aimed ${["left", "middle", "right"][value]}`;
    }
  } else if (id === "fuse") {
    if (value === "launch") {
      if (v.rings.every((n, k) => n === g.orders[v.order][k])) {
        v.order++;
        v.rings = [0, 0, 0];
        v.launchAt = now;
        award(g, i, 400, now, "Rocket repaired!");
        if (v.order === 6) finishRace(g, i, now);
      } else {
        award(g, i, -100, now, "Circuit incomplete");
        v.hitAt = now;
      }
    } else {
      if (![0, 1, 2].includes(value)) fail("Choose a circuit ring.", 400);
      v.rings[value] = (v.rings[value] + 1) % 4;
      v.moveAt = now;
    }
  } else fail("Choose one of the shown controls.", 400);
}
function bot(g, i, now) {
  const v = g.progress[i],
    b = cue(g, now),
    id = g.id;
  if (!b) return null;
  const dt = now - g.start - b.at;
  let value;
  if (id === "simon") {
    if (b.fake || dt < 50 || v.actedBeat === b.index) return null;
    value = b.action;
  } else if (id === "confetti") {
    if (dt < 40) return null;
    value = b.color % 3;
  } else if (id === "kart") {
    const lane = b.boost !== b.lane ? b.boost : (b.lane + 1) % 3;
    if (lane === v.lane) return null;
    value = lane < v.lane ? "left" : "right";
  } else if (id === "bomb") {
    if (
      g.shared.respawnAt ||
      g.shared.holder !== i ||
      (g.shared.flight && now - g.shared.flight.at < R.bombFlight + 200)
    )
      return null;
    value = rnd(2) ? "left" : "right";
  } else if (id === "cannon") {
    const pos = cannonPosition(g, i),
      a = angle(g, i, now);
    const target = alive(g).some((j) => {
      if (i === j) return false;
      const p = cannonPosition(g, j),
        wanted = Math.atan2(p.z - pos.z, p.x - pos.x);
      return (
        Math.abs(Math.atan2(Math.sin(a - wanted), Math.cos(a - wanted))) < 0.23
      );
    });
    if (!target) return null;
    value = "fire";
  } else if (id === "rope") {
    if (dt < 50 || v.actedBeat === b.index) return null;
    value = b.high ? "duck" : "jump";
  } else if (id === "stack") {
    if (Math.abs(stackX(g, v, now) - (v.stack.at(-1)?.x || 0)) > 0.35)
      return null;
    value = "drop";
  } else if (id === "orchard") {
    if (dt < -300) {
      if (v.lane === b.lane) return null;
      value = b.lane < v.lane ? "left" : "right";
    } else value = b.color;
  } else if (id === "maze") {
    const queue = [[v.cell]],
      seen = new Set([v.cell]);
    let path;
    while (queue.length) {
      const p = queue.shift(),
        n = p.at(-1);
      if (n === v.target) {
        path = p;
        break;
      }
      for (const next of g.maze[n])
        if (!seen.has(next)) {
          seen.add(next);
          queue.push([...p, next]);
        }
    }
    value = { "-5": "up", 5: "down", "-1": "left", 1: "right" }[
      path?.[1] - v.cell
    ];
  } else if (id === "balloon") value = v.pressure >= 70 ? "release" : "pump";
  else if (id === "spotlight") {
    const green = R.spotlight(g, now).color === "green";
    if (green === !!v.running) return null;
    value = green ? "run" : "freeze";
  } else if (id === "rhythm") {
    if (dt < 40 || v.actedBeat === b.index) return null;
    value =
      b.color === 3
        ? v.firstDrum?.beat === b.index
          ? "right"
          : "left"
        : b.color % 2
          ? "right"
          : "left";
  } else if (id === "boats")
    value =
      dt >= -100 && dt < b.window
        ? "brace"
        : v.stamina < 20
          ? undefined
          : v.lastSide === "left"
            ? "right"
            : "left";
  else if (id === "bakery")
    value =
      v.cursor === 3 ? "serve" : g.orders[v.order % g.orders.length][v.cursor];
  else if (id === "fencing") value = ["rock", "paper", "scissors"][rnd(3)];
  else if (id === "tug") {
    const phase = ((now - g.start) % 1600) / 1600;
    if (phase < 0.4 || phase > 0.65) return null;
    value = v.stamina >= 25 ? "pull" : "rest";
  } else if (id === "ricochet") {
    if (
      Math.abs(aimX(g, now) - targetX(g, b, now + R.archery.flight)) > 0.4 ||
      now - (v.shot?.at || 0) < R.archery.cooldown
    )
      return null;
    value = "fire";
  } else if (id === "volley")
    value = dt < -300 ? (v.ballLane ?? b.lane) : rnd(3);
  else if (id === "draft")
    value = rnd(3); // Never inspect a rival's sealed choice.
  else if (id === "fuse") {
    value = v.rings.findIndex((n, k) => n !== g.orders[v.order][k]);
    if (value < 0) value = "launch";
  }
  if (value === undefined) return null;
  if (
    ["confetti", "fencing", "draft", "ricochet", "orchard"].includes(id) &&
    v.actedBeat === b.index
  )
    return null;
  return { value };
}
module.exports = {
  handled,
  setup,
  advance,
  play,
  bot,
  cue,
  publicView,
  finishRace,
  angle,
  stackX,
  aimX,
  targetX,
  cannonPosition,
};
