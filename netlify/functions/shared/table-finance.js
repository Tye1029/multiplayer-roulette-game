'use strict';
const crypto = require('node:crypto');
const fail = (message, status = 409) => { throw Object.assign(new Error(message), { status }); };
function wager(value = 0) {
  if (!Number.isSafeInteger(value) || value < 0 || (value > 0 && value < 10000) || value > 50000 || value % 1000) fail('Choose 10,000–50,000 Chips in 1,000-Chip steps.', 400);
  return value;
}
async function prepare(s, mode, players, amount, wallet, rematch = false) {
  s.wager = wager(amount);
  if (!s.wager) { delete s.finance; return; }
  if (players.some(p => p.bot)) fail('Bot practice uses 0 Chips. Create a free practice table.');
  const accounts = Object.fromEntries(await Promise.all(players.map(async p => [p.id, await wallet.account(p)])));
  if (new Set(Object.values(accounts)).size !== players.length) fail('Each player needs a different Chip account.');
  s.finance = { mode, id: crypto.randomBytes(6).toString('hex').toUpperCase(), accounts, paid: [], pending: players.map(p => p.id), rate: await wallet.rate(), status: 'funding', rematch, payouts: {} };
}
async function join(s, player, accepted, wallet) {
  if (!s.wager) return;
  if (accepted !== s.wager) fail('Review and accept this table’s wager before joining.');
  if (s.finance.pending.length) fail('The table is still confirming a stake. Retry shortly.');
  const account = await wallet.account(player);
  if (Object.values(s.finance.accounts).includes(account)) fail('Each player needs a different Chip account.');
  s.finance.accounts[player.id] = account; s.finance.pending.push(player.id); s.finance.status = 'funding';
}
// Call only after the funding intent has committed. Stable per-match ledger IDs
// recover a successful wallet write even if its response or the DB commit is lost.
async function recover(s, wallet, outcome) {
  const f = s.finance; if (!s.wager || !f) return;
  while (f.pending.length) {
    const id = f.pending[0];
    try {
      await wallet.apply(f.accounts[id], { id: `${f.mode}:${f.id}:stake:${id}`, delta: -s.wager, reason: `${f.mode} stake` });
      if (!f.paid.includes(id)) f.paid.push(id);
      f.pending.shift();
    } catch (e) {
      if (e.code !== 'RPS_FUNDS') throw e;
      f.pending = []; s.reason = e.message;
      if (f.rematch || s.players[0].id === id) { f.aborted = true; s.phase = 'complete'; s.winner = 'draw'; }
      else { s.players = s.players.filter(p => p.id !== id); delete f.accounts[id]; }
    }
  }
  if (f.status === 'funding') f.status = 'reserved';
  const result = f.aborted ? { done: true, winner: null } : outcome(s);
  if (!result.done || f.status === 'settled') return;
  if (result.winner && f.paid.length !== 2) throw new Error('Cannot settle an unfunded result.');
  const pot = s.wager * f.paid.length, cut = result.winner ? Math.min(pot, Math.ceil(pot * f.rate / 100)) : 0;
  for (const id of f.paid) {
    const refund = !result.winner, amount = refund ? s.wager : result.winner === id ? pot - cut : 0;
    await wallet.apply(f.accounts[id], { id: `${f.mode}:${f.id}:${refund ? 'refund' : 'payout'}:${id}`, delta: amount, reason: refund ? `${f.mode} refund` : `${f.mode} winnings` });
    f.payouts[id] = amount;
  }
  f.houseCut = cut; f.status = 'settled';
}
function consent(s, body) {
  if (s.wager && (body.wager !== s.wager || s.finance?.status !== 'settled')) fail('Wait for settlement and accept the rematch wager.');
}
function publicState(s) {
  return { wager: s.wager || 0, private: !!s.private, houseCutPercent: s.finance?.rate || 0, settlement: s.finance?.status || 'free', funding: !!s.finance?.pending?.length, payouts: s.finance?.status === 'settled' ? s.finance.payouts : {} };
}
module.exports = { wager, prepare, join, recover, consent, publicState, fail };
