# Site hub, online four-player table, and test-readiness review

Build marker: `XAN_HUB_V1_20261011` / `XAN_FOUR_ONLINE_V1`.

## Delivered behavior

- Shared navigation, per-game XAN colors, verified balance, illustrated eight-game launcher, rules dialogs, and gated onboarding.
- Persistent global audio and dark/light preferences. Removing the API key clears browser credentials and identity caches without cancelling server-owned rooms.
- Public waiting games last 15 minutes from creation. Navigation does not cancel them. Creator-only cancellation is available while nobody else has joined. Full rooms are omitted from join listings.
- Persistent, owner-bound join notifications, deduplicated by room and joining player. A join observed while viewing that room is stored as already read. Polling runs only in visible tabs at 15-second intervals; this is an in-site inbox, not an operating-system push service.
- Admin report inbox with verified Torn identities or a Guest label. The separate debug action sends an allowlisted diagnostic summary, excluding credentials, logs, concealed choices, storage, and request bodies. Report submissions are limited to 12 per hour per verified identity or guest network fingerprint. Admin credentials are accepted in headers only.
- Four-player Roulette has PostgreSQL-owned seats, chamber, turn order, deadlines, actions, rematch consent, and settlement. Seats require separate Chip accounts. Stable payment IDs recover writes after interrupted responses. The former local table remains at `?practice=1` for free practice and its existing regression coverage.
- RPS adds Kael, Ren, Sora, and Nyx, each with a standing sprite and all nine cinematic poses. Picker thumbnails and indexed PNG atlases reduce transfer/decode costs. Unchanged RPS presentation states no longer rewrite the DOM ten times a second.

## Security fixes and evidence

- Removed browser visitor-ID-based account adoption. Account selection begins with the verified Torn principal; a supplied browser ID cannot select another wallet. An isolated resolver regression covers the malicious-alias case.
- Legacy wallet saves now use ETag-conditional writes and reject a merged negative ledger balance. A concurrent-debit regression verifies only one of two unaffordable wagers can succeed. Native functions request strong reads; legacy Lambda contexts without an uncached URL can use an ETag read, but stale writes fail closed.
- Removed silent financial-ledger truncation at 3,000 entries. Dropping debits or settlement IDs changes balances and breaks deduplication; entries are retained until a deliberate ledger migration exists.
- Serialized legacy room create/join/cancel and bot-attachment operations across workers using a database advisory lock after authentication. Cancellation reads current room state. Expired/full rooms cannot be joined. Client create IDs are now forwarded to the existing idempotent create implementation.
- Removed admin password query-parameter fallbacks. Existing admin UI already uses headers.
- Verified that the old `record-bet`, `buy-ticket`, runner, horse, and arcade play endpoints are absent; the earlier review's client-reported-bet endpoint finding no longer describes the deployed source tree.
- New server responses explicitly omit chamber secrets, wallet account mappings, tokens, and financial intents. Report/notification text is rendered as text or escaped.

## Remaining limits before a wider launch

- Historical account aliases and ledger truncation predating this patch cannot be repaired from source alone. Audit existing stored associations and reconcile balances against source transactions before expanding beyond trusted testers.
- Older two-player games still have separate Blobs wallet/room writes. The lock and wallet CAS prevent common join/cancel and balance races, but a worker crash between a successful debit and initial room persistence needs administrative reconciliation. Migrate these games to durable payment intents before an unrestricted launch; RPS and the new four-player table already use durable intents.
- The legacy lobby enumerates historical Blobs records. The result filter now preserves waiting/owned games, but a large deployment needs an indexed active-room registry and cursor pagination. The four-player and RPS databases are indexed, but bounded sweeps should be monitored under load.
- Admin still uses a shared environment password; add attributable, revocable admin sessions and deployment-level request throttling for public production. Review hosting permissions and secrets separately. The code review did not inspect private production records or hosting IAM.
- Financial ledgers are retained in full for correctness. Move historical entries to an authoritative ledger table before records become large; do not reintroduce truncation without preserving balances and deduplication.
- Netlify scheduled settlement runs on published deployments only. Preview requests also perform recovery, but an abandoned preview table with no later visitors is settled on the next request.
- The pre-existing untracked offline security audit targets some retired files and currently reports an incomplete audit. Those unrelated files were preserved. New behavioral security tests live in `scripts/site-hub.test.mjs`.

## Validation

Run `npm run build`, `node --test scripts/rps.test.mjs scripts/rps-database.test.mjs scripts/site-hub.test.mjs`, `node scripts/rps-browser.test.mjs`, and `node scripts/site-hub-browser.test.mjs`. The build includes the existing protected Roulette/Safe Cracker, Summit Sprint, Fishing, Blackjack, and four-player practice regressions. Browser coverage uses isolated local identities and simulated balances, including four independent online clients, payout recovery, mobile onboarding, settings, reporting, and notifications. No live Chip wager is used for QA.

No existing media files were deleted: the original fighter assets and practice-table modules remain directly referenced. New home images are small derived thumbnails; full game media remains confined to game routes or selected modes.
