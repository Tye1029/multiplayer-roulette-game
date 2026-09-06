import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const runtimeUrl = new URL('assets/mountain-race/mountain-race-multiplayer.js', root);
const prototypeUrl = new URL('assets/mountain-race/mountain-race.js', root);
const cssUrl = new URL('assets/mountain-race/mountain-race.css', root);
const indexUrl = new URL('index.html', root);
const previewUrl = new URL('mountain-race-preview.html', root);
const marker = 'MOUNTAIN_RACE_NATURAL_SUMMIT_V56';

function required(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Summit Sprint V56 could not find ${label}.`);
  return source.replace(before, after);
}

let [runtime, prototype, css, html, preview] = await Promise.all([
  readFile(runtimeUrl, 'utf8'), readFile(prototypeUrl, 'utf8'), readFile(cssUrl, 'utf8'),
  readFile(indexUrl, 'utf8'), readFile(previewUrl, 'utf8')
]);

for (const source of [runtime, prototype]) {
  if (!source.includes('MOUNTAIN_RACE_ROUTE_CLARITY_V55')) {
    throw new Error('Summit Sprint V56 requires the V55 route-clarity pass first.');
  }
}

if (!runtime.includes(marker)) {
  runtime = required(runtime,
    "    root.dataset.mrRouteClarity = '55';\n    // MOUNTAIN_RACE_ROUTE_CLARITY_V55",
    "    root.dataset.mrRouteClarity = '55';\n    root.dataset.mrNaturalSummit = '56';\n    // MOUNTAIN_RACE_NATURAL_SUMMIT_V56\n    // MOUNTAIN_RACE_ROUTE_CLARITY_V55",
    'multiplayer V56 dataset');
  runtime = required(runtime,
    "          index === currentIndex ? 'current' : '',\n          index < currentIndex ? 'passed' : '',",
    "          index === currentIndex ? 'current' : '',\n          index === currentIndex - 1 ? 'contact' : '',\n          index === total - 1 ? 'final-hold' : '',\n          index < currentIndex ? 'passed' : '',",
    'multiplayer contact/final hold classes');
  runtime = required(runtime, 'currentIndex + 4', 'currentIndex + 3', 'multiplayer four visible prompt ledges');
  runtime = required(runtime, '${120 + index * 60}px', '${196 + index * 74}px', 'multiplayer hold spacing');
  runtime = required(runtime,
    '${120 + total * 60}px',
    '${196 + Math.max(0, total - 1) * 74}px',
    'multiplayer summit shares final hold');
  runtime = required(runtime,
    'const gripBottom = finished ? 196 + Number(total || 0) * 60 : contactIndex >= 0 ? 160 + contactIndex * 60 : 76;',
    'const gripBottom = finished ? 272 + Math.max(0, Number(total || 0) - 1) * 74 : contactIndex >= 0 ? 228 + contactIndex * 74 : 76;',
    'multiplayer hand and summit contact');
  runtime = required(runtime,
    'const scroll = Math.max(0, cameraIndex - 1) * 60;',
    'const scroll = Math.max(0, cameraIndex) * 74;',
    'multiplayer camera spacing');
  runtime = required(runtime,
    '${Math.max(2600, 580 + total * 60)}px',
    '${Math.max(2600, 580 + total * 74)}px',
    'multiplayer wall height');
}

if (!prototype.includes(marker)) {
  prototype = required(prototype,
    "    root.dataset.mrRouteClarity = '55';\n    // MOUNTAIN_RACE_ROUTE_CLARITY_V55",
    "    root.dataset.mrRouteClarity = '55';\n    root.dataset.mrNaturalSummit = '56';\n    // MOUNTAIN_RACE_NATURAL_SUMMIT_V56\n    // MOUNTAIN_RACE_ROUTE_CLARITY_V55",
    'prototype V56 dataset');
  prototype = required(prototype,
    "        const classes = ['mr-rock-hold', playerKey === 'opponent' && index >= player.promptIndex ? 'opponent-upcoming' : '', isCurrent ? 'current' : '', index < player.promptIndex ? 'passed' : ''].filter(Boolean).join(' ');",
    "        const classes = ['mr-rock-hold', playerKey === 'opponent' && index >= player.promptIndex ? 'opponent-upcoming' : '', isCurrent ? 'current' : '', index === player.promptIndex - 1 ? 'contact' : '', index === total - 1 ? 'final-hold' : '', index < player.promptIndex ? 'passed' : ''].filter(Boolean).join(' ');",
    'prototype contact/final hold classes');
  prototype = required(prototype, 'player.promptIndex + 4', 'player.promptIndex + 3', 'prototype four visible prompt ledges');
  prototype = required(prototype, '${120 + index * 60}px', '${196 + index * 74}px', 'prototype hold spacing');
  prototype = required(prototype,
    '${120 + total * 60}px',
    '${196 + Math.max(0, total - 1) * 74}px',
    'prototype summit shares final hold');
  prototype = required(prototype,
    'const gripBottom = finished ? 196 + TOTAL_HOLDS * 60 : contactIndex >= 0 ? 160 + contactIndex * 60 : 76;',
    'const gripBottom = finished ? 272 + Math.max(0, TOTAL_HOLDS - 1) * 74 : contactIndex >= 0 ? 228 + contactIndex * 74 : 76;',
    'prototype hand and summit contact');
  prototype = required(prototype,
    'const scroll = Math.max(0, cameraIndex - 1) * 60;',
    'const scroll = Math.max(0, cameraIndex) * 74;',
    'prototype camera spacing');
  prototype = required(prototype,
    '${Math.max(2600, 580 + total * 60)}px',
    '${Math.max(2600, 580 + total * 74)}px',
    'prototype wall height');
}

if (!css.includes(marker)) css += String.raw`

/* MOUNTAIN_RACE_NATURAL_SUMMIT_V56
   A slightly wider route begins with an arms-length first grab. The ledge a
   climber is holding layers across the fingers, while hold 24 is the lip of a
   single natural summit peak and the winner pulls directly onto that surface. */
[data-mountain-race-mount][data-mr-visual-reboot="44"][data-mr-contact-ledges="45"][data-mr-natural-summit="56"] .mr-rock-hold.contact {
  z-index: 13 !important;
  opacity: 1 !important;
  filter: drop-shadow(0 7px 5px rgba(1,9,13,.54)) !important;
}
[data-mountain-race-mount][data-mr-visual-reboot="44"][data-mr-contact-ledges="45"][data-mr-natural-summit="56"] .mr-rock-hold.final-hold {
  background: none !important;
  filter: none !important;
}
[data-mountain-race-mount][data-mr-natural-summit="56"] .mr-rock-hold.final-hold b {
  z-index: 17 !important;
}
[data-mountain-race-mount][data-mr-visual-reboot="44"][data-mr-contact-ledges="45"][data-mr-natural-terrain="49"][data-mr-natural-summit="56"] .mr-finish-ledge.mr-summit-plateau {
  z-index: 7 !important;
  left: 50% !important;
  bottom: var(--mr-summit-bottom) !important;
  display: block !important;
  width: 94% !important;
  height: auto !important;
  aspect-ratio: 768 / 615 !important;
  transform: translate(-50%, calc(100% - 84px)) !important;
  border: 0 !important;
  border-radius: 0 !important;
  background: url('/assets/mountain-race/images/summit-sprint-natural-peak-v56.png') center top / 100% auto no-repeat !important;
  box-shadow: none !important;
  filter: drop-shadow(0 10px 9px rgba(10,8,5,.5)) !important;
  pointer-events: none !important;
}
[data-mountain-race-mount][data-mr-natural-summit="56"] .mr-summit-plateau i,
[data-mountain-race-mount][data-mr-natural-summit="56"] .mr-summit-plateau b {
  display: none !important;
}
[data-mountain-race-mount][data-mr-natural-summit="56"] .mr-climber.finished,
[data-mountain-race-mount][data-mr-natural-summit="56"] .mr-climber.standing-on-summit {
  z-index: 14 !important;
  animation: mrV56SummitPullUp 620ms cubic-bezier(.2,.72,.24,1) both !important;
}
@keyframes mrV56SummitPullUp {
  from { translate: 0 68px; }
  to { translate: 0 0; }
}
@media (max-width: 620px) {
  [data-mountain-race-mount][data-mr-visual-reboot="44"][data-mr-contact-ledges="45"][data-mr-natural-terrain="49"][data-mr-natural-summit="56"] .mr-finish-ledge.mr-summit-plateau {
    width: 98% !important;
    transform: translate(-50%, calc(100% - 62px)) !important;
  }
}
`;

function updateDocument(source) {
  source = source.replace(/(?:&visual=\d+)+/g, '&visual=56');
  source = source.replace('mountain-race.js?prototype=1"', 'mountain-race.js?prototype=1&visual=56"');
  if (!source.includes('summit-sprint-natural-peak-v56.png')) {
    source = source.replace('</head>', '  <link rel="preload" as="image" href="/assets/mountain-race/images/summit-sprint-natural-peak-v56.png" fetchpriority="high">\n</head>');
  }
  return source;
}

html = updateDocument(html);
preview = updateDocument(preview);

await Promise.all([
  writeFile(runtimeUrl, runtime), writeFile(prototypeUrl, prototype), writeFile(cssUrl, css),
  writeFile(indexUrl, html), writeFile(previewUrl, preview)
]);

console.log('Applied Summit Sprint V56 wider route spacing, hand-to-ledge contact, and natural final-hold summit peak.');
