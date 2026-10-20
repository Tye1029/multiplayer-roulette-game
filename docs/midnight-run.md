# Midnight Run V6 — recorded storm ambience and continuous camera travel

Single-player automatic runner at `/games/single-player/midnight-run/`, linked
from the homepage Single Player section. Shares the verified Torn identity,
wallet and timestamped admin ledger, header, settings, mute, theme and debug UI.

## Play

- Wagers: 50K, 100K, 500K, 1M, 5M or 10M chips.
- Choose Low Risk (original), Medium Risk or High Risk before starting. Difficulty is
  immutable for a funded run and restored on resume. Practice uses matching odds.
- First-block clear chances are 80%, 70% and 60%; a 50K wager returns 56,250,
  64,285 or 75,000 chips respectively. Each difficulty option shows its first-block multiplier, without a percentage;
  each corner shows the next block's clear/capture chances and total return.
- Three-second countdown, then a 4-second run to the first corner.
- Surviving a block stops both the runner and street. Choose **Continue** to risk
  one more block, or **Cash out** to secure the displayed return. No decision timer.
- Getting caught during an attempted block loses the wager. Cash-out is disabled
  while running; waiting at a cleared corner never risks another block.
- Auto escape has been removed from settings, local preferences and new runs.
- 50M maximum total return. Reaching the cap completes the run.
- Refresh/re-entry offers Resume for an active paid run. An interrupted block
  resolves once; a cleared corner then waits indefinitely. Replay stays in the
  scene. Free practice uses the same corner flow and never calls a paid action.

## Payout math and audit

Low Risk (stored as `normal` for existing contracts) is unchanged: the first block survives 80 of 100 equally likely crypto
draws, then 88, 86, 84, …, 44. Medium Risk uses 70, then 79, 77, 75, …, 35.
High Risk uses 60, then 70, 68, 66, …, 26. Difficulty changes the risk schedule;
all three use the same payout formula, rounding and 50M cap. For a fixed cleared block k, let P be the product
of its safe probabilities. Total return is `min(50M, floor(stake * 0.90 / P))`.
BigInt rational arithmetic makes each quoted amount exact in whole chips.

Before the cap, every fixed exit has approximately 90% expected return (less
whole-chip rounding). A backwards optimal-stopping check confirms that choosing
whether to continue based on already cleared blocks cannot remove the 10%
minimum expected house advantage. Scenery, character movements and lighting use
no secret outcome data. At the capped final block, the truncated prize reduces
expected return further, as low as 45.19% for one High Risk stake/target combination.
Only reachable targets are offered; later blocks disappear once the cap is reached.

A 15,000,000-route production-RNG simulation (5M per difficulty) covered all
**219 reachable difficulty / stake / exit combinations**. Observed returns were
**45.82%–91.82%**; every sampled combination
had positive house profit. This is a finite sample, not a guarantee for future
sessions. Bonuses or other games are outside this audit. Exact expectation and
optimal-stopping checks, rather than a profitable sample, establish the edge.

Results: [simulation report](midnight-run-simulation-results.json).
Run `node scripts/midnight-run-simulation.mjs` for a fresh sample.

## Authority and recovery

An immutable secret route is committed to PostgreSQL before funding. Owner
advisory locks serialize purchases; row locks serialize resolution. One unfinished
run is allowed per verified Torn ID. Purchase request aliases recover concurrent
starts and lost responses without a second stake or a new random route.

A terminal result is committed before applying the independent wallet credit.
Strict `midnight:<12 hex>:stake|payout:<Torn ID>` receipts use the existing
conditional wallet writer. Retries after lost debit or payout responses recover
the same immutable amount. Failed funding cannot expose a playable run.
The admin record retains both entries and their timestamps, with Midnight Run
reasons. Existing shared wallet validation remains intact apart from allowing
the new, equally constrained receipt prefix.

Future capture location, wallet account, owner and continue receipt fields never
leave active server state. Client timestamps, claimed prizes and auto targets
cannot change a new run. Each Continue identifies the cleared corner and carries
an idempotent request ID. Duplicate or delayed requests cannot skip another block;
stale corner choices are rejected. Cash-out and Continue share the row lock.
Corner arrival, clock and settlement are server-owned. New runs store a four-second
block duration; existing funded runs retain their original 4.5-second duration.
Client-supplied durations cannot change it. A monotonically increasing
revision is saved under the row lock whenever game state changes. The client rejects
older revisions even if a delayed poll has a later response timestamp, preventing
an old corner from reappearing after Continue. Competing Continue/Cash out requests
are tested in both orders on all three difficulties; only one decision takes effect.

Existing V2 corner records without a difficulty use Low Risk, with their original
route and payout intact. Already-funded V1 records retain their original settlement contract so deployment
cannot change an existing wager. The legacy resolver remains solely for those
records; new starts use `mode: corners` and reject non-null auto targets.

Visible paid runs poll without overlap every 700ms while running and every second
at a corner to synchronize other windows. Active polls avoid wallet reads and
unchanged-state writes. Menus and hidden pages do not poll. The client stops at
unconfirmed corners, disables choices after two seconds without a fresh reply,
and rejects stale replies and responses from an old profile/page lifetime.

## Art, effects and audio

Original generated Neon Strip, Old Quarter, Dockside and Market Row art, a four-frame runner
sheet and a patrol sedan are optimized WebP files under `assets/midnight-run/images`.
Artwork retains its aspect ratio; the viewport crops instead of stretching.
A cosmetic plan seeded only by the public run ID chooses each left/right building
lot separately. Neon venues occur on only one side of a row, with one or two rows
of ordinary buildings between them. Neighboring lots on the same side use different
source neighborhoods. A new run changes the layout; reconnecting preserves it.
The road scrolls continuously beneath cropped properties, with alley-edge shadows
and lighting attached to each venue. Plans are cached per run and never use secret
capture data, difficulty or per-frame randomness. The four environment images
remain in use as building/road sources, so none are superseded.
The menu is a live scene, with the same runner and lighting as gameplay.
Rain, steam, puddle ripples, moving headlight cones, soft patrol lights and
world-space street movement are canvas overlays. Neon Strip adds casino, strip-club,
diner, hotel and bar exteriors with neon reflections and gentle world-space light
pulses. Street travel is 140 pixels/second (previously 85); runner animation is
8.8 frames/second (previously 13.2), with footsteps slowed to 0.46-second intervals. Escape animates a clean getaway;
capture brings the patrol car up behind the runner before the result appears.
At a corner the runner eases toward the curb, breathes and waits under a soft light.
The “Catch your breath” card holds the Continue and Cash out buttons directly
below the message. These are the same authoritative controls, moved into the scene
while waiting and returned to the side panel otherwise. Visual rain and mist remain alive.
Reduced motion keeps this presentation still.

Active play now draws on every browser animation frame instead of a 16ms gate that
could skip refreshes. Canvas dimensions come from ResizeObserver, road/building
crops and light textures are cached, rain strokes are batched, and next-block
payout math is cached. Each leg now anchors its visual clock once to monotonic browser time. Later polls
cannot rewind it or freeze it after the two-second freshness limit; it advances
only to that leg’s boundary. Choices and outcomes still wait for server confirmation.
The waiting runner breathes at the curb. Tests inject 3.2-second poll delays and
backwards clock corrections. Street crops and runner frames are decoded and
prepared before use, the obscured parts of the base road are no longer painted,
mobile pixel density is capped at 1.5, and progress uses a compositor transform. Nearby street strips are composited once and evicted offscreen. Canvas resolution can step down to 1x when measured drawing cost is high; unchanged button attributes and countdown text are no longer rewritten every frame.

Recorded concrete footsteps are from [Kenney Impact Sounds](https://kenney.nl/assets/impact-sounds),
CC0; the included license and original filenames are retained. Rain and thunder
now use edited CC0 field recordings from esh9419’s [Gentle Rain Mix (2018)](https://freesound.org/people/esh9419/sounds/417616/).
The 23-second rain loop has a one-second seam crossfade, softened high frequencies
and a 0.06 gain below the 0.48 master, fading in gently. The 14-second thunder
excerpt uses a softened attack, low-pass filtering and a long release. Both assets
total about 421 KiB and load only on game interaction; provenance and edits are
in `assets/midnight-run/audio/Weather-LICENSE.txt`.

A cosmetic storm produces one soft blue-white illumination fading over one second,
first after 12–22 seconds and then every 24–46 seconds. Thunder follows 1–2.4
seconds later. No outcome information affects these events. Reduced motion disables
the illumination; mute suppresses audio; hiding or exiting clears pending weather.

The quiet minor ostinato, clasp, escape chord, occasional distant dog barks and patrol
cue are original Web Audio sound design. Procedural cues are warmed on the initial
gesture so first playback does not generate waveforms in an animation frame.
Footsteps alternate subtly left/right with softer filtering and a quiet wet-sole layer. Distant barks
start after 10–18 seconds, then occur every 18–40 seconds, independently of outcomes.
All voices are stopped on mute, hiding or navigation; no background sound timers
remain. Audio loads/unlocks on interaction, obeys shared mute, and stops
when hidden or navigating away. No audio is loaded from the homepage.

Full prompts and provenance: [art manifest](midnight-run-art.json). The main page
loads only a small lazy thumbnail, not the city scenes or audio. No existing
assets were superseded or removed; the old retired Street Runner remains retired.

Mobile places the return below the scene and Continue/Cash out inside the corner card.
Desktop uses a scene and side controls. 320px phones, tablets and landscape are
covered. Reduced motion removes running/scenery movement and softens lighting;
the authoritative clock and payout rules stay the same. Pixel density is capped
at 2 on desktop and 1.5 on phones, hidden rendering stops, and unchanged text is not rewritten every frame.

## Validation

```sh
node --test scripts/midnight-run.test.mjs scripts/rocket-run.test.mjs scripts/site-hub.test.mjs
node scripts/midnight-run-simulation.mjs
npm run build
node scripts/midnight-run-browser.test.mjs
node scripts/site-entry-browser.test.mjs
node scripts/site-hub-browser.test.mjs
node scripts/multiplayer-balance-browser.test.mjs
```

Unit coverage includes all three difficulty schedules, every capped payout, optimal
stopping, RNG boundaries, deterministic mixed building plans, immutable difficulty,
real conditional wallet writes, ownership, concurrent windows, ignored client
values, lost debit/credit responses, funding failures, capture boundaries, lock latency,
indefinite corner waits, explicit progression to the cap, stale/duplicate Continue,
legacy recovery, auth, private-state serialization and input limits.
Browser coverage includes all three difficulties, preserved scenery after reload,
new scenery per run, corner stops, Continue/capture, delayed and lost replies,
reload/resume, replay, two windows, touch/keyboard, free-practice isolation,
desktop/phone/tablet/landscape, light/reduced motion, mute and BFCache.
The build includes the unchanged protected Roulette, Safe Cracker and Summit checks.
