# XAN DUELS

Competitive multiplayer games with shared Torn account verification, Xanax deposit detection, balances, withdrawals, lobbies, network bots, and rematches.

## Find a game

All six active games have an entry folder under **`games/multiplayer/`**:

| Game | Folder | Mode |
| --- | --- | --- |
| Russian Roulette | [roulette](games/multiplayer/roulette/SOURCE.md) | `roulette` |
| Draw | [draw](games/multiplayer/draw/SOURCE.md) | `draw` |
| Fishing Duel | [fishing](games/multiplayer/fishing/SOURCE.md) | `fishing` |
| Safe Cracker | [safe-cracker](games/multiplayer/safe-cracker/SOURCE.md) | `safecracker` |
| Summit Sprint | [mountain-race](games/multiplayer/mountain-race/SOURCE.md) | `mountainrace` |
| Blackjack Duel | [blackjack-duel](games/multiplayer/blackjack-duel/SOURCE.md) | `blackjackduel` |

`presentation.js` files hold the extracted game presentation functions. They share the established account/network runtime; the assembler inserts each function at its original position in one script, preserving declarations, overrides, and initialization order. They are source fragments, not standalone browser modules.

Existing external controllers and release-pinned artwork/audio remain under matching **`assets/<game>/`** directories. Their URLs are part of protected manifests and regression/reconstruction checks. Each game's `SOURCE.md` links to these dependencies. Do not delete or move them based on filenames or version numbers alone.

## Shared site and operations

- **`shared/site/index.template.html`**: account services, multiplayer shell, shared networking, and page markup/styles. Edit this source instead of generated `index.html`.
- **`shared/games/`**: game catalog and Fishing definitions.
- **`admin/`**: admin stylesheet and controller; `admin.html` remains the public entry URL.
- **`netlify/functions/`**: deployed API handlers, data access, deposit detection, authoritative state, and settlement. Game integration modules live in their matching backend folders where already separated.
- **`scripts/`**: assembly, public-site packaging, game validators, and retained reconstruction tools.
- **`docs/`**: architecture, cleanup evidence, and game rules.

## Build and validate

```sh
npm install
npm run build
npm run validate:protected-current
npm run validate:mountain-race
```

The build assembles the root `index.html`, applies the established runtime packaging, and writes **`dist/`**. Netlify publishes `dist/`, with functions bundled separately from `netlify/functions/`. Source templates, patch scripts, documentation, workflows, and dependencies are excluded from the public site. Existing public preview pages remain available.

The generated root entry remains committed for existing source-based validators and diagnostic workflows. After edits, rebuild it before committing. Historical patch/reconstruction scripts that write `index.html` must have their resulting changes reconciled into the template or game fragments before the next build.

Single-player Scratch purchasing, Street Runner, Horse Track, and Arcade player UI have been retired. Their standalone creation/play endpoints have been removed. Historical records, admin odds controls, and the old ticket-completion endpoint remain for account support and settlement of previously issued tickets. Shared multiplayer Scratch/legacy duel implementations remain because they are still registered and covered by multiplayer checks.
