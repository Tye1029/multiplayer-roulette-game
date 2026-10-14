# Boardwalk Party — first playable prototype

Entry: `/party.html?v=BOARDWALK_PARTY_V1` on the existing PR #20 preview.

This is an independent social party prototype, separate from the existing Torn
games. The established game routes, wallets, protected source, and historical
assets remain because their runtime/build/API references still exist. No asset
is superseded by this separate prototype. No paid coins, cash prizes, transfers,
Torn authentication, deposits, or withdrawals are used in Boardwalk.

## Playable scope

- An original Neon Pier board with 24 spaces, route decisions, trophy collection,
  token spaces, gifts, rain, and three purchasable/usable match items.
- Four original vector characters: Riff, Cleo, Moss, and Bolt.
- Two to four seats in a four-round party; two seats in a best-of-three duel.
- Private room links/codes, readiness, optional clearly labeled server bots,
  reconnect, timed turns, shared standings, tiebreakers, and consensual rematches.
- Rooftop Rally (direction reflexes), Neon Putt (shared deterministic golf
  physics), Harbor Haul (server-timed casts), and Afterglow (short memory patterns).
- Server-owned guest profiles, earned cosmetic coins, four outfits, and rivalry
  records. Basic active completion earns 12 coins; the winner earns 8 extra.
  A profile can earn at most 200 coins per UTC day. Replaying the memory reveal
  does not count as active participation. Bots do not receive profile rewards.
- Shop coins cannot purchase match tokens or tactical items. The board's match
  economy resets with every rematch. Outfit purchases are atomic and idempotent.

## Boundaries

Guest credentials are random 256-bit secrets stored in HttpOnly, SameSite=Strict
cookies (Secure on HTTPS); only hashes are stored in PostgreSQL. A guest profile
is browser-specific: clearing cookies loses access. Email login, cross-device
recovery, real purchases, public matchmaking, more boards, and a ranked season
are future work, not represented as working features in this prototype.

Private room state is member-only. Request bodies never determine scores,
coins, trophy counts, ownership, or winners. Server transactions lock rooms and
profiles; action identifiers and match/round/start identifiers reject duplicate
or stale actions. Only a player's current memory pattern and next four climbing
arrows are exposed. The publicly loaded golf physics is intentional: it is the
same deterministic simulation the server uses. Browser automation remains a
possible skill-game cheat; this prototype is not suitable for cash competitions.

Ties are decided by minigame finish time where applicable, then party trophies
and total minigame points. Remaining ties run rooftop tiebreakers. An idle or
still-equal match ends as a draw after three tiebreakers rather than getting
stuck or assigning a fabricated winner.

## Validation

`node --test scripts/party.test.mjs` covers authoritative rules, phase/input
validation, hidden future information, four-player completion, HTTP auth/origin
checks, replay prevention, actual PostgreSQL serialization, duplicate rewards,
and concurrent outfit purchases.

`node scripts/party-browser.test.mjs` uses four independent browser sessions
against the production API handler and an isolated PGlite database. It covers
real room joins, readiness, all minigame controls, server state synchronization,
refresh recovery, earned coins, wardrobe, rematches, and a separate 1v1 duel. Test-only deadline
advancement shortens idle waits; scores are not injected in this browser flow.
It checks layouts at 320, 390, 768, 844 (landscape), 1280, and 1440 pixels, and
asserts that phone minigame controls fit alongside the visible scene. Screenshots go to the OS
temporary directory `boardwalk-party-qa`.

The existing build and protected-game validators remain mandatory and unchanged.
