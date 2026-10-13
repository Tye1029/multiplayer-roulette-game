# Jackpot Junction V1

Single-player slot machine at `/games/single-player/jackpot-junction/`, linked
from the homepage Single Player section. Uses the shared menus, identity,
preferences and existing chip wallet. Wagers: 50K, 100K, 500K, 1M, 5M and 10M.
The handle supports mouse drag, touch drag and keyboard activation. A separate
Spin button provides the same action. Opening the machine never spends chips.

## Approved allocation

The shared jackpot starts at **128,338,393 Chips**, inserted once. Each funded
spin contributes exactly 6% of its stake; the house allocation is 4%. Regular
prizes have an exact 90% expected return, not a guaranteed per-spin return.
The jackpot grows only from real funded spins, not timers or demo activity.
Regular wins do not reduce it. A jackpot pays the complete current pool,
including that spin's contribution, and resets to zero. Deployment, refreshing,
and creating new accounts never reseed it.

| Match | Total return | Probability per spin |
| --- | --- | --- |
| Cherries | 1× stake | 14% |
| Bells | 2× stake | 15% |
| Bars | 3× stake | 7% |
| Sevens | 5× stake | 3% |
| Diamonds | 10× stake | 0.8% |
| Crowns | 20× stake | 0.1% |
| Junction seals | Entire jackpot | Stake / 5,000,000,000 |

The server draws one unbiased integer in [0, 1,000,000). Regular prize ranges
are fixed. The jackpot range is stake/5,000 outcomes drawn from the remaining
losing range. Jackpot probability runs from 1/100,000 at 50K to 1/500 at 10M,
so every chip buys the same jackpot chance. Regular prize probabilities remain
unchanged at every stake. The rest are misses; misses never show a winning trio.
The initial seed is an extra prize subsidy. The 4% expected margin applies to
subsequent stakes over the long run, rather than guaranteeing a short-run profit.

## Persistence

PostgreSQL stores immutable spin intents, request aliases, results and the
shared pool audit totals. The existing blob wallet stores debits/payouts using
stable `junction:SPIN_ID:stake|payout:TORN_ID` receipts and conditional writes.
Verified Torn identity resolves to the existing wallet; a new API key creates
no new balance or welcome award.

1. Commit the intent and random result before attempting the debit.
2. Debit idempotently, lock the shared pool, add its contribution, and reserve
   any jackpot. Commit that exact award before attempting a wallet payout.
3. Credit the saved award idempotently. A retry cannot change the saved prize,
   re-add a contribution, or award the same jackpot pool to another winner.

Failed debit attempts contribute nothing. Unknown outcomes remain recoverable.
Pending spins block another purchase for that player. Distinct successful
spins have a server-enforced 3.6-second minimum interval. The public meter sends
only amount, cycle and monotonic version, polled once per 15 seconds on visible
pages. Completed spins return the latest meter immediately. Stale responses
cannot move the displayed pool backward to an earlier version.

The pool records cumulative wagered, contributed, jackpot paid, house allocated,
regular prizes paid, and a regular-prize reserve (90% allocations minus actual
regular payouts). The reserve may be negative due to short-run variance.
Individual player transactions appear in the existing admin financial ledger.

## Validation

- `node --test scripts/jackpot-junction.test.mjs scripts/site-hub.test.mjs`
- `npm run build`
- `node scripts/jackpot-junction-browser.test.mjs`

Tests cover the entire million-outcome base distribution, all wager boundaries,
real wallet CAS receipts, crash recovery, simultaneous jackpots, no reseeding,
funds/auth validation, physical handle inputs, demo isolation, and mobile layout.

## Cabinet presentation V4

The main menu opens with **Play Slots**. A sculpted gold crown, enamel marquee,
glass reflections, chased lamps, larger jackpot display and working cabinet Spin
button replace the V2 cabinet. The cabinet art and reel symbols are self-contained
SVGs; animation remains in lightweight CSS and the existing reel renderer.

The lever's mount, stationary axle, projected shaft and spherical grip use one SVG
coordinate system. Pointer input redraws the shaft from that fixed pivot and places
the grip at its endpoint. A front-facing projection keeps the pull nearly vertical, enlarging the grip as it approaches the player; it is drawn in front of the axle cap. A short animation returns it to rest. This replaces the
V2 CSS perspective transform that visually separated the arm from its mount.
A drag of at least 35 pixels starts a spin; short pulls and pointer cancellation
do not spend chips. The handle also supports keyboard activation. The square beveled cabinet button, the side Spin
button and the lever share the same request and disabled-state guards.

Visual references (original artwork, no copied branding/assets):
- IGT DiamondRS cabinet: https://www.prnewswire.com/news-releases/igt-revolutionizes-mechanical-reel-slot-category-with-diamondrs-cabinet-301585377.html
- Golden Casino illuminated frame: https://freecasinogames.net/games/video-slots/golden-casino2773.html

The game-local audio module generates the spring latch, three separately panned rolling reel
loops with startup acceleration and independent braking, staggered reel locks, and coin/bell win accents using Web Audio.
Each reel slows and gives a weightier two-part pawl/clunk as it stops. Loops are cached after their first spin. Mute, backgrounding, navigation and request errors
stop the loop. Audio failure cannot interrupt settlement. Reduced motion disables
chase, reel and coin animations. No external audio or new bitmap downloads are
needed; the former shared Bluff win sound remains in use by other games.

Browser coverage includes cancelled/short pulls, keyboard activation, motor
start/stop/mute/background/error behavior and reduced motion, in addition to
paid mouse/touch spins, recovery and the 320px/390px/desktop layouts.

V3 browser checks also inspect shaft-to-axle and shaft-to-grip continuity at three
pull positions on desktop and touch devices, full-travel viewport fit, spring
return, the Play Slots label, and the cabinet Spin button.

V4 removes the public spin-ID and LIVE labels, centers the unrotated marquee,
and labels the gold JJ icon directly in the paytable and rules. Internal spin IDs,
ledger receipts and jackpot accounting are unchanged.
