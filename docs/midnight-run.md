# Midnight Run V2 — corner choices

Single-player automatic runner at `/games/single-player/midnight-run/`, linked
from the homepage Single Player section. Shares the verified Torn identity,
wallet and timestamped admin ledger, header, settings, mute, theme and debug UI.

## Play

- Wagers: 50K, 100K, 500K, 1M, 5M or 10M chips.
- Three-second countdown, then a 4.5-second run to the first corner.
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

The first block survives 80 of 100 equally likely crypto draws. Later safe counts
are 88, 86, 84, …, 44 out of 100. For a fixed cleared block k, let P be the product
of its safe probabilities. Total return is `min(50M, floor(stake * 0.90 / P))`.
BigInt rational arithmetic makes each quoted amount exact in whole chips.

Before the cap, every fixed exit has approximately 90% expected return (less
whole-chip rounding). A backwards optimal-stopping check confirms that choosing
whether to continue based on already cleared blocks cannot remove the 10%
minimum expected house advantage. Scenery, character movements and lighting use
no secret outcome data. At the capped final block, the truncated prize reduces
expected return further, as low as 65.68% for one stake/target combination.
Only reachable targets are offered; later blocks disappear once the cap is reached.

A 2,000,000-route production-RNG simulation covered all **90 reachable stake / exit
combinations**. Observed returns were **65.92%–90.80%**; every sampled combination
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
Corner arrival, clock and settlement are server-owned.

Already-funded V1 records retain their original settlement contract so deployment
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
The menu is a live scene, with the same runner and lighting as gameplay.
Rain, steam, puddle ripples, moving headlight cones, soft patrol lights and
world-space street movement are canvas overlays. Neon Strip adds casino, strip-club,
diner, hotel and bar exteriors with neon reflections and gentle world-space light
pulses. Street travel is 140 pixels/second (previously 85); runner animation is
8.8 frames/second (previously 13.2), with footsteps slowed to 0.46-second intervals. Escape animates a clean getaway;
capture brings the patrol car up behind the runner before the result appears.

Recorded concrete footsteps are from [Kenney Impact Sounds](https://kenney.nl/assets/impact-sounds),
CC0; the included license and original filenames are retained. Rain/traffic bed,
quiet minor ostinato, clasp, escape chord and patrol cue are original Web Audio
sound design. Audio loads/unlocks on interaction, obeys shared mute, and stops
when hidden or navigating away. No audio is loaded from the homepage.

Full prompts and provenance: [art manifest](midnight-run-art.json). The main page
loads only a small lazy thumbnail, not the city scenes or audio. No existing
assets were superseded or removed; the old retired Street Runner remains retired.

Mobile places the return and Continue/Cash out controls immediately below the scene.
Desktop uses a scene and side controls. 320px phones, tablets and landscape are
covered. Reduced motion removes running/scenery movement and softens lighting;
the authoritative clock and payout rules stay the same. Pixel density is capped
at 2, hidden rendering stops, and unchanged text is not rewritten every frame.

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

Unit coverage includes all payouts and targets, optimal stopping, RNG boundaries,
real conditional wallet writes, ownership, concurrent windows, ignored client
values, lost debit/credit responses, funding failures, capture boundaries, lock latency,
indefinite corner waits, explicit progression to the cap, stale/duplicate Continue,
legacy recovery, auth, private-state serialization and input limits.
Browser coverage includes corner stops, Continue/capture, delayed and lost replies,
reload/resume, replay, two windows, touch/keyboard, free-practice isolation,
desktop/phone/tablet/landscape, light/reduced motion, mute and BFCache.
The build includes the unchanged protected Roulette, Safe Cracker and Summit checks.
