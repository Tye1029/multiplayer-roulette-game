# Hand of Doom

Standalone 1v1 Rock Paper Scissors at `/games/multiplayer/rps/`, linked from the
main game selector. The older shared-runtime RPS registration is retained for
historical compatibility; this page uses its own endpoint and authoritative
tables and does not route through the old one-shot RPS mechanics.

Two round wins end a match; tied hands replay without scoring. Picks are immutable,
accepted once per server round, and hidden until the server reveal timestamp.
Both clients use server timing: 200ms staging lead, reveal at 1500ms, new hand at
2900ms. Three camera sequences rotate eyes, silhouette poses and hand impacts.
At 1–1, crowd/music stop until a decisive hand. Calm camera, keyboard 1/2/3,
touch targets, a sound toggle and reduced-motion support are included.

## Identity and persistence

`rps-action` verifies Torn profile keys only at login. The key is neither stored
nor logged by this endpoint. Subsequent requests use an opaque 12-hour session;
only its SHA-256 hash is stored. Identity is the verified Torn player ID, never
a client-supplied visitor alias or display name. Existing site keys can be reused
by the page. Sessions and active game IDs are kept in sessionStorage.

`rps/database.js` uses the existing `NETLIFY_DB_URL` PostgreSQL pool, lazy schema
initialization, row locks and transactions. Cold starts share a transaction-scoped
schema advisory lock to prevent concurrent table/type creation. Migration 004 is
retained byte-for-byte after Netlify applied it; applied migrations are immutable.
Completed human matches insert one result per match ID in the same transaction
as the decisive pick, with visibility delayed until the finale ends. Rivalries aggregate
these immutable results, sorted by completed matches, then latest match, then
opponent ID. The first is the arch rival. Displayed head-to-head wins count
matches, not individual hands. Bot/exhibition/abandoned matches never count.
Ready rooms expire after 15 minutes; an unanswered hand expires after 90 seconds,
cancelling without a fabricated winner. Both players consent to a rematch, which
gets a fresh ID. Create retries reuse an active match for that identity.

The Remote Network Bot is server-authoritative and chooses with crypto.randomInt
before the human pick is processed. Local exhibition uses the same rules but
does not contact the database or claim to record a rivalry.

No wagering, wallet deductions or payouts were added; the request was for a
rivalry game. The other game runtimes, protected files and validations stay intact.

## Assets

All assets are in `assets/rps/`. Detailed audio attribution and adaptations are
in `assets/rps/CREDITS.txt`, also available from the game footer. Music and crowd
are recorded media, not procedural oscillators. Announcer clips use synthesized
speech. Background-tab/page-exit audio is stopped. Media playback is unlocked by
a user gesture. No RPS media is requested from the shared home page.

The verbatim built-in image-generation prompt set is in `docs/rps-art-prompts.txt`.
Saved PNGs were optimized without stretching:

- `images/coliseum.png`: Wide anime Roman coliseum at night, thousands of cheering
  fans, layered stone arches, blazing braziers and side pyrotechnics, orange and
  crimson lights contrasted with blue. Open sandy central stage for overlaid
  fighters. Rich painted animation background, no text/UI/foreground characters.
- `images/gladiator.png`: Transparent adult anime gladiator sprite, wild dark
  hair, intense eyes, bronze shoulder armor, red tunic, flowing crimson cape,
  leather boots, fingerless gauntlets. Both hands deliberately behind his back,
  chest forward, turned slightly right, wide planted stance. Full body in frame,
  clean cel shading and strong ink, no weapon/text/floor, genuinely transparent.

No superseded assets were created. The existing legacy RPS contract is retained
because protected multiplayer validators and historical game records reference it.

## Validation

Run `node --test scripts/rps.test.mjs`, `npm run build`,
`npm run validate:protected-current`, and `npm run validate:mountain-race`.
The RPS workflow also runs transaction tests against embedded PostgreSQL/PGlite.
For those and the two-client browser suite, install test-only packages with
`npm install --no-save --no-package-lock @electric-sql/pglite@0.3.14 playwright@1.61.1`,
then `npx playwright install chromium` and `node scripts/rps-browser.test.mjs`.
The browser suite runs the real handler and storage against a temporary database,
with synthetic test identities. It never seeds production credentials or records.
Windows checkouts may require an LF validation copy for existing exact-string
protected validators; no protected validator or runtime is changed for this game.
Production schema is declared in `netlify/database/migrations/004_rps_arena.sql`.

Deployment marker: `HAND_OF_DOOM_V1_20261009` in the page, controller, model and
endpoint response header/body. PR #20 preview remains the delivery target.
