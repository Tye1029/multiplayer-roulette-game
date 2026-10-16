/* BOARDWALK_CARNIVAL_V8 — guest rooms, authoritative matches, local presentation. */
(() => {
  "use strict";
  const C = PartyCatalog,
    S = PartyScene,
    $ = (s) => document.querySelector(s),
    app = $("#app"),
    modal = $("#modal"),
    content = $("#modal-content");
  const esc = (v) =>
    String(v ?? "").replace(
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
  const storage = {
    get: (k) => {
      try {
        return localStorage.getItem(k);
      } catch {
        return null;
      }
    },
    set: (k, v) => {
      try {
        localStorage.setItem(k, v);
      } catch {}
    },
    remove: (k) => {
      try {
        localStorage.removeItem(k);
      } catch {}
    },
  };
  let profile = null,
    room = null,
    screen = "",
    panelKey = "",
    rosterKey = "",
    offset = 0,
    polling = false,
    pollTimer,
    requestBusy = false,
    entryBusy = false,
    noticeTimer,
    lastComplete = "",
    lastCue = "",
    lastFootstep = "",
    memoryPattern = [],
    memoryAt = 0,
    network = true,
    lastFrame = 0,
    selectedSpace = null,
    inspectorDock = "top";
  let inputMode = matchMedia("(pointer: coarse)").matches
      ? "touch"
      : "keyboard",
    localInput = null,
    lastInputAt = 0,
    playSending = false,
    playQueue = [],
    selectedRoute = null;
  let sound = storage.get("boardwalk-sound") !== "off",
    motion =
      storage.get("boardwalk-motion") !== "off" &&
      !matchMedia("(prefers-reduced-motion: reduce)").matches,
    selected = "raccoon",
    overview = false,
    pendingIntent = null,
    aim = { angle: (-65 * Math.PI) / 180, power: 0.5 },
    musicOn = storage.get("boardwalk-music") !== "off",
    lastCountdown = "",
    previewObserver;
  const now = () => Date.now() + offset;
  function notify(message) {
    const box = $("#notice");
    box.textContent = message;
    box.hidden = false;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => (box.hidden = true), 6000);
  }
  const icon = (kind) =>
    '<img class="stat-icon" src="/assets/party/images/' +
    kind +
    '.svg" alt="' +
    kind +
    '">';
  const itemImage = (id) =>
    `<img class="item-image" src="/assets/party/images/items/${id}.svg" alt="${esc(C.items.find((i) => i.id === id)?.name)}">`;
  function pocket(p) {
    return `<div class="profile-pocket" aria-label="${esc(p.name)}’s items">${Array.from({ length: 3 }, (_, i) => (p.items[i] ? `<button data-item-info="${p.items[i]}" title="${esc(C.items.find((x) => x.id === p.items[i]).name)}">${itemImage(p.items[i])}</button>` : '<span class="empty-pocket" aria-label="Empty item slot">·</span>')).join("")}</div>`;
  }
  function controlsGuide(id) {
    if (id === "putt")
      return '<div class="control-guide"><strong>DRAG TO PUTT</strong><p>Press on the course, drag back in the opposite direction of your shot, then release. A longer drag means more power. Only the active player can shoot.</p></div>';
    if (["bumper", "volcano"].includes(id))
      return '<div class="control-guide"><strong>TOUCH / MOUSE / KEYBOARD</strong><p>Hold and drag in the direction you want to move. Release to coast. On a keyboard, use arrows or WASD. Avoid the danger areas.</p></div>';

    const list = PartyInteraction.controls(id, C.games),
      keys = PartyInteraction.bindings(id, C.games);
    const label = (key) =>
      ({
        ArrowUp: "↑",
        ArrowDown: "↓",
        ArrowLeft: "←",
        ArrowRight: "→",
        Space: "Space",
      })[key] || key;
    return `<div class="control-guide"><strong>${inputMode === "touch" ? "TOUCH CONTROLS" : "KEYBOARD + MOUSE"}</strong><p>${id === "putt" ? "Adjust the aim and power sliders, then " : ""}${inputMode === "touch" ? "tap the on-screen buttons:" : "click the buttons or use:"}</p><div>${list
      .map(
        ([value, name]) =>
          `<span>${
            inputMode === "touch"
              ? ""
              : `<kbd>${Object.keys(keys)
                  .filter((k) => keys[k] === value)
                  .map(label)
                  .join(" / ")}</kbd> `
          }${esc(name)}</span>`,
      )
      .join("")}</div></div>`;
  }
  function rivalCards(name = "duel-rival") {
    return `<div class="rival-cards" role="group" aria-label="Choose a rival">${room.players
      .filter((p) => p.id !== room.you)
      .map(
        (p, i) =>
          `<label class="rival-card"><input type="radio" name="${name}" value="${p.id}" ${i === 0 ? "checked" : ""}><canvas data-character="${p.character}" data-skin="${p.skin}" aria-hidden="true"></canvas><strong>${esc(p.name)}</strong><small>${p.tokens} coins · ${p.trophies} trophies</small></label>`,
      )
      .join("")}</div>`;
  }
  function chosenRival(name = "duel-rival") {
    return room.players.find(
      (p) => p.id === $(`input[name="${name}"]:checked`)?.value,
    );
  }
  function routeButtons(r) {
    return `<div class="route-choices">${(r.routePreviews || []).map((route, i) => `<button class="route-button" data-next="${route.next}" data-preview-route="${route.next}" style="--route:${i ? "#e89750" : "#8765cd"}"><b>${i ? "B" : "A"} · ${i ? C.spaces[route.next].district : "Promenade"}</b><small>Land on ${route.landings.map((id) => `${C.spaceInfo[C.spaces[id].type].name} · ${id + 1}`).join(" or ")}</small>${`<small class="${route.trophyDistance === Math.min(...r.routePreviews.map((p) => p.trophyDistance)) ? "quickest" : ""}">Trophy: ${route.trophyDistance} spaces ${route.trophyDistance === Math.min(...r.routePreviews.map((p) => p.trophyDistance)) ? "· quickest route" : ""}</small>`}${route.landings.length > 1 ? "<small>Another path choice ahead</small>" : ""}</button>`).join("")}</div>`;
  }
  function eventPanel(r, mine, turn) {
    const e = r.event,
      trophy = e.kind === "trophy-purchase",
      info = trophy ? C.spaceInfo.trophy : C.spaceInfo[e.kind];
    let body = `<div class="event-icon" style="--space:${info.color}">${info.icon}</div><span class="eyebrow">${esc(turn.name)} ${e.kind === "shop" || trophy ? "IS VISITING" : "LANDED ON"}</span><h2>${trophy ? "A trophy for your collection?" : e.kind === "shop" ? C.shops[turn.position].name : info.name}</h2>`;
    if (e.kind === "shop" || trophy)
      body += `<div class="shopkeeper"><canvas data-character="shopkeeper" aria-hidden="true"></canvas><span><b>${trophy ? "The trophy host" : "Poppy"}</b><small>${trophy ? "20 coins · your choice" : "A different selection at each store"}</small></span></div>`;
    body += `<p class="game-instructions">${esc(e.text)}</p>`;
    if (!mine)
      return body + '<p class="status-note">Their choice is coming up.</p>';
    if (e.kind === "shop")
      body += `<div class="event-shop">${C.shops[turn.position].stock
        .map((id) => C.items.find((i) => i.id === id))
        .map(
          (i) =>
            `<button data-buy-item="${i.id}" ${e.bought || me().tokens < i.cost ? "disabled" : ""}>${itemImage(i.id)}<span><strong>${i.name} <b>${icon("coin")} ${i.cost}</b></strong><small>${i.description}</small>${me().items.length === 3 ? "<small>Choose an item to replace</small>" : ""}</span></button>`,
        )
        .join("")}</div>`;
    if (e.kind === "ferry")
      body += `<button class="primary full" data-action="ride-ferry" ${me().tokens < C.ferry.cost ? "disabled" : ""}>⛴ Sail to space ${C.ferry.to + 1} · ${C.ferry.cost} coins</button>`;
    if (trophy && !e.bought)
      body += `<button class="primary full" data-action="buy-trophy" ${me().tokens < 20 ? "disabled" : ""}>${icon("trophy")} Buy trophy · 20 coins</button>${me().tokens < 20 ? '<p class="small">You need 20 coins. You can still keep going.</p>' : ""}`;
    if (e.pendingItem)
      body += `<div class="gift-offer">${itemImage(e.pendingItem)}<h3>${C.items.find((i) => i.id === e.pendingItem).name}</h3><p>Choose an item to replace:</p>${replacementButtons("accept-item", e.pendingItem)}</div>`;
    if (e.kind === "duel") {
      const rival = r.players.find((p) => p.id !== r.you),
        max = Math.min(50, me().tokens, rival.tokens);
      return (
        body +
        `<div class="duel-picker"><h3>Choose your rival</h3>${rivalCards()}<label for="duel-currency">Battle for</label><select id="duel-currency"><option value="coins">Match coins</option>${r.round >= r.rounds - 2 && me().trophies > 0 ? '<option value="trophy">One trophy each</option>' : ""}</select><label for="duel-stake">Coins each · maximum 50</label><input id="duel-stake" type="number" min="0" max="${max}" value="${Math.min(5, max)}"><button class="primary" data-challenge>Challenge this rival ↗</button><p class="small">Winner takes both stakes. A draw returns them.</p></div>`
      );
    }
    return (
      body +
      `<button class="${trophy && !e.bought ? "secondary" : "primary"} full" data-action="continue">${e.pendingItem ? "Leave this item" : e.kind === "shop" ? "Leave shop →" : trophy && !e.bought ? "Keep my coins · continue →" : "Continue →"}</button>`
    );
  }
  function replacementButtons(action, item) {
    return `<div class="replace-items">${me()
      .items.map(
        (id, i) =>
          `<button data-replace-item="${item}" data-replace-action="${action}" data-replace-index="${i}">${itemImage(id)}<span>Replace ${C.items.find((v) => v.id === id).name}</span></button>`,
      )
      .join("")}</div>`;
  }
  function tone(kind = "tap") {
    PartyAudio.set(sound, musicOn);
    PartyAudio.play(kind, me()?.character || selected);
  }
  function popup(message) {
    const host = $("#score-popups");
    if (!host) return;
    const e = document.createElement("div");
    e.className = "score-pop";
    e.textContent = message;
    host.append(e);
    setTimeout(() => e.remove(), 800);
  }
  async function api(action, data = {}) {
    const body = { action, ...data };
    if (!["get", "join", "profile", "register"].includes(action))
      body.requestId ||= crypto.randomUUID();
    let result, response, started;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        started = Date.now();
        response = await fetch("/.netlify/functions/party-action", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(12000),
        });
        result = await response.json();
        if (response.status >= 500 && attempt === 0) continue;
        break;
      } catch (e) {
        if (attempt)
          throw new Error(
            "Connection interrupted. Your seat is saved; reconnect and try again.",
          );
      }
    }
    if (!response.ok)
      throw Object.assign(new Error(result.error || "Please try again."), {
        status: response.status,
      });
    if (result.game?.serverTime) {
      const received = Date.now(),
        elapsed = received - started;
      // A cold start or timed-out attempt is not a reliable clock sample.
      // Keep the prior clock until a prompt response can synchronize it.
      if (elapsed <= 2000) {
        const sample = result.game.serverTime - (started + received) / 2;
        offset = offset ? offset * 0.7 + sample * 0.3 : sample;
      }
    }
    return result;
  }
  function portraits(root = document) {
    root
      .querySelectorAll("canvas[data-character]")
      .forEach((c) =>
        S.portrait(c, c.dataset.character, c.dataset.skin || "classic"),
      );
  }
  function openDialog(html) {
    content.innerHTML = html;
    if (!modal.open) modal.showModal();
    portraits(content);
  }
  const charChoices = (id = selected) =>
    `<div class="character-grid">${C.characters.map((c) => `<button type="button" class="character-choice" data-character-choice="${c.id}" aria-pressed="${c.id === id}"><canvas data-character="${c.id}" aria-hidden="true"></canvas><strong>${c.name}</strong><small>${c.kind}</small></button>`).join("")}</div>`;
  function header() {
    const balance = $("#coin-balance");
    balance.textContent = (profile?.coins || 0).toLocaleString();
    $("#profile-open").textContent = profile
      ? profile.name.slice(0, 1).toUpperCase()
      : "☺";
    $("#profile-open").setAttribute(
      "aria-label",
      profile ? `${profile.name}, your profile` : "Create your profile",
    );
  }
  function signup(intent) {
    pendingIntent = intent || null;
    selected = profile?.character || "raccoon";
    openDialog(
      `<span class="eyebrow">MEET YOUR NEW CREW</span><h2>Your seat is waiting.</h2><p>Pick a nickname and a character. Invite a friend, and make a little history.</p><form id="signup"><div class="field"><label for="nickname">Nickname</label><input id="nickname" name="name" type="text" minlength="2" maxlength="18" autocomplete="nickname" placeholder="What should we call you?" required></div>${charChoices()}<p class="form-error" id="form-error" role="alert"></p><button class="primary full" type="submit">Let’s play <span aria-hidden="true">↗</span></button></form><p class="small">Your guest profile is saved in this browser. Keep its cookies to keep your coins and outfits. Cross-device accounts are not available in this prototype.</p>`,
    );
  }
  function menu() {
    room = null;
    screen = "menu";
    panelKey = "";
    document.body.dataset.phase = "menu";
    app.innerHTML = `<section class="festival-hero"><img class="festival-art" src="/assets/party/images/boardwalk-crew-v2.webp" alt="Riff, Cleo, Moss and Bolt race through the sunset festival" fetchpriority="high"><div class="festival-copy"><span class="eyebrow">WELCOME TO CORAL CARNIVAL</span><h1>Big laughs.<br>Little rivalries.</h1><p>Roll into a seaside party full of shortcuts, surprises, and one-more-round moments.</p><div class="hero-buttons"><button class="primary" data-create="party">Start a party ↗</button><button class="secondary" data-open-join>Join friends</button></div><div class="hero-facts"><span>2–4 players</span><span>10 / 20 / 30 turns</span><span>Free to play</span></div></div></section><section class="mode-grid" aria-label="Choose a mode"><button class="mode-card" data-create="party"><div><span class="mode-meta">THE WHOLE ADVENTURE · 2–4 PLAYERS</span><h3>Roll with your crew.</h3><p>50 spaces. A central crossing and two scenic detours. Shops, surprises and rival showdowns.</p></div><span class="mode-arrow">↗</span></button><button class="mode-card" data-create="duel"><div><span class="mode-meta">JUST THE MINIGAMES · 1V1</span><h3>Settle the score.</h3><p>Jump into a best-of-three duel. Bring your favorite rival.</p></div><span class="mode-arrow">↗</span></button></section><section><div class="section-heading"><h2>Steal the show.</h2><p>30 games. 24 party challenges and six exclusive duels.</p></div><div class="game-grid">${C.games.map((g) => `<button class="game-card" data-rules="${g.id}"><canvas class="game-art" data-preview="${g.id}" aria-hidden="true"></canvas><div class="game-card-body"><span class="eyebrow">${g.tag}</span><h3>${g.name}</h3><p>${g.description}</p></div></button>`).join("")}</div></section><section class="crew-section"><div class="section-heading"><h2>A crew with character.</h2><p>Eight personalities. One of each per match.</p></div><div class="crew-grid">${C.characters.map((c) => `<div class="crew-card"><canvas data-character="${c.id}" aria-hidden="true"></canvas><div><h3>${c.name}</h3><span class="eyebrow">${c.kind}</span><p>${c.bio}</p></div></div>`).join("")}</div></section>`;
    previewObserver?.disconnect();
    previewObserver = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) {
            const c = e.target;
            S.render(c, c.dataset.preview, null, 2);
            previewObserver.unobserve(c);
          }
      },
      { rootMargin: "100px" },
    );
    document
      .querySelectorAll("[data-preview]")
      .forEach((c) => previewObserver.observe(c));
    portraits(app);
  }
  function joinDialog() {
    openDialog(
      `<span class="eyebrow">BETTER TOGETHER</span><h2>Find your friends.</h2><p>Enter the six-letter room code they shared with you.</p><form id="join-form"><div class="field"><label for="room-input">Room code</label><input id="room-input" type="text" inputmode="text" autocomplete="off" autocapitalize="characters" maxlength="6" pattern="[A-Za-z2-9]{6}" value="${esc(new URL(location.href).searchParams.get("room") || "")}" placeholder="ABC234" required></div><p id="form-error" class="form-error" role="alert"></p><button class="primary full">Join the party</button></form>`,
    );
  }
  async function create(mode, rounds) {
    if (!profile) {
      signup({ mode });
      return;
    }
    if (mode === "party" && !rounds) {
      openDialog(
        `<span class="eyebrow">YOUR PARTY, YOUR PACE</span><h2>How many turns?</h2><p>Everyone takes a board turn, then you play a minigame together. Choose the length for this match.</p><div class="turn-options">${C.turnOptions.map((n) => `<button class="character-choice" data-create="party" data-turns="${n}"><strong>${n} turns</strong><small>${n === 10 ? "A quick rivalry" : n === 20 ? "The full festival" : "An epic showdown"}</small></button>`).join("")}</div>`,
      );
      return;
    }
    if (entryBusy) return;
    entryBusy = true;
    let pending;
    try {
      try {
        pending = JSON.parse(storage.get("boardwalk-create"));
      } catch {}
      if (!pending || pending.mode !== mode || pending.rounds !== rounds) {
        pending = { mode, rounds, requestId: crypto.randomUUID() };
        storage.set("boardwalk-create", JSON.stringify(pending));
      }
      const r = await api("create", pending);
      storage.remove("boardwalk-create");
      modal.close();
      selectedSpace = null;
      adopt(r.game, true);
    } catch (e) {
      if (e.status && e.status < 500) storage.remove("boardwalk-create");
      throw e;
    } finally {
      entryBusy = false;
    }
  }
  async function join(code) {
    if (!profile) {
      signup({ code });
      return;
    }
    const r = await api("join", { room: code });
    modal.close();
    adopt(r.game, true);
  }
  function adopt(next, enter = false) {
    if (!next) return;
    if (room && room.id === next.id && next.revision < room.revision) return;
    const previous = room;
    room = next;
    if (
      room.phase === "choice" &&
      (previous?.phase !== "choice" || previous?.turn !== room.turn)
    ) {
      selectedRoute = null;
      selectedSpace = null;
    }
    network = true;
    storage.set("boardwalk-room", room.id);
    const url = new URL(location.href);
    url.searchParams.set("room", room.id);
    history.replaceState(null, "", url);
    const self = room.players.findIndex((p) => p.id === room.you),
      v = room.game?.progress[self];
    if (v?.pattern && v.showAt !== memoryAt) {
      memoryAt = v.showAt;
      memoryPattern = v.pattern;
    }
    if (
      previous?.game?.start === room.game?.start &&
      room.phase === "playing"
    ) {
      const before = previous.game.scores[self] || 0,
        delta = (room.game.scores[self] || 0) - before;
      const prior = previous.game.progress[self],
        current = room.game.progress[self];
      if (
        current.hitAt &&
        current.hitAt !== prior.hitAt &&
        [
          "bumper",
          "volcano",
          "safe-panel",
          "safe-wires",
          "band",
          "balloon",
        ].includes(room.game.id)
      )
        tone(
          room.game.id === "bumper"
            ? "bounce"
            : room.game.id === "balloon"
              ? "pop"
              : "error",
        );
      if (
        delta &&
        room.game.id !== "fish" &&
        (!room.game.survival || Math.abs(delta) >= 100)
      ) {
        popup(
          (delta > 0 ? "+" : "") +
            delta +
            (gameDef()?.coinGame ? " coins" : " pts"),
        );
        tone(delta > 0 ? "coin" : "error");
      }
    }
    const cue = `${room.match}:${room.round}:${room.phase}`;
    if (cue !== lastCue) {
      if (room.phase === "playing") tone("start");
      if (["rolling", "order-reveal"].includes(room.phase)) tone("roll");
      if (room.phase === "trophy-flight") {
        tone("crowd");
        tone("win");
      }
      if (room.phase === "space")
        tone(
          ["coins", "lucky", "gift"].includes(room.event?.kind)
            ? "coin"
            : "tap",
        );
      if (["round-end", "side-result", "complete"].includes(room.phase)) {
        const won =
          room.phase === "complete"
            ? room.winner === room.you
            : room.game.winners?.includes(room.you);
        tone(won ? "win" : "tap");
        setTimeout(() => tone(won ? "yes" : "aww"), 350);
      }
      if (room.phase === "space")
        tone(
          room.event?.kind === "loss"
            ? "aww"
            : ["coins", "gift", "lucky"].includes(room.event?.kind)
              ? "haha"
              : "yup",
        );
      lastCue = cue;
    }
    renderRoom();
    schedule();
    if (
      room.phase === "complete" &&
      lastComplete !== room.id + ":" + room.match
    ) {
      lastComplete = room.id + ":" + room.match;
      refreshProfile();
    }
    if (enter) app.focus({ preventScroll: true });
  }
  function schedule(delay) {
    clearTimeout(pollTimer);
    if (room)
      pollTimer = setTimeout(
        poll,
        delay ??
          (room.phase === "countdown"
            ? 180
            : room.phase === "playing"
              ? 450
              : room.phase === "walking"
                ? 400
                : 1000),
      );
  }
  async function poll() {
    if (!room || polling) return;
    if (document.hidden) {
      schedule(3000);
      return;
    }
    polling = true;
    const id = room.id;
    try {
      const r = await api("get", { room: id });
      if (room?.id === id) adopt(r.game);
    } catch (e) {
      network = false;
      const label = $("#connection");
      if (label) {
        label.classList.add("offline");
        label.lastElementChild.textContent = "Reconnecting… your seat is saved";
      }
      if (e.status === 401) {
        clearTimeout(pollTimer);
        notify("Your guest session expired. Create a profile to play again.");
        room = null;
        profile = null;
        menu();
        header();
      }
    } finally {
      polling = false;
      schedule(network ? undefined : 3000);
    }
  }
  async function refreshProfile() {
    try {
      profile = (await api("profile")).profile;
      header();
    } catch {}
  }
  const me = () => room?.players.find((p) => p.id === room.you);
  const gameDef = () => C.games.find((g) => g.id === room?.game?.id);
  function renderRoom() {
    const r = room,
      mainKey = r.phase === "waiting" ? "lobby" : "match",
      playing = [
        "playing",
        "intro",
        "countdown",
        "round-end",
        "side-result",
        "measuring",
      ].includes(r.phase);
    document.body.dataset.phase = r.phase;
    if (screen !== mainKey) {
      previewObserver?.disconnect();
      screen = mainKey;
      panelKey = "";
      rosterKey = "";
      app.innerHTML = `<div class="room-header"><div><span class="eyebrow">${r.mode === "duel" ? "QUICK DUEL" : "PARTY MATCH"} · CORAL CARNIVAL</span><h1 id="room-title"></h1></div><button class="room-code" id="share-code" title="Copy invite link">${esc(r.id)} ↗</button></div><div class="match-layout"><div><div class="scene-frame match-scene"><canvas id="party-scene" role="img" aria-label="Live three-dimensional party board and minigame"></canvas><span class="scene-badge" id="scene-label"></span><div class="scene-wallet" id="scene-wallet"></div><div class="scene-clock" id="scene-clock"></div><div id="start-count" class="start-count" aria-live="polite"></div><div id="score-popups" aria-live="polite"></div><div id="scene-controls"></div><div id="space-inspector" class="space-inspector" hidden aria-live="polite"></div><div class="scene-tools"><button data-map aria-label="Toggle whole board view" title="Whole board / follow player">⌖</button><button data-board-guide aria-label="Board space guide">?</button></div></div><div id="score-strip" class="score-strip"></div><div id="roll-order" class="roll-order"></div><p class="turn-message" id="turn-message" aria-live="polite"></p></div><aside class="side-panel"><div id="panel"></div><div class="countdown"><span id="timer-label"></span><strong class="timer" id="timer">—</strong></div><div class="round-progress" id="round-progress"></div><p class="live-status" id="connection"><i class="live-dot"></i><span>Connected · private room</span></p></aside></div>`;
    }
    $("#roll-order").innerHTML =
      r.mode === "party" && r.phase !== "waiting"
        ? `<b>Roll order</b> ${(r.turnOrder || []).map((seat, i) => `<span class="${seat === r.turn && !playing ? "current" : ""}">${i + 1}. ${esc(r.players[seat]?.name || "")}${i < r.turnIndex ? " ✓" : ""}</span>`).join(" → ")}<small>Everyone rolls, then one minigame.</small>`
        : "";
    $("#room-title").textContent =
      r.phase === "waiting"
        ? "Get the crew together."
        : r.phase === "complete"
          ? "That’s one for the history books."
          : r.phase === "finale"
            ? "The grand finale."
            : playing
              ? gameDef().name
              : `Turn ${r.round} of ${r.rounds} · Coral Carnival`;
    $("#scene-label").textContent =
      r.phase === "complete"
        ? "ONE MORE ROUND?"
        : playing
          ? r.game.sideDuel
            ? "RIVAL SHOWDOWN"
            : gameDef().tag
          : r.phase === "waiting"
            ? "YOUR SEAT IS WAITING"
            : "CORAL CARNIVAL";
    $("#turn-message").textContent = r.phase === "complete" ? "" : r.log || "";
    $("#scene-wallet").innerHTML =
      icon("coin") + "<b>" + me().tokens + "</b><span>your coins</span>";
    document.body.dataset.game = playing ? r.game.id : "board";
    $(".scene-tools").hidden =
      playing ||
      ["order-roll", "order-reveal", "finale", "complete"].includes(r.phase);
    renderSpaceInspector(playing);
    const places = C.standings(r.players, r.mode);
    const rank = r.players
      .map(
        (p) =>
          `${p.id}:${p.items.join(",")}:${p.shield}:${p.tokens}:${p.trophies}:${p.name}:${p.skin}:${p.character}:${p.characterPicked}:${places[p.id]}:${r.game?.scores[r.players.indexOf(p)]}:${r.ready.includes(p.id)}:${r.turn}:${r.phase}:${r.game?.coinAwards?.[r.players.indexOf(p)]}`,
      )
      .join("|");
    if (rank !== rosterKey) {
      $("#score-strip").style.setProperty("--players", r.players.length);
      $("#score-strip").innerHTML = r.players
        .map(
          (p, i) =>
            `<div class="score-chip ${p.id === r.you ? "you" : ""} ${i === r.turn && !playing ? "active-turn" : ""}"><canvas data-character="${p.character}" data-skin="${p.skin}" aria-hidden="true"></canvas><div><strong>${esc(p.name)}${p.id === r.you ? " · you" : ""}${p.bot ? " · bot" : ""}</strong>${r.phase !== "waiting" ? `<small class="standing">${places[p.id]}${["st", "nd", "rd", "th"][places[p.id] - 1]} place</small>` : `<small>${p.characterPicked ? C.characters.find((c) => c.id === p.character)?.name : "Choosing…"}</small>`}<span class="profile-resources">${icon("coin")}<b>${p.tokens}</b>${icon("trophy")}<b>${p.trophies}</b></span>${p.shield ? '<small class="shield-note">Shield active</small>' : ""}${r.phase === "playing" ? '<small class="live-points">' + (r.game.id === "fish" ? (r.game.progress[i].catch ? "Fish landed ✓" : "Waiting for a bite") : r.game.scores[i] + (gameDef().coinGame ? " coins collected" : " pts")) + "</small>" : ""}${["round-end", "side-result", "complete"].includes(r.phase) ? '<small class="round-coins">' + ((r.game.coinAwards?.[i] || 0) >= 0 ? "+" : "") + (r.game.coinAwards?.[i] || 0) + " coins</small>" : ""}</div>${pocket(p)}</div>`,
        )
        .join("");
      portraits($("#score-strip"));
      rosterKey = rank;
    }
    $("#round-progress").innerHTML =
      `<strong class="turns-left">${r.mode === "party" ? (r.phase === "waiting" ? `${r.rounds} turns per player` : r.phase === "complete" ? "Festival complete" : `Turn ${r.round} / ${r.rounds} · ${Math.max(0, r.rounds - r.round)} turns left after this one`) : `Minigame ${r.round} / ${r.rounds}`}</strong>` +
      Array.from(
        { length: r.rounds },
        (_, i) => `<i class="${i < r.round ? "done" : ""}"></i>`,
      ).join("");
    $("#connection").classList.toggle("offline", !network);
    $("#connection span").textContent = network
      ? "Connected · private room"
      : "Reconnecting… your seat is saved";
    const v = r.game?.progress[r.players.findIndex((p) => p.id === r.you)],
      turn = r.players[r.turn],
      mine = turn?.id === r.you,
      node = C.spaces[turn?.position || 0],
      key = [
        r.phase,
        r.orderRolls?.map((a) => a.join(",")).join("|"),
        r.finale?.awards.map((a) => a.applied).join(","),
        r.round,
        r.match,
        r.turn,
        r.ready.join(","),
        r.players.map((p) => p.character + ":" + p.characterPicked).join(","),
        r.usedItem,
        me()?.items.join(","),
        me()?.tokens,
        v?.attempts,
        !!v?.finished,
        v?.reverse,
        r.event?.bought,
        r.event?.pendingItem,
        r.event?.kind,
        r.game?.start,
        r.game?.ready?.join(","),
        r.game?.id,
      ].join(":");
    if (key !== panelKey) {
      panelKey = key;
      const panel = $("#panel");
      $("#scene-controls").replaceChildren();
      if (r.phase === "waiting")
        panel.innerHTML = `<span class="eyebrow">${r.mode === "duel" ? "ONE FRIEND. ONE RIVALRY." : "SAVE A SEAT FOR YOUR FRIENDS"}</span><h2>${r.players.length}/${r.mode === "duel" ? 2 : 4} in the party</h2><div class="room-roster">${r.players.map((p) => `<div class="person"><canvas class="person-avatar" data-character="${p.character}" data-skin="${p.skin}" aria-hidden="true"></canvas><div><div class="person-name">${esc(p.name)}${p.id === r.you ? " · you" : ""}</div><div class="person-sub">${p.bot ? "Bot · ready" : !p.characterPicked ? "Choose a character" : r.ready.includes(p.id) ? "Ready to play" : C.characters.find((c) => c.id === p.character)?.name + " · picked"}</div></div></div>`).join("")}</div><h3>Choose your character</h3><p class="small">A fresh pick every match. Each character can only join once.</p><div class="character-grid lobby-characters">${C.characters
          .map((c) => {
            const owner = r.players.find(
              (p) => p.characterPicked && p.character === c.id,
            );
            return `<button class="character-choice" data-pick-character="${c.id}" aria-pressed="${owner?.id === r.you}" ${owner && owner.id !== r.you ? "disabled" : ""}><canvas data-character="${c.id}" aria-hidden="true"></canvas><strong>${c.name}</strong><small>${owner ? (owner.id === r.you ? "Your pick ✓" : esc(owner.name)) : c.kind}</small></button>`;
          })
          .join(
            "",
          )}</div><div class="stack"><button class="secondary" data-copy>Copy invite link ↗</button><button class="primary" data-action="ready" ${!me().characterPicked ? "disabled" : ""}>${r.ready.includes(r.you) ? "Ready ✓ · undo" : "I’m ready"}</button>${r.host === r.you ? `<button class="dark-button" data-action="start" ${r.players.length < 2 || r.players.some((p) => !p.characterPicked || (!p.bot && !r.ready.includes(p.id))) ? "disabled" : ""}>Start ${r.mode === "duel" ? "duel" : "party"}</button>${r.players.length < (r.mode === "duel" ? 2 : 4) ? '<button class="quiet" data-action="add-bot">Add a bot seat</button>' : ""}` : '<p class="small">Your host starts when everyone is ready.</p>'}<button class="text-button" data-leave>Leave room</button></div><p class="status-note">${r.mode === "duel" ? "First to two minigame wins." : `${r.rounds} turns per player. Most trophies wins; total minigame points break a tie. Everyone rolls for turn order before the first round. That order lasts all match.`}</p>`;
      else if (["order-roll", "order-reveal"].includes(r.phase))
        panel.innerHTML = `<span class="eyebrow">WHO GOES FIRST?</span><h2>Roll for the order.</h2><p>Highest roll goes first. Tied players roll again.</p><div class="order-rolls">${r.players.map((p, i) => `<span><b>${esc(p.name)}</b><strong class="order-die">${r.orderRolls[i].join(" · ") || "…"}</strong></span>`).join("")}</div>${r.phase === "order-roll" && r.orderPending.includes(r.players.findIndex((p) => p.id === r.you)) ? '<button class="roll-button primary full" data-action="order-roll">Roll for turn order</button>' : '<p class="status-note">Waiting for the other opening rolls…</p>'}`;
      else if (r.phase === "selection")
        panel.innerHTML =
          '<span class="eyebrow">FESTIVAL PICKER</span><h2>What’s next?</h2><p class="selection-note">The minigame wheel is slowing down…</p>';
      else if (r.phase === "trophy-flight")
        panel.innerHTML = `<span class="eyebrow">A TROPHY FOR ${esc(turn.name)}</span><h2>Make some noise!</h2><p class="trophy-banner">${icon("trophy")} +1 trophy</p><p>The host is carrying the next trophy to a new stop.</p>`;
      else if (r.phase === "finale")
        panel.innerHTML =
          '<span class="eyebrow">THE GRAND FINALE</span><h2>One last celebration.</h2><div id="finale-card" class="finale-summary"></div><p>Three bonus trophies, then the final standings. Shared category records each receive a trophy.</p>';
      else if (r.phase === "board")
        panel.innerHTML = `<span class="eyebrow">${mine ? "YOUR TURN" : esc(turn.name) + "’S TURN"}</span><h2>${mine ? "Make your move." : "A little suspense…"}</h2><p class="game-instructions">Roll 1–6. Visit the golden beacon and choose whether to buy a trophy for 20 coins.</p>${
          mine
            ? `<button class="roll-button primary full" data-action="roll"><span class="die-icon">⚄</span> Roll ${me().triple ? "three dice" : me().double ? "two dice" : "the dice"}</button><p class="small pocket-label">YOUR POCKET · ONE ITEM BEFORE ROLLING</p><div class="inventory">${
                me().items.length
                  ? me()
                      .items.map(
                        (id) =>
                          `<button data-item="${id}" ${r.usedItem ? "disabled" : ""} title="${C.items.find((x) => x.id === id).description}">${itemImage(id)}<span>${C.items.find((x) => x.id === id).name}</span></button>`,
                      )
                      .join("")
                  : '<span class="small">Visit an item cart or find a parcel.</span>'
              }</div>${me().shield ? '<div class="shield-note">☂ Rain shield active</div>' : ""}`
            : '<p class="status-note">Watch their roll. Your turn is coming.</p>'
        }<button class="text-button small" data-board-guide>Meet the board spaces</button>`;
      else if (r.phase === "rolling")
        panel.innerHTML = `<span class="eyebrow">${esc(turn.name)} IS UP</span><h2>Let it roll.</h2><p class="status-note">A little luck. A new adventure.</p>`;
      else if (r.phase === "ferry")
        panel.innerHTML = `<span class="eyebrow">FERRY CROSSING</span><h2>Across the bay.</h2><p>${esc(turn.name)} is sailing to the opposite shore. Next player rolls after docking.</p>`;
      else if (r.phase === "walking")
        panel.innerHTML = `<span class="eyebrow">ON THE MOVE</span><h2>${esc(turn.name)} rolled ${r.dice?.values.join(" + ")}.</h2><p class="game-instructions">${r.movement.remaining ? "A crossroads is coming up." : "Let’s see where this lands."}</p><div class="travel-dots">${Array.from({ length: r.lastMove?.path.length - 1 || 1 }, () => "<i></i>").join("")}</div>`;
      else if (r.phase === "choice")
        panel.innerHTML = `<span class="eyebrow">${mine ? "YOUR CHOICE" : esc(turn.name) + " IS CHOOSING"}</span><h2>A fork in the fun.</h2><p class="game-instructions">${r.movement.remaining} spaces left. Colored rings show where each route ends.</p>${mine ? routeButtons(r) : "<p>Watch their choice.</p>"}`;
      else if (r.phase === "space") {
        panel.innerHTML = eventPanel(r, mine, turn);
      } else if (r.phase === "intro")
        panel.innerHTML = `<div class="briefing"><span class="eyebrow">${r.game.sideDuel ? "RIVAL SHOWDOWN" : gameDef().coinGame ? "KEEP EVERY COIN" : "UP NEXT"}</span><h2>${gameDef().name}</h2><p class="game-instructions">${gameDef().rules}</p><div class="ready-roster">${r.players
          .filter((p) => r.game.participants.includes(p.id))
          .map(
            (p) =>
              `<span class="${r.game.ready.includes(p.id) ? "is-ready" : ""}">${esc(p.name)} ${r.game.ready.includes(p.id) ? "✓" : "…"}</span>`,
          )
          .join(
            "",
          )}</div>${r.game.participants.includes(r.you) ? `<button class="primary full" data-action="game-ready" ${r.game.ready.includes(r.you) ? "disabled" : ""}>${r.game.ready.includes(r.you) ? "Ready ✓ · waiting for friends" : "I’m ready — let’s play"}</button>` : "<p>Cheer on the two rivals!</p>"}<p class="small">Everyone ready starts the countdown. Otherwise we start after 60 seconds.</p></div>`;
      else if (r.phase === "countdown")
        panel.innerHTML = `<h2>${gameDef().name}</h2><p>Get ready! Starting together…</p><p class="game-instructions">${gameDef().rules}</p>`;
      else if (r.phase === "playing") {
        const active = r.game.participants.includes(r.you);
        panel.innerHTML = `<span class="eyebrow">${r.game.sideDuel ? "RIVAL SHOWDOWN" : gameDef().tag}</span><h2>${gameDef().name}</h2><p class="game-instructions">${gameDef().rules}</p><div class="game-tip"><span>${gameDef().description}</span><button data-rules="${r.game.id}" aria-label="Minigame rules">?</button></div><div class="controls">${!active ? '<div class="reward-pill">Cheer on your friends!</div>' : v.finished ? '<div class="reward-pill">Your round is complete ✓</div><p class="status-note">Watch the others finish.</p>' : controls(r.game.id, v)}</div><div class="game-feedback" id="feedback" aria-live="polite"></div>`;
      } else if (r.phase === "measuring")
        panel.innerHTML =
          '<span class="eyebrow">THE BIG MEASURE</span><h2>Whose catch is longest?</h2><p class="game-instructions">One fish each. Watch the measuring boards reveal the sizes.</p><div id="fish-measurements" class="measurements"></div>';
      else if (r.phase === "board-end")
        panel.innerHTML =
          '<span class="eyebrow">THE CREW IS READY</span><h2>Minigame time!</h2><p class="game-instructions">New game. Fresh rivalries. Everyone is in.</p>';
      else if (r.phase === "side-result")
        panel.innerHTML = `<span class="eyebrow">RIVAL SHOWDOWN</span><h2>${esc(r.event.text)}</h2>${ranking(true)}<p class="status-note">Results stay for 5 seconds · then back to the board.</p>`;
      else if (r.phase === "round-end")
        panel.innerHTML = `<span class="eyebrow">ROUND ${r.round} COMPLETE</span><h2>${r.tieAgain ? "One last showdown." : "That was a good round."}</h2>${ranking(true)}<p class="status-note">${r.tieAgain ? "The leaders are tied. One final minigame decides it." : "Take a breather · your next round starts after 5 seconds."}</p>`;
      else if (r.phase === "complete") {
        const winner = r.players.find((p) => p.id === r.winner);
        panel.innerHTML = `<span class="eyebrow">${winner?.id === r.you ? "YOU DID THAT." : "THAT’S A WRAP."}</span><h2>${winner ? esc(winner.name) + " takes the crown." : "Honors shared."}</h2>${ranking()}<div class="stack"><button class="primary" data-action="rematch" ${r.ready.includes(r.you) ? "disabled" : ""}>${r.ready.includes(r.you) ? "Rematch requested ✓" : "One more round?"}</button><button class="text-button" data-leave>Back to the boardwalk</button></div>`;
      } else
        panel.innerHTML =
          '<span class="eyebrow">A FRESH START</span><h2>This room has closed.</h2><p class="status-note">Start a new festival with your friends.</p><button class="primary" data-leave>Back to the boardwalk</button>';
      if (["intro", "countdown", "playing"].includes(r.phase))
        panel.insertAdjacentHTML("beforeend", controlsGuide(r.game.id));
      const overlay = $("#scene-controls"),
        controlNode =
          panel.querySelector(".controls") ||
          panel.querySelector(".roll-button") ||
          panel.querySelector(".route-choices");
      if (controlNode) overlay.append(controlNode);
      if (r.phase === "measuring") overlay.append($("#fish-measurements"));
      if (
        ["intro", "countdown", "playing"].includes(r.phase) &&
        r.game?.sideDuel &&
        r.game.participants.every(
          (id) => r.players.find((p) => p.id === id)?.bot,
        )
      )
        panel.insertAdjacentHTML(
          "beforeend",
          '<button class="secondary full" data-action="skip-bots">Skip bot showdown → Results</button>',
        );
      portraits(panel);
      portraits(overlay);
    }
    if ($("#feedback")) $("#feedback").textContent = v?.feedback || "";
    showArrows(v?.next || []);
    $("#timer-label").textContent =
      r.phase === "waiting"
        ? "Room stays open"
        : r.phase === "complete"
          ? "Party complete"
          : r.phase === "playing"
            ? "Time remaining"
            : ["board", "choice", "space"].includes(r.phase)
              ? "Your turn"
              : "Next up";
    PartyPlayInput.bind($("#party-scene"), () => room, submitPlay, now, aim);
    if (C.games.find((g) => g.id === r.game?.id)?.engine === "expansion")
      PartyExpansionUI.tick(r, now());
    pendingControls();
  }
  function showArrows(next) {
    const el = $("#next-arrows");
    if (!el || el.dataset.sequence === next.join(",")) return;
    el.dataset.sequence = next.join(",");
    el.innerHTML = next
      .map(
        (x, i) =>
          `<span style="animation-delay:${i * 35}ms" aria-label="${x}">${{ up: "↑", down: "↓", left: "←", right: "→" }[x]}</span>`,
      )
      .join("");
  }
  function controls(id, v) {
    const def = C.games.find((g) => g.id === id);
    if (def?.engine === "expansion")
      return PartyExpansionUI.controls(room.game, v);
    if (def?.engine === "festival")
      return (
        '<div class="action-hint" id="cue-instruction">Watch the arena</div><div class="festival-controls">' +
        def.controls
          .map(
            ([value, label]) =>
              '<button data-control="' + value + '">' + label + "</button>",
          )
          .join("") +
        "</div>"
      );
    if (id === "climb")
      return `<div id="next-arrows" class="next-arrows" aria-label="Upcoming arrows"></div><div class="arrow-grid"><button data-direction="up" aria-label="Climb up">↑</button><button data-direction="left" aria-label="Climb left">←</button><button data-direction="down" aria-label="Climb down">↓</button><button data-direction="right" aria-label="Climb right">→</button></div>`;
    if (id === "memory")
      return `${v.reverse ? '<div class="reverse-cue">↶ REPEAT IN REVERSE</div>' : ""}<div class="memory-grid">${["Blue", "Pink", "Mint", "Gold"].map((x, i) => `<button class="memory-pad" data-pad="${i}">${i + 1} · ${x}</button>`).join("")}</div><p id="memory-status" class="small" style="text-align:center;margin-top:8px">Watch the pattern</p><button class="text-button full" data-replay>Watch again</button>`;
    if (id === "fish")
      return '<div class="action-hint" id="cue-instruction">Watch your bobber</div><button class="primary" id="reel" data-control="reel">Reel!</button>';
    if (["cascade", "dash"].includes(id))
      return `<div class="action-hint" id="cue-instruction">${id === "cascade" ? "Catch coins · dodge spike balls" : "Dodge barrels · jump hurdles · duck flags"}</div><div class="lane-controls"><button data-control="left" aria-label="Move left">←</button>${id === "dash" ? '<button data-control="jump">Jump</button><button data-control="duck">Duck</button>' : ""}<button data-control="right" aria-label="Move right">→</button></div>`;
    if (id === "hop")
      return '<div class="action-hint" id="cue-instruction">Jump at the gold line</div><button class="primary" data-control="jump">Jump!</button>';
    if (["lantern", "signal"].includes(id))
      return `<div class="action-hint" id="cue-instruction">Watch the signal</div><div class="color-controls">${["Blue", "Pink", "Mint", "Gold"].map((c, i) => `<button data-control="${i}" style="--pad:${["#98d8f0", "#f2a5c5", "#9bdfb5", "#f7d675"][i]}">${i + 1} · ${c}</button>`).join("")}</div>`;
    return '<div class="putt-hint" id="putt-status">Drag back on the course and release to putt. Longer drag = more power.</div>';
  }
  function boardGuide() {
    openDialog(
      `<span class="eyebrow">CORAL CARNIVAL</span><h2>Every space has a story.</h2><div class="space-guide">${Object.entries(
        C.spaceInfo,
      )
        .map(
          ([id, i]) =>
            `<div><span style="background:${i.color}">${i.icon}</span><p><strong>${i.name}</strong><br>${i.description}</p></div>`,
        )
        .join(
          "",
        )}</div><p>Roll 1–6. Choose paths at three crossroads. The Harbor Loop is always open; the ferry crosses to the opposite shore for four coins. Collect trophies at the golden beacon for 20 coins. Most trophies after your selected number of turns wins; minigame points break a tie.</p>`,
    );
  }
  function ranking(round = false) {
    const r = room,
      list = r.players
        .map((p, i) => ({
          ...p,
          score: r.game?.scores[i] || 0,
          resultPlace: r.game?.placements?.[i] || 0,
        }))
        .filter(
          (p) =>
            !round || !r.game?.sideDuel || r.game.participants.includes(p.id),
        )
        .sort((a, b) =>
          round
            ? (a.resultPlace || 99) - (b.resultPlace || 99) || b.score - a.score
            : b.trophies - a.trophies ||
              b.total - a.total ||
              b.tokens - a.tokens,
        );
    return `<div class="results-list">${list
      .map((p, i) => {
        const idx = r.players.findIndex((x) => x.id === p.id),
          coins = r.game?.coinAwards?.[idx] || 0,
          trophies = r.game?.trophyAwards?.[idx] || 0;
        return `<div class="result-row"><span class="place">${round ? p.resultPlace || i + 1 : C.standings(r.players, r.mode)[p.id]}</span><canvas data-character="${p.character}" aria-hidden="true"></canvas><span class="person-name">${esc(p.name)}${round ? `<small class="coin-award">${icon("coin")} ${coins >= 0 ? "+" : ""}${coins} coins${trophies ? " · " + (trophies > 0 ? "+" : "") + trophies + " trophy" : ""}</small>` : `<small class="coin-award">${icon("coin")} ${p.tokens} coins · ${p.total} pts</small>`}</span><b>${round ? p.score + (gameDef().unit === "cm" ? " cm" : gameDef().coinGame ? " coins" : " pts") : icon("trophy") + p.trophies}</b></div>`;
      })
      .join("")}</div>`;
  }
  function pendingControls() {
    const panel = app;
    if (!room) return;
    panel.setAttribute("aria-busy", String(requestBusy));
    panel
      .querySelectorAll(
        "[data-pick-character],[data-action],[data-route],[data-item],[data-buy-item],[data-direction],[data-replay],[data-leave],[data-next],[data-opponent],[data-challenge],[data-control]",
      )
      .forEach((b) => {
        if (requestBusy && !b.disabled) {
          b.dataset.pending = "true";
          b.disabled = true;
        } else if (!requestBusy && b.dataset.pending) {
          delete b.dataset.pending;
          b.disabled = false;
        }
      });
  }
  function setInputMode(mode) {
    if (mode === inputMode) return;
    inputMode = mode;
    document.querySelectorAll(".control-guide").forEach((node) => {
      if (room?.game) node.outerHTML = controlsGuide(room.game.id);
    });
  }
  function submitPlay(data) {
    const r = room,
      at = now();
    if (
      !r ||
      r.phase !== "playing" ||
      at >= r.game.end ||
      at < r.game.start ||
      modal.open
    )
      return;
    const v = r.game.progress[r.players.findIndex((p) => p.id === r.you)];
    if (
      v.finished ||
      !r.game.participants.includes(r.you) ||
      at - lastInputAt < 140 ||
      playQueue.length >= 3
    )
      return;
    lastInputAt = at;
    localInput = PartyInteraction.predict(r, data.value, at, localInput);
    const prediction = localInput;
    if (data.value !== "steer")
      tone(
        {
          rope: "jump",
          hop: "jump",
          rhythm: "drum",
          cannon: "cannon",
          boats: "paddle",
          stack: "block",
          basket: "bounce",
          baseball: "bat",
          "safe-panel": "tool",
          "safe-wires": "tool",
          "safe-dial": "tool",
          puzzle: "block",
          math: "tap",
          band: "drum",
        }[r.game.id] || "tap",
      );
    playQueue.push({
      at,
      prediction,
      body: {
        room: r.id,
        match: r.match,
        round: r.round,
        game: r.game.id,
        start: r.game.start,
        ...data,
      },
    });
    drainPlays();
  }
  async function drainPlays() {
    if (playSending) return;
    playSending = true;
    try {
      while (playQueue.length) {
        const input = playQueue.shift(),
          b = input.body;
        if (
          room?.id !== b.room ||
          room?.match !== b.match ||
          room?.game?.start !== b.start ||
          room.phase !== "playing" ||
          now() - input.at > 1000
        ) {
          input.prediction.rejected = true;
          continue;
        }
        try {
          const result = await api("play", b);
          input.prediction.pending = false;
          if (room?.id === b.room && result.game) adopt(result.game);
        } catch (error) {
          input.prediction.rejected = true;
          if (error.status === 409) schedule(0);
          else notify(error.message);
        }
      }
    } finally {
      playSending = false;
    }
  }
  async function roomAction(action, data = {}) {
    if (action === "play") return submitPlay(data);
    if (requestBusy || !room) return;
    if (action === "play" && now() >= room.game?.end) {
      schedule(0);
      return;
    }
    requestBusy = true;
    pendingControls();
    const id = room.id;
    try {
      const r = await api(action, {
        room: id,
        match: room.match,
        round: room.round,
        game: room.game?.id,
        start: room.game?.start,
        preparedAt: room.game?.preparedAt,
        ...data,
      });
      if (room?.id === id && r.game) adopt(r.game);
      const feedback =
        r.game?.game?.progress[
          r.game.players.findIndex((p) => p.id === r.game.you)
        ]?.feedback || "";
      tone(
        action === "play"
          ? /Slip|Miss|away|slipped/.test(feedback)
            ? "error"
            : room?.game?.id === "fish"
              ? "splash"
              : {
                  cannon: "cannon",
                  confetti: "pop",
                  bomb: "pop",
                  kart: "boost",
                  rhythm: "drum",
                  rope: "jump",
                  stack: "block",
                  boats: "paddle",
                }[room?.game?.id] || "good"
          : "tap",
      );
    } catch (error) {
      // A round can end while an input is in flight. Reconcile immediately
      // instead of leaving expired controls visible until the next poll.
      if (error.status === 409) schedule(0);
      throw error;
    } finally {
      requestBusy = false;
      pendingControls();
    }
  }
  function profileDialog() {
    if (!profile) {
      signup();
      return;
    }
    openDialog(
      `<span class="eyebrow">YOUR LITTLE LEGACY</span><h2>${esc(profile.name)}</h2><p>Every good rivalry starts with a first round.</p><div class="stat-grid"><div><strong>${profile.stats.played}</strong><span>PARTIES PLAYED</span></div><div><strong>${profile.stats.wins}</strong><span>VICTORIES</span></div><div><strong>${profile.stats.earned}</strong><span>COINS EARNED</span></div></div><h3>Your rivalries</h3>${profile.rivals.length ? profile.rivals.map((r) => `<div class="rival"><strong>${esc(r.name)}</strong><span>${r.wins} wins / ${r.played} parties</span></div>`).join("") : "<p>Play a match with a friend to start your rivalry record.</p>"}<h3 style="margin-top:24px">Your next entrance</h3>${charChoices(profile.character)}<p class="small">This is your profile portrait. Choose your match character in each room. Your guest profile is saved on this browser only.</p>`,
    );
  }
  async function wardrobe() {
    if (!profile) {
      signup({ wardrobe: true });
      return;
    }
    await refreshProfile();
    openDialog(
      `<span class="eyebrow">THE BOARDWALK WARDROBE</span><h2>A little more you.</h2><p>You have <strong>${profile.coins} shop coins</strong>. Every outfit works on all four characters. Earn 12 coins for active play and 8 more for winning, up to 200 per day.</p><div class="shop-grid">${C.skins
        .map((s) => {
          const owned = profile.owned.includes(s.id);
          return `<article class="outfit-card"><canvas data-character="${profile.character}" data-skin="${s.id}" aria-hidden="true"></canvas><h3>${s.name}</h3><p>${s.description}</p><button data-skin="${s.id}" ${profile.skin === s.id || (!owned && profile.coins < s.price) ? "disabled" : ""}>${profile.skin === s.id ? "Equipped ✓" : owned ? "Equip outfit" : "Unlock · " + s.price + " coins"}</button></article>`;
        })
        .join(
          "",
        )}</div><p class="small" style="margin-top:20px">Outfits are cosmetic. Shop coins stay in your profile; match tokens reset each match. Coin packs and real-money purchases are not part of this prototype.</p>`,
    );
  }
  function settings() {
    openDialog(
      `<span class="eyebrow">MAKE YOURSELF COMFORTABLE</span><h2>Your settings.</h2><label class="settings-row" for="sound"><span>Game sounds</span><input type="checkbox" id="sound" ${sound ? "checked" : ""}></label><label class="settings-row" for="music"><span>Quiet festival music</span><input type="checkbox" id="music" ${musicOn ? "checked" : ""}></label><label class="settings-row" for="motion"><span>Animated scenery</span><input type="checkbox" id="motion" ${motion ? "checked" : ""}></label><p class="small" style="margin-top:20px">Use touch or your keyboard. Arrow keys climb, 1–4 select lights, and Space reels or putts. Controls never change your character’s abilities.</p>`,
    );
  }
  function how() {
    openDialog(
      `<span class="eyebrow">A DAY AT CORAL CARNIVAL</span><h2>Bring your favorite rival.</h2><p><strong>Party Match:</strong> 2–4 players, 10, 20, or 30 turns per player. Roll dice, choose paths, and visit item carts. Stop at the glowing trophy host and choose whether to buy one for 10 match coins. Minigames award coins, not trophies; trophy-staked 1v1 duels transfer the staked trophies. In collection games, everyone keeps their coins.</p><p><strong>Quick Duel:</strong> 1v1 minigames. First to two wins takes the match. A tied series is settled with Circuit Sprint.</p><p><strong>Winning:</strong> Most trophies wins a party. Placement points (1,000 / 650 / 400 / 250 per minigame) break a tie; if those are equal, two tied players enter Circuit Sprint; larger ties enter Rooftop Rally.</p><p><strong>Items:</strong> Buy single-use double/triple dice, a chosen roll, a position swap, a Trophy Taxi, skates or a shield. Carry up to three; replace an item when buying or receiving a new one. Use one item before rolling. Each store has different stock. Visiting a cart pauses your walk, and you always move onward after leaving.</p><p><strong>Your profile:</strong> Earn coins for cosmetic outfits. Board tokens cannot be purchased. No cash prizes, paid entries, or chip deposits are offered.</p><p><strong>Need to reconnect?</strong> Reload this page on the same browser. Board turns have a timer, so friends can keep playing during an interruption.</p>`,
    );
  }
  async function copy() {
    const url = new URL("/party.html", location.origin);
    url.searchParams.set("room", room.id);
    try {
      await navigator.clipboard.writeText(url.href);
      notify("Invite link copied. Send it to your crew.");
    } catch {
      openDialog(
        `<h2>Invite your crew.</h2><label for="invite-url">Select and copy this link</label><input id="invite-url" type="text" readonly value="${esc(url.href)}">`,
      );
      $("#invite-url").select();
    }
  }
  async function leave() {
    if (room && !["waiting", "complete", "expired"].includes(room.phase)) {
      notify(
        "Your match is still active. Your seat will be here when you reconnect.",
      );
      return;
    }
    if (room && room.phase !== "expired")
      await api("leave", { room: room.id, match: room.match });
    clearTimeout(pollTimer);
    storage.remove("boardwalk-room");
    const url = new URL(location.href);
    url.searchParams.delete("room");
    history.replaceState(null, "", url);
    document.body.dataset.phase = "menu";
    menu();
    await refreshProfile();
  }
  function renderSpaceInspector(playing = false) {
    const el = $("#space-inspector");
    if (!el) return;
    const n = C.spaces[selectedSpace],
      info = n && C.spaceInfo[n.type];
    el.hidden = playing || !info;
    if (!info) return;
    el.style.setProperty("--space", info.color);
    el.dataset.dock = inspectorDock;
    el.innerHTML = `<button data-close-space aria-label="Close space details">×</button><strong><span>${info.icon}</span> ${info.name}</strong><small>Space ${n.id + 1} · ${n.district}</small><p>${info.description}${n.type === "trophy" && room?.goal !== n.id ? " The trophy is currently at another stop." : ""}</p>`;
  }
  document.addEventListener("pointerup", (e) => {
    if (e.target.id !== "party-scene" || document.body.dataset.game !== "board")
      return;
    const id = S.spaceAt(e.target, e.clientX, e.clientY);
    if (id === null) return;
    selectedSpace = id;
    const bounds = e.target.getBoundingClientRect();
    inspectorDock =
      e.clientY - bounds.top < bounds.height / 2 ? "bottom" : "top";
    renderSpaceInspector();
  });
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("button");
    if (!b || b.disabled) return;
    if (e.detail > 0 && Date.now() - Number(b.dataset.directAt || 0) < 1000)
      return;
    try {
      if (b.classList.contains("modal-close")) {
        modal.close();
        return;
      }
      if (b.dataset.create) {
        await create(b.dataset.create, Number(b.dataset.turns) || undefined);
        return;
      }
      if (b.hasAttribute("data-open-join")) {
        joinDialog();
        return;
      }
      if (b.id === "settings-open") {
        settings();
        return;
      }
      if (b.id === "how-open") {
        how();
        return;
      }
      if (b.id === "profile-open") {
        profileDialog();
        return;
      }
      if (b.id === "wardrobe-open" || b.hasAttribute("data-wardrobe")) {
        await wardrobe();
        return;
      }
      if (b.dataset.pickCharacter) {
        await roomAction("pick-character", {
          character: b.dataset.pickCharacter,
        });
        return;
      }
      if (b.hasAttribute("data-close-space")) {
        selectedSpace = null;
        renderSpaceInspector();
        return;
      }
      if (b.dataset.inspectSpace !== undefined) {
        selectedSpace = Number(b.dataset.inspectSpace);
        modal.close();
        renderSpaceInspector();
        return;
      }
      if (b.dataset.characterChoice) {
        selected = b.dataset.characterChoice;
        if (profile && $("#signup") === null) {
          await api("character", { character: selected });
          await refreshProfile();
        }
        content
          .querySelectorAll("[data-character-choice]")
          .forEach((x) =>
            x.setAttribute(
              "aria-pressed",
              x.dataset.characterChoice === selected,
            ),
          );
        return;
      }
      if (b.dataset.rules) {
        const g = C.games.find((g) => g.id === b.dataset.rules);
        openDialog(
          `<span class="eyebrow">${g.tag}</span><h2>${g.name}</h2><p>${g.rules}</p>${controlsGuide(g.id)}<p class="small">Find this minigame in Party Match or Quick Duel. Everyone gets the same rules and time limit.</p>`,
        );
        return;
      }
      if (b.dataset.skin) {
        b.disabled = true;
        await api(
          profile.owned.includes(b.dataset.skin) ? "equip" : "purchase",
          { skin: b.dataset.skin },
        );
        await wardrobe();
        tone("good");
        return;
      }
      if (b.id === "share-code" || b.hasAttribute("data-copy")) {
        await copy();
        return;
      }
      if (b.hasAttribute("data-leave")) {
        await leave();
        return;
      }
      if (b.hasAttribute("data-map")) {
        overview = !overview;
        b.setAttribute("aria-pressed", String(overview));
        return;
      }
      if (b.hasAttribute("data-board-guide")) {
        boardGuide();
        return;
      }
      if (b.dataset.next !== undefined) {
        await roomAction("choose", { next: Number(b.dataset.next) });
        return;
      }
      if (b.dataset.opponent) {
        await roomAction("challenge", { opponent: b.dataset.opponent });
        return;
      }
      if (b.dataset.action) {
        await roomAction(b.dataset.action);
        return;
      }
      if (b.dataset.route) {
        await roomAction("move", { route: b.dataset.route });
        return;
      }
      if (b.hasAttribute("data-challenge")) {
        await roomAction("challenge", {
          opponent: chosenRival()?.id,
          currency: $("#duel-currency").value,
          stake:
            $("#duel-currency").value === "trophy"
              ? 1
              : Number($("#duel-stake").value),
        });
        return;
      }
      if (b.dataset.control !== undefined) {
        const value = /^[0-9]$/.test(b.dataset.control)
          ? Number(b.dataset.control)
          : b.dataset.control;
        await roomAction("play", { value });
        return;
      }
      if (b.dataset.useSpecial) {
        const item = b.dataset.useSpecial;
        await roomAction("item", {
          item,
          value: Number($("#item-number")?.value),
          target: chosenRival("item-target")?.id,
        });
        modal.close();
        return;
      }
      if (b.dataset.item) {
        if (["custom", "swap"].includes(b.dataset.item)) {
          const item = b.dataset.item;
          openDialog(
            `<h2>${C.items.find((x) => x.id === item).name}</h2>${
              item === "custom"
                ? '<label for="item-number">Choose your roll</label><input id="item-number" type="number" min="1" max="6" value="6">'
                : `<h3>Choose a rival</h3>${rivalCards("item-target")}`
            }<button class="primary" data-use-special="${item}">Use item</button>`,
          );
          return;
        }
        await roomAction("item", { item: b.dataset.item });
        return;
      }
      if (b.dataset.itemInfo) {
        const item = C.items.find((i) => i.id === b.dataset.itemInfo);
        openDialog(
          `${itemImage(item.id)}<h2>${item.name}</h2><p>${item.description}</p>`,
        );
        return;
      }
      if (b.dataset.replaceItem) {
        await roomAction(b.dataset.replaceAction, {
          item: b.dataset.replaceItem,
          replace: Number(b.dataset.replaceIndex),
        });
        if (modal.open) modal.close();
        return;
      }
      if (b.dataset.buyItem) {
        if (me().items.length === 3) {
          const item = C.items.find((i) => i.id === b.dataset.buyItem);
          openDialog(
            `${itemImage(item.id)}<h2>Make room for ${item.name}</h2><p>Choose an item to replace. The purchase costs ${item.cost} coins.</p>${replacementButtons("buy-item", item.id)}`,
          );
          return;
        }
        await roomAction("buy-item", { item: b.dataset.buyItem });
        return;
      }
      if (b.dataset.direction) {
        await roomAction("play", { value: b.dataset.direction });
        return;
      }
      if (b.dataset.pad !== undefined) {
        await roomAction("play", { value: Number(b.dataset.pad) });
        return;
      }
      if (b.hasAttribute("data-replay")) {
        await roomAction("play", { value: "replay" });
        return;
      }
      if (b.hasAttribute("data-putt")) {
        await roomAction("play", { ...aim });
        return;
      }
    } catch (error) {
      notify(error.message);
      if ($("#form-error")) $("#form-error").textContent = error.message;
    } finally {
      if (b.dataset.skin) b.disabled = false;
    }
  });
  document.addEventListener("submit", async (e) => {
    if (!["signup", "join-form"].includes(e.target.id)) return;
    e.preventDefault();
    const submit = e.target.querySelector("button[type=submit],button.primary");
    submit.disabled = true;
    try {
      if (e.target.id === "signup") {
        profile = (
          await api("register", {
            name: $("#nickname").value,
            character: selected,
          })
        ).profile;
        header();
        modal.close();
        const intent = pendingIntent;
        pendingIntent = null;
        if (intent?.mode) await create(intent.mode);
        if (intent?.code) await join(intent.code);
        if (intent?.wardrobe) await wardrobe();
      } else await join($("#room-input").value.trim().toUpperCase());
    } catch (error) {
      if ($("#form-error")) $("#form-error").textContent = error.message;
      else notify(error.message);
    } finally {
      submit.disabled = false;
    }
  });
  document.addEventListener("input", (e) => {
    if (e.target.id === "aim") {
      aim.angle = (Number(e.target.value) * Math.PI) / 180;
      $("#aim-value").textContent = e.target.value + "°";
    }
    if (e.target.id === "power") {
      aim.power = Number(e.target.value) / 100;
      $("#power-value").textContent = e.target.value + "%";
    }
  });
  document.addEventListener("change", (e) => {
    if (e.target.name === "duel-rival" || e.target.id === "duel-currency") {
      const op = chosenRival(),
        trophy = $("#duel-currency").value === "trophy",
        input = $("#duel-stake");
      input.disabled = trophy;
      input.max = Math.min(50, me().tokens, op.tokens);
      input.value = Math.min(Number(input.value), Number(input.max));
      $("[data-challenge]").disabled = trophy && op.trophies < 1;
    }
    if (e.target.id === "music") {
      musicOn = e.target.checked;
      storage.set("boardwalk-music", musicOn ? "on" : "off");
      PartyAudio.set(sound, musicOn);
    }
    if (e.target.id === "sound") {
      sound = e.target.checked;
      storage.set("boardwalk-sound", sound ? "on" : "off");
      tone();
    }
    if (e.target.id === "motion") {
      motion = e.target.checked;
      storage.set("boardwalk-motion", motion ? "on" : "off");
    }
  });
  document.addEventListener("pointerdown", (e) => {
    setInputMode(e.pointerType === "touch" ? "touch" : "keyboard");
    const b = e.target.closest(
      "[data-control],[data-direction],[data-pad],[data-putt]",
    );
    if (
      !b ||
      b.disabled ||
      room?.phase !== "playing" ||
      modal.open ||
      e.button > 0
    )
      return;
    b.dataset.directAt = Date.now();
    b.classList.remove("input-pulse");
    void b.offsetWidth;
    b.classList.add("input-pulse");
    const raw = b.dataset.control ?? b.dataset.direction ?? b.dataset.pad;
    submitPlay(
      b.hasAttribute("data-putt")
        ? { ...aim }
        : { value: /^[0-9]$/.test(raw) ? Number(raw) : raw },
    );
  });
  for (const event of ["pointerover", "focusin"])
    document.addEventListener(event, (e) => {
      const button = e.target.closest("[data-preview-route]");
      if (button) selectedRoute = Number(button.dataset.previewRoute);
    });
  document.addEventListener("keydown", (e) => {
    if (
      modal.open ||
      room?.phase !== "playing" ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName) ||
      e.repeat
    )
      return;
    setInputMode("keyboard");
    const value = PartyInteraction.bindings(room.game.id, C.games)[
      e.code === "Space" ? "Space" : e.key
    ];
    const b =
      value === undefined
        ? null
        : room.game.id === "climb"
          ? $(`[data-direction="${value}"]`)
          : room.game.id === "memory"
            ? $(`[data-pad="${value}"]`)
            : room.game.id === "putt"
              ? $("#putt")
              : $(`[data-control="${value}"]`);

    if (b) {
      e.preventDefault();
      b.click();
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && room) schedule(0);
  });
  addEventListener("online", () => {
    if (room) schedule(0);
  });
  function frame(time) {
    requestAnimationFrame(frame);
    if (
      document.hidden ||
      time - lastFrame < (room?.phase === "playing" ? 15 : 33)
    )
      return;
    lastFrame = time;
    const stamp = now(),
      r = room,
      kind =
        r &&
        [
          "intro",
          "countdown",
          "playing",
          "round-end",
          "side-result",
          "measuring",
        ].includes(r.phase)
          ? r.game?.id
          : "board";
    S.render($("#party-scene"), kind, r, stamp / 1000, {
      aim,
      pattern: memoryPattern,
      overview,
      motion,
      selectedSpace,
      selectedRoute,
      localInput,
    });
    if (!r) return;
    if (r.phase === "finale" && $("#finale-card")) {
      const age = stamp - r.finale.at,
        index = Math.floor((age - 2500) / 6500),
        award = r.finale.awards[index];
      const key = index + ":" + !!award?.applied;
      if ($("#finale-card").dataset.key !== key) {
        $("#finale-card").dataset.key = key;
        $("#finale-card").innerHTML =
          age < 2500
            ? "<h3>The bonus trophies…</h3><p>Who made their mark on the festival?</p>"
            : award
              ? `<small>${award.description}</small><h3>${award.title}</h3><p>${award.applied ? award.winners.map((id) => esc(r.players.find((p) => p.id === id).name)).join(" & ") || "No winner this time" : "And the trophy goes to…"}</p>${award.applied ? `<b>${award.value} · +1 trophy each</b>` : ""}`
              : "<h3>And the festival champion is…</h3><p>Counting every trophy.</p>";
        if (award?.applied) {
          tone("crowd");
          tone("win");
        }
      }
    }
    PartyExpansionUI.tick(r, stamp);
    if (r.game?.id === "band") PartyAudio.band?.(r, stamp);
    else PartyAudio.band?.(null, stamp);
    if (r.phase === "playing" && r.game.id === "putt") {
      const p = r.game.putt,
        active = r.players[p.turn],
        remaining = Math.max(
          0,
          Math.ceil((r.game.start + p.offset + 30000 - stamp) / 1000),
        );
      const el = $("#putt-status");
      if (el)
        el.textContent = `${active.name} · course ${Math.min(3, p.course + 1)} / 3 · ${remaining}s · ${active.id === r.you ? "Drag back and release to putt" : "Watch their shot"}`;
    }
    if (r.phase === "measuring" && $("#fish-measurements")) {
      const q = Math.min(
        1,
        Math.max(0, (stamp - r.game.measureAt - 500) / 4000),
      );
      $("#fish-measurements").innerHTML = r.players
        .filter((p) => r.game.participants.includes(p.id))
        .map((p) => {
          const v = r.game.progress[r.players.indexOf(p)];
          return `<div><b>${esc(p.name)}</b><span>${v.catch ? Math.round(v.catch.length * q) + " cm" : "No catch"}</span><i style="--measure:${(((v.catch?.length || 0) * q) / 120) * 100}%"></i></div>`;
        })
        .join("");
    }
    if (r.phase === "walking" && r.lastMove) {
      const step = Math.floor((stamp - r.lastMove.at) / 440),
        key =
          r.match +
          ":" +
          r.round +
          ":" +
          r.turn +
          ":" +
          r.lastMove.at +
          ":" +
          step;
      if (
        key !== lastFootstep &&
        step >= 0 &&
        stamp < r.lastMove.at + r.lastMove.duration
      ) {
        lastFootstep = key;
        tone("step");
      }
    }
    if ($("#dice-readout"))
      $("#dice-readout").textContent =
        stamp - r.dice.at > 1150
          ? r.dice.values.join(" + ")
          : ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"][Math.floor(stamp / 90) % 6];
    const timer = $("#timer");
    if (timer)
      timer.textContent =
        r.phase === "complete"
          ? "✓"
          : Math.max(0, Math.ceil((r.deadline - stamp) / 1000)) + "s";
    const clock = $("#scene-clock");
    if (clock) {
      clock.hidden = !["playing", "intro", "countdown"].includes(r.phase);
      const end =
        r.phase === "playing" && r.game.id === "putt"
          ? r.game.start + r.game.putt.offset + 30000
          : r.phase === "playing" && r.game.id === "math"
            ? r.game.start + r.game.cue.at + (r.game.cue.reveal ? 13000 : 10000)
            : r.deadline;
      clock.textContent =
        (r.phase === "intro" ? "AUTO START · " : "") +
        Math.max(0, Math.ceil((end - stamp) / 1000)) +
        "s";
    }
    const big = $("#start-count"),
      n = Math.ceil((r.deadline - stamp) / 1000);
    if (big) {
      const show =
        (r.phase === "countdown" && stamp < r.game.start) ||
        (r.phase === "playing" && stamp - r.game.start < 700);
      big.textContent = show
        ? r.phase === "countdown"
          ? Math.max(1, n)
          : "GO!"
        : "";
      if (show && lastCountdown !== big.textContent) {
        lastCountdown = big.textContent;
        tone(r.phase === "countdown" ? "count" : "start");
      }
    }
    if (r.phase === "playing") {
      if (stamp >= r.game.end) {
        document.querySelectorAll(".controls button").forEach((b) => {
          b.disabled = true;
        });
        return;
      }
      const v = r.game.progress[r.players.findIndex((p) => p.id === r.you)];
      if (
        r.game.id === "climb" &&
        $("#next-arrows") &&
        localInput?.pending &&
        !localInput.rejected &&
        localInput.start === r.game.start &&
        localInput.fields.next
      )
        showArrows(localInput.fields.next);
      if (r.game.id === "memory") {
        const a = Math.floor((stamp - v.showAt) / 650),
          watch = stamp < v.showAt + memoryPattern.length * 650 + 300;
        document.querySelectorAll("[data-pad]").forEach((p) => {
          p.disabled = watch || requestBusy;
          p.classList.toggle(
            "flash",
            a >= 0 &&
              a < memoryPattern.length &&
              memoryPattern[a] === Number(p.dataset.pad) &&
              (stamp - v.showAt) % 650 < 460,
          );
        });
        if ($("#memory-status"))
          $("#memory-status").textContent = watch
            ? "Watch… then repeat."
            : `Your turn · ${v.cursor || 0}/${v.level} lights`;
      }
      if ($("#putt")) {
        const rolling = !!(v.shot && stamp < v.shot.at + v.shot.duration + 450);
        $("#putt").disabled = requestBusy || rolling;
        $("#putt").textContent = rolling
          ? "Ball is rolling…"
          : "Putt · course " + Math.min(3, v.attempts + 1) + " of 3";
      }
      if ($("#reel"))
        $("#reel").disabled = requestBusy || v.actedBeat === r.game.cue?.index;
      document.querySelectorAll("[data-control]").forEach((b) => {
        const id = r.game.id;
        let locked = false;
        if (id === "math") locked = v.locked || r.game.cue?.reveal;
        if (id === "puzzle") locked = b.classList.contains("empty");
        if (id === "safe-panel") locked = b.classList.contains("removed");
        if (id === "safe-wires") locked = b.classList.contains("cut");
        if (id === "safe-dial") locked = stamp - (v.checkAt || 0) < 700;
        if (id === "basket") locked = v.shot && stamp - v.shot.at < 1550;
        if (id === "baseball") locked = v.actedBeat === r.game.cue?.index;
        b.disabled = requestBusy || !!v.finished || !!locked;
      });
      if (["fish", "hop", "signal"].includes(r.game.id))
        document
          .querySelectorAll("[data-control]")
          .forEach(
            (b) =>
              (b.disabled =
                requestBusy ||
                v.actedBeat === r.game.cue?.index ||
                !!v.finished),
          );
      if (gameDef().engine === "festival") {
        const id = r.game.id,
          own = r.players.findIndex((p) => p.id === r.you);
        document.querySelectorAll("[data-control]").forEach((b) => {
          const value = b.dataset.control;
          let waiting = false;
          if (id === "bomb") {
            waiting =
              r.game.shared.holder !== own ||
              stamp < (r.game.shared.respawnAt || 0) ||
              stamp - r.game.shared.passedAt < PartyRules.bombFlight;
            const alive = r.game.active.filter(
                (i) => !r.game.progress[i].eliminatedAt,
              ),
              slot = alive.indexOf(own),
              to =
                alive[
                  (slot + (value === "left" ? -1 : 1) + alive.length) %
                    alive.length
                ];
            b.textContent =
              (value === "left" ? "← " : "") +
              "Toss to " +
              (r.players[to]?.name || "neighbor") +
              (value === "right" ? " →" : "");
          }
          if (["simon", "confetti", "fencing", "draft", "rope"].includes(id))
            waiting ||= v.actedBeat === r.game.cue?.index;
          if (id === "tug" && value === "pull")
            waiting ||= stamp - (v.pullAt || 0) < 650;
          if (id === "boats" && value !== "brace")
            waiting ||= stamp - (v.strokeAt || 0) < 450;
          if (id === "balloon")
            waiting ||=
              stamp - (v.pumpAt || 0) < 350 || stamp < (v.stunnedUntil || 0);
          if (id === "kart")
            waiting ||= stamp - v.moveAt < (v.boosted ? 600 : 230);
          if (id === "cannon")
            waiting ||= stamp - (v.fireAt || 0) < PartyRules.cannon.reload;
          if (id === "ricochet")
            waiting ||= stamp - (v.shot?.at || 0) < PartyRules.archery.cooldown;
          if (id === "spotlight") {
            waiting ||=
              value === "run" && (stamp < (v.stunnedUntil || 0) || v.running);
            b.setAttribute(
              "aria-pressed",
              String(value === (v.running ? "run" : "freeze")),
            );
          }
          if (id === "stack")
            waiting ||= stamp - (v.dropAt || r.game.start) < 700;
          if (id === "orchard" && /^[0-3]$/.test(value))
            waiting ||=
              stamp < r.game.start + r.game.cue?.at - 300 ||
              v.actedBeat === r.game.cue?.index;
          b.disabled ||= waiting;
        });
      }
      if (r.game.id === "lantern") {
        const falling =
          r.game.lanternLast && stamp - r.game.lanternLast.at < 1100;
        const layout = (falling
          ? r.game.lanternLast.layout
          : r.game.cue?.layout) || [0, 1, 2, 3];
        document.querySelectorAll("[data-control]").forEach((b) => {
          const i = Number(b.dataset.control),
            c = layout[i];
          b.textContent = `${i + 1} · ${["Blue", "Pink", "Mint", "Gold"][c]}`;
          b.style.setProperty(
            "--pad",
            ["#98d8f0", "#f2a5c5", "#9bdfb5", "#f7d675"][c],
          );
          b.disabled ||= falling || stamp - (v.moveAt || 0) < 420;
        });
      }
      const cue = r.game.cue,
        hint = $("#cue-instruction");
      if (hint && gameDef().engine === "festival")
        hint.textContent = PartyFestivalUI.hint(r.game, v, stamp, r.players);
      if (hint && cue && gameDef().engine !== "festival") {
        const dt = stamp - r.game.start - cue.at;
        hint.textContent =
          r.game.id === "signal"
            ? dt < 0
              ? "WAIT…" + (cue.fake && dt > -900 ? " · not yet!" : "")
              : "GO · " + ["Blue", "Pink", "Mint", "Gold"][cue.color]
            : r.game.id === "fish"
              ? dt < -100
                ? "Watch the ripples…"
                : dt < cue.window
                  ? "SPLASH! REEL NOW"
                  : "Next bite…"
              : r.game.id === "lantern"
                ? "LAND ON " + ["BLUE", "PINK", "MINT", "GOLD"][cue.color]
                : r.game.id === "hop"
                  ? Math.abs(dt + PartyExpansionRules.waveLead(cue.size)) < 140
                    ? "JUMP NOW · " + cue.size.toUpperCase() + " WAVE"
                    : dt < 0
                      ? cue.size.toUpperCase() + " wave approaching…"
                      : "Keep watching the tide"
                  : hint.textContent;
      }
    }
  }
  async function boot() {
    PartyAudio.set(sound, musicOn);
    menu();
    requestAnimationFrame(frame);
    try {
      profile = (await api("profile")).profile;
      header();
      const code =
        new URL(location.href).searchParams.get("room") ||
        storage.get("boardwalk-room");
      if (code) {
        try {
          const r = await api("get", { room: code });
          adopt(r.game, true);
        } catch (e) {
          if ([403, 404].includes(e.status)) {
            if (new URL(location.href).searchParams.has("room")) joinDialog();
            else storage.remove("boardwalk-room");
          } else notify(e.message);
        }
      }
    } catch (e) {
      if (e.status !== 401) notify(e.message);
      if (new URL(location.href).searchParams.has("room")) joinDialog();
    }
  }
  boot();
})();
