# Rumble Fishing Duel

This is the game-owned folder and stable public entry point for Rumble Fishing
Duel. Open `/games/multiplayer/fishing/` to launch the current production game
through the shared multiplayer arcade.

Use `/games/multiplayer/fishing/preview.html?state=live` to inspect the live
game layout and `/games/multiplayer/fishing/preview.html?state=result` to inspect
the completed-match weigh-in and illustrated logbook without starting a match.

## Current implementation map

- `index.html` contains the shared arcade shell and the current Fishing client.
- `assets/fishing/fishing.css` contains the Fishing-only responsive presentation
  and cast, pull, cloud, fish-sway, blink, and rare-shimmer animations.
- `assets/fishing/images/v2/` contains the PNG lake, docks, fishermen, clouds,
  open field log, 36 standard fish, and six rare fish designs.
- `netlify/functions/_data.js` owns shared duel orchestration and Fishing's
  authoritative server-side rules.
- `netlify/functions/_fishing-database.js` owns atomic Fishing match and ripple
  claims.
- `netlify/database/migrations/002_fishing_authoritative.sql` defines the
  authoritative Fishing database tables.

Future game-owned client assets belong in `assets/fishing/`, and game-specific
server modules can move into `netlify/functions/fishing/`. Shared multiplayer
contracts and orchestration should remain in their existing shared locations.
