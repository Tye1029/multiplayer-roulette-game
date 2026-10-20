/* Shared control descriptions and presentation-only input feedback. Never scores. */
(function (root, factory) {
  const value = factory();
  if (typeof module === "object" && module.exports) module.exports = value;
  else root.PartyInteraction = value;
})(globalThis, () => {
  function controls(id, catalog) {
    const custom = {
      climb: [
        ["up", "Climb up"],
        ["left", "Climb left"],
        ["down", "Climb down"],
        ["right", "Climb right"],
      ],
      memory: [0, 1, 2, 3].map((v) => [v, ["Blue", "Pink", "Mint", "Gold"][v]]),
      fish: [["reel", "Reel"]],
      hop: [["jump", "Jump"]],
      dash: [
        ["left", "Left"],
        ["jump", "Jump"],
        ["duck", "Duck"],
        ["right", "Right"],
      ],
      lantern: [0, 1, 2, 3].map((v) => [
        v,
        ["Top left", "Top right", "Bottom left", "Bottom right"][v],
      ]),
      signal: [0, 1, 2, 3].map((v) => [v, ["Blue", "Pink", "Mint", "Gold"][v]]),
      putt: [["putt", "Putt"]],
    };
    return custom[id] || catalog.find((g) => g.id === id)?.controls || [];
  }
  function bindings(id, catalog) {
    const list = controls(id, catalog),
      map = {};
    list.forEach(([value], i) => {
      map[String(i + 1)] = value;
    });
    for (const [key, value] of Object.entries({
      ArrowLeft: "left",
      ArrowRight: "right",
      ArrowUp: "up",
      ArrowDown: "down",
    })) {
      const match =
        list.find(([v]) => v === value) ||
        list.find(
          ([v]) =>
            v === (value === "up" ? "jump" : value === "down" ? "duck" : value),
        );
      if (match) map[key] = match[0];
    }
    const primary = [
      "jump",
      "reel",
      "putt",
      "fire",
      "drop",
      "pump",
      "pull",
      "serve",
      "launch",
      "punch",
    ].find((v) => list.some(([x]) => x === v));
    if (primary) map.Space = primary;
    if (id === "band")
      for (const [i, k] of ["d", "f", "j", "k"].entries()) map[k] = i;
    if (id === "mine")
      Object.assign(map, { w: "up", a: "left", s: "down", d: "right" });
    return map;
  }
  function predict(state, value, at, previous) {
    const i = state.players.findIndex((p) => p.id === state.you),
      g = state.game,
      v = g.progress[i];
    const p = {
      game: g.id,
      start: g.start,
      at,
      value,
      fields: { pose: value, moveAt: at, last: at },
      pending: true,
    };
    if (g.id === "climb") {
      const base =
        previous?.pending && previous.start === g.start
          ? { ...v, ...previous.fields }
          : v;
      const good = value === base.next?.[0];
      p.fields.step = good
        ? Math.min(24, base.step + 1)
        : Math.max(Math.floor(base.step / 6) * 6, base.step - 2);
      if (good) p.fields.next = base.next.slice(1);
    }
    if (g.id === "maze") {
      const cell =
        previous?.pending && previous.start === g.start
          ? (previous.fields.cell ?? v.cell)
          : v.cell;
      const to = cell + ({ up: -5, down: 5, left: -1, right: 1 }[value] || 0);
      if (g.maze?.[cell]?.includes(to)) p.fields.cell = to;
    }
    if (value === "jump") p.fields.jumpAt = at;
    if (g.id === "hop")
      p.fields.hopAttempt = { index: g.cue?.index, size: g.cue?.size };
    if (g.id === "hop")
      p.fields.jumpDuration =
        globalThis.PartyExpansionRules?.waveJump(g.cue?.size) || 680;
    if (g.id === "memory" && Number.isInteger(value))
      Object.assign(p.fields, { pad: value, padAt: at });
    if (value === "duck") p.fields.duckAt = at;
    if (
      ["dash", "kart", "orchard"].includes(g.id) &&
      ["left", "right"].includes(value)
    ) {
      const from =
        previous?.pending && previous.start === g.start
          ? (previous.fields.lane ?? v.lane)
          : v.lane;
      p.fields.fromLane = from;
      p.fields.lane = Math.max(
        0,
        Math.min(2, from + (value === "left" ? -1 : 1)),
      );
    }
    if (g.id === "lantern" && Number.isInteger(value)) {
      p.fields.fromLane =
        previous?.pending && previous.start === g.start
          ? (previous.fields.chosen ?? v.chosen ?? 1)
          : (v.chosen ?? i);
      p.fields.chosen = value;
    }
    if (g.id === "bomb") p.fields.throwAt = at;
    if (g.id === "fish") p.fields.reelAt = at;
    if (g.id === "putt") p.fields.swingAt = at;
    if (g.id === "cannon") {
      p.fields.aimPaused = (v.aimPaused || 0) + (v.fireAt ? 260 : 0);
      p.fields.fireAt = at;
    }
    if (g.id === "spotlight") p.fields.running = value === "run";
    if (g.id === "boats")
      p.fields[value === "brace" ? "braceAt" : "strokeAt"] = at;
    if (g.id === "balloon") p.fields.pumpAt = at;
    return p;
  }
  function presentation(v, input) {
    if (
      input.pending ||
      input.rejected ||
      v.last !== input.serverAt ||
      !["fish", "memory", "hop", "lantern"].includes(input.game)
    )
      return v;
    // Preserve accepted pose clocks, never scores/outcomes. Hop's clearance
    // must use its authoritative curve; other feedback can keep its local clock.
    const out = { ...v };
    for (const key of ["jumpAt", "duckAt", "padAt"])
      if (
        input.fields[key] &&
        v[key] === input.serverAt &&
        input.game !== "hop"
      )
        out[key] = input.fields[key];
    if (input.game === "hop" && v.hopAttempt) {
      // The accepted curve uses the same physical clearance as the server.
      out.jumpAt = v.jumpAt;
    }
    if (input.game === "fish" && v.catch?.at === input.serverAt)
      out.reelAt = input.at;
    if (input.game === "lantern" && v.chosen === input.fields.chosen)
      out.moveAt = input.at;
    return out;
  }
  return { controls, bindings, predict, presentation };
});
