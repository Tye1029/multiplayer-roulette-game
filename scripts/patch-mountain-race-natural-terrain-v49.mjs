import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const runtimeUrl = new URL('assets/mountain-race/mountain-race-multiplayer.js', root);
const prototypeUrl = new URL('assets/mountain-race/mountain-race.js', root);
const cssUrl = new URL('assets/mountain-race/mountain-race.css', root);
const indexUrl = new URL('index.html', root);
const previewUrl = new URL('mountain-race-preview.html', root);
const marker = 'MOUNTAIN_RACE_NATURAL_TERRAIN_V49';

function required(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Summit Sprint V49 could not find ${label}.`);
  return source.replace(before, after);
}

let [runtime, prototype, css, html, preview] = await Promise.all([
  readFile(runtimeUrl, 'utf8'), readFile(prototypeUrl, 'utf8'), readFile(cssUrl, 'utf8'),
  readFile(indexUrl, 'utf8'), readFile(previewUrl, 'utf8')
]);

for (const source of [runtime, prototype]) {
  if (!source.includes("root.dataset.mrFinishStability = '47';")) {
    throw new Error('Summit Sprint V49 requires the V47 finish presentation first.');
  }
}

if (!runtime.includes(marker)) {
  runtime = required(runtime,
    "    root.dataset.mrFinishStability = '47';\n    // MOUNTAIN_RACE_VISUAL_REBOOT_V44",
    "    root.dataset.mrFinishStability = '47';\n    root.dataset.mrNaturalTerrain = '49';\n    // MOUNTAIN_RACE_NATURAL_TERRAIN_V49\n    // MOUNTAIN_RACE_VISUAL_REBOOT_V44",
    'multiplayer V49 dataset');
}

if (!prototype.includes(marker)) {
  prototype = required(prototype,
    "    root.dataset.mrFinishStability = '47';\n    // MOUNTAIN_RACE_VISUAL_REBOOT_V44",
    "    root.dataset.mrFinishStability = '47';\n    root.dataset.mrNaturalTerrain = '49';\n    // MOUNTAIN_RACE_NATURAL_TERRAIN_V49\n    // MOUNTAIN_RACE_VISUAL_REBOOT_V44",
    'prototype V49 dataset');
}

if (!css.includes(marker)) css += String.raw`

/* MOUNTAIN_RACE_NATURAL_TERRAIN_V49
   The approved natural-granite direction uses one tall, aspect-correct composite
   and four transparent ledges. Direction controls remain live DOM overlays. */
[data-mountain-race-mount][data-mr-visual-reboot="44"][data-mr-contact-ledges="45"][data-mr-rugged-terrain="46"][data-mr-natural-terrain="49"] .mr-v44-cliff {
  inset: -56px -12px -38px !important;
  background: url('/assets/mountain-race/images/summit-sprint-natural-cliff-v49.png') center center / auto 100% no-repeat !important;
  filter: drop-shadow(0 10px 11px rgba(24,14,8,.3)) !important;
  image-rendering: auto;
}
[data-mountain-race-mount][data-mr-natural-terrain="49"] .mr-mountain-wall {
  background: #302a24 !important;
}
[data-mountain-race-mount][data-mr-visual-reboot="44"][data-mr-contact-ledges="45"][data-mr-rugged-terrain="46"][data-mr-natural-terrain="49"] .mr-rock-hold {
  width: 132px !important;
  height: 54px !important;
  border: 0 !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  background-color: transparent !important;
  filter: drop-shadow(0 4px 3px rgba(28,17,10,.42)) drop-shadow(0 9px 6px rgba(18,10,5,.35)) !important;
}
[data-mountain-race-mount][data-mr-natural-terrain="49"] .mr-rock-hold[data-mr-outcrop="0"] {
  background: url('/assets/mountain-race/images/summit-sprint-natural-outcrop-1-v49.png') center bottom / contain no-repeat !important;
}
[data-mountain-race-mount][data-mr-natural-terrain="49"] .mr-rock-hold[data-mr-outcrop="1"] {
  background: url('/assets/mountain-race/images/summit-sprint-natural-outcrop-2-v49.png') center bottom / contain no-repeat !important;
}
[data-mountain-race-mount][data-mr-natural-terrain="49"] .mr-rock-hold[data-mr-outcrop="2"] {
  background: url('/assets/mountain-race/images/summit-sprint-natural-outcrop-3-v49.png') center bottom / contain no-repeat !important;
}
[data-mountain-race-mount][data-mr-natural-terrain="49"] .mr-rock-hold[data-mr-outcrop="3"] {
  background: url('/assets/mountain-race/images/summit-sprint-natural-outcrop-4-v49.png') center bottom / contain no-repeat !important;
}
[data-mountain-race-mount][data-mr-natural-terrain="49"] .mr-rock-hold.current {
  filter: drop-shadow(0 0 3px rgba(115,203,255,.9)) drop-shadow(0 5px 4px rgba(28,17,10,.44)) !important;
}
[data-mountain-race-mount][data-mr-natural-terrain="49"] .mr-lane.opponent .mr-rock-hold.current {
  filter: drop-shadow(0 0 3px rgba(255,171,82,.86)) drop-shadow(0 5px 4px rgba(28,17,10,.44)) !important;
}
[data-mountain-race-mount][data-mr-natural-terrain="49"] .mr-rock-hold.passed {
  opacity: .82 !important;
}
[data-mountain-race-mount][data-mr-natural-terrain="49"] .mr-v44-start {
  width: 72% !important;
  height: 78px !important;
  border: 0 !important;
  border-radius: 0 !important;
  background: url('/assets/mountain-race/images/summit-sprint-natural-outcrop-4-v49.png') center bottom / contain no-repeat !important;
  box-shadow: none !important;
  filter: drop-shadow(0 7px 5px rgba(25,14,8,.4)) !important;
}
[data-mountain-race-mount][data-mr-natural-terrain="49"] .mr-v44-start i {
  inset: 8px 17% auto !important;
  height: 5px !important;
  background: rgba(118,127,69,.48) !important;
}
[data-mountain-race-mount][data-mr-natural-terrain="49"] .mr-finish-ledge.mr-summit-plateau {
  width: 72% !important;
  height: 78px !important;
  border: 0 !important;
  border-radius: 0 !important;
  background: url('/assets/mountain-race/images/summit-sprint-natural-outcrop-3-v49.png') center bottom / contain no-repeat !important;
  box-shadow: none !important;
  filter: drop-shadow(0 8px 6px rgba(25,14,8,.42)) !important;
}
[data-mountain-race-mount][data-mr-natural-terrain="49"] .mr-finish-ledge.mr-summit-plateau > i {
  top: 8px !important;
  height: 5px !important;
  background: rgba(122,132,73,.48) !important;
}
[data-mountain-race-mount][data-mr-natural-terrain="49"] .mr-finish-ledge.mr-summit-plateau > b {
  top: 18px !important;
}
@media (max-width: 620px) {
  [data-mountain-race-mount][data-mr-visual-reboot="44"][data-mr-contact-ledges="45"][data-mr-rugged-terrain="46"][data-mr-natural-terrain="49"] .mr-rock-hold { width: 86px !important; height: 34px !important; }
  [data-mountain-race-mount][data-mr-natural-terrain="49"] .mr-v44-start { height: 60px !important; }
  [data-mountain-race-mount][data-mr-natural-terrain="49"] .mr-finish-ledge.mr-summit-plateau { height: 62px !important; }
}
`;

const productionAssets = [
  'summit-sprint-natural-cliff-v49.png',
  'summit-sprint-natural-outcrop-1-v49.png',
  'summit-sprint-natural-outcrop-2-v49.png',
  'summit-sprint-natural-outcrop-3-v49.png',
  'summit-sprint-natural-outcrop-4-v49.png'
];

function updateDocument(source) {
  source = source
    .replace(/^\s*<link rel="preload" as="image" href="\/assets\/mountain-race\/images\/summit-sprint-rugged-(?:cliff|outcrop-[1-4])-v46\.png" fetchpriority="high">\s*$/gm, '')
    .replace(/(?:&visual=\d+)+/g, '&visual=49');
  if (!source.includes(productionAssets[0])) {
    const preloads = productionAssets.map(name => `  <link rel="preload" as="image" href="/assets/mountain-race/images/${name}" fetchpriority="high">`).join('\n');
    source = source.replace('</head>', `${preloads}\n</head>`);
  }
  return source;
}

html = updateDocument(html);
preview = updateDocument(preview);

await Promise.all([
  writeFile(runtimeUrl, runtime), writeFile(prototypeUrl, prototype), writeFile(cssUrl, css),
  writeFile(indexUrl, html), writeFile(previewUrl, preview)
]);

console.log('Applied Summit Sprint V49 natural granite cliff, proportional integrated ledges, and sharper non-repeating terrain.');
