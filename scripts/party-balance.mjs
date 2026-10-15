// Exercise the real authoritative model with equally skilled bots, including items.
// This is an economy/seat-bias check, not a claim that every strategy is optimal.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomInt } from "node:crypto";
const require = createRequire(import.meta.url),
  M = require("../netlify/functions/party/model"),
  C = require("../assets/party/catalog");
const samples = Number(process.env.PARTY_SIMULATIONS || 500),
  reports = [];
for (const rounds of C.turnOptions)
  for (const count of [2, 4]) {
    const wins = Array(count).fill(0),
      moves = Array(count).fill(0),
      landings = {};
    let coins = 0,
      trophies = 0,
      bankrupt = 0,
      draws = 0;
    for (let run = 0; run < samples; run++) {
      const people = Array.from({ length: count }, (_, i) => ({
        id: String(i),
        name: "Bot " + i,
        character: C.characters[(run + i) % 8].id,
        bot: true,
        characterPicked: true,
      }));
      const s = M.create("ABC234", people[0], "party", 10000, rounds);
      people.slice(1).forEach((p) => M.join(s, p));
      M.begin(s, 10000);
      let now = 10000,
        steps = 0,
        lastEvent = "";
      while (s.phase !== "complete" && steps++ < 40000) {
        if (s.phase === "board" && !s.usedItem) {
          const p = s.players[s.turn];
          if (p.items.length) {
            const item = p.items[randomInt(p.items.length)];
            M.act(
              s,
              p.id,
              {
                action: "item",
                round: s.round,
                item,
                value: 1 + randomInt(6),
                target: s.players[(s.turn + 1) % count].id,
              },
              now,
            );
          }
        }
        const before = s.phase;
        M.advance(s, (now += 400));
        if (before === "board" && s.phase === "rolling") moves[s.turn]++;
        if (s.phase === "space" && s.event.at + ":" + s.turn !== lastEvent) {
          landings[s.event.kind] = (landings[s.event.kind] || 0) + 1;
          lastEvent = s.event.at + ":" + s.turn;
        }
        assert.ok(
          s.players.every(
            (p) =>
              Number.isInteger(p.tokens) &&
              p.tokens >= 0 &&
              Number.isInteger(p.trophies) &&
              p.trophies >= 0 &&
              p.items.length <= 3 &&
              C.spaces[p.position],
          ),
        );
      }
      assert.equal(s.phase, "complete", "stuck simulation");
      assert.equal(s.history.filter((h) => !h.tiebreak).length, rounds);
      if (s.winner) wins[Number(s.winner)]++;
      else draws++;
      for (const p of s.players) {
        coins += p.tokens;
        trophies += p.trophies;
        bankrupt += p.tokens === 0;
      }
    }
    assert.ok(
      moves.every((n) => n === samples * rounds),
      "every player receives exactly the chosen turn count",
    );
    reports.push({
      rounds,
      players: count,
      matches: samples,
      seatWinPercent: wins.map((n) => +((n / samples) * 100).toFixed(1)),
      draws,
      meanFinalCoins: +(coins / samples / count).toFixed(1),
      meanTrophies: +(trophies / samples / count).toFixed(2),
      zeroCoinPercent: +((bankrupt / samples / count) * 100).toFixed(1),
      landings,
    });
  }
console.log(
  JSON.stringify(
    {
      spaceCounts: C.spaces.reduce(
        (o, n) => ((o[n.type] = (o[n.type] || 0) + 1), o),
        {},
      ),
      reports,
    },
    null,
    2,
  ),
);
