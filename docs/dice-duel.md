# Dice Duel — DICE_DUEL_V1

Single-player two-dice duel against the house at `/games/single-player/dice-duel/`,
listed in the homepage Single Player section. Uses the shared account header,
verified Torn identity, conditional chip ledger, wallet controls, sound/theme
settings, debug menu and numbered How to play dialog. Entering the table is free.
Wagers are 50K, 100K, 500K, 1M, 5M or 10M chips. Replay stays at the table; entering
or refreshing the page starts at the menu. Free practice is isolated from chips.

## Rules and math

Four independent uniform integers in 1–6, using server-side `crypto.randomInt`.
The first two are the player's dice; the next two belong to the house. Higher
total wins 1.8× the wager **including the wager**; ties return it; lower totals
return zero. Doubles have no extra effect. Timing cannot influence the dice.
There are exactly 1,296 equally likely outcomes: 575 wins, 146 ties, 575 losses.
Expected return is `(575 × 1.8 + 146) / 1296 = 91.1265432%`, giving an expected
house edge of 8.8734568%. Every supported wager produces integer payouts; the
largest return is 18M chips. Individual sessions can win. The edge is an
expectation, not a guarantee for every finite run.

## Settlement and recovery

`dice_duel_rounds` stores the immutable wager/dice/result before any wallet write.
`dice_duel_requests` binds each verified owner and request ID to that round. Owner
advisory locks prevent parallel rolls; row locks serialize recovery. A new roll
is blocked until 3.2 seconds after the previous settlement. Pending requests with
new IDs recover the existing round instead of charging another wager.

Funding and award are separate persisted states. Stable
`diceduel:<12 hex chars>:stake|refund|payout:<Torn ID>` receipts use the existing
wallet's conditional writes and mismatch checks. Ties use refund receipts.
Lost responses cannot reroll, duplicate the debit or duplicate the credit.
Failed funding exposes no dice, and reads/recovery are owner-bound. The API has
no client-supplied claim/payout action. Results and balances are not cached.

The frontend holds controls during rolls and uncertain purchases. Recover roll
reuses the original request. Reload recovers the last funded result through
`current`. Paid outcomes are settled before presentation, so navigating away
cannot cancel a loss or lose an award. Animation cancellation, BFCache, visibility,
mute and reduced-motion preferences do not alter settlement.

## Presentation and verification

The midnight teal/brass table has ivory player dice and obsidian house dice,
six physical pip faces per die, decelerating tumbles and bounces, individual
landing sounds, both totals and distinct win/tie/loss feedback. Mobile stacks
the seats vertically and keeps Roll within reach. Original synthesized dice
clatter combines short resin clicks and muffled felt impacts; it is cached,
bounded, and silenced on mute/background/navigation. No external audio is needed.
Only the selected game loads its renderer/audio; the homepage loads a lazy SVG.

```sh
node --test scripts/dice-duel.test.mjs scripts/site-hub.test.mjs
node scripts/dice-duel-simulation.mjs
npm run build
node scripts/dice-duel-browser.test.mjs
node scripts/site-entry-browser.test.mjs
node scripts/home-navigation-browser.test.mjs
```

The build includes existing protected Roulette, Safe Cracker and Summit Sprint
checks. Financial tests use the real wallet over isolated PGlite/store fixtures;
browser tests never use real accounts or award production chips.

Baseline note: the broader `scripts/rps.test.mjs` run has an existing static
homepage assertion for a literal RPS anchor in `shared/site/index.template.html`.
The homepage already creates that route in `assets/site-hub/hub.js` on the parent
commit. That unchanged assertion fails; the RPS rules/database/wallet tests and
the current desktop/mobile home-navigation browser checks pass.
