# Boardwalk — Coral Carnival V4

Preview: `/party.html?v=BOARDWALK_CARNIVAL_V4`.

This is a separate social party game. The original site remains at `/`, and
Boardwalk uses its own assets, API and `party_*` database tables. Match coins
and trophies have no cash value. No payments were added.

## Original-site backup

The exact pre-Boardwalk source is commit
`067f8f26e73457faf2bbfb68d00fc54f8a90311e`, immediately before the first
Boardwalk implementation. It is preserved on the remote branch
`codex/legacy-site-before-boardwalk`. Do not merge it into the development
branch; use a separate checkout if restoring or deploying the original site.

A source archive is also saved outside this repository at
`C:/Users/tyeta/Documents/Codex/2026-08-07/so/work/site-backups/xanduels-before-boardwalk-067f8f2.zip`.
SHA-256: `CFB1686C0EC4E7FED3B8EF47441D90582BFB3F5026C2167371D2658BAEB8CBC6`.
These preserve source and assets, not a historical production database snapshot
or deployment secrets. The ongoing backend-security files were not included in
this game update.

## Board and decisions

- Choose 10, 20 or 30 turns per player; 50 spaces, three crossroads and a
  tide-controlled shortcut. Direction arrows mark paths and their splits.
- Centered animated server-owned dice, a closer following camera, an overview
  toggle, on-scene roll button, persistent coin HUD and illustrated profile cards.
- Coin gains/losses, item parcels, lucky events, trophy stops, chance exchanges,
  shops and rival showdowns. Chance exchanges conserve existing coins/trophies.
- Passing a shop pauses the remaining roll. Poppy offers one purchase or a free
  exit; travel then resumes. Items are consumed once, at most one per turn.
- Rocket Skates costs 5, Rain Shield 4, Double Dice 7, Triple Dice 12, Chosen
  Dice 10, Switcheroo 8, and Trophy Compass 18 match coins. Inventory holds three.
  Trophy travel does not waive the separate ten-coin trophy price.
- Choose any rival and an affordable integer coin stake up to 50 each. During
  the last three turns, both players can instead stake one trophy each.
  The server escrows both stakes; the winner gets the pool and draws refund it.

## V4 board, selection and music

The 38-space promenade has three four-space branches. Each branch travels five
edges instead of six, saves exactly one step and contains one rain-cloud loss.
Trophy location, shops and gifts make routes situational; a shortcut is not an
entire district skip. The starting seat is random, then the first seat rotates
once per full turn. Every player gets the chosen number of board turns.

| Space type                      | Count |
| ------------------------------- | ----: |
| Payday +3                       |    15 |
| Rain cloud -3 (floored at zero) |     9 |
| Mystery parcel                  |     4 |
| Item cart                       |     5 |
| Trophy stop                     |     4 |
| Lucky stop                      |     3 |
| Rival showdown                  |     3 |
| Crossroads                      |     3 |
| Chance parade                   |     2 |
| Festival event                  |     1 |
| Start                           |     1 |

The coin/loss spaces alone average +0.36 coins per uniformly sampled space,
before gifts, lucky spaces, passing start, purchases and minigames. Actual route
landings are not uniform; the simulation below exercises the real travel rules.
Chance exchanges occupy 4% of spaces and conserve currency and trophies. Shops
remain passing stops, not extra turns. Match coins reset and cannot be converted
to profile coins or real-world value. Long matches intentionally leave room to
buy items; these tests do not prove that every player strategy is equally strong.

Boo is visibly a child in a patched sheet with cut eye holes and sneakers.
Bones wears a suit and top hat; Sir Rowan is a human knight; Pippa is a princess.
All eight characters have identical rules. Each human must explicitly choose in
every lobby, including rematches. Atomic room locking rejects duplicate claims;
bots select an unclaimed character. Changing a pick clears that player's ready
state. Profile portraits do not reserve a match character.

Space colors, silhouettes and painted pictograms distinguish outcomes. Clicking
or tapping a tile adds a two-color ring, SELECTED sign and description card; the
card docks opposite the selected part of the board. Larger signs mark Poppy's
usable carts and the active trophy. Path clearance keeps plants off walking
routes. Whole-board view fits both phone and desktop widths. Profile cards show
current tied ranks, and the turn counter shows the number remaining.

Four original sixteen-bar compositions replace the short repeating tune. Chord
progressions, answering phrases, sparse bridge bars, bass, bells and instrumentation
vary; shuffled theme selection avoids immediate repeats. Each theme lasts about
36 seconds at 106 BPM. Sound remains optional, quiet and local to Boardwalk.

### Economy/seat simulation

Run: node scripts/party-balance.mjs (500 matches per configuration, 3,000 total).
Bots have equal skill, random legal routes, shop purchases and item usage. Every
match completed, every player received exactly 10/20/30 moves, and inventories,
positions, integer coins and trophies stayed valid. No balances became negative.
These are observed samples, not guaranteed future win rates.

| Turns | Players | Seat win percentages      | Mean ending match coins |
| ----- | ------- | ------------------------- | ----------------------: |
| 10    | 2       | 51.8 / 48.2               |                   109.6 |
| 10    | 4       | 28.4 / 22 / 27.2 / 22.4   |                    97.2 |
| 20    | 2       | 51.2 / 48.8               |                   202.7 |
| 20    | 4       | 26.8 / 25 / 24.4 / 23.8   |                   177.3 |
| 30    | 2       | 51.8 / 48.2               |                   297.3 |
| 30    | 4       | 24.8 / 23.4 / 24.6 / 27.2 |                     256 |

A separate browser suite creates all three lengths, selects all four new
characters, checks bot exclusivity, standings, tap/click descriptions, narrow
layouts and the live Web Audio graph. Model/API coverage includes concurrent
claims, invalid lengths, rematch picks and ties. The older expiry fixture now
waits for the exact updated deadline response before holding polls; otherwise an
in-flight stale poll could produce a false timer failure on a slow CI runner.

## Ten minigames

Rooftop Rally retains 24 ledges, checkpoints and directional combos. Sunset
Putt has three authoritative physics courses, bank shots, bumpers and sand.
Afterglow builds longer light sequences and reverse-order rounds. Harbor Haul
now uses growing ripples and six timed splashes, with rarer catches worth more.

Six additional games use the same original festival cast and 3D presentation:

| Game            | Mechanic                                                                        |
| --------------- | ------------------------------------------------------------------------------- |
| Coin Cascade    | Three conveyor lanes; catch coins, dodge crates, keep all collected coins       |
| Lantern Landing | Match the lantern's platform, maintain combos, survive three misses             |
| Tidal Hop       | Time jumps against accelerating waves; precision scoring                        |
| Market Dash     | Change lanes, jump hurdles, duck bunting and dodge barrels                      |
| Festival Flash  | Wait for the true GO signal, then match its color; false-start penalty          |
| Treasure Tides  | Read each three-lane coin/crab preview; keep collected coins, traps skip a wave |

The selection deck avoids repeats until eligible games are exhausted. Rival
duels exclude coin-collection games without clearing unplayed main-round games.
Competitive rounds award 10/6/3/2 match coins for participating finishers. Coin
rounds award every collected coin to its collector and do not award a trophy.
Result rows and profile cards show each person's award, including the final round.

Every minigame has instructions and a ready roster. All participating players
ready starts a shared three-second countdown. Otherwise the intro starts that
countdown after 60 seconds. Nonparticipants cannot ready or play a rival duel.
Bots ready automatically. In-game timers, touch buttons and short score popups
are visible on the play surface. Normal rounds last 35 seconds, rival duels 20.

## Presentation and implementation

Original synthesized festival music, dice clatter, footsteps, splashes, countdowns
and pitched mascot vocalizations use Web Audio. These are playful synthesized
voices, not recorded spoken performances. Music has its own quiet setting and
shares the master sound setting. Audio unlocks on user interaction and suspends
in hidden tabs.

The board adds planted plazas, shopkeepers, signs, bunting, benches, lamps and
supported elevated stalls. Mascots walk, jump, duck, fish, swing clubs, cheer and
slump. Ground surfaces cover the climbing and putting scenery. Phone lane-game
cameras focus on the local player; the profile strip keeps opponents' scores
visible. Controls remain on-screen at narrow widths.

Three.js 0.170.0 is vendored with its MIT license and only loaded by Boardwalk.
Cached scenes share one renderer, geometry/materials, capped pixel ratio and
limited frame rate. Hidden tabs suspend drawing. Reduced motion stops decorative
movement while keeping timing cues and authoritative travel. The existing
334 KB crew WebP remains in use; coin/trophy icons are small original SVG files.
The superseded V2 documentation and unused fishing-gauge code were removed.
Original-game media remains because those games still reference it.

## Validation and limits

The model/API suite covers dice distribution, turn ownership, route legality,
readiness/deadlines, item spending, passing shops, chance conservation, escrow
and refunds, all ten games, hidden future cues, stale/duplicate inputs, guest
authentication, private rooms and atomic reward settlement. Thirty simulated
two/four-player festivals check completion, balances and inventory bounds.

Browser tests play a ten-turn four-player festival, all ten game controls,
Quick Duel, reconnect, rematch and delayed requests across desktop, phone and
landscape sizes. Isolated test fixtures shorten waiting and extend input windows
for software-rendered browsers; scores are produced by the real action handler.
Those four UI-test views render at 10 Hz to fit shared CI hardware; the deployed
smoke runs the normal animation loop. Interactive decision deadlines are extended
only in those isolated fixtures. Slow responses are excluded from clock samples,
and an eight-second delayed-response test checks countdown accuracy.
A real-clock test holds network responses across round expiry and verifies that
late controls stop submitting and then recover. Deployment is separately checked
through normal UI actions without test-only state changes.

Phone emulation is not a physical-device GPU benchmark. The browser-specific
guest account system remains. The server owns scores, timing, moves and rewards;
this does not make a browser skill game immune to input automation. V3 rooms
expire on this ruleset; existing profiles and earned cosmetic balances persist.
Retired rooms reset only their obsolete board positions, movement and scene
references before displaying the expired-room exit. A browser regression covers
reloading a 66-space room with a trophy at space 58 and a move through space 65.

## Design references

Nintendo's [Jamboree overview](https://www.nintendo.com/us/store/products/super-mario-party-jamboree-switch/)
and [board tips](https://play.nintendo.com/news-tips/tips-tricks/super-mario-party-jamboree-tips-and-tricks/)
informed branching routes, changing board conditions, dice items and varied
party challenges. The implementation uses original board layout, characters,
art, music and minigame presentations; it does not copy Nintendo assets or claim
to reproduce its full minigame catalog.
