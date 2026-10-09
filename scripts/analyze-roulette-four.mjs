import { Round, createPersonality, botDecision } from '../assets/roulette-four/model.mjs';
const rounds = Number(process.argv[2] || 50000);
const firstLapLimit = process.argv.includes('--first-lap-limit');
if (!Number.isInteger(rounds) || rounds < 1 || rounds > 1000000) throw Error('Choose 1–1,000,000 rounds');
let seed = 1791552146;
const rng = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
const players = ['a', 'b', 'c', 'd'].map(id => ({ id, name: id }));
const seats = players.map((_, i) => ({ order: i + 1, netCents: 0, profits: 0, eliminated: 0, neverShot: 0 }));
let firstShotEnds = 0, firstTwoTake300 = 0, empty = 0, shots = 0;
for (let n = 0; n < rounds; n++) {
  const game = new Round(players, rng), traits = Object.fromEntries(players.map(p => [p.id, createPersonality(rng)]));
  game.begin();
  let passes = 0;
  while (game.state.phase === 'playing') {
    const s = game.snapshot();
    const action = firstLapLimit && passes < 4 && s.canPass ? 'pass' : botDecision(s, s.activeId, traits[s.activeId], rng);
    game.act(s.activeId, action); if (action === 'pass') passes++;
  }
  const s = game.snapshot(), fired = s.actions.filter(a => a.action === 'shoot');
  shots += fired.length; if (fired.length === 1) firstShotEnds++;
  if (s.result.reason === 'empty') empty++;
  // Awards before elimination redistribution: measure early players claiming the pot.
  const earlyAwards = s.actions.filter(a => a.award && s.order.slice(0, 2).includes(a.id)).reduce((sum, a) => sum + a.award, 0);
  if (earlyAwards >= 30000) firstTwoTake300++;
  s.order.forEach((id, i) => {
    const p = s.players.find(p => p.id === id), seat = seats[i];
    seat.netCents += p.bank - 10000; seat.profits += Number(p.bank > 10000);
    seat.eliminated += Number(p.eliminated); seat.neverShot += Number(!fired.some(a => a.id === id));
  });
}
const percent = n => +(100 * n / rounds).toFixed(2);
console.log(JSON.stringify({ rounds, seed: 1791552146, firstLapLimit, assumptions: 'All four players independently draw the current randomized bot styles each round. Policy-dependent estimates, not optimal play or human predictions.',
  averageShots: +(shots / rounds).toFixed(2), firstShotEndsPercent: percent(firstShotEnds), emptyPotPercent: percent(empty),
  firstTwoClaimAtLeast300BeforeSplitsPercent: percent(firstTwoTake300),
  seats: seats.map(s => ({ order: s.order, averageNetDollars: +(s.netCents / rounds / 100).toFixed(2),
    profitPercent: percent(s.profits), eliminatedPercent: percent(s.eliminated), neverShotPercent: percent(s.neverShot) })) }, null, 2));
