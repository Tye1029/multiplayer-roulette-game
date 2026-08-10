"use strict";

// The multiplayer arcade has one lifecycle contract. Individual games own
// their gameplay state, but they do not redefine joining, Ready, countdown,
// polling, rematches, or synthetic-opponent behavior.
const { multiplayerModeNames } = require("../../shared/games/catalog");

const MULTIPLAYER_CONTRACT_VERSION = "cohesion-v3";
const MODE_NAMES = Object.freeze({ ...multiplayerModeNames });

const COUNTDOWN_MS = Object.freeze({
  default: 5000,
  safecracker: 3000,
  mountainrace: 3000
});

const POLL_MS = Object.freeze({
  lobby: 2000,
  waiting: 1800,
  ready: 350,
  countdown: 250,
  playing: Object.freeze({
    default: 1200,
    draw: 650,
    fishing: 450,
    roulette: 800,
    safecracker: 2200,
    mountainrace: 700
  }),
  complete: 2000,
  completeIdle: 5000
});

function hasMode(mode) {
  return Object.prototype.hasOwnProperty.call(MODE_NAMES, String(mode || "").toLowerCase());
}

function supportsRematch(mode) {
  return hasMode(mode);
}

function supportsSyntheticOpponent(mode) {
  return hasMode(mode);
}

function countdownMs(mode) {
  const key = String(mode || "").toLowerCase();
  return COUNTDOWN_MS[key] || COUNTDOWN_MS.default;
}

module.exports = {
  MULTIPLAYER_CONTRACT_VERSION,
  MODE_NAMES,
  POLL_MS,
  hasMode,
  supportsRematch,
  supportsSyntheticOpponent,
  countdownMs
};
