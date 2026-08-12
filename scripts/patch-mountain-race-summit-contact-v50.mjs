import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const runtimeUrl = new URL('assets/mountain-race/mountain-race-multiplayer.js', root);
const prototypeUrl = new URL('assets/mountain-race/mountain-race.js', root);
const cssUrl = new URL('assets/mountain-race/mountain-race.css', root);
const indexUrl = new URL('index.html', root);
const previewUrl = new URL('mountain-race-preview.html', root);
const marker = 'MOUNTAIN_RACE_SUMMIT_CONTACT_V50';

function required(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Summit Sprint V50 could not find ${label}.`);
  return source.replace(before, after);
}

let [runtime, prototype, css, html, preview] = await Promise.all([
  readFile(runtimeUrl, 'utf8'), readFile(prototypeUrl, 'utf8'), readFile(cssUrl, 'utf8'),
  readFile(indexUrl, 'utf8'), readFile(previewUrl, 'utf8')
]);

for (const source of [runtime, prototype]) {
  if (!source.includes("root.dataset.mrNaturalTerrain = '49';")) {
    throw new Error('Summit Sprint V50 requires the V49 natural terrain first.');
  }
}

if (!runtime.includes(marker)) {
  runtime = required(runtime,
    "    root.dataset.mrNaturalTerrain = '49';\n    // MOUNTAIN_RACE_NATURAL_TERRAIN_V49",
    "    root.dataset.mrNaturalTerrain = '49';\n    root.dataset.mrSummitContact = '50';\n    // MOUNTAIN_RACE_SUMMIT_CONTACT_V50\n    // MOUNTAIN_RACE_NATURAL_TERRAIN_V49",
    'multiplayer V50 dataset');
}

if (!prototype.includes(marker)) {
  prototype = required(prototype,
    "    root.dataset.mrNaturalTerrain = '49';\n    // MOUNTAIN_RACE_NATURAL_TERRAIN_V49",
    "    root.dataset.mrNaturalTerrain = '49';\n    root.dataset.mrSummitContact = '50';\n    // MOUNTAIN_RACE_SUMMIT_CONTACT_V50\n    // MOUNTAIN_RACE_NATURAL_TERRAIN_V49",
    'prototype V50 dataset');
}

if (!css.includes(marker)) css += String.raw`

/* MOUNTAIN_RACE_SUMMIT_CONTACT_V50
   The visible feet in the victory frame land on the V49 summit plane. The lane,
   viewport and wall keep their clipping behavior without drawing panel boxes. */
[data-mountain-race-mount][data-mr-natural-terrain="49"][data-mr-summit-contact="50"] .mr-lane {
  border: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
}
[data-mountain-race-mount][data-mr-natural-terrain="49"][data-mr-summit-contact="50"] .mr-climb-viewport {
  border: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
}
[data-mountain-race-mount][data-mr-visual-reboot="44"][data-mr-contact-ledges="45"][data-mr-rugged-terrain="46"][data-mr-natural-terrain="49"][data-mr-summit-contact="50"] .mr-mountain-wall {
  background: transparent !important;
  box-shadow: none !important;
}
[data-mountain-race-mount][data-mr-visual-reboot="44"][data-mr-contact-ledges="45"][data-mr-natural-terrain="49"][data-mr-summit-contact="50"] .mr-climber.finished,
[data-mountain-race-mount][data-mr-visual-reboot="44"][data-mr-contact-ledges="45"][data-mr-natural-terrain="49"][data-mr-summit-contact="50"] .mr-climber.standing-on-summit {
  left: 50% !important;
  transform: translate(-50%, 28%) !important;
  transform-origin: 50% 100% !important;
}
@media (max-width: 620px) {
  [data-mountain-race-mount][data-mr-visual-reboot="44"][data-mr-contact-ledges="45"][data-mr-natural-terrain="49"][data-mr-summit-contact="50"] .mr-climber.finished,
  [data-mountain-race-mount][data-mr-visual-reboot="44"][data-mr-contact-ledges="45"][data-mr-natural-terrain="49"][data-mr-summit-contact="50"] .mr-climber.standing-on-summit {
    transform: translate(-50%, 40.6%) !important;
  }
}
`;

css = required(css,
  '[data-mountain-race-mount][data-mr-natural-terrain="49"][data-mr-summit-contact="50"] .mr-mountain-wall {',
  '[data-mountain-race-mount][data-mr-visual-reboot="44"][data-mr-contact-ledges="45"][data-mr-rugged-terrain="46"][data-mr-natural-terrain="49"][data-mr-summit-contact="50"] .mr-mountain-wall {',
  'boxless wall specificity');

function updateDocument(source) {
  return source.replace(/(?:&visual=\d+)+/g, '&visual=50');
}

html = updateDocument(html);
preview = updateDocument(preview);

await Promise.all([
  writeFile(runtimeUrl, runtime), writeFile(prototypeUrl, prototype), writeFile(cssUrl, css),
  writeFile(indexUrl, html), writeFile(previewUrl, preview)
]);

console.log('Applied Summit Sprint V50 summit foot contact and removed rectangular mountain framing.');
