"use strict";

(() => {
  const MODE = "blackjackduel";
  const STATE_EVENT = "blackjackduel:state";
  const SUIT_SYMBOL = { clubs: "♣", diamonds: "♦", hearts: "♥", spades: "♠" };
  let latestGame = null;
  let timer = 0;
  let pending = false;
  let pendingAction = "";
  let lastRoot = null;
  let lastRenderSignature = "";
  let shownCards = { gameId: "", roundId: "", me: 0, opponent: 0 };

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, token => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[token]);
  }

  function cardHtml(card = {}, index = 0, { seat = "player", justDealt = false } = {}) {
    const motionClass = justDealt ? ` just-dealt to-${seat}` : "";
    if (card.hidden) return `<div class="bjd-card hidden${motionClass}" style="--card-i:${index}" aria-label="Hidden card"><span>Blackjack Duel</span></div>`;
    const suit = String(card.suit || "spades");
    const symbol = SUIT_SYMBOL[suit] || "♠";
    const red = suit === "hearts" || suit === "diamonds";
    return `<div class="bjd-card ${red ? "red" : "black"}${motionClass}" style="--card-i:${index}" aria-label="${escapeHtml(card.rank)} of ${escapeHtml(suit)}">
      <span class="bjd-card-corner"><b>${escapeHtml(card.rank)}</b><i>${symbol}</i></span>
      <span class="bjd-card-suit">${symbol}</span>
      <span class="bjd-card-corner bottom"><b>${escapeHtml(card.rank)}</b><i>${symbol}</i></span>
    </div>`;
  }

  function handHtml(hand = {}, hidden = false, seat = "player", previousCount = 0) {
    const cards = Array.isArray(hand.cards) ? hand.cards : [];
    const total = hand.total === null || hand.total === undefined ? "?" : String(hand.total);
    const label = hidden ? "PRIVATE HAND" : hand.status === "blackjack" ? "NATURAL BLACKJACK" : hand.status === "bust" ? "BUST" : hand.status === "twentyone" ? "21" : hand.status === "timeout" ? "AUTO-STAND" : hand.status === "stand" ? "STANDING" : hand.soft ? `SOFT ${total}` : total;
    return `<div class="bjd-hand ${hidden ? "concealed" : ""}">
      <div class="bjd-hand-cards">${cards.map((card, index) => cardHtml(card, index, { seat, justDealt: index >= previousCount })).join("")}</div>
      <div class="bjd-hand-total">${escapeHtml(label)}</div>
    </div>`;
  }

  function undealtHandHtml(label = "DEALS AT GO") {
    return `<div class="bjd-hand concealed undealt">
      <div class="bjd-hand-cards">${cardHtml({ hidden: true }, 0)}${cardHtml({ hidden: true }, 1)}</div>
      <div class="bjd-hand-total">${escapeHtml(label)}</div>
    </div>`;
  }

  function deckHtml(drawing = false) {
    return `<div class="bjd-deck${drawing ? " drawing" : ""}" aria-label="Shared server deck">
      <span class="bjd-deck-card back"></span><span class="bjd-deck-card middle"></span><span class="bjd-deck-card top"></span>
      <b>SHARED DECK</b>
    </div>`;
  }

  function cardCountLabel(count) {
    return `${count} ${count === 1 ? "CARD" : "CARDS"}`;
  }

  function renderSignature(game, state, dealing) {
    return JSON.stringify({
      gameId: game.gameId,
      status: game.status,
      pot: game.pot || game.wager || 0,
      tie: Boolean(game.tie),
      winnerUserId: game.winnerUserId || "",
      payout: game.payout || 0,
      roundId: state.roundId || "",
      me: state.me || null,
      opponent: state.opponent || null,
      opponentName: state.opponentName || "",
      canHit: Boolean(state.canHit),
      canStand: Boolean(state.canStand),
      dealing,
      pending,
      pendingAction
    });
  }

  function resultHtml(game) {
    if (game.status !== "complete") return "";
    const meId = String(localStorage.getItem("tornVisitorUserId") || "");
    const won = Boolean(game.winnerUserId && String(game.winnerUserId) === meId);
    const title = game.tie ? "PUSH" : won ? "YOU WIN" : "YOU LOSE";
    const message = game.tie ? "Equal hands. Both stakes returned." : won ? `Shared pot paid: ${Number(game.payout || 0).toLocaleString()} Tickets` : "The opponent finished closer to 21.";
    return `<div class="bjd-result ${game.tie ? "tie" : won ? "win" : "lose"}">
      <div class="bjd-result-kicker">BLACKJACK DUEL</div>
      <h2>${title}</h2>
      <p>${escapeHtml(message)}</p>
      <div class="bjd-result-actions"><button class="gold" data-bjd-rematch type="button">Rematch</button><button class="secondary" data-bjd-new-game type="button">New Game</button></div>
    </div>`;
  }

  function controlsHtml(game, state, dealing) {
    if (dealing) return `<div class="bjd-pregame"><b>${game.status === "countdown" ? "CARDS DEAL AT GO" : "DEALING CARDS…"}</b><span>Hit and Stand unlock after your private cards arrive.</span></div>`;
    if (game.status === "complete") return "";
    const canAct = Boolean(state.canHit || state.canStand) && !pending;
    if (!state.canHit && !state.canStand && !pending) return `<div class="bjd-pregame locked"><b>YOUR HAND IS LOCKED</b><span>Waiting for the opponent to finish. Their cards stay hidden until the result.</span></div>`;
    const message = pending
      ? pendingAction === "hit" ? "Hit sent — drawing one card…" : "Stand sent — locking your hand…"
      : canAct ? "Choose now. Your opponent cannot see your cards or your choice." : "Waiting for the server…";
    return `<div class="bjd-controls${pending ? " pending" : ""}">
      <button class="bjd-action hit" data-bjd-action="hit" type="button" ${state.canHit && !pending ? "" : "disabled"}><span>${pendingAction === "hit" ? "Drawing…" : "Hit"}</span><small>Draw one card</small></button>
      <button class="bjd-action stand" data-bjd-action="stand" type="button" ${state.canStand && !pending ? "" : "disabled"}><span>${pendingAction === "stand" ? "Locking…" : "Stand"}</span><small>Keep this total</small></button>
      <p aria-live="polite">${escapeHtml(message)}</p>
    </div>`;
  }

  function render(game) {
    if (!game || game.mode !== MODE) return;
    latestGame = game;
    const root = document.querySelector("[data-blackjack-duel-mount]");
    if (!root) return;
    const state = game.blackjackDuelState || {};
    const countdown = game.status === "countdown";
    const dealing = countdown || !state.me;
    const clockTarget = countdown ? game.startAt : state.deadlineAt;
    const seconds = countdown ? Math.max(0, Number(game.countdownSeconds || 0)) : Math.max(0, Number(state.secondsLeft || 0));
    const serverNowMs = Date.parse(String(game.serverNow || ""));
    const clockOffset = Number.isFinite(serverNowMs) ? serverNowMs - Date.now() : 0;
    const signature = renderSignature(game, state, dealing);
    if (root === lastRoot && signature === lastRenderSignature) {
      const clock = root.querySelector("[data-bjd-clock]");
      if (clock) {
        clock.dataset.target = String(clockTarget || "");
        clock.dataset.clockOffset = String(clockOffset);
      }
      return;
    }
    const roundId = String(state.roundId || "");
    const sameRound = root === lastRoot && shownCards.gameId === String(game.gameId || "") && shownCards.roundId === roundId;
    const meCards = Array.isArray(state.me?.cards) ? state.me.cards : [];
    const opponentCards = Array.isArray(state.opponent?.cards) ? state.opponent.cards : [];
    const previousMeCount = sameRound ? shownCards.me : 0;
    const previousOpponentCount = sameRound ? shownCards.opponent : 0;
    const opponentHand = dealing ? undealtHandHtml() : handHtml(state.opponent || {}, game.status !== "complete", "opponent", previousOpponentCount);
    const playerHand = dealing ? undealtHandHtml("YOUR CARDS DEAL AT GO") : handHtml(state.me || {}, false, "player", previousMeCount);
    root.innerHTML = `<section class="bjd-game${pendingAction === "hit" ? " is-drawing" : ""}" data-bjd-game-id="${escapeHtml(game.gameId)}" data-bjd-round-id="${escapeHtml(roundId)}">
      <header class="bjd-header"><div><span>NO DEALER</span><h2>Blackjack Duel</h2></div><div class="bjd-pot"><img src="/assets/blackjack-duel/images/chip-stack.png" alt=""><span>Shared pot</span><b>${Number(game.pot || game.wager || 0).toLocaleString()}</b></div></header>
      <div class="bjd-howto"><b>Get closer to 21 than your opponent without busting.</b><span>A natural two-card blackjack beats an ordinary 21. Equal results push.</span></div>
      <div class="bjd-table">
        <div class="bjd-seat player"><div class="bjd-seat-label"><span>YOUR HAND</span><b>${escapeHtml(dealing ? "GET READY" : state.me?.status === "active" ? "CHOOSE" : "LOCKED")}</b><em>${cardCountLabel(dealing ? 2 : meCards.length)}</em></div>${playerHand}</div>
        <div class="bjd-center">${deckHtml(pendingAction === "hit")}<span class="bjd-clock-label">${countdown ? "round begins in" : "time to choose"}</span><div class="bjd-clock" data-bjd-clock data-clock-kind="${countdown ? "countdown" : "decision"}" data-target="${escapeHtml(clockTarget || "")}" data-clock-offset="${clockOffset}">${seconds}</div><span>seconds</span><i>${countdown ? "Cards arrive when the round begins" : "Cards fly from this deck to each hand"}</i></div>
        <div class="bjd-seat opponent"><div class="bjd-seat-label"><span>${escapeHtml(state.opponentName || game.joiner?.name || "Opponent")}</span><b>PRIVATE</b><em>${cardCountLabel(dealing ? 2 : opponentCards.length)}</em></div>${opponentHand}</div>
      </div>
      ${controlsHtml(game, state, dealing)}
      ${resultHtml(game)}
      <footer class="bjd-proof">Deck commitment <code>${escapeHtml(String(state.deckCommitment || "").slice(0, 18))}${state.deckCommitment ? "…" : " pending"}</code></footer>
    </section>`;
    lastRoot = root;
    lastRenderSignature = signature;
    shownCards = { gameId: String(game.gameId || ""), roundId, me: dealing ? 0 : meCards.length, opponent: dealing ? 0 : opponentCards.length };
    bind(root, game);
    startClock();
  }

  function actionId(action) {
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    return `blackjack-${action}-${Date.now()}-${[...bytes].map(value => value.toString(16).padStart(2, "0")).join("")}`;
  }

  function bind(root, game) {
    root.querySelectorAll("[data-bjd-action]").forEach(button => button.addEventListener("click", async () => {
      if (pending || !window.__blackjackDuelBridge?.submit) return;
      pending = true;
      pendingAction = String(button.dataset.bjdAction || "");
      render(latestGame || game);
      let responseGame = null;
      try {
        const response = await window.__blackjackDuelBridge.submit({
          choice: `blackjackduel:${button.dataset.bjdAction}`,
          actionId: actionId(button.dataset.bjdAction)
        });
        if (response?.game) responseGame = response.game;
      } catch (error) {
        if (typeof window.duelSetStatus === "function") window.duelSetStatus(error.message || "Unable to submit Blackjack Duel action.", "bad");
      } finally {
        pending = false;
        pendingAction = "";
        render(responseGame || latestGame || game);
      }
    }));
    root.querySelector("[data-bjd-rematch]")?.addEventListener("click", () => window.__blackjackDuelBridge?.rematch?.());
    root.querySelector("[data-bjd-new-game]")?.addEventListener("click", () => window.__blackjackDuelBridge?.newGame?.());
  }

  function startClock() {
    if (timer) clearInterval(timer);
    timer = setInterval(() => {
      const node = document.querySelector("[data-bjd-clock]");
      if (!node) return;
      const target = Date.parse(node.dataset.target || "");
      if (!Number.isFinite(target)) return;
      const clockOffset = Number(node.dataset.clockOffset || 0);
      const seconds = Math.max(0, Math.ceil((target - (Date.now() + clockOffset)) / 1000));
      node.textContent = String(seconds);
      node.classList.toggle("urgent", node.dataset.clockKind === "decision" && seconds <= 5);
      if (seconds === 0) {
        clearInterval(timer);
        timer = 0;
        window.__blackjackDuelBridge?.refresh?.();
      }
    }, 200);
  }

  window.addEventListener(STATE_EVENT, event => render(event.detail?.game));
  window.BLACKJACK_DUEL_UI = Object.freeze({ mode: MODE, render });
})();
