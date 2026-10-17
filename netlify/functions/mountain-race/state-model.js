'use strict';

const { randomInt, randomUUID } = require('node:crypto');

const MOUNTAIN_RACE_MODE = 'mountainrace';
const MOUNTAIN_RACE_CONTROLS = Object.freeze(['up', 'left', 'right', 'down', 'up+left', 'up+right', 'down+left', 'down+right']);
const MOUNTAIN_RACE_DEFAULT_STEPS = 30;
const MOUNTAIN_RACE_DURATION_MS = 60_000;
const MOUNTAIN_RACE_COUNTDOWN_MS = 3_000;
const MOUNTAIN_RACE_RECOVERY_MS = 500;
const MOUNTAIN_RACE_CHARGE_GREEN_MS = 900;
const MOUNTAIN_RACE_CHARGE_END_MS = 1_180;
const MOUNTAIN_RACE_CHARGE_EXPIRE_MS = 4_000;
// Legacy two-step clients retain their original window during rolling deploys.
const MOUNTAIN_RACE_JUMP_WINDOWS = Object.freeze({2:[260,440],3:[380,510],4:[500,590]});

function cleanPlayerId(value) {
  return String(value || '').trim().replace(/[^A-Za-z0-9._:-]/g, '').slice(0, 120);
}

function clampInteger(value, min, max) {
  const number = Number.parseInt(value, 10);
  return Math.min(max, Math.max(min, Number.isFinite(number) ? number : min));
}

function normalizeMountainRaceControl(value) {
  const token = String(value || '').trim().toLowerCase();
  return MOUNTAIN_RACE_CONTROLS.includes(token) ? token : '';
}

function createMountainRaceSequence(length = MOUNTAIN_RACE_DEFAULT_STEPS) {
  const total = clampInteger(length, 8, 80);
  const sequence = [];
  for (let index = 0; index < total; index += 1) {
    // Every visible four-command window has one unambiguous target per command.
    const recent = sequence.slice(-3);
    const choices = MOUNTAIN_RACE_CONTROLS.filter(control => !recent.includes(control));
    sequence.push(choices[randomInt(0, choices.length)]);
  }
  return sequence;
}

function createMountainRacePlayerState(playerId, sequenceLength) {
  const id = cleanPlayerId(playerId);
  if (!id) throw new Error('Summit Sprint requires a valid player id.');

  return {
    playerId: id,
    promptIndex: 0,
    acceptedInputs: 0,
    rejectedInputs: 0,
    progress: 0,
    lastInput: null,
    finishedAt: null,
    sequenceLength: clampInteger(sequenceLength, 8, 80)
  };
}

function createMountainRaceState({
  playerIds = [],
  now = Date.now(),
  sequenceLength = MOUNTAIN_RACE_DEFAULT_STEPS,
  countdownMs = MOUNTAIN_RACE_COUNTDOWN_MS
} = {}) {
  const ids = [...new Set(playerIds.map(cleanPlayerId).filter(Boolean))];
  if (ids.length !== 2) throw new Error('Summit Sprint requires exactly two players.');

  const total = clampInteger(sequenceLength, 8, 80);
  const countdown = clampInteger(countdownMs, 0, 15_000);
  const startAtMs = Number(now) + countdown;

  return {
    roundId: `mountain-${randomUUID()}`,
    revision: 0,
    startAt: new Date(startAtMs).toISOString(),
    endAt: new Date(startAtMs + MOUNTAIN_RACE_DURATION_MS).toISOString(),
    sequence: createMountainRaceSequence(total),
    players: Object.fromEntries(ids.map(id => [id, createMountainRacePlayerState(id, total)])),
    processedActionIds: [],
    winnerId: null,
    completedAt: null,
    npcActionAt: null
  };
}

function applyMountainRaceInput(state, playerId, rawControl, actionId = '', now = Date.now(), jump = null) {
  const id = cleanPlayerId(playerId);
  const control = normalizeMountainRaceControl(rawControl);
  const cleanActionId = String(actionId || '').replace(/[^A-Za-z0-9._:-]/g, '').slice(0, 120);

  if (!state || !Array.isArray(state.sequence) || !state.players?.[id]) {
    throw new Error('Summit Sprint could not find the active player state.');
  }
  if (!control) throw new Error('Choose one valid Summit Sprint control.');
  if (state.completedAt) return state;
  if (cleanActionId && state.processedActionIds?.includes(cleanActionId)) return state;

  const player = { ...state.players[id] };
  if (Number(now) < Date.parse(player.recoverUntil || '')) return state;
  if (!jump && player.charge && Number(now) < player.charge.startedAt + MOUNTAIN_RACE_CHARGE_EXPIRE_MS) return state;
  const promptIndex = clampInteger(player.promptIndex, 0, state.sequence.length);
  const distance = jump ? (jump.distance || 2) : 1;
  const expected = normalizeMountainRaceControl(state.sequence[promptIndex + distance - 1]);
  const correct = expected === control && (!jump || jump.timed);
  const at = new Date(Number(now)).toISOString();

  if (correct) {
    player.promptIndex = Math.min(state.sequence.length, promptIndex + distance);
    player.acceptedInputs = clampInteger(player.acceptedInputs, 0, 10_000) + 1;
  } else {
    player.promptIndex = Math.max(0, promptIndex - 1);
    player.rejectedInputs = clampInteger(player.rejectedInputs, 0, 10_000) + 1;
  }

  player.progress = state.sequence.length > 0 ? player.promptIndex / state.sequence.length : 0;
  player.charge = null;
  player.recoverUntil = correct ? null : new Date(Number(now) + MOUNTAIN_RACE_RECOVERY_MS).toISOString();
  player.lastInput = { control, expected, correct, at, charged: Boolean(jump) };
  if (player.promptIndex >= state.sequence.length) player.finishedAt = at;

  const winnerId = player.finishedAt ? id : state.winnerId || null;
  const completedAt = winnerId ? at : state.completedAt || null;

  return {
    ...state,
    revision: clampInteger(state.revision, 0, 10_000_000) + 1,
    players: { ...state.players, [id]: player },
    processedActionIds: cleanActionId
      ? [...(Array.isArray(state.processedActionIds) ? state.processedActionIds : []), cleanActionId].slice(-120)
      : (Array.isArray(state.processedActionIds) ? state.processedActionIds : []),
    winnerId,
    completedAt
  };
}

// Timing is measured locally, but a jump cannot advance before the server's
// minimum duration. A bounded transit allowance avoids penalizing network jitter.
function applyMountainRaceCharge(state, playerId, phase, rawControl, actionId, details = {}, now = Date.now()) {
  const id = cleanPlayerId(playerId), player = state?.players?.[id];
  const control = normalizeMountainRaceControl(rawControl);
  const key = String(actionId || '').replace(/[^A-Za-z0-9._:-]/g, '').slice(0, 110);
  if (!player || !control || !key || !['charge', 'release', 'cancel'].includes(phase)) return state;
  const receipt = `${phase}:${key}`;
  if (state.completedAt || now < Date.parse(state.startAt) || now >= Date.parse(state.endAt)
    || state.processedActionIds.includes(receipt)) return state;
  const charge = player.charge;
  if (phase === 'charge') {
    const distance = details.distance === undefined ? 2 : Number(details.distance);
    if (![2,3,4].includes(distance)) return state;
    if (now < Date.parse(player.recoverUntil || '') || player.promptIndex + distance > state.sequence.length
      || Number(details.expectedPromptIndex) !== player.promptIndex
      || (charge && now < charge.startedAt + MOUNTAIN_RACE_CHARGE_EXPIRE_MS)) return state;
    return { ...state, revision: state.revision + 1,
      players: { ...state.players, [id]: { ...player, charge: { id: key, control, distance, fast: details.distance !== undefined, fromIndex: player.promptIndex, startedAt: now } } },
      processedActionIds: [...state.processedActionIds, receipt].slice(-120) };
  }
  if (!charge || charge.id !== key || charge.control !== control || charge.fromIndex !== player.promptIndex) return state;
  if (phase === 'cancel') return { ...state, revision: state.revision + 1,
    players: { ...state.players, [id]: { ...player, charge: null } },
    processedActionIds: [...state.processedActionIds, receipt].slice(-120) };
  const age = now - charge.startedAt;
  const elapsed = details.chargeMs === undefined ? age : Number(details.chargeMs);
  const [min,max] = charge.fast ? MOUNTAIN_RACE_JUMP_WINDOWS[charge.distance] : [MOUNTAIN_RACE_CHARGE_GREEN_MS,MOUNTAIN_RACE_CHARGE_END_MS];
  const inGreen = Number.isFinite(elapsed) && elapsed >= min && elapsed <= max;
  if (inGreen && age < min) return state; // Retry after the minimum; never award an instant jump.
  const timed = inGreen && age >= min && age <= elapsed + 2000;
  return applyMountainRaceInput(state, id, control, receipt, now,
    { timed, distance: charge.distance || 2 });
}

function publicMountainRaceState(state, viewerId) {
  const viewer = cleanPlayerId(viewerId);
  const total = Array.isArray(state?.sequence) ? state.sequence.length : 0;
  const players = Object.fromEntries(Object.entries(state?.players || {}).map(([id, player]) => [id, {
    playerId: id,
    promptIndex: clampInteger(player.promptIndex, 0, total),
    acceptedInputs: clampInteger(player.acceptedInputs, 0, 10_000),
    rejectedInputs: clampInteger(player.rejectedInputs, 0, 10_000),
    progress: Math.min(1, Math.max(0, Number(player.progress) || 0)),
    recoverUntil: player.recoverUntil || null,
    charge: id === viewer ? player.charge || null : null,
    lastInput: player.lastInput ? {
      control: normalizeMountainRaceControl(player.lastInput.control),
      correct: Boolean(player.lastInput.correct),
      charged: Boolean(player.lastInput.charged),
      at: player.lastInput.at || null
    } : null,
    finishedAt: player.finishedAt || null
  }]));

  const ownPromptIndex = clampInteger(players[viewer]?.promptIndex, 0, total);

  return {
    roundId: String(state?.roundId || ''),
    revision: clampInteger(state?.revision, 0, 10_000_000),
    startAt: state?.startAt || null,
    endAt: state?.endAt || null,
    players,
    prompts: Array.isArray(state?.sequence) ? state.sequence.slice(ownPromptIndex, ownPromptIndex + 4) : [],
    stepsTotal: total,
    winnerId: cleanPlayerId(state?.winnerId),
    completedAt: state?.completedAt || null
  };
}

module.exports = {
  MOUNTAIN_RACE_MODE,
  MOUNTAIN_RACE_CONTROLS,
  MOUNTAIN_RACE_DEFAULT_STEPS,
  MOUNTAIN_RACE_DURATION_MS,
  MOUNTAIN_RACE_COUNTDOWN_MS,
  MOUNTAIN_RACE_RECOVERY_MS,
  MOUNTAIN_RACE_CHARGE_GREEN_MS,
  MOUNTAIN_RACE_CHARGE_END_MS,
  MOUNTAIN_RACE_CHARGE_EXPIRE_MS,
  MOUNTAIN_RACE_JUMP_WINDOWS,
  normalizeMountainRaceControl,
  createMountainRaceSequence,
  createMountainRacePlayerState,
  createMountainRaceState,
  applyMountainRaceInput,
  applyMountainRaceCharge,
  publicMountainRaceState
};
