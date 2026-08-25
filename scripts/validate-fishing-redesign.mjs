import fs from "node:fs";

function assert(condition, message) {
  if (!condition) throw new Error(`Fishing redesign validation failed: ${message}`);
}

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../assets/fishing/fishing.css", import.meta.url), "utf8");
const preview = fs.readFileSync(new URL("../games/multiplayer/fishing/preview.html", import.meta.url), "utf8");
const serverData = fs.readFileSync(new URL("../netlify/functions/_data.js", import.meta.url), "utf8");

assert(html.includes('/assets/fishing/fishing.css?v=fishing-art-v2'), "versioned Fishing stylesheet is not loaded");
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
assert(html.includes('/assets/fishing/images/v2/lake-bg-v2.png'), "PNG lake background is missing");
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
assert(css.includes('@keyframes fishingFishSway'), "fish sway animation is missing");
assert(css.includes('@keyframes fishingRareShimmer'), "rare fish shimmer is missing");
assert(serverData.includes('variant="silver";rarity="rare"'), "silver rare fish cannot be awarded");
assert(css.includes("@media (max-width: 680px)"), "mobile Fishing redesign rules are missing");
assert(preview.includes('data-preview-state="live"'), "live Fishing component preview is missing");
assert(preview.includes('data-preview-state="result"'), "result Fishing component preview is missing");

const imageRoot=new URL("../assets/fishing/images/v2/",import.meta.url);
for(const file of ["lake-bg-v2.png","dock-v2.png","fisherman-v2.png","clouds-v2.png","logbook-v2.png","fish/giant-bluefin-tuna-v2.png","rare/golden-wide-v2.png","rare/crystal-wide-v2.png","rare/silver-wide-v2.png","rare/albino-hat-wide-v2.png"]){
  assert(fs.existsSync(new URL(file,imageRoot)),`required PNG asset is missing: ${file}`);
}
const regularFish=fs.readdirSync(new URL("fish/",imageRoot)).filter(name=>name.endsWith("-v2.png"));
assert(regularFish.length===36,`expected 36 unique regular fish PNGs, found ${regularFish.length}`);

console.log("Fishing redesign validation passed: 36 PNG fish, fishermen, cast/pull motion, moving clouds, proportional measurements, question-mark logbook, themed weigh-in, and non-overlapping actions are present.");
