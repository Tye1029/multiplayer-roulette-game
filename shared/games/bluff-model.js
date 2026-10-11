/* BLUFF_OR_BUST_V1 — shared rules; the server owns online state and clocks. */
(function(root, factory) {
  const model = factory();
  if (typeof module === 'object' && module.exports) module.exports = model;
  else root.BluffRules = model;
})(typeof globalThis === 'object' ? globalThis : this, () => {
  'use strict';
  const SUITS = ['crown', 'coin', 'skull'];
  const PLAY_MS = 30000, DECIDE_MS = 20000;
  function random(n) {
    const a = new Uint32Array(1), limit = 4294967296 - (4294967296 % n);
    do { globalThis.crypto.getRandomValues(a); } while (a[0] >= limit);
    return a[0] % n;
  }
  function fail(message, status = 409) { const e = new Error(message); e.status = status; throw e; }
  function create(id, player, now = Date.now()) {
    return { id, version: 'BLUFF_OR_BUST_V1', phase: 'waiting', players: [{ id: player.id, name: player.name, bot: Boolean(player.bot) }],
      ready: [], revision: 1, match: 1, round: 0, deadline: now + 900000, hands: [[], []], plays: [null, null], decisions: [null, null],
      winner: null, rematch: [], reveal: null, discards: 0 };
  }
  function join(s, player, now = Date.now()) {
    if (s.players.some(p => p.id === player.id)) return s;
    if (s.phase !== 'waiting' || s.players.length !== 1 || now >= s.deadline) fail('This table is no longer available.');
    s.players.push({ id: player.id, name: player.name, bot: Boolean(player.bot) });
    s.revision++; return s;
  }
  function start(s, now, rng) {
    s.hands = [0, 1].map(p => Array.from({ length: 10 }, (_, i) => ({ id: `${s.match}-${p}-${i}`, suit: SUITS[rng(3)] })));
    s.winner = null; s.reason = ''; s.reveal = null; s.rematch = []; s.discards = 0; s.round = 0;
    nextRound(s, now, rng);
  }
  function nextRound(s, now, rng) {
    s.round++; s.target = SUITS[rng(3)]; s.phase = 'select'; s.deadline = now + PLAY_MS;
    s.plays = [null, null]; s.decisions = [null, null]; s.reveal = null; s.botAt = now + 2400 + rng(2600); s.revision++;
  }
  function finish(s, winner, reason, now) {
    s.phase = 'complete'; s.winner = winner; s.reason = reason; s.deadline = null; s.completedAt = now; s.revision++;
  }
  function resolve(s, now) {
    const entries = s.plays.map((cards, p) => {
      const challenged = s.decisions[1 - p] === 'call';
      const fake = cards.some(c => c.suit !== s.target);
      const destination = !challenged ? 'discard' : fake ? p : 1 - p;
      return { player: p, cards, challenged, fake, destination, result: !challenged ? (fake ? 'got-away' : 'believed') : fake ? 'caught' : 'false-call' };
    });
    // Remove both original plays first. Transfers cannot become part of this round's other play.
    s.hands = s.hands.map((hand, p) => hand.filter(c => !s.plays[p].some(x => x.id === c.id)));
    for (const e of entries) {
      if (e.destination === 'discard') s.discards += e.cards.length;
      else s.hands[e.destination].push(...e.cards);
    }
    s.reveal = { round: s.round, target: s.target, entries, at: now };
    const empty = s.hands.map(h => h.length === 0);
    s.pendingWinner = empty[0] && empty[1] ? 'draw' : empty[0] ? 0 : empty[1] ? 1 : null;
    s.phase = 'reveal'; s.deadline = now + 6000 + Math.max(...entries.map(e => e.cards.length)) * 260; s.revision++;
  }
  function advance(s, now = Date.now(), rng = random) {
    if (s.phase === 'waiting' && now >= s.deadline) finish(s, 'draw', 'The invitation expired.', now);
    else if (s.phase === 'select' && now >= s.deadline) {
      const missing = s.plays.map(p => !p);
      finish(s, missing[0] && missing[1] ? 'draw' : missing[0] ? 1 : 0, missing[0] && missing[1] ? 'Both players missed the 30-second play deadline.' : 'The 30-second play deadline was missed.', now);
    } else if (s.phase === 'decide' && now >= s.deadline) {
      s.decisions = s.decisions.map(d => d || 'believe'); resolve(s, now);
    } else if (s.phase === 'reveal' && now >= s.deadline) {
      if (s.pendingWinner !== null) finish(s, s.pendingWinner, s.pendingWinner === 'draw' ? 'Both hands are empty.' : 'Every last card is gone.', now);
      else nextRound(s, now, rng);
    }
    return s;
  }
  function act(s, id, body, now = Date.now(), rng = random) {
    const p = s.players.findIndex(p => p.id === id);
    if (p < 0) fail('This table belongs to its players.', 403);
    advance(s, now, rng);
    if (body.action === 'ready') {
      if (s.phase !== 'waiting' || s.players.length !== 2) fail('Wait for your opponent to join.');
      if (!s.ready.includes(id)) { s.ready.push(id); s.revision++; }
      if (s.players.every(p => p.bot || s.ready.includes(p.id))) start(s, now, rng);
    } else if (body.action === 'rematch') {
      if (s.phase !== 'complete' || body.match !== s.match) fail('This match has changed.');
      if (!s.rematch.includes(id)) { s.rematch.push(id); s.revision++; }
      if (s.players.length === 2 && s.players.every(p => p.bot || s.rematch.includes(p.id))) { s.match++; start(s, now, rng); }
    } else if (body.action === 'leave') {
      if (s.phase === 'reveal' && s.pendingWinner !== null) finish(s, s.pendingWinner, s.pendingWinner === 'draw' ? 'Both hands are empty.' : 'Every last card is gone.', now);
      else if (!['complete', 'waiting'].includes(s.phase)) finish(s, 1 - p, 'A player left the table.', now);
      else if (s.phase === 'waiting') finish(s, 'draw', 'The table was closed.', now);
    } else if (body.action === 'play' || body.action === 'decide') {
      if (body.match !== s.match || body.round !== s.round) fail('The round has changed. Your hand has been refreshed.');
      if (body.action === 'play') {
        // Once locked, retries cannot alter the submitted play, even after the phase advances.
        if (s.plays[p]) return s;
        if (s.phase !== 'select') fail('The play deadline has passed.');
        if (!Array.isArray(body.cards) || !body.cards.length || body.cards.length > s.hands[p].length || new Set(body.cards).size !== body.cards.length) fail('Choose at least one card from your hand.', 400);
        const cards = body.cards.map(id => s.hands[p].find(c => c.id === id));
        if (cards.some(c => !c)) fail('That card is not in your hand.', 400);
        s.plays[p] = cards; s.revision++;
        if (s.plays.every(Boolean)) { s.phase = 'decide'; s.deadline = now + DECIDE_MS; s.botAt = now + 1700 + rng(2200); }
      } else {
        if (s.decisions[p]) return s;
        if (s.phase !== 'decide') fail('Wait for both players to lock their cards.');
        if (!['believe', 'call'].includes(body.choice)) fail('Choose Believe or Call Bluff.', 400);
        s.decisions[p] = body.choice; s.revision++;
        if (s.decisions.every(Boolean)) resolve(s, now);
      }
    } else fail('Unknown table action.', 400);
    return s;
  }
  function bot(s, now = Date.now(), rng = random) {
    advance(s, now, rng);
    const p = s.players.findIndex(p => p.bot);
    if (p < 0 || now < s.botAt) return s;
    const body = { match: s.match, round: s.round };
    if (s.phase === 'select' && !s.plays[p]) {
      // The bot uses only its own hand, never the opponent's secret hand or play.
      const real = s.hands[p].filter(c => c.suit === s.target), fake = s.hands[p].filter(c => c.suit !== s.target);
      const cards = real.slice(0, 1 + rng(Math.max(1, real.length)));
      if (!cards.length || (fake.length && rng(100) < 50)) cards.push(...fake.slice(0, 1 + rng(Math.min(2, fake.length) || 1)));
      act(s, s.players[p].id, { ...body, action: 'play', cards: cards.map(c => c.id) }, now, rng);
    } else if (s.phase === 'decide' && !s.decisions[p]) {
      const count = s.plays[1 - p].length;
      act(s, s.players[p].id, { ...body, action: 'decide', choice: rng(100) < Math.min(85, 20 + count * 10) ? 'call' : 'believe' }, now, rng);
    }
    return s;
  }
  function publicState(s, id, now = Date.now()) {
    const p = s.players.findIndex(p => p.id === id);
    if (p < 0) fail('Join this table to see its cards.', 403);
    const revealed = ['reveal', 'complete'].includes(s.phase), showCounts = s.phase !== 'select';
    return { id: s.id, version: s.version, revision: s.revision, match: s.match, round: s.round, phase: s.phase, target: s.target,
      deadline: s.deadline, serverNow: now, me: p, players: s.players, ready: s.ready, hand: s.hands[p], counts: s.hands.map(h => h.length),
      locked: s.plays.map(Boolean), playCounts: s.plays.map((v, i) => showCounts || i === p ? v?.length || 0 : null),
      decisionLocked: s.decisions.map(Boolean), myDecision: s.decisions[p], reveal: revealed ? s.reveal : null,
      winner: s.winner, reason: s.reason, rematch: s.rematch, discards: s.discards };
  }
  return { SUITS, PLAY_MS, DECIDE_MS, create, join, act, advance, bot, publicState, random, fail };
});
