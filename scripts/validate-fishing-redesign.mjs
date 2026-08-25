import fs from "node:fs";

function assert(condition, message) {
  if (!condition) throw new Error(`Fishing redesign validation failed: ${message}`);
}

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../assets/fishing/fishing.css", import.meta.url), "utf8");
const preview = fs.readFileSync(new URL("../games/multiplayer/fishing/preview.html", import.meta.url), "utf8");

assert(html.includes('/assets/fishing/fishing.css?v=fishing-redesign-v1'), "versioned Fishing stylesheet is not loaded");
assert(html.includes('class="fishing-command-bar"'), "game-owned Fishing header is missing");
assert(html.includes('class="fishing-instructions" aria-label="How to play"'), "visible game instructions are missing");
assert(html.includes("Bigger ripple, bigger fish"), "ripple-size instruction is missing");
assert(html.includes("You only get one catch"), "one-catch rule is missing");
assert(html.includes("TOURNAMENT WEIGH-IN"), "Fishing-themed finish screen is missing");
assert(html.includes('class="fishing-result-card" data-fishing-result-card="1"'), "Fishing result card is not independently targetable");
assert(html.includes('<footer class="fishing-result-actions">'), "result actions do not own a dedicated footer");
assert(html.includes('class="fishing-log-thumb"'), "Fishing logbook thumbnails are missing");
assert(html.includes("const picture=duelFishSvg"), "logbook pictures are not species-aware fish art");

assert(css.includes("grid-template-rows: auto minmax(0, 1fr) auto;"), "result card does not reserve a separate action row");
assert(css.includes(".fishing-result-content {"), "scrollable result content region is missing");
assert(css.includes("overflow-y: auto;"), "result details cannot scroll independently");
assert(css.includes(".fishing-result-actions {\n  position: relative;"), "result actions can still overlay result content");
assert(css.includes(".fishing-log-entry {\n  display: grid;"), "illustrated logbook entry layout is missing");
assert(css.includes("@media (max-width: 680px)"), "mobile Fishing redesign rules are missing");
assert(preview.includes('data-preview-state="live"'), "live Fishing component preview is missing");
assert(preview.includes('data-preview-state="result"'), "result Fishing component preview is missing");

console.log("Fishing redesign validation passed: clear instructions, illustrated logbook, themed weigh-in result, and non-overlapping result actions are present.");
