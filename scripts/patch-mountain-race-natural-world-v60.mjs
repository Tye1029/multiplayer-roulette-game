import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const runtimeUrl = new URL('assets/mountain-race/mountain-race-multiplayer.js', root);
const prototypeUrl = new URL('assets/mountain-race/mountain-race.js', root);
const cssUrl = new URL('assets/mountain-race/mountain-race.css', root);
const indexUrl = new URL('index.html', root);
const previewUrl = new URL('mountain-race-preview.html', root);
const marker = 'MOUNTAIN_RACE_NATURAL_WORLD_V60';

function required(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Summit Sprint V60 could not find ${label}.`);
  return source.replace(before, after);
}

let [runtime, prototype, css, html, preview] = await Promise.all([
  readFile(runtimeUrl, 'utf8'), readFile(prototypeUrl, 'utf8'), readFile(cssUrl, 'utf8'),
  readFile(indexUrl, 'utf8'), readFile(previewUrl, 'utf8')
]);

for (const [name, source] of [['runtime', runtime], ['prototype', prototype]]) {
  if (!source.includes('MOUNTAIN_RACE_CONTINUOUS_SUMMIT_V59')) {
    throw new Error(`Summit Sprint V60 requires the V59 continuous-world baseline in ${name}.`);
  }
}

function updateRuntime(source) {
  return required(
    source,
    "    root.dataset.mrContinuousSummit = '59';\n    // MOUNTAIN_RACE_CONTINUOUS_SUMMIT_V59",
    "    root.dataset.mrContinuousSummit = '59';\n    root.dataset.mrNaturalWorld = '60';\n    // MOUNTAIN_RACE_NATURAL_WORLD_V60\n    // MOUNTAIN_RACE_CONTINUOUS_SUMMIT_V59",
    'natural-world dataset'
  );
}

if (!runtime.includes(marker)) runtime = updateRuntime(runtime);
if (!prototype.includes(marker)) prototype = updateRuntime(prototype);

if (!css.includes(marker)) css += String.raw`

/* MOUNTAIN_RACE_NATURAL_WORLD_V60
   The approved bulky-rock mountain and its sky are one portrait world plate.
   It moves with each lane camera, so no rectangular cliff edge or detached
   summit scene can appear when racers occupy different elevations. */
[data-mountain-race-mount][data-mr-natural-world="60"],
[data-mountain-race-mount][data-mr-natural-world="60"] .mountain-race-game,
[data-mountain-race-mount][data-mr-natural-world="60"] .mr-race-stage,
[data-mountain-race-mount][data-mr-natural-world="60"] .mr-climb-viewport {
  background-color: #5d91c5 !important;
  background-image: url('/assets/mountain-race/images/summit-sprint-natural-world-v60.png') !important;
  background-position: center top !important;
  background-size: cover !important;
  background-repeat: no-repeat !important;
}
[data-mountain-race-mount][data-mr-natural-terrain="49"][data-mr-grounded-ascent="54"][data-mr-summit-sky="58"][data-mr-continuous-summit="59"][data-mr-natural-world="60"] .mr-v44-cliff,
[data-mountain-race-mount][data-mr-natural-terrain="49"][data-mr-grounded-ascent="54"][data-mr-summit-sky="58"][data-mr-continuous-summit="59"][data-mr-natural-world="60"] .mr-lane.summit-view .mr-v44-cliff {
  inset: 0 !important;
  display: block !important;
  width: 100% !important;
  height: 100% !important;
  background:
    url('/assets/mountain-race/images/summit-sprint-natural-world-v60.png') center bottom / 100% 2198px no-repeat,
    url('/assets/mountain-race/images/summit-sprint-alpine-sky-v58.png') center top / 100% 620px no-repeat,
    #5d91c5 !important;
  transform: none !important;
}
[data-mountain-race-mount][data-mr-natural-terrain="49"][data-mr-natural-summit="56"][data-mr-summit-sky="58"][data-mr-continuous-summit="59"][data-mr-natural-world="60"] .mr-finish-ledge.mr-summit-plateau {
  opacity: 0 !important;
  background: none !important;
  filter: none !important;
}
[data-mountain-race-mount][data-mr-natural-world="60"] .mr-lane.continuous-mountain .mr-player-card {
  background: linear-gradient(180deg, rgba(4,22,35,.82), rgba(4,22,35,.92)) !important;
}
[data-mountain-race-mount][data-mr-natural-world="60"] .mr-lane.summit-view .mr-climb-viewport {
  background-image: url('/assets/mountain-race/images/summit-sprint-alpine-sky-v58.png') !important;
  background-position: center center !important;
  background-size: cover !important;
}
`;

function updateDocument(source) {
  source = source.replace(/&world=\d+/g, '');
  return source.replace(/(&continuous=59)/g, '$1&world=60');
}

html = updateDocument(html);
preview = updateDocument(preview);

await Promise.all([
  writeFile(runtimeUrl, runtime), writeFile(prototypeUrl, prototype), writeFile(cssUrl, css),
  writeFile(indexUrl, html), writeFile(previewUrl, preview)
]);

console.log('Applied Summit Sprint V60 approved natural mountain world with integrated sky and summit silhouette.');
