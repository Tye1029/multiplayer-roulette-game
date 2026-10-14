"use strict";
const crypto = require("node:crypto"),
  C = require("../../../assets/party/catalog"),
  physics = require("../../../shared/games/mini-golf-physics");
const rnd = (n) => crypto.randomInt(n),
  pick = (xs) => xs[rnd(xs.length)],
  fail = (message, status = 409) => {
    throw Object.assign(new Error(message), { status });
  },
  directions = ["up", "left", "right", "down"];
function player(p) {
  return {
    id: p.id,
    name: p.name,
    character: p.character,
    skin: p.skin || "classic",
    bot: !!p.bot,
    position: 0,
    tokens: 10,
    trophies: 0,
    wins: 0,
    total: 0,
    items: ["boost"],
    shield: false,
    participation: 0,
  };
}
function create(id, p, mode, now = Date.now()) {
  if (!["party", "duel"].includes(mode)) fail("Choose a party or a duel.", 400);
  return {
    version: 2,
    id,
    host: p.id,
    mode,
    phase: "waiting",
    players: [player(p)],
    ready: [],
    round: 0,
    rounds: mode === "duel" ? 3 : 6,
    match: 1,
    revision: 1,
    deadline: now + 1800000,
    receipts: [],
    history: [],
    gameOrder: [],
    turn: 0,
    goal: 8,
    log: "Welcome to Coral Carnival. Bring your crew.",
    created: now,
  };
}
function join(s, p) {
  if (s.players.some((x) => x.id === p.id)) return;
  if (s.phase !== "waiting") fail("This party has already started.");
  if (s.players.length >= (s.mode === "duel" ? 2 : 4))
    fail("This room is full.");
  s.players.push(player(p));
  s.revision++;
}
function enterBoard(s, now) {
  s.phase = "board";
  s.turn = 0;
  s.usedItem = false;
  s.lastMove = null;
  s.dice = null;
  s.event = null;
  s.movement = null;
  s.deadline = now + 25000;
  s.log = "Round " + s.round + ": roll the dice. Find your own route.";
}
function begin(s, now) {
  if (s.players.length < 2) fail("Invite a friend or add a bot first.");
  if (s.players.some((p) => !p.bot && !s.ready.includes(p.id)))
    fail("Everyone needs to be ready.");
  s.gameOrder = C.games.map((g) => g.id);
  for (let i = s.gameOrder.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [s.gameOrder[i], s.gameOrder[j]] = [s.gameOrder[j], s.gameOrder[i]];
  }
  s.version = 2;
  s.round = 1;
  s.history = [];
  s.winner = null;
  s.finished = null;
  s.tied = null;
  s.tieAgain = false;
  s.tieCount = 0;
  s.goal = 8;
  s.players = s.players.map(player);
  s.receipts = [];
  if (s.mode === "party") enterBoard(s, now);
  else enterGame(s, now);
}
function enterGame(s, now, tiebreak = false, participants = null) {
  s.phase = "intro";
  s.deadline = now + 5000;
  const sideDuel = !!participants,
    duration = sideDuel ? 20000 : 35000;
  s.game = {
    id: tiebreak
      ? "climb"
      : sideDuel
        ? pick(["climb", "memory"])
        : s.gameOrder[(s.round - 1) % 4],
    start: now + 5000,
    end: now + 5000 + duration,
    duration,
    tiebreak,
    sideDuel,
    participants:
      participants || (tiebreak ? s.tied : s.players.map((p) => p.id)),
    sequence: Array.from({ length: 36 }, () => pick(directions)),
    scores: s.players.map(() => 0),
    progress: s.players.map(() => ({
      step: 0,
      combo: 0,
      bonus: 0,
      last: 0,
      attempts: 0,
      inputs: 0,
      finished: null,
      shot: null,
      hook: null,
      reverse: false,
      pattern: Array.from({ length: 3 }, () => rnd(4)),
      cursor: 0,
      level: 3,
      showAt: now + 5000,
      feedback: "",
    })),
  };
  s.lastMove = null;
  s.event = null;
  if (!sideDuel)
    s.log = tiebreak
      ? "One last rooftop showdown."
      : "Everyone is in. Time to play!";
}
function nextTurn(s, now) {
  s.turn++;
  s.usedItem = false;
  s.event = null;
  s.dice = null;
  s.movement = null;
  s.phase = s.turn >= s.players.length ? "board-end" : "board";
  s.deadline = now + (s.phase === "board" ? 25000 : 2500);
}
function roll(s, p, now) {
  const values = Array.from({ length: p.double ? 2 : 1 }, () => 1 + rnd(6));
  p.double = false;
  const steps = values.reduce((a, b) => a + b, 0) + (p.boost || 0);
  p.boost = 0;
  s.dice = { values, total: steps, at: now, player: p.id };
  s.movement = { remaining: steps, path: [p.position], at: now + 1700 };
  s.phase = "rolling";
  s.deadline = now + 1700;
  s.log = p.name + " is rolling…";
}
function travel(s, now, chosen) {
  const p = s.players[s.turn],
    m = s.movement,
    path = [p.position];
  let node = C.spaces[p.position],
    choice = chosen;
  while (m.remaining > 0) {
    if (node.next.length > 1 && choice === undefined) break;
    const next = choice === undefined ? node.next[0] : choice;
    choice = undefined;
    if (!node.next.includes(next))
      fail("Choose one of the highlighted paths.", 400);
    node = C.spaces[next];
    m.remaining--;
    path.push(next);
    if (next === 0) p.tokens += 4;
    if (next === s.goal && p.tokens >= 10) {
      p.tokens -= 10;
      p.trophies++;
      s.goal =
        C.trophyStops[
          (C.trophyStops.indexOf(s.goal) + 1) % C.trophyStops.length
        ];
    }
  }
  if (path.length > 1) {
    s.lastMove = {
      player: p.id,
      path,
      at: now,
      duration: (path.length - 1) * 440 + 300,
    };
    p.position = path.at(-1);
    s.phase = "walking";
    s.deadline = now + s.lastMove.duration;
    s.log = p.name + " rolled " + s.dice.values.join(" + ") + ".";
  } else {
    s.phase = "choice";
    s.deadline = now + 18000;
    s.log = p.name + " reached a crossroads. " + m.remaining + " spaces left.";
  }
}
function land(s, now) {
  const p = s.players[s.turn],
    tile = C.spaces[p.position],
    kind = tile.type;
  s.phase = "space";
  s.deadline = now + 3500;
  s.event = {
    kind,
    at: now,
    title: C.spaceInfo[kind].name,
    text: C.spaceInfo[kind].description,
    player: p.id,
    bought: false,
  };
  const e = s.event;
  if (kind === "coins") {
    p.tokens += 3;
    e.text = "+3 coins. A little festival spending money.";
  }
  if (kind === "loss") {
    if (p.shield) {
      p.shield = false;
      e.text = "Your rain shield saved your coins!";
    } else {
      const loss = Math.min(3, p.tokens);
      p.tokens -= loss;
      e.text = "A passing rain cloud cost " + loss + " coins.";
    }
  }
  if (kind === "gift") {
    if (p.items.length < 3) {
      const item = pick(C.items);
      p.items.push(item.id);
      e.text = "Found " + item.name + "!";
    } else {
      p.tokens += 4;
      e.text = "Pockets full. Take 4 coins instead.";
    }
  }
  if (kind === "lucky") {
    const n = 5 + rnd(5);
    p.tokens += n;
    e.text = "Lucky you! +" + n + " coins.";
    if (p.items.length < 3 && rnd(3) === 0) {
      p.items.push("shield");
      e.text += " A rain shield, too.";
    }
  }
  if (kind === "event") {
    const variant = rnd(3);
    e.variant = variant;
    if (variant === 0) {
      const from = p.position;
      p.position = pick([4, 12, 20, 28].filter((x) => x !== from));
      s.lastMove = {
        player: p.id,
        path: [from, p.position],
        at: now,
        duration: 1800,
        warp: true,
      };
      e.text =
        "Tide taxi! A free ride to " + C.spaces[p.position].district + ".";
    } else if (variant === 1) {
      for (const x of s.players) x.tokens += 3;
      e.text = "Coin shower! Everyone gets 3 coins.";
    } else {
      let n = 0;
      for (const x of s.players)
        if (x.id !== p.id && x.tokens) {
          x.tokens--;
          n++;
        }
      p.tokens += n;
      e.text = "Festival collection! Your friends chipped in " + n + " coins.";
    }
  }
  if (kind === "shop" || kind === "duel") s.deadline = now + 18000;
  if (kind === "trophy")
    e.text =
      p.position === s.goal
        ? "Save up 10 coins to buy a trophy when you pass."
        : "The trophy host has moved. Follow the golden beacon.";
  s.log = p.name + " · " + e.text;
}
function challenge(s, p, opponent, now) {
  if (!s.players.some((x) => x.id === opponent && x.id !== p.id))
    fail("Choose another player.", 400);
  s.log =
    p.name +
    " challenged " +
    s.players.find((x) => x.id === opponent).name +
    "!";
  enterGame(s, now, false, [p.id, opponent]);
}
function finish(s, now, winner) {
  s.phase = "complete";
  s.winner = winner;
  s.finished = now;
  s.deadline = now + 86400000;
  s.ready = [];
  s.rewards = s.players.map((p) =>
    p.bot || p.participation < 2 ? 0 : 12 + (p.id === winner ? 8 : 0),
  );
}
function conclude(s, now) {
  const g = s.game,
    rank = s.players
      .map((p, i) => ({
        id: p.id,
        score: g.scores[i],
        finished: g.progress[i].finished || g.end,
      }))
      .filter((p) => g.participants.includes(p.id))
      .sort((a, b) => b.score - a.score || a.finished - b.finished);
  const top = rank.filter(
      (r) => r.score === rank[0].score && r.finished === rank[0].finished,
    ),
    winners = rank[0].score > 0 ? top.map((r) => r.id) : [];
  if (g.sideDuel) {
    for (const p of s.players) if (winners.includes(p.id)) p.tokens += 8;
    s.phase = "side-result";
    s.deadline = now + 5000;
    s.log = winners.length
      ? s.players
          .filter((p) => winners.includes(p.id))
          .map((p) => p.name)
          .join(" & ") + " won 8 coins!"
      : "A draw. Back to the festival!";
    s.event = { kind: "duel", title: "Rival showdown", text: s.log };
    return;
  }
  for (const [i, p] of s.players.entries()) {
    p.total += g.scores[i];
    p.tokens += Math.max(2, 6 - rank.findIndex((r) => r.id === p.id));
    if (winners.includes(p.id)) {
      p.wins++;
      p.trophies++;
    }
  }
  s.history.push({
    round: s.round,
    game: g.id,
    scores: [...g.scores],
    winners,
    tiebreak: g.tiebreak,
  });
  if (g.tiebreak) {
    if (winners.length === 1) {
      finish(s, now, winners[0]);
      return;
    }
    if (++s.tieCount >= 3) {
      finish(s, now, null);
      s.log = "Still level after three tiebreakers. Share the honors!";
      return;
    }
    s.phase = "round-end";
    s.deadline = now + 8000;
    s.log = "Still tied. One more rooftop sprint.";
    s.tieAgain = true;
    return;
  }
  const leaders = [...s.players].sort((a, b) => b.wins - a.wins);
  if (
    s.mode === "duel" &&
    leaders[0].wins >= 2 &&
    leaders[0].wins > leaders[1].wins
  ) {
    finish(s, now, leaders[0].id);
    return;
  }
  if (s.round >= s.rounds) {
    const ranking = [...s.players].sort(
        (a, b) => b.trophies - a.trophies || b.total - a.total,
      ),
      tied = ranking.filter(
        (p) =>
          p.trophies === ranking[0].trophies && p.total === ranking[0].total,
      );
    if (tied.length === 1) {
      finish(s, now, ranking[0].id);
      return;
    }
    if (s.players.every((p) => p.participation === 0)) {
      finish(s, now, null);
      return;
    }
    s.tied = tied.map((p) => p.id);
    s.tieAgain = true;
  }
  s.phase = "round-end";
  s.deadline = now + 7000;
  s.log = winners.length
    ? s.players
        .filter((p) => winners.includes(p.id))
        .map((p) => p.name)
        .join(" & ") + " won this minigame!"
    : "A fresh chance next round.";
}
function fishEscape(v, now) {
  if (v.hook && now - v.hook.at >= 4000) {
    v.hook = null;
    v.attempts++;
    v.last = now;
    v.feedback = "It got away! Reel before four seconds.";
    if (v.attempts >= 5) v.finished = now;
  }
}
function play(s, p, b, now) {
  const g = s.game,
    i = s.players.indexOf(p),
    v = g.progress[i];
  if (s.phase !== "playing" || now < g.start || now >= g.end)
    fail("This minigame is not accepting moves.");
  if (!g.participants.includes(p.id))
    fail("Watch the two rivals in this round.");
  if (v.finished) fail("Your round is finished.");
  if (now - v.last < 130) fail("Give your last move a moment.");
  if (g.id === "climb") {
    if (!directions.includes(b.value)) fail("Choose an arrow.", 400);
    if (b.value === g.sequence[v.step]) {
      v.step++;
      v.combo++;
      if (v.combo % 5 === 0) v.bonus += 100;
      v.feedback =
        v.combo % 5 === 0
          ? "Five-move combo! +100"
          : v.step % 6 === 0
            ? "Checkpoint secured!"
            : "Keep the rhythm!";
    } else {
      v.step = Math.max(Math.floor(v.step / 6) * 6, v.step - 2);
      v.combo = 0;
      v.feedback = "Slip! Your checkpoint caught you.";
    }
    g.scores[i] = v.step * 100 + v.bonus;
    if (v.step >= 24) v.finished = now;
  } else if (g.id === "memory") {
    if (b.value === "replay") {
      if (now - v.showAt < 2000) fail("Give the lights a moment.");
      v.cursor = 0;
      v.showAt = now;
      v.last = now;
      v.feedback = "Watch the lights again.";
      return;
    }
    if (!Number.isInteger(b.value) || b.value < 0 || b.value > 3)
      fail("Choose a light.", 400);
    if (now < v.showAt + v.pattern.length * 650 + 300)
      fail("Watch the pattern first.");
    const expected =
      v.pattern[v.reverse ? v.pattern.length - 1 - v.cursor : v.cursor];
    if (b.value === expected) {
      v.cursor++;
      v.feedback = "Keep going";
      if (v.cursor === v.pattern.length) {
        v.combo++;
        g.scores[i] += v.level * 100 + v.combo * 50;
        v.level = Math.min(8, v.level + 1);
        v.reverse = v.level >= 5 && v.combo % 2 === 0;
        v.pattern = Array.from({ length: v.level }, () => rnd(4));
        v.cursor = 0;
        v.showAt = now + 800;
        v.feedback = v.reverse
          ? "Reverse remix! Repeat it backwards."
          : "Combo complete!";
      }
    } else {
      g.scores[i] = Math.max(0, g.scores[i] - 50);
      v.combo = 0;
      v.cursor = 0;
      v.pattern = Array.from({ length: v.level }, () => rnd(4));
      v.showAt = now + 800;
      v.feedback = "Missed a beat. Watch the new pattern.";
    }
  } else if (g.id === "fish") {
    fishEscape(v, now);
    if (v.finished) fail("All five casts are complete.");
    if (now - v.last < 900 && !v.hook && v.attempts)
      fail("Wait for the next cast.");
    if (!v.hook) {
      if (!["safe", "deep"].includes(b.risk))
        fail("Choose safe or deep water.", 400);
      const center = 0.5 + 0.2 * Math.sin(v.attempts * 2.1),
        pos = 0.5 + 0.46 * Math.sin(((now - g.start) / 1000) * 2.1),
        width = b.risk === "deep" ? 0.16 : 0.3,
        accuracy = Math.max(0, 1 - Math.abs(center - pos) / width);
      if (accuracy > 0.05) {
        v.hook = { at: now, risk: b.risk, accuracy };
        v.feedback = "Fish on! Reel in the green tension zone.";
      } else {
        v.attempts++;
        v.catch = { score: 0, at: now };
        v.feedback = "Missed the hook. Watch for gold.";
      }
    } else {
      const tension =
          0.5 + 0.46 * Math.sin(((now - v.hook.at) / 1000) * 3.2 - 1),
        width = v.hook.risk === "deep" ? 0.14 : 0.25,
        accuracy = Math.max(0, 1 - Math.abs(0.56 - tension) / width),
        score = Math.round(
          (v.hook.risk === "deep" ? 600 : 320) * v.hook.accuracy * accuracy,
        );
      g.scores[i] += score;
      v.catch = { score, at: now, risk: v.hook.risk };
      v.hook = null;
      v.attempts++;
      v.feedback =
        score > 300
          ? "A beauty! +" + score
          : score
            ? "Landed it! +" + score
            : "Line slipped! Stay in the green.";
    }
    if (v.attempts >= 5) v.finished = now;
  } else if (g.id === "putt") {
    if (v.shot && now < v.shot.at + v.shot.duration + 300)
      fail("Let the ball finish rolling.");
    if (v.attempts >= 3) fail("All three attempts are complete.");
    if (
      !Number.isFinite(b.angle) ||
      b.angle < -Math.PI ||
      b.angle > Math.PI ||
      !Number.isFinite(b.power) ||
      b.power < 0.05 ||
      b.power > 1
    )
      fail("Choose valid aim and power.", 400);
    const course = v.attempts,
      h = C.holes[course],
      shot = physics.simulate(h, h.tee, b.angle, b.power, now),
      score = shot.holed
        ? 1000
        : Math.max(
            0,
            Math.round(
              900 -
                Math.hypot(
                  shot.position[0] - h.cup[0],
                  shot.position[1] - h.cup[1],
                ) *
                  1.6,
            ),
          );
    g.scores[i] += score;
    v.shot = { ...shot, at: now, course };
    v.attempts++;
    v.feedback = shot.holed
      ? "Hole in one! +1,000"
      : score + " points. Next course coming up.";
    if (v.attempts === 3) v.finished = now + shot.duration;
  }
  v.last = now;
  v.inputs++;
  p.participation++;
}
function advance(s, now = Date.now()) {
  if (s.version !== 2) {
    s.phase = "expired";
    s.log = "This room used the earlier prototype. Start a fresh festival.";
    return;
  }
  if (s.phase === "waiting" && now >= s.deadline) {
    s.phase = "expired";
    return;
  }
  const p = s.players[s.turn];
  if (s.phase === "board") {
    if (now >= s.deadline || (p?.bot && now >= s.deadline - 23000))
      roll(s, p, now);
  } else if (s.phase === "rolling" && now >= s.deadline) travel(s, now);
  else if (s.phase === "walking" && now >= s.deadline) {
    if (s.movement.remaining) {
      s.phase = "choice";
      s.deadline = now + 18000;
      s.log =
        p.name + " has " + s.movement.remaining + " spaces left. Pick a path.";
    } else land(s, now);
  } else if (
    s.phase === "choice" &&
    (now >= s.deadline || (p.bot && now >= s.deadline - 16000))
  )
    travel(s, now, pick(C.spaces[p.position].next));
  else if (
    s.phase === "space" &&
    (now >= s.deadline || (p.bot && now >= s.event.at + 1800))
  ) {
    if (s.event.kind === "duel")
      challenge(s, p, pick(s.players.filter((x) => x.id !== p.id)).id, now);
    else {
      if (s.event.kind === "shop" && p.bot && p.items.length < 3) {
        const item = pick(C.items);
        if (p.tokens >= item.cost) {
          p.tokens -= item.cost;
          p.items.push(item.id);
        }
      }
      nextTurn(s, now);
    }
  } else if (s.phase === "side-result" && now >= s.deadline) nextTurn(s, now);
  else if (s.phase === "board-end" && now >= s.deadline) enterGame(s, now);
  else if (s.phase === "intro" && now >= s.deadline) {
    s.phase = "playing";
    s.game.start = now;
    s.game.end = now + s.game.duration;
    s.deadline = s.game.end;
    for (const v of s.game.progress) v.showAt = now;
  } else if (s.phase === "playing") {
    const g = s.game;
    for (const [i, x] of s.players.entries()) {
      const v = g.progress[i];
      if (g.id === "fish") fishEscape(v, now);
      if (
        x.bot &&
        g.participants.includes(x.id) &&
        !v.finished &&
        now < g.end &&
        now - v.last > 850
      ) {
        try {
          if (g.id === "climb")
            play(
              s,
              x,
              { value: rnd(9) ? g.sequence[v.step] : pick(directions) },
              now,
            );
          if (
            g.id === "memory" &&
            now > v.showAt + v.pattern.length * 650 + 300
          )
            play(
              s,
              x,
              {
                value: rnd(12)
                  ? v.pattern[
                      v.reverse ? v.pattern.length - 1 - v.cursor : v.cursor
                    ]
                  : rnd(4),
              },
              now,
            );
          if (g.id === "fish" && (v.hook || now - v.last > 1800))
            play(s, x, { risk: rnd(3) ? "safe" : "deep" }, now);
          if (g.id === "putt")
            play(
              s,
              x,
              { angle: -1.2 - rnd(8) / 10, power: 0.3 + rnd(55) / 100 },
              now,
            );
        } catch (e) {
          if (!e.status) throw e;
        }
      }
    }
    const active = s.players
      .map((x, i) => (g.participants.includes(x.id) ? g.progress[i] : null))
      .filter(Boolean);
    if (
      now >= g.end ||
      active.every((v) => v.finished && now >= v.finished + 1500)
    )
      conclude(s, now);
  } else if (s.phase === "round-end" && now >= s.deadline) {
    if (s.tieAgain) {
      s.tieAgain = false;
      enterGame(s, now, true);
    } else {
      s.round++;
      if (s.mode === "party") enterBoard(s, now);
      else enterGame(s, now);
    }
  }
}
function act(s, id, b, now = Date.now()) {
  const p = s.players.find((p) => p.id === id);
  if (!p) fail("Only room members can do that.", 403);
  if (b.action === "get") return;
  if (b.action === "ready") {
    if (s.phase !== "waiting") fail("The party is already underway.");
    s.ready = s.ready.includes(id)
      ? s.ready.filter((v) => v !== id)
      : [...s.ready, id];
  } else if (b.action === "start") {
    if (id !== s.host) fail("Only the host can start.", 403);
    if (s.phase !== "waiting") fail("The match already started.");
    begin(s, now);
  } else if (b.action === "add-bot") {
    if (id !== s.host) fail("Only the host can add bots.", 403);
    const n = s.players.length;
    join(s, {
      id: "bot:" + crypto.randomUUID(),
      name: ["Pip", "Dizzy", "Nova"][n - 1] || "Pip",
      bot: true,
      character: C.characters[n % 4].id,
    });
  } else if (
    [
      "roll",
      "move",
      "choose",
      "item",
      "buy-item",
      "continue",
      "challenge",
    ].includes(b.action)
  ) {
    if (s.players[s.turn]?.id !== id || b.round !== s.round)
      fail("Wait for your board turn.");
    if (b.action === "roll" || b.action === "move") {
      if (s.phase !== "board") fail("The dice have already been rolled.");
      p.participation++;
      roll(s, p, now);
    } else if (b.action === "choose") {
      if (s.phase !== "choice" || !Number.isInteger(b.next))
        fail("Choose a path at the crossroads.");
      travel(s, now, b.next);
    } else if (b.action === "challenge") {
      if (s.phase !== "space" || s.event.kind !== "duel")
        fail("Find a showdown space first.");
      challenge(s, p, b.opponent, now);
    } else if (b.action === "continue") {
      if (s.phase !== "space" || s.event.kind === "duel")
        fail("Finish this board event first.");
      nextTurn(s, now);
    } else {
      const item = C.items.find((x) => x.id === b.item);
      if (!item) fail("Unknown item.", 400);
      if (b.action === "buy-item") {
        if (s.phase !== "space" || s.event.kind !== "shop" || s.event.bought)
          fail("Visit an item cart to buy one item.");
        if (p.items.length >= 3) fail("Your pockets are full.");
        if (p.tokens < item.cost) fail("Not enough match coins.");
        p.tokens -= item.cost;
        p.items.push(item.id);
        s.event.bought = true;
        s.event.text = "Packed " + item.name + ". Ready for your next turn!";
      } else {
        if (s.phase !== "board") fail("Use items before rolling.");
        if (s.usedItem) fail("One item per turn.");
        const index = p.items.indexOf(item.id);
        if (index < 0) fail("You do not have that item.");
        p.items.splice(index, 1);
        if (item.id === "boost") p.boost = 3;
        if (item.id === "double") p.double = true;
        if (item.id === "shield") p.shield = true;
        if (item.id === "magnet") p.tokens += 6;
        s.usedItem = true;
        s.log = p.name + " used " + item.name + ".";
      }
    }
  } else if (b.action === "play") {
    if (
      b.round !== s.round ||
      b.game !== s.game?.id ||
      b.start !== s.game?.start
    )
      fail("That move belongs to an earlier round.");
    play(s, p, b, now);
  } else if (b.action === "leave") {
    if (!["waiting", "complete", "expired"].includes(s.phase))
      fail(
        "Your seat is kept until this match ends. You can reconnect from this device.",
      );
    s.players = s.players.filter((x) => x.id !== id);
    s.ready = s.ready.filter((v) => v !== id);
    if (s.host === id) s.host = s.players.find((x) => !x.bot)?.id || "";
    if (!s.host) s.phase = "expired";
  } else if (b.action === "rematch") {
    if (s.phase !== "complete") fail("Finish this match first.");
    if (!s.ready.includes(id)) s.ready.push(id);
    if (s.players.every((x) => x.bot || s.ready.includes(x.id))) {
      s.match++;
      begin(s, now);
    }
  } else fail("Unknown room action.", 400);
  s.revision++;
}
function view(s, id, now = Date.now()) {
  const index = s.players.findIndex((p) => p.id === id);
  if (index < 0) fail("Join this room to see the match.", 403);
  const { receipts, gameOrder, ...out } = structuredClone(s);
  out.you = id;
  out.serverTime = now;
  delete out.created;
  if (out.game) {
    delete out.game.sequence;
    out.game.progress = out.game.progress.map((v, i) => {
      if (i !== index) {
        delete v.pattern;
        delete v.cursor;
        delete v.level;
        return v;
      }
      v.next = s.game.sequence.slice(v.step, v.step + 4);
      if (now >= v.showAt + v.pattern.length * 650 + 300) delete v.pattern;
      return v;
    });
  }
  return out;
}
module.exports = { create, join, begin, act, advance, view, fail };
