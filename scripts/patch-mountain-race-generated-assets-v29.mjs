import { readFile, writeFile } from 'node:fs/promises';

const rootUrl = new URL('../', import.meta.url);
const cssUrl = new URL('assets/mountain-race/mountain-race.css', rootUrl);
const runtimeUrl = new URL('assets/mountain-race/mountain-race-multiplayer.js', rootUrl);
const prototypeRuntimeUrl = new URL('assets/mountain-race/mountain-race.js', rootUrl);
const indexUrl = new URL('index.html', rootUrl);
const previewUrl = new URL('mountain-race-preview.html', rootUrl);
const marker = 'MOUNTAIN_RACE_GENERATED_ASSETS_V29';

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Summit Sprint V29 could not find ${label}.`);
  return source.replace(before, after);
}

let [css, runtime, prototypeRuntime, html, preview] = await Promise.all([
  readFile(cssUrl, 'utf8'),
  readFile(runtimeUrl, 'utf8'),
  readFile(prototypeRuntimeUrl, 'utf8'),
  readFile(indexUrl, 'utf8'),
  readFile(previewUrl, 'utf8')
]);

if (!runtime.includes(marker)) {
  runtime = replaceRequired(
    runtime,
    "    root.dataset.mrProfessionalRebuild = '27';",
    `    root.dataset.mrProfessionalRebuild = '27';\n    // ${marker}\n    // V29 replaces every legacy terrain layer with committed high-resolution PNGs.\n    root.dataset.mrGeneratedAssets = '29';`,
    'V27 runtime activation anchor'
  );
}

runtime = runtime
  .replaceAll("summit-sprint-cliff-${side === 'me' ? 'left' : 'right'}-mobile-v27.png", "summit-sprint-cliff-${side === 'me' ? 'left' : 'right'}-v29.png")
  .replaceAll("summit-sprint-cliff-${side === 'me' ? 'left' : 'right'}-desktop-v27.png", "summit-sprint-cliff-${side === 'me' ? 'left' : 'right'}-v29.png")
  .replaceAll("summit-sprint-start-${side === 'me' ? 'left' : 'right'}-v27.png", "summit-sprint-start-${side === 'me' ? 'left' : 'right'}-v29.png")
  .replaceAll("summit-sprint-summit-${side === 'me' ? 'left' : 'right'}-v27.png", "summit-sprint-summit-${side === 'me' ? 'left' : 'right'}-v29.png")
  .replace(/summit-sprint-hold-\$\{\(index % 8\) \+ 1\}-v27\.png/g, 'summit-sprint-hold-${(index % 3) + 1}-v29.png');

runtime = runtime
  .replaceAll('class="mr-hold-art" src="/assets/mountain-race/images/summit-sprint-hold-${(index % 3) + 1}-v29.png" alt="" draggable="false"', 'class="mr-hold-art" src="/assets/mountain-race/images/summit-sprint-hold-${(index % 3) + 1}-v29.png" width="1024" height="1536" alt="" decoding="async" draggable="false"')
  .replaceAll('class="mr-summit-art" src="/assets/mountain-race/images/summit-sprint-summit-${side === \'me\' ? \'left\' : \'right\'}-v29.png" alt="" draggable="false"', 'class="mr-summit-art" src="/assets/mountain-race/images/summit-sprint-summit-${side === \'me\' ? \'left\' : \'right\'}-v29.png" width="1024" height="1536" alt="" decoding="async" loading="lazy" draggable="false"')
  .replaceAll('<img src="/assets/mountain-race/images/summit-sprint-cliff-${side === \'me\' ? \'left\' : \'right\'}-v29.png" alt="" draggable="false">', '<img src="/assets/mountain-race/images/summit-sprint-cliff-${side === \'me\' ? \'left\' : \'right\'}-v29.png" width="1024" height="1536" alt="" decoding="async" fetchpriority="high" draggable="false">')
  .replaceAll('class="mr-start-art" src="/assets/mountain-race/images/summit-sprint-start-${side === \'me\' ? \'left\' : \'right\'}-v29.png" alt="" draggable="false"', 'class="mr-start-art" src="/assets/mountain-race/images/summit-sprint-start-${side === \'me\' ? \'left\' : \'right\'}-v29.png" width="1024" height="1536" alt="" decoding="async" draggable="false"');

if (!prototypeRuntime.includes(marker)) {
  prototypeRuntime = replaceRequired(
    prototypeRuntime,
    '      return `<span class="${classes}" style="--mr-hold-bottom:${bottom}px;--mr-hold-left:${left}%" aria-hidden="true"><b>${promptLabel(token)}</b></span>`;',
    '      return `<span class="${classes}" style="--mr-hold-bottom:${bottom}px;--mr-hold-left:${left}%" aria-hidden="true"><img class="mr-hold-art" src="/assets/mountain-race/images/summit-sprint-hold-${(index % 3) + 1}-v29.png" width="1024" height="1536" alt="" decoding="async" draggable="false"><b>${promptLabel(token)}</b></span>`;',
    'prototype hold image layer'
  );
  prototypeRuntime = replaceRequired(
    prototypeRuntime,
    '    return `${holds}<span class="mr-finish-ledge" style="--mr-summit-bottom:${summitBottom}px" aria-hidden="true"><i></i><b>SUMMIT</b></span>`;',
    '    return `${holds}<span class="mr-finish-ledge mr-summit-plateau" style="--mr-summit-bottom:${summitBottom}px" aria-hidden="true"><img class="mr-summit-art" src="/assets/mountain-race/images/summit-sprint-summit-${playerKey === \'me\' ? \'left\' : \'right\'}-v29.png" width="1024" height="1536" alt="" decoding="async" loading="lazy" draggable="false"><i></i><b>SUMMIT</b></span>`;',
    'prototype summit image layer'
  );
  prototypeRuntime = replaceRequired(
    prototypeRuntime,
    '<div class="mr-mountain-wall" style="--mr-wall-scroll:${scroll}px">',
    '<div class="mr-mountain-wall" style="--mr-wall-scroll:${scroll}px">\n            <picture class="mr-cliff-art" aria-hidden="true"><img src="/assets/mountain-race/images/summit-sprint-cliff-${playerKey === \'me\' ? \'left\' : \'right\'}-v29.png" width="1024" height="1536" alt="" decoding="async" fetchpriority="high" draggable="false"></picture>\n            <img class="mr-start-art" src="/assets/mountain-race/images/summit-sprint-start-${playerKey === \'me\' ? \'left\' : \'right\'}-v29.png" width="1024" height="1536" alt="" decoding="async" draggable="false">',
    'prototype cliff and start image layers'
  );
  prototypeRuntime = replaceRequired(
    prototypeRuntime,
    '    runtime.root = root;',
    `    runtime.root = root;
    // ${marker}
    root.setAttribute('data-mountain-race-mount', '');
    root.dataset.mrProfessionalRebuild = '27';
    root.dataset.mrGeneratedAssets = '29';`,
    'prototype V29 activation'
  );
}

prototypeRuntime = prototypeRuntime
  .replaceAll('class="mr-hold-art" src="/assets/mountain-race/images/summit-sprint-hold-${(index % 3) + 1}-v29.png" alt="" draggable="false"', 'class="mr-hold-art" src="/assets/mountain-race/images/summit-sprint-hold-${(index % 3) + 1}-v29.png" width="1024" height="1536" alt="" decoding="async" draggable="false"')
  .replaceAll('class="mr-summit-art" src="/assets/mountain-race/images/summit-sprint-summit-${playerKey === \'me\' ? \'left\' : \'right\'}-v29.png" alt="" draggable="false"', 'class="mr-summit-art" src="/assets/mountain-race/images/summit-sprint-summit-${playerKey === \'me\' ? \'left\' : \'right\'}-v29.png" width="1024" height="1536" alt="" decoding="async" loading="lazy" draggable="false"')
  .replaceAll('<img src="/assets/mountain-race/images/summit-sprint-cliff-${playerKey === \'me\' ? \'left\' : \'right\'}-v29.png" alt="" draggable="false">', '<img src="/assets/mountain-race/images/summit-sprint-cliff-${playerKey === \'me\' ? \'left\' : \'right\'}-v29.png" width="1024" height="1536" alt="" decoding="async" fetchpriority="high" draggable="false">')
  .replaceAll('class="mr-start-art" src="/assets/mountain-race/images/summit-sprint-start-${playerKey === \'me\' ? \'left\' : \'right\'}-v29.png" alt="" draggable="false"', 'class="mr-start-art" src="/assets/mountain-race/images/summit-sprint-start-${playerKey === \'me\' ? \'left\' : \'right\'}-v29.png" width="1024" height="1536" alt="" decoding="async" draggable="false"');

if (!css.includes(marker)) {
  css += String.raw`

/* MOUNTAIN_RACE_GENERATED_ASSETS_V29
   Direct high-resolution PNG presentation. The cliff, grass and ledge artwork
   is rendered through real image elements at its native 2:3 aspect ratio;
   nothing is tiled, polygon-masked or non-uniformly stretched. */
[data-mountain-race-mount][data-mr-generated-assets="29"] {
  background-color: #91b9cf !important;
  background-image: linear-gradient(180deg, rgba(255,255,255,.04), rgba(12,25,27,.13)), url('/assets/mountain-race/images/summit-sprint-sky-v29.png') !important;
  background-position: center center !important;
  background-size: cover !important;
  background-repeat: no-repeat !important;
}
[data-mountain-race-mount][data-mr-generated-assets="29"] > .mr-world-layer,
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-concept-depth-v18,
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-v17-cloud-bank,
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-v17-wind-field,
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-stage-ridge,
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-route-depth,
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-route-rope,
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-start-meadow,
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-summit-turf { display: none !important; }

[data-mountain-race-mount][data-mr-generated-assets="29"] .mountain-race-game {
  width: min(100%, 980px) !important;
  background: transparent !important;
}
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-race-stage {
  width: min(100%, 860px) !important;
  grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  gap: clamp(5px, 1.2vw, 11px) !important;
  padding-inline: clamp(3px, .8vw, 8px) !important;
  background: transparent !important;
}
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-lane,
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climb-viewport {
  border: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
}
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climb-viewport {
  height: 520px !important;
  overflow: hidden !important;
}
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climb-viewport::before {
  background: linear-gradient(102deg, rgba(255,219,155,.12), transparent 32% 72%, rgba(5,13,17,.16)) !important;
}
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climb-viewport::after {
  height: 56px !important;
  background: linear-gradient(0deg, rgba(6,12,12,.28), transparent) !important;
}
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-mountain-wall {
  width: min(390px, calc(100% - 2px)) !important;
  height: 1520px !important;
  background: none !important;
  clip-path: none !important;
  filter: drop-shadow(0 13px 11px rgba(2,7,8,.36)) !important;
}
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-cliff-art {
  inset: auto !important;
  left: 50% !important;
  bottom: 0 !important;
  width: auto !important;
  height: 100% !important;
  overflow: visible !important;
  transform: translateX(-50%) !important;
}
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-cliff-art img {
  width: auto !important;
  height: 100% !important;
  max-width: none !important;
  object-fit: contain !important;
  transform: none !important;
}
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-start-art {
  left: 50% !important;
  bottom: -246px !important;
  width: 440px !important;
  height: 660px !important;
  max-width: none !important;
  object-fit: contain !important;
  transform: translateX(-50%) !important;
  filter: drop-shadow(0 12px 8px rgba(1,6,5,.42)) !important;
}
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-finish-ledge {
  width: 240px !important;
  height: 360px !important;
  background: none !important;
  border: 0 !important;
  box-shadow: none !important;
  filter: drop-shadow(0 11px 8px rgba(2,6,6,.45)) !important;
}
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-summit-art {
  width: 100% !important;
  height: 100% !important;
  object-fit: contain !important;
}
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-finish-ledge > i,
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-finish-ledge > b { z-index: 4 !important; }
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-finish-ledge > i,
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-finish-ledge::before,
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-finish-ledge::after,
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-rock-hold::before,
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-rock-hold::after {
  content: none !important;
  display: none !important;
}
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-rock-hold {
  z-index: 13 !important;
  width: 92px !important;
  height: 138px !important;
  background: none !important;
  border: 0 !important;
  box-shadow: none !important;
  filter: drop-shadow(0 7px 5px rgba(1,5,5,.58)) !important;
}
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-hold-art {
  width: 100% !important;
  height: 100% !important;
  object-fit: contain !important;
}
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-rock-hold b {
  z-index: 5 !important;
  width: 29px !important;
  height: 29px !important;
  border-radius: 50% !important;
  background: rgba(5,10,10,.82) !important;
}
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber { z-index: 20 !important; }
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-player-card { z-index: 31 !important; }
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-altitude-meter { display: none !important; }

@media (max-width: 520px) {
  [data-mountain-race-mount][data-mr-generated-assets="29"] .mr-race-stage { gap: 3px !important; padding-inline: 2px !important; }
  [data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climb-viewport { height: 410px !important; }
  [data-mountain-race-mount][data-mr-generated-assets="29"] .mr-mountain-wall { width: 166px !important; }
  [data-mountain-race-mount][data-mr-generated-assets="29"] .mr-start-art { width: 260px !important; height: 390px !important; bottom: -139px !important; }
  [data-mountain-race-mount][data-mr-generated-assets="29"] .mr-rock-hold { width: 72px !important; height: 108px !important; }
  [data-mountain-race-mount][data-mr-generated-assets="29"] .mr-finish-ledge { width: 190px !important; height: 285px !important; }
}
`;
}

const preloadMarker = '<!-- MOUNTAIN_RACE_V29_PRELOADS -->';
const preloadLinks = `${preloadMarker}
  <link rel="preload" as="image" href="/assets/mountain-race/images/summit-sprint-sky-v29.png" fetchpriority="high">
  <link rel="preload" as="image" href="/assets/mountain-race/images/summit-sprint-cliff-left-v29.png" fetchpriority="high">
  <link rel="preload" as="image" href="/assets/mountain-race/images/summit-sprint-cliff-right-v29.png" fetchpriority="high">`;
if (!html.includes(preloadMarker)) html = html.replace('</head>', `${preloadLinks}\n</head>`);
if (!preview.includes(preloadMarker)) preview = preview.replace('</head>', `${preloadLinks}\n</head>`);
html = html.replace(/(?:&visual=\d+)+/g, '&visual=30');
preview = preview.replace(/(?:&visual=\d+)+/g, '&visual=30');

for (const token of [
  marker,
  "root.dataset.mrGeneratedAssets = '29';",
  "summit-sprint-cliff-${side === 'me' ? 'left' : 'right'}-v29.png",
  "summit-sprint-start-${side === 'me' ? 'left' : 'right'}-v29.png",
  "summit-sprint-summit-${side === 'me' ? 'left' : 'right'}-v29.png",
  'summit-sprint-hold-${(index % 3) + 1}-v29.png'
]) {
  if (!runtime.includes(token)) throw new Error(`Summit Sprint V29 runtime token missing: ${token}`);
}
if (!css.includes(marker) || !css.includes('summit-sprint-sky-v29.png')) throw new Error('Summit Sprint V29 CSS activation missing.');
if (!html.includes('visual=30') || !preview.includes('visual=30')) throw new Error('Summit Sprint V29 cache boundary missing.');
if (!html.includes(preloadMarker) || !preview.includes(preloadMarker)) throw new Error('Summit Sprint V29 preload hints missing.');

await Promise.all([
  writeFile(cssUrl, css),
  writeFile(runtimeUrl, runtime),
  writeFile(prototypeRuntimeUrl, prototypeRuntime),
  writeFile(indexUrl, html),
  writeFile(previewUrl, preview)
]);

console.log('Applied Summit Sprint V29 direct high-resolution cliff, sky, platform and live ledge PNG presentation.');
