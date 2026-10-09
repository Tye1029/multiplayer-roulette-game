import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const runtimeUrl = new URL('assets/mountain-race/mountain-race-multiplayer.js', root);
const prototypeUrl = new URL('assets/mountain-race/mountain-race.js', root);
const cssUrl = new URL('assets/mountain-race/mountain-race.css', root);
const indexUrl = new URL('index.html', root);
const previewUrl = new URL('mountain-race-preview.html', root);
const marker = 'MOUNTAIN_RACE_UNIFIED_SCENE_V63';

function required(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Summit Sprint V63 could not find ${label}.`);
  return source.replace(before, after);
}

let [runtime, prototype, css, html, preview] = await Promise.all([
  readFile(runtimeUrl, 'utf8'), readFile(prototypeUrl, 'utf8'), readFile(cssUrl, 'utf8'),
  readFile(indexUrl, 'utf8'), readFile(previewUrl, 'utf8')
]);

function updateRuntime(source, name) {
  if (!source.includes('MOUNTAIN_RACE_CONTINUOUS_SCENERY_V62')) throw new Error(`Summit Sprint V63 requires V62 in ${name}.`);
  source = required(
    source,
    "    root.dataset.mrContinuousScenery = '62';\n    // MOUNTAIN_RACE_CONTINUOUS_SCENERY_V62",
    "    root.dataset.mrContinuousScenery = '62';\n    root.dataset.mrUnifiedScene = '63';\n    // MOUNTAIN_RACE_UNIFIED_SCENE_V63\n    // MOUNTAIN_RACE_CONTINUOUS_SCENERY_V62",
    `${name} unified-scene dataset`
  );
  source = source.replace(/\n\s*<div class="mr-control-terrain" aria-hidden="true">\s*\n\s*<span class="me"[^\n]*<\/span>\s*\n\s*<span class="opponent"[^\n]*<\/span>\s*\n\s*<\/div>/, '');
  return source;
}

if (!runtime.includes(marker)) runtime = updateRuntime(runtime, 'multiplayer');
if (!prototype.includes(marker)) prototype = updateRuntime(prototype, 'prototype');

if (!css.includes(marker)) css += String.raw`

/* MOUNTAIN_RACE_UNIFIED_SCENE_V63
   Controls overlap the real live viewports, so no duplicate terrain strip can
   create a moving seam. Finished lanes use one precomposed sky/peak scene,
   while matching gray-granite ledges blend into the approved mountain. */
[data-mountain-race-mount][data-mr-unified-scene="63"] .mr-control-terrain {
  display: none !important;
}
[data-mountain-race-mount][data-mr-unified-scene="63"] .mr-command-deck {
  position: relative !important;
  z-index: 50 !important;
  margin-top: -132px !important;
  margin-right: 18px !important;
  margin-left: 18px !important;
  background: rgba(5,24,37,.9) !important;
}
[data-mountain-race-mount][data-mr-unified-scene="63"][data-mr-continuous-scenery="62"] .mountain-race-game {
  padding-bottom: 12px !important;
  background-color: #30352f !important;
  background-image: url('/assets/mountain-race/images/summit-sprint-ground-base-v61.png') !important;
  background-position: center bottom !important;
  background-size: cover !important;
  background-repeat: no-repeat !important;
}
[data-mountain-race-mount][data-mr-unified-scene="63"][data-mr-continuous-scenery="62"] .mountain-race-game::after {
  content: "" !important;
  display: block !important;
  position: absolute !important;
  z-index: 10 !important;
  right: 0 !important;
  bottom: 0 !important;
  left: 0 !important;
  height: 230px !important;
  background: url('/assets/mountain-race/images/summit-sprint-ground-base-v61.png') center bottom / cover no-repeat !important;
  mask-image: linear-gradient(180deg, transparent 0, #000 34%, #000 100%) !important;
  pointer-events: none !important;
}
[data-mountain-race-mount][data-mr-unified-scene="63"][data-mr-continuous-scenery="62"] .mr-lane.continuous-mountain.summit-view .mr-climb-viewport {
  background-color: #5ca9df !important;
  background-image: url('/assets/mountain-race/images/summit-sprint-unified-summit-v63.png') !important;
  background-position: center center !important;
  background-size: cover !important;
  background-repeat: no-repeat !important; /* one unified finish scene */
  animation: none !important;
}
[data-mountain-race-mount][data-mr-unified-scene="63"][data-mr-continuous-scenery="62"] .mr-lane.continuous-mountain.summit-view .mr-mountain-wall::before,
[data-mountain-race-mount][data-mr-unified-scene="63"][data-mr-continuous-scenery="62"] .mr-lane.continuous-mountain.summit-view .mr-mountain-wall::after,
[data-mountain-race-mount][data-mr-unified-scene="63"][data-mr-natural-terrain="49"][data-mr-grounded-ascent="54"][data-mr-summit-sky="58"][data-mr-continuous-summit="59"][data-mr-natural-world="60"][data-mr-grounded-world="61"][data-mr-continuous-scenery="62"] .mr-lane.continuous-mountain.summit-view .mr-v44-cliff,
[data-mountain-race-mount][data-mr-unified-scene="63"][data-mr-natural-terrain="49"][data-mr-grounded-ascent="54"][data-mr-summit-sky="58"][data-mr-continuous-summit="59"][data-mr-natural-world="60"][data-mr-grounded-world="61"][data-mr-continuous-scenery="62"] .mr-lane.continuous-mountain.summit-view .mr-v44-start,
[data-mountain-race-mount][data-mr-unified-scene="63"][data-mr-natural-terrain="49"][data-mr-natural-summit="56"][data-mr-natural-world="60"][data-mr-grounded-world="61"][data-mr-continuous-scenery="62"] .mr-lane.summit-view .mr-finish-ledge.mr-summit-plateau {
  content: none !important;
  display: none !important;
}
[data-mountain-race-mount][data-mr-unified-scene="63"] .mr-lane.summit-view .mr-winner-confetti {
  background: transparent !important;
}
[data-mountain-race-mount][data-mr-unified-scene="63"] .mr-climber.finished,
[data-mountain-race-mount][data-mr-unified-scene="63"] .mr-climber.standing-on-summit,
[data-mountain-race-mount][data-mr-unified-scene="63"] .mr-lane.opponent .mr-climber.finished,
[data-mountain-race-mount][data-mr-unified-scene="63"] .mr-lane.opponent .mr-climber.standing-on-summit {
  transform: translate(-50%, 0) !important;
}
[data-mountain-race-mount][data-mr-unified-scene="63"][data-mr-visual-reboot="44"][data-mr-contact-ledges="45"][data-mr-rugged-terrain="46"][data-mr-natural-terrain="49"] .mr-rock-hold {
  filter: grayscale(1) saturate(.18) brightness(.76) contrast(1.16) !important;
  mix-blend-mode: normal !important;
}
[data-mountain-race-mount][data-mr-unified-scene="63"][data-mr-visual-reboot="44"][data-mr-contact-ledges="45"][data-mr-rugged-terrain="46"][data-mr-natural-terrain="49"] .mr-rock-hold.current,
[data-mountain-race-mount][data-mr-unified-scene="63"][data-mr-visual-reboot="44"][data-mr-contact-ledges="45"][data-mr-rugged-terrain="46"][data-mr-natural-terrain="49"] .mr-lane.opponent .mr-rock-hold.current {
  filter: grayscale(.92) saturate(.22) brightness(.86) contrast(1.15) !important;
}
[data-mountain-race-mount][data-mr-unified-scene="63"] .mr-lane.cliff-view .mr-climb-viewport::before,
[data-mountain-race-mount][data-mr-unified-scene="63"] .mr-lane.summit-view .mr-climb-viewport::before {
  content: "" !important;
  display: block !important;
  position: absolute !important;
  z-index: 1 !important;
  inset: -8% -18% 40% !important;
  width: auto !important;
  height: auto !important;
  background: url('/assets/mountain-race/images/summit-sprint-clouds-v63.png') center top / 118% auto no-repeat !important;
  opacity: calc(var(--mr-summit-reveal, 0) * .38) !important;
  transform: translateX(-3%) !important;
  animation: mrV63CloudDrift 22s ease-in-out infinite alternate !important;
  pointer-events: none !important;
}
[data-mountain-race-mount][data-mr-unified-scene="63"] .mr-lane.summit-view .mr-climb-viewport::before {
  opacity: .5 !important;
}
@keyframes mrV63CloudDrift {
  from { transform: translateX(-3%); }
  to { transform: translateX(3%); }
}
@media (max-width: 620px) {
  [data-mountain-race-mount][data-mr-unified-scene="63"] .mr-command-deck {
    margin-top: -118px !important;
    margin-right: 10px !important;
    margin-left: 10px !important;
  }
  [data-mountain-race-mount][data-mr-unified-scene="63"] .mr-climber.finished,
  [data-mountain-race-mount][data-mr-unified-scene="63"] .mr-climber.standing-on-summit,
  [data-mountain-race-mount][data-mr-unified-scene="63"] .mr-lane.opponent .mr-climber.finished,
  [data-mountain-race-mount][data-mr-unified-scene="63"] .mr-lane.opponent .mr-climber.standing-on-summit {
    transform: translate(-50%, 0) !important;
  }
}
@media (prefers-reduced-motion: reduce) {
  [data-mountain-race-mount][data-mr-unified-scene="63"] .mr-lane.cliff-view .mr-climb-viewport::before,
  [data-mountain-race-mount][data-mr-unified-scene="63"] .mr-lane.summit-view .mr-climb-viewport::before {
    animation: none !important;
  }
}
`;

function updateDocument(source) {
  source = source.replace(/&scene=\d+/g, '');
  return source.replace(/(&scenery=62)/g, '$1&scene=63');
}
html = updateDocument(html);
preview = updateDocument(preview);

await Promise.all([
  writeFile(runtimeUrl, runtime), writeFile(prototypeUrl, prototype), writeFile(cssUrl, css),
  writeFile(indexUrl, html), writeFile(previewUrl, preview)
]);

console.log('Applied Summit Sprint V63 unified summit, live-lane control overlap, granite ledges, and drifting clouds.');
