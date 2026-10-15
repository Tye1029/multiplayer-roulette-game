/* Live instructions are driven by the same visible server cue as the scene. */
globalThis.PartyFestivalUI = {
  hint(g, v, now) {
    const b = g.cue;
    if (!b) return "Final moments…";
    const dt = now - g.start - b.at,
      colors = ["BLUE", "PINK", "MINT", "GOLD"];
    switch (g.id) {
      case "simon":
        return (
          (b.fake ? "CAPTAIN: " : "CAPTAIN SAYS: ") +
          b.action.toUpperCase() +
          (dt < -600 ? " · watch…" : "!")
        );
      case "confetti":
        return `POT ${v.pot || 0} · Popper ${b.lane + 1} pays double · ${v.actedBeat === b.index ? "next draw soon" : "pick or bank"}`;
      case "kart":
        return `${Math.round(v.distance || 0)} m · ${v.boosted ? "BOOST · steering takes longer" : "green pads boost · barrels slow"}`;
      case "bomb":
        return `BOMB WITH PLAYER ${(g.active || []).indexOf(g.shared.holder) + 1} · ${Math.max(0, (g.shared.fuseEnd - now) / 1000).toFixed(1)}s · ${v.health} hearts`;
      case "cannon":
        return `${v.health} hearts · Aim at a rival · ${now - (v.fireAt || 0) < 1200 ? "reloading…" : "FIRE when lined up"}`;
      case "rope":
        return (
          (b.high ? "HIGH ROPE · DUCK" : "LOW ROPE · JUMP") +
          (dt < -350 ? " · approaching…" : " NOW!")
        );
      case "stack":
        return `LEVEL ${v.step || 0} · ${Math.round(((v.width || 3) / 3) * 100)}% landing area`;
      case "orchard":
        return dt < -300
          ? `CATCH ${["LEFT", "MIDDLE", "RIGHT"][b.lane]} · ${colors[b.color]} fruit`
          : v.caught >= 0 && v.caught != null
            ? `SORT INTO ${colors[v.caught]} BASKET!`
            : "Missed catch · get ready for the next fruit";
      case "maze":
        return `FIND THE GOLD FLAG · ${v.step || 0} flags collected`;
      case "balloon":
        return `PRESSURE ${Math.round(v.pressure || 0)}% · ${v.pressure > 80 ? "DANGER · release or risk a pop" : "pump, then release to score"}`;
      case "spotlight":
        return `${dt < -650 ? "GREEN · RUN" : dt < 0 ? "AMBER · FREEZE NOW" : "RED · DON'T MOVE"} · ${Math.round(v.distance || 0)}/1200`;
      case "rhythm":
        return `${b.color === 3 ? "BOTH DRUMS" : b.color % 2 ? "RIGHT DRUM" : "LEFT DRUM"} · ${dt < -100 ? "wait for the line…" : "HIT!"} · combo ${v.combo || 0}`;
      case "boats":
        return `${dt > -350 && dt < b.window ? "WAVE · BRACE!" : "ALTERNATE PADDLES"} · stamina ${Math.round(v.stamina)} · ${Math.round(v.distance)}/2400 m`;
      case "bakery":
        return `${v.recipe ? v.recipe.map((n) => colors[n]).join(" → ") : "RECIPE HIDDEN · remember the order"} · ${v.cursor}/3 · ${v.cursor === 3 ? "SERVE!" : "build"}`;
      case "fencing":
        return v.locked
          ? "LOCKED · rival's choice stays secret until the bell"
          : "ROCK beats SCISSORS · PAPER beats ROCK · SCISSORS beats PAPER";
      case "tug":
        return `STAMINA ${Math.round(v.stamina)} · ${Math.abs(((now - g.start) % 1600) / 1600 - 0.5) < 0.24 ? "PULL NOW!" : "wait for the gold pulse"}`;
      case "ricochet":
        return "BANK SHOT · fire when the reflected sight crosses the target";
      case "volley":
        return dt < -300
          ? `COVER ${["LEFT", "MIDDLE", "RIGHT"][v.ballLane ?? b.lane]} · ball approaching`
          : v.ballCaught
            ? "RETURN! Choose a lane to attack"
            : "Missed · get ready for the next rally";
      case "draft":
        return (
          b.values
            .map(
              (n, i) =>
                `TRAY ${i + 1}: ${n + (i === b.lane ? g.shared.jackpot : 0)}`,
            )
            .join(" · ") + (v.locked ? " · LOCKED" : "")
        );
      case "fuse":
        return `TARGET ${(v.recipe || []).map((n) => ["↑", "→", "↓", "←"][n]).join(" ")} · YOUR RINGS ${(v.rings || []).map((n) => ["↑", "→", "↓", "←"][n]).join(" ")} · ${v.order}/6`;
      default:
        return "Watch the arena";
    }
  },
};
