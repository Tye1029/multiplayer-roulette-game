# Lucky Dice and Dice Duel — DICE_V2

Lucky Dice is the solo higher/lower game at `/games/single-player/lucky-dice/`.
Dice Duel is the live two-player game at `/games/multiplayer/dice-duel/`.
Both use the shared Torn profile, Chip wallet, account menu, sound/theme settings,
debug controls, and responsive felt table with real six-face dice.

## Lucky Dice: rules and exposure

Choose a threshold from 3 through 11 and a strict **higher** or **lower** prediction.
The combined total of two fair dice must satisfy that comparison. Equality loses.
Before paying, the menu and table show exact winning combinations, probability,
total return including stake, and multiplier. Wagers: 50K, 100K, 500K, 1M, 5M, 10M.
Entering is free. Practice cannot spend or award Chips.

For `w` winning ordered combinations out of 36, the total winning return is
`floor(stake × 342 / (10 × w))`. This targets 95% RTP / 5% house edge, with rounding
slightly in the house's favor. Under 3 pays 34.2×; over 3 pays about 1.03636×.
Thresholds 2 and 12 are excluded: they create impossible predictions or a 35/36
chance whose 95%-RTP return would be less than the wager. All offered winning
returns exceed the wager. Dice use two independent server-owned crypto draws.

No hidden payout cap changes these odds. The maximum return is 342M at a 10M
wager and a one-combination prediction. If that exposure is too large, lower the
largest offered wager rather than secretly cap a stated multiplier. A positive
expected house edge does not guarantee a profit in every finite session.

Exhaustive tests cover all 36 outcomes at every threshold, direction and wager.
One million simulated rolls per setting (18M total, reproducible seed 1260813)
returned 94.9707% overall; each setting produced a house profit in that run.

## Multiplayer rules and shared integration

Public/private games, wager quote acceptance, private code/link entry, live open
games, Ready, three-second countdown, and 60 seconds to roll. Both results stay
hidden until both players roll. Higher total wins the shared prize after the same
configured settlement rate as other multiplayer games. A tie reveals both rolls,
pauses 5.5 seconds, then starts another countdown without another stake.

One missed roll forfeits to a player who rolled. If neither rolls, both wagers
return. Only an empty waiting game can be cancelled. Rematch requires both
players' consent and fresh stake reservations. Avatar consent bubbles, opponent
ready notifications, leaderboard, and the shared achievement UI are connected.
Bot games use zero Chips and cannot earn achievements or leaderboard records.
The eight multiplayer achievement rewards total 1M with the existing long-term
game/day gates; unique stats track doubles, double sixes, and tiebreak wins.

## Funding, recovery and retained compatibility

Lucky Dice commits immutable dice, target, direction and payout before wallet
writes. Owner locks serialize purchases; stable luckydice ledger receipts make
lost debit/credit replies recoverable. A new request while an earlier purchase is
pending recovers that purchase. Cooldown is server-enforced. No client payout or
result can affect settlement. UI locks predictions while a purchase is uncertain.

Dice Duel persists its server-owned room in diceduel_rooms and uses the existing
shared/table-finance intent/recovery layer for wagers, refunds and every rematch.
Requests are idempotent, seats are bound to verified identity, and stale rounds
or matches cannot roll again. Payouts recover on subsequent requests/lobby sweeps
even after a lost wallet response. Timeout/forfeit results cannot farm achievements.
Prize and rematch amounts come from authoritative state.

The old single-player URL redirects to Lucky Dice. The old dice-duel-action
endpoint, dice_duel_rounds / dice_duel_requests, original rules, and financial
tests remain deliberately: previously purchased rolls and already-open older
clients retain their original 1.8×/tie-refund terms. Lucky Dice checks that prior
store on reconnect so outstanding payouts finish. Do not drop these historical
records or reinterpret their terms. Superseded frontend, browser test and old
simulation were removed; the four-die renderer remains shared by both new modes.

## Presentation and verification

Dice use continuous deceleration with sampled transform frames, smooth shallow
bounces and exact authoritative landing faces. Rules sit inside the oval rail.
Reduced-motion mode, mute, backgrounding and navigation cancel playback safely.
Roll audio uses the existing recorded dice throws from
[Kenney Casino Audio](https://kenney.nl/assets/casino-audio), licensed CC0;
see assets/site-hub/audio/LICENSE.json. Three varied recordings are decoded
lazily for this game and layered at decreasing volumes. Result chords are original.

```sh
node --test scripts/lucky-dice.test.mjs scripts/dice-duel-multiplayer.test.mjs scripts/dice-duel.test.mjs scripts/site-hub.test.mjs scripts/unified-tables.test.mjs
node scripts/lucky-dice-simulation.mjs
npm run build
node scripts/dice-v2-browser.test.mjs
node scripts/site-entry-browser.test.mjs
node scripts/home-navigation-browser.test.mjs
```

Browser QA uses actual handlers/stores with isolated PostgreSQL, synthetic Torn
identities and a local Chip ledger: no production account funding. Checks include
desktop, 390/320-pixel phones and landscape; paid solo win/loss/equality, two-player
ties/wins, rematches, private/public lobbies, bots, deadlines, cancellations,
lost replies, actual dice faces, audio decoding/mute, reduced motion and redirect.
The build includes protected Roulette, Safe Cracker and Summit Sprint checks.

Existing unrelated baseline: scripts/rps.test.mjs expects a literal RPS anchor
in the static homepage template. The current homepage creates it dynamically in
assets/site-hub/hub.js; current homepage browser checks cover that route. That
assertion was not changed or bypassed.
