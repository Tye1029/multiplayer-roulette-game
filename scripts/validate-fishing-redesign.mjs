import fs from "node:fs";

function assert(condition, message) {
  if (!condition) throw new Error(`Fishing redesign validation failed: ${message}`);
}

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../assets/fishing/fishing.css", import.meta.url), "utf8");
const controller = fs.readFileSync(new URL("../assets/fishing/fishing-controller.js", import.meta.url), "utf8");
const preview = fs.readFileSync(new URL("../games/multiplayer/fishing/preview.html", import.meta.url), "utf8");
const serverData = fs.readFileSync(new URL("../netlify/functions/_data.js", import.meta.url), "utf8");

assert(html.includes('/assets/fishing/fishing.css?v=fishing-mechanics-v6'), "versioned Fishing stylesheet is not loaded");
assert(html.includes('/assets/fishing/fishing-controller.js?v=fishing-mechanics-v6'), "shared Fishing controller is not loaded");
assert(html.includes('class="fishing-command-bar"'), "game-owned Fishing header is missing");
assert(html.includes('class="fishing-instructions" aria-label="How to play"'), "visible game instructions are missing");
assert(html.includes("Bigger ripple, bigger fish"), "ripple-size instruction is missing");
assert(html.includes("You only get one catch"), "one-catch rule is missing");
assert(html.includes("TOURNAMENT WEIGH-IN"), "Fishing-themed finish screen is missing");
assert(html.includes('class="fishing-result-card" data-fishing-result-card="1"'), "Fishing result card is not independently targetable");
assert(html.includes('<footer class="fishing-result-actions">'), "result actions do not own a dedicated footer");
assert(html.includes('class="fishing-log-thumb"'), "Fishing logbook thumbnails are missing");
assert(html.includes("const picture=duelFishSvg"), "logbook pictures are not species-aware fish art");
assert(html.includes('const FISHING_SPECIES=['), "the complete Fishing species catalog is missing");
assert(html.includes('fishing-log-entry locked'), "uncaught logbook species are not represented by locked entries");
assert(html.includes('fishing-log-question">?</span>'), "uncaught fish do not show question marks");
assert(!html.includes('<b>${totalWins}</b>Wins'), "the removed Wins logbook statistic is still rendered");
assert(html.includes('/assets/fishing/images/v2/fisherman-v2.png'), "PNG fisherman characters are missing");
assert(html.includes('/assets/fishing/images/v2/fisherman-blue-transparent-v3.png'), "distinct second PNG fisherman is missing");
assert(html.includes('/assets/fishing/images/v2/lake-bg-v2.png'), "PNG lake background is missing");
assert(html.includes('function duelFishingAlignLines(root)'), "responsive rod-line attachment is missing");
assert(html.includes('class="fishing-debug-panel"'), "Fishing debug panel is missing");
assert(html.includes('data-fishing-debug-copy>Copy Debug Report'), "copyable Fishing debug report is missing");
assert(html.includes('class="fishing-hook-node left"'), "connected left fishing rig is missing");
assert(html.includes('class="fishing-hook-node right"'), "connected right fishing rig is missing");
assert(html.includes('style="--fish-cm:${cm}"'), "fish art is not scaled from its measured centimeters");

assert(css.includes("grid-template-rows: auto minmax(0, 1fr) auto;"), "result card does not reserve a separate action row");
assert(css.includes(".fishing-result-content {"), "scrollable result content region is missing");
assert(css.includes("overflow-y: auto;"), "result details cannot scroll independently");
assert(css.includes(".fishing-result-actions {\n  position: relative;"), "result actions can still overlay result content");
assert(css.includes(".fishing-log-entry {\n  display: grid;"), "illustrated logbook entry layout is missing");
assert(css.includes("url('/assets/fishing/images/v2/logbook-v2.png')"), "fisherman's open-book background is missing");
assert(css.includes('@keyframes fishingCastLeft'), "cast animation is missing");
assert(css.includes('@keyframes fishingAnglerPull'), "pull animation is missing");
assert(css.includes('@keyframes fishingCloudTravel'), "moving cloud animation is missing");
assert(css.includes('@keyframes fishingLakeBreath'), "whole-water motion layer is missing");
assert(css.includes('@keyframes fishingAnglerIdleLeft'), "smooth fisherman idle animation is missing");
assert(css.includes('.fishing-water-canvas {'), "visible animated water canvas is missing");
assert(html.includes('class="fishing-water-motion"'), "whole-lake animated water layer is not mounted");
assert(preview.includes('class="fishing-water-motion"'), "preview is missing the whole-lake animated water layer");
assert(css.includes('transform: rotate(-1.2deg)'), "left dock does not extend inward from the screen edge");
assert(css.includes('transform: scaleX(-1) rotate(-1.2deg)'), "right dock is not mirrored toward the center");
assert(css.includes('.fishing-angler.left { left: 22%; }'), "left fisherman is not positioned on the inner dock end");
assert(css.includes('.fishing-angler.right { right: 22%;'), "right fisherman is not positioned on the inner dock end");
assert(css.includes('animation: fishingLakeBreath 12s'), "subtle whole-lake motion timing is missing");
assert(css.includes('stroke-width: 1.15'), "fishing line is not using the thin realistic treatment");
assert(css.includes('top: -11px'), "bobber is not seated directly against the caught fish");
assert(css.includes('display: none;\n  content: none;'), "obsolete bobber-to-fish connector is still visible");
assert(css.includes('@keyframes fishingFishHookSway'), "hooked fish sway is missing");
assert(css.includes('@keyframes fishingFishSway'), "fish sway animation is missing");
assert(css.includes('@keyframes fishingRareShimmer'), "rare fish shimmer is missing");
assert(serverData.includes('variant="silver";rarity="rare"'), "silver rare fish cannot be awarded");
assert(css.includes("@media (max-width: 680px)"), "mobile Fishing redesign rules are missing");
assert(preview.includes('data-preview-state="live"'), "live Fishing component preview is missing");
assert(preview.includes('data-preview-state="result"'), "result Fishing component preview is missing");
assert(preview.includes("if(replay)await controller.replayCast();else await controller.playCast();"), "preview does not cast before starting the round");
assert(preview.includes("startClock();timers.bite=setTimeout"), "preview countdown does not begin after casting");
assert(preview.includes("timers.bot=setTimeout"), "live preview bot does not fish");
assert(preview.includes("water.addEventListener('pointerdown'"), "live preview cannot pull a fish");
assert(preview.includes("if(!previewState.activeBite)"), "preview accepts catches without an active bite");
assert(preview.includes("previewState.playerCaught=false;previewState.botCaught=false"), "fresh rounds do not clear both catches");
assert(preview.includes('data-debug-copy'), "copyable preview debug report is missing");
assert(preview.includes('data-debug-cast'), "live preview debug controls are missing");

assert(controller.includes('class FishingSceneController'), "Fishing scene controller class is missing");
assert(controller.includes('playCast(options={})'), "shared casting lifecycle is missing");
assert(controller.includes('syncCatch(side,catchId,animate=false)'), "authoritative catch synchronization is missing");
assert(controller.includes('drawWater(now)'), "moving water renderer is missing");
assert(controller.includes('lineEnd:{x:round(ex),y:round(ey)}'), "line endpoint diagnostics are missing");
assert(controller.includes('async copyReport(extra={})'), "copyable diagnostic report implementation is missing");
assert(controller.includes('fishingDebugVersion:VERSION'), "diagnostic version marker is missing");

const imageRoot=new URL("../assets/fishing/images/v2/",import.meta.url);
for(const file of ["lake-bg-v2.png","dock-v2.png","fisherman-v2.png","fisherman-blue-transparent-v3.png","clouds-v2.png","logbook-v2.png","fish/giant-bluefin-tuna-v2.png","rare/golden-wide-v2.png","rare/crystal-wide-v2.png","rare/silver-wide-v2.png","rare/albino-hat-wide-v2.png"]){
  assert(fs.existsSync(new URL(file,imageRoot)),`required PNG asset is missing: ${file}`);
}
const regularFish=fs.readdirSync(new URL("fish/",imageRoot)).filter(name=>name.endsWith("-v2.png"));
assert(regularFish.length===36,`expected 36 unique regular fish PNGs, found ${regularFish.length}`);

console.log("Fishing mechanics validation passed: shared lifecycle controller, connected rod/line/hook/fish rigs, post-cast countdown, valid-bite input, delayed bot pull, moving water, copyable diagnostics, 36 PNG fish, and themed results are present.");
