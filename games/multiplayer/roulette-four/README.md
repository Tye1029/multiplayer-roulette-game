# Four-player Roulette bot table

Entry: `/games/multiplayer/roulette-four/`. Release marker: `four-player-roulette-v1`.

This is a separate, browser-local practice game with one human and three bots. It uses the existing Roulette room, table, gun and recorded sounds. It does not call account, wager or duel endpoints. Four-human network play is not part of this bot prototype.

Each player contributes $100 of practice money. Safe-shot awards start at $20 and increase by $20 globally. Each player has one chamber spin; it randomizes a single bullet across six chambers and resets the next award to $20. A turn requires a shot; a spin must also be followed by a shot before passing. Passing preserves the payout ladder. A fatal shot ends the round and returns that player's bank to the pot. Survivors keep their earned banks and divide the remaining pot using 25:30:35 safe-shot rank weights, averaging tied ranks. Largest-remainder rounding distributes every cent, with randomized ties. Empty-pot rounds keep the banks without a further split.

The initial order is shuffled every round, with the local viewer always down and the next player clockwise at left. The same `relativeSeat` function supports every player's perspective. Bot decisions receive only public state. A randomized personality and independent action/timing draws are generated each round; bots occasionally decline a rematch. A rematch requires all four votes before a ten-second wall-clock deadline. Stale callbacks are invalidated when starting or leaving a table.

Validation: `node scripts/validate-roulette-four.mjs` and `npm run build`. The validator covers money conservation, ties, chamber rules, bot termination, all 24 orders, viewer-relative seats and rematch deadlines. Existing game assets are retained because they are directly reused and remain referenced by the original games.

## Mannequin asset

`assets/roulette-four/images/tv-mannequin-v1.png` was generated with the built-in imagegen tool, with transparency enabled. Live profile pictures, scanlines and broken-screen graphics are composited over its blank TV screen. The original aspect ratio is preserved.

Prompt: “Use case: stylized-concept. Asset type: transparent PNG sprite for a warm dimly lit saloon game, reused for three opponents. A single fully visible seated wooden artist's mannequin on a worn dark brown wooden chair, facing directly forward toward the camera. Its head is a small vintage box CRT television with a large flat blank near-black screen facing straight forward. No actual human, no face, no blood, no weapons. Beige polished wood articulated torso, arms resting on thighs, wooden legs and feet visible. Dark brass and walnut television casing. Warm overhead amber lighting, crisp detailed realistic 3D game render. Centered symmetrical entire chair and mannequin, generous clear margins, portrait composition; screen is an unobstructed simple rectangle in the top quarter so a live profile photo can be overlaid. Background must be genuinely transparent, no room, no floor, no text, no lettering, no extra objects.”
