# Netlify-only authoritative DRAW setup

This build keeps the website, Functions, database, and deployment entirely on Netlify.

## What changed

DRAW target claims are stored in Netlify Database (Postgres), not in whole-game Blob writes.
Every click runs inside a database transaction with a row lock. This guarantees that:

- one shared standard card can be claimed only once;
- two Function instances cannot overwrite each other's score changes;
- duplicate browser retries with the same action ID cannot score twice;
- boss progress remains separate for each player;
- the action ledger and confirmed score are returned together;
- live target actions skip unrelated balance/Blob reads;
- unchanged polls return only a tiny revision response;
- refreshes read the same authoritative state from Postgres.

Other game modes and existing account/balance records remain unchanged.

## Deploy

1. Upload this complete project to the existing Netlify site or deploy it through the connected Git repository.
2. In Netlify, open the project and select **Database**.
3. Create/enable Netlify Database if Netlify did not provision it automatically during deployment.
4. Trigger a fresh production deploy.

The project includes `@netlify/database` and the migration at:

`netlify/database/migrations/001_draw_authoritative.sql`

Netlify applies that migration during deployment and creates:

- `draw_matches`
- `draw_actions`

No database password or connection string needs to be pasted into the site code.

### Recommended speed setting

Add `DUEL_SESSION_SECRET` in Netlify Environment Variables with Functions scope. Use a long random value. This lets the arcade verify Torn once, then authenticate polls and target clicks locally with a 30-minute signed session instead of waiting on Torn for every request. If omitted, the existing `ADMIN_PASSWORD` is used as the signing secret.

## Before testing

Use **Cancel All Multiplayer & Arcade Games** once, then create a new DRAW match. Old matches were created before the database-backed round format.

Test with two separate browsers or devices. Both players must use different site/Torn users.

## Verification

During a match, Netlify's Database table viewer should show one row in `draw_matches` and one new `draw_actions` row per accepted hit. Repeating the same action ID does not create another row.

## Important fairness note

Shared cards remain shared, as requested. Postgres guarantees exactly one winner for a contested standard card, but the request that reaches the database first wins. This removes lost writes and split Function-instance state, but it cannot completely remove physical network-latency differences.

## Authoritative fishing tables

This build also includes `netlify/database/migrations/002_fishing_authoritative.sql`.
Netlify Database migrations create `fishing_matches` and `fishing_actions` alongside the DRAW tables. Fishing ripple claims are row-locked, idempotent, revisioned, and stored separately from DRAW.

## Authoritative Blackjack Duel table

The deployment also applies `netlify/database/migrations/003_blackjack_duel_authoritative.sql`.
It creates `blackjack_duel_matches`, whose row lock serializes hits, stands, timeout resolution, and Remote Bot decisions. The complete shuffled deck and each player's fixed draw lane remain server-only; browser snapshots expose only the viewer's cards until the hand is complete.
