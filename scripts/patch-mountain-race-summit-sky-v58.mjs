import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const runtimeUrl = new URL('assets/mountain-race/mountain-race-multiplayer.js', root);
const prototypeUrl = new URL('assets/mountain-race/mountain-race.js', root);
const cssUrl = new URL('assets/mountain-race/mountain-race.css', root);
const indexUrl = new URL('index.html', root);
const previewUrl = new URL('mountain-race-preview.html', root);
const marker = 'MOUNTAIN_RACE_SUMMIT_SKY_V58';

function required(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Summit Sprint V58 could not find ${label}.`);
  return source.replace(before, after);
}

let [runtime, prototype, css, html, preview] = await Promise.all([
  readFile(runtimeUrl, 'utf8'), readFile(prototypeUrl, 'utf8'), readFile(cssUrl, 'utf8'),
  readFile(indexUrl, 'utf8'), readFile(previewUrl, 'utf8')
]);

for (const source of [runtime, prototype]) {
  if (!source.includes('MOUNTAIN_RACE_CELEBRATION_CONTACT_V57')) {
    throw new Error('Summit Sprint V58 requires the V57 celebration-contact baseline first.');
  }
}

function updateRuntime(source, prototypeMode) {
  source = required(
    source,
    "    root.dataset.mrCelebrationContact = '57';\n    // MOUNTAIN_RACE_CELEBRATION_CONTACT_V57",
    "    root.dataset.mrCelebrationContact = '57';\n    root.dataset.mrSummitSky = '58';\n    // MOUNTAIN_RACE_SUMMIT_SKY_V58\n    // MOUNTAIN_RACE_CELEBRATION_CONTACT_V57",
    `${prototypeMode ? 'prototype' : 'multiplayer'} V58 dataset`
  );

  const cameraLine = prototypeMode
    ? "      const cameraIndex = player.animation === 'celebrate' ? total : Math.max(0, Math.min(total, player.promptIndex));"
    : "      const cameraIndex = animation === 'celebrate' ? total : Math.max(0, Math.min(total, p.promptIndex));";
  const summitLine = prototypeMode
    ? "      const summitView = player.animation === 'celebrate' || Boolean(player.finishedAt) || player.promptIndex >= total;"
    : "      const summitView = animation === 'celebrate' || Boolean(p.finishedAt) || p.promptIndex >= total;";
  source = required(source, cameraLine, `${summitLine}\n${cameraLine}`, `${prototypeMode ? 'prototype' : 'multiplayer'} independent lane view state`);

  const laneBefore = prototypeMode
    ? '<section class="mr-lane ${playerKey}" aria-label="${escapeHtml(player.name)} climbing lane">'
    : '<section class="mr-lane ${side}" aria-label="${escapeHtml(p.name)} climbing lane">';
  const laneAfter = prototypeMode
    ? '<section class="mr-lane ${playerKey} ${summitView ? \'summit-view\' : \'cliff-view\'}" data-mr-lane-view="${summitView ? \'summit\' : \'cliff\'}" data-mr-camera-index="${cameraIndex}" aria-label="${escapeHtml(player.name)} climbing lane">'
    : '<section class="mr-lane ${side} ${summitView ? \'summit-view\' : \'cliff-view\'}" data-mr-lane-view="${summitView ? \'summit\' : \'cliff\'}" data-mr-camera-index="${cameraIndex}" aria-label="${escapeHtml(p.name)} climbing lane">';
  return required(source, laneBefore, laneAfter, `${prototypeMode ? 'prototype' : 'multiplayer'} lane view class`);
}

if (!runtime.includes(marker)) runtime = updateRuntime(runtime, false);
if (!prototype.includes(marker)) prototype = updateRuntime(prototype, true);

if (!css.includes(marker)) css += String.raw`

/* MOUNTAIN_RACE_SUMMIT_SKY_V58
   The site shell is open alpine sky instead of a stretched cliff gutter. Each
   lane independently keeps its moving cliff until that player reaches hold 24,
   then reveals sky behind the natural summit with no rock wall above the peak. */
[data-mountain-race-mount][data-mr-summit-sky="58"],
[data-mountain-race-mount][data-mr-summit-sky="58"] .mountain-race-game,
[data-mountain-race-mount][data-mr-summit-sky="58"] .mr-race-stage {
  background-color: #77b9e6 !important;
  background-image: url('/assets/mountain-race/images/summit-sprint-alpine-sky-v58.png') !important;
  background-position: center center !important;
  background-size: cover !important;
  background-repeat: no-repeat !important;
}
[data-mountain-race-mount][data-mr-summit-sky="58"] .mountain-race-game,
[data-mountain-race-mount][data-mr-summit-sky="58"] .mr-race-stage,
[data-mountain-race-mount][data-mr-summit-sky="58"] .mr-lane,
[data-mountain-race-mount][data-mr-summit-sky="58"] .mr-climb-viewport {
  clip-path: none !important;
}
[data-mountain-race-mount][data-mr-summit-sky="58"] .mountain-race-game::before,
[data-mountain-race-mount][data-mr-summit-sky="58"] .mountain-race-game::after,
[data-mountain-race-mount][data-mr-summit-sky="58"] .mr-race-stage::before,
[data-mountain-race-mount][data-mr-summit-sky="58"] .mr-race-stage::after {
  content: none !important;
  display: none !important;
}
[data-mountain-race-mount][data-mr-summit-sky="58"] .mr-race-stage {
  gap: 0 !important;
  overflow: visible !important;
}
[data-mountain-race-mount][data-mr-summit-sky="58"] .mr-lane {
  border: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
}
[data-mountain-race-mount][data-mr-summit-sky="58"] .mr-climb-viewport {
  border: 0 !important;
  border-radius: 0 !important;
  background-color: #77b9e6 !important;
  background-image: url('/assets/mountain-race/images/summit-sprint-alpine-sky-v58.png') !important;
  background-position: center center !important;
  background-size: cover !important;
  background-repeat: no-repeat !important;
  box-shadow: none !important;
}
[data-mountain-race-mount][data-mr-summit-sky="58"] .mr-lane.cliff-view.me .mr-climb-viewport {
  background-image: url('/assets/mountain-race/images/summit-sprint-natural-cliff-v49.png') !important;
  background-position: left center !important;
  background-size: auto 100% !important;
}
[data-mountain-race-mount][data-mr-summit-sky="58"] .mr-lane.cliff-view.opponent .mr-climb-viewport {
  background-image: url('/assets/mountain-race/images/summit-sprint-natural-cliff-v49.png') !important;
  background-position: right center !important;
  background-size: auto 100% !important;
}
[data-mountain-race-mount][data-mr-summit-sky="58"] .mr-player-card {
  border-radius: 0 !important;
  box-shadow: inset 0 -1px rgba(157,211,235,.2) !important;
}
[data-mountain-race-mount][data-mr-summit-sky="58"] .mr-lane.cliff-view.me .mr-player-card {
  background:
    linear-gradient(rgba(4,23,35,.84), rgba(4,23,35,.9)),
    url('/assets/mountain-race/images/summit-sprint-natural-cliff-v49.png') left 48% / auto 720px no-repeat !important;
}
[data-mountain-race-mount][data-mr-summit-sky="58"] .mr-lane.cliff-view.opponent .mr-player-card {
  background:
    linear-gradient(rgba(4,23,35,.84), rgba(4,23,35,.9)),
    url('/assets/mountain-race/images/summit-sprint-natural-cliff-v49.png') right 48% / auto 720px no-repeat !important;
}
[data-mountain-race-mount][data-mr-summit-sky="58"] .mr-lane.summit-view .mr-player-card {
  background:
    linear-gradient(rgba(4,23,35,.82), rgba(4,23,35,.9)),
    url('/assets/mountain-race/images/summit-sprint-alpine-sky-v58.png') center 38% / cover no-repeat !important;
}
[data-mountain-race-mount][data-mr-summit-sky="58"] .mr-lane.summit-view .mr-mountain-wall {
  background: transparent !important;
}
[data-mountain-race-mount][data-mr-summit-sky="58"] .mr-lane.summit-view .mr-v44-cliff,
[data-mountain-race-mount][data-mr-summit-sky="58"] .mr-lane.summit-view .mr-v44-start,
[data-mountain-race-mount][data-mr-summit-sky="58"] .mr-lane.summit-view .mr-rock-hold {
  display: none !important;
}
[data-mountain-race-mount][data-mr-summit-sky="58"] .mr-lane.summit-view .mr-climb-viewport {
  background-color: #78bce9 !important;
  background-image: url('/assets/mountain-race/images/summit-sprint-alpine-sky-v58.png') !important;
  background-position: center center !important;
  background-size: cover !important;
}
[data-mountain-race-mount][data-mr-summit-sky="58"] .mr-lane.summit-view .mr-finish-ledge.mr-summit-plateau {
  filter: drop-shadow(0 9px 7px rgba(17,25,28,.32)) !important;
}
[data-mountain-race-mount][data-mr-summit-sky="58"] .mr-climber.finished,
[data-mountain-race-mount][data-mr-summit-sky="58"] .mr-climber.standing-on-summit,
[data-mountain-race-mount][data-mr-summit-sky="58"] .mr-lane.opponent .mr-climber.finished,
[data-mountain-race-mount][data-mr-summit-sky="58"] .mr-lane.opponent .mr-climber.standing-on-summit {
  left: 50% !important;
  transform: translate(-50%, 17%) !important;
  transform-origin: 50% 100% !important;
}
@media (max-width: 620px) {
  [data-mountain-race-mount][data-mr-summit-sky="58"] .mr-climber.finished,
  [data-mountain-race-mount][data-mr-summit-sky="58"] .mr-climber.standing-on-summit,
  [data-mountain-race-mount][data-mr-summit-sky="58"] .mr-lane.opponent .mr-climber.finished,
  [data-mountain-race-mount][data-mr-summit-sky="58"] .mr-lane.opponent .mr-climber.standing-on-summit {
    transform: translate(-50%, 30%) !important;
  }
}
`;

function updateDocument(source) {
  source = source.replace(/(?:&visual=\d+)+/g, '&visual=58');
  source = source.replace('mountain-race.js?prototype=1"', 'mountain-race.js?prototype=1&visual=58"');
  if (!source.includes('summit-sprint-alpine-sky-v58.png')) {
    source = source.replace('</head>', '  <link rel="preload" as="image" href="/assets/mountain-race/images/summit-sprint-alpine-sky-v58.png" fetchpriority="high">\n</head>');
  }
  return source;
}

html = updateDocument(html);
preview = updateDocument(preview);

await Promise.all([
  writeFile(runtimeUrl, runtime), writeFile(prototypeUrl, prototype), writeFile(cssUrl, css),
  writeFile(indexUrl, html), writeFile(previewUrl, preview)
]);

console.log('Applied Summit Sprint V58 independent summit sky, blue outer shell, connected lane headers, and raised winner stance.');
