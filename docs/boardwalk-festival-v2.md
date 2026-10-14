# Boardwalk — Coral Carnival V2

Preview: /party.html?v=BOARDWALK_FESTIVAL_V2

This iteration prioritizes the board, skill games, characters and presentation.
The cosmetic store is removed from the main navigation and results; existing
profiles, earned balances and outfits remain intact. No payment flow was added.

## Board and match flow

A six-round, two-to-four-player festival runs on 40 connected spaces. Two
junctions offer a promenade or a shorter route through the Skybridge and
Festival Lane. A one-to-six die is selected on the server. Double Dice rolls
two independent dice; Rocket Skates adds three spaces. Dice animate before
step-by-step travel. Crossroads pause movement with the correct remaining roll.

Spaces include +3 coins, -3 coins, item parcels, lucky rewards, item carts,
festival events, rival duels and trophy stops. Shops allow one affordable item
purchase only while visiting. Rain shields block one loss. Coin magnets give
six match coins. Passing start grants four coins. Passing the currently glowing
trophy stop with ten coins purchases a trophy and moves its host.

Festival events can provide a tide taxi, a coin shower for everyone, or a
one-coin collection from each opponent who has coins. Duel spaces let the
active player choose a rival for a 20-second climbing or memory game. Only those
two players can act; winners gain eight coins, then the same board round resumes.
Timeouts select a valid path or opponent and continue without granting active
participation for automatic dice rolls.

After every board round, all players enter a minigame. The winner receives a
trophy; final standings use trophies, then minigame points, then a rooftop
tiebreaker. Best-of-three 1v1 Quick Duel remains available without the board.

## Minigames

- Rooftop Rally: 24 ledges, five-input combo bonuses, checkpoints every six ledges,
  and wrong-input slips that stop at the previous checkpoint.
- Sunset Putt: three distinct authoritative physics courses, one attempt per
  course, accumulated scores, bank shots, bumpers and sand. Ball travel must
  finish before the next course can be played.
- Harbor Haul: safe/deep-water choices, a hook timing window followed by a
  separate reel-tension window, larger but harder deep-water rewards, five
  attempts and four-second fish escapes.
- Afterglow: progressively longer patterns, combo rewards, a mistake penalty,
  and alternating reverse-order patterns from level five.

## Presentation and assets

The original real-time 3D environments use a vendored, MIT-licensed Three.js
0.170.0 module. Boardwalk alone loads it. The game uses one renderer across
cached scenes, shared geometry/materials, instanced repeated board pieces,
capped pixel ratio and approximately 30–35 rendered frames per second.
Hidden tabs suspend drawing. Reduced-animation settings freeze decorative
motion while maintaining correct server-time movement and timing indicators.
A basic canvas map/control fallback remains if WebGL cannot initialize.

Riff has headphones and a striped tail; Cleo has pointed ears, a scarf and a
large tail; Moss has a bucket hat and raincoat; Bolt has an antenna, face screen
and backpack. Their rigs animate walking, climbing, idling and celebrating.
Environments include water movement, boats, palms, clouds, a rotating Ferris
wheel, a striped tent, bridges, lamps, a lighthouse and a winners' podium.
Dice clatter, footsteps, catches and score cues supplement the settings-owned
sound toggle.

The original generated key art is delivered as the optimized 334 KB WebP at
assets/party/images/boardwalk-crew-v2.webp. The unused workspace PNG was removed;
the generator's original is preserved outside the repository. Existing older
game media remains referenced by those games and was not superseded.

## Validation and boundaries

The model/API suite covers 12,000 dice samples, illegal or repeated rolls,
turn ownership, branch edges, all space categories, shop costs, trophy spending,
duel participation/resumption, all new minigame mechanics, private information,
timeouts, full six-round completion, authentication, replay protection and
atomic existing balances. Browser tests play a full four-player festival and
a separate duel through actual UI inputs, refresh a guest session, rematch,
test delayed network responses, and inspect desktop, phone and landscape
layouts. Test-only phase deadlines shorten idle waiting; scores are not injected
in these flows. The protected-game build validators remain unchanged.

Emulated phone layouts are not a physical-device GPU benchmark. Guest accounts
remain browser-specific, and client automation remains possible in skill games.
This is an earn-only social game, not a cash competition. V1 active rooms close
on the V2 ruleset; users keep their guest profile and can create a fresh room.

Research references: Nintendo's [Jamboree overview](https://play.nintendo.com/explore/super-mario-party-jamboree/)
and the developer's [Party Games – 13 Mini Games listing](https://play.google.com/store/apps/details?id=com.tellmewow.senior.party)
informed the emphasis on dice, branch decisions, varied space events, readable
competition and a coherent cast. All game art, board layout and character designs
here are original.
