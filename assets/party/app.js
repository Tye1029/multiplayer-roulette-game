/* BOARDWALK_FESTIVAL_V2_1 — guest rooms, authoritative matches, local presentation. */
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
    latency = 0,
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
    lastFrame = 0;
  let sound = storage.get("boardwalk-sound") !== "off",
    motion =
      storage.get("boardwalk-motion") !== "off" &&
      !matchMedia("(prefers-reduced-motion: reduce)").matches,
    selected = "raccoon",
    fishRisk = "safe",
    overview = false,
    pendingIntent = null,
    aim = { angle: (-65 * Math.PI) / 180, power: 0.5 },
    audio;
  const now = () => Date.now() + offset;
  function notify(message) {
    const box = $("#notice");
    box.textContent = message;
    box.hidden = false;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => (box.hidden = true), 6000);
  }
  function tone(kind = "tap") {
    if (!sound) return;
    try {
      audio ||= new AudioContext();
      if (audio.state === "suspended") audio.resume();
      const at = audio.currentTime;
      if (["roll", "step", "splash"].includes(kind)) {
        const count = kind === "roll" ? 7 : 1;
        for (let n = 0; n < count; n++) {
          const length = kind === "splash" ? 0.2 : 0.045,
            buffer = audio.createBuffer(
              1,
              Math.ceil(audio.sampleRate * length),
              audio.sampleRate,
            ),
            data = buffer.getChannelData(0);
          for (let i = 0; i < data.length; i++)
            data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
          const source = audio.createBufferSource(),
            filter = audio.createBiquadFilter(),
            gain = audio.createGain();
          source.buffer = buffer;
          filter.type = "lowpass";
          filter.frequency.value =
            kind === "splash" ? 1400 : kind === "step" ? 500 : 2100;
          gain.gain.setValueAtTime(
            kind === "step" ? 0.025 : 0.045,
            at + n * 0.12,
          );
          gain.gain.exponentialRampToValueAtTime(0.001, at + n * 0.12 + length);
          source.connect(filter);
          filter.connect(gain);
          gain.connect(audio.destination);
          source.start(at + n * 0.12);
        }
        return;
      }
      const notes =
        kind === "win"
          ? [523, 659, 784, 1046]
          : kind === "coin"
            ? [880, 1175]
            : kind === "good"
              ? [587, 784]
              : kind === "error"
                ? [220, 165]
                : kind === "start"
                  ? [392, 523, 784]
                  : [440];
      notes.forEach((f, i) => {
        const o = audio.createOscillator(),
          g = audio.createGain(),
          time = at + i * 0.085;
        o.type = kind === "error" ? "triangle" : "sine";
        o.frequency.setValueAtTime(f, time);
        g.gain.setValueAtTime(0, time);
        g.gain.linearRampToValueAtTime(
          kind === "tap" ? 0.025 : 0.04,
          time + 0.008,
        );
        g.gain.exponentialRampToValueAtTime(0.0001, time + 0.3);
        o.connect(g);
        g.connect(audio.destination);
        o.start(time);
        o.stop(time + 0.31);
      });
    } catch {}
  }
  async function api(action, data = {}) {
    const body = { action, ...data };
    if (!["get", "join", "profile", "register"].includes(action))
      body.requestId ||= crypto.randomUUID();
    const started = Date.now();
    let result, response;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
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
      const sample = result.game.serverTime - (started + Date.now()) / 2;
      offset = offset ? offset * 0.7 + sample * 0.3 : sample;
      latency = latency * 0.7 + Math.min(500, (Date.now() - started) / 2) * 0.3;
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
    app.innerHTML = `<section class="festival-hero"><img class="festival-art" src="/assets/party/images/boardwalk-crew-v2.webp" alt="Riff, Cleo, Moss and Bolt race through the sunset festival" fetchpriority="high"><div class="festival-copy"><span class="eyebrow">WELCOME TO CORAL CARNIVAL</span><h1>Big laughs.<br>Little rivalries.</h1><p>Roll into a seaside party full of shortcuts, surprises, and one-more-round moments.</p><div class="hero-buttons"><button class="primary" data-create="party">Start a party ↗</button><button class="secondary" data-open-join>Join friends</button></div><div class="hero-facts"><span>2–4 players</span><span>6 rounds</span><span>Free to play</span></div></div></section><section class="mode-grid" aria-label="Choose a mode"><button class="mode-card" data-create="party"><div><span class="mode-meta">THE WHOLE ADVENTURE · 2–4 PLAYERS</span><h3>Roll with your crew.</h3><p>40 spaces. Two branching routes. Shops, surprises and rival showdowns.</p></div><span class="mode-arrow">↗</span></button><button class="mode-card" data-create="duel"><div><span class="mode-meta">JUST THE MINIGAMES · 1V1</span><h3>Settle the score.</h3><p>Jump into a best-of-three duel. Bring your favorite rival.</p></div><span class="mode-arrow">↗</span></button></section><section><div class="section-heading"><h2>Steal the show.</h2><p>Four games. Plenty of ways to outplay your friends.</p></div><div class="game-grid">${C.games.map((g) => `<button class="game-card" data-rules="${g.id}"><canvas class="game-art" data-preview="${g.id}" aria-hidden="true"></canvas><div class="game-card-body"><span class="eyebrow">${g.tag}</span><h3>${g.name}</h3><p>${g.description}</p></div></button>`).join("")}</div></section><section class="crew-section"><div class="section-heading"><h2>A crew with character.</h2><p>Four personalities. Equal footing.</p></div><div class="crew-grid">${C.characters.map((c) => `<div class="crew-card"><canvas data-character="${c.id}" aria-hidden="true"></canvas><div><h3>${c.name}</h3><span class="eyebrow">${c.kind}</span><p>${c.bio}</p></div></div>`).join("")}</div></section>`;
    document
      .querySelectorAll("[data-preview]")
      .forEach((c) => S.render(c, c.dataset.preview, null, 2));
    portraits(app);
  }
  function joinDialog() {
    openDialog(
      `<span class="eyebrow">BETTER TOGETHER</span><h2>Find your friends.</h2><p>Enter the six-letter room code they shared with you.</p><form id="join-form"><div class="field"><label for="room-input">Room code</label><input id="room-input" type="text" inputmode="text" autocomplete="off" autocapitalize="characters" maxlength="6" pattern="[A-Za-z2-9]{6}" value="${esc(new URL(location.href).searchParams.get("room") || "")}" placeholder="ABC234" required></div><p id="form-error" class="form-error" role="alert"></p><button class="primary full">Join the party</button></form>`,
    );
  }
  async function create(mode) {
    if (!profile) {
      signup({ mode });
      return;
    }
    if (entryBusy) return;
    entryBusy = true;
    let pending;
    try {
      try {
        pending = JSON.parse(storage.get("boardwalk-create"));
      } catch {}
      if (!pending || pending.mode !== mode) {
        pending = { mode, requestId: crypto.randomUUID() };
        storage.set("boardwalk-create", JSON.stringify(pending));
      }
      const r = await api("create", pending);
      storage.remove("boardwalk-create");
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
    room = next;
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
    const cue = `${room.match}:${room.round}:${room.phase}`;
    if (cue !== lastCue) {
      if (room.phase === "playing") tone("start");
      if (room.phase === "rolling") tone("roll");
      if (room.phase === "space")
        tone(
          ["coins", "lucky", "gift"].includes(room.event?.kind)
            ? "coin"
            : "tap",
        );
      if (["round-end", "complete"].includes(room.phase)) tone("win");
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
        delay ?? (room.phase === "playing" ? 850 : 1400),
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
      playing = ["playing", "intro", "round-end", "side-result"].includes(
        r.phase,
      );
    document.body.dataset.phase = r.phase;
    if (screen !== mainKey) {
      screen = mainKey;
      panelKey = "";
      rosterKey = "";
      app.innerHTML = `<div class="room-header"><div><span class="eyebrow">${r.mode === "duel" ? "QUICK DUEL" : "PARTY MATCH"} · CORAL CARNIVAL</span><h1 id="room-title"></h1></div><button class="room-code" id="share-code" title="Copy invite link">${esc(r.id)} ↗</button></div><div class="match-layout"><div><div class="scene-frame match-scene"><canvas id="party-scene" role="img" aria-label="Live three-dimensional party board and minigame"></canvas><span class="scene-badge" id="scene-label"></span><div class="scene-tools"><button data-map aria-label="Toggle whole board view" title="Whole board / follow player">⌖</button><button data-board-guide aria-label="Board space guide">?</button></div></div><div id="score-strip" class="score-strip"></div><p class="turn-message" id="turn-message" aria-live="polite"></p></div><aside class="side-panel"><div id="panel"></div><div class="countdown"><span id="timer-label"></span><strong class="timer" id="timer">—</strong></div><div class="round-progress" id="round-progress"></div><p class="live-status" id="connection"><i class="live-dot"></i><span>Connected · private room</span></p></aside></div>`;
    }
    $("#room-title").textContent =
      r.phase === "waiting"
        ? "Get the crew together."
        : r.phase === "complete"
          ? "That’s one for the history books."
          : playing
            ? gameDef().name
            : `Round ${r.round} · Coral Carnival`;
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
    $("#turn-message").textContent = r.log || "";
    $(".scene-tools").hidden = playing;
    const rank = r.players
      .map(
        (p) =>
          `${p.id}:${p.tokens}:${p.trophies}:${p.name}:${p.skin}:${r.game?.scores[r.players.indexOf(p)]}:${r.ready.includes(p.id)}:${r.turn}`,
      )
      .join("|");
    if (rank !== rosterKey) {
      $("#score-strip").style.setProperty("--players", r.players.length);
      $("#score-strip").innerHTML = r.players
        .map(
          (p, i) =>
            `<div class="score-chip ${p.id === r.you ? "you" : ""} ${i === r.turn && !playing ? "active-turn" : ""}"><strong>${esc(p.name)}${p.id === r.you ? " · you" : ""}${p.bot ? " · bot" : ""}</strong><span>${r.phase === "playing" ? `${r.game.scores[i]} pts` : `★ ${p.trophies} <b>● ${p.tokens}</b>`}</span></div>`,
        )
        .join("");
      rosterKey = rank;
    }
    $("#round-progress").innerHTML = Array.from(
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
        r.round,
        r.match,
        r.turn,
        r.ready.join(","),
        r.players.length,
        r.usedItem,
        me()?.items.join(","),
        me()?.tokens,
        v?.attempts,
        !!v?.finished,
        !!v?.hook,
        v?.reverse,
        r.event?.bought,
        r.game?.start,
      ].join(":");
    if (key !== panelKey) {
      panelKey = key;
      const panel = $("#panel");
      if (r.phase === "waiting")
        panel.innerHTML = `<span class="eyebrow">${r.mode === "duel" ? "ONE FRIEND. ONE RIVALRY." : "SAVE A SEAT FOR YOUR FRIENDS"}</span><h2>${r.players.length}/${r.mode === "duel" ? 2 : 4} in the party</h2><div class="room-roster">${r.players.map((p) => `<div class="person"><canvas class="person-avatar" data-character="${p.character}" data-skin="${p.skin}" aria-hidden="true"></canvas><div><div class="person-name">${esc(p.name)}${p.id === r.you ? " · you" : ""}</div><div class="person-sub">${p.bot ? "Bot · always ready" : r.ready.includes(p.id) ? "Ready to play" : "Getting settled"}</div></div></div>`).join("")}</div><div class="stack"><button class="secondary" data-copy>Copy invite link ↗</button><button class="primary" data-action="ready">${r.ready.includes(r.you) ? "Ready ✓ · undo" : "I’m ready"}</button>${r.host === r.you ? `<button class="dark-button" data-action="start" ${r.players.length < 2 || r.players.some((p) => !p.bot && !r.ready.includes(p.id)) ? "disabled" : ""}>Start ${r.mode === "duel" ? "duel" : "party"}</button>${r.players.length < (r.mode === "duel" ? 2 : 4) ? '<button class="quiet" data-action="add-bot">Add a bot seat</button>' : ""}` : '<p class="small">Your host starts when everyone is ready.</p>'}<button class="text-button" data-leave>Leave room</button></div><p class="status-note">${r.mode === "duel" ? "First to two minigame wins." : "Six board rounds. Most trophies wins; total minigame points break a tie."}</p>`;
      else if (r.phase === "board")
        panel.innerHTML = `<span class="eyebrow">${mine ? "YOUR TURN" : esc(turn.name) + "’S TURN"}</span><h2>${mine ? "Make your move." : "A little suspense…"}</h2><p class="game-instructions">Roll 1–6. Follow the golden beacon: passing it with 10 coins earns a trophy.</p>${
          mine
            ? `<button class="roll-button primary full" data-action="roll"><span class="die-icon">⚄</span> Roll ${me().double ? "two dice" : "the dice"}</button><p class="small pocket-label">YOUR POCKET · ONE ITEM BEFORE ROLLING</p><div class="inventory">${
                me().items.length
                  ? me()
                      .items.map(
                        (id) =>
                          `<button data-item="${id}" ${r.usedItem ? "disabled" : ""} title="${C.items.find((x) => x.id === id).description}">${C.items.find((x) => x.id === id).name}</button>`,
                      )
                      .join("")
                  : '<span class="small">Visit an item cart or find a parcel.</span>'
              }</div>${me().shield ? '<div class="shield-note">☂ Rain shield active</div>' : ""}`
            : '<p class="status-note">Watch their roll. Your turn is coming.</p>'
        }<button class="text-button small" data-board-guide>Meet the board spaces</button>`;
      else if (r.phase === "rolling")
        panel.innerHTML = `<span class="eyebrow">${esc(turn.name)} IS UP</span><h2>Let it roll.</h2><div class="dice-readout" id="dice-readout">🎲</div><p class="status-note">A little luck. A new adventure.</p>`;
      else if (r.phase === "walking")
        panel.innerHTML = `<span class="eyebrow">ON THE MOVE</span><h2>${esc(turn.name)} rolled ${r.dice?.values.join(" + ")}.</h2><p class="game-instructions">${r.movement.remaining ? "A crossroads is coming up." : "Let’s see where this lands."}</p><div class="travel-dots">${Array.from({ length: r.lastMove?.path.length - 1 || 1 }, () => "<i></i>").join("")}</div>`;
      else if (r.phase === "choice")
        panel.innerHTML = `<span class="eyebrow">${mine ? "YOUR CHOICE" : esc(turn.name) + " IS CHOOSING"}</span><h2>A fork in the fun.</h2><p class="game-instructions">${r.movement.remaining} spaces left on this roll.</p>${mine ? `<div class="stack">${node.next.map((next, i) => `<button class="route-button" data-next="${next}">${i ? "Take " + C.spaces[next].district : "Stay on the promenade"}<small>${i ? "A shorter route with different spaces." : "Follow the outer route past the festival stops."}</small></button>`).join("")}</div>` : '<p class="status-note">Which way will they go?</p>'}`;
      else if (r.phase === "space") {
        const e = r.event,
          info = C.spaceInfo[e.kind];
        panel.innerHTML = `<div class="event-icon" style="--space:${info.color}">${info.icon}</div><span class="eyebrow">${esc(turn.name)} LANDED ON</span><h2>${info.name}</h2><p class="game-instructions">${esc(e.text)}</p>${mine && e.kind === "shop" ? `<div class="event-shop">${C.items.map((i) => `<button data-buy-item="${i.id}" ${e.bought || me().tokens < i.cost || me().items.length >= 3 ? "disabled" : ""}><strong>${i.name} <b>● ${i.cost}</b></strong><small>${i.description}</small></button>`).join("")}</div>` : ""}${
          mine && e.kind === "duel"
            ? `<div class="stack">${r.players
                .filter((p) => p.id !== r.you)
                .map(
                  (p) =>
                    `<button class="secondary" data-opponent="${esc(p.id)}">Challenge ${esc(p.name)} ↗</button>`,
                )
                .join("")}</div>`
            : mine
              ? '<button class="primary full" data-action="continue">On with the party ↗</button>'
              : '<p class="status-note">The adventure continues in a moment.</p>'
        }`;
      } else if (r.phase === "intro")
        panel.innerHTML = `<span class="eyebrow">${r.game.sideDuel ? "RIVAL SHOWDOWN · WIN 8 COINS" : r.game.tiebreak ? "TIEBREAKER" : "NEXT UP"}</span><h2>${gameDef().name}</h2><p class="game-instructions">${gameDef().rules}</p><div class="reward-pill">${
          r.game.sideDuel
            ? r.players
                .filter((p) => r.game.participants.includes(p.id))
                .map((p) => esc(p.name))
                .join(" vs ")
            : "A fresh chance to take the lead"
        }</div><p class="status-note">Starting together in a moment…</p>`;
      else if (r.phase === "playing") {
        const active = r.game.participants.includes(r.you);
        panel.innerHTML = `<span class="eyebrow">${r.game.sideDuel ? "RIVAL SHOWDOWN" : gameDef().tag}</span><h2>${gameDef().name}</h2><p class="game-instructions">${gameDef().rules}</p><div class="game-tip"><span>${gameDef().description}</span><button data-rules="${r.game.id}" aria-label="Minigame rules">?</button></div><div class="controls">${!active ? '<div class="reward-pill">Cheer on your friends!</div>' : v.finished ? '<div class="reward-pill">Your round is complete ✓</div><p class="status-note">Watch the others finish.</p>' : controls(r.game.id, v)}</div><div class="game-feedback" id="feedback" aria-live="polite"></div>`;
      } else if (r.phase === "board-end")
        panel.innerHTML =
          '<span class="eyebrow">THE CREW IS READY</span><h2>Minigame time!</h2><p class="game-instructions">New game. Fresh rivalries. Everyone is in.</p>';
      else if (r.phase === "side-result")
        panel.innerHTML = `<span class="eyebrow">RIVAL SHOWDOWN</span><h2>${esc(r.event.text)}</h2>${ranking(true)}<p class="status-note">Back to the board in a moment.</p>`;
      else if (r.phase === "round-end")
        panel.innerHTML = `<span class="eyebrow">ROUND ${r.round} COMPLETE</span><h2>${r.tieAgain ? "One last showdown." : "That was a good round."}</h2>${ranking(true)}<p class="status-note">${r.tieAgain ? "The leaders are tied. Rooftop Rally will decide it." : "Your next round starts automatically."}</p>`;
      else if (r.phase === "complete") {
        const winner = r.players.find((p) => p.id === r.winner);
        panel.innerHTML = `<span class="eyebrow">${winner?.id === r.you ? "YOU DID THAT." : "THAT’S A WRAP."}</span><h2>${winner ? esc(winner.name) + " takes the crown." : "Honors shared."}</h2>${ranking()}<div class="stack"><button class="primary" data-action="rematch" ${r.ready.includes(r.you) ? "disabled" : ""}>${r.ready.includes(r.you) ? "Rematch requested ✓" : "One more round?"}</button><button class="text-button" data-leave>Back to the boardwalk</button></div>`;
      } else
        panel.innerHTML =
          '<span class="eyebrow">A FRESH START</span><h2>This room has closed.</h2><p class="status-note">Start a new festival with your friends.</p><button class="primary" data-leave>Back to the boardwalk</button>';
      portraits(panel);
    }
    if ($("#feedback")) $("#feedback").textContent = v?.feedback || "";
    if ($("#next-arrows"))
      $("#next-arrows").textContent = (v?.next || [])
        .map((x) => ({ up: "↑", down: "↓", left: "←", right: "→" })[x])
        .join(" ");
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
    pendingControls();
  }
  function controls(id, v) {
    if (id === "climb")
      return `<div id="next-arrows" class="next-arrows" aria-label="Upcoming arrows"></div><div class="arrow-grid"><button data-direction="up" aria-label="Climb up">↑</button><button data-direction="left" aria-label="Climb left">←</button><button data-direction="down" aria-label="Climb down">↓</button><button data-direction="right" aria-label="Climb right">→</button></div>`;
    if (id === "memory")
      return `${v.reverse ? '<div class="reverse-cue">↶ REPEAT IN REVERSE</div>' : ""}<div class="memory-grid">${["Blue", "Pink", "Mint", "Gold"].map((x, i) => `<button class="memory-pad" data-pad="${i}">${i + 1} · ${x}</button>`).join("")}</div><p id="memory-status" class="small" style="text-align:center;margin-top:8px">Watch the pattern</p><button class="text-button full" data-replay>Watch again</button>`;
    if (id === "fish")
      return `${!v.hook ? `<div class="risk-picker"><button data-risk="safe" aria-pressed="${fishRisk === "safe"}">Shallows <small>Wider window</small></button><button data-risk="deep" aria-pressed="${fishRisk === "deep"}">Deep water <small>Bigger catch</small></button></div>` : '<div class="reverse-cue">FISH ON · REEL IN GREEN</div>'}<button class="primary full" id="reel" data-reel>${v.hook ? "Reel it in!" : "Set the hook"} · ${5 - v.attempts} left</button>`;
    return `<label class="range-label" for="aim">Aim <output id="aim-value">${Math.round((aim.angle * 180) / Math.PI)}°</output></label><input id="aim" type="range" min="-170" max="-10" step="1" value="${Math.round((aim.angle * 180) / Math.PI)}"><label class="range-label" for="power">Power <output id="power-value">${Math.round(aim.power * 100)}%</output></label><input id="power" type="range" min="5" max="100" step="1" value="${Math.round(aim.power * 100)}"><button class="primary full" id="putt" data-putt>Putt · course ${Math.min(3, v.attempts + 1)} of 3</button>`;
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
        )}</div><p>Roll 1–6. Choose paths at the two crossroads. Collect trophies at the golden beacon for 10 coins. Most trophies after six rounds wins; minigame points break a tie.</p>`,
    );
  }
  function ranking(round = false) {
    const r = room,
      list = r.players
        .map((p, i) => ({ ...p, score: r.game?.scores[i] || 0 }))
        .filter(
          (p) =>
            !round || !r.game?.sideDuel || r.game.participants.includes(p.id),
        )
        .sort((a, b) =>
          round
            ? b.score - a.score
            : b.trophies - a.trophies || b.total - a.total,
        );
    return `<div class="results-list">${list.map((p, i) => `<div class="result-row"><span class="place">${i + 1}</span><span class="person-name">${esc(p.name)}${p.id === r.you ? " · you" : ""}</span><b>${round ? p.score + " pts" : p.trophies + " 🏆"}</b></div>`).join("")}</div>`;
  }
  function pendingControls() {
    const panel = $("#panel");
    if (!panel) return;
    panel.setAttribute("aria-busy", String(requestBusy));
    panel
      .querySelectorAll(
        "[data-action],[data-route],[data-item],[data-buy-item],[data-direction],[data-replay],[data-leave],[data-next],[data-opponent]",
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
  async function roomAction(action, data = {}) {
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
              : "good"
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
      `<span class="eyebrow">YOUR LITTLE LEGACY</span><h2>${esc(profile.name)}</h2><p>Every good rivalry starts with a first round.</p><div class="stat-grid"><div><strong>${profile.stats.played}</strong><span>PARTIES PLAYED</span></div><div><strong>${profile.stats.wins}</strong><span>VICTORIES</span></div><div><strong>${profile.stats.earned}</strong><span>COINS EARNED</span></div></div><h3>Your rivalries</h3>${profile.rivals.length ? profile.rivals.map((r) => `<div class="rival"><strong>${esc(r.name)}</strong><span>${r.wins} wins / ${r.played} parties</span></div>`).join("") : "<p>Play a match with a friend to start your rivalry record.</p>"}<h3 style="margin-top:24px">Your next entrance</h3>${charChoices(profile.character)}<p class="small">Character changes apply to your next room. Your guest profile is saved on this browser only.</p>`,
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
      `<span class="eyebrow">MAKE YOURSELF COMFORTABLE</span><h2>Your settings.</h2><label class="settings-row" for="sound"><span>Game sounds</span><input type="checkbox" id="sound" ${sound ? "checked" : ""}></label><label class="settings-row" for="motion"><span>Animated scenery</span><input type="checkbox" id="motion" ${motion ? "checked" : ""}></label><p class="small" style="margin-top:20px">Use touch or your keyboard. Arrow keys climb, 1–4 select lights, and Space reels or putts. Controls never change your character’s abilities.</p>`,
    );
  }
  function how() {
    openDialog(
      `<span class="eyebrow">A DAY AT CORAL CARNIVAL</span><h2>Bring your favorite rival.</h2><p><strong>Party Match:</strong> 2–4 players, six board rounds. Roll dice, choose paths, and visit item carts. Pass the glowing trophy with 10 match coins to collect it. Each minigame winner also earns a trophy.</p><p><strong>Quick Duel:</strong> 1v1 minigames. First to two wins takes the match. A tied series is settled with a rooftop race.</p><p><strong>Winning:</strong> Most trophies wins a party. Total minigame points break a tie; if those are equal, tied players enter a rooftop tiebreaker.</p><p><strong>Items:</strong> Rocket skates add 3 spaces, the coin magnet collects 6 coins, double dice give two rolls, and the rain shield blocks a loss. Use one item per turn.</p><p><strong>Your profile:</strong> Earn coins for cosmetic outfits. Board tokens cannot be purchased. No cash prizes, paid entries, or chip deposits are offered.</p><p><strong>Need to reconnect?</strong> Reload this page on the same browser. Board turns have a timer, so friends can keep playing during an interruption.</p>`,
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
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("button");
    if (!b || b.disabled) return;
    try {
      if (b.classList.contains("modal-close")) {
        modal.close();
        return;
      }
      if (b.dataset.create) {
        await create(b.dataset.create);
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
          `<span class="eyebrow">${g.tag}</span><h2>${g.name}</h2><p>${g.rules}</p><p class="small">Find this minigame in Party Match or Quick Duel. Everyone gets the same rules and time limit.</p>`,
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
      if (b.dataset.risk) {
        fishRisk = b.dataset.risk;
        document
          .querySelectorAll("[data-risk]")
          .forEach((x) =>
            x.setAttribute("aria-pressed", String(x.dataset.risk === fishRisk)),
          );
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
      if (b.dataset.item) {
        await roomAction("item", { item: b.dataset.item });
        return;
      }
      if (b.dataset.buyItem) {
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
      if (b.hasAttribute("data-reel")) {
        await roomAction("play", { risk: fishRisk });
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
  document.addEventListener("keydown", (e) => {
    if (
      modal.open ||
      room?.phase !== "playing" ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName) ||
      e.repeat
    )
      return;
    const key = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
    }[e.key];
    let b;
    if (room.game.id === "climb" && key) b = $(`[data-direction="${key}"]`);
    if (room.game.id === "memory" && /^[1-4]$/.test(e.key))
      b = $(`[data-pad="${Number(e.key) - 1}"]`);
    if (e.code === "Space") b = $("#reel") || $("#putt");
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
      time - lastFrame < (room?.phase === "playing" ? 28 : 33)
    )
      return;
    lastFrame = time;
    const stamp = now(),
      r = room,
      kind =
        r && ["intro", "playing", "round-end", "side-result"].includes(r.phase)
          ? r.game?.id
          : "board";
    S.render(
      $("#party-scene"),
      kind,
      r,
      (stamp + (kind === "fish" && r?.phase === "playing" ? latency : 0)) /
        1000,
      { aim, pattern: memoryPattern, fishRisk, overview, motion },
    );
    if (!r) return;
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
    if (r.phase === "playing") {
      if (stamp >= r.game.end) {
        document.querySelectorAll(".controls button").forEach((b) => {
          b.disabled = true;
        });
        return;
      }
      const v = r.game.progress[r.players.findIndex((p) => p.id === r.you)];
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
        $("#reel").disabled =
          requestBusy || !!(v.attempts && stamp - v.last < 900 && !v.hook);
    }
  }
  async function boot() {
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
