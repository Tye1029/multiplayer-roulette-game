import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const runtimeUrl = new URL('assets/mountain-race/mountain-race-multiplayer.js', root);
const prototypeUrl = new URL('assets/mountain-race/mountain-race.js', root);
const cssUrl = new URL('assets/mountain-race/mountain-race.css', root);
const indexUrl = new URL('index.html', root);
const previewUrl = new URL('mountain-race-preview.html', root);
const marker = 'MOUNTAIN_RACE_MOTION_SMOOTHING_V35';
const frames = Array.from({ length: 6 }, (_, index) => `<span class="mr-motion-frame mr-motion-frame-${index}" style="--mr-motion-frame:${index}" aria-hidden="true"></span>`).join('');

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Summit Sprint V35 could not find ${label}.`);
  return source.replace(before, after);
}

let [runtime, prototypeRuntime, css, html, preview] = await Promise.all([
  readFile(runtimeUrl, 'utf8'), readFile(prototypeUrl, 'utf8'), readFile(cssUrl, 'utf8'),
  readFile(indexUrl, 'utf8'), readFile(previewUrl, 'utf8')
]);

if (!runtime.includes(marker)) {
  runtime = replaceRequired(
    runtime,
    '        <span class="mr-leg left-leg"></span><span class="mr-leg right-leg"></span>',
    `        <span class="mr-leg left-leg"></span><span class="mr-leg right-leg"></span>${frames}\n        <!-- ${marker} -->`,
    'multiplayer climber frame layers'
  );
}
if (!prototypeRuntime.includes(marker)) {
  prototypeRuntime = replaceRequired(
    prototypeRuntime,
    '        <span class="mr-leg right-leg"></span>',
    `        <span class="mr-leg right-leg"></span>${frames}\n        <!-- ${marker} -->`,
    'prototype climber frame layers'
  );
}

if (!css.includes(marker)) css += String.raw`

/* MOUNTAIN_RACE_MOTION_SMOOTHING_V35
   The decoded V33 resting pose remains visible beneath six cross-faded V34 frames. */
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber.climb-up,
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber.climb-left,
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber.climb-right,
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber.climb-down {
  animation: mrV35Travel 540ms cubic-bezier(.2,.72,.28,1) both !important;
}
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber.slip {
  animation: mr-slip 540ms cubic-bezier(.3,.02,.65,1) both !important;
}
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber.climb-up::before,
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber.climb-left::before,
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber.climb-right::before,
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber.climb-down::before,
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber.slip::before {
  animation: none !important;
  background-image: url('/assets/mountain-race/images/summit-sprint-climber-blue-v33.png') !important;
}
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber.opponent.climb-up::before,
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber.opponent.climb-left::before,
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber.opponent.climb-right::before,
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber.opponent.climb-down::before,
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber.opponent.slip::before {
  background-image: url('/assets/mountain-race/images/summit-sprint-climber-orange-v33.png') !important;
}

[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber > .mr-motion-frame {
  position: absolute !important;
  z-index: 2 !important;
  inset: 0 !important;
  display: none !important;
  opacity: 0;
  background-size: 300% 200% !important;
  background-repeat: no-repeat !important;
  pointer-events: none;
}
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber:is(.climb-up,.climb-left,.climb-right,.climb-down,.slip) > .mr-motion-frame {
  display: block !important;
  animation: mrV35FrameFade 180ms ease-in-out both;
  animation-delay: calc(var(--mr-motion-frame) * 72ms);
}
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber:is(.climb-up,.climb-left,.climb-right,.climb-down,.slip) > .mr-motion-frame-5 {
  animation-name: mrV35LastFrame;
}
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-motion-frame-0 { background-position: 0 0 !important; }
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-motion-frame-1 { background-position: 50% 0 !important; }
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-motion-frame-2 { background-position: 100% 0 !important; }
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-motion-frame-3 { background-position: 0 100% !important; }
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-motion-frame-4 { background-position: 50% 100% !important; }
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-motion-frame-5 { background-position: 100% 100% !important; }

${['up','left','right'].map(direction => `[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber.climb-${direction} > .mr-motion-frame { background-image: url('/assets/mountain-race/images/summit-sprint-climber-blue-${direction}-v34.png') !important; }
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber.opponent.climb-${direction} > .mr-motion-frame { background-image: url('/assets/mountain-race/images/summit-sprint-climber-orange-${direction}-v34.png') !important; }`).join('\n')}
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber:is(.climb-down,.slip) > .mr-motion-frame { background-image: url('/assets/mountain-race/images/summit-sprint-climber-blue-down-v34.png') !important; }
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber.opponent:is(.climb-down,.slip) > .mr-motion-frame { background-image: url('/assets/mountain-race/images/summit-sprint-climber-orange-down-v34.png') !important; }

@keyframes mrV35FrameFade {
  0% { opacity: 0; }
  18%, 72% { opacity: 1; }
  100% { opacity: 0; }
}
@keyframes mrV35LastFrame {
  0% { opacity: 0; }
  24%, 100% { opacity: 1; }
}
@keyframes mrV35Travel {
  0% { transform: translate(-50%, 50%) translateY(4px); }
  48% { transform: translate(calc(-50% + var(--mr-v32-reach, 0px)), 50%) translateY(-8px); }
  100% { transform: translate(-50%, 50%) translateY(0); }
}
`;

const prefetchMarker = '<!-- MOUNTAIN_RACE_V35_MOTION_PREFETCH -->';
const prefetches = `${prefetchMarker}\n  ${['blue','orange'].flatMap(color => ['up','left','right','down'].map(direction => `<link rel="prefetch" as="image" href="/assets/mountain-race/images/summit-sprint-climber-${color}-${direction}-v34.png">`)).join('\n  ')}`;
if (!html.includes(prefetchMarker)) html = html.replace('</head>', `${prefetches}\n</head>`);
if (!preview.includes(prefetchMarker)) preview = preview.replace('</head>', `${prefetches}\n</head>`);
html = html.replace(/(?:&visual=\d+)+/g, '&visual=35');
preview = preview.replace(/(?:&visual=\d+)+/g, '&visual=35');

await Promise.all([
  writeFile(runtimeUrl, runtime), writeFile(prototypeUrl, prototypeRuntime), writeFile(cssUrl, css),
  writeFile(indexUrl, html), writeFile(previewUrl, preview)
]);
console.log('Applied Summit Sprint V35 decoded, cross-faded motion frames without character-layer flashes.');
