(() => {
  const esc = (s) =>
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
  let tool = "",
    toolBoard = "";
  const head = (type) => {
    const [name, path] = SafeCrackerHeistCatalog.heads[type];
    return `<svg viewBox="0 0 28 28" aria-hidden="true"><path fill-rule="evenodd" d="${path}"/></svg><small>${name}</small>`;
  };
  function controls(g, v) {
    if (["bumper", "volcano"].includes(g.id))
      return '<div class="drag-help">Drag the arena to steer · release to coast<br><small>Arrow keys / WASD also work</small></div>';
    if (
      ["math", "puzzle", "safe-panel", "safe-wires", "safe-dial"].includes(g.id)
    )
      return '<div class="expansion-panel" id="expansion-panel"></div>';
    const def = PartyCatalog.games.find((d) => d.id === g.id);
    return `<div class="action-hint" id="cue-instruction">${g.id === "band" ? "Notes cross the gold line · D F J K" : "Watch the moving target"}</div><div class="festival-controls ${g.id === "band" ? "band-pads" : ""}">${def.controls.map(([value, label], i) => `<button data-control="${value}" style="--note:${["#73c9ef", "#ef94b9", "#80d3a4", "#f7c865"][i % 4]}">${label}</button>`).join("")}</div>`;
  }
  function tick(r, stamp) {
    if (r.phase !== "playing") return;
    const g = r.game,
      i = r.players.findIndex((p) => p.id === r.you),
      v = g.progress[i],
      el = document.querySelector("#expansion-panel");
    if (!el) return;
    let html = "",
      key = "";
    if (g.id === "math") {
      const c = g.cue;
      if (!c) return;
      key = [c.index, c.reveal, v.locked, ...v.roundScores].join(":");
      html = `<div class="quiz-card"><small>QUESTION ${c.index + 1} / 5</small><strong>${esc(c.text)} = ?</strong><div class="quiz-answers">${c.choices.map((n, j) => `<button data-control="${j}" ${v.locked || c.reveal ? "disabled" : ""} class="${c.reveal && c.correct === j ? "correct" : ""}">${j + 1}. ${n}</button>`).join("")}</div><p>${c.reveal ? "Answer revealed · next card in 3 seconds" : v.locked ? "Answer locked ✓" : "Faster correct answers earn more"}</p></div><div class="quiz-totals">${r.players.map((p, j) => `<span><b>${esc(p.name)}</b> ${c.reveal ? "+" + (g.progress[j].roundScores[c.index] || 0) + " · " : ""}${g.scores[j]} total</span>`).join("")}</div>`;
    } else if (g.id === "puzzle") {
      key = v.tiles?.join(",");
      if (!v.tiles) return;
      html = `<small>SLIDE INTO THE EMPTY SQUARE · 1–8 IN ORDER</small><div class="slide-puzzle">${v.tiles
        .map((n, j) => {
          const move = v.tileMove,
            sliding = move && move.to === j && stamp - move.at < 600;
          return `<button data-control="${j}" class="${n ? "" : "empty"} ${n === j + 1 ? "placed" : ""} ${sliding ? "sliding" : ""}" ${!n ? "disabled" : ""} aria-label="${n ? "Slide tile " + n : "Empty space"}" style="--slide-x:${sliding ? ((move.from % 3) - (j % 3)) * 104 : 0}%;--slide-y:${sliding ? (Math.floor(move.from / 3) - Math.floor(j / 3)) * 104 : 0}%">${n || ""}</button>`;
        })
        .join("")}</div>`;
    } else if (g.id === "safe-panel") {
      const p = v.panel;
      if (!p?.kit) return;
      const board = g.start + ":" + v.board;
      if (toolBoard !== board || !p.kit.includes(tool)) {
        toolBoard = board;
        tool = p.kit[0];
      }
      key = board + tool + JSON.stringify(p.screws);
      html = `<small>PANEL ${Math.min(3, v.board + 1)} / 3 · MATCH THE SCREW HEAD</small><div class="screw-board">${p.screws.map((s, j) => `<button data-control="screw:${j}:${tool}" class="${s.removed ? "removed" : ""} ${s.stripped ? "stripped" : ""}" ${s.removed ? "disabled" : ""}>${head(s.type)}${s.stripped && !s.removed ? `<em>${s.turns}/3 turns</em>` : ""}</button>`).join("")}</div><div class="tool-kit">${p.kit.map((t) => `<button data-tool="${t}" aria-pressed="${tool === t}">${head(t)}</button>`).join("")}</div>`;
    } else if (g.id === "safe-wires") {
      const p = v.panel;
      if (!p?.wireColors) return;
      key = JSON.stringify([v.board, p.cardOpen, p.cut, v.faults]);
      html = `<small>PANEL ${Math.min(2, v.board + 1)} / 2 · ${v.faults || 0}/5 FAULTS</small><button class="note-toggle" data-control="card:${p.cardOpen ? "close" : "open"}">${p.cardOpen ? "Put note away" : "Read the note"}</button>${p.cardOpen ? `<ol class="wire-note">${p.instructions.map((a) => `<li class="${a.done ? "cut" : ""}" style="color:${SafeCrackerHeistCatalog.colors[a.ink]};transform:rotate(${(a.orientation - 1) * 4}deg)">${a.color.toUpperCase()}</li>`).join("")}</ol><p>Read the words, ignore the ink.</p>` : `<div class="wire-board">${p.wireLayout.order.map((c) => `<button data-control="cut:${c}" style="--wire:${SafeCrackerHeistCatalog.colors[c]}" class="${p.cut.includes(c) ? "cut" : ""}" ${p.cut.includes(c) ? "disabled" : ""}><span></span><b>${c}</b><span></span></button>`).join("")}</div>`}`;
    } else if (g.id === "safe-dial") {
      key = JSON.stringify([v.step, v.guesses]);
      html = `<small>TUMBLER ${Math.min(6, v.step + 1)} / 6</small><div class="tumbler-digits">${Array.from({ length: 10 }, (_, n) => `<button data-control="${n}">${n}</button>`).join("")}</div><div class="guess-history">${
        v.guesses
          .filter((a) => a.step === v.step)
          .map(
            (a) => `<span class="tier-${a.tier}">${a.value} · ${a.tier}</span>`,
          )
          .join("") || "Choose a digit. Warmth is measured around the dial."
      }</div>`;
    }
    if (key !== el.dataset.key) {
      el.dataset.key = key;
      el.innerHTML = html;
    }
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-tool]");
    if (b) {
      tool = b.dataset.tool;
      const p = document.querySelector("#expansion-panel");
      if (p) p.dataset.key = "";
    }
  });
  globalThis.PartyExpansionUI = { controls, tick };
})();
