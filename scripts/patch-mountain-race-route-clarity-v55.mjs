import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const runtimeUrl = new URL('assets/mountain-race/mountain-race-multiplayer.js', root);
const prototypeUrl = new URL('assets/mountain-race/mountain-race.js', root);
const cssUrl = new URL('assets/mountain-race/mountain-race.css', root);
const indexUrl = new URL('index.html', root);
const previewUrl = new URL('mountain-race-preview.html', root);
const marker = 'MOUNTAIN_RACE_ROUTE_CLARITY_V55';

function required(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Summit Sprint V55 could not find ${label}.`);
  return source.replace(before, after);
}

let [runtime, prototype, css, html, preview] = await Promise.all([
  readFile(runtimeUrl, 'utf8'), readFile(prototypeUrl, 'utf8'), readFile(cssUrl, 'utf8'),
  readFile(indexUrl, 'utf8'), readFile(previewUrl, 'utf8')
]);

for (const source of [runtime, prototype]) {
  if (!source.includes('MOUNTAIN_RACE_GROUNDED_ASCENT_V54')) {
    throw new Error('Summit Sprint V55 requires the V54 grounded ascent first.');
  }
}

if (!runtime.includes(marker)) {
  runtime = required(runtime,
    "    root.dataset.mrGroundedAscent = '54';\n    // MOUNTAIN_RACE_GROUNDED_ASCENT_V54",
    "    root.dataset.mrGroundedAscent = '54';\n    root.dataset.mrRouteClarity = '55';\n    // MOUNTAIN_RACE_ROUTE_CLARITY_V55\n    // MOUNTAIN_RACE_GROUNDED_ASCENT_V54",
    'multiplayer V55 dataset');
  runtime = required(runtime, 'currentIndex + 7', 'currentIndex + 4', 'multiplayer five visible holds');
  runtime = required(runtime,
    "      const startClass = !finished && contactIndex < 0 ? 'standing-start' : '';\n      const readyClass = !finished && contactIndex >= 0 ? 'ready-next' : '';",
    "      const raceLive = runtime.game?.status === 'playing';\n      const startClass = !finished && contactIndex < 0 ? 'standing-start' : '';\n      const startPoseClass = !finished && contactIndex < 0 ? (raceLive ? 'start-reaching' : 'start-waiting') : '';\n      const readyClass = !finished && contactIndex >= 0 ? 'ready-next' : '';",
    'multiplayer countdown and live start poses');
  runtime = required(runtime,
    '${finishClass} ${startClass} ${readyClass} direction-${travelDirection}',
    '${finishClass} ${startClass} ${startPoseClass} ${readyClass} direction-${travelDirection}',
    'multiplayer start pose class');
  runtime = required(runtime, '${120 + index * 42}px', '${120 + index * 60}px', 'multiplayer hold spacing');
  runtime = required(runtime, '${120 + total * 42}px', '${120 + total * 60}px', 'multiplayer summit spacing');
  runtime = required(runtime,
    'const gripBottom = finished ? 196 + Number(total || 0) * 42 : contactIndex >= 0 ? 160 + contactIndex * 42 : 76;',
    'const gripBottom = finished ? 196 + Number(total || 0) * 60 : contactIndex >= 0 ? 160 + contactIndex * 60 : 76;',
    'multiplayer climber spacing');
  runtime = required(runtime,
    'const scroll = Math.max(0, cameraIndex - 1) * 42;',
    'const scroll = Math.max(0, cameraIndex - 1) * 60;',
    'multiplayer camera spacing');
  runtime = required(runtime,
    '${Math.max(2600, 580 + total * 42)}px',
    '${Math.max(2600, 580 + total * 60)}px',
    'multiplayer wall height');
}

if (!prototype.includes(marker)) {
  prototype = required(prototype,
    "    root.dataset.mrGroundedAscent = '54';\n    // MOUNTAIN_RACE_GROUNDED_ASCENT_V54",
    "    root.dataset.mrGroundedAscent = '54';\n    root.dataset.mrRouteClarity = '55';\n    // MOUNTAIN_RACE_ROUTE_CLARITY_V55\n    // MOUNTAIN_RACE_GROUNDED_ASCENT_V54",
    'prototype V55 dataset');
  prototype = required(prototype, 'player.promptIndex + 7', 'player.promptIndex + 4', 'prototype five visible holds');
  prototype = required(prototype,
    "      const startClass = !finished && contactIndex < 0 ? 'standing-start' : '';\n      const readyClass = !finished && contactIndex >= 0 ? 'ready-next' : '';",
    "      const raceLive = runtime.state?.status === 'racing';\n      const startClass = !finished && contactIndex < 0 ? 'standing-start' : '';\n      const startPoseClass = !finished && contactIndex < 0 ? (raceLive ? 'start-reaching' : 'start-waiting') : '';\n      const readyClass = !finished && contactIndex >= 0 ? 'ready-next' : '';",
    'prototype countdown and live start poses');
  prototype = required(prototype,
    "${finished ? 'finished standing-on-summit' : ''} ${startClass} ${readyClass} direction-${travelDirection}",
    "${finished ? 'finished standing-on-summit' : ''} ${startClass} ${startPoseClass} ${readyClass} direction-${travelDirection}",
    'prototype start pose class');
  prototype = required(prototype, '${120 + index * 42}px', '${120 + index * 60}px', 'prototype hold spacing');
  prototype = required(prototype, '${120 + total * 42}px', '${120 + total * 60}px', 'prototype summit spacing');
  prototype = required(prototype,
    'const gripBottom = finished ? 196 + TOTAL_HOLDS * 42 : contactIndex >= 0 ? 160 + contactIndex * 42 : 76;',
    'const gripBottom = finished ? 196 + TOTAL_HOLDS * 60 : contactIndex >= 0 ? 160 + contactIndex * 60 : 76;',
    'prototype climber spacing');
  prototype = required(prototype,
    'const scroll = Math.max(0, cameraIndex - 1) * 42;',
    'const scroll = Math.max(0, cameraIndex - 1) * 60;',
    'prototype camera spacing');
  prototype = required(prototype,
    '${Math.max(2600, 580 + total * 42)}px',
    '${Math.max(2600, 580 + total * 60)}px',
    'prototype wall height');
}

if (!css.includes(marker)) css += String.raw`

/* MOUNTAIN_RACE_ROUTE_CLARITY_V55
   Five evenly separated nearby ledges keep the next route readable. The active
   direction stays above the climber, while a dedicated rear-view start sprite
   waits on the grass with both hands raised toward the first hold. */
[data-mountain-race-mount][data-mr-route-clarity="55"] .mr-rock-hold.current {
  z-index: 16 !important;
}
[data-mountain-race-mount][data-mr-route-clarity="55"] .mr-rock-hold.current b {
  top: -12px !important;
  box-shadow: 0 3px 8px rgba(0,0,0,.62) !important;
}
[data-mountain-race-mount][data-mr-visual-reboot="44"][data-mr-contact-ledges="45"][data-mr-route-clarity="55"] .mr-climber.standing-start > .mr-motion-frame-0.mr-v44-climber-sprite.mr-v45-climber-sprite {
  background-image: url('/assets/mountain-race/images/summit-sprint-waiting-climbers-v55.png') !important;
  background-size: 200% 100% !important;
  background-position: left center !important;
  transform: none !important;
  animation: none !important;
}
[data-mountain-race-mount][data-mr-visual-reboot="44"][data-mr-contact-ledges="45"][data-mr-route-clarity="55"] .mr-climber.standing-start.opponent > .mr-motion-frame-0.mr-v44-climber-sprite.mr-v45-climber-sprite {
  background-position: right center !important;
}
[data-mountain-race-mount][data-mr-visual-reboot="44"][data-mr-contact-ledges="45"][data-mr-route-clarity="55"] .mr-climber.standing-start.start-reaching > .mr-motion-frame-0.mr-v44-climber-sprite.mr-v45-climber-sprite {
  background-image: url('/assets/mountain-race/images/summit-sprint-start-climbers-v55.png') !important;
}
[data-mountain-race-mount][data-mr-visual-reboot="44"][data-mr-contact-ledges="45"][data-mr-route-clarity="55"] .mr-climber.standing-start.start-reaching.direction-left > .mr-motion-frame-0.mr-v44-climber-sprite.mr-v45-climber-sprite {
  transform: scaleX(-1) !important;
}
[data-mountain-race-mount][data-mr-visual-reboot="44"][data-mr-contact-ledges="45"][data-mr-route-clarity="55"] .mr-climber.standing-start.start-reaching.direction-right > .mr-motion-frame-0.mr-v44-climber-sprite.mr-v45-climber-sprite {
  transform: none !important;
}
`;

function updateDocument(source) {
  source = source.replace(/(?:&visual=\d+)+/g, '&visual=55');
  source = source.replace('mountain-race.js?prototype=1"', 'mountain-race.js?prototype=1&visual=55"');
  if (!source.includes('summit-sprint-start-climbers-v55.png')) {
    source = source.replace('</head>', '  <link rel="preload" as="image" href="/assets/mountain-race/images/summit-sprint-start-climbers-v55.png" fetchpriority="high">\n</head>');
  }
  if (!source.includes('summit-sprint-waiting-climbers-v55.png')) {
    source = source.replace('</head>', '  <link rel="preload" as="image" href="/assets/mountain-race/images/summit-sprint-waiting-climbers-v55.png" fetchpriority="high">\n</head>');
  }
  return source;
}

html = updateDocument(html);
preview = updateDocument(preview);

await Promise.all([
  writeFile(runtimeUrl, runtime), writeFile(prototypeUrl, prototype), writeFile(cssUrl, css),
  writeFile(indexUrl, html), writeFile(previewUrl, preview)
]);

console.log('Applied Summit Sprint V55 readable five-ledge route spacing, foreground active prompts, and separate waiting/live rear-view start poses.');
