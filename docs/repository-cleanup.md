# Multiplayer organization and admin cleanup — 2026-10-09

## Changes

- Added one entry folder for each of the six active games under `games/multiplayer/`, with source/dependency links.
- Extracted 150 game presentation functions from the shared page into game-owned source fragments. The build restores each fragment at its original position, keeping shared lexical scope and execution order.
- Removed retired Scratch purchase/render/recovery UI, Street Runner, Horse Track, and single-player Arcade code and isolated obsolete style sections. Shared account verification, deposit checks, withdrawals, audio, multiplayer Scratch helpers, and active duel implementations remain.
- Removed five unused standalone single-player endpoints: `buy-ticket`, `record-bet`, `runner-action`, `horse-action`, and `arcade-action`. Tracked runtime, build, API/admin, and validation references were checked first. The backend account/deposit implementation was not edited.
- Removed 15 unreferenced root update-note files. Moved the Roulette chamber rules into `docs/games/`.
- Replaced the old admin styling with the XAN DUELS dark palette, responsive form/metric layouts, keyboard focus states, scrollable data tables, and section navigation. Extracted its existing script without changing the API actions. Historical odds and overrides remain in a collapsible section.
- Netlify now publishes an explicit `dist/` site bundle, excluding source templates, scripts, documentation, workflows, and dependency folders.

## Retained dependencies

Game media remains in the existing matching `assets/<game>/` folders because protected release checks, dynamically constructed paths, and reconstruction scripts still depend on these locations. In particular, Safe Cracker's exact release hashes and source recordings remain intact; no validation was weakened to permit cleanup. The prior [asset audit](site-asset-audit.md) explains the retained historical assets individually.

The account/admin backend still needs historical bet records, Scratch/Runner odds schemas, and settlement logic. `complete-ticket` remains available for previously issued tickets, while new Scratch purchasing is removed. The registered multiplayer modes, including older multiplayer Scratch/duel implementations, remain required by the multiplayer contract and regression checks.

Root `index.html` remains a generated compatibility artifact for existing diagnostics and is ignored by Git to avoid a duplicate source copy. The template and game source are authoritative. Build before running validators; diagnostic workflows already build first. Older patch scripts remain because workflows and validators depend on them; their presence is not a browser download. Existing public visual preview/calibration pages remain available.

## Verification notes

The current protected release build and targeted Summit Sprint checks pass. The older `validate:lamp` aggregate already fails against unchanged baseline audio because it requires the removed `countdownSynthAudioContext` signature. Other older Roulette validators also require superseded audio tokens/cache URLs. These checks were run, and their failures were preserved rather than weakening validation or rewriting the protected audio runtime. The current protected release validator covers the pinned Roulette files, complete Safe Cracker release, account/admin presence, multiplayer lifecycle, and lazy media behavior.

Browser checks use local fabricated admin records for the signed-in dashboard; no production balances, odds, withdrawals, or games are changed by the fixture checks. Unrelated uncommitted backend security files and package-script additions are excluded from this change.
