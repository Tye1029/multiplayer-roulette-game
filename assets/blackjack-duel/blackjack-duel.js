"use strict";

(() => {
  const MODE = "blackjackduel";
  const STATE_EVENT = "blackjackduel:state";
  const SUIT_SYMBOL = { clubs: "♣", diamonds: "♦", hearts: "♥", spades: "♠" };
  let latestGame = null;
  let timer = 0;
  let pending = false;
  let pendingAction = "";
  let openingDealTimer = 0;
  let pushRestartRequestedFor = "";
  let doubleOfferUi = { gameId: "", expiresAt: "" };
  let lastRoot = null;
  let lastRenderSignature = "";
  let shownCards = { gameId: "", roundId: "", me: 0, opponent: 0 };
  const dealAnimationLedger = new Map();

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, token => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[token]);
  }

  function cardHtml(card = {}, index = 0, { seat = "player", justDealt = false, dealSequence = 0 } = {}) {
    const motionAttribute = justDealt ? ` data-bjd-deal="${seat}" data-bjd-deal-sequence="${Math.max(0, Number(dealSequence) || 0)}"` : "";
    if (card.hidden) return `<div class="bjd-card hidden"${motionAttribute} style="--card-i:${index}" aria-label="Hidden card"><span>Blackjack Duel</span></div>`;
    const suit = String(card.suit || "spades");
    const symbol = SUIT_SYMBOL[suit] || "♠";
    const red = suit === "hearts" || suit === "diamonds";
    return `<div class="bjd-card ${red ? "red" : "black"}"${motionAttribute} style="--card-i:${index}" aria-label="${escapeHtml(card.rank)} of ${escapeHtml(suit)}">
      <span class="bjd-card-corner"><b>${escapeHtml(card.rank)}</b><i>${symbol}</i></span>
      <span class="bjd-card-suit">${symbol}</span>
      <span class="bjd-card-corner bottom"><b>${escapeHtml(card.rank)}</b><i>${symbol}</i></span>
    </div>`;
  }

  function handHtml(hand = {}, hidden = false, seat = "player", previousCount = 0, final = false) {
    const cards = Array.isArray(hand.cards) ? hand.cards : [];
    const openingDeal = !final && previousCount === 0 && cards.length >= 2;
    const total = hand.total === null || hand.total === undefined ? "?" : String(hand.total);
    const finalSuffix = hand.status === "blackjack" ? " · BLACKJACK" : hand.status === "bust" ? " · BUST" : "";
    const label = hidden ? "PRIVATE HAND" : final ? `${total}${finalSuffix}` : hand.status === "blackjack" ? "NATURAL BLACKJACK" : hand.status === "bust" ? "BUST" : hand.status === "twentyone" ? "21" : hand.status === "timeout" ? "AUTO-STAND" : hand.status === "stand" ? total : hand.soft ? `SOFT ${total}` : total;
    return `<div class="bjd-hand ${hidden ? "concealed" : ""}">
      <div class="bjd-hand-cards">${cards.map((card, index) => cardHtml(card, index, {
        seat,
        justDealt: !final && index >= previousCount,
        dealSequence: openingDeal ? index * 2 + (seat === "opponent" ? 1 : 0) : Math.max(0, index - previousCount)
      })).join("")}</div>
      <div class="bjd-hand-total">${escapeHtml(label)}</div>
    </div>`;
  }

  function handLabel(hand = {}, hidden = false) {
    if (hidden) return "PRIVATE HAND";
    const total = hand.total === null || hand.total === undefined ? "?" : String(hand.total);
    return hand.status === "blackjack" ? "NATURAL BLACKJACK" : hand.status === "bust" ? "BUST" : hand.status === "twentyone" ? "21" : hand.status === "timeout" ? "AUTO-STAND" : hand.status === "stand" ? "STANDING" : hand.soft ? `SOFT ${total}` : total;
  }

  function undealtHandHtml(label = "DEALS AT GO") {
    return `<div class="bjd-hand concealed undealt">
      <div class="bjd-hand-cards awaiting-deal" aria-label="Cards will deal from the shared deck"></div>
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

  function dealLedgerKey(gameId, roundId) {
    return `${String(gameId || "")}:${String(roundId || "")}`;
  }

  function animatedCardCounts(gameId, roundId) {
    return dealAnimationLedger.get(dealLedgerKey(gameId, roundId)) || { me: 0, opponent: 0 };
  }

  function rememberAnimatedCards(gameId, roundId, me, opponent) {
    const key = dealLedgerKey(gameId, roundId);
    dealAnimationLedger.set(key, { me: Math.max(0, Number(me) || 0), opponent: Math.max(0, Number(opponent) || 0) });
    while (dealAnimationLedger.size > 16) dealAnimationLedger.delete(dealAnimationLedger.keys().next().value);
  }

  function animatePendingDeals(scope) {
    const deck = scope?.querySelector?.(".bjd-deck .top");
    const cards = [...(scope?.querySelectorAll?.("[data-bjd-deal]") || [])]
      .sort((a, b) => Number(a.dataset.bjdDealSequence || 0) - Number(b.dataset.bjdDealSequence || 0));
    if (!deck || !cards.length) return;
    const deckRect = deck.getBoundingClientRect();
    const maxSequence = cards.reduce((highest, card) => Math.max(highest, Number(card.dataset.bjdDealSequence || 0)), 0);
    const openingDeal = cards.length >= 4 && maxSequence >= 3;
    if (openingDeal) {
      if (openingDealTimer) clearTimeout(openingDealTimer);
      scope.classList.add("is-opening-deal");
      scope.querySelectorAll("[data-bjd-action]").forEach(button => { button.disabled = true; });
      const status = scope.querySelector(".bjd-controls p");
      if (status) status.textContent = "Opening deal in progress…";
      openingDealTimer = setTimeout(() => {
        openingDealTimer = 0;
        if (!scope.isConnected) return;
        scope.classList.remove("is-opening-deal");
        const currentState = latestGame?.blackjackDuelState || {};
        scope.querySelectorAll("[data-bjd-action]").forEach(button => {
          const action = String(button.dataset.bjdAction || "");
          button.disabled = pending || (action === "hit" ? !currentState.canHit : !currentState.canStand);
        });
        const currentStatus = scope.querySelector(".bjd-controls p");
        if (currentStatus) currentStatus.textContent = "Choose now. Your opponent cannot see your cards or your choice.";
      }, maxSequence * 170 + 640);
    }
    cards.forEach((card, fallbackSequence) => {
      const seat = String(card.dataset.bjdDeal || "player");
      const sequence = Math.max(0, Number(card.dataset.bjdDealSequence ?? fallbackSequence) || 0);
      const cardRect = card.getBoundingClientRect();
      const deltaX = deckRect.left + deckRect.width / 2 - (cardRect.left + cardRect.width / 2);
      const deltaY = deckRect.top + deckRect.height / 2 - (cardRect.top + cardRect.height / 2);
      delete card.dataset.bjdDeal;
      delete card.dataset.bjdDealSequence;
      card.style.setProperty("--deal-x", `${deltaX}px`);
      card.style.setProperty("--deal-y", `${deltaY}px`);
      card.style.setProperty("--deal-delay", `${sequence * 170}ms`);
      card.classList.add("just-dealt", `to-${seat}`);
      card.addEventListener("animationend", () => {
        card.classList.remove("just-dealt", `to-${seat}`);
        card.style.removeProperty("--deal-x");
        card.style.removeProperty("--deal-y");
        card.style.removeProperty("--deal-delay");
      }, { once: true });
    });
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
      completedAt: state.completedAt || game.completedAt || "",
      canHit: Boolean(state.canHit),
      canStand: Boolean(state.canStand),
      dealing,
      rematch: game.rematch || null,
      rematchGameId: game.rematchGameId || ""
    });
  }

  function avatarHtml(player = {}, accepted = false) {
    const name = String(player.name || "Player");
    const playerId = String(player.userId || "");
    const fallback = escapeHtml(name.trim().slice(0, 1).toUpperCase() || "?");
    const picture = player.avatarUrl
      ? `<img src="${escapeHtml(player.avatarUrl)}" alt="${escapeHtml(name)}">`
      : `<span>${fallback}</span>`;
    return `<div class="bjd-double-player${accepted ? " accepted" : ""}" data-bjd-double-player-id="${escapeHtml(playerId)}">${picture}<b>${escapeHtml(name)}</b><em>${accepted ? "✓ ACCEPTED" : "WAITING"}</em></div>`;
  }

  function doublePanelState(game, meId) {
    const rematch = game.rematch && typeof game.rematch === "object" ? game.rematch : {};
    const requested = rematch.requestedBy && typeof rematch.requestedBy === "object" ? rematch.requestedBy : {};
    const authoritativeExpiresAt = String(rematch.expiresAt || "");
    const authoritativeExpiresMs = Date.parse(authoritativeExpiresAt);
    const authoritativeActive = rematch.kind === "double-or-nothing" && Number.isFinite(authoritativeExpiresMs) && authoritativeExpiresMs > Date.now();
    const localMatches = doubleOfferUi.gameId === String(game.gameId || "");
    const localExpiresAt = localMatches ? String(doubleOfferUi.expiresAt || "") : "";
    const localExpiresMs = Date.parse(localExpiresAt);
    const localActive = Number.isFinite(localExpiresMs) && localExpiresMs > Date.now();
    const activeDouble = authoritativeActive || localActive;
    const useLocalDeadline = authoritativeActive && Number.isFinite(localExpiresMs) && localExpiresMs < authoritativeExpiresMs;
    const expiresAt = useLocalDeadline || !authoritativeActive ? localExpiresAt : authoritativeExpiresAt;
    const expiresMs = Date.parse(expiresAt);
    const optimisticMe = localActive && String(meId || "");
    const creatorId = String(game.creator?.userId || "");
    const joinerId = String(game.joiner?.userId || "");
    const creatorAccepted = Boolean(requested[creatorId] || optimisticMe === creatorId);
    const joinerAccepted = Boolean(requested[joinerId] || optimisticMe === joinerId);
    const myAccepted = Boolean(requested[meId] || optimisticMe === meId);
    return { activeDouble, expiresAt, expiresMs, creatorAccepted, joinerAccepted, myAccepted };
  }

  function doublePanelHtml(game, meId) {
    const view = doublePanelState(game, meId);
    return `<div class="bjd-double">
      <div class="bjd-double-title"><b>DOUBLE OR NOTHING</b><span>${view.activeDouble ? "Both players must accept before time runs out." : `Play again for ${Number(game.wager || 0) * 2} Tickets each.`}</span></div>
      <div class="bjd-double-players">${avatarHtml(game.creator, view.creatorAccepted)}<strong>VS</strong>${avatarHtml(game.joiner, view.joinerAccepted)}</div>
      <div class="bjd-double-countdown${view.activeDouble ? " is-active" : ""}" aria-hidden="${view.activeDouble ? "false" : "true"}"><span>Agreement closes in</span><b data-bjd-double-clock data-target="${view.activeDouble ? escapeHtml(view.expiresAt) : ""}">${view.activeDouble ? Math.max(0, Math.ceil((view.expiresMs - Date.now()) / 1000)) : 5}</b></div>
      <button class="gold bjd-double-button" data-bjd-double type="button" ${view.myAccepted && view.activeDouble ? "disabled" : ""}>${view.myAccepted && view.activeDouble ? "ACCEPTED — WAITING" : "DOUBLE OR NOTHING"}</button>
    </div>`;
  }

  function patchDoublePanel(panel, game, meId) {
    if (!panel) return;
    const view = doublePanelState(game, meId);
    const title = panel.querySelector(".bjd-double-title span");
    if (title) title.textContent = view.activeDouble ? "Both players must accept before time runs out." : `Play again for ${Number(game.wager || 0) * 2} Tickets each.`;
    const acceptedIds = new Set([
      view.creatorAccepted ? String(game.creator?.userId || "") : "",
      view.joinerAccepted ? String(game.joiner?.userId || "") : ""
    ].filter(Boolean));
    panel.querySelectorAll("[data-bjd-double-player-id]").forEach(player => {
      const accepted = acceptedIds.has(String(player.dataset.bjdDoublePlayerId || ""));
      player.classList.toggle("accepted", accepted);
      const status = player.querySelector("em");
      if (status) status.textContent = accepted ? "✓ ACCEPTED" : "WAITING";
    });
    const countdown = panel.querySelector(".bjd-double-countdown");
    countdown?.classList.toggle("is-active", view.activeDouble);
    countdown?.setAttribute("aria-hidden", view.activeDouble ? "false" : "true");
    const clock = panel.querySelector("[data-bjd-double-clock]");
    if (clock) {
      clock.dataset.target = view.activeDouble ? view.expiresAt : "";
      clock.textContent = view.activeDouble ? String(Math.max(0, Math.ceil((view.expiresMs - Date.now()) / 1000))) : "5";
    }
    const button = panel.querySelector("[data-bjd-double]");
    if (button) {
      button.disabled = Boolean(view.myAccepted && view.activeDouble);
      button.textContent = view.myAccepted && view.activeDouble ? "ACCEPTED — WAITING" : "DOUBLE OR NOTHING";
    }
  }

  function resultHtml(game) {
    if (game.status !== "complete") return "";
    const me = game.isCreator ? game.creator : game.joiner;
    const meId = String(me?.userId || "");
    const won = Boolean(game.winnerUserId && String(game.winnerUserId) === meId);
    const title = game.tie ? "PUSH" : won ? "YOU WIN" : "YOU LOSE";
    const message = game.tie ? "Equal hands. Both stakes returned." : won ? `Shared pot paid: ${Number(game.payout || 0).toLocaleString()} Tickets` : "The opponent finished closer to 21.";
    const state = game.blackjackDuelState || {};
    const myTotal = state.me?.total ?? "?";
    const opponentTotal = state.opponent?.total ?? "?";
    const opponentName = String(state.opponentName || (game.isCreator ? game.joiner?.name : game.creator?.name) || "Opponent");
    const doublePanel = doublePanelHtml(game, meId);
    const completedMs = Date.parse(state.completedAt || game.completedAt || "");
    const pushRestartAt = game.tie && Number.isFinite(completedMs) ? new Date(completedMs + 5000).toISOString() : "";
    const pushSeconds = pushRestartAt ? Math.max(0, Math.ceil((Date.parse(pushRestartAt) - Date.now()) / 1000)) : 5;
    return `<div class="bjd-result ${game.tie ? "tie" : won ? "win" : "lose"}">
      <div class="bjd-result-kicker">BLACKJACK DUEL</div>
      <h2>${title}</h2>
      <p>${escapeHtml(message)}</p>
      <div class="bjd-final-totals"><span><b>YOU</b><strong>${escapeHtml(myTotal)}</strong></span><i>FINAL</i><span><b>${escapeHtml(opponentName)}</b><strong>${escapeHtml(opponentTotal)}</strong></span></div>
      ${game.tie ? `<div class="bjd-push-restart"><span>NEW ROUND IN</span><b data-bjd-push-clock data-target="${escapeHtml(pushRestartAt)}">${pushSeconds}</b></div>` : ""}
      ${doublePanel}
      <div class="bjd-result-actions">${game.tie ? "" : '<button class="gold" data-bjd-rematch type="button">Rematch</button>'}<button class="secondary" data-bjd-new-game type="button">New Game</button></div>
    </div>`;
  }

  function controlsHtml(game, state, dealing) {
    if (dealing) return `<div class="bjd-pregame"><b>${game.status === "countdown" ? "CARDS DEAL AT GO" : "DEALING CARDS…"}</b></div>`;
    if (game.status === "complete") return "";
    const canAct = Boolean(state.canHit || state.canStand) && !pending;
    if (!state.canHit && !state.canStand && !pending) return `<div class="bjd-pregame locked"><b>YOUR HAND IS SET</b><span>Waiting for the 20-second reveal. The other hand stays a mystery until then.</span></div>`;
    const message = pending
      ? pendingAction === "hit" ? "Hit sent — drawing one card…" : "Stand sent — saving your total…"
      : canAct ? "Choose now. Your opponent cannot see your cards or your choice." : "Waiting for the server…";
    return `<div class="bjd-controls${pending ? " pending" : ""}">
      <button class="bjd-action hit" data-bjd-action="hit" type="button" ${state.canHit && !pending ? "" : "disabled"}><span>${pendingAction === "hit" ? "Drawing…" : "Hit"}</span><small>Draw one card</small></button>
      <button class="bjd-action stand" data-bjd-action="stand" type="button" ${state.canStand && !pending ? "" : "disabled"}><span>${pendingAction === "stand" ? "Saving…" : "Stand"}</span><small>Keep this total</small></button>
      <p aria-live="polite">${escapeHtml(message)}</p>
    </div>`;
  }

  function render(game) {
    if (!game || game.mode !== MODE) return;
    if (doubleOfferUi.gameId && doubleOfferUi.gameId !== String(game.gameId || "")) doubleOfferUi = { gameId: "", expiresAt: "" };
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
    const animatedCounts = animatedCardCounts(game.gameId, roundId);
    const liveSection = root.querySelector(".bjd-game");
    const canPatchLive = sameRound && game.status === "playing" && liveSection && !liveSection.querySelector(".bjd-result");
    if (canPatchLive) {
      const appendCards = (selector, cards, seat, animateFrom) => {
        const host = liveSection.querySelector(selector);
        if (!host || host.children.length > cards.length) return false;
        const openingDeal = animateFrom === 0 && cards.length >= 2;
        if (cards.length) host.classList.remove("awaiting-deal");
        for (let index = host.children.length; index < cards.length; index += 1) {
          host.insertAdjacentHTML("beforeend", cardHtml(cards[index], index, {
            seat,
            justDealt: index >= animateFrom,
            dealSequence: openingDeal ? index * 2 + (seat === "opponent" ? 1 : 0) : Math.max(0, index - animateFrom)
          }));
        }
        return true;
      };
      if (appendCards(".bjd-seat.player .bjd-hand-cards", meCards, "player", animatedCounts.me) && appendCards(".bjd-seat.opponent .bjd-hand-cards", opponentCards, "opponent", animatedCounts.opponent)) {
        const playerTotal = liveSection.querySelector(".bjd-seat.player .bjd-hand-total");
        const opponentTotal = liveSection.querySelector(".bjd-seat.opponent .bjd-hand-total");
        const playerStatus = liveSection.querySelector(".bjd-seat.player .bjd-seat-label b");
        const playerCount = liveSection.querySelector(".bjd-seat.player .bjd-seat-label em");
        const opponentCount = liveSection.querySelector(".bjd-seat.opponent .bjd-seat-label em");
        const controlsHost = liveSection.querySelector("[data-bjd-controls-host]");
        const clockLabel = liveSection.querySelector(".bjd-clock-label");
        if (playerTotal) playerTotal.textContent = handLabel(state.me || {}, false);
        if (opponentTotal) opponentTotal.textContent = "PRIVATE HAND";
        if (playerStatus) {
          playerStatus.textContent = state.me?.status === "active" ? "CHOOSE" : "";
          playerStatus.hidden = state.me?.status !== "active";
        }
        if (playerCount) playerCount.textContent = cardCountLabel(meCards.length);
        if (opponentCount) opponentCount.textContent = cardCountLabel(opponentCards.length);
        if (clockLabel) clockLabel.textContent = "time to choose";
        if (controlsHost) {
          controlsHost.innerHTML = controlsHtml(game, state, false);
          bind(controlsHost, game);
        }
        liveSection.querySelector(".bjd-deck")?.classList.remove("drawing");
        animatePendingDeals(liveSection);
        rememberAnimatedCards(game.gameId, roundId, meCards.length, opponentCards.length);
        const clock = liveSection.querySelector("[data-bjd-clock]");
        if (clock) {
          clock.dataset.target = String(clockTarget || "");
          clock.dataset.clockOffset = String(clockOffset);
          clock.dataset.clockKind = "decision";
          clock.textContent = String(seconds);
        }
        lastRenderSignature = signature;
        shownCards = { gameId: String(game.gameId || ""), roundId, me: meCards.length, opponent: opponentCards.length };
        startClock();
        return;
      }
    }
    const canPatchComplete = sameRound && game.status === "complete" && liveSection?.querySelector(".bjd-result");
    if (canPatchComplete) {
      const currentDouble = liveSection.querySelector(".bjd-double");
      if (currentDouble) {
        const me = game.isCreator ? game.creator : game.joiner;
        patchDoublePanel(currentDouble, game, String(me?.userId || ""));
        lastRenderSignature = signature;
        startClock();
        return;
      }
    }
    const complete = game.status === "complete";
    const opponentHand = dealing ? undealtHandHtml() : handHtml(state.opponent || {}, !complete, "opponent", animatedCounts.opponent, complete);
    const playerHand = dealing ? undealtHandHtml("YOUR CARDS DEAL AT GO") : handHtml(state.me || {}, false, "player", animatedCounts.me, complete);
    const playerBadge = dealing ? "GET READY" : state.me?.status === "active" ? "CHOOSE" : "";
    const opponentBadge = complete ? "" : "PRIVATE";
    root.innerHTML = `<section class="bjd-game${pendingAction === "hit" ? " is-drawing" : ""}" data-bjd-game-id="${escapeHtml(game.gameId)}" data-bjd-round-id="${escapeHtml(roundId)}">
      <header class="bjd-header"><h2>Blackjack Duel</h2></header>
      <div class="bjd-howto"><b>Get closer to 21 than your opponent without busting.</b><span>Equal hands push.</span></div>
      <div class="bjd-table">
        <div class="bjd-seat player"><div class="bjd-seat-label"><span>YOUR HAND</span>${playerBadge ? `<b>${escapeHtml(playerBadge)}</b>` : ""}<em>${cardCountLabel(dealing ? 0 : meCards.length)}</em></div>${playerHand}</div>
        <div class="bjd-center"><div class="bjd-center-pot"><img src="/assets/blackjack-duel/images/casino-chip-pile-crisp.svg" alt=""><span>SHARED POT</span><b>${Number(game.pot || game.wager || 0).toLocaleString()}</b></div>${deckHtml(pendingAction === "hit")}<span class="bjd-clock-label">${countdown ? "round begins in" : complete ? "final hands" : "time to choose"}</span>${complete ? "" : `<div class="bjd-clock" data-bjd-clock data-clock-kind="${countdown ? "countdown" : "decision"}" data-target="${escapeHtml(clockTarget || "")}" data-clock-offset="${clockOffset}">${seconds}</div><span>seconds</span>`}</div>
        <div class="bjd-seat opponent"><div class="bjd-seat-label"><span>${escapeHtml(state.opponentName || game.joiner?.name || "Opponent")}</span>${opponentBadge ? `<b>${opponentBadge}</b>` : ""}<em>${cardCountLabel(dealing ? 0 : opponentCards.length)}</em></div>${opponentHand}</div>
      </div>
      <div data-bjd-controls-host>${controlsHtml(game, state, dealing)}</div>
      ${resultHtml(game)}
    </section>`;
    lastRoot = root;
    lastRenderSignature = signature;
    shownCards = { gameId: String(game.gameId || ""), roundId, me: dealing ? 0 : meCards.length, opponent: dealing ? 0 : opponentCards.length };
    bind(root, game);
    animatePendingDeals(root);
    if (!dealing) rememberAnimatedCards(game.gameId, roundId, meCards.length, opponentCards.length);
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
      root.querySelectorAll("[data-bjd-action]").forEach(actionButton => { actionButton.disabled = true; });
      root.querySelector(".bjd-deck")?.classList.toggle("drawing", pendingAction === "hit");
      const status = root.querySelector(".bjd-controls p");
      if (status) status.textContent = pendingAction === "hit" ? "Hit sent — drawing one card…" : "Stand sent — saving your total…";
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
    root.querySelector("[data-bjd-double]")?.addEventListener("click", () => {
      const gameId = String(game.gameId || "");
      const pendingExpiry = doubleOfferUi.gameId === gameId ? Date.parse(doubleOfferUi.expiresAt || "") : 0;
      if (Number.isFinite(pendingExpiry) && pendingExpiry > Date.now()) return;
      doubleOfferUi = { gameId, expiresAt: new Date(Date.now() + 5000).toISOString() };
      const me = game.isCreator ? game.creator : game.joiner;
      patchDoublePanel(root.querySelector(".bjd-double"), game, String(me?.userId || ""));
      startClock();
      Promise.resolve(window.__blackjackDuelBridge?.doubleOrNothing?.()).catch(error => {
        if (doubleOfferUi.gameId === gameId) doubleOfferUi = { gameId: "", expiresAt: "" };
        patchDoublePanel(document.querySelector(".bjd-double"), latestGame || game, String(me?.userId || ""));
        if (typeof window.duelSetStatus === "function") window.duelSetStatus(error?.message || "Unable to offer Double or Nothing.", "bad");
      });
    });
    root.querySelector("[data-bjd-new-game]")?.addEventListener("click", () => window.__blackjackDuelBridge?.newGame?.());
  }

  function startClock() {
    if (timer) clearInterval(timer);
    timer = setInterval(() => {
      const node = document.querySelector("[data-bjd-clock]");
      const doubleNode = document.querySelector("[data-bjd-double-clock]");
      const pushNode = document.querySelector("[data-bjd-push-clock]");
      let reachedZero = false;
      if (node) {
        const target = Date.parse(node.dataset.target || "");
        if (Number.isFinite(target)) {
          const clockOffset = Number(node.dataset.clockOffset || 0);
          const seconds = Math.max(0, Math.ceil((target - (Date.now() + clockOffset)) / 1000));
          node.textContent = String(seconds);
          node.classList.toggle("urgent", node.dataset.clockKind === "decision" && seconds <= 5);
          reachedZero = seconds === 0;
        }
      }
      if (doubleNode) {
        const target = Date.parse(doubleNode.dataset.target || "");
        if (Number.isFinite(target)) {
          const seconds = Math.max(0, Math.ceil((target - Date.now()) / 1000));
          doubleNode.textContent = String(seconds);
          reachedZero = reachedZero || seconds === 0;
        }
      }
      if (pushNode) {
        const target = Date.parse(pushNode.dataset.target || "");
        if (Number.isFinite(target)) {
          const seconds = Math.max(0, Math.ceil((target - Date.now()) / 1000));
          pushNode.textContent = String(seconds);
          const gameId = String(latestGame?.gameId || "");
          if (seconds === 0 && latestGame?.tie && gameId && pushRestartRequestedFor !== gameId) {
            pushRestartRequestedFor = gameId;
            Promise.resolve(window.__blackjackDuelBridge?.pushRestart?.()).catch(() => {
              if (pushRestartRequestedFor === gameId) pushRestartRequestedFor = "";
            });
          }
        }
      }
      if (reachedZero) {
        clearInterval(timer);
        timer = 0;
        if (doubleNode) lastRenderSignature = "";
        window.__blackjackDuelBridge?.refresh?.();
      }
    }, 200);
  }

  window.addEventListener(STATE_EVENT, event => render(event.detail?.game));
  window.BLACKJACK_DUEL_UI = Object.freeze({ mode: MODE, render });
})();
