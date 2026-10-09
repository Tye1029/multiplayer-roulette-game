import {
  Round,
  VERSION,
  ENTRY,
  DIRECTIONS,
  relativeSeat,
  random,
  shuffle,
  createPersonality,
  botDecision,
  botDelay,
} from "./model.mjs?v=four-player-roulette-basement-v6";
import { installDebug } from "./debug.mjs?v=four-player-roulette-basement-v6";

import { loadProfile } from "./profile.mjs?v=four-player-roulette-basement-v6";
import { createTableAudio } from "./audio.mjs?v=four-player-roulette-basement-v6";
import { createGun } from "./gun.mjs?v=four-player-roulette-basement-v6";

import {
  MOTION,
  rotationPlan,
} from "./motion.mjs?v=four-player-roulette-basement-v6";

import { animateRoom } from "./room.mjs?v=four-player-roulette-basement-v6";

const $ = (id) => document.getElementById(id);
const money = (cents) =>
  new Intl.NumberFormat("en-US", {
    maximumFractionDigits: cents % 100 ? 2 : 0,
  }).format(cents / 100) + " Chips";
const esc = (text) =>
  String(text).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const asset = (name) => `/assets/roulette-four/images/${name}`;
const names = [
  "Marlow",
  "Vega",
  "Rook",
  "Jules",
  "Ash",
  "Knox",
  "Indigo",
  "Remy",
  "Sage",
  "Kit",
];
const profiles = ["amber.svg", "mint.svg", "rose.svg", "violet.svg"];
let roster = [],
  personalities = {},
  game = null,
  roundNumber = 0,
  generation = 0,
  busy = false,
  muted = false;
let angle = 270,
  phase = "lobby",
  connectedProfile = null,
  messageTimer,
  tick,
  resumeResults = false;
let tableNumber = 0,
  turnTick,
  botTimer,
  pendingShot = false,
  joining = false;
let rematchPlans = [];
let pendingShotResolve = null;
const timers = new Set(),
  completedRounds = [];
const diagnostics = installDebug(() => {
  const state = game?.snapshot() || null;
  if (state)
    state.players = state.players.map(({ avatar, ...p }) => ({
      ...p,
      direction: DIRECTIONS[relativeSeat(state.order, p.id, "you")],
    }));
  return {
    version: VERSION,
    table: tableNumber,
    state,
    bots: personalities,
    completedRounds,
    audio: tableAudio.status(),
    gun: gun.selected().id,
    profile: { status: connectedProfile ? "connected" : "guest" },
    ui: {
      phase: $("roulette-four").dataset.phase,
      busy,
      muted,
      gunAngle: angle,
      pendingTimers: timers.size,
      resultOpen: $("result-dialog").open,
      controls: Object.fromEntries(
        ["shoot", "spin", "pass"].map((id) => [
          id,
          { disabled: $(id).disabled, text: $(id).textContent.trim() },
        ]),
      ),
    },
    moneyCheck: state
      ? {
          totalCents:
            state.pot + state.players.reduce((sum, p) => sum + p.bank, 0),
          expectedCents: ENTRY * 4,
        }
      : null,
  };
});
function trace(type, details = {}) {
  diagnostics.record(type, {
    table: tableNumber,
    round: roundNumber,
    ...details,
  });
}
const tableAudio = createTableAudio(trace);
const gun = createGun(trace);
function stopTimers() {
  generation++;
  for (const timer of timers) clearTimeout(timer);
  timers.clear();
  clearInterval(tick);
  clearInterval(turnTick);
  clearTimeout(messageTimer);
  pendingShot = false;
  pendingShotResolve = null;
  botTimer = null;
  tableAudio.stop();
  gun.stop();
}
function later(fn, ms) {
  const token = generation;
  const timer = setTimeout(() => {
    timers.delete(timer);
    if (token === generation) fn();
  }, ms);
  timers.add(timer);
  return timer;
}
function avatar(p, className = "avatar") {
  return `<img class="${className}" src="${esc(p.avatar)}" alt="" draggable="false">`;
}
function crack() {
  return '<svg class="screen-crack" viewBox="0 0 100 100" aria-hidden="true"><g fill="none" stroke="#d1d6c9" stroke-width="1.4"><path d="M48 48 35 28 24 25 8 0M48 48 65 27 63 13 75 0M48 48 78 39 100 20M48 48 68 63 85 66 100 91M48 48 40 72 50 88 48 100M48 48 20 59 0 55M48 48 23 80 5 100M35 28 47 20M68 63 74 82M20 59 12 42"/></g><path d="m48 34 8 5 10 1-3 12 4 8-13 2-7 7-7-8-11-2 4-12-1-8 10 1z" fill="#030404" stroke="#a5a48d" stroke-width="2"/></svg>';
}
function player(id) {
  return (
    game?.snapshot().players.find((p) => p.id === id) ||
    roster.find((p) => p.id === id)
  );
}
function toast(text) {
  clearTimeout(messageTimer);
  $("scene-message").textContent = text;
  messageTimer = setTimeout(() => {
    $("scene-message").textContent = "";
  }, 2500);
}
function rotateTo(id, opening = false) {
  const s = game.snapshot(),
    target = 270 + relativeSeat(s.order, id, "you") * 90;
  const motion = rotationPlan(angle, target, opening);
  angle = motion.angle;
  $("gun").style.transitionDuration = motion.duration + "ms";
  $("gun").style.transform = `rotate(${angle}deg)`;
  if (motion.duration)
    tableAudio.play("wood", {
      duration: motion.duration,
      loop: true,
      volume: opening ? 0.26 : 0.2,
    });
  trace("gun-target", {
    player: id,
    direction: DIRECTIONS[relativeSeat(s.order, id, "you")],
    angle,
    durationMs: motion.duration,
    opening,
  });
  return motion.duration;
}
function buildRoster() {
  const botNames = shuffle(names).slice(0, 3),
    botProfiles = shuffle(
      profiles.filter(
        (name) => connectedProfile?.avatar || name !== "amber.svg",
      ),
    ).slice(0, 3);
  roster = [
    {
      id: "you",
      name: connectedProfile?.name || "Guest",
      avatar: connectedProfile?.avatar || asset("amber.svg"),
      gender: connectedProfile?.gender || "unknown",
      isBot: false,
    },
    ...botNames.map((name, i) => ({
      id: `bot-${i + 1}`,
      name,
      avatar: asset(botProfiles[i]),
      gender: i === 1 ? "female" : "male",
      pose: i,
      isBot: true,
    })),
  ];
}
function mountSeats(s) {
  $("seats").innerHTML = s.players
    .filter((p) => p.id !== "you")
    .map(
      (p) =>
        `<div class="seat" data-player="${p.id}" data-gender="${p.gender}" data-pose="${p.pose}" data-direction="${DIRECTIONS[relativeSeat(s.order, p.id, "you")]}" style="--pose:${p.pose};--model:${p.gender === "female" ? 1 : 0}"><div class="seat-figure"><div class="character-art" role="img" aria-label="${esc(p.name)} seated at the table"></div>${p.pose === 0 ? '<div class="wrist-motion"><div class="character-art character-hand"></div><div class="cigarette-effects"><i class="cigarette-ember"></i><span class="cigarette-smoke"><i></i><i></i><i></i></span><i class="cigarette-ash"></i></div></div>' : ""}<div class="head-motion"><div class="character-art character-head" aria-hidden="true"></div><div class="tv-glow"></div><div class="tv-screen">${avatar(p, "")}${crack()}</div></div></div><span class="seat-name">${esc(p.name)}</span></div>`,
    )
    .join("");
  const me = s.players.find((p) => p.id === "you");
  $("self-seat").innerHTML =
    `<span class="self-picture">${avatar(me)}${crack()}</span><span>${esc(me.name)} </span>`;
}
function render() {
  if (!game) return;
  const s = game.snapshot(),
    me = s.players.find((p) => p.id === "you");
  phase = s.phase;
  $("reopen-results").hidden = !["rematch", "expired"].includes(phase);
  $("roulette-four").dataset.phase = phase;
  $("players").innerHTML = s.order
    .map((id, i) => {
      const p = s.players.find((p) => p.id === id),
        active = phase === "playing" && id === s.activeId;
      return `<article class="player-bar ${active ? "active" : ""} ${p.eliminated ? "eliminated" : ""}" data-player="${id}" ${active ? 'aria-current="true"' : ""}>${avatar(p)}<div><b class="player-name">${esc(p.name)}${id === "you" && p.name !== "You" ? " · You" : ""}</b><span class="player-detail">${p.spinUsed ? "Spin used" : "1 spin"} <span class="turn-timer" data-turn-timer="${id}" aria-label="Turn time remaining">${active ? Math.max(0, Math.ceil((s.turnDeadline - Date.now()) / 1000)) + "s" : ""}</span></span></div><div><span class="order">${p.eliminated ? "OUT" : active ? `#${i + 1} · TURN` : `#${i + 1}`}</span><strong class="player-money">${money(p.bank)}</strong></div></article>`;
    })
    .join("");
  document.querySelectorAll(".seat").forEach((seat) => {
    const p = s.players.find((p) => p.id === seat.dataset.player);
    seat.classList.toggle("active", phase === "playing" && s.activeId === p.id);
    seat.classList.toggle("eliminated", p.eliminated);
  });
  $("self-seat").classList.toggle(
    "active",
    phase === "playing" && s.activeId === "you",
  );
  $("self-seat").classList.toggle("eliminated", me.eliminated);
  $("pot").textContent = money(s.pot);
  const canAct = phase === "playing" && s.activeId === "you" && !busy;
  $("gun-options").disabled = busy;
  $("shoot").disabled = !canAct;
  $("pass").disabled = !canAct || !s.canPass;
  $("spin").disabled = !canAct || me.spinUsed;
  $("spin").innerHTML =
    `Spin chamber <small>${me.spinUsed ? "Used this game" : "1 left · resets to 20 Chips"}</small>`;
  $("shoot-value").textContent = `+${money(s.award)}`;
  $("shoot").setAttribute(
    "aria-label",
    `Shoot to earn ${money(s.award)} if you survive`,
  );
  $("risk-label").textContent =
    `1 in ${6 - s.safeSinceSpin} · ${(s.fatalRisk * 100).toFixed(1)}% risk`;
  $("chambers").innerHTML = Array.from(
    { length: 6 },
    (_, i) =>
      `<i class="chamber-dot ${i < s.safeSinceSpin ? "spent" : ""}"></i>`,
  ).join("");
  if (phase === "opening") {
    $("turn-label").textContent = "Choosing the first player";
    $("turn-hint").textContent = "";
  } else if (phase === "playing") {
    const active = s.players.find((p) => p.id === s.activeId);
    $("turn-label").textContent =
      s.activeId === "you" ? "Your turn" : `${active.name}’s turn`;
    $("turn-hint").textContent =
      s.activeId === "you"
        ? s.canPass
          ? "Shoot again or pass."
          : ""
        : busy
          ? "At the table…"
          : "Thinking…";
  } else {
    $("turn-label").textContent = "Game complete";
    $("turn-hint").textContent = "The game has ended.";
  }
  diagnostics.refresh();
}
function startRound() {
  stopTimers();
  rematchPlans = [];
  busy = true;
  roundNumber++;
  personalities = Object.fromEntries(
    roster.filter((p) => p.isBot).map((p) => [p.id, createPersonality()]),
  );
  game = new Round(roster, random, roundNumber);
  trace("round-start", {
    order: game.snapshot().order,
    bots: structuredClone(personalities),
  });
  $("result-dialog").close();
  $("welcome").close();
  $("scene").classList.remove("is-fatal");
  $("scene-message").textContent = "";
  $("turn-hint").classList.remove("result-reopen");
  $("opening").hidden = false;
  $("opening-name").textContent = "Four seats. One chamber.";
  mountSeats(game.snapshot());
  render();
  const token = generation;
  requestAnimationFrame(() => {
    if (token !== generation || phase !== "opening") return;
    const duration = rotateTo(game.snapshot().activeId, true);
    later(() => {
      $("opening-name").textContent =
        `${player(game.snapshot().activeId).name} goes first`;
    }, duration);
    later(() => {
      $("opening").hidden = true;
      busy = false;
      game.begin();
      startTurnClock();
      trace("round-playing");
      render();
      scheduleBot();
    }, duration + MOTION.openingHold);
  });
}
function startTurnClock() {
  clearInterval(turnTick);
  turnTick = setInterval(checkTurnClock, 200);
}
function checkTurnClock() {
  if (!game || game.state.phase !== "playing") return false;
  const s = game.snapshot(),
    remaining = Math.max(0, Math.ceil((s.turnDeadline - Date.now()) / 1000));
  const clock = document.querySelector(
    '[data-turn-timer="' + s.activeId + '"]',
  );
  if (clock) {
    const text = remaining + "s";
    if (clock.textContent !== text) clock.textContent = text;
    clock.classList.toggle("urgent", remaining <= 10);
  }
  if (remaining > 0 || pendingShot) return false;
  const event = game.timeout();
  if (!event) return false;
  stopTimers();
  busy = true;
  trace("turn-timeout", event);
  toast(player(event.id).name + " ran out of time");
  const after = game.snapshot();
  render();
  if (after.phase === "complete") later(showResults, MOTION.results);
  else {
    const duration = rotateTo(after.activeId);
    startTurnClock();
    later(() => {
      busy = false;
      render();
      scheduleBot();
    }, duration + MOTION.handoffHold);
  }
  return true;
}
function scheduleBot() {
  clearTimeout(botTimer);
  timers.delete(botTimer);
  botTimer = null;
  const s = game.snapshot();
  if (s.phase !== "playing" || s.activeId === "you" || busy) return;
  const id = s.activeId,
    personality = personalities[id];
  const delay = botDelay(personality);
  trace("bot-thinking", { player: id, delayMs: delay });
  botTimer = later(() => {
    botTimer = null;
    const snapshot = game.snapshot();
    if (snapshot.activeId !== id || snapshot.phase !== "playing" || busy)
      return;
    const choice = botDecision(snapshot, id, personality);
    trace("bot-decision", {
      player: id,
      style: personality.kind,
      choice,
      risk: snapshot.fatalRisk,
      awardCents: snapshot.award,
      canPass: snapshot.canPass,
    });
    if (choice) act(id, choice);
  }, delay);
}
function act(id, action) {
  if (checkTurnClock()) return;
  const acceptedAt = Date.now(),
    actingTurn = game.snapshot().turnDeadline;
  if (busy) {
    trace("action-rejected", { player: id, action, reason: "UI busy" });
    return;
  }
  const execute = () => {
    pendingShot = false;
    pendingShotResolve = null;
    if (game.snapshot().turnDeadline !== actingTurn) return;
    const event = game.act(id, action, acceptedAt);
    if (!event.ok) {
      busy = false;
      trace("action-rejected", event);
      toast(event.reason);
      render();
      return;
    }
    const after = game.snapshot();
    trace("action", {
      ...event,
      phase: after.phase,
      activePlayer: after.activeId,
      potCents: after.pot,
      nextAwardCents: after.award,
      banks: after.players.map((p) => ({
        id: p.id,
        bankCents: p.bank,
        shots: p.shots,
        spinUsed: p.spinUsed,
      })),
    });
    busy = true;
    const turnMotion = action === "pass" ? rotateTo(after.activeId) : 0;
    if (action === "spin") {
      gun.roll(MOTION.spin);
      tableAudio.play("spin", { duration: MOTION.spin, volume: 0.24 });
      toast(`${player(id).name} spun · next shot 20 Chips`);
    }
    if (action === "shoot") {
      gun.strike(event.fatal);
      if (gun.selected().laser) tableAudio.tone(event.fatal, 0);
      else
        tableAudio.play(event.fatal ? "live" : "dry", {
          duration: event.fatal ? 900 : 350,
          volume: event.fatal ? 0.3 : 0.38,
        });
      trace("shot-strike", {
        player: id,
        fatal: !!event.fatal,
        hammerDelayMs: MOTION.hammer,
      });
      if (event.fatal) $("scene").classList.add("is-fatal");
      toast(
        event.fatal
          ? `${player(id).name} is out`
          : `${player(id).name} · safe · +${money(event.award)}`,
      );
    }
    render();
    if (after.phase === "complete") {
      later(showResults, MOTION.results);
      return;
    }
    later(
      () => {
        busy = false;
        render();
        scheduleBot();
      },
      action === "spin"
        ? MOTION.spin + MOTION.spinHold
        : action === "pass"
          ? turnMotion + MOTION.handoffHold
          : MOTION.shotHold,
    );
  };
  if (action === "shoot") {
    pendingShot = true;
    busy = true;
    render();
    gun.cock();
    if (!gun.selected().laser)
      tableAudio.play("hammer", { duration: 230, volume: 0.2 });
    pendingShotResolve = execute;
    later(execute, MOTION.hammer);
  } else execute();
}
function showResults() {
  if (!game.openRematch()) return;
  busy = false;
  const s = game.snapshot(),
    me = s.players.find((p) => p.id === "you");
  completedRounds.push({
    table: tableNumber,
    round: roundNumber,
    at: new Date().toISOString(),
    order: s.order,
    result: s.result,
    players: s.players.map(({ avatar, ...p }) => p),
  });
  if (completedRounds.length > 50) completedRounds.shift();
  trace("results", {
    result: s.result,
    players: s.players.map(({ avatar, ...p }) => p),
    deadline: s.rematchDeadline,
  });
  clearInterval(turnTick);
  $("result-kicker").textContent = "GAME COMPLETE";
  $("result-title").textContent =
    s.result.reason === "last-survivor"
      ? `${player(s.result.winnerId).name} is the last survivor.`
      : s.result.reason === "empty"
        ? "The pot is empty."
        : `${player(s.result.eliminatedId).name} is out.`;
  $("result-description").textContent =
    s.result.reason === "last-survivor"
      ? `The last survivor claims the remaining ${money(s.result.splitTotal)}.`
      : s.result.reason === "empty"
        ? "All Chips have been claimed. Everyone keeps their bank."
        : `${money(s.result.splitTotal)} split by surviving shot counts. You finish with ${money(me.bank)}.`;
  $("result-rows").innerHTML = s.order
    .map((id) => {
      const p = s.players.find((p) => p.id === id),
        net = p.bank - ENTRY;
      return `<div class="result-row">${avatar(p)}<div><b>${esc(p.name)}${id === "you" && p.name !== "You" ? " · You" : ""}</b><small>${p.eliminated ? (p.eliminationReason === "timeout" ? "Timed out" : "Eliminated") : s.result.reason !== "elimination" ? "Bank kept" : `Pot share · +${money(p.split)}`}</small></div><div class="result-total ${net < 0 ? "negative" : ""}">${money(p.bank)}<small>${net >= 0 ? "+" : "−"}${money(Math.abs(net))} net</small></div></div>`;
    })
    .join("");
  $("rematch").disabled = false;
  $("rematch").textContent = "I'm in · Rematch";
  if (!$("result-dialog").open) $("result-dialog").showModal();
  render();
  updateRematch();
  tick = setInterval(updateRematch, 100);
  rematchPlans = roster
    .filter((p) => p.isBot)
    .map((bot) => {
      const accepts = random() < personalities[bot.id].rematch;
      trace("bot-rematch-plan", { player: bot.id, accepts });
      return { id: bot.id, accepts, at: Date.now() + 800 + random() * 5500 };
    });
  scheduleRematchVotes();
}
function scheduleRematchVotes() {
  const s = game.snapshot();
  if (s.phase !== "rematch") return;
  for (const plan of rematchPlans)
    if (plan.accepts && !s.ready.includes(plan.id))
      later(() => vote(plan.id), Math.max(0, plan.at - Date.now()));
}

function updateRematch() {
  if (!game) return;
  if (game.expire()) trace("rematch-expired", { ready: game.snapshot().ready });
  const s = game.snapshot();
  if (!["rematch", "expired"].includes(s.phase)) return;
  $("roulette-four").dataset.phase = s.phase;
  const seconds = Math.max(
    0,
    Math.ceil((s.rematchDeadline - Date.now()) / 1000),
  );
  $("countdown").textContent = `${seconds}s`;
  // Keep avatar nodes stable while only the countdown changes.
  const voteKey = `${s.round}:${s.ready.join(",")}`;
  if ($("ready-bubbles").dataset.votes !== voteKey) {
    $("ready-bubbles").dataset.votes = voteKey;
    $("ready-bubbles").innerHTML = s.order
      .map(
        (id) =>
          `<span class="ready-bubble ${s.ready.includes(id) ? "ready" : ""}" aria-label="${esc(player(id).name)}: ${s.ready.includes(id) ? "ready" : "waiting"}" title="${esc(player(id).name)}">${avatar(player(id), "")}</span>`,
      )
      .join("");
  }
  $("ready-label").textContent =
    s.phase === "expired"
      ? "Rematch expired. Find a new table to play again."
      : `${s.ready.length}/4 ready · all four must accept`;
  if (s.phase === "expired") {
    clearInterval(tick);
    $("rematch").disabled = true;
    $("rematch").textContent = "Rematch expired";
  }
}
function vote(id) {
  if (!game) return;
  const allReady = game.vote(id);
  updateRematch();
  trace("rematch-vote", {
    player: id,
    ready: game.snapshot().ready,
    phase: game.snapshot().phase,
    allReady,
  });
  if (
    game.snapshot().phase === "rematch" &&
    game.snapshot().ready.includes("you")
  ) {
    $("rematch").disabled = true;
    $("rematch").textContent = "You’re in · waiting for everyone";
  }
  if (allReady) startRound();
}
function newTable() {
  stopTimers();
  buildRoster();
  roundNumber = 0;
  tableNumber++;
  startRound();
}

$("join-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (joining) return;
  joining = true;
  const token = generation,
    button = $("join-form").querySelector("button");
  button.disabled = true;
  button.textContent = "Preparing the table…";
  try {
    await Promise.all([tableAudio.unlock(), gun.ready()]);
    if (token === generation) newTable();
  } catch {
    toast("The table could not load. Please try again.");
  } finally {
    joining = false;
    button.disabled = false;
    button.textContent = "Take a seat";
  }
});
$("gun-options").addEventListener("change", async (event) => {
  if (busy) return;
  const token = generation;
  busy = true;
  render();
  await gun.select(event.target.value);
  if (generation !== token) return;
  busy = false;
  render();
  scheduleBot();
});
$("shoot").addEventListener("click", () => act("you", "shoot"));
$("spin").addEventListener("click", () => act("you", "spin"));
$("pass").addEventListener("click", () => act("you", "pass"));
$("rematch").addEventListener("click", () => vote("you"));
$("new-table").addEventListener("click", () =>
  game ? newTable() : $("welcome").showModal(),
);
$("result-new-table").addEventListener("click", newTable);
$("view-table").addEventListener("click", () => $("result-dialog").close());
$("reopen-results").addEventListener("click", () => {
  if (
    game &&
    ["rematch", "expired"].includes(game.snapshot().phase) &&
    !$("result-dialog").open
  )
    $("result-dialog").showModal();
});
$("sound").addEventListener("click", () => {
  muted = !muted;
  $("sound").textContent = muted ? "Sound off" : "Sound on";
  $("sound").setAttribute("aria-pressed", String(!muted));
  tableAudio.mute(muted);
  if (!muted) tableAudio.unlock();
});
$("rules").addEventListener("click", () => $("rules-dialog").showModal());
$("close-rules").addEventListener("click", () => $("rules-dialog").close());
$("welcome").addEventListener("cancel", (event) => event.preventDefault());
window.addEventListener("pagehide", () => {
  if (pendingShot) pendingShotResolve?.();
  stopTimers();
  resumeResults = true;
});
window.addEventListener("pageshow", (event) => {
  if (!event.persisted || !resumeResults || !game) return;
  resumeResults = false;
  busy = false;
  const s = game.snapshot();
  if (s.phase === "opening") {
    $("gun").style.transitionDuration = "0ms";
    game.begin();
    startTurnClock();
    $("opening").hidden = true;
    render();
    scheduleBot();
  } else if (s.phase === "playing") {
    startTurnClock();
    if (!checkTurnClock()) {
      render();
      scheduleBot();
    }
  } else if (s.phase === "complete") showResults();
  else {
    updateRematch();
    scheduleRematchVotes();
    tick = setInterval(updateRematch, 100);
  }
});
buildRoster();
game = new Round(roster);
mountSeats(game.snapshot());
render();
$("turn-label").textContent = "Take a seat";
$("turn-hint").textContent = "One bullet. Six chambers. One shared pot.";
$("roulette-four").dataset.phase = "lobby";
$("welcome").showModal();
async function connectProfile() {
  const join = $("join-form").querySelector("button");
  join.disabled = true;
  $("profile-status").textContent = "Loading your Torn profile…";
  const loaded = await loadProfile();
  connectedProfile = loaded.profile || null;
  if (connectedProfile) {
    $("profile-name").textContent = connectedProfile.name;
    $("profile-status").textContent =
      "Connected to Torn · your profile picture and character are automatic.";
    $("profile-preview").src = connectedProfile.avatar || asset("amber.svg");
    $("profile-preview").hidden = false;
  } else {
    $("profile-name").textContent = "Guest";
    $("profile-status").textContent = loaded.message;
  }
  trace("profile-loaded", { status: loaded.status });
  join.disabled = false;
}
document.addEventListener(
  "error",
  (event) => {
    if (
      event.target instanceof HTMLImageElement &&
      !event.target.src.endsWith("/amber.svg") &&
      event.target.matches(
        ".avatar,.tv-screen img,.ready-bubble img,#profile-preview",
      )
    )
      event.target.src = asset("amber.svg");
  },
  true,
);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) tableAudio.stop();
});
animateRoom();
connectProfile();
console.info(`${VERSION}: four-player bot practice ready`);
