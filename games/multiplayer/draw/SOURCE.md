# Draw

[presentation.js](presentation.js) contains game-owned presentation functions assembled in their original order.

Runtime assets: the root WAV effects under [assets](../../../assets) and [Western theme](../../../assets/draw-western-theme.mp3).

The index page opens this mode in the shared account, lobby, networking, and rematch shell. Server entry point: [duel-action.js](../../../netlify/functions/duel-action.js).

Edit shared shell markup in [shared/site/index.template.html](../../../shared/site/index.template.html), then run npm run build. Do not edit generated root index.html. Existing asset URLs and protected release manifests remain stable.
