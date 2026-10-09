# Russian Roulette

[presentation.js](presentation.js) contains game-owned presentation functions assembled in their original order.

Runtime assets: [assets/roulette](../../../assets/roulette).

The index page opens this mode in the shared account, lobby, networking, and rematch shell. Server entry point: [duel-action.js](../../../netlify/functions/duel-action.js).

Edit shared shell markup in [shared/site/index.template.html](../../../shared/site/index.template.html), then run npm run build. Do not edit generated root index.html. Existing asset URLs and protected release manifests remain stable.

Roulette repair `roulette-repair-1` preloads scene images when this game is selected,
uses the existing transparent `workshop-lamp-image2.png` with its complete bulb,
and preserves the protected turn/recoil modules. The full reference `lamp-1.png`
was superseded and removed after checking runtime, admin, and validation references.
Other historical lamp cuts remain because older presentation/patch sources still
reference them. Calibration V10 starts from the fitted transparent-art geometry;
offsets saved for the old full photograph do not apply to this asset.

Run `node scripts/validate-roulette-repair.mjs` for isolated production-rule and
animation-guard tests. `node scripts/preview-roulette-repair.mjs` serves an optional
local desktop/mobile fixture at `http://127.0.0.1:8788/` with no account or wager.
