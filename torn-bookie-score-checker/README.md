# Torn Bookie — ChatGPT Score Tracker v0.2.0

A read-only MCP app with an inline ChatGPT UI for pending Torn Bookie bets.

## What changed in v0.2.0

- Keeps the one-click **Check Scores Now** button.
- Adds explicit disruption states: **DELAYED, SUSPENDED, POSTPONED, CANCELLED, ABANDONED, WALKOVER**.
- Recognizes status text such as rain/weather delay instead of collapsing it into `UNKNOWN`.
- Adds a SportScore single-match-detail fallback when the event is missing from the current live/recent list.
- Adds **TheSportsDB** as a broad multi-sport fallback instead of immediately rejecting every sport outside SportScore's four supported sports.
- Shows which source supplied the match data.
- Keeps settlement conservative. v0.2 automatically settles only simple moneyline/winner markets. If a final score is found for a handicap/spread/other market, it displays the score and win condition but returns `UNKNOWN` instead of guessing.

## Provider strategy

### SportScore — primary

Used first for:

- tennis
- football
- basketball
- cricket

The checker first scans the provider's live/recent list. If a bet is not found, it also tries the provider's documented single-match detail endpoint using matchup-derived slugs in both orientations.

SportScore developer docs:

https://sportscore.com/developers/

### TheSportsDB — broad fallback

Used when:

- the Torn sport is not one of SportScore's four supported sports, or
- SportScore cannot confidently identify the event, or
- SportScore only reports `UPCOMING` / `UNKNOWN`, where a postponement or interruption may explain a missing score.

TheSportsDB supports event search across many sports, including traditional sports and ESports. Its event-status documentation includes codes/states for postponements, suspensions, interruptions, cancellations, abandonment and walkovers for several sports.

TheSportsDB API docs:

https://www.thesportsdb.com/docs_api_guide
https://www.thesportsdb.com/docs_api_data

The v1 fallback uses the documented public key `123`. The free API is rate-limited, so this app performs at most one TheSportsDB event search per bet per manual refresh.

## Important coverage note

"Multi-sport" means the checker now **attempts lookup for any sport passed by Torn** instead of hard-rejecting unsupported sports. It does not mean every niche Torn event is guaranteed to exist in either upstream database. When neither provider can confidently identify a current event, the card remains `UNKNOWN` rather than guessing.

## Status behavior

Examples:

- `Rain delay` / `Weather delay` → `DELAYED`
- `SUSP` / `Suspended` / `Interrupted` → `SUSPENDED`
- `PST` / `POST` / `Postponed` → `POSTPONED`
- `CANC` / `Cancelled` → `CANCELLED`
- `ABD` / `Abandoned` → `ABANDONED`
- `WO` / `Walkover` → `WALKOVER`
- normal in-play states → `LIVE`
- finished states → `FINAL`
- scheduled/not-started states → `UPCOMING`

Disruption states do **not** automatically settle the bet.

## Run locally

Requirements: Node.js 20+.

```bash
npm install
npm start
```

Health check:

```bash
curl http://localhost:3000/health
```

MCP endpoint:

```text
http://localhost:3000/mcp
```

Syntax check:

```bash
npm run check
```

## Deploy on Render

This project keeps the existing Docker/Render structure. Push the updated files to the same repository. If the Render service has Auto Deploy enabled, the new commit should trigger a rebuild.

The public MCP endpoint remains:

```text
https://YOUR-HOST/mcp
```

After the deploy completes, reconnect/refresh the Score checker plugin in ChatGPT if its cached tool schema still shows the old v0.1 descriptions.

## Bet input

```json
{
  "eventId": "6011053",
  "eventDate": "2026-08-12",
  "sport": "tennis",
  "matchup": "Lilli Tagger vs Robin Montgomery",
  "pick": "Lilli Tagger",
  "market": "ML",
  "odds": 1.57,
  "stake": 1000000,
  "winCondition": "Lilli Tagger must win the match."
}
```

`eventDate` is optional, but supplying it improves fallback matching when the same teams/players meet repeatedly.

## Safety / correctness choices

- Read-only: no Torn bets are placed or modified.
- Match names must pass a confidence threshold before a provider result is accepted.
- TheSportsDB matches older/newer than a reasonable current-event window are rejected unless an explicit `eventDate` is supplied.
- The app does not infer a WIN/LOSS for non-moneyline markets just because one side won the game.
