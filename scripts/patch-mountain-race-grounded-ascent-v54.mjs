import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const runtimeUrl = new URL('assets/mountain-race/mountain-race-multiplayer.js', root);
const prototypeUrl = new URL('assets/mountain-race/mountain-race.js', root);
const cssUrl = new URL('assets/mountain-race/mountain-race.css', root);
const indexUrl = new URL('index.html', root);
const previewUrl = new URL('mountain-race-preview.html', root);
const marker = 'MOUNTAIN_RACE_GROUNDED_ASCENT_V54';

function required(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Summit Sprint V54 could not find ${label}.`);
  return source.replace(before, after);
}

let [runtime, prototype, css, html, preview] = await Promise.all([
  readFile(runtimeUrl, 'utf8'), readFile(prototypeUrl, 'utf8'), readFile(cssUrl, 'utf8'),
  readFile(indexUrl, 'utf8'), readFile(previewUrl, 'utf8')
]);

for (const source of [runtime, prototype]) {
  if (!source.includes('MOUNTAIN_RACE_WINNER_CAMERA_V53')) {
    throw new Error('Summit Sprint V54 requires the V53 winner camera first.');
  }
}

if (!runtime.includes(marker)) {
  runtime = required(runtime,
    "    root.dataset.mrWinnerCamera = '53';\n    // MOUNTAIN_RACE_WINNER_CAMERA_V53",
    "    root.dataset.mrWinnerCamera = '53';\n    root.dataset.mrGroundedAscent = '54';\n    // MOUNTAIN_RACE_GROUNDED_ASCENT_V54\n    // MOUNTAIN_RACE_WINNER_CAMERA_V53",
    'multiplayer V54 dataset');
  runtime = required(runtime,
    '    return [24, 62, 38, 70, 31, 57][index % 6];',
    '    return [38, 58, 44, 62, 40, 55][index % 6];',
    'multiplayer tighter horizontal route');
  runtime = required(runtime,
    '      const lastVisible = Math.min(total - 1, currentIndex + 3);',
    '      const lastVisible = Math.min(total - 1, currentIndex + 7);',
    'multiplayer eight visible holds');
  runtime = required(runtime,
    '${120 + index * 84}px', '${120 + index * 42}px', 'multiplayer hold spacing');
  runtime = required(runtime,
    '${120 + total * 84}px', '${120 + total * 42}px', 'multiplayer summit spacing');
  runtime = required(runtime,
    '      const travelDirection = contactLeft < previousContactLeft ? \'left\' : \'right\';\n      const gripBottom = finished ? 196 + Number(total || 0) * 84 : contactIndex >= 0 ? 160 + contactIndex * 84 : 76;\n      const finishClass = finished ? \'finished standing-on-summit\' : \'\';',
    '      const nextContactLeft = finished ? 50 : index < Number(total || 0) ? holdLeft(index) : contactLeft;\n      const travelDirection = nextContactLeft < contactLeft ? \'left\' : \'right\';\n      const gripBottom = finished ? 196 + Number(total || 0) * 42 : contactIndex >= 0 ? 160 + contactIndex * 42 : 76;\n      const finishClass = finished ? \'finished standing-on-summit\' : \'\';\n      const startClass = !finished && contactIndex < 0 ? \'standing-start\' : \'\';\n      const readyClass = !finished && contactIndex >= 0 ? \'ready-next\' : \'\';',
    'multiplayer grounded and next-grip pose state');
  runtime = required(runtime,
    '<div class="mr-climber ${side} ${animation} ${finishClass} direction-${travelDirection}"',
    '<div class="mr-climber ${side} ${animation} ${finishClass} ${startClass} ${readyClass} direction-${travelDirection}"',
    'multiplayer pose classes');
  runtime = required(runtime,
    '      const scroll = Math.max(0, cameraIndex - 1) * 84;',
    '      const scroll = Math.max(0, cameraIndex - 1) * 42;',
    'multiplayer closer camera spacing');
  runtime = required(runtime,
    '${Math.max(2600, 580 + total * 84)}px', '${Math.max(2600, 580 + total * 42)}px',
    'multiplayer wall height');
}

if (!prototype.includes(marker)) {
  prototype = required(prototype,
    "    root.dataset.mrWinnerCamera = '53';\n    // MOUNTAIN_RACE_WINNER_CAMERA_V53",
    "    root.dataset.mrWinnerCamera = '53';\n    root.dataset.mrGroundedAscent = '54';\n    // MOUNTAIN_RACE_GROUNDED_ASCENT_V54\n    // MOUNTAIN_RACE_WINNER_CAMERA_V53",
    'prototype V54 dataset');
  prototype = required(prototype,
    '    const base = [24, 62, 38, 70, 31, 57][index % 6];',
    '    const base = [38, 58, 44, 62, 40, 55][index % 6];',
    'prototype tighter horizontal route');
  prototype = required(prototype,
    "    if (token === 'left') return Math.max(17, base - 10);\n    if (token === 'right') return Math.min(83, base + 10);",
    "    if (token === 'left') return Math.max(30, base - 10);\n    if (token === 'right') return Math.min(70, base + 10);",
    'prototype safe mobile route margins');
  prototype = required(prototype,
    '      const lastVisible = Math.min(total - 1, player.promptIndex + 3);',
    '      const lastVisible = Math.min(total - 1, player.promptIndex + 7);',
    'prototype eight visible holds');
  prototype = required(prototype,
    '${120 + index * 84}px', '${120 + index * 42}px', 'prototype hold spacing');
  prototype = required(prototype,
    '${120 + total * 84}px', '${120 + total * 42}px', 'prototype summit spacing');
  prototype = required(prototype,
    '      const travelDirection = contactLeft < previousContactLeft ? \'left\' : \'right\';\n      const gripBottom = finished ? 196 + TOTAL_HOLDS * 84 : contactIndex >= 0 ? 160 + contactIndex * 84 : 76;',
    '      const nextContactLeft = finished ? 50 : index < TOTAL_HOLDS ? holdHorizontal(index, sequence[index]) : contactLeft;\n      const travelDirection = nextContactLeft < contactLeft ? \'left\' : \'right\';\n      const gripBottom = finished ? 196 + TOTAL_HOLDS * 42 : contactIndex >= 0 ? 160 + contactIndex * 42 : 76;\n      const startClass = !finished && contactIndex < 0 ? \'standing-start\' : \'\';\n      const readyClass = !finished && contactIndex >= 0 ? \'ready-next\' : \'\';',
    'prototype grounded and next-grip pose state');
  prototype = required(prototype,
    '<div class="mr-climber ${playerKey} ${escapeHtml(player.animation)} ${finished ? \'finished standing-on-summit\' : \'\'} direction-${travelDirection}"',
    '<div class="mr-climber ${playerKey} ${escapeHtml(player.animation)} ${finished ? \'finished standing-on-summit\' : \'\'} ${startClass} ${readyClass} direction-${travelDirection}"',
    'prototype pose classes');
  prototype = required(prototype,
    '      const scroll = Math.max(0, cameraIndex - 1) * 84;',
    '      const scroll = Math.max(0, cameraIndex - 1) * 42;',
    'prototype closer camera spacing');
  prototype = required(prototype,
    '${Math.max(2600, 580 + total * 84)}px', '${Math.max(2600, 580 + total * 42)}px',
    'prototype wall height');
}

if (!css.includes(marker)) css += String.raw`

/* MOUNTAIN_RACE_GROUNDED_ASCENT_V54
   The race is one continuous edge-to-edge cliff. The lane cameras use opposite
   halves of the same rock image, with a full-height anchored rope masking their
   independent movement. Climbers start planted on a real grass-and-rock ledge;
   closer holds leave the resting climber reaching toward the next grip. */
[data-mountain-race-mount][data-mr-grounded-ascent="54"] {
  overflow-x: clip !important;
  background: url('/assets/mountain-race/images/summit-sprint-natural-cliff-v49.png') center center / cover no-repeat !important;
}
[data-mountain-race-mount][data-mr-grounded-ascent="54"] .mountain-race-game {
  background: url('/assets/mountain-race/images/summit-sprint-natural-cliff-v49.png') center center / cover no-repeat !important;
}
[data-mountain-race-mount][data-mr-grounded-ascent="54"] .mr-race-stage {
  position: relative !important;
  gap: 0 !important;
  margin-inline: calc(-1 * clamp(7px, 1.3vw, 13px)) !important;
  width: auto !important;
  max-width: none !important;
  background: url('/assets/mountain-race/images/summit-sprint-natural-cliff-v49.png') center center / cover no-repeat !important;
}
[data-mountain-race-mount][data-mr-grounded-ascent="54"] .mr-race-stage::before { content: none !important; }
[data-mountain-race-mount][data-mr-grounded-ascent="54"] .mr-lane {
  border: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
}
[data-mountain-race-mount][data-mr-grounded-ascent="54"] .mr-mountain-wall {
  width: 100% !important;
  background: transparent !important;
  box-shadow: none !important;
}
[data-mountain-race-mount][data-mr-grounded-ascent="54"] .mr-v44-cliff {
  inset: -56px 0 -38px !important;
  background-image: url('/assets/mountain-race/images/summit-sprint-natural-cliff-v49.png') !important;
  background-size: auto 100% !important;
  background-repeat: no-repeat !important;
  filter: none !important;
}
[data-mountain-race-mount][data-mr-grounded-ascent="54"] .mr-lane.me .mr-v44-cliff {
  background-position: left center !important;
}
[data-mountain-race-mount][data-mr-grounded-ascent="54"] .mr-lane.opponent .mr-v44-cliff {
  background-position: right center !important;
  transform: none !important;
}
[data-mountain-race-mount][data-mr-grounded-ascent="54"] .mr-v51-center-rope {
  position: absolute !important;
  z-index: 22 !important;
  top: 0 !important;
  bottom: -205px !important;
  left: 50% !important;
  width: 12px !important;
  transform: translateX(-50%) !important;
  border: 0 !important;
  border-radius: 0 !important;
  background: none !important;
  box-shadow: none !important;
  animation: none !important;
  pointer-events: none !important;
}
[data-mountain-race-mount][data-mr-grounded-ascent="54"] .mr-v51-center-rope::before {
  content: '' !important;
  position: absolute !important;
  z-index: 2 !important;
  top: 48px !important;
  left: 50% !important;
  width: 22px !important;
  height: 22px !important;
  transform: translate(-50%, -50%) !important;
  border: 5px solid #6c4b28 !important;
  border-radius: 50% !important;
  background: #25231d !important;
  box-shadow: inset 0 0 0 2px #b58a50, 0 3px 5px rgba(0,0,0,.65) !important;
}
[data-mountain-race-mount][data-mr-grounded-ascent="54"] .mr-v51-center-rope::after {
  content: '';
  position: absolute;
  top: 52px;
  bottom: 0;
  left: 50%;
  width: 10px;
  transform: translateX(-50%);
  border-radius: 5px;
  background:
    linear-gradient(90deg, rgba(39,24,10,.72), transparent 24% 70%, rgba(46,27,11,.72)),
    repeating-linear-gradient(30deg, #9c7238 0 4px, #d0a45e 4px 7px, #765024 7px 11px);
  box-shadow: inset 2px 0 rgba(255,225,166,.24), inset -2px 0 rgba(36,21,8,.34), 0 2px 4px rgba(0,0,0,.62);
}
[data-mountain-race-mount][data-mr-grounded-ascent="54"] .mr-v51-center-rope i { display: none !important; }
[data-mountain-race-mount][data-mr-grounded-ascent="54"] .mr-v44-start {
  bottom: -26px !important;
  width: 92% !important;
  height: 126px !important;
  background: url('/assets/mountain-race/images/summit-sprint-start-grass-v54.png') center bottom / contain no-repeat !important;
  filter: drop-shadow(0 9px 6px rgba(20,12,7,.48)) !important;
}
[data-mountain-race-mount][data-mr-grounded-ascent="54"] .mr-v44-start i,
[data-mountain-race-mount][data-mr-grounded-ascent="54"] .mr-v44-start i::before { display: none !important; }
[data-mountain-race-mount][data-mr-grounded-ascent="54"] .mr-climber.standing-start {
  left: 50% !important;
  transform: translate(-50%, 24%) !important;
  transform-origin: 50% 100% !important;
}
[data-mountain-race-mount][data-mr-grounded-ascent="54"] .mr-climber.standing-start > .mr-v45-climber-sprite {
  --mr-v45-frame-x: 100%;
  --mr-v45-frame-y: 100%;
  background-position: 100% 100% !important;
  transform: none !important;
  animation: none !important;
}
[data-mountain-race-mount][data-mr-grounded-ascent="54"] .mr-climber.ready-next:not(.climb-up):not(.climb-left):not(.climb-right):not(.climb-down):not(.slip) > .mr-v45-climber-sprite {
  --mr-v45-frame-x: 66.667%;
  --mr-v45-frame-y: 0%;
  background-position: 66.667% 0% !important;
}
@keyframes mrV45ReachFrames {
  0%, 14% { --mr-v45-frame-x: 0%; --mr-v45-frame-y: 0%; }
  14.01%, 33% { --mr-v45-frame-x: 33.333%; --mr-v45-frame-y: 0%; }
  33.01%, 55% { --mr-v45-frame-x: 66.667%; --mr-v45-frame-y: 0%; }
  55.01%, 76% { --mr-v45-frame-x: 100%; --mr-v45-frame-y: 0%; }
  76.01%, 100% { --mr-v45-frame-x: 66.667%; --mr-v45-frame-y: 0%; }
}
@media (max-width: 620px) {
  [data-mountain-race-mount][data-mr-grounded-ascent="54"] .mr-race-stage { margin-inline: -5px !important; }
  [data-mountain-race-mount][data-mr-grounded-ascent="54"] .mr-v51-center-rope { width: 9px !important; bottom: -250px !important; }
  [data-mountain-race-mount][data-mr-grounded-ascent="54"] .mr-v51-center-rope::before { top: 43px !important; width: 18px !important; height: 18px !important; border-width: 4px !important; }
  [data-mountain-race-mount][data-mr-grounded-ascent="54"] .mr-v51-center-rope::after { top: 47px !important; width: 7px !important; }
  [data-mountain-race-mount][data-mr-grounded-ascent="54"] .mr-v44-start { bottom: -23px !important; width: 96% !important; height: 100px !important; }
  [data-mountain-race-mount][data-mr-grounded-ascent="54"] .mr-climber.standing-start { transform: translate(-50%, 36%) !important; }
}
`;

function updateDocument(source) {
  source = source.replace(/(?:&visual=\d+)+/g, '&visual=54');
  source = source.replace('mountain-race.js?prototype=1"', 'mountain-race.js?prototype=1&visual=54"');
  if (!source.includes('summit-sprint-start-grass-v54.png')) {
    source = source.replace('</head>', '  <link rel="preload" as="image" href="/assets/mountain-race/images/summit-sprint-start-grass-v54.png" fetchpriority="high">\n</head>');
  }
  return source;
}

html = updateDocument(html);
preview = updateDocument(preview);

await Promise.all([
  writeFile(runtimeUrl, runtime), writeFile(prototypeUrl, prototype), writeFile(cssUrl, css),
  writeFile(indexUrl, html), writeFile(previewUrl, preview)
]);

console.log('Applied Summit Sprint V54 edge-to-edge cliff, anchored full-height rope, grounded grass starts, and closer next-grip route spacing.');
