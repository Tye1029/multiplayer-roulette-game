# Minefield V1

Single-player pick-and-cash-out game at /games/single-player/minefield/.
Listed under Single Player on the homepage; shares the site header, public Torn
identity, preferences, debug menu and existing chip ledger.

## Rules and returns

- 25 tiles, selectable 1–24 mines (default 3).
- Wagers: 50K, 100K, 500K, 1M, 5M and 10M chips.
- One safe find is required before cashing out; a mine loses the wager.
- Clearing every safe tile automatically pays the final return.
- An unfinished field persists without a timer. Refresh/re-entry opens the menu
  and offers Resume without charging again. One active field per Torn identity.
- Practice uses a separate, cryptographically shuffled client-only board and
  never calls purchase, reveal or cash-out endpoints.

For m mines and k safe finds, survival probability is the product of
(25-m-i)/(25-i), i=0..k-1. Total return = floor(stake * 0.96 / probability).
BigInt rational arithmetic avoids floating-point payout errors. The expected
return at every cash-out depth is 96%, less than one chip of rounding per payout.
One mine/one find returns the original stake; later finds increase it. All
allowed combinations and maximum stakes remain within safe integer limits.
The initially selected 4% margin matches the existing single-player games.
The UI shows total return, separate profit, the next find and the mine count.

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

Original SVG board, emerald and mine artwork; no third-party assets. Layered
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
wallet idempotency; crash recovery; ownership; insufficient funds; stale and
concurrent actions; complete/lose/cash-out; mouse/touch/keyboard; reload/resume;
dropped start/reveal/payout responses; free practice isolation; mute/reduced
motion; homepage entry; 1280px, 390px, 320px and landscape layouts.
