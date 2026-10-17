# Game discovery and account panels — V2

The home menu supplies a rules button and a short gameplay description for every
listed game. Four small, self-contained SVG covers replace scenery-only or
photographic home cards. The original scene and cover assets remain because
game previews and game-owned pages still reference them, including the legacy
dynamic `site-hub/images/<mode>.webp` fallback. No live scene art is replaced.

Stats opens on All games, with separate Single Player and Multiplayer selectors
and achievement groups. A selected game shows its own records and chip rewards.
The header's Close control remains at the upper right while the dialog scrolls.
Both achievement presentations now use this shared panel. Unlock requirements
are omitted from API responses, including already earned awards.

## Reward accounting

Existing multiplayer achievement IDs and amounts are unchanged. Four further
tiers extend each catalog to twelve awards. New single-player catalogs have
twelve rising reward tiers. Eligibility is computed from server-owned records;
the browser cannot submit scores, play days, reward amounts, or recipients.
Only completed, non-refunded rounds with at least a 10,000-Chip stake count toward rewards. Older smaller paid rounds remain in lifetime statistics.
Distinct play days use the wallet's UTC settlement timestamp.

At every single-player reward tier, cumulative bonuses are below 1% of the
minimum qualifying wager volume. Total one-time awards per game are 4,320,000
Chips. The final tier requires 100,000 paid rounds over at least 730 different
days. Multiplayer's final added tier requires 20,000 competitive wins and 730
days. These are finite promotional costs, not changes to game outcome odds.

The database records an award intent before crediting the canonical wallet.
The existing `achievement:<TornID>:<mode>:<achievementID>` receipt makes credit
idempotent across concurrent reads, lost responses, and API-key replacements.
Profile refreshes skip already recorded eligibility writes. No migration of
historical financial data is needed; valid old rounds contribute automatically.

## Withdrawals

The balance is fetched through an authenticated, private balance action. Its Xan
equivalent uses up to eight decimals so a fractional balance cannot round up to
a whole withdrawable Xan. The dropdown offers sequential whole amounts, a custom
amount for large balances, and Max rounded down to the available whole Xans.
The server continues to enforce whole-Xan increments and available funds.
An uncertain withdrawal response retains its amount and receipt for a safe
retry. A different authenticated account cannot reuse that pending request.

## Checks

- Build includes protected Roulette, Safe Cracker, multiplayer, and Summit checks.
- Account tests cover lost credit responses, concurrent award reads, unknown
  reward modes, forged profile data, account isolation, day gates, refunds,
  unfinished rounds, and the cumulative promotion budget.
- Browser tests cover every home rules button, the four covers, grouped stats,
  concealed conditions, exact Xan conversion, Max, insufficient funds, and a
  lost withdrawal response followed by a retry with the same receipt.
- Browser QA uses isolated synthetic wallets, including when exercising deployed
  preview assets. It never places live player wagers or submits live withdrawals.
