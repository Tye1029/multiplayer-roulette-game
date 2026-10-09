/* HAND_OF_DOOM_V2_20261009 — shared rules; only the server owns online state. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RPSRules = api;
})(typeof globalThis === 'object' ? globalThis : this, () => {
  'use strict';
  const CHOICES = ['rock', 'paper', 'scissors'];
  const CHARACTERS = [
    { id:'maximus', name:'Maximus', title:'The dramatic one', image:'gladiator.png' },
    { id:'voss', name:'Voss', title:'The iron veteran', image:'voss.png' },
    { id:'lyra', name:'Lyra', title:'The knowing smirk', image:'lyra.png' },
    { id:'bryn', name:'Bryn', title:'The crowd favorite', image:'bryn.png' }
  ];
  const character = value => CHARACTERS.some(c => c.id === value) ? value : 'maximus';
  const REVEAL_MS = 1500, NEXT_MS = 2900, PICK_MS = 90000;
  const clone = value => JSON.parse(JSON.stringify(value));
  function fail(message) { const e = new Error(message); e.status = 409; throw e; }
  function create(id, player, now = Date.now()) {
    return { id, players: [{...player, character:character(player.character)}], phase: 'waiting', scores: [0, 0], round: 1,
      picks: [null, null], history: [], revision: 0, createdAt: now, deadline: now + 900000,
      winner: null, rematchVotes: [], nextMatch: null };
  }
  function join(state, player, now = Date.now()) {
    const s = clone(state);
    if (s.players.some(p => p.id === player.id)) return s;
    if (s.phase !== 'waiting' || now >= s.deadline) fail('This arena is no longer open.');
    if (s.invitedId && s.invitedId !== player.id) fail('This challenge is reserved for the invited opponent.');
    let avatar = character(player.character);
    if (avatar === character(s.players[0].character)) avatar = CHARACTERS[(CHARACTERS.findIndex(c => c.id === avatar)+1)%CHARACTERS.length].id;
    s.players.push({...player, character:avatar}); s.phase = 'choosing'; s.deadline = now + PICK_MS; s.revision++;
    return s;
  }
  function advance(state, now = Date.now()) {
    const s = clone(state);
    if (s.phase === 'reveal' && now >= s.nextAt) {
      if (s.winner !== null) { s.phase = 'complete'; s.completedAt = s.nextAt; }
      else { s.phase = 'choosing'; s.round++; s.picks = [null, null]; s.deadline = now + PICK_MS; }
      s.revision++;
    }
    if (['waiting', 'choosing'].includes(s.phase) && now >= s.deadline) {
      s.phase = 'cancelled'; s.reason = 'The arena timed out. No rivalry result was recorded.'; s.revision++;
    }
    return s;
  }
  function pick(state, playerId, choice, round, now = Date.now(), variant = 0) {
    const s = advance(state, now), seat = s.players.findIndex(p => p.id === playerId);
    if (seat < 0) fail('You are not a player in this duel.');
    if (!CHOICES.includes(choice)) fail('Choose rock, paper, or scissors.');
    if (round !== s.round) fail('That round has already ended.');
    // Retry of an accepted pick is harmless; a locked choice cannot be changed.
    if (s.picks[seat] === choice) return s;
    if (s.phase !== 'choosing' || s.picks[seat]) fail('Your hand is already locked.');
    s.picks[seat] = choice; s.revision++;
    if (s.picks.every(Boolean)) {
      const a = CHOICES.indexOf(s.picks[0]), b = CHOICES.indexOf(s.picks[1]);
      const winner = a === b ? null : (a - b + 3) % 3 === 1 ? 0 : 1;
      s.beforeScores = [...s.scores];
      if (winner !== null) s.scores[winner]++;
      s.winner = s.scores.findIndex(n => n === 2); if (s.winner < 0) s.winner = null;
      s.phase = 'reveal'; s.cutAt = now + 200; s.revealAt = now + REVEAL_MS; s.nextAt = now + NEXT_MS;
      s.variant = variant % 3;
      s.history.push({ round: s.round, picks: [...s.picks], winner, revealAt: s.revealAt });
    }
    return s;
  }
  function publicState(state, playerId, now = Date.now()) {
    const seat = state.players.findIndex(p => p.id === playerId);
    if (seat < 0) fail('You are not a player in this duel.');
    const visible = state.phase === 'complete' || (state.phase === 'reveal' && now >= state.revealAt);
    // Explicit allowlist: never spread private state into a response.
    return { id: state.id, players: state.players, phase: state.phase, seat, round: state.round,
      revision: state.revision, scores: state.phase === 'reveal' && !visible ? state.beforeScores : state.scores,
      locked: state.picks.map(Boolean), myChoice: state.picks[seat],
      picks: visible ? state.picks : null, winner: visible ? state.winner : null,
      roundWinner: visible ? state.history.at(-1)?.winner : null,
      history: state.history.filter(h => h.revealAt <= now).slice(-12),
      cutAt: state.cutAt || null, revealAt: state.revealAt || null, nextAt: state.nextAt || null,
      deadline: state.deadline, variant: state.variant || 0, serverNow: now,
      rematchVotes: state.rematchVotes, nextMatch: state.nextMatch, reason: state.reason || '',
      invitedName: state.invitedName || '',
      suddenDeath: (state.phase === 'reveal' ? state.beforeScores : state.scores).every(n => n === 1) };
  }
  return { CHOICES, CHARACTERS, character, REVEAL_MS, NEXT_MS, PICK_MS, create, join, advance, pick, publicState };
});
