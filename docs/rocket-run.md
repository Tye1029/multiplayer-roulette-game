# Rocket Run V2

Single-player flight game at `/games/single-player/rocket-run/`, linked in the
homepage Single Player section. Uses the existing verified Torn identity, chip
wallet, timestamped ledger, header, menu, notifications, mute and debug controls.

## Play and presentation

- 50K, 100K, 500K, 1M, 5M and 10M wagers. Launch spends the displayed amount.
- Three-second countdown, then a continuously rising multiplier. Cash out before
  the secret crash to collect the total return, including the wager.
- Optional automatic cash-out from 1.10x up to the wager's maximum multiplier.
  The target is immutable once funded. The server resolves it even after a long
  disconnect; reconnecting applies any pending credit without another purchase.
- Maximum total return is 50M. Surviving to that limit automatically cashes out.
  Crash takes priority at an exact tie. Flights can crash immediately at 1.00x.
- A reload or return opens the menu. A funded flight can be resumed. Finished
  flights allow changing wager/target and immediately launching the next one.
- Separate free practice uses identical math and never calls paid game actions.
- Original SVG rocket/cover and canvas scenery: lit porthole, metallic hull,
  engine plume, parallax stars/clouds, layered mountains, launch pad and skyline.
  Flights continuously bank both ways rather than stopping at one position.
  Each flight independently selects one of eight shaded moon phases, plus sparse
  satellite flybys and shooting stars. Scenery never depends on the crash draw.
  Successful cash-out produces a gold burst; a crash scatters debris.
- Original Web Audio ignition, relay countdown, soft looped engine, airlock and
  landing chord, and a short breakup sound. Shared mute and background silence.
- Phone layout places cash-out directly beneath the scene, ahead of settings.
  Keyboard/touch support, visible focus, reduced motion and light/dark themes.
  Canvas limits pixel density to 2, renders at 30 fps during flight, and stops
  after its short result effect. Hidden pages do not poll or animate.
- No recent-results panel or net-loss display. The current payout remains clear.

## Payout math

Server draws a uniform integer U from 0 through 2^32-1 using Node crypto.
Crash hundredths C = max(100, floor(90 * 2^32 / (U+1))). A target T succeeds
only if C > T. Its exact success probability is:

`(ceil(90 * 2^32 / (T+1)) - 1) / 2^32`

The multiplier grows as exp(0.12 * elapsedSeconds), rounded down to hundredths.
Returns are integer chips, capped at 50M. Expected return at a fixed cash-out
target ranges from about 89.11% at 1x to just under 90% at 1000x. Increasing a
target increases potential payout and reduces its survival chance. This is a
long-run expectation, not a guarantee for any finite set of flights.

Tests check every hundredth target at every available stake. A separate
2,000,000-flight production-RNG V2 simulation returned 86.80%–90.36% across fourteen
targets from 1x through 1000x. All sampled targets returned less than the stakes;
the exact probability formula establishes the advantage regardless of a sample.
Run `node scripts/rocket-run-simulation.mjs` for a fresh report.

## Timing and integrity

The crash value never leaves the server while the flight is active. Clients
cannot submit a crash, payout, start time or accepted cash-out timestamp.
Manual cash-out captures server time immediately after authentication, before
waiting for the flight row lock. Browser timestamps and requested multipliers
are ignored. Already committed terminal results cannot be changed. Automatic targets
are evaluated against immutable deadlines, independently of polling frequency.
Active polls no longer read the wallet separately. Response clocks are sampled
after any balance read; the client estimates transit time from server duration
and round-trip time. This avoids displaying seconds-old multipliers as current.
The UI freezes the rocket and multiplier immediately on pressing Cash out;
late polling replies cannot overwrite that pending action. Auto cash-out freezes
at its target and requests confirmation immediately, without waiting for the next
normal poll. Neither pending state claims a win before the server confirms it.
After 1.8 seconds without a fresh response, the manual button reconnects rather
than offering cash-out against stale flight information. Network travel and
authentication still happen before verified receipt; a request arriving after
a crash cannot be guaranteed a payout without permitting backdated claims.

Owner advisory locks serialize new flights. Row locks serialize resolution.
An immutable launch intent precedes debit; an immutable result precedes credit.
Strict `rocket:<12 hex chars>:stake|payout:<Torn ID>` receipts use the existing
conditional wallet writes. Repeated requests, concurrent windows and lost wallet
responses cannot reroll a flight, duplicate its charge or award it twice.
One funded flight per verified player; ownership and authentication are checked
before any read or mutation. Failed funding cannot expose a playable flight.

Active visible flights poll after a 650ms gap, with no overlapping polls. Target
confirmation uses a bounded 200ms gap until resolved.
Unchanged flight polls do not write the state. There is no idle menu polling.
Settlement after closing the page is evaluated on the next server request; it
does not require a client timer to run, and uses the original target/deadlines.

## Validation

```sh
node --test scripts/rocket-run.test.mjs scripts/plinko.test.mjs scripts/minefield.test.mjs scripts/site-hub.test.mjs
node scripts/rocket-run-simulation.mjs
npm run build
node scripts/rocket-run-browser.test.mjs
node scripts/site-entry-browser.test.mjs
```

The build includes the existing protected Roulette, Safe Cracker and Summit
Sprint checks. Browser tests cover manual/automatic/crash/cap results, failed
funding, duplicate windows, reload and retry recovery, desktop, 390/320px phones,
landscape, free practice, mute, reduced motion, light theme, BFCache and homepage.
V2 also tests delayed manual/auto responses, frozen pending displays, one request
per press, lock queue latency, forged timestamps, response clock accuracy and
wallet-free active polls. Shared entry tests cover tab-local session reuse,
expired/rejected sessions, changed profiles, sign-out and free play during a slow
login. Session reuse never skips server authentication or paid-game recovery.
