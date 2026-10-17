"use strict";
const { randomInt: rnd } = require("node:crypto"),
  defs = require("../../../assets/party/midway-catalog"),
  R = require("../../../assets/party/midway-rules");
const handled = (id) => defs.some((g) => g.id === id);
function award(g, i, n, now, label) {
  g.scores[i] += n;
  Object.assign(g.progress[i], {
    popup: { at: now, value: n, label },
    feedback: label,
  });
}
function order() {
  const toppings = [0, 1, 2, 3];
  for (let n = 3; n > 0; n--) {
    const j = rnd(n + 1);
    [toppings[n], toppings[j]] = [toppings[j], toppings[n]];
  }
  return {
    shape: rnd(3),
    cheese: rnd(3),
    toppings: toppings.slice(0, 1 + rnd(3)),
  };
}
function resetPizza(v, now) {
  v.pizza = { shape: null, cheese: null, toppings: [] };
  v.ovenAt = 0;
  v.orderAt = now;
}
function setup(g) {
  g.duration = defs.find((d) => d.id === g.id).duration;
  g.end = g.start + g.duration;
  g.survival = false;
  g.secrets = {};
  if (g.id === "pizza") g.secrets.orders = Array.from({ length: 30 }, order);
  if (g.id === "mine")
    g.mine = {
      revision: 0,
      cells: Array.from({ length: R.mineWidth * R.mineDepth }, (_, k) => {
        const y = Math.floor(k / R.mineWidth);
        return {
          hp: y === 0 ? 0 : y < 5 ? 1 : y < 10 ? 2 : 3,
          ore: y && rnd(100) < 58 ? Math.min(4, Math.floor((y - 1) / 3)) : null,
        };
      }),
    };
  if (g.id === "moles")
    g.secrets.visitors = Array.from({ length: 45 }, (_, i) => ({
      index: i,
      at: 700 + i * 960,
      hole: rnd(9),
      kind: rnd(4) ? "mole" : rnd(2) ? "duck" : "flower",
      window: Math.max(590, 860 - i * 5),
    }));
  if (g.id === "robots") {
    const seats = [...g.active];
    for (let n = seats.length - 1; n > 0; n--) {
      const j = rnd(n + 1);
      [seats[n], seats[j]] = [seats[j], seats[n]];
    }
    g.robots = {
      single: seats.length <= 2,
      pairs: [seats.slice(0, 2), ...(seats.length > 2 ? [seats.slice(2)] : [])],
      counts: g.progress.map(() => [0, 0]),
      last: g.progress.map(() => [0, 0]),
      resolved: [],
      winners: [],
      final: null,
      champion: null,
    };
    g.secrets.tie = seats;
    if (g.robots.single) {
      g.duration = 20000;
      g.end = g.start + g.duration;
    }
  }
  g.progress.forEach((v, i) => {
    Object.assign(v, {
      moveAt: 0,
      hitAt: 0,
      botWait: g.id === "robots" ? 300 + rnd(180) : 370 + rnd(220),
      order: 0,
      deliverAt: 0,
      stunUntil: 0,
      moleHit: -1,
      combo: 0,
      x: 1 + i * 2,
      y: 0,
      cargo: [],
      digAt: 0,
      sold: 0,
      punchAt: 0,
    });
    resetPizza(v, g.start);
  });
}
function cue(g, now) {
  if (g.id === "moles")
    return (
      g.secrets.visitors.find(
        (b) => now - g.start >= b.at - 180 && now - g.start <= b.at + b.window,
      ) || null
    );
  return null;
}
function settleRobots(g, now) {
  const r = g.robots;
  for (let stage = 0; stage < (r.single ? 1 : 2); stage++) {
    const due = g.start + (stage === 0 ? 15000 : 38000);
    if (now < due || r.resolved.includes(stage)) continue;
    const pairs = R.robotPairs(g, stage),
      winners = [];
    for (const pair of pairs) {
      const sorted = [...pair].sort(
        (a, b) =>
          r.counts[b][stage] - r.counts[a][stage] ||
          (r.last[a][stage] || Infinity) - (r.last[b][stage] || Infinity) ||
          g.secrets.tie.indexOf(a) - g.secrets.tie.indexOf(b),
      );
      winners.push(sorted[0]);
      for (const i of pair) {
        const won = i === sorted[0],
          v = g.progress[i];
        v.robotResult = {
          stage,
          won,
          at: due,
          opponent: pair.find((j) => j !== i) ?? null,
        };
        v.feedback =
          pair.length === 1
            ? "A bye — you're in the final"
            : won
              ? "Head pop! You win!"
              : "Good fight! Cheer on the finalists.";
        g.scores[i] =
          stage === 1 || r.single
            ? (won ? 5000 : 3000) + r.counts[i][stage]
            : won
              ? 2000 + r.counts[i][stage]
              : 1000 + r.counts[i][stage];
      }
    }
    r.resolved.push(stage);
    r.winners = winners;
    if (stage === 0 && !r.single) r.final = winners;
    else r.champion = winners[0];
  }
}
function advance(g, i, now) {
  if (g.id === "robots") settleRobots(g, now);
  if (g.id === "pizza") {
    const v = g.progress[i];
    if (v.order === 0) v.orderAt = g.start;
    v.baked = !!v.ovenAt && now >= v.ovenAt + 5000;
  }
}
function play(g, i, b, now, fail) {
  const v = g.progress[i],
    value = b.value;
  advance(g, i, now);
  if (g.id === "pizza") {
    if (now - v.deliverAt < 650) fail("Let the customer take their pizza.");
    if (value === "bake") {
      if (v.ovenAt) fail("Your pizza is already in the oven.");
      if (v.pizza.shape === null || v.pizza.cheese === null)
        fail("Choose dough and cheese first.");
      v.ovenAt = now;
      v.feedback = "In the oven · five seconds";
    } else if (value === "serve") {
      if (!v.ovenAt || now < v.ovenAt + 5000)
        fail("Bake for five seconds before serving.");
      const target = g.secrets.orders[v.order % g.secrets.orders.length],
        accuracy = R.pizzaAccuracy(target, v.pizza),
        speed = Math.round(
          R.clamp(200 - (now - v.orderAt - 7000) / 100, 0, 200),
        ),
        points = Math.round((300 + speed) * accuracy);
      v.delivery = {
        pizza: structuredClone(v.pizza),
        accuracy: Math.round(accuracy * 100),
        points,
        at: now,
      };
      v.deliverAt = now;
      v.order++;
      award(
        g,
        i,
        points,
        now,
        `${Math.round(accuracy * 100)}% accurate · +${points}`,
      );
      resetPizza(v, now);
    } else if (value === "clear") {
      if (v.ovenAt) fail("Wait for this pizza to finish baking.");
      resetPizza(v, v.orderAt);
    } else {
      if (v.ovenAt) fail("The oven is busy.");
      if (typeof value !== "string") fail("Choose a pizza ingredient.", 400);
      const [type, raw] = value.split(":"),
        n = Number(raw);
      if (
        !/^[0-3]$/.test(raw || "") ||
        !["shape", "cheese", "topping"].includes(type) ||
        (type !== "topping" && n > 2)
      )
        fail("Choose a valid ingredient.", 400);
      if (type === "topping")
        v.pizza.toppings = v.pizza.toppings.includes(n)
          ? v.pizza.toppings.filter((x) => x !== n)
          : [...v.pizza.toppings, n];
      else v.pizza[type] = n;
      v.feedback = "Match the customer's ticket";
    }
    v.moveAt = now;
  } else if (g.id === "mine") {
    if (now - v.digAt < 220) fail("Finish that swing first.");
    if (value === "sell") {
      if (v.y !== 0) fail("Bring your cargo to the surface.");
      if (!v.cargo.length) fail("Collect minerals first.");
      const points = v.cargo.reduce((n, x) => n + R.ores[x].value, 0);
      v.sold += v.cargo.length;
      v.cargo = [];
      v.sellAt = now;
      award(g, i, points, now, `Cargo sold! +${points}`);
    } else {
      const dirs = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
      let d = dirs[value];
      if (typeof value === "string" && /^tile:\d+$/.test(value)) {
        const tile = Number(value.slice(5)),
          x = tile % R.mineWidth,
          y = Math.floor(tile / R.mineWidth);
        d = [x - v.x, y - v.y];
      }
      if (!d || Math.abs(d[0]) + Math.abs(d[1]) !== 1)
        fail("Dig an adjacent tile.", 400);
      const x = v.x + d[0],
        y = v.y + d[1];
      if (x < 0 || x >= R.mineWidth || y < 0 || y >= R.mineDepth)
        fail("That is the edge of the mine.");
      const cell = g.mine.cells[y * R.mineWidth + x];
      if (cell.ore !== null && v.cargo.length >= 3)
        fail("Cargo full · return to the surface and sell.");
      v.digTarget = { x, y, at: now };
      if (cell.hp > 0) {
        cell.hp--;
        g.mine.revision++;
      }
      if (!cell.hp) {
        v.from = { x: v.x, y: v.y };
        v.x = x;
        v.y = y;
        v.moveAt = now;
        if (cell.ore !== null) {
          v.cargo.push(cell.ore);
          v.feedback = `${R.ores[cell.ore].name} collected · ${v.cargo.length}/3`;
          cell.ore = null;
          g.mine.revision++;
        }
      }
    }
    v.digAt = now;
  } else if (g.id === "moles") {
    if (now < v.stunUntil)
      fail("You're stunned · wait for the stars to clear.");
    if (!Number.isInteger(value) || value < 0 || value > 8)
      fail("Choose a hole.", 400);
    const c = cue(g, now);
    v.moveAt = now;
    v.hammer = value;
    if (
      !c ||
      value !== c.hole ||
      now < g.start + c.at ||
      now > g.start + c.at + c.window
    ) {
      v.combo = 0;
      v.feedback = "Empty hole!";
      return;
    }
    if (v.moleHit === c.index) fail("That visitor has already been hit.");
    v.moleHit = c.index;
    if (c.kind !== "mole") {
      v.stunUntil = now + 2500;
      v.hitAt = now;
      v.combo = 0;
      v.feedback = "Friendly visitor! Stunned for 2.5 seconds";
    } else {
      v.combo++;
      award(g, i, 100 + Math.min(10, v.combo - 1) * 10, now, "Mole caught!");
    }
  } else if (g.id === "robots") {
    const stage = R.robotStage(g, now),
      pairs = R.robotPairs(g, stage.index);
    if (
      value !== "punch" ||
      !stage.fighting ||
      !pairs.some((p) => p.length === 2 && p.includes(i))
    )
      fail("Watch the knockout and wait for your bout.");
    if (b.stage !== stage.index) fail("That punch belongs to an earlier bout.");
    const count = b.count ?? 1;
    if (!Number.isInteger(count) || count < 1 || count > 4)
      fail("Invalid punch burst.", 400);
    const begin = g.start + (stage.index ? 23000 : 0),
      budget =
        Math.floor((now - begin) / 60) + 1 - g.robots.counts[i][stage.index];
    if (count > budget) fail("Punches are arriving too quickly.");
    g.robots.counts[i][stage.index] += count;
    g.robots.last[i][stage.index] = now;
    v.punchAt = v.moveAt = now;
    v.punches = g.robots.counts[i][stage.index];
    v.feedback = `${v.punches} punches`;
  }
}
function publicView(g, out, now, viewer) {
  delete out.secrets;
  if (g.id === "pizza")
    out.progress.forEach((v, i) => {
      v.ticket = g.secrets.orders[v.order % g.secrets.orders.length];
      v.baked = !!v.ovenAt && now >= v.ovenAt + 5000;
    });
  if (g.id === "moles") out.cue = cue(g, now);
  if (g.id === "robots") out.robots.stage = R.robotStage(g, now);
}
function route(g, v, target) {
  const width = R.mineWidth,
    start = v.y * width + v.x,
    queue = [start],
    seen = new Map([[start, null]]);
  for (let n = 0; n < queue.length; n++) {
    const k = queue[n],
      x = k % width,
      y = Math.floor(k / width);
    if (target(k, x, y)) {
      let dest = k;
      while (seen.get(dest)?.from !== start && seen.get(dest))
        dest = seen.get(dest).from;
      return seen.get(dest)?.dir || null;
    }
    for (const [dir, dx, dy] of [
      ["up", 0, -1],
      ["left", -1, 0],
      ["right", 1, 0],
      ["down", 0, 1],
    ]) {
      const nx = x + dx,
        ny = y + dy,
        next = ny * width + nx;
      if (
        nx < 0 ||
        nx >= width ||
        ny < 0 ||
        ny >= R.mineDepth ||
        seen.has(next)
      )
        continue;
      if (v.cargo.length >= 3 && g.mine.cells[next].ore !== null) continue;
      seen.set(next, { from: k, dir });
      queue.push(next);
    }
  }
  return null;
}
function bot(g, i, now) {
  const v = g.progress[i];
  if (g.id === "pizza") {
    const t = g.secrets.orders[v.order % g.secrets.orders.length];
    if (now - v.deliverAt < 700) return null;
    if (v.ovenAt) return now >= v.ovenAt + 5000 ? { value: "serve" } : null;
    if (v.pizza.shape !== t.shape) return { value: `shape:${t.shape}` };
    if (v.pizza.cheese !== t.cheese) return { value: `cheese:${t.cheese}` };
    const top = t.toppings.find((n) => !v.pizza.toppings.includes(n));
    return { value: top === undefined ? "bake" : `topping:${top}` };
  }
  if (g.id === "mine") {
    if (!v.y && v.cargo.length) return { value: "sell" };
    const returnNow =
      v.cargo.length >= 3 || (g.end - now < 12000 && v.cargo.length);
    const dir = route(g, v, (k, x, y) =>
      returnNow
        ? y === 0
        : g.mine.cells[k].ore !== null &&
          (y >= Math.min(10, 3 + i * 2) || g.end - now < 20000),
    );
    return dir ? { value: dir } : null;
  }
  if (g.id === "moles") {
    const c = cue(g, now);
    return c &&
      v.moleHit !== c.index &&
      now >= g.start + c.at + 250 &&
      now >= v.stunUntil &&
      (c.kind === "mole" || rnd(24) === 0)
      ? { value: c.hole }
      : null;
  }
  if (g.id === "robots") {
    const stage = R.robotStage(g, now);
    return stage.fighting &&
      R.robotPairs(g, stage.index).some((p) => p.length === 2 && p.includes(i))
      ? { value: "punch", count: 2 + rnd(2), stage: stage.index }
      : null;
  }
  return null;
}
module.exports = { handled, setup, cue, advance, play, publicView, bot };
