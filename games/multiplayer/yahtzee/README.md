# Yahtzee duel V2

Route: `/games/multiplayer/yahtzee/`. Marker: `YAHTZEE_DUEL_V2_20261011`.

Two authenticated players play each of 13 rounds simultaneously. Both receive
30 seconds and up to three rolls, can hold/release individual dice, and bank
one category each. The original category scoring, 35-point upper bonus and
repeat-Yahtzee/Joker rules remain. Available zero scores render blank; banked
zeros show a check and cannot be reused. The scorecard is visible from entry,
with both players' totals above the table and both dice sets visible live.

The page uses the shared Xan Duels header, settings, default dark theme and
saved light/sound preferences. Identity is verified through the existing RPS
session service and comes from the connected Torn API key. Client-submitted
names and IDs are ignored. No wagers or wallet changes are involved.

The host may start with a friend or attach House Bot. Test with bot creates and
starts a room in one click. The server bot rolls, holds and banks on timed
steps, visible to the human; it never receives privileged dice outcomes.
Rematches require both humans, while the bot automatically accepts.

PostgreSQL locks serialize room updates; each player has an independent input
version so concurrent opponent actions do not reject a move. Request IDs make
retries safe. Game and round IDs reject late actions, including at the exact
deadline. On expiry the server banks the best legal score from existing dice,
or zero in the first empty category if no roll occurred. Between-round pauses
last 1.8 seconds. Timers are anchored to server timestamps, including when all
browsers sleep. Polls advance and persist elapsed rounds and bot steps.

Rooms last 24 hours and can be resumed by the same authenticated account.
Version-1 anonymous rooms are not migrated into authenticated identities;
the page explains that a new game is needed. Confirmed leave closes a match.
The previous layout, copy and anonymous identity implementation were replaced
in their original files, leaving no superseded assets. The reusable SVG icon,
CSS dice faces and short Web Audio effects load only with this game.

Checks:
```
node --test scripts/yahtzee.test.mjs
npm run build
node scripts/yahtzee-browser.test.mjs
```

The browser check uses two independent contexts, real PostgreSQL semantics via
PGlite, and fixture Torn identities passing through the real session
authentication implementation. It covers both live scorecards, independent
rolls, holds, retries, reload, 13 rounds, rematches, authoritative timeouts, bot
completion, theme/settings and 320–1440px viewports. The fixture server is
test-only and excluded from the published site. Deployed testing requires an
existing authenticated preview session; no production auth bypass is provided.
