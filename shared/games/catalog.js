"use strict";

(function publishGameCatalog(root, factory) {
  const catalog = factory();
  if (typeof module === "object" && module.exports) module.exports = catalog;
  if (root && typeof root === "object") root.GAMBLING_SITE_CATALOG = catalog;
})(typeof globalThis === "object" ? globalThis : this, () => {
  const multiplayerModeNames = Object.freeze({
    mines: "Multiplayer Mines Race",
    rps: "Rock Paper Scissors Duel",
    draw: "DRAW! Western Duel",
    fishing: "Rumble Fishing Duel",
    roulette: "Russian Roulette",
    plinko: "Plinko Duel",
    blackjack: "Blackjack 1v1",
    blackjackduel: "Blackjack Duel",
    memory: "Memory Match Duel",
    safecracker: "Safe Cracker Duel",
    mountainrace: "Summit Sprint",
    cardwar: "Card War Strategy",
    coin: "Coin Flip Duel"
  });

  return Object.freeze({
    version: "game-catalog-v1",
    // These are the six modes currently being developed and regression-tested
    // through the temporary Multiplayer Test shell.
    multiplayerTestModes: Object.freeze([
      "roulette", "draw", "fishing", "safecracker", "mountainrace", "blackjackduel"
    ]),
    // Older duel implementations remain registered but are not mixed into the
    // current six-game testing surface until each receives a focused audit.
    legacyMultiplayerModes: Object.freeze([
      "mines", "rps", "plinko", "blackjack", "memory", "cardwar", "coin"
    ]),
    multiplayerModeNames,
    singlePlayerSections: Object.freeze([
      "scratch-ticket", "runner", "horse-track", "arcade"
    ]),
    multiplayerSections: Object.freeze([
      "multiplayer-scratch", "multiplayer-arcade"
    ])
  });
});
