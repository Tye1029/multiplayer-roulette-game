"use strict";

(() => {
  const MODE = "blackjackduel";
  const STATE_EVENT = "blackjackduel:state";
  const SUIT_SYMBOL = { clubs: "♣", diamonds: "♦", hearts: "♥", spades: "♠" };
  let latestGame = null;
  let timer = 0;
  let pending = false;

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, token => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[token]);
  }

  function cardHtml(card = {}, index = 0) {
    if (card.hidden) return `<div class="bjd-card hidden" style="--card-i:${index}" aria-label="Hidden opponent card"><span>Blackjack Duel</span></div>`;
    const suit = String(card.suit || "spades");
    const symbol = SUIT_SYMBOL[suit] || "♠";
    const red = suit === "hearts" || suit === "diamonds";
    return `<div class="bjd-card ${red ? "red" : "black"}" style="--card-i:${index}" aria-label="${escapeHtml(card.rank)} of ${escapeHtml(suit)}">
      <span class="bjd-card-corner"><b>${escapeHtml(card.rank)}</b><i>${symbol}</i></span>
      <span class="bjd-card-suit">${symbol}</span>
      <span class="bjd-card-corner bottom"><b>${escapeHtml(card.rank)}</b><i>${symbol}</i></span>
    </div>`;
  }

  function handHtml(hand = {}, hidden = false) {
    const cards = Array.isArray(hand.cards) ? hand.cards : [];
    const total = hand.total === null || hand.total === undefined ? "?" : String(hand.total);
    const label = hidden ? "PRIVATE HAND" : hand.status === "blackjack" ? "NATURAL BLACKJACK" : hand.status === "bust" ? "BUST" : hand.status === "twentyone" ? "21" : hand.status === "timeout" ? "AUTO-STAND" : hand.status === "stand" ? "STANDING" : hand.soft ? `SOFT ${total}` : total;
    return `<div class="bjd-hand ${hidden ? "concealed" : ""}">
      <div class="bjd-hand-cards">${cards.map(cardHtml).join("")}</div>
      <div class="bjd-hand-total">${escapeHtml(label)}</div>
    </div>`;
  }

  function resultHtml(game, state) {
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

  function render(game) {
    if (!game || game.mode !== MODE) return;
    latestGame = game;
    const root = document.querySelector("[data-blackjack-duel-mount]");
    if (!root) return;
    const state = game.blackjackDuelState || {};
    const seconds = Math.max(0, Number(state.secondsLeft || 0));
    const canAct = Boolean(state.canHit || state.canStand) && !pending;
    root.innerHTML = `<section class="bjd-game" data-bjd-game-id="${escapeHtml(game.gameId)}" data-bjd-round-id="${escapeHtml(state.roundId || "")}">
      <header class="bjd-header"><div><span>NO DEALER</span><h2>Blackjack Duel</h2></div><div class="bjd-pot"><img src="/assets/blackjack-duel/images/chip-stack.png" alt=""><span>Shared pot</span><b>${Number(game.pot || game.wager || 0).toLocaleString()}</b></div></header>
      <div class="bjd-table">
        <div class="bjd-seat opponent"><div class="bjd-seat-label"><span>${escapeHtml(state.opponentName || game.joiner?.name || "Opponent")}</span><b>PRIVATE</b></div>${handHtml(state.opponent || {}, game.status !== "complete")}</div>
        <div class="bjd-center"><div class="bjd-clock" data-bjd-clock data-deadline="${escapeHtml(state.deadlineAt || "")}">${seconds}</div><span>seconds</span><i>Highest hand ≤ 21 wins</i></div>
        <div class="bjd-seat player"><div class="bjd-seat-label"><span>YOUR HAND</span><b>${escapeHtml(state.me?.status === "active" ? "CHOOSE" : "LOCKED")}</b></div>${handHtml(state.me || {})}</div>
      </div>
      <div class="bjd-controls">
        <button class="bjd-action hit" data-bjd-action="hit" type="button" ${state.canHit && !pending ? "" : "disabled"}>Hit</button>
        <button class="bjd-action stand" data-bjd-action="stand" type="button" ${state.canStand && !pending ? "" : "disabled"}>Stand</button>
        <p>${canAct ? "Your opponent cannot see your cards or decisions." : game.status === "complete" ? "Both hands revealed." : "Hand locked. Waiting for the other player."}</p>
      </div>
      ${resultHtml(game, state)}
      <footer class="bjd-proof">Deck commitment <code>${escapeHtml(String(state.deckCommitment || "").slice(0, 18))}…</code></footer>
    </section>`;
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
      root.querySelectorAll("[data-bjd-action]").forEach(item => { item.disabled = true; });
      try {
        const response = await window.__blackjackDuelBridge.submit({
          choice: `blackjackduel:${button.dataset.bjdAction}`,
          actionId: actionId(button.dataset.bjdAction)
        });
        if (response?.game) render(response.game);
      } catch (error) {
        pending = false;
        render(latestGame || game);
        if (typeof window.duelSetStatus === "function") window.duelSetStatus(error.message || "Unable to submit Blackjack Duel action.", "bad");
      } finally {
        pending = false;
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
      const deadline = Date.parse(node.dataset.deadline || "");
      if (!Number.isFinite(deadline)) return;
      const seconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      node.textContent = String(seconds);
      node.classList.toggle("urgent", seconds <= 5);
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
