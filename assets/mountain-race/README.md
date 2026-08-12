# Summit Sprint

`Summit Sprint` is the working title for the original two-player mountain-climbing race mode.

Players race up separate climbing lanes by pressing directional prompts in the exact order shown on the mountain. Correct inputs advance one hold. Incorrect inputs make the climber slip back one hold. The first climber to complete all 30 holds wins; when the 30-second timer expires, the higher climber wins and equal height is a tie.

## Multiplayer testing

Summit Sprint is registered in the shared multiplayer testing area under the internal mode id `mountainrace`.

The existing multiplayer flow supports:

- creating a Summit Sprint game with the normal wager and Ready flow
- another signed-in player joining from the public game list
- restoring the race after refresh or reopening the page
- the same 3–2–1–GO lifecycle used by the other multiplayer games
- authoritative server-generated prompt sequences
- server-confirmed correct and incorrect inputs
- duplicate-action and stale-prompt protection
- first-to-summit and timeout settlement
- rematches and creating a new game after completion
- adding the simple testing NPC
- creating or attaching the Remote Network Bot from the testing dock
- an 8% testing-bot mistake rate with independently scheduled moves
- bounded catch-up of every bot move that became due between browser polls
- simulated duplicate requests, stalls, and reconnect delays from the selected Remote Bot profile
- automated validation that the Remote Network Bot can finish and win a complete 24-hold race

The Summit Sprint bot is not limited to one move per browser refresh. A focused game poll wakes the server-side driver, which replays all due bot moves through the same action validation, prompt-index guard, action-id deduplication, persistence, and winner settlement used by a player input. This allows the bot to complete the full 24-hold race even when polling is slower than its reaction time.

Only the viewer receives their next four prompts. The opponent's future sequence is never sent to the client. Player elevations, mistakes, latest movement, finish order, and winner settlement remain authoritative on the server.

## Multiplayer files

- `mountain-race-multiplayer.js` — shared multiplayer renderer, keyboard/touch input, countdown, race clock, and bridge actions
- `mountain-race.css` — namespaced mountain, climber, controls, and responsive presentation
- `netlify/functions/mountain-race/state-model.js` — deterministic state rules and prompt privacy
- `netlify/functions/mountain-race/integration.js` — shared duel actions, polling, full testing-bot driver, timeout, and completion integration
- `scripts/patch-mountain-race-multiplayer.mjs` — build-time launcher and backend registration
- `scripts/patch-mountain-race-mode-option.mjs` — ensures the shared game creator can select Summit Sprint

## Standalone prototype

The earlier local gray-box prototype remains available at:

- `/mountain-race-preview.html`

It includes the same 24-hold course, 30-second clock, directional controls, scrolling lanes, slip penalty, and a local Normal bot. It remains useful for testing presentation without creating a multiplayer wager.

## Controls

- Desktop: arrow keys or WASD
- Mobile: four large `pointerdown` direction controls
- Light vibration is used for supported mobile devices

## Isolation rules

- Front-end code stays under `assets/mountain-race/`.
- Server-side helpers stay under `netlify/functions/mountain-race/`.
- All reusable game CSS remains scoped below `.mountain-race-game`.
- Summit Sprint build scripts do not write Roulette or Safe Cracker assets.
- Artwork, characters, mountain layouts, sounds, names, and interface elements must remain original.
