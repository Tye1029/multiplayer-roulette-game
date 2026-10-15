# Coral Carnival V6

Preview: `/party.html?v=BOARDWALK_CARNIVAL_V6`

## Board and items

Trophy Compass is now Trophy Taxi: it transports the player to the current trophy
host, offers the normal optional 10-coin purchase, then returns to the dice roll.
All seven items have local SVG illustrations in shops, item controls and the three
inventory slots on each player profile. Each of the three shops stocks a different
subset. Full inventories offer an explicit replacement choice for purchases and
space gifts; invalid replacements cannot spend coins or discard an item.

Shops pause travel. Leaving with no movement remaining advances to the next
space, so the shop never consumes the final landing outcome. Trophy hosts also
pause travel for a purchase or decline, including when the player cannot afford
one. Ordinary minigames no longer mint trophies. Trophy-staked 1v1 games only
transfer the escrowed trophies; their total is conserved. Existing board chance
events can still exchange trophies.

The four-space Skybridge is level and has rails outside the space footprints.
Its connections remain visible. Route choices are on the canvas, with matching
colored path lines and landing rings. If a later junction permits multiple
landings, every possibility is shown. Previews account for the tide gate and the
extra step after leaving a shop. Rival selection uses character cards.

## Responsiveness and presentation

All 30 games share desktop/touch control instructions with their actual bindings.
Number keys follow the visible button order, arrows cover directional actions,
and Space performs the primary action. Touch or keyboard use updates the guide.
Pointer-down starts local feedback immediately. A bounded sequential input queue
keeps network requests ordered; stale inputs are discarded. Local prediction
animates poses and movement only, never scores, currency or outcomes. Server
cooldowns and input validation remain authoritative. Keyboard and pointer clicks
cannot double-submit the same gesture.

Arena time remains stationary during ready screens and countdowns. Character
poses blend into running, jumping, cheering and disappointment instead of
snapping. Minigame rendering targets 60 fps where the device allows it. Jump rope
accepts a modest early jump window and reacts visually before the server reply.
Small survival-time increments no longer play a coin sound on every poll.

Foam & Feint is now Rock Paper Scissors, with familiar rules, sealed choices and
rock/paper/scissors props. The stable internal game ID remains `fencing`.
Bomb Toss uses a smaller dark bomb, shrinking fuse, sparks and an eased parabolic
flight. The fuse spark has its own group so its pulse cannot enlarge the bomb.

Harbor Haul gives each player separately timed, colored ripples. A successful
catch ends that player's fishing; only one fish is landed. The fish arcs onto
the dock and remains there, sized by its measured length. After fishing, a
6.5-second measuring phase animates rulers and on-screen length readouts before
showing results. Future bite schedules and the hidden size seed are not sent to
clients. Desktop framing moves closer for the measure; mobile shows all catches.

## Validation

- 51 model/API tests pass, including trophy conservation and purchase replay,
  shop continuation, taxi continuation, stock enforcement, atomic replacement,
  route previews, fishing privacy/one-catch/measurement, RPS secrecy and local
  prediction isolation.
- Full browser suite passes: four-player ten-turn festival, all 30 games, duel
  series, reconnect, rematch, delayed requests and 320/390/768/1440 px plus
  landscape layouts. No JavaScript errors were reported.
- V4 and V5 browser regressions pass: creation/character picks, space inspection,
  standings, audio graph, puzzle cameras, survival falls and bot-only duel skip.
- V6 browser checks pass: desktop/mobile routes, illustrated stock and inventory,
  replacement, trophy choice, rival cards, stationary countdown pixels, touch
  instructions, separate fishing cues, landed fish, measurement, RPS and bomb
  flight. Jump feedback appeared within 150 ms while its server request was
  deliberately delayed by 550 ms; no score changed before the server processed it.
- Build uses the existing LF mirror for this Windows checkout's strict protected
  source hashes. Roulette, Safe Cracker, multiplayer, Fishing and Summit Sprint
  validation remains enabled and unmodified.

3,000 real-model bot simulations completed with the requested turn counts,
nonnegative integer balances, valid positions and at most three items. These
samples check economy integrity and progression, not perfect strategy balance.
Four-player seat win rates varied; human playtesting remains necessary for tuning.

| Turns | Players | Matches | Seat win percentages      | Draws | Mean trophies |
| ----: | ------: | ------: | ------------------------- | ----: | ------------: |
|    10 |       2 |     500 | 51.4 / 48.4               |     1 |          1.31 |
|    10 |       4 |     500 | 22.6 / 29 / 22.8 / 25.4   |     1 |          1.10 |
|    20 |       2 |     500 | 49.2 / 50.6               |     1 |          2.72 |
|    20 |       4 |     500 | 25 / 24.2 / 27.8 / 22.8   |     1 |          2.36 |
|    30 |       2 |     500 | 48.2 / 51.8               |     0 |          4.11 |
|    30 |       4 |     500 | 22.4 / 31.2 / 25.6 / 20.8 |     0 |          3.52 |

## Isolation and retained files

Only Boardwalk source, assets, tests and its workflow change. The original site
backup remains at `067f8f26e73457faf2bbfb68d00fc54f8a90311e` on
`codex/legacy-site-before-boardwalk`; the external ZIP is recorded in the V4
document. V4/V5 documents remain historical validation records. No bitmap asset
was superseded. The item images load only within Boardwalk. V5 rooms expire
safely on the rule-version change; player profiles and cosmetic ownership stay.
Unrelated package and backend-security work is excluded.
