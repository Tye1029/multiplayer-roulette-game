# Plinko V1

Single-player game at `/games/single-player/plinko/`, listed beside Minefield,
Jackpot Junction and Lucky Scratch. Uses the shared Torn identity, chip wallet,
transaction ledger, site header, settings, mute, deposit/withdraw and debug menu.

## Play and presentation

- Main menu uses the shared centered title and How to play control, settings on
  the left, and original animated board artwork on the right.
- 16 peg rows, 17 prize pockets, Low / Medium / High risk. One ball at a time.
- Wagers: 50K, 100K, 500K, 1M, 5M and 10M. Entering the board is free; Drop ball
  purchases one drop. The board stays open for subsequent drops.
- Reload/navigation returns to the main menu. The last result and ten recent
  paid drops are restored from the server when entering again.
- Every return includes the wager. Values below 1x return only part of the wager.
  The result separately describes net profit or loss. Maximum total return is
  50,000,000 chips. Pocket labels and the payout table already apply the cap.
- Free practice uses crypto-random independent directions, the same rules and
  presentation, and its own local history. It never purchases or awards chips.
- Canvas board has brushed rails, lit metal pegs, a gold ball with a short trail,
  parabolic bounces, pocket highlights and a restrained prize burst. The animation
  follows the actual server path, never a fabricated near miss.
- Original synthesized mechanical gate, rolling texture, short marble/metal peg
  impacts, pocket landing and coin resonance. No third-party media. Audio starts
  on interaction, respects site mute and stops in the background or on navigation.
- Phone layout stacks the board and controls; the Drop button stays within thumb
  reach and each drop scrolls the board into view. Keyboard buttons and native
  selects work. Reduced motion removes trails/bounces and hero movement.
- Cached static canvas drawing and capped pixel density keep mobile rendering
  light. Idle boards have no animation loop. Game scripts/audio are route-specific;
  the homepage only loads the lazy thumbnail. No superseded assets were created.

## Odds and payout math

Each of the 16 directions is independently selected with `crypto.randomInt(2)`.
All 65,536 paths are equally likely. Pocket k has probability C(16,k)/65,536.
Payouts are integer hundredths of the wager, with a 50M total-return cap. The
shared rules define symmetric tables; the server calculates all payouts.

Before the cap affects a prize, the expected returns are 89.9767% Low, 89.8631%
Medium and 88.7070% High. This is a mathematical expectation, not a guarantee for
any player or finite run. Timing and visual bounces do not influence the odds.

The fixed cap reduces the return at larger wagers, especially High risk. At 10M,
expected returns are 89.9675%, 86.7656% and 65.2847% respectively. The payout table
shows each actual capped amount before purchase; it never promises uncapped prizes.

Exhaustive tests enumerate every path and verify all 18 wager/risk combinations,
symmetry, path endpoints, integer payouts, and the maximum prize. An additional
5,000,000 production random paths produced positive house profit in all 18
scenarios. Scenarios share sampled paths, so they are correlated comparisons.
Results: [simulation report](plinko-simulation-results.json). Re-run offline with
`node scripts/plinko-simulation.mjs`; no player wallets or live APIs are used.

## Server and wallet integrity

`plinko_drops` holds the owner, immutable wager/risk, complete path, payout,
funding intent and settlement state. `plinko_requests` binds request IDs to their
original drop. Owner advisory locks serialize starts; row locks serialize recovery.
The result is committed before debit. A funded result becomes `awarded` in a
committed transaction before the wallet is credited. Lost responses retry the
same `plinko:<id>:stake|payout:<owner>` ledger receipts, without rerolling.

No client result, path, multiplier, payout or limit is accepted. New purchases
must acknowledge PLINKO_V1. Only the verified player can recover/read a drop or
history. Funding results do not expose their path. Wallet errors cannot grant an
unfunded prize. Repeated clicks, concurrent windows and dropped responses cannot
double-charge or pay twice. New purchases are rate-limited to one per 3.6 seconds;
request-ID retries recover even inside that interval.

The sole shared-wallet change adds the strictly formatted `plinko` receipt prefix.
Existing conditional writes, account resolution and ledger validation remain intact.

## Validation

```sh
node --test scripts/plinko.test.mjs scripts/minefield.test.mjs scripts/jackpot-junction.test.mjs scripts/site-hub.test.mjs
node scripts/plinko-simulation.mjs
npm run build
node scripts/plinko-browser.test.mjs
node scripts/minefield-browser.test.mjs
```

Browser QA covers desktop, 390px/320px phones, landscape, mouse/touch/keyboard,
actual path/result agreement, partial returns, maximum wins, insufficient funds,
reload, interrupted responses, simultaneous windows, practice isolation, mute,
reduced motion, BFCache, debug and the homepage link. The build also runs the
existing protected Roulette, Safe Cracker, Summit Sprint and shared validations.
