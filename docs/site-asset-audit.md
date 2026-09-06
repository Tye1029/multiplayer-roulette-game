# Site asset audit — 2026-09-06

The review started from `594d7af` on `mountain-race-development`. It covered tracked assets, runtime HTML/CSS/JavaScript, shared game catalogs, preview pages, Netlify configuration, build scripts, validators, and the Safe Cracker release manifest. Filename matches were checked against dynamic URL construction before choosing removals. Unrelated working-tree changes were excluded.

## Removed assets

These files had no references in tracked runtime, preview, build, manifest, or validator source. The seven audio copies were also confirmed byte-identical to the retained names by SHA-256 before deletion.

| Group | Files | Bytes removed |
| --- | ---: | ---: |
| Unused coin animation and alternate faces | 3 | 9,152,528 |
| Duplicate Roulette MP3 copies | 7 | 874,638 |
| Superseded Safe Cracker PNGs and their prompts | 8 | 10,760,833 |
| Unused Safe Cracker dial SVG versions | 3 | 50,128 |
| Total | 21 | 20,838,127 |

The exact files were:

- `assets/coin-flip.gif`
- `assets/coin-heads.png`
- `assets/coin-tails.png`
- `assets/roulette/audio/freesound_community-chain-6073 (1).mp3`
- `assets/roulette/audio/freesound_community-cocking-a-revolver-6279 (1).mp3`
- `assets/roulette/audio/freesound_community-pistol-hammer-cocking-back-4-39887 (1).mp3`
- `assets/roulette/audio/freesound_community-revolver-chamber-spin-ratchet-sound-90521 (1).mp3`
- `assets/roulette/audio/freesound_community-revolver-spin-96947 (1).mp3`
- `assets/roulette/audio/freesound_community-single-pistol-gunshot-33-37187 (1).mp3`
- `assets/roulette/audio/spinopel-dry-fire-gun-364844 (1).mp3`

Removing unrequested files reduces the published file set. It does not, by itself, reduce a page's transferred bytes: the browser only downloads referenced/requested resources. Loading improvements should therefore be measured separately from repository size savings.

## Loading improvements

- Ten Summit Sprint images previously preloaded at high priority on every visit: **15,949,754 bytes**. They now preload once when Summit is selected, directly linked, or restored, before its Ready board mounts.
- Draw's **2,154,161-byte** music track now receives a source and preloads when Draw is selected. Silent music no longer starts a pointless fade animation on unrelated game updates.
- Safe Cracker's sample banks now warm on Safe selection or restored state; unrelated page interactions do not allocate its audio context or request its recordings. Its gesture unlock, decoded-buffer cache, and mechanical cues remain intact.
- Roulette's 19 sound templates, reaction chunks, and silent result-audio priming now activate for Roulette only. An unrelated first click no longer consumes its gesture unlock, so a later Roulette visit can still unlock sound correctly. The 11.4 MB library includes tracks that browsers may previously have fetched only as metadata, so that full size is not counted as a measured transfer saving.
- The Summit and Draw changes alone remove **18,103,915 bytes** of unnecessary cold-start media requests from a Safe Cracker visit. This is an asset-byte calculation, not a claim of an identical wall-clock improvement on every connection.
- No service worker or application-cache mechanism was found in the current entry point, admin page, or runtime assets. The current loading problem came from eager media requests, not evidence of an old offline cache.
- Collapsed Roulette and Remote Bot debug panels no longer rewrite their hidden DOM every 500–700 ms. Diagnostic collection and copied snapshots remain current; expanded panels populate immediately. No abandoned single-player animation loop was found starting at boot.

## Safe Cracker cleanup completed

The accepted room is `bank-vault-wall-v5.png`; the accepted door material is `safe-steel-surface-v3.png`. Four earlier PNGs total **10,755,520 bytes**:

- `bank-vault-v1.png`: no runtime use; release manifest and image-provenance reference only.
- `bank-vault-slate-v4.png`: earlier CSS background declarations are overridden by the wall-v5 rules.
- `safe-steel-surface-v1.png`: earlier CSS material declaration is overridden by surface-v3.
- `safe-steel-surface-v2.png`: no runtime use; release manifest and image-provenance reference only.

Removed these four PNGs, their obsolete CSS declarations, corresponding release-manifest entries, and their four prompt files. References in retained prompt files describe provenance, not runtime dependencies. The accepted room and metal textures remain unchanged.

Removed the unused `textures/dial-reference-face.svg`, `textures/dial-reference-face-v5.svg`, and `textures/dial-reference-face-v6.svg`, totaling **50,128 bytes**. Only v7 is used by the current dial, patch scripts, and validators.

## Dependencies deliberately retained

- Fishing sprite filenames are constructed from species slugs and rare-item identifiers in `shared/games/fishing-catalog.js`. Most valid sprites have no literal full-path reference. Both regular and rare sprite directories remain required.
- Roulette revolver artwork is requested by `assets/roulette/revolver-${revolverModel}.png` and its `-hammer.png` partner. Both steel/walnut images remain required despite absent literal full-filename references.
- `coin-front.png`, `coin-back.png`, and `coin-flip.webp` still appear in the legacy coin renderer. Removing these requires retiring that renderer and its callers together; they are not classed as unused solely because its old navigation was removed.
- Safe Cracker `audio-data-v4` PCM chunks are read by `validate-safe-cracker-dial-sample-v18.mjs`, which is part of the protected build checks. The v3 source note is also validated. Historical chunks are not all browser downloads.
- Safe Cracker v13 source chunks are inputs to `rebuild-safe-cracker-recorded-singles.mjs`; other historical audio/patch inputs remain until the corresponding reconstruction workflow is replaced explicitly.
- Fishing `lake-bg-v2.png` and Blackjack `chip-stack.png` / `casino-chip-pile.png` remain required by existing game validators. No validators were removed or weakened to allow cleanup.
- Summit Sprint includes an active V68 visual-review page, source art, coordinate CSS, and historical reconstruction assets. The preview links and current V65/earlier source dependencies were checked; files were not deleted based only on version numbers or lack of a literal image-path match.
- Historical patch scripts are not the page's startup scripts. `npm run build` invokes `inject-lamp-assets.mjs` and the current validation chain; it does not replay every patch file in `scripts/`. Keeping source reconstruction and regression files does not make the browser fetch them.

## API, admin, and deployment scope

`netlify.toml` publishes the repository root and serves functions from `netlify/functions`. `admin.html` calls the existing `admin-odds`, `admin-users`, `admin-multiplayer`, and `admin-adjust` endpoints. No backend, admin page, API support file, gameplay source, or validator was removed by the asset cleanup.

The public entry point, game previews, and calibration page were included when checking references. A file may be used by a preview even when the main launcher does not load it. Subsequent cleanup should check these roots, dynamic URLs, stylesheets, manifests, build inputs, and validators before removing files; then verify the affected browser flows and production build.
