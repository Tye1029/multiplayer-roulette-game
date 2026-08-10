# Multiplayer Arcade Architecture

The repository name is historical. The deployable product is the complete
multiplayer arcade, and every game uses the same server-owned lifecycle:

`waiting -> ready -> countdown -> playing -> complete`

## Ownership

- `shared/games/catalog.js` defines the product boundary between single-player
  sections, current multiplayer test games, and older multiplayer modes.
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

## Directory migration

The Git repository and local checkout do not need to be renamed for the browser
to present the product as a gambling website. Renaming the root first would
break Netlify paths, workflow assumptions, and old asset references without
fixing routing. The safe migration is incremental:

1. Keep `shared/games/catalog.js` as the routing source of truth.
2. Move stable single-player implementations under `games/single-player/` one
   game at a time, retaining compatibility entrypoints while each move ships.
3. Move stable multiplayer implementations under `games/multiplayer/` using the
   same process.
4. Retire a legacy patch only after its generated output has a module-owned
   replacement and equivalent regression coverage.

This preserves deployed URLs while steadily turning the historical Roulette
repository into a clearly organized gambling-site codebase.
