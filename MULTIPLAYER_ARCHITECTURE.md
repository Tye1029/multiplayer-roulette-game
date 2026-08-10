# Multiplayer Arcade Architecture

The repository name is historical. The deployable product is the complete
multiplayer arcade, and every game uses the same server-owned lifecycle:

`waiting -> ready -> countdown -> playing -> complete`

## Ownership

- `netlify/functions/multiplayer-contract.js` is the authoritative registry for
  game modes and shared lifecycle policy.
- `netlify/functions/_data.js` owns persistence, escrow, lifecycle transitions,
  rematches, and public snapshots. Mode modules own only their gameplay state.
- `index.html` owns one focused-game poller. Mode renderers consume accepted
  snapshots but must not create a second lifecycle poller.
- `scripts/patch-multiplayer-cohesion.mjs` is the final compatibility migration.
  It runs after the legacy visual/game patches so late patches cannot restore a
  mode-specific lifecycle fork.
- `scripts/validate-multiplayer-cohesion.mjs` enforces the shared contract for
  every registered game.

## Shared guarantees

- Focused GET polling returns game state without performing a balance lookup.
- All focused reads use strong-first recovery before declaring a game missing.
- Every synthetic opponent confirms Ready in the same locked transaction as
  the human Ready request.
- Every registered mode supports the same ten-second rematch handshake.
- Synthetic-opponent rematches always charge/create as the human, then attach a
  fresh synthetic opponent; bot identities never pass through escrow code.
- Old or overlapping responses cannot change the currently focused game.

Legacy patch scripts remain in place because they reproduce the approved game
visuals. New cross-game behavior belongs in the shared contract/cohesion layer,
not in another game-specific patch.
