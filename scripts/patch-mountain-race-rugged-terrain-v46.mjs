import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const runtimeUrl = new URL('assets/mountain-race/mountain-race-multiplayer.js', root);
const prototypeUrl = new URL('assets/mountain-race/mountain-race.js', root);
const cssUrl = new URL('assets/mountain-race/mountain-race.css', root);
const indexUrl = new URL('index.html', root);
const previewUrl = new URL('mountain-race-preview.html', root);
const marker = 'MOUNTAIN_RACE_RUGGED_TERRAIN_V46';

function required(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Summit Sprint V46 could not find ${label}.`);
  return source.replace(before, after);
}

let [runtime, prototype, css, html, preview] = await Promise.all([
  readFile(runtimeUrl, 'utf8'), readFile(prototypeUrl, 'utf8'), readFile(cssUrl, 'utf8'),
  readFile(indexUrl, 'utf8'), readFile(previewUrl, 'utf8')
]);

if (!runtime.includes('MOUNTAIN_RACE_CONTACT_LEDGES_V45') || !prototype.includes('MOUNTAIN_RACE_CONTACT_LEDGES_V45')) {
  throw new Error('Summit Sprint V46 requires the V45 contact geometry first.');
}

if (!runtime.includes(marker)) {
  runtime = required(runtime,
    "          'mr-rock-hold',\n          index === currentIndex ? 'current' : '',",
    "          'mr-rock-hold',\n          side === 'opponent' && index >= currentIndex ? 'opponent-upcoming' : '',\n          index === currentIndex ? 'current' : '',",
    'multiplayer opponent upcoming-hold class');
  runtime = required(runtime,
    'data-mr-hold-index="${index}" aria-hidden="true"',
    'data-mr-hold-index="${index}" data-mr-outcrop="${index % 4}" aria-hidden="true"',
    'multiplayer outcrop variant');
  runtime = required(runtime,
    "    root.dataset.mrContactLedges = '45';\n    // MOUNTAIN_RACE_VISUAL_REBOOT_V44\n    // MOUNTAIN_RACE_CONTACT_LEDGES_V45",
    "    root.dataset.mrContactLedges = '45';\n    root.dataset.mrRuggedTerrain = '46';\n    // MOUNTAIN_RACE_VISUAL_REBOOT_V44\n    // MOUNTAIN_RACE_CONTACT_LEDGES_V45\n    // MOUNTAIN_RACE_RUGGED_TERRAIN_V46",
    'multiplayer V46 dataset');
}

if (!prototype.includes(marker)) {
  prototype = required(prototype,
    "        const classes = ['mr-rock-hold', isCurrent ? 'current' : '', index < player.promptIndex ? 'passed' : ''].filter(Boolean).join(' ');",
    "        const classes = ['mr-rock-hold', playerKey === 'opponent' && index >= player.promptIndex ? 'opponent-upcoming' : '', isCurrent ? 'current' : '', index < player.promptIndex ? 'passed' : ''].filter(Boolean).join(' ');",
    'prototype opponent upcoming-hold class');
  prototype = required(prototype,
    'data-mr-hold-index="${index}" aria-hidden="true"',
    'data-mr-hold-index="${index}" data-mr-outcrop="${index % 4}" aria-hidden="true"',
    'prototype outcrop variant');
  prototype = required(prototype,
    "    root.dataset.mrContactLedges = '45';\n    // MOUNTAIN_RACE_VISUAL_REBOOT_V44\n    // MOUNTAIN_RACE_CONTACT_LEDGES_V45",
    "    root.dataset.mrContactLedges = '45';\n    root.dataset.mrRuggedTerrain = '46';\n    // MOUNTAIN_RACE_VISUAL_REBOOT_V44\n    // MOUNTAIN_RACE_CONTACT_LEDGES_V45\n    // MOUNTAIN_RACE_RUGGED_TERRAIN_V46",
    'prototype V46 dataset');
}

if (!css.includes(marker)) css += String.raw`

/* MOUNTAIN_RACE_RUGGED_TERRAIN_V46
   Approved earthy-brown terrain uses one optimized cliff layer and four natural
   outcrops. Opponent upcoming outcrops stay visible without revealing controls. */
[data-mountain-race-mount][data-mr-visual-reboot="44"][data-mr-contact-ledges="45"][data-mr-rugged-terrain="46"] .mr-v44-cliff {
  inset: -52px -10px -34px !important;
  background: url('/assets/mountain-race/images/summit-sprint-rugged-cliff-v46.png') center center / auto 100% no-repeat !important;
  filter: drop-shadow(0 10px 12px rgba(25,14,8,.32)) !important;
}
[data-mountain-race-mount][data-mr-visual-reboot="44"][data-mr-contact-ledges="45"][data-mr-rugged-terrain="46"] .mr-mountain-wall {
  background: #342b23 !important;
}
[data-mountain-race-mount][data-mr-visual-reboot="44"][data-mr-contact-ledges="45"][data-mr-rugged-terrain="46"] .mr-rock-hold {
  width: 128px !important;
  height: 48px !important;
  border: 0 !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  filter: drop-shadow(0 7px 5px rgba(20,10,5,.55)) !important;
}
[data-mountain-race-mount][data-mr-rugged-terrain="46"] .mr-rock-hold[data-mr-outcrop="0"] {
  background: url('/assets/mountain-race/images/summit-sprint-rugged-outcrop-1-v46.png') center / 100% 100% no-repeat !important;
}
[data-mountain-race-mount][data-mr-rugged-terrain="46"] .mr-rock-hold[data-mr-outcrop="1"] {
  background: url('/assets/mountain-race/images/summit-sprint-rugged-outcrop-2-v46.png') center / 100% 100% no-repeat !important;
}
[data-mountain-race-mount][data-mr-rugged-terrain="46"] .mr-rock-hold[data-mr-outcrop="2"] {
  background: url('/assets/mountain-race/images/summit-sprint-rugged-outcrop-3-v46.png') center / 100% 100% no-repeat !important;
}
[data-mountain-race-mount][data-mr-rugged-terrain="46"] .mr-rock-hold[data-mr-outcrop="3"] {
  background: url('/assets/mountain-race/images/summit-sprint-rugged-outcrop-4-v46.png') center / 100% 100% no-repeat !important;
}
[data-mountain-race-mount][data-mr-rugged-terrain="46"] .mr-rock-hold.current {
  filter: drop-shadow(0 0 5px rgba(115,203,255,.98)) drop-shadow(0 8px 5px rgba(20,10,5,.58)) !important;
}
[data-mountain-race-mount][data-mr-rugged-terrain="46"] .mr-lane.opponent .mr-rock-hold.current {
  filter: drop-shadow(0 0 5px rgba(255,171,82,.94)) drop-shadow(0 8px 5px rgba(20,10,5,.58)) !important;
}
[data-mountain-race-mount][data-mr-rugged-terrain="46"] .mr-lane.opponent .mr-rock-hold.opponent-upcoming {
  display: grid !important;
  visibility: visible !important;
  opacity: 1 !important;
}
[data-mountain-race-mount][data-mr-rugged-terrain="46"] .mr-lane.opponent .mr-rock-hold.opponent-upcoming:not(.current) b {
  display: none !important;
}
[data-mountain-race-mount][data-mr-rugged-terrain="46"] .mr-v44-start {
  width: 68% !important;
  height: 74px !important;
  border: 0 !important;
  border-radius: 0 !important;
  background: url('/assets/mountain-race/images/summit-sprint-rugged-outcrop-4-v46.png') center / 100% 100% no-repeat !important;
  box-shadow: none !important;
  filter: drop-shadow(0 9px 7px rgba(20,10,5,.5)) !important;
}
[data-mountain-race-mount][data-mr-rugged-terrain="46"] .mr-v44-start i {
  inset: 5px 15% auto !important;
  height: 7px !important;
  background: rgba(113,126,45,.7) !important;
}
[data-mountain-race-mount][data-mr-rugged-terrain="46"] .mr-finish-ledge.mr-summit-plateau {
  width: 70% !important;
  height: 72px !important;
  border: 0 !important;
  border-radius: 0 !important;
  background: url('/assets/mountain-race/images/summit-sprint-rugged-outcrop-3-v46.png') center / 100% 100% no-repeat !important;
  box-shadow: none !important;
  filter: drop-shadow(0 10px 7px rgba(20,10,5,.52)) !important;
}
[data-mountain-race-mount][data-mr-rugged-terrain="46"] .mr-finish-ledge.mr-summit-plateau > i {
  top: 4px !important;
  height: 7px !important;
  background: rgba(121,139,52,.72) !important;
}
[data-mountain-race-mount][data-mr-rugged-terrain="46"] .mr-finish-ledge.mr-summit-plateau > b {
  top: 16px !important;
  color: #fff7dc !important;
  text-shadow: 0 2px 3px rgba(20,10,5,.8) !important;
}
@media (max-width: 620px) {
  [data-mountain-race-mount][data-mr-rugged-terrain="46"] .mr-rock-hold { width: 88px !important; height: 33px !important; }
  [data-mountain-race-mount][data-mr-rugged-terrain="46"] .mr-v44-start { height: 56px !important; }
  [data-mountain-race-mount][data-mr-rugged-terrain="46"] .mr-finish-ledge.mr-summit-plateau { height: 58px !important; }
}
`;

const productionAssets = [
  'summit-sprint-rugged-cliff-v46.png',
  'summit-sprint-rugged-outcrop-1-v46.png',
  'summit-sprint-rugged-outcrop-2-v46.png',
  'summit-sprint-rugged-outcrop-3-v46.png',
  'summit-sprint-rugged-outcrop-4-v46.png'
];

function updateDocument(source) {
  source = source
    .replace(/^\s*<link rel="preload" as="image" href="\/assets\/mountain-race\/images\/summit-sprint-reboot-cliff-v44\.png" fetchpriority="high">\s*$/gm, '')
    .replace(/^\s*<link rel="preload" as="image" href="\/assets\/mountain-race\/images\/summit-sprint-reboot-ledge-v45\.png" fetchpriority="high">\s*$/gm, '')
    .replace(/(?:&visual=\d+)+/g, '&visual=46');
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
console.log('Applied Summit Sprint V46 rugged brown terrain, varied natural outcrops, and opponent upcoming-ledge visibility.');
