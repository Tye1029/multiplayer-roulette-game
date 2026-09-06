import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const runtimeUrl = new URL('assets/mountain-race/mountain-race-multiplayer.js', root);
const prototypeUrl = new URL('assets/mountain-race/mountain-race.js', root);
const cssUrl = new URL('assets/mountain-race/mountain-race.css', root);
const indexUrl = new URL('index.html', root);
const previewUrl = new URL('mountain-race-preview.html', root);
const marker = 'MOUNTAIN_RACE_GROUNDED_WORLD_V61';

function required(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Summit Sprint V61 could not find ${label}.`);
  return source.replace(before, after);
}

let [runtime, prototype, css, html, preview] = await Promise.all([
  readFile(runtimeUrl, 'utf8'), readFile(prototypeUrl, 'utf8'), readFile(cssUrl, 'utf8'),
  readFile(indexUrl, 'utf8'), readFile(previewUrl, 'utf8')
]);

function updateRuntime(source, name) {
  if (!source.includes('MOUNTAIN_RACE_NATURAL_WORLD_V60')) throw new Error(`Summit Sprint V61 requires V60 in ${name}.`);
  return required(
    source,
    "    root.dataset.mrNaturalWorld = '60';\n    // MOUNTAIN_RACE_NATURAL_WORLD_V60",
    "    root.dataset.mrNaturalWorld = '60';\n    root.dataset.mrGroundedWorld = '61';\n    // MOUNTAIN_RACE_GROUNDED_WORLD_V61\n    // MOUNTAIN_RACE_NATURAL_WORLD_V60",
    `${name} grounded-world dataset`
  );
}

if (!runtime.includes(marker)) runtime = updateRuntime(runtime, 'multiplayer');
if (!prototype.includes(marker)) prototype = updateRuntime(prototype, 'prototype');

if (!css.includes(marker)) css += String.raw`

/* MOUNTAIN_RACE_GROUNDED_WORLD_V61
   Each lane owns one aspect-correct approved world plate. Its grass-and-rock
   base, cliff, and summit move with that lane's existing independent camera. */
[data-mountain-race-mount][data-mr-grounded-world="61"],
[data-mountain-race-mount][data-mr-grounded-world="61"] .mountain-race-game,
[data-mountain-race-mount][data-mr-grounded-world="61"] .mr-race-stage,
[data-mountain-race-mount][data-mr-grounded-world="61"] .mr-climb-viewport {
  background-color: #5c91c4 !important;
  background-image: url('/assets/mountain-race/images/summit-sprint-alpine-sky-v58.png') !important;
  background-position: center center !important;
  background-size: cover !important;
}
[data-mountain-race-mount][data-mr-natural-terrain="49"][data-mr-grounded-ascent="54"][data-mr-summit-sky="58"][data-mr-continuous-summit="59"][data-mr-natural-world="60"][data-mr-grounded-world="61"] .mr-v44-cliff,
[data-mountain-race-mount][data-mr-natural-terrain="49"][data-mr-grounded-ascent="54"][data-mr-summit-sky="58"][data-mr-continuous-summit="59"][data-mr-natural-world="60"][data-mr-grounded-world="61"] .mr-lane.summit-view .mr-v44-cliff {
  inset: 0 !important;
  display: block !important;
  width: 100% !important;
  height: 100% !important;
  background:
    url('/assets/mountain-race/images/summit-sprint-grounded-world-v61.png') center calc(100% + 256px) / auto 2397px no-repeat,
    url('/assets/mountain-race/images/summit-sprint-alpine-sky-v58.png') center top / 100% 650px no-repeat,
    #5c91c4 !important;
  transform: none !important;
}
[data-mountain-race-mount][data-mr-natural-terrain="49"][data-mr-grounded-ascent="54"][data-mr-natural-world="60"][data-mr-grounded-world="61"] .mr-v44-start {
  bottom: -28px !important;
  display: block !important;
  width: 104% !important;
  height: 190px !important;
  background: url('/assets/mountain-race/images/summit-sprint-ground-base-v61.png') center bottom / 100% auto no-repeat !important;
  filter: none !important;
  box-shadow: none !important;
}
[data-mountain-race-mount][data-mr-grounded-world="61"] .mr-v44-start::before,
[data-mountain-race-mount][data-mr-grounded-world="61"] .mr-v44-start::after { content: none !important; display: none !important; }
[data-mountain-race-mount][data-mr-grounded-world="61"] .mr-v44-start i { display: none !important; }
[data-mountain-race-mount][data-mr-natural-terrain="49"][data-mr-natural-summit="56"][data-mr-natural-world="60"][data-mr-grounded-world="61"] .mr-finish-ledge.mr-summit-plateau {
  bottom: var(--mr-summit-bottom) !important;
  display: block !important;
  width: 100% !important;
  height: 330px !important;
  aspect-ratio: auto !important;
  opacity: 1 !important;
  transform: translate(-50%, calc(100% - 162px)) !important;
  background: url('/assets/mountain-race/images/summit-sprint-grounded-summit-v61.png') center bottom / 100% auto no-repeat !important;
  filter: none !important;
}
[data-mountain-race-mount][data-mr-grounded-world="61"] .mr-finish-ledge.mr-summit-plateau::before,
[data-mountain-race-mount][data-mr-grounded-world="61"] .mr-finish-ledge.mr-summit-plateau::after { content: none !important; display: none !important; }
[data-mountain-race-mount][data-mr-grounded-world="61"] .mr-lane.me .mr-v44-cliff,
[data-mountain-race-mount][data-mr-grounded-world="61"] .mr-lane.opponent .mr-v44-cliff {
  background-position: center bottom, center top !important;
}
`;

function updateDocument(source) {
  source = source.replace(/&grounded=\d+/g, '');
  return source.replace(/(&world=60)/g, '$1&grounded=61');
}

html = updateDocument(html);
preview = updateDocument(preview);

await Promise.all([
  writeFile(runtimeUrl, runtime), writeFile(prototypeUrl, prototype), writeFile(cssUrl, css),
  writeFile(indexUrl, html), writeFile(previewUrl, preview)
]);

console.log('Applied Summit Sprint V61 sharp aspect-correct world, lane-owned ground bases, and integrated grabbable summit.');
