# Yahtzee online

Entry: `/games/multiplayer/yahtzee/`. Build marker: `YAHTZEE_ONLINE_V1_20261011`.

Free private games for 2–4 friends. No Torn account or wallet is involved. The
host starts after friends join with an eight-character code or invite link.
Classic turns, 13 categories, 3 rolls, a 35-point upper bonus, repeated Yahtzee
bonuses and forced Joker placement follow Hasbro's scoring rules:
https://hasbro-apac-eng.custhelp.com/app/answers/detail/a_id/975/

The dedicated `yahtzee-action` function uses the existing Netlify Database
connection and creates its own `yahtzee_rooms` table. All dice come from server
crypto RNG; PostgreSQL row locks, revisions and request IDs prevent concurrent
or replayed moves. A browser retains a 256-bit random bearer secret; only a
derived player ID is persisted. Room codes invite new seats only before play.
Rooms expire after 24 hours; old rows are removed on room creation. Creation
is limited to ten rooms per IP per hour. No public lobby, wagers or chat.

Refresh recovers the current room and held dice on the same browser. Failed
moves expose a retry button using the original request ID. Rematches require
every player. A confirmed leave during play closes the table; closing a tab
does not forfeit, so friends can reconnect. There is intentionally no turn
timer; a disconnected friend must return or the group can start a new room.

Dice use CSS 3D faces, native transforms and short Web Audio cues, with a
reduced-motion mode. The only image is the small reusable SVG launcher icon.
Game code and sound load only on the Yahtzee route. Existing games and media
are retained because their routes and validation still reference them.

Validation:

```
node --test scripts/yahtzee.test.mjs
npm run build
node scripts/yahtzee-browser.test.mjs
```

The browser test uses PGlite and two independent browser contexts. To exercise
the deployed function instead, set `YAHTZEE_ORIGIN` to the preview origin.
`YAHTZEE_PLAYWRIGHT_MODULE`, `YAHTZEE_BROWSER`, and `YAHTZEE_SCREENSHOTS` can
override the browser runtime and screenshot directory.
