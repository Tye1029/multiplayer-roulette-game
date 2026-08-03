# Summit Sprint

`Summit Sprint` is the working title for the original two-player mountain-climbing race mode.

Players race up separate climbing lanes by pressing the prompted controls in the exact order shown on the mountain. Correct inputs advance the climber. Incorrect inputs make the climber slip back one hold.

## Current playable prototype

The standalone gray-box prototype is available at:

- `/mountain-race-preview.html`

It currently includes:

- a 3–2–1–GO countdown
- 24 randomized directional holds
- a scrolling mountain for each climber
- an original temporary CSS climber design
- keyboard support through arrow keys and WASD
- large touch controls using `pointerdown`
- a Normal-difficulty local bot
- an 8% bot mistake rate
- wrong-input slipping and one-position loss
- a 30-second race clock
- summit, timeout, tie, and replay states
- light mobile vibration where supported

This prototype is intentionally local-only. It exists to approve the race pacing, scrolling, controls, penalty, and presentation before the mode is connected to the shared multiplayer duel endpoint.

## Isolation rules

- Internal mode id: `mountainrace`
- Front-end code stays under `assets/mountain-race/`.
- Server-side state helpers stay under `netlify/functions/mountain-race/` until the mode is deliberately connected to the shared duel endpoint.
- All reusable game CSS remains scoped below `.mountain-race-game`.
- No Summit Sprint file may modify Roulette or Safe Cracker assets directly.
- Artwork, characters, mountain layouts, sounds, names, and interface elements must be original.

## Folders

- `mountain-race.js` — isolated client controller, local prototype loop, input handling, scrolling, and animations
- `mountain-race.css` — namespaced mountain, climber, controls, and responsive presentation
- `images/` — reserved for original mountain, character, weather, and interface artwork
- `audio/` — reserved for original climb, input, countdown, finish, and ambience audio

## Planned authoritative multiplayer state

The server will own:

- race start and end timestamps
- randomized prompt sequences
- each player's current prompt index and elevation
- accepted and rejected inputs
- rate and duplicate-action protections
- NPC decisions
- reconnect and refresh restoration
- finish order and winner settlement

The prototype is not registered in the main launcher yet. That keeps the current Roulette and Safe Cracker modes unchanged while the race mechanics are reviewed on `mountain-race-development`.
