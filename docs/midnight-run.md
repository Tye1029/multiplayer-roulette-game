# Midnight Run V1

Single-player automatic runner at `/games/single-player/midnight-run/`, linked
from the homepage Single Player section. Shares the verified Torn identity,
wallet and timestamped admin ledger, header, settings, mute, theme and debug UI.

## Play

- Wagers: 50K, 100K, 500K, 1M, 5M or 10M chips.
- Three-second countdown, then automatic running. Every 4.5 seconds the runner
  reaches a new corner. A cleared block raises the available total return.
- Clear at least one block, then escape at any time to take the return for the
  cleared blocks. Partial blocks do not increase it. Getting caught loses the wager.
- Optional Auto escape is saved before funding. It settles at the selected block
  if that corner is survived, even after a disconnect. Capture wins a tie.
- 50M maximum total return. Reaching the cap escapes automatically.
- Refresh/re-entry opens the menu and offers Resume for an active paid run.
  A run continues while the player is away. Replay stays in the game and allows
  changing wager and target. Free practice never calls a paid action.

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

Future capture location, wallet account and owner fields never leave active
server state. Client timestamps, target overrides and claimed prizes are ignored.
Manual escape uses verified server receipt time before waiting for the row lock;
an already settled capture cannot be reversed. The UI freezes immediately on
press and waits for confirmation. Auto escape avoids manual network timing.

Visible paid runs poll without overlap, normally every 700ms and more closely
around corners. Active polls do not read the wallet again or write unchanged
game state. Idle menus and hidden pages do not poll the game. The client pauses
at an unconfirmed corner, disables manual escape after 2 seconds without a fresh
reply, and rejects stale replies and responses from an old profile/page lifetime.

## Art, effects and audio

Original generated Old Quarter, Dockside and Market Row art, a four-frame runner
sheet and a patrol sedan are optimized WebP files under `assets/midnight-run/images`.
Artwork retains its aspect ratio; the viewport crops instead of stretching.
The menu is a live scene, with the same runner and lighting as gameplay.
Rain, steam, puddle ripples, moving headlight cones, soft patrol lights and
world-space street movement are canvas overlays. Escape animates a clean getaway;
capture brings the patrol car up behind the runner before the result appears.

Recorded concrete footsteps are from [Kenney Impact Sounds](https://kenney.nl/assets/impact-sounds),
CC0; the included license and original filenames are retained. Rain/traffic bed,
quiet minor ostinato, clasp, escape chord and patrol cue are original Web Audio
sound design. Audio loads/unlocks on interaction, obeys shared mute, and stops
when hidden or navigating away. No audio is loaded from the homepage.

Full prompts and provenance: [art manifest](midnight-run-art.json). The main page
loads only a small lazy thumbnail, not the city scenes or audio. No existing
assets were superseded or removed; the old retired Street Runner remains retired.

Mobile places the return and sticky cash-out control immediately below the scene.
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
values, lost debit/credit responses, funding failures, capture ties, lock latency,
disconnected auto/cap settlement, auth, private-state serialization and input limits.
Browser coverage includes full manual runs, auto/capture, delayed and lost replies,
reload/resume, replay, two windows, touch/keyboard, free-practice isolation,
desktop/phone/tablet/landscape, light/reduced motion, mute and BFCache.
The build includes the unchanged protected Roulette, Safe Cracker and Summit checks.
