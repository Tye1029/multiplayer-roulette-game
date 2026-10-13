# Minefield V2

Single-player pick-and-cash-out game at /games/single-player/minefield/.
Listed under Single Player on the homepage; shares the site header, public Torn
identity, preferences, debug menu and existing chip ledger.

## Rules and returns

- 25 tiles, five mine choices: 3, 6, 9, 12 or 15 (default 3).
- Wagers: 50K, 100K, 500K, 1M, 5M and 10M chips.
- One safe find is required before cashing out; a mine loses the wager.
- Clearing every safe tile automatically pays the final return.
- An unfinished field persists without a timer. Refresh/re-entry opens the menu
  and offers Resume without charging again. One active field per Torn identity.
- Practice uses a separate, cryptographically shuffled client-only board and
  never calls purchase, reveal or cash-out endpoints.

For m mines and k safe finds, survival probability is the product of
(25-m-i)/(25-i), i=0..k-1. Total return = floor(stake * 0.90 / probability).
BigInt rational arithmetic avoids floating-point payout errors. The expected
return at every cash-out depth for new fields is 90%, less than one chip of rounding per payout.
All allowed combinations and maximum stakes remain within safe integer limits.
New fields have a 10% expected house margin (before whole-chip rounding).
This is a long-run expectation, not a guaranteed profit in any session.
The mine selector shows each count's first-find multiplier. Menu and replay
previews show the next three total returns, the exact first-pick safe/mine chances,
and an expandable full multiplier ladder. Current return and profit remain
separate during play. Multipliers depend on mine count and consecutive safe finds,
not wager size. Higher wagers scale the chip amounts proportionally.

## V2 payout compatibility

V1 fields keep every original mine position, wager and the 96% return schedule,
including counts no longer offered for new fields. The server stores the payout
percentage on every new field; absent values mean the legacy 96% schedule. A
stale purchase screen must refresh before starting a new field. Existing
purchase aliases and unfinished fields remain recoverable with no extra debit.
The browser shows the saved field’s original multiplier and returns to the five
new choices and 90% schedule after that field finishes.

First safe-find returns on a 50K new field: 3 mines = 51,136; 6 = 59,210;
9 = 70,312; 12 = 86,538; 15 = 112,500 chips. Returns include the wager.

## Authority and persistence

The server uses crypto.randomInt and a partial Fisher–Yates shuffle. Mine
positions are committed before debit and never returned while a field is active.
The client sends only a tile index or cash-out intent, field ID, revision and
request ID. Owner-bound row locks serialize moves; revisions reject two-tab
conflicts. Actions and purchase aliases deduplicate retries.

PostgreSQL stores the board, revealed positions, action receipts and immutable
settlement. Wallet stake and payout receipts use the strict minefield prefix,
existing identity resolution, conditional writes and complete financial ledger.
A funding record is committed before debit. Terminal outcomes enter paying in a
committed transaction before wallet credit. Lost debit/credit responses can only
retry the same receipt. A failed payout cannot restore a lost field or alter a
reserved return. Cash-out/reveal races accept one action for a revision.

No raw board, wallet account or action history is included in active public state
or browser diagnostics. Responses are authenticated and no-store. Finished
boards reveal all mines for inspection. Failed purchases do not leave a playable
field or block a later funded purchase.

## Presentation

Charcoal, black and brushed-silver UI with matching steel board and white diamond
artwork. Red is reserved for the mine warning light and a loss. Original SVG board,
diamond and mine artwork; no third-party assets. Layered
floating menu artwork, beveled field tiles, crystal discovery particles, a single
mine shockwave and short shake, and a cash-out celebration. Sound is generated
locally: mechanical cover clicks, crystal resonances, low explosion/debris, and
coin chords. Audio starts only on interaction, respects shared mute, and stops
on background/navigation. No looping soundtrack or homepage audio load.

Mobile has a single-column layout and fixed Cash out control while a field is
active. Keyboard buttons and arrow navigation work; reduced motion removes
floating, reveal, particle and impact animations. New fields can be configured
from the result panel. Free practice is labelled throughout.

## Validation

- node --test scripts/minefield.test.mjs scripts/jackpot-junction.test.mjs scripts/lucky-scratch.test.mjs scripts/site-hub.test.mjs
- npm run build (includes protected Roulette/Safe Cracker and Summit checks)
- node scripts/minefield-browser.test.mjs
- node scripts/jackpot-junction-browser.test.mjs

Coverage: every payout depth/mine count; unbiased sample bounds; private state;
legacy mine-count/payout compatibility; new purchase quote validation;
wallet idempotency; crash recovery; ownership; insufficient funds; stale and
concurrent actions; complete/lose/cash-out; mouse/touch/keyboard; reload/resume;
dropped start/reveal/payout responses; free practice isolation; mute/reduced
motion; homepage entry; 1280px, 390px, 320px and landscape layouts.

## Simulation audit — October 13, 2026

Ran **25,000,000 unique boards** using the production cryptographic board
sampler: 5,000,000 for each of the five mine counts. Evaluated all six wagers
(50K, 100K, 500K, 1M, 5M and 10M), every available fixed cash-out depth
(**480 combinations**), and 65 combinations of mixed stopping or loss-chasing
strategies. The same boards are reused across wager amounts and stopping rules;
these are correlated comparisons, not 480 independently sampled runs.

Independent combinatorial checks confirm an expected house margin of
**10.000000%–10.001061%** for every new-field combination. Whole-chip rounding
accounts for the small amount above 10%. Backwards optimal-stopping checks show
that choosing whether to cash out after each safe pick cannot beat the expected
edge. All 1,800 legacy wager/depth combinations retain their original 4% minimum
expected house margin.

Observed house profit as a percentage of wagers, with a 50K stake:

| Mines | Cash out after 1 safe tile | After 3 safe tiles | Full clear |
| --- | ---: | ---: | ---: |
| 3 | 9.98% | 9.97% | 6.73% |
| 6 | 9.96% | 9.94% | 42.62% |
| 9 | 10.00% | 9.95% | -83.87% |
| 12 | 10.03% | 9.89% | 6.39% |
| 15 | 9.96% | 10.16% | -17.68% |

These are measured results from this run, not guaranteed future margins.
The full-clear strategy lost chips for the house with 9 and 15 mines despite
5 million rounds per mine count. Four mine/depth combinations produced losses
in the sample (9 mines at 14 or 16 finds; 15 mines at 9 or 10 finds), across all
six wagers. That is 24 of 480 correlated scenarios, not a 5% probability of loss.
All mixed-strategy samples produced positive house profit, but their rare tails
also prevent a finite-run guarantee. Loss-chasing samples returned house margins
between 9.93% and 10.08% of the chips actually wagered.

The largest current prize is **46,802,700,000,000 chips** for a 10M wager,
12 mines and all 13 safe finds. Its probability is 1 in 5,200,300. A house edge
alone does not make that payout affordable. A maximum payout or explicit reserve
limit is recommended before relying on finite-run profitability. This audit does
not change the payout rules, cap prizes, or spend any player chips. It covers
Minefield stake/payout flows only; bonuses and other games are outside its scope.

Re-run with:

```sh
node scripts/minefield-simulation.mjs --rounds 5000000 --out docs/minefield-simulation-results
```

- [Full fixed cash-out results](minefield-simulation-results/fixed-cashouts.csv)
- [Mixed-strategy results](minefield-simulation-results/mixed-strategies.csv)
- [Summary, source hashes, raw histograms and sampling intervals](minefield-simulation-results/summary.json)

The generator uses fresh crypto randomness on every run, so measured results
will differ. Exact expectation checks must continue to pass. Individual 95%
Wilson intervals are included for fixed depths; rare full-clear intervals are
wide and must not be read as a guarantee across all 480 scenarios.
