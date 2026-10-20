import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const runtimeUrl = new URL('assets/mountain-race/mountain-race-multiplayer.js', root);
const prototypeUrl = new URL('assets/mountain-race/mountain-race.js', root);
const cssUrl = new URL('assets/mountain-race/mountain-race.css', root);
const indexUrl = new URL('index.html', root);
const previewUrl = new URL('mountain-race-preview.html', root);
const marker = 'MOUNTAIN_RACE_CONTINUOUS_SUMMIT_V59';

function required(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Summit Sprint V59 could not find ${label}.`);
  return source.replace(before, after);
}

let [runtime, prototype, css, html, preview] = await Promise.all([
  readFile(runtimeUrl, 'utf8'), readFile(prototypeUrl, 'utf8'), readFile(cssUrl, 'utf8'),
  readFile(indexUrl, 'utf8'), readFile(previewUrl, 'utf8')
]);

for (const source of [runtime, prototype]) {
  if (!source.includes('MOUNTAIN_RACE_SUMMIT_SKY_V58')) {
    throw new Error('Summit Sprint V59 requires the V58 summit-sky baseline first.');
  }
}

function updateRuntime(source, prototypeMode) {
  source = required(
    source,
    "    root.dataset.mrSummitSky = '58';\n    // MOUNTAIN_RACE_SUMMIT_SKY_V58",
    "    root.dataset.mrSummitSky = '58';\n    root.dataset.mrContinuousSummit = '59';\n    // MOUNTAIN_RACE_CONTINUOUS_SUMMIT_V59\n    // MOUNTAIN_RACE_SUMMIT_SKY_V58",
    `${prototypeMode ? 'prototype' : 'multiplayer'} V59 dataset`
  );

  const cameraLine = prototypeMode
    ? "      const cameraIndex = player.animation === 'celebrate' ? total : Math.max(0, Math.min(total, player.promptIndex));"
    : "      const cameraIndex = animation === 'celebrate' ? total : Math.max(0, Math.min(total, p.promptIndex));";
  const revealBlock = `${cameraLine}\n      const summitReveal = Math.max(0, Math.min(1, (cameraIndex - Math.max(0, total - 5)) / 5));\n      const summitBottom = 196 + Math.max(0, total - 1) * 74;`;
  source = required(source, cameraLine, revealBlock, `${prototypeMode ? 'prototype' : 'multiplayer'} summit approach progress`);

  const laneBefore = prototypeMode
    ? '<section class="mr-lane ${playerKey} ${summitView ? \'summit-view\' : \'cliff-view\'}" data-mr-lane-view="${summitView ? \'summit\' : \'cliff\'}" data-mr-camera-index="${cameraIndex}" aria-label="${escapeHtml(player.name)} climbing lane">'
    : '<section class="mr-lane ${side} ${summitView ? \'summit-view\' : \'cliff-view\'}" data-mr-lane-view="${summitView ? \'summit\' : \'cliff\'}" data-mr-camera-index="${cameraIndex}" aria-label="${escapeHtml(p.name)} climbing lane">';
  const laneAfter = prototypeMode
    ? '<section class="mr-lane ${playerKey} continuous-mountain ${summitReveal > 0 ? \'summit-approach\' : \'\'} ${summitView ? \'summit-view\' : \'cliff-view\'}" data-mr-lane-view="${summitView ? \'summit\' : summitReveal > 0 ? \'summit-approach\' : \'cliff\'}" data-mr-summit-reveal="${summitReveal.toFixed(2)}" data-mr-camera-index="${cameraIndex}" aria-label="${escapeHtml(player.name)} climbing lane">'
    : '<section class="mr-lane ${side} continuous-mountain ${summitReveal > 0 ? \'summit-approach\' : \'\'} ${summitView ? \'summit-view\' : \'cliff-view\'}" data-mr-lane-view="${summitView ? \'summit\' : summitReveal > 0 ? \'summit-approach\' : \'cliff\'}" data-mr-summit-reveal="${summitReveal.toFixed(2)}" data-mr-camera-index="${cameraIndex}" aria-label="${escapeHtml(p.name)} climbing lane">';
  source = required(source, laneBefore, laneAfter, `${prototypeMode ? 'prototype' : 'multiplayer'} continuous lane class`);

  source = required(
    source,
    '--mr-wall-scroll:${scroll}px;--mr-wall-height:${Math.max(2600, 580 + total * 74)}px',
    '--mr-wall-scroll:${scroll}px;--mr-wall-height:${Math.max(2600, 580 + total * 74)}px;--mr-summit-bottom:${summitBottom}px;--mr-summit-reveal:${summitReveal}',
    `${prototypeMode ? 'prototype' : 'multiplayer'} fixed summit world coordinate`
  );
  return source;
}

if (!runtime.includes(marker)) runtime = updateRuntime(runtime, false);
if (!prototype.includes(marker)) prototype = updateRuntime(prototype, true);

if (!css.includes(marker)) css += String.raw`

/* MOUNTAIN_RACE_CONTINUOUS_SUMMIT_V59
   The cliff, summit peak, and sky share one moving world. The cliff terminates
   beneath hold 24, so the last five camera steps progressively reveal the sky
   and peak. HUD cards overlay that same moving lane instead of sampling a
   second cliff image, and shell gaps no longer expose unrelated terrain. */
[data-mountain-race-mount][data-mr-continuous-summit="59"],
[data-mountain-race-mount][data-mr-continuous-summit="59"] .mountain-race-game,
[data-mountain-race-mount][data-mr-continuous-summit="59"] .mr-race-stage,
[data-mountain-race-mount][data-mr-continuous-summit="59"] .mr-climb-viewport {
  background-color: #77b9e6 !important;
  background-image: url('/assets/mountain-race/images/summit-sprint-alpine-sky-v58.png') !important;
  background-position: center center !important;
  background-size: cover !important;
  background-repeat: no-repeat !important;
}
[data-mountain-race-mount][data-mr-continuous-summit="59"] .mr-titlebar {
  margin-bottom: 0 !important;
  background: rgba(4,22,35,.92) !important;
}
[data-mountain-race-mount][data-mr-continuous-summit="59"] .mr-race-stage {
  margin-top: 0 !important;
  gap: 0 !important;
}
[data-mountain-race-mount][data-mr-continuous-summit="59"] .mr-lane.continuous-mountain {
  display: grid !important;
  grid-template: 1fr / 1fr !important;
  overflow: hidden !important;
  background: transparent !important;
}
[data-mountain-race-mount][data-mr-continuous-summit="59"] .mr-lane.continuous-mountain .mr-player-card,
[data-mountain-race-mount][data-mr-continuous-summit="59"] .mr-lane.continuous-mountain .mr-climb-viewport {
  grid-area: 1 / 1 !important;
}
[data-mountain-race-mount][data-mr-continuous-summit="59"] .mr-lane.continuous-mountain .mr-player-card {
  position: relative !important;
  z-index: 40 !important;
  align-self: start !important;
  margin: 0 !important;
  background: linear-gradient(180deg, rgba(4,22,35,.82), rgba(4,22,35,.92)) !important;
  box-shadow: inset 0 -1px rgba(157,211,235,.2) !important;
}
[data-mountain-race-mount][data-mr-continuous-summit="59"] .mr-lane.continuous-mountain .mr-climb-viewport,
[data-mountain-race-mount][data-mr-continuous-summit="59"] .mr-lane.continuous-mountain.cliff-view.me .mr-climb-viewport,
[data-mountain-race-mount][data-mr-continuous-summit="59"] .mr-lane.continuous-mountain.cliff-view.opponent .mr-climb-viewport,
[data-mountain-race-mount][data-mr-continuous-summit="59"] .mr-lane.continuous-mountain.summit-view .mr-climb-viewport {
  height: calc(clamp(520px, 58vh, 590px) + 48px) !important;
  background-color: #78bce9 !important;
  background-image: url('/assets/mountain-race/images/summit-sprint-alpine-sky-v58.png') !important;
  background-position: center center !important;
  background-size: cover !important;
}
[data-mountain-race-mount][data-mr-continuous-summit="59"] .mr-lane.continuous-mountain .mr-v44-cliff,
[data-mountain-race-mount][data-mr-continuous-summit="59"] .mr-lane.continuous-mountain.summit-view .mr-v44-cliff {
  top: auto !important;
  right: 0 !important;
  bottom: -38px !important;
  left: 0 !important;
  display: block !important;
  height: calc(var(--mr-summit-bottom) + 120px) !important;
  background-size: auto calc(var(--mr-wall-height) + 94px) !important;
  background-position: left bottom !important;
  background-repeat: no-repeat !important;
}
[data-mountain-race-mount][data-mr-continuous-summit="59"] .mr-lane.continuous-mountain.opponent .mr-v44-cliff {
  background-position: right bottom !important;
  transform: none !important;
}
[data-mountain-race-mount][data-mr-continuous-summit="59"] .mr-lane.continuous-mountain .mr-finish-ledge.mr-summit-plateau {
  z-index: 7 !important;
}
[data-mountain-race-mount][data-mr-continuous-summit="59"] .mr-command-deck {
  margin-top: 0 !important;
  background: rgba(4,22,35,.94) !important;
}
@media (max-width: 620px) {
  [data-mountain-race-mount][data-mr-continuous-summit="59"] .mr-lane.continuous-mountain .mr-climb-viewport,
  [data-mountain-race-mount][data-mr-continuous-summit="59"] .mr-lane.continuous-mountain.cliff-view.me .mr-climb-viewport,
  [data-mountain-race-mount][data-mr-continuous-summit="59"] .mr-lane.continuous-mountain.cliff-view.opponent .mr-climb-viewport,
  [data-mountain-race-mount][data-mr-continuous-summit="59"] .mr-lane.continuous-mountain.summit-view .mr-climb-viewport {
    height: calc(clamp(500px, 61vh, 530px) + 43px) !important;
  }
}

/* Lock V59 above the highly specific legacy terrain selectors. */
[data-mountain-race-mount][data-mr-natural-terrain="49"][data-mr-grounded-ascent="54"][data-mr-summit-sky="58"][data-mr-continuous-summit="59"],
[data-mountain-race-mount][data-mr-natural-terrain="49"][data-mr-grounded-ascent="54"][data-mr-summit-sky="58"][data-mr-continuous-summit="59"] .mountain-race-game,
[data-mountain-race-mount][data-mr-natural-terrain="49"][data-mr-grounded-ascent="54"][data-mr-summit-sky="58"][data-mr-continuous-summit="59"] .mr-race-stage,
[data-mountain-race-mount][data-mr-natural-terrain="49"][data-mr-grounded-ascent="54"][data-mr-summit-sky="58"][data-mr-continuous-summit="59"] .mr-climb-viewport {
  background-color: #77b9e6 !important;
  background-image: url('/assets/mountain-race/images/summit-sprint-alpine-sky-v58.png') !important;
  background-position: center center !important;
  background-size: cover !important;
  background-repeat: no-repeat !important;
}
[data-mountain-race-mount][data-mr-natural-terrain="49"][data-mr-grounded-ascent="54"][data-mr-summit-sky="58"][data-mr-continuous-summit="59"] .mr-lane.continuous-mountain .mr-player-card {
  background: linear-gradient(180deg, rgba(4,22,35,.82), rgba(4,22,35,.92)) !important;
}
[data-mountain-race-mount][data-mr-natural-terrain="49"][data-mr-grounded-ascent="54"][data-mr-summit-sky="58"][data-mr-continuous-summit="59"] .mr-v44-cliff,
[data-mountain-race-mount][data-mr-natural-terrain="49"][data-mr-grounded-ascent="54"][data-mr-summit-sky="58"][data-mr-continuous-summit="59"] .mr-lane.summit-view .mr-v44-cliff {
  inset: auto 0 -38px !important;
  display: block !important;
  height: calc(var(--mr-summit-bottom) + 120px) !important;
  background: url('/assets/mountain-race/images/summit-sprint-natural-cliff-v49.png') left bottom / auto calc(var(--mr-wall-height) + 94px) no-repeat !important;
}
[data-mountain-race-mount][data-mr-natural-terrain="49"][data-mr-grounded-ascent="54"][data-mr-summit-sky="58"][data-mr-continuous-summit="59"] .mr-lane.opponent .mr-v44-cliff {
  background-position: right bottom !important;
  transform: none !important;
}
[data-mountain-race-mount][data-mr-natural-terrain="49"][data-mr-grounded-ascent="54"][data-mr-summit-sky="58"][data-mr-continuous-summit="59"] .mr-finish-ledge.mr-summit-plateau {
  opacity: var(--mr-summit-reveal) !important;
}
[data-mountain-race-mount][data-mr-natural-terrain="49"][data-mr-grounded-ascent="54"][data-mr-summit-sky="58"][data-mr-continuous-summit="59"] .mr-command-deck {
  width: calc(100% - 24px) !important;
  max-width: none !important;
  margin-inline: auto !important;
}
`;

function updateDocument(source) {
  source = source.replace(/&continuous=\d+/g, '');
  source = source.replace(/(&visual=58)/g, '$1&continuous=59');
  return source;
}

html = updateDocument(html);
preview = updateDocument(preview);

await Promise.all([
  writeFile(runtimeUrl, runtime), writeFile(prototypeUrl, prototype), writeFile(cssUrl, css),
  writeFile(indexUrl, html), writeFile(previewUrl, preview)
]);

console.log('Applied Summit Sprint V59 continuous summit world, progressive sky reveal, and same-scene HUD overlays.');
