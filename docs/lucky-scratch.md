# Lucky Scratch V2

The homepage separates multiplayer and single-player collections. Lucky Scratch
is the first single-player entry at `/games/single-player/lucky-scratch/`.

## Rules and pricing

Reveal nine panels. Exactly three matching amounts win that amount once. Losing
tickets have no trio. Each tier has the same probability distribution; prices
are 50,000, 100,000, 500,000, 1,000,000, 5,000,000 and 10,000,000 Chips. Prizes are total returns,
including any returned stake, rather than profit added on top of the stake.

| Return multiplier | Probability |
| --- | --- |
| 0 | 60.80% |
| 1 | 20.00% |
| 2 | 12.00% |
| 5 | 5.20% |
| 10 | 1.70% |
| 25 | 0.28% |
| 100 | 0.02% |

The weighted return is exactly 96%. Do not apply the multiplayer fee again.
The free sample is illustrative and never calls a purchase or payout endpoint.

## Persistence and money

The server authenticates existing Torn sessions and resolves the verified Torn
identity to its existing wallet. It creates an immutable random outcome using
`crypto.randomInt`. The ticket intent commits in PostgreSQL before the wallet
debit. The shared wallet uses conditional writes and durable receipt IDs for
each debit and payout. Interrupted cross-store operations replay those receipts.

An owner lock permits one unfinished ticket per player. Every purchase request
ID is retained, including requests that resume an existing active ticket, so a
late retry cannot become a new purchase after the active ticket settles.
Ticket locks serialize reveals and settlement. A client can only submit panel
indices; it cannot choose the price, prize, owner, or wallet destination.

All nine panels must be revealed for settlement. Reloading restores the ticket
and confirmed reveals; partially erased foil on an unconfirmed panel may reset.
Once funded, panel values are sent to the browser to support local scratching.
Inspecting those values cannot change the immutable result or obtain a refund.
The admin's existing financial ledger includes the ticket ID, reason, amount,
and timestamp. No new welcome balance or independent game balance is created.

## Validation

- `node --test scripts/lucky-scratch.test.mjs scripts/site-hub.test.mjs`
- `npm run build` (includes existing protected-game checks)
- `node scripts/lucky-scratch-browser.test.mjs`

Browser QA uses isolated synthetic accounts, PGlite, and the real endpoint.
It covers mouse and native touch input, keyboard reveal, saved progress, lost
settlement responses, demo play, homepage links, and phone/desktop layouts.
The Lucky Scratch GitHub Actions workflow runs these checks on pushes and PRs.

After settlement, the player chooses the next tier beside the result and buys
a new ticket in place. The free sample repeats in sample mode. Existing tickets
retain their stored price and payout when the current pricing changes.
