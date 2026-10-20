# Back Alley Derby

Version: `BACK_ALLEY_DERBY_V2_RACE_DAY`. Single-player pick-the-winner betting on six rats.
Page: `/games/single-player/back-alley-derby/`. Homepage Single Player tile included.

## Rules and economics

| Racer | First-place probability | Gross return multiplier |
| --- | ---: | ---: |
| Big Cheese | 30% | 3× |
| Drain Runner | 24% | 3.75× |
| Crumb Lord | 18% | 5× |
| Sewer Sam | 13% | 90/13× |
| Miss Mischief | 9% | 10× |
| Longshot Lou | 6% | 15× |

Win payout is `floor(stake * 90 / probabilityPercent)` including the stake.
Every ticket has a theoretical 90% return or marginally less due to whole-chip
rounding. The wager choices match the other single-player games, 50,000–10,000,000
chips. The largest possible award is 150,000,000 chips. No mid-race wager changes,
cash-outs, side bets, bonuses or gameplay inputs alter the result.

The server uses crypto.randomInt with integer weighted sampling without replacement.
Only first place affects money. The remaining order is drawn with the same weights
among the remaining racers. Each saved order and visual seed yields reproducible,
monotonic race paths; all rats cross in the authoritative order. Four seeded formations
spread the pack, vary the leaders and let racers surge and fall behind. Shape-preserving
cubics join the bursts with continuous velocity. Cosmetic pace cannot change a ticket. Count-in: 1.8 seconds;
race presentation: 11.8 seconds. Practice uses rejection-sampled Web Crypto draws
and identical rules, with no wallet writes.

## Ownership and recovery

The authenticated owner, fixed wager, racer, drawn result and unique request receipt
are saved before any wallet write. Owner advisory locks coalesce simultaneous starts.
Only one unfinished race is allowed for each owner. Stable, strict `derby` receipt IDs
make both stake and award idempotent even if a cross-store response is lost. A race
starts after funding, with a saved server deadline. Settlement happens only after that
deadline on `current`/recovery; a closed tab is settled on return. Payout and race times
from the browser are ignored. A different owner cannot recover a race.

The saved order is sent after funding to animate the race locally. This is deliberate:
the bet is already immutable and there are no actionable decisions during a race.
Knowing that order cannot change or cancel the funded wager. Private owner/account
fields are never sent. An interrupted browser keeps its start receipt for retry; reload
and additional windows also recover the server's existing race. Finish requests identify
their exact race, so a newer race started in another tab cannot replace an older result. A changed profile
invalidates pending browser responses. Race timing uses one monotonic animation clock,
never network-driven frame positions. Hidden tabs do not render or play sound.

## Art, audio and accessibility

Original generated environment, four-frame rat atlas, and cover are optimized WebP
files in `assets/back-alley-derby/images/`. Exact prompts and built-in tool provenance
are recorded in `images/provenance.json`. Sprites preserve alpha and aspect ratio;
fur variants and numbered saddle overlays identify each racer. Background and tinted
frames are cached. Canvas resolution is capped at 1.5×; no per-frame image filtering.
All game media loads only on the derby page, except the lazy-loaded homepage cover.

The menu uses a framed, silent animated track with live running order, reusing the
actual game scene. Reduced motion keeps the menu still. The old menu-cover CSS was
removed; `cover.webp` is retained because the lazy homepage card still uses it.

Quiet original plucked bass, countdown and result cues use bounded Web Audio voices.
A recorded, softened CC0 starter pistol fires once at the start. Three recorded Kenney
CC0 impacts create staggered, panned paw steps. Low background crowd chatter rises
slightly toward the finish, with a short cheer for either result. Crowd recordings are
Gregor Quendel CC BY 4.0 excerpts, reused locally from the existing licensed game
audio. Full sources, licenses and transformations are in `audio/CREDITS.txt`, linked
from the game footer. Assets decode once and audio nodes are capped at 24. Global mute is respected, audio starts only
after interaction, and hidden pages stop voices. Reduced motion removes sprite cycling,
dust and confetti while keeping the race readable. Controls support keyboard/touch;
live results are announced. No unused duplicate source recordings were added to the repository.

## Validation

`node --test scripts/back-alley-derby.test.mjs`

`node scripts/back-alley-derby-simulation.mjs`

`npm run build`

`node scripts/back-alley-derby-browser.test.mjs`

CI also runs shared wallet/site tests and protected build regressions. Browser tests
cover desktop/mobile practice and funded races, result/return, lost requests, reload,
duplicate windows, mute, reduced motion, and homepage navigation.

V2 verification: 2,000,000 complete simulated races returned 89.895%–90.221% across
the six picks at 50,000 chips. Exact enumeration verifies at most 90% expected return
for every pick and stake; it does not guarantee house profit over a finite sample.
Regression coverage includes continuous forward movement and correct finish order
for 250 seeds, randomized lead changes for 1,000 seeds, older-tab recovery, legacy
funded tickets, one-shot starter playback, crowd cleanup, and still reduced-motion previews.
