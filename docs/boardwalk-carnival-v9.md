# Coral Carnival V9

## Individual play and debug tools

Every minigame's rules dialog includes **Play minigame**. It opens a bot-filled
test session for that game, including the six exclusive two-player games.
The main menu also offers **Test the board**. **Debug** remains available on the
board and during minigames: restart, choose another game, finish a minigame,
jump to a board space, or choose a dice result. Results wait for the tester to
restart or leave.

Debug mutations require the authenticated host of a server-created test room.
Normal matches cannot be modified by debug requests. Other humans cannot join
test rooms, and test sessions never write account rewards or records. Testing
from an active normal match opens a separate tab. Test state remains independent
of the legacy XAN DUELS economy.

## Four new games

- **Pier Pizza:** 90 seconds of customer tickets, three dough shapes, three
  cheese choices, four toppings, a server-timed five-second oven, and delivery.
  Accuracy is 25% dough, 25% cheese, and 50% topping-set accuracy. Each order
  earns accuracy multiplied by 300 plus a speed bonus of up to 200 points.
  Ingredient inputs queue in order; orders beyond the current ticket stay private.
- **Pocket Prospectors:** one shared 9-by-15 mine, three cargo slots per player,
  harder rock and more valuable minerals at greater depths. Surface sales bank
  points; unbanked cargo does not score. Deposits are claimed once, when digging
  finishes. Movement is adjacent, and miners can pass each other.
- **Mole Mischief:** 45 seconds of brown moles, ducks, and flowers. Moles award
  points and a streak bonus; friendly visitors cause a 2.5-second stun. Everyone
  receives the same sequence; future visitors are not included in public state.
- **Rivet Rumble:** two simultaneous 15-second semifinals, an eight-second
  knockout/finalist transition, a 15-second final, and a five-second knockout.
  Taps alternate robot fists and animate the player's console buttons. Losers
  watch the final from the background. Two players go straight to one final;
  three players receive one random bye. Ties favor whoever reached the total
  first, then the server's preselected draw order for an exact tie. Server limits
  bound burst sizes, punch rate, and which bout accepts input.

There are now **43 minigames: 37 party games and six exclusive duels**. Scenes
use reusable Three.js geometry and existing character assets. Sound effects are
original synthesis and follow the existing settings.

## Cookie Caper

The two-player cookie draft now shows real trays, changing cookie quantities,
the gold bonus, and the exact value of each choice. Picks stay hidden until
reveal. Reveals show both choices, cookie delivery animations, and each payout;
matching choices split the tray. A short reveal lock prevents an accidental
tap from selecting the next round.

The obsolete Cookie Caper scene was removed from the generic festival renderer.
Other shared assets remain referenced and are retained. A null-guard fix also
prevents the baseball rules preview from reading a nonexistent hit.

## Validation

- 91 model/API tests pass, including 120 full new-game bot simulations and
  two-/three-player robot brackets.
- The V9 browser journey uses real controls for test launch, pizza preparation,
  oven timing and serving, mining movement, mole stuns, a full robot tournament,
  Cookie Caper, fixed dice, board jumps, and returning to the menu. Screens are
  checked at 1440, 390, and 320 pixels, with no page errors or horizontal overflow.
- The existing touch-instructions browser regression now taps the game canvas,
  rather than a viewport coordinate that could hit the brand navigation.
- The full four-player ten-turn browser match passes, exercising all 43 games,
  live duels, rematches, reconnects, rewards, slow requests, and desktop/phone/
  landscape layouts. The focused V6 interaction regression also passes.
- `npm run build` passes in the LF validation checkout, including the unchanged
  protected-game, shared multiplayer, Summit Sprint, Fishing and Blackjack checks.
- `PARTY_TEST_ORIGIN` allows the same V9 journey to run against the deployed
  preview using an isolated guest test session without database fixtures.

Release marker: `BOARDWALK_CARNIVAL_V9`. This update does not change protected
Roulette or Safe Cracker source or the separate legacy site backup.
