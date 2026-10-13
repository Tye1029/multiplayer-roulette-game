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
