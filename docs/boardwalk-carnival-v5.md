# Coral Carnival V5

Preview: /party.html?v=BOARDWALK_CARNIVAL_V5

## Board and pacing

The 50-space board now has 34 promenade spaces, a four-space Skybridge,
a four-space tide detour, and an eight-space Festival Crossing through its center.
The crossing saves eight steps but skips outer rewards and trophy opportunities;
the smaller detours each save one. Three shops remain, on supported piers outside
the main route. Bridge decks are 2.9 units wide for 2.24-unit spaces, with rails
outside their footprints. Landmark placement checks clearance against every edge.

Board roll, route and shop/duel decisions allow 60 seconds. Bots decide promptly.
Minigame introductions retain ready checks and a 60-second auto-start, followed by
a three-second countdown. Round and side-duel results remain for 15 seconds.

## Rules and fairness

- 24 party games and six dedicated duel games. Each pool avoids repeats until
  exhausted. Two-person tiebreakers use Circuit Sprint; larger ties use Rooftop Rally.
- Only participating characters appear in a duel. An all-bot side duel can be
  skipped by a spectator; the server simulates its real rules and settles its
  escrow once, then displays the normal result. Human duels cannot be skipped.
- Timed events and bots advance in bounded 100 ms steps between network requests.
  Collision checks sweep projectiles across time rather than testing one frame.
- Climb, Circuit Sprint, Paddle Parade and Sneaky Spotlight use finish-placement
  scoring bands. Earlier finishers beat later finishers; exact-time ties share
  placement. Climbing milestones cannot be farmed by slipping and reclimbing.
- Raw scores remain specific to each minigame. Match tiebreak totals use equal
  placement points (1,000 / 650 / 400 / 250), so a high-scoring recipe game does
  not outweigh a precision game. Tied placements receive equal coin awards.
- Survival rankings prioritize time survived. Lantern Landing removes a player
  on the first wrong platform, with a sinking platform and fall animation. A
  player already on the matching platform may stay there. Jump rope is also
  single-elimination; Bubble Bomb and Coconut Crossfire use three hearts.
- Treasure Tides sends 28 objects, about one every 1.16 seconds, in one visible
  lane at a time. Coins give two or four; spike balls remove up to three collected
  coins. Collection cannot go negative and never deducts pre-existing match coins.
- Fishing includes a precision bonus for faster valid strikes. Golf remains a
  precision contest rather than granting arbitrary first-click bonuses.
- Duel choices, future cue schedules, recipes and confetti traps are private.
  Current instructions and visible puzzle targets are intentionally public.
  Scores, currency, movement, cooldowns and results remain server-owned.

## Game roster

| Game               | Pool               | Core mechanic          |
| ------------------ | ------------------ | ---------------------- |
| Rooftop Rally      | Party              | REFLEXES + COMBOS      |
| Sunset Putt        | Party              | PRECISION              |
| Harbor Haul        | Party              | RIPPLE FISHING         |
| Afterglow          | Party              | MEMORY + COMBOS        |
| Coin Cascade       | Party · keep coins | COIN COLLECTION        |
| Lantern Landing    | Party              | REACTION + SURVIVAL    |
| Tidal Hop          | Party              | JUMP + TIMING          |
| Market Dash        | Party              | DODGE + COMBOS         |
| Festival Flash     | Party              | REACTION + BLUFFS      |
| Treasure Tides     | Party · keep coins | COIN COLLECTION        |
| Captain's Orders   | Party              | LISTEN + RESIST        |
| Confetti Roulette  | Party              | RISK + BANK            |
| Boardwalk Boosters | Party              | KART RACING            |
| Bubble Bomb Bash   | Party              | PASS + SURVIVE         |
| Coconut Crossfire  | Party              | AIM + SURVIVE          |
| Skipping Sunset    | Party              | JUMP ROPE              |
| Skyline Stackers   | Party              | BALANCE + PRECISION    |
| Orchard Express    | Party              | CATCH + SORT           |
| Moonlight Maze     | Party              | ROUTE PLANNING         |
| Balloon Business   | Party              | PRESSURE + TIMING      |
| Sneaky Spotlight   | Party              | MOVE + FREEZE          |
| Boardwalk Backbeat | Party              | RHYTHM + REMIX         |
| Paddle Parade      | Party              | RHYTHM + STAMINA       |
| Midnight Macarons  | Party              | RECIPES + MEMORY       |
| Foam & Feint       | 1v1 only           | 1V1 · READ YOUR RIVAL  |
| Tugboat Trouble    | 1v1 only           | 1V1 · POWER + TIMING   |
| Ricochet Rivals    | 1v1 only           | 1V1 · BANK SHOTS       |
| Beachside Volley   | 1v1 only           | 1V1 · RETURN + PLACE   |
| Cookie Caper       | 1v1 only           | 1V1 · BLUFF + DRAFT    |
| Circuit Sprint     | 1v1 only           | 1V1 · ROTATE + CONNECT |

The presentation uses original procedural characters, environments, music and
sound effects. General party-game pacing and category variety were reviewed
against Nintendo's official showcases, without copying their assets or code:
https://www.nintendo.com/ph/switch/a7hl/minigame/index.html and
https://media.nintendo.com/supermarioparty/minigames/ .

## Validation

39 model/API tests cover the existing flows and the new games, invalid inputs,
private choices, projectile collisions, spike deductions, eliminations, timings,
finish ranking, exclusive pools and bot skips. The full browser suite completes
a ten-turn four-player match, all 30 games, a duel series, rematch, reconnect,
slow requests and 320/390/768/1440 px plus landscape layouts. The focused V5
suite inspects final mobile cameras, falling platforms and the bot-skip UI.
The existing build and protected Roulette, Safe Cracker, shared multiplayer,
Fishing and Summit Sprint validators are unchanged.

3,000 equal-bot simulations used the real server model and item economy. Every
player received the requested turn count; all matches finished with valid,
nonnegative balances. Seat win percentages are descriptive sampling results,
not a guarantee that strategies or characters are perfectly balanced.

| Turns | Players | Matches | Seat win percentages      | Draws |
| ----: | ------: | ------: | ------------------------- | ----: |
|    10 |       2 |     500 | 51.6 / 48.4               |     0 |
|    10 |       4 |     500 | 27.4 / 23.4 / 25.8 / 23.4 |     0 |
|    20 |       2 |     500 | 47.6 / 52.4               |     0 |
|    20 |       4 |     500 | 24.2 / 28 / 22.4 / 25.4   |     0 |
|    30 |       2 |     500 | 51.4 / 48.4               |     1 |
|    30 |       4 |     500 | 22.4 / 26.8 / 25.8 / 24.8 |     1 |

## Isolation and historical material

Original-site source remains backed up at commit
067f8f26e73457faf2bbfb68d00fc54f8a90311e on
codex/legacy-site-before-boardwalk, with the external ZIP recorded in
boardwalk-carnival-v4.md. That document is retained as the historical V4
validation/backup record, not the current board specification. No game media
was superseded by this update. Old V4 rooms expire safely because their geometry
and rules differ; profile balances and cosmetic ownership are preserved.
Unrelated package.json and backend-security work is excluded from this change.
