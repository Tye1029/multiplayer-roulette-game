// FOUR_PLAYER_ROULETTE_V1 — isolated practice rules; amounts are integer cents.
export const VERSION = 'four-player-roulette-debug-v2';
export const ENTRY = 10000;
export const BASE = 2000;
export const REMATCH_MS = 10000;
export const DIRECTIONS = ['down', 'left', 'up', 'right'];
export function random() {
  const value = new Uint32Array(1);
  globalThis.crypto.getRandomValues(value);
  return value[0] / 4294967296;
}
export function shuffle(items, rng = random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function relativeSeat(order, playerId, viewerId) {
  const player = order.indexOf(playerId), viewer = order.indexOf(viewerId);
  if (player < 0 || viewer < 0) throw new Error('Unknown seat');
  return (player - viewer + 4) % 4;
}
export function splitPot(players, cents, rng = random) {
  if (players.length !== 3 || !Number.isSafeInteger(cents) || cents < 0) throw new Error('Invalid split');
  const ranks = [...players].sort((a, b) => a.shots - b.shots);
  const weights = [25, 30, 35];
  const result = [];
  for (let from = 0; from < ranks.length;) {
    let to = from + 1;
    while (to < ranks.length && ranks[to].shots === ranks[from].shots) to++;
    const weight = weights.slice(from, to).reduce((a, b) => a + b, 0) / (to - from);
    for (let i = from; i < to; i++) {
      const exact = cents * weight / 90;
      result.push({ id: ranks[i].id, cents: Math.floor(exact), share: weight / 90, fraction: exact % 1 });
    }
    from = to;
  }
  let remaining = cents - result.reduce((sum, item) => sum + item.cents, 0);
  // Largest remainders preserve every cent; random tie order avoids a seat bias.
  const remainderOrder = shuffle(result, rng).sort((a, b) => b.fraction - a.fraction);
  for (let i = 0; remaining > 0; i++, remaining--) remainderOrder[i].cents++;
  return result.map(({ fraction, ...item }) => item);
}

export class Round {
  #rng;
  #bullet;
  constructor(players, rng = random, round = 1) {
    if (players.length !== 4 || new Set(players.map(p => p.id)).size !== 4) throw new Error('Four unique players required');
    this.#rng = rng;
    this.#bullet = 1 + Math.floor(rng() * 6);
    this.state = {
      version: VERSION, round, phase: 'opening', order: shuffle(players.map(p => p.id), rng),
      players: players.map(p => ({ ...p, bank: 0, shots: 0, spinUsed: false, eliminated: false, split: 0, share: 0 })),
      turn: 0, turnShots: 0, spinPending: false, safeSinceSpin: 0, pot: ENTRY * 4, nextPayout: BASE,
      actions: [], result: null, ready: [], rematchDeadline: null
    };
  }
  snapshot() {
    const s = structuredClone(this.state);
    s.activeId = s.order[s.turn];
    s.canPass = s.phase === 'playing' && s.turnShots > 0 && !s.spinPending;
    s.award = Math.min(s.nextPayout, s.pot);
    s.fatalRisk = 1 / (6 - s.safeSinceSpin);
    return s;
  }
  begin() {
    if (this.state.phase !== 'opening') return false;
    this.state.phase = 'playing';
    return true;
  }
  act(id, action) {
    const s = this.state;
    if (s.phase !== 'playing' || s.order[s.turn] !== id) return { ok: false, reason: 'Wait for your turn.' };
    const player = s.players.find(p => p.id === id);
    const event = { id, action, number: s.actions.length + 1 };
    if (action === 'pass') {
      if (!s.turnShots || s.spinPending) return { ok: false, reason: 'Take a shot before passing.' };
      s.turn = (s.turn + 1) % 4; s.turnShots = 0;
    } else if (action === 'spin') {
      if (player.spinUsed) return { ok: false, reason: 'Your spin has been used.' };
      player.spinUsed = true; s.spinPending = true; s.safeSinceSpin = 0; s.nextPayout = BASE;
      this.#bullet = 1 + Math.floor(this.#rng() * 6);
    } else if (action === 'shoot') {
      this.#bullet--;
      s.spinPending = false;
      if (this.#bullet === 0) {
        event.fatal = true;
        const returned = player.bank;
        s.pot += returned; player.bank = 0; player.eliminated = true;
        const splitTotal = s.pot;
        const awards = splitPot(s.players.filter(p => !p.eliminated), splitTotal, this.#rng);
        for (const award of awards) {
          const survivor = s.players.find(p => p.id === award.id);
          survivor.bank += award.cents; survivor.split = award.cents; survivor.share = award.share;
        }
        s.pot = 0;
        s.result = { reason: 'elimination', eliminatedId: id, returned, splitTotal };
        s.phase = 'complete';
      } else {
        event.award = Math.min(s.nextPayout, s.pot);
        player.bank += event.award; s.pot -= event.award;
        player.shots++; s.turnShots++; s.safeSinceSpin++; s.nextPayout += BASE;
        if (s.pot === 0) { s.phase = 'complete'; s.result = { reason: 'empty', splitTotal: 0 }; }
      }
    } else return { ok: false, reason: 'Unknown action.' };
    s.actions.push(event);
    if (s.players.reduce((sum, p) => sum + p.bank, s.pot) !== ENTRY * 4) throw new Error('Pot conservation failed');
    return { ok: true, ...event };
  }
  openRematch(now = Date.now()) {
    if (this.state.phase !== 'complete') return false;
    this.state.phase = 'rematch'; this.state.rematchDeadline = now + REMATCH_MS;
    return true;
  }
  expire(now = Date.now()) {
    const s = this.state;
    if (s.phase === 'rematch' && now >= s.rematchDeadline) { s.phase = 'expired'; return true; }
    return false;
  }
  vote(id, now = Date.now()) {
    this.expire(now);
    const s = this.state;
    if (s.phase !== 'rematch' || !s.players.some(p => p.id === id)) return false;
    if (!s.ready.includes(id)) s.ready.push(id);
    return s.ready.length === 4;
  }
}

const PERSONALITIES = {
  cautious: { label: 'Careful', stay: [0.14, 0.3], spin: [0.2, 0.34], patience: [1, 1.35] },
  bold: { label: 'Risk taker', stay: [0.65, 0.86], spin: [0.36, 0.6], patience: [0.65, 1.05] },
  opportunist: { label: 'Opportunist', stay: [0.32, 0.58], spin: [0.26, 0.46], patience: [0.75, 1.2] },
  unpredictable: { label: 'Wild card', stay: [0.25, 0.8], spin: [0.2, 0.55], patience: [0.6, 1.5] }
};
const between = (range, rng) => range[0] + rng() * (range[1] - range[0]);
export function createPersonality(rng = random) {
  const kind = Object.keys(PERSONALITIES)[Math.floor(rng() * 4)];
  const template = PERSONALITIES[kind];
  return { kind, label: template.label, stay: between(template.stay, rng), spin: between(template.spin, rng),
    patience: between(template.patience, rng), rematch: 0.89 + rng() * 0.1 };
}
export function botDecision(snapshot, id, personality, rng = random) {
  if (snapshot.phase !== 'playing' || snapshot.activeId !== id) return null;
  const p = snapshot.players.find(player => player.id === id);
  const q = snapshot.fatalRisk;
  if (snapshot.spinPending) return 'shoot';
  const wantSpin = !p.spinUsed && (q >= 1 || q >= personality.spin + (rng() - 0.5) * 0.12);
  if (snapshot.canPass) {
    const leaderShots = Math.max(...snapshot.players.filter(player => player.id !== id).map(player => player.shots));
    const rankChase = p.shots <= leaderShots && p.shots + 1 >= leaderShots ? 0.12 : 0;
    const reward = snapshot.award / Math.max(BASE, p.bank + snapshot.award);
    const chance = Math.max(0.03, Math.min(0.92,
      personality.stay + rankChase + reward * 0.12 - q * 0.45 - snapshot.turnShots * 0.06));
    if ((!wantSpin && q === 1) || rng() > chance) return 'pass';
  }
  return wantSpin ? 'spin' : 'shoot';
}
export function botDelay(personality, rng = random) { return Math.round((750 + rng() * 1550) * personality.patience); }
