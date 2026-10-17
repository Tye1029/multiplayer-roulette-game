"use strict";
const { randomInt } = require("node:crypto");
const compare = (a, b) => {
  for (let k = 0; k < Math.max(a.length, b.length); k++) {
    const d = (b[k] || 0) - (a[k] || 0);
    if (d) return d;
  }
  return 0;
};
function startOrder(s, now) {
  s.phase = "order-roll";
  s.orderRolls = s.players.map(() => []);
  s.orderPending = s.players.map((_, i) => i);
  s.orderAt = now;
  s.deadline = now + 60000;
  s.log = "Roll for the opening order. Highest goes first; ties roll again.";
}
function rollOrder(s, index, now, fail) {
  if (s.phase !== "order-roll" || !s.orderPending.includes(index))
    fail("Your opening roll is already recorded.");
  const value = 1 + randomInt(6);
  s.orderRolls[index].push(value);
  s.orderPending = s.orderPending.filter((i) => i !== index);
  s.dice = {
    values: [value],
    total: value,
    at: now,
    player: s.players[index].id,
  };
  s.log = s.players[index].name + " rolled " + value + ".";
  if (!s.orderPending.length) {
    s.phase = "order-reveal";
    s.deadline = now + 3500;
  }
}
function advanceOrder(s, now, enterBoard, fail) {
  if (s.phase === "order-roll") {
    for (const i of [...s.orderPending])
      if (
        now >= s.deadline ||
        (s.players[i].bot && now >= s.orderAt + 1800 + i * 800)
      )
        rollOrder(s, i, now, fail);
  } else if (now >= s.deadline) {
    const order = s.players
      .map((_, i) => i)
      .sort((a, b) => compare(s.orderRolls[a], s.orderRolls[b]));
    const ties = order.filter((i) =>
      order.some(
        (j) => i !== j && compare(s.orderRolls[i], s.orderRolls[j]) === 0,
      ),
    );
    if (ties.length) {
      s.orderPending = ties;
      s.phase = "order-roll";
      s.orderAt = now;
      s.deadline = now + 60000;
      s.log = "A tie! The tied players roll again to settle their places.";
    } else {
      s.turnOrder = order;
      s.startingSeat = order[0];
      enterBoard(s, now);
    }
  }
}
function startFinale(s, now) {
  const categories = [
    ["Minigame maestro", "Most minigames won", "wins"],
    ["Coin collector", "Most coins earned", "coinsEarned"],
    ["Grand explorer", "Most spaces moved", "spacesMoved"],
  ];
  s.finale = {
    at: now,
    awards: categories.map(([title, description, metric]) => {
      const best = Math.max(...s.players.map((p) => p[metric] || 0));
      return {
        title,
        description,
        value: best,
        winners: best
          ? s.players.filter((p) => p[metric] === best).map((p) => p.id)
          : [],
        applied: false,
      };
    }),
  };
  s.phase = "finale";
  s.deadline = now + 30000;
  s.log =
    "Gather at the festival stage. Three bonus trophies, then the grand reveal.";
}
function advanceFinale(s, now, finish) {
  const elapsed = now - s.finale.at;
  for (const [i, award] of s.finale.awards.entries()) {
    if (!award.applied && elapsed >= 5500 + i * 6500) {
      for (const p of s.players) if (award.winners.includes(p.id)) p.trophies++;
      award.applied = true;
    }
  }
  if (elapsed >= 30000) {
    const ranked = [...s.players].sort(
      (a, b) =>
        b.trophies - a.trophies || b.total - a.total || b.tokens - a.tokens,
    );
    const tied = ranked.filter(
      (p) =>
        p.trophies === ranked[0].trophies &&
        p.total === ranked[0].total &&
        p.tokens === ranked[0].tokens,
    );
    finish(s, now, tied.length === 1 ? ranked[0].id : null);
  }
}
module.exports = {
  startOrder,
  rollOrder,
  advanceOrder,
  startFinale,
  advanceFinale,
};
