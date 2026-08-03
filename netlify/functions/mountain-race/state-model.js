'use strict';

const { randomInt, randomUUID } = require('node:crypto');

const MOUNTAIN_RACE_MODE = 'mountainrace';
const MOUNTAIN_RACE_CONTROLS = Object.freeze(['up', 'left', 'right', 'down']);
const MOUNTAIN_RACE_DEFAULT_STEPS = 24;
const MOUNTAIN_RACE_DURATION_MS = 30_000;

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

function createMountainRaceState({ playerIds = [], now = Date.now(), sequenceLength = MOUNTAIN_RACE_DEFAULT_STEPS } = {}) {
  const ids = [...new Set(playerIds.map(cleanPlayerId).filter(Boolean))];
  if (ids.length !== 2) throw new Error('Summit Sprint requires exactly two players.');

  const total = clampInteger(sequenceLength, 8, 80);
  const startAt = new Date(Number(now) + 3_000).toISOString();
  const endAt = new Date(Number(now) + 3_000 + MOUNTAIN_RACE_DURATION_MS).toISOString();

  return {
    roundId: `mountain-${randomUUID()}`,
    revision: 0,
    startAt,
    endAt,
    sequence: createMountainRaceSequence(total),
    players: Object.fromEntries(ids.map(id => [id, createMountainRacePlayerState(id, total)])),
    processedActionIds: [],
    winnerId: null,
    completedAt: null
  };
}

function applyMountainRaceInput(state, playerId, rawControl, actionId = '', now = Date.now()) {
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
  const promptIndex = clampInteger(player.promptIndex, 0, state.sequence.length);
  const expected = normalizeMountainRaceControl(state.sequence[promptIndex]);
  const correct = expected === control;
  const at = new Date(Number(now)).toISOString();

  if (correct) {
    player.promptIndex = Math.min(state.sequence.length, promptIndex + 1);
    player.acceptedInputs = clampInteger(player.acceptedInputs, 0, 10_000) + 1;
  } else {
    player.promptIndex = Math.max(0, promptIndex - 1);
    player.rejectedInputs = clampInteger(player.rejectedInputs, 0, 10_000) + 1;
  }

  player.progress = state.sequence.length > 0 ? player.promptIndex / state.sequence.length : 0;
  player.lastInput = { control, expected, correct, at };
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

function publicMountainRaceState(state, viewerId) {
  const viewer = cleanPlayerId(viewerId);
  const players = Object.fromEntries(Object.entries(state?.players || {}).map(([id, player]) => [id, {
    playerId: id,
    promptIndex: clampInteger(player.promptIndex, 0, state?.sequence?.length || 0),
    acceptedInputs: clampInteger(player.acceptedInputs, 0, 10_000),
    rejectedInputs: clampInteger(player.rejectedInputs, 0, 10_000),
    progress: Math.min(1, Math.max(0, Number(player.progress) || 0)),
    lastInput: player.lastInput ? {
      control: normalizeMountainRaceControl(player.lastInput.control),
      correct: Boolean(player.lastInput.correct),
      at: player.lastInput.at || null
    } : null,
    finishedAt: player.finishedAt || null
  }]));

  const ownPromptIndex = clampInteger(players[viewer]?.promptIndex, 0, state?.sequence?.length || 0);

  return {
    roundId: String(state?.roundId || ''),
    revision: clampInteger(state?.revision, 0, 10_000_000),
    startAt: state?.startAt || null,
    endAt: state?.endAt || null,
    players,
    prompts: Array.isArray(state?.sequence) ? state.sequence.slice(ownPromptIndex, ownPromptIndex + 4) : [],
    winnerId: cleanPlayerId(state?.winnerId),
    completedAt: state?.completedAt || null
  };
}

module.exports = {
  MOUNTAIN_RACE_MODE,
  MOUNTAIN_RACE_CONTROLS,
  MOUNTAIN_RACE_DEFAULT_STEPS,
  MOUNTAIN_RACE_DURATION_MS,
  normalizeMountainRaceControl,
  createMountainRaceSequence,
  createMountainRacePlayerState,
  createMountainRaceState,
  applyMountainRaceInput,
  publicMountainRaceState
};
