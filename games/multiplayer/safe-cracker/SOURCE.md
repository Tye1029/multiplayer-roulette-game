# Safe Cracker

[presentation.js](presentation.js) contains game-owned presentation functions assembled in their original order.

Runtime assets: [assets/safe-cracker](../../../assets/safe-cracker).

The index page opens this mode in the shared account, lobby, networking, and rematch shell. Server entry point: [duel-action.js](../../../netlify/functions/duel-action.js).

Edit shared shell markup in [shared/site/index.template.html](../../../shared/site/index.template.html), then run npm run build. Do not edit generated root index.html. Existing asset URLs and protected release manifests remain stable.

The rotating dial plate uses `assets/safe-cracker/images/dial-reference-face.png`,
a lossless 640×640 raster of `textures/dial-reference-face-v7.svg`. Numerals,
selection, the hub, and rotation remain live. Keep that SVG: it is the editable
rebuild source and is checked by the dial-depth validator and historical patch
scripts. It is no longer loaded by the running game. To regenerate with Sharp:
`sharp(svgPath, {density:144}).resize(640,640).png().toFile(pngPath)`.
The PNG adds about 270 KB to the selected game's download; it avoids rotating
the vector plate at runtime. No new image generation or visual redesign occurred.

Copied Safe Cracker game reports include `frameDiagnostics` from dial drags of
at least 12 frames. This measures requestAnimationFrame delivery, not server
latency or hardware capability. Sampling stops on release, completion, hiding
the page, or after 240 frames; only six summaries are retained locally. There is
no idle sampling loop. Use repeated desktop/mobile comparisons: browser load
can change the result substantially. Unused on-disk files do not explain frame
rate by themselves; retain assets still referenced by runtime, rebuilds, or
protected validation.
