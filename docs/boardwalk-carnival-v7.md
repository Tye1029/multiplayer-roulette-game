# Coral Carnival V7

Preview: `/party.html?v=BOARDWALK_CARNIVAL_V7`

## Turn flow, board and inventory

New matches and rematches start with empty pockets. Purchased items can only be
used before a subsequent roll. Shop descriptions no longer claim immediate use.
A Rain Shield costs two coins and blocks one loss of up to three coins. Three
illustrated inventory slots occupy their own full-width row in each profile.

The initial randomly chosen starting seat now stays the same throughout the match.
The visible roll-order strip follows that order. Each player completes one turn
before the regular minigame, including four-player matches. A special showdown
returns to the next player's board turn; it does not advance the regular round.
Minigame results last five seconds. Final match results remain available.

The board retains 50 spaces. Harbor Loop branches from space 26 to space 32, with
an outward rectangular route that clears the shop dock. It is always open; the
obsolete tide-gate rendering, rules and text were removed. Festival Crossing now
exits at space 2 instead of the starting tile. Route cameras include the complete
previewed paths. The trophy stands on a separate pedestal clear of walkways and
characters. Space 22 offers a four-coin ferry ride around the bay to space 6,
ending that player's turn. The fare, destination, ownership and single charge are
server-validated; declining keeps the player in place.

## Minigames

- **Boardwalk Bullseyes** replaces bank shots. Straight arrows take 420 ms to reach
  a continuously moving target; concentric gold/cream/pink rings award 500/300/100
  points and misses award zero. Reload is 900 ms. Scoring occurs at impact. The
  existing internal `ricochet` ID remains for stored references.
- **Bomb Toss** records explicit 700 ms flights and the exact explosion location,
  including a mid-flight pop. A 1.2-second pause separates bombs. A small confetti
  puff replaces the expanding rotating explosion. The fuse continues during a
  throw; the recipient loses the heart if it expires in flight. Pass buttons name
  their recipients, show holder status and obey server flight/respawn cooldowns.
  Acknowledged prediction cannot overwrite a later player's throw.
- **Coconut Crossfire** uses shared server/render geometry, 1.8-second reloads,
  smoother recoil, riders rotating with cannons, health indicators, hit flashes
  and direct-hit feedback. Swept contact events resolve chronologically for both
  targets and colliding shots. Near misses award nothing. Passive survival ticks
  no longer masquerade as hit points; a direct hit gives 250 and the survivor bonus
  is explicitly labelled.
- **Lantern Landing** has supported wooden trapdoors, arcing jumps, sinking unsafe
  panels and falling eliminated characters. Twelve accelerating bells replace
  eight fixed beats. Colors shuffle from the fourth bell; numbered controls refer
  to positions and update their colors. Players must finish their 420 ms jump
  before the bell. Controls wait for the trapdoors to rise.
- **Sneaky Spotlight** uses one tap to run continuously and Freeze to stop. Amber
  gives 900 ms warning. A red-light catch subtracts 60 metres once and stops the
  player for one second, with explicit feedback. Mobile framing stays fixed on
  the lane, avoiding apparent back-and-forth camera motion.
- **Harbor Haul** varies ripple sizes while using the same pale water color for
  every ripple. The existing one-fish-per-player and measuring flow remain intact.

## Validation

- 62 model/API tests pass, covering fixed order over multiple rounds, special
  showdown continuation, ferry affordability/replays, item restrictions, exact
  arrow impact timing, cannon grazing hits/misses and shot collisions, bomb
  flight/respawn boundaries, continuous run/freeze and lantern landing deadlines.
- Desktop/mobile browser suites pass, including a four-player ten-turn match,
  every one of the 30 minigames, reconnect, rewards, rematch, adversarial requests,
  and 320/390 px inventory containment. Targeted V4/V5/V6/V7 suites cover character
  picks, audio graph, two-player scenes, countdown and delayed-network feedback,
  shops, trophies, ferry travel, trapdoors and the reworked games.
- The full build passes in the LF validation mirror, including the unchanged
  protected Roulette, Safe Cracker, Summit Sprint and shared runtime checks.
- The previous CI Bomb Toss test failure was a fixture race: screenshots outlived
  its fuse and left the test waiting on a disabled button. The full input-coverage
  fixture now holds a long fuse and passes through all players in order. Separate
  normal-clock model/browser tests still exercise fuse expiry and flight delays.
- 3,000 real-model bot matches completed at 10/20/30 turns with two/four players,
  valid positions, nonnegative integer balances and at most three items. These
  simulations check integrity and seat bias, not optimal human strategy balance.

| Turns | Players | Matches | Seat win percentages    | Mean trophies |
| ----: | ------: | ------: | ----------------------- | ------------: |
|    10 |       2 |     500 | 50.6 / 49.4             |          1.34 |
|    10 |       4 |     500 | 27.8 / 22 / 26.2 / 23.6 |          1.08 |
|    20 |       2 |     500 | 49.6 / 50.2             |          2.62 |
|    20 |       4 |     500 | 22.8 / 26 / 26.6 / 24.6 |          2.27 |
|    30 |       2 |     500 | 48.8 / 51.2             |          4.04 |
|    30 |       4 |     500 | 25 / 24 / 26.8 / 24.2   |          3.44 |

## Isolation and retained files

Boardwalk remains separate at `party.html`. The original site backup remains at
`067f8f26e73457faf2bbfb68d00fc54f8a90311e` on
`codex/legacy-site-before-boardwalk`, with the external ZIP recorded in V4.
V4/V5/V6 documents remain historical validation records. Existing item SVGs and
character artwork are still referenced; no bitmap asset was superseded. Old
room versions expire safely when the rules change, retaining player profiles and
cosmetic ownership. Unrelated package and backend-security work is excluded.
