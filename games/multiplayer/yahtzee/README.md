# Yahtzee duel V3

Route: `/games/multiplayer/yahtzee/`. Marker: `YAHTZEE_DUEL_V3_20261011`.

Two authenticated players play each of 13 rounds simultaneously. Both receive
30 seconds and up to three rolls, can hold/release individual dice, and bank
one category each. The original category scoring, 35-point upper bonus and
repeat-Yahtzee/Joker rules remain. Available zero scores render blank; banked
zeros show a check and cannot be reused. The scorecard is visible from entry,
with your own total above the table and both dice sets visible live. The opponent's
total is saved for the finish. There is no Scorecard shortcut or LIVE badge.

Starting and rematching use a server-owned three-second countdown before the full
30-second first round. On completion, a side-by-side tally highlights all 13
categories, the upper bonus and repeat-Yahtzee bonuses, counting both totals up
before announcing the winner. A shared finish timestamp keeps connected players
in step. Show totals skips the sequence; Replay tally plays it again. Reduced
motion displays the final breakdown immediately. Reloading a completed reveal
does not replay it automatically.

The page uses the shared Xan Duels header, settings, default dark theme and
saved light/sound preferences. Identity is verified through the existing RPS
session service and comes from the connected Torn API key. Client-submitted
names and IDs are ignored. No wagers or wallet changes are involved.

Open Games uses the same site-wide list and controls as the other games. Empty
Yahtzee rooms appear across the site; authenticated users can join, return, or
cancel their own empty waiting room. Full, active, closed and expired rooms do
not appear. The list exposes room metadata, never dice or internal state.

Six local dice palettes persist on this device and affect only your own dice.
Held dice retain the selected palette with a brighter outline and HELD label.
Original Web Audio dice impacts, hold/score cues, countdown, tally and Yahtzee
fanfare obey the shared Sound preference. Audio unlocks on a user gesture and
pauses when hidden; no music loop or third-party media is downloaded.

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
completion, countdown input locks, score reveal sums, lobby joins, saved dice
colors, theme/settings and 320–1440px viewports. The fixture server is
test-only and excluded from the published site. Deployed testing requires an
existing authenticated preview session; no production auth bypass is provided.
