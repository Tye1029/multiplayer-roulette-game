'use strict';

const { randomInt, randomUUID } = require('node:crypto');

const MOUNTAIN_RACE_MODE = 'mountainrace';
const MOUNTAIN_RACE_CONTROLS = Object.freeze(['up', 'left', 'right', 'down']);
const MOUNTAIN_RACE_DEFAULT_STEPS = 30;
const MOUNTAIN_RACE_DURATION_MS = 30_000;
const MOUNTAIN_RACE_COUNTDOWN_MS = 3_000;
const MOUNTAIN_RACE_RECOVERY_MS = 500;
const MOUNTAIN_RACE_CHARGE_GREEN_MS = 900;
const MOUNTAIN_RACE_CHARGE_END_MS = 1_180;
const MOUNTAIN_RACE_CHARGE_EXPIRE_MS = 1_700;

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
    const previous = sequence[index - 1] || '';
    const beforePrevious = sequence[index - 2] || '';
    let control = MOUNTAIN_RACE_CONTROLS[randomInt(0, MOUNTAIN_RACE_CONTROLS.length)];
    if (control === previous && control === beforePrevious) {
      const alternatives = MOUNTAIN_RACE_CONTROLS.filter(candidate => candidate !== control);
      control = alternatives[randomInt(0, alternatives.length)];
    }
    sequence.push(control);
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
  const expected = normalizeMountainRaceControl(state.sequence[promptIndex + (jump ? 1 : 0)]);
  const correct = expected === control && (!jump || jump.timed);
  const at = new Date(Number(now)).toISOString();

  if (correct) {
    player.promptIndex = Math.min(state.sequence.length, promptIndex + (jump ? 2 : 1));
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

// The server measures the hold. Client-supplied durations/timestamps never award a jump.
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
    if (now < Date.parse(player.recoverUntil || '') || player.promptIndex + 1 >= state.sequence.length
      || Number(details.expectedPromptIndex) !== player.promptIndex
      || (charge && now < charge.startedAt + MOUNTAIN_RACE_CHARGE_EXPIRE_MS)) return state;
    return { ...state, revision: state.revision + 1,
      players: { ...state.players, [id]: { ...player, charge: { id: key, control, fromIndex: player.promptIndex, startedAt: now } } },
      processedActionIds: [...state.processedActionIds, receipt].slice(-120) };
  }
  if (!charge || charge.id !== key || charge.control !== control || charge.fromIndex !== player.promptIndex) return state;
  if (phase === 'cancel') return { ...state, revision: state.revision + 1,
    players: { ...state.players, [id]: { ...player, charge: null } },
    processedActionIds: [...state.processedActionIds, receipt].slice(-120) };
  const age = now - charge.startedAt;
  return applyMountainRaceInput(state, id, control, receipt, now,
    { timed: age >= MOUNTAIN_RACE_CHARGE_GREEN_MS && age <= MOUNTAIN_RACE_CHARGE_END_MS });
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
  normalizeMountainRaceControl,
  createMountainRaceSequence,
  createMountainRacePlayerState,
  createMountainRaceState,
  applyMountainRaceInput,
  applyMountainRaceCharge,
  publicMountainRaceState
};
