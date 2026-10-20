(() => {
  const R = PartyMidwayRules,
    esc = (s) =>
      String(s).replace(
        /[&<>"']/g,
        (c) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          })[c],
      );
  const colors = ["#79cbe8", "#ee9bbd", "#88d0a5", "#f4cc70"];
  const button = (value, label, selected = false, disabled = false) =>
    `<button data-control="${value}" aria-pressed="${selected}" ${disabled ? "disabled" : ""}>${label}</button>`;
  const ingredient = (type, n) =>
    `<i class="food-icon ${type}-${n}" aria-hidden="true"></i>`;
  function pizza(p) {
    return `<div class="pizza-picture shape-${p.shape ?? 0} ${p.shape === null ? "empty-dough" : ""}"><div class="pizza-cheese cheese-${p.cheese ?? 2}"></div>${p.toppings.map((n, i) => `<span class="pizza-topping topping-${n}" style="--n:${i}">${ingredient("topping", n)}</span>`).join("")}</div>`;
  }
  function controls(id) {
    return `<div id="midway-panel" class="midway-panel midway-${id}"></div>`;
  }
  function locked(g, v, b, stamp, i) {
    const value = b.dataset.control;
    if (g.id === "pizza")
      return (
        stamp - v.deliverAt < 650 ||
        (value === "serve"
          ? !v.ovenAt || stamp < v.ovenAt + 5000
          : value === "bake"
            ? !!v.ovenAt || v.pizza.shape === null || v.pizza.cheese === null
            : !!v.ovenAt)
      );
    if (g.id === "mine")
      return value === "sell"
        ? v.y !== 0 || !v.cargo.length
        : stamp - v.digAt < 220;
    if (g.id === "moles") return stamp < v.stunUntil;
    if (g.id === "robots") {
      const stage = R.robotStage(g, stamp);
      return (
        !stage.fighting ||
        !R.robotPairs(g, stage.index).some(
          (p) => p.length === 2 && p.includes(i),
        )
      );
    }
    if (g.id === "draft")
      return (
        !!v.locked ||
        (g.shared.cookieReveal && stamp - g.shared.cookieReveal.at < 1100)
      );
    return false;
  }
  function tick(r, stamp) {
    if (r.phase !== "playing") return;
    const g = r.game,
      i = r.players.findIndex((p) => p.id === r.you),
      v = g.progress[i],
      el = document.querySelector("#midway-panel");
    if (!el) return;
    let key = "",
      html = "";
    if (g.id === "pizza") {
      const p = v.pizza,
        t = v.ticket;
      if (!t) return;
      key = JSON.stringify([v.order, p, v.ovenAt, v.baked, v.delivery?.at]);
      html = `<div class="pizza-ticket"><div><small>CUSTOMER ${v.order + 1}</small><b>${R.shapes[t.shape]} · ${R.cheeses[t.cheese]}</b><span>${t.toppings.map((n) => R.toppings[n]).join(" + ")}</span></div>${pizza(t)}</div><div class="pizza-work"><div class="pizza-your-tray">${pizza(p)}<small>YOUR PIZZA</small></div><div class="pizza-ingredients"><div><b>1 Dough</b>${R.shapes.map((n, j) => button("shape:" + j, ingredient("shape", j) + `<span>${n}</span>`, p.shape === j)).join("")}</div><div><b>2 Cheese</b>${R.cheeses.map((n, j) => button("cheese:" + j, ingredient("cheese", j) + `<span>${n}</span>`, p.cheese === j)).join("")}</div><div><b>3 Toppings</b>${R.toppings.map((n, j) => button("topping:" + j, ingredient("topping", j) + `<span>${n}</span>`, p.toppings.includes(j))).join("")}</div></div></div><div class="pizza-actions">${button("clear", "Clear")}${button("bake", "4 · Bake 5s")}${button("serve", "5 · Serve →")}</div><div class="oven-status"><span id="oven-label">Build your pizza</span><i id="oven-fill"></i></div>${v.delivery ? `<div class="delivery-grade">Last customer: ${v.delivery.accuracy}% accurate · +${v.delivery.points}</div>` : ""}`;
    } else if (g.id === "mine") {
      const top = Math.max(0, Math.min(R.mineDepth - 6, v.y - 2));
      key = JSON.stringify([
        g.mine.revision,
        v.x,
        v.y,
        v.cargo,
        ...g.progress.map((p) => [p.x, p.y]),
      ]);
      html = `<div class="mine-status"><b>${v.y === 0 ? "SURFACE · MARKET" : `DEPTH ${v.y} · dig / move`}</b><span>${v.cargo.length}/3 CARGO · ${v.cargo.reduce((n, x) => n + R.ores[x].value, 0)} pts</span></div><div class="mine-map" aria-label="Shared mine, six visible rows">${Array.from(
        { length: 6 * R.mineWidth },
        (_, j) => {
          const x = j % R.mineWidth,
            y = top + Math.floor(j / R.mineWidth),
            k = y * R.mineWidth + x,
            c = g.mine.cells[k],
            visitors = g.active.filter(
              (n) => g.progress[n].x === x && g.progress[n].y === y,
            ),
            ore = c.ore === null ? null : R.ores[c.ore],
            adj = Math.abs(x - v.x) + Math.abs(y - v.y) === 1;
          return `<button data-control="tile:${k}" class="mine-cell ${y === 0 ? "surface" : c.hp ? "rock" : "dug"} ${adj ? "adjacent" : ""} ${x === v.x && y === v.y ? "you" : ""}" style="--depth:${y};--ore:${ore?.color || "#a08978"}" aria-label="${y === 0 ? "Surface" : ore ? ore.name + ", " + c.hp + " hits" : "Rock, " + c.hp + " hits"} at column ${x + 1}, depth ${y}">${ore ? '<i class="ore-gem"></i>' : ""}${c.hp > 1 ? `<small>${c.hp}</small>` : ""}${visitors.map((n) => `<span class="miner-token" style="--miner:${colors[n % 4]}" title="${esc(r.players[n].name)}">${n === i ? "★" : n + 1}</span>`).join("")}</button>`;
        },
      ).join("")}</div><div class="cargo-slots">${Array.from(
        { length: 3 },
        (_, n) => {
          const o = R.ores[v.cargo[n]];
          return `<span style="--ore:${o?.color || "#ad9a88"}">${o ? '<i class="ore-gem"></i>' + o.name + " " + o.value : "Empty"}</span>`;
        },
      ).join(
        "",
      )}</div><div class="mine-pad">${button("left", "←")}${button("up", "↑")}${button("down", "↓")}${button("right", "→")}${button("sell", "Sell ↑")}</div>`;
    } else if (g.id === "moles") {
      key = "mole-grid";
      html = `<div class="mole-status" id="mole-status">WHACK MOLES · LEAVE DUCKS & FLOWERS</div><div class="mole-grid">${Array.from({ length: 9 }, (_, n) => `<button class="mole-hole" data-control="${n}" aria-label="Hole ${n + 1}"><span class="mole-visitor"><span class="mole-body"><i class="mole-eye"></i><i class="mole-eye"></i><i class="mole-nose"></i><i class="mole-tooth"></i></span><span class="duck-body">●<i></i></span><span class="flower-body">✿</span></span><span class="hole-rim"></span><kbd>${n + 1}</kbd><span class="whack-star">✦</span></button>`).join("")}</div>`;
    } else if (g.id === "robots") {
      const stage = R.robotStage(g, stamp),
        pairs = R.robotPairs(g, stage.index),
        active =
          stage.fighting && pairs.some((p) => p.length === 2 && p.includes(i));
      key = JSON.stringify([
        stage.index,
        stage.fighting,
        pairs,
        r.players.length,
      ]);
      html = `<div class="robot-banner"><b>${stage.index || g.robots.single ? "GRAND FINAL" : "SEMIFINALS"}</b><span id="bout-clock"></span></div><div class="robot-matchups">${pairs.map((p) => `<div>${p.map((n) => `<span style="--player:${colors[n % 4]}">${esc(r.players[n].name)} <b data-punch-score="${n}">0</b></span>`).join("<i>vs</i>")}${p.length === 1 ? "<em>Bye to the final</em>" : ""}</div>`).join("")}</div>${active ? '<button class="punch-button" data-control="punch"><span>✦</span> PUNCH! <small>TAP RAPIDLY · SPACE</small></button>' : `<div class="robot-watch">${stage.fighting ? "Cheer for the finalists!" : stage.index || g.robots.single ? "The champion takes the stage!" : "Head pop! Finalists, get ready…"}</div>`}`;
    } else if (g.id === "draft") {
      const rev = g.shared.cookieReveal,
        reveal = rev && stamp - rev.at < 1100,
        c = g.cue;
      key = JSON.stringify([
        c?.index,
        v.locked,
        reveal,
        rev?.at,
        g.shared.jackpot,
      ]);
      const values = reveal
          ? rev.values
          : c?.values.map(
              (n, j) => n + (j === c.lane ? g.shared.jackpot : 0),
            ) ||
            rev?.values || [0, 0, 0],
        gold = reveal ? rev.gold : c?.lane;
      html = `<div class="cookie-caption"><b>${reveal ? "BOTH PICKS REVEALED" : `ROUND ${(c?.index ?? 7) + 1} / 8`}</b><span>${reveal ? "Matching picks split a tray" : v.locked ? "Your pick is sealed · waiting for reveal" : "Pick one tray secretly · each cookie = 100 points"}</span></div><div class="cookie-trays">${values
        .map(
          (n, j) =>
            `<button data-control="${j}" class="cookie-tray ${j === gold ? "golden" : ""}"><b>TRAY ${j + 1} · ${n * 100} pts</b><span class="cookie-pile">${Array.from({ length: n }, (_, k) => `<i class="cookie" style="--k:${k}">∴</i>`).join("")}</span><small>${j === gold ? "GOLD BONUS" : "COOKIE TRAY"}</small>${
              reveal
                ? `<span class="cookie-picks">${
                    g.active
                      .filter((n) => rev.picks[n] === j)
                      .map((n) => esc(r.players[n].name))
                      .join(" + ") || "Unclaimed"
                  }</span>`
                : ""
            }</button>`,
        )
        .join(
          "",
        )}</div>${reveal ? `<div class="cookie-receipts">${g.active.map((n) => `<span>${esc(r.players[n].name)} <b>+${rev.awards[n]}</b></span>`).join("")}</div>` : '<p class="cookie-tip">Pick different trays to keep the full amount. Pick the same tray to split it.</p>'}`;
    }
    if (el.dataset.key !== key) {
      el.dataset.key = key;
      el.innerHTML = html;
    }
    if (g.id === "pizza") {
      const q = v.ovenAt ? R.clamp((stamp - v.ovenAt) / 5000, 0, 1) : 0;
      el.querySelector("#oven-fill").style.width = q * 100 + "%";
      el.querySelector("#oven-label").textContent = !v.ovenAt
        ? "Build → Bake → Serve"
        : q < 1
          ? `BAKING · ${Math.ceil((v.ovenAt + 5000 - stamp) / 1000)}s`
          : "READY! Serve your customer →";
    }
    if (g.id === "moles") {
      const c = g.cue,
        stunned = stamp < v.stunUntil;
      el.querySelector("#mole-status").textContent = stunned
        ? `★ STUNNED · ${((v.stunUntil - stamp) / 1000).toFixed(1)}s ★`
        : `MOLES ONLY · STREAK ${v.combo}`;
      el.classList.toggle("is-stunned", stunned);
      el.querySelectorAll(".mole-hole").forEach((b, n) => {
        const up =
          c &&
          c.hole === n &&
          stamp >= g.start + c.at &&
          stamp < g.start + c.at + c.window &&
          v.moleHit !== c.index;
        b.classList.toggle("up", !!up);
        b.dataset.kind = c?.kind || "mole";
        b.classList.toggle("whacked", v.hammer === n && stamp - v.moveAt < 260);
      });
    }
    if (g.id === "robots") {
      const stage = R.robotStage(g, stamp);
      el.querySelector("#bout-clock").textContent = stage.fighting
        ? Math.max(0, Math.ceil((stage.end - stamp) / 1000)) + "s"
        : !g.robots.single && stage.index === 0
          ? "Final in " +
            Math.max(0, Math.ceil((stage.end - stamp) / 1000)) +
            "s"
          : "Knockout!";
      el.querySelectorAll("[data-punch-score]").forEach(
        (n) =>
          (n.textContent = g.robots.counts[+n.dataset.punchScore][stage.index]),
      );
    }
  }
  globalThis.PartyMidwayUI = { controls, tick, locked };
})();
