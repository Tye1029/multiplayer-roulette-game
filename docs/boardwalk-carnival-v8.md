# Coral Carnival V8

Preview: `/party.html?v=BOARDWALK_CARNIVAL_V8`

## Board and match flow

Everyone rolls an authoritative die for turn order. Tied players reroll; the
resulting complete order persists through the match. The 50-space board has no
opening mystery parcel. The Harbor Loop shop is the only shop selling the
25-coin Tide Taxi. Route previews include the number of spaces to the trophy
and mark the quickest route.

Trophies cost 20 coins. Passing a trophy stops for a purchase decision, then
movement resumes with at least one step, just as at a shop. Purchases celebrate
with a cheer, confetti and the host carrying the trophy to its next pedestal.
Coin gains and losses float above the recipient. Parcels explain the item effect.
A decelerating minigame reel appears between the board overview and instructions.

The finale stays on one stage for 30 seconds: bonus trophies for most minigames
won, coins earned and spaces moved, followed by the winner countdown and final
lineup. Shared category records each receive a trophy; empty categories award
nothing. Awards apply once on the server. Rival wins count as minigame wins;
refunded stakes do not count as earnings. Final cards show place, coins, trophies
and match points. Match points, then remaining coins, break trophy ties.

## Minigames

The catalog now contains **39 games: 33 party games and 6 dedicated rival games**.
Treasure Tides and its unused runtime branches were removed.

- **Midway Hoops:** moving hoops, ballistic shots, rim bounce-outs and scoring at
  arrival. The ball must fit inside the visible rim; centered swishes score more.
- **Boardwalk Band:** four animated instruments and one private note lane per
  player. Everyone gets the same chart. Three original synthesized songs share
  their beat clock with the chart; misses animate the player and break streaks.
- **Bumper Bluff:** drag or keyboard steering, acceleration, coasting, reciprocal
  collision impulses, holes and cliff elimination. Movement runs on the server
  in small fixed steps; clients send directions rather than positions or scores.
- **Cinder Sprint:** steer around a volcanic arena, reading growing shadows and
  dodging progressively faster lava rocks.
- **Sunset Sluggers:** twelve varied fastballs, curves and change-ups. Perfect
  timing scores 500; other fair contact scores 200.
- **Professor Poppy's Pop Quiz:** five shared arithmetic questions, ten seconds
  each and three seconds to reveal scores. Faster correct answers earn more.
- **Postcard Shuffle:** a shared solvable sliding puzzle, animated tile moves,
  a 60-second limit and finish-order scoring. Bot search uses a binary heap and
  shares a private solution instead of repeatedly sorting the search frontier.
- **Poppy's Pit Crew, Crossed Wires, Tumbler Trouble:** separate 90-second games
  using the existing tool-stripping, color-word memory and circular warm/cold
  rules. Original Safe Cracker files remain unchanged.

Coin Cascade uses retained falling-object pools and spike balls, avoiding object
replacement at collection time. Skyline Stackers animates block drops. Lantern
Landing has a flag marshal, jumps and clear falling paths. Balloon Business has
pump poses, pop fragments and a one-second stun. Tidal Hop uses a textured beach,
varied wave sizes and jump timing, with eliminated players swept away. Boardwalk
Bullseyes uses carnival stands and a clearer shot guide. Boardwalk Boosters has
a scrolling road and an approaching finish line. Rooftop Rally has styled,
animated direction prompts. Fishing ripple sizes predict catch length.

Sunset Putt uses the existing golf physics and three feature-rich courses with
water, ramps, moving gates, terrain, conveyor belts and portals. Players take
turns, with 30 seconds per player per course and mouse/touch drag controls.

## Validation

- 80 model/API checks, including private puzzle state, hidden future cues, stale
  and repeated actions, opening-order ties, trophy purchases and finale awards.
- Full four-player ten-turn browser match, all 39 minigames, rematch, rival duels,
  reconnect, delayed requests, desktop, phone and landscape layouts.
- V4–V8 focused browser suites, including actual new-game pointer/button inputs.
- A real-clock ten-turn Netlify match reached the final ceremony and persisted
  its reward. It exposed a missing-cue render error after Confetti's final
  signal; that is fixed and covered by a focused browser regression.
- Putt waits for the ball to stop before accepting another drag, and safe tool
  controls reflect the server cooldown. Fixture resets await the actual rendered
  round and share the test database's transaction queue.
- 600 simulated boards across 10/20/30 turns and two/four players: every player
  received the selected turn count; all matches completed; balances, inventories
  and board positions remained valid. This is a regression sample, not proof
  that every strategy has equal win probability.
- Full `npm run build` in the LF validation checkout, including unchanged
  protected-game, multiplayer, Summit Sprint, Fishing and Blackjack validators.
  Local npm uses the bundled node-gyp module search path because the temporary
  npm distribution omits that dependency.

The pre-party XAN DUELS site remains separate and backed up. Historical V4–V7
documents remain as release records; their assets are still referenced by the
party application or the original games.
