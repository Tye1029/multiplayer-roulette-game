# Four-player Roulette bot table

Entry: `/games/multiplayer/roulette-four/`. Release marker: `four-player-roulette-turns-v4`.

This is a separate, browser-local practice game with one human and three bots. It uses the existing Roulette room, table, gun and recorded sounds. It does not call account, wager or duel endpoints. A separate read-only `roulette-four-profile` endpoint uses the saved Torn key to retrieve only the owner’s ID, name, profile image and gender; no balance or account record is written. Guest play remains available when no key is connected. Four-human network play is not part of this bot prototype.

Each player contributes 100 practice Chips. Safe-shot awards start at $20 and increase by $20 globally. Each player has one chamber spin; it randomizes a single bullet across six chambers and resets the next award to $20. A turn requires a shot. The player may use their spin before shooting, or after their mandatory shot and before passing. Passing preserves the payout ladder. A fatal shot ends the round and returns that player's bank to the pot. Survivors keep their earned banks and divide the remaining pot using 25:30:35 safe-shot rank weights, averaging tied ranks. Largest-remainder rounding distributes every cent, with randomized ties. Empty-pot rounds keep the banks without a further split.

The initial order is shuffled every round, with the local viewer always down and the next player clockwise at left. The same `relativeSeat` function supports every player's perspective. Bot decisions receive only public state. A randomized personality and independent action/timing draws are generated each round; bots occasionally decline a rematch. A rematch requires all four votes before a fifteen-second wall-clock deadline. Stale callbacks are invalidated when starting or leaving a table.

Validation: `node scripts/validate-roulette-four.mjs` and `npm run build`. The validator covers money conservation, ties, chamber rules, bot termination, all 24 orders, viewer-relative seats and rematch deadlines. Existing game assets are retained because they are directly reused and remain referenced by the original games.

## Debug panel

Use Debug in the header, or Debug this round from the result dialog. Copy or download a JSON report with public game state, viewer-relative seats, money totals, control state, bot personalities/decisions, rematch votes and browser errors. The latest 160 session events plus 50 completed-round summaries survive rematches and new tables; reload clears them. Audio cues, gun selections and shot-strike timing are included. Hidden panels do not render reports. Debugging never samples randomness or exposes the private bullet location. Profile image data and account storage are excluded.

## Turn clock and presentation V4

Every active turn starts with a 60-second wall-clock deadline. Shots and spins do not extend it. A shot accepted before expiry resolves at hammer impact before any timeout is applied. A timeout eliminates the active player, splits only their bank equally among remaining players, leaves the shared pot in play and advances clockwise past eliminated seats. Multiple timeouts are supported; the final survivor claims the pot. A later live-shot elimination ends the game and splits the pot only among players still alive. With two survivors the rank weights are 25:35; ties average them. Rematches require all four players within 15 seconds.

Names come from the connected Torn profile, with a fixed Guest fallback and no name-entry field. UI values use Chips. The top card displays the active timer beside the spin state. The textured lamp from the original game sways with its light projection, with brief occasional flickers 35–65 seconds apart; the broad light pulse is removed. Top seating is lowered, wall impacts use irregular multiply-blended damage, and three staggered idle motions are anchored at the chair feet. Reduced-motion mode suppresses these motions and flicker.

The V3 balance observations below predate the spin-before-pass change and timeout rule. They are historical, not V4 estimates.

## Presentation V3

The seven existing gun assets and preference are reused through the shared arsenal catalog. The four-player renderer supplies an always-visible separate hammer, projected cylinder texture, laser charge effects, and a smaller rotation envelope below the pot. WebAudio samples are decoded before joining, leading silence is trimmed, and shot resolution/recoil/fire occur together 320 ms into the hammer animation. Turn and opening wood audio have bounded durations; stale sources and animation callbacks stop on table changes. The lamp uses layered radial falloff, source glow, directional shadows and gentle opacity variation. TV glow extinguishes on elimination. Reduced-motion preferences stop room and mannequin idle movement.

The new transparent atlas `assets/roulette-four/images/tv-mannequins-v3.png` has two model columns and three pose rows. The original aspect ratio is preserved. Live profiles align to each screen within the pose wrapper, so they move together. The superseded single-pose PNG was removed after checking repository references. Shared original-room, poster, gun and sound assets remain because both game versions use them.

Generated with the built-in imagegen tool, transparency enabled. Prompt: Create a production game sprite atlas, portrait canvas 1024x1536, exact 2-column by 3-row grid, six full-body seated wooden artist mannequins with vintage walnut CRT television heads, dark wooden chairs, warm saloon lighting and transparent background. Left column masculine broad shoulders; right column feminine narrower shoulders and curved torso. Rows: relaxed hands on thighs; crossed legs with hand supporting side of TV; hunched forward with elbows on knees. Keep blank front-facing TV screens consistently positioned for live overlays, all figures inside their cells, no labels, floor, weapons or blood.

## Balance observations (50,000 rounds per variant)

Reproduce with `node scripts/analyze-roulette-four.mjs 50000`, optionally `--first-lap-limit`. Each seat independently draws the current bot personality distribution. These are policy-dependent estimates, not optimal strategy or predictions of human play. The experiment does not change live rules.

Current rules: 4.18 shots per round, 16.74% end on the first shot, 8.74% empty the pot. First two seats collect at least $300 in successful-shot awards before redistribution in 2.54% of rounds. This metric includes later turns; it does not imply collecting all that money before seats three and four act.

| Seat | Profit frequency | Average net | Never fires |
| --- | --- | --- | --- |
| First | 54.63% | -$2.52 | 0% |
| Second | 65.20% | +$3.88 | 28.33% |
| Third | 69.28% | +$0.77 | 53.27% |
| Fourth | 59.60% | -$2.13 | 70.76% |

A simulated one-shot-per-turn first lap reduces fourth-seat nonparticipation to 48.88%, but its mean net drops to -$3.86; this is an engagement tradeoff, not an established balance fix. Randomized order equalizes seat exposure over many rounds. A four-round rotation could guarantee each seat once, but would change the current random-rematch rule.

The two supplied October 9 debug exports describe the same session, retaining five completed results. All five distribute exactly $400, and neither export records errors. In two rounds, two zero-shot survivors finish at $116.11 each. One round empties the pot after ten safe shots. That small overlapping sample is not suitable for estimating player-order advantage.
