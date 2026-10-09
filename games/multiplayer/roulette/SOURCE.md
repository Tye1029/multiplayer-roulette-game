# Russian Roulette

[presentation.js](presentation.js) contains game-owned presentation functions assembled in their original order.

Runtime assets: [assets/roulette](../../../assets/roulette).

The index page opens this mode in the shared account, lobby, networking, and rematch shell. Server entry point: [duel-action.js](../../../netlify/functions/duel-action.js).

Edit shared shell markup in [shared/site/index.template.html](../../../shared/site/index.template.html), then run npm run build. Do not edit generated root index.html. Existing asset URLs and protected release manifests remain stable.

Scene release `rustic-v2` uses one pendulum clock for the chain, pendant, tabletop
pool and gun highlight. The gun highlight reads three rendered probe points to
invert its current plane, so illumination stays in world space through the
protected facing and recoil animations. Those two animation modules are unchanged.
The table and scene props survive polling updates. A fatal shot animates only the
authoritative loser's seated body, leaving the chair in place before results.
Calibration V11 starts from the new asset geometry; earlier offsets are obsolete.

New transparent PNGs under `assets/roulette/decor/`:
`rustic-pendant-v2.png`, `oval-table-v2.png`, `saloon-chair-v2.png` and
`seated-player-v2.png`. Together they transfer 582 KiB and preserve their aspect
ratios. They preload only for Roulette. Built-in imagegen created them from these
final prompt specifications: an isolated rusty steel pendant with short chain,
clean transparency and warm bulb; a complete oval aged walnut tabletop with sharp
grain and neutral lighting; a worn walnut/leather saloon chair facing inward;
and a matching seated clothed adult cropped at the chest, with trousers and boots,
separate from the chair. No backdrop or baked light cone.

Removed superseded lamp cuts, cropped chair images, old table texture and haze
images after checking direct/dynamic runtime paths, admin references, build and
validation dependencies. Removed 22 competing historical lighting style blocks.
Retained wall props, the reusable chain texture, result presentation and controls.

Run `node scripts/validate-roulette-repair.mjs` for isolated production-rule and
animation-guard tests and `node scripts/validate-roulette-scene.mjs` for projection,
alpha and media budgets. Both run in the protected baseline build.
`node scripts/preview-roulette-repair.mjs` serves a local desktop/mobile fixture
at `http://127.0.0.1:8788/` with production presentation/decor and no account or wager.
Its optional `?base=https://deploy-preview-20--famous-piroshki-b621da.netlify.app/`
loads the shipped presentation/styles/assets against the local production rules.
