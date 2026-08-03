# Summit Sprint

`Summit Sprint` is the working title for the original two-player mountain-climbing race mode.

Players race up separate climbing lanes by pressing the prompted controls in the exact order shown on the mountain. Correct inputs advance the climber; incorrect inputs should briefly interrupt momentum without revealing or altering the opponent's private input sequence.

## Isolation rules

- Internal mode id: `mountainrace`
- Front-end code stays under `assets/mountain-race/`.
- Server-side state helpers stay under `netlify/functions/mountain-race/` until the mode is deliberately connected to the shared duel endpoint.
- All CSS must remain scoped below `.mountain-race-game`.
- No Summit Sprint file may modify Roulette or Safe Cracker assets directly.
- Artwork, characters, mountain layouts, sounds, names, and interface elements must be original.

## Planned folders

- `mountain-race.js` — isolated client controller and renderer
- `mountain-race.css` — namespaced game presentation
- `images/` — original mountain, character, weather, and interface artwork
- `audio/` — original climb, input, countdown, finish, and ambience audio

## Planned authoritative state

The server will own:

- race start and end timestamps
- randomized prompt sequences
- each player's current prompt index and elevation
- accepted and rejected inputs
- NPC decisions
- reconnect and refresh restoration
- finish order and winner settlement

The initial scaffold is intentionally not registered in the launcher yet. That keeps the current Roulette and Safe Cracker modes unchanged while the new game is built and tested on `mountain-race-development`.
