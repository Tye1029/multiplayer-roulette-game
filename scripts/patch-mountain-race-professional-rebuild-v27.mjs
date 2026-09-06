import { readFile, writeFile } from 'node:fs/promises';

const rootUrl = new URL('../', import.meta.url);
const cssUrl = new URL('assets/mountain-race/mountain-race.css', rootUrl);
const runtimeUrl = new URL('assets/mountain-race/mountain-race-multiplayer.js', rootUrl);
const indexUrl = new URL('index.html', rootUrl);
const previewUrl = new URL('mountain-race-preview.html', rootUrl);
const marker = 'MOUNTAIN_RACE_PROFESSIONAL_REBUILD_V27';

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Summit Sprint V27 professional rebuild could not find ${label}.`);
  return source.replace(before, after);
}

let [css, runtime, html, preview] = await Promise.all([
  readFile(cssUrl, 'utf8'),
  readFile(runtimeUrl, 'utf8'),
  readFile(indexUrl, 'utf8'),
  readFile(previewUrl, 'utf8')
]);

if (!runtime.includes(marker)) {
  runtime = replaceRequired(
    runtime,
    "    root.dataset.mrRockyRebuild = '26';",
    `    root.dataset.mrRockyRebuild = '26';\n    // ${marker}\n    // V27 owns the complete Summit Sprint environment presentation. Older visual\n    // datasets may still be populated by historical compatibility helpers, but\n    // only this V27 dataset is used by the final presentation selectors.\n    root.dataset.mrProfessionalRebuild = '27';`,
    'V26 runtime activation'
  );

  runtime = replaceRequired(
    runtime,
    '  function renderHolds(currentIndex, total, prompts, reveal) {',
    '  function renderHolds(currentIndex, total, prompts, reveal, side) {',
    'renderHolds visual side argument'
  );

  runtime = replaceRequired(
    runtime,
    "aria-hidden=\"true\"><b>${known ? symbol(known) : ''}</b></span>`;",
    "aria-hidden=\"true\"><img class=\"mr-hold-art\" src=\"/assets/mountain-race/images/summit-sprint-hold-${(index % 8) + 1}-v27.png\" alt=\"\" draggable=\"false\"><b>${known ? symbol(known) : ''}</b></span>`;",
    'physical hold image layer'
  );

  if (!runtime.includes('class="mr-summit-art"')) {
    const summitPattern = /\+ `<span class="mr-finish-ledge(?: mr-summit-plateau)?" style="--mr-summit-bottom:\$\{86 \+ total \* 58\}px" aria-hidden="true">(?:<span class="mr-summit-turf"><\/span>)?<i><\/i><b>SUMMIT<\/b><\/span>`;/;
    if (!summitPattern.test(runtime)) throw new Error('Summit Sprint V27 professional rebuild could not find summit image layer anchor.');
    runtime = runtime.replace(
      summitPattern,
      "+ `<span class=\"mr-finish-ledge mr-summit-plateau\" style=\"--mr-summit-bottom:${86 + total * 58}px\" aria-hidden=\"true\"><img class=\"mr-summit-art\" src=\"/assets/mountain-race/images/summit-sprint-summit-${side === 'me' ? 'left' : 'right'}-v27.png\" alt=\"\" draggable=\"false\"><i></i><b>SUMMIT</b></span>`;"
    );
  }

  runtime = replaceRequired(
    runtime,
    '${renderHolds(p.promptIndex, total, prompts, reveal)}',
    '${renderHolds(p.promptIndex, total, prompts, reveal, side)}',
    'renderHolds side call'
  );

  runtime = replaceRequired(
    runtime,
    '<div class=\"mr-mountain-wall\" style=\"--mr-wall-scroll:${scroll}px\">',
    `<div class=\"mr-mountain-wall\" style=\"--mr-wall-scroll:\${scroll}px\">\n            <picture class=\"mr-cliff-art\" aria-hidden=\"true\">\n              <source media=\"(max-width: 520px)\" srcset=\"/assets/mountain-race/images/summit-sprint-cliff-\${side === 'me' ? 'left' : 'right'}-mobile-v27.png\">\n              <img src=\"/assets/mountain-race/images/summit-sprint-cliff-\${side === 'me' ? 'left' : 'right'}-desktop-v27.png\" alt=\"\" draggable=\"false\">\n            </picture>\n            <img class=\"mr-start-art\" src=\"/assets/mountain-race/images/summit-sprint-start-\${side === 'me' ? 'left' : 'right'}-v27.png\" alt=\"\" draggable=\"false\">`,
    'cliff and start image layers'
  );
}

if (!css.includes(marker)) {
  css += String.raw`

/* MOUNTAIN_RACE_PROFESSIONAL_REBUILD_V27
   Full asset-driven environment restart. V27 uses real picture/img elements for
   the cliffs, base shelves, summit shelves and physical holds so CSS no longer
   crops, masks, tiles or invents the terrain silhouette. Mobile and desktop cliff
   PNGs are authored at the exact wall aspect ratios used below. */

[data-mountain-race-mount][data-mr-professional-rebuild="27"] {
  background: #7eb7d2 !important;
  background-image: url('/assets/mountain-race/images/summit-sprint-sky-v27.png') !important;
  background-position: center 42% !important;
  background-size: cover !important;
  background-repeat: no-repeat !important;
}

[data-mountain-race-mount][data-mr-professional-rebuild="27"] > .mr-world-layer,
[data-mountain-race-mount][data-mr-professional-rebuild="27"] .mr-concept-depth-v18,
[data-mountain-race-mount][data-mr-professional-rebuild="27"] .mr-v17-cloud-bank,
[data-mountain-race-mount][data-mr-professional-rebuild="27"] .mr-v17-wind-field,
[data-mountain-race-mount][data-mr-professional-rebuild="27"] .mr-stage-ridge,
[data-mountain-race-mount][data-mr-professional-rebuild="27"] .mr-route-depth,
[data-mountain-race-mount][data-mr-professional-rebuild="27"] .mr-route-rope,
[data-mountain-race-mount][data-mr-professional-rebuild="27"] .mr-start-meadow,
[data-mountain-race-mount][data-mr-professional-rebuild="27"] .mr-summit-turf {
  display: none !important;
}

[data-mountain-race-mount][data-mr-professional-rebuild="27"] .mountain-race-game {
  width: min(100%, 980px) !important;
  margin-inline: auto !important;
  overflow: hidden !important;
  border: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
}

[data-mountain-race-mount][data-mr-professional-rebuild="27"] .mountain-race-game::before,
[data-mountain-race-mount][data-mr-professional-rebuild="27"] .mountain-race-game::after,
[data-mountain-race-mount][data-mr-professional-rebuild="27"] .mr-race-stage::before,
[data-mountain-race-mount][data-mr-professional-rebuild="27"] .mr-lane::before,
[data-mountain-race-mount][data-mr-professional-rebuild="27"] .mr-lane::after,
[data-mountain-race-mount][data-mr-professional-rebuild="27"] .mr-finish-ledge::before,
[data-mountain-race-mount][data-mr-professional-rebuild="27"] .mr-finish-ledge::after {
  content: none !important;
  display: none !important;
}

[data-mountain-race-mount][data-mr-professional-rebuild="27"] .mr-race-stage {
  position: relative !important;
  z-index: 3 !important;
  width: 100% !important;
  max-width: 900px !important;
  margin-inline: auto !important;
  grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  gap: clamp(12px, 2.6vw, 24px) !important;
  padding: 0 clamp(6px, 1.4vw, 14px) !important;
  overflow: visible !important;
}

[data-mountain-race-mount][data-mr-professional-rebuild="27"] .mr-lane {
  position: relative !important;
  min-width: 0 !important;
  overflow: visible !important;
  border: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
}

[data-mountain-race-mount][data-mr-professional-rebuild="27"] .mr-player-card {
  position: relative !important;
  z-index: 30 !important;
  margin: 0 2px 6px !important;
  border: 1px solid rgba(229,240,242,.24) !important;
  border-radius: 14px !important;
  background: linear-gradient(180deg, rgba(15,28,34,.94), rgba(7,15,19,.92)) !important;
  box-shadow: 0 8px 18px rgba(4,12,16,.28), inset 0 1px rgba(255,255,255,.08) !important;
  backdrop-filter: blur(5px) !important;
}

[data-mountain-race-mount][data-mr-professional-rebuild="27"] .mr-climb-viewport {
  position: relative !important;
  height: 490px !important;
  min-height: 0 !important;
  overflow: hidden !important;
  border: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
}

[data-mountain-race-mount][data-mr-professional-rebuild="27"] .mr-climb-viewport::before {
  content: '' !important;
  display: block !important;
  position: absolute !important;
  inset: 0 !important;
  z-index: 20 !important;
  pointer-events: none !important;
  background: linear-gradient(105deg, rgba(255,242,205,.045), transparent 32% 72%, rgba(8,20,26,.07)) !important;
}

[data-mountain-race-mount][data-mr-professional-rebuild="27"] .mr-climb-viewport::after {
  content: '' !important;
  display: block !important;
  position: absolute !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  height: 42px !important;
  z-index: 21 !important;
  pointer-events: none !important;
  background: linear-gradient(0deg, rgba(8,19,23,.16), transparent) !important;
}

[data-mountain-race-mount][data-mr-professional-rebuild="27"] .mr-mountain-wall {
  position: absolute !important;
  z-index: 5 !important;
  left: 50% !important;
  right: auto !important;
  bottom: 0 !important;
  width: min(320px, calc(100% - 8px)) !important;
  height: 1520px !important;
  margin: 0 !important;
  overflow: visible !important;
  border: 0 !important;
  border-radius: 0 !important;
  clip-path: none !important;
  background: none !important;
  box-shadow: none !important;
  transform: translate(-50%, var(--mr-wall-scroll, 0px)) !important;
  transition: transform 260ms cubic-bezier(.22,.84,.28,1) !important;
  filter: drop-shadow(0 9px 8px rgba(5,11,12,.24)) !important;
  backface-visibility: hidden !important;
  will-change: transform !important;
}

[data-mountain-race-mount][data-mr-professional-rebuild="27"] .mr-mountain-wall::before,
[data-mountain-race-mount][data-mr-professional-rebuild="27"] .mr-mountain-wall::after {
  content: none !important;
  display: none !important;
}

[data-mountain-race-mount][data-mr-professional-rebuild="27"] .mr-cliff-art {
  position: absolute !important;
  z-index: 1 !important;
  inset: 0 !important;
  display: block !important;
  width: 100% !important;
  height: 100% !important;
  pointer-events: none !important;
}

[data-mountain-race-mount][data-mr-professional-rebuild="27"] .mr-cliff-art img {
  display: block !important;
  width: 100% !important;
  height: 100% !important;
  max-width: none !important;
  object-fit: fill !important;
  object-position: center !important;
  image-rendering: auto !important;
  user-select: none !important;
  pointer-events: none !important;
}

[data-mountain-race-mount][data-mr-professional-rebuild="27"] .mr-start-art {
  position: absolute !important;
  z-index: 4 !important;
  left: 50% !important;
  bottom: -10px !important;
  display: block !important;
  width: 142% !important;
  height: auto !important;
  max-width: none !important;
  transform: translateX(-50%) !important;
  filter: drop-shadow(0 10px 7px rgba(4,9,8,.35)) !important;
  pointer-events: none !important;
}

[data-mountain-race-mount][data-mr-professional-rebuild="27"] .mr-rock-hold {
  z-index: 11 !important;
  width: 66px !important;
  height: 44px !important;
  border: 0 !important;
  border-radius: 0 !important;
  background: none !important;
  box-shadow: none !important;
  filter: drop-shadow(0 6px 4px rgba(3,6,6,.58)) !important;
}

[data-mountain-race-mount][data-mr-professional-rebuild="27"] .mr-hold-art {
  position: absolute !important;
  z-index: 1 !important;
  inset: 0 !important;
  display: block !important;
  width: 100% !important;
  height: 100% !important;
  object-fit: contain !important;
  pointer-events: none !important;
}

[data-mountain-race-mount][data-mr-professional-rebuild="27"] .mr-rock-hold b {
  position: absolute !important;
  z-index: 4 !important;
  left: 50% !important;
  top: 48% !important;
  display: grid !important;
  place-items: center !important;
  width: 27px !important;
  height: 27px !important;
  min-width: 0 !important;
  min-height: 0 !important;
  padding: 0 !important;
  transform: translate(-50%, -50%) !important;
  border: 1px solid rgba(238,245,242,.42) !important;
  border-radius: 8px !important;
  color: #fffdf5 !important;
  background: rgba(9,13,13,.72) !important;
  box-shadow: 0 3px 8px rgba(0,0,0,.28) !important;
  font-size: .82rem !important;
  line-height: 1 !important;
  text-shadow: 0 2px 2px rgba(0,0,0,.75) !important;
}

[data-mountain-race-mount][data-mr-professional-rebuild="27"] .mr-rock-hold b svg {
  width: 20px !important;
  height: 20px !important;
}

[data-mountain-race-mount][data-mr-professional-rebuild="27"] .mr-rock-hold.current {
  background: none !important;
  box-shadow: none !important;
  filter: drop-shadow(0 7px 4px rgba(3,6,6,.60)) drop-shadow(0 0 7px rgba(244,191,80,.52)) !important;
  animation: mr-v27-hold-pulse .78s ease-in-out infinite alternate !important;
}

[data-mountain-race-mount][data-mr-professional-rebuild="27"] .mr-lane.opponent .mr-rock-hold.current {
  filter: drop-shadow(0 7px 4px rgba(3,6,6,.60)) drop-shadow(0 0 6px rgba(109,193,224,.42)) !important;
  animation: none !important;
}

[data-mountain-race-mount][data-mr-professional-rebuild="27"] .mr-rock-hold.passed {
  opacity: .56 !important;
  filter: saturate(.72) brightness(.84) drop-shadow(0 4px 3px rgba(4,7,6,.40)) !important;
}

[data-mountain-race-mount][data-mr-professional-rebuild="27"] .mr-rock-hold.distant { opacity: .48 !important; }
[data-mountain-race-mount][data-mr-professional-rebuild="27"] .mr-rock-hold.unknown b { opacity: .08 !important; }

[data-mountain-race-mount][data-mr-professional-rebuild="27"] .mr-finish-ledge {
  z-index: 12 !important;
  width: 174px !important;
  height: 92px !important;
  border: 0 !important;
  border-radius: 0 !important;
  background: none !important;
  box-shadow: none !important;
  filter: drop-shadow(0 10px 8px rgba(3,7,7,.40)) !important;
}

[data-mountain-race-mount][data-mr-professional-rebuild="27"] .mr-summit-art {
  position: absolute !important;
  z-index: 1 !important;
  inset: 0 !important;
  display: block !important;
  width: 100% !important;
  height: 100% !important;
  object-fit: contain !important;
  pointer-events: none !important;
}

[data-mountain-race-mount][data-mr-professional-rebuild="27"] .mr-finish-ledge b,
[data-mountain-race-mount][data-mr-professional-rebuild="27"] .mr-finish-ledge i {
  position: relative !important;
  z-index: 4 !important;
}

[data-mountain-race-mount][data-mr-professional-rebuild="27"] .mr-climber {
  z-index: 18 !important;
  filter: drop-shadow(0 7px 5px rgba(0,0,0,.54)) !important;
}

[data-mountain-race-mount][data-mr-professional-rebuild="27"] .mr-altitude-meter { display: none !important; }
[data-mountain-race-mount][data-mr-professional-rebuild="27"] .mr-command-deck { position: relative !important; z-index: 40 !important; }
[data-mountain-race-mount][data-mr-professional-rebuild="27"] .mr-overlay { z-index: 80 !important; }

@keyframes mr-v27-hold-pulse {
  from { transform: translate(-50%, 50%) scale(1); }
  to { transform: translate(-50%, 50%) scale(1.045); }
}

@media (max-width: 520px) {
  [data-mountain-race-mount][data-mr-professional-rebuild="27"] .mr-race-stage {
    gap: 12px !important;
    padding-inline: 5px !important;
  }

  [data-mountain-race-mount][data-mr-professional-rebuild="27"] .mr-player-card {
    margin-inline: 0 !important;
    min-height: 52px !important;
    padding: 6px !important;
  }

  [data-mountain-race-mount][data-mr-professional-rebuild="27"] .mr-climb-viewport {
    height: 410px !important;
  }

  [data-mountain-race-mount][data-mr-professional-rebuild="27"] .mr-mountain-wall {
    width: 130px !important;
    height: 1520px !important;
  }

  [data-mountain-race-mount][data-mr-professional-rebuild="27"] .mr-start-art {
    width: 145% !important;
    bottom: -8px !important;
  }

  [data-mountain-race-mount][data-mr-professional-rebuild="27"] .mr-rock-hold {
    width: 58px !important;
    height: 40px !important;
  }

  [data-mountain-race-mount][data-mr-professional-rebuild="27"] .mr-rock-hold b {
    width: 24px !important;
    height: 24px !important;
  }

  [data-mountain-race-mount][data-mr-professional-rebuild="27"] .mr-rock-hold b svg {
    width: 18px !important;
    height: 18px !important;
  }

  [data-mountain-race-mount][data-mr-professional-rebuild="27"] .mr-finish-ledge {
    width: 158px !important;
    height: 84px !important;
  }
}

@media (min-width: 521px) and (max-width: 760px) {
  [data-mountain-race-mount][data-mr-professional-rebuild="27"] .mr-mountain-wall {
    width: min(280px, calc(100% - 8px)) !important;
  }
}
`;
}

function addCacheToken(source) {
  return source.replace(/(mountain-race\.css\?[^"'\s>]+)/g, value => value.includes('visual=27') ? value : `${value}&visual=27`);
}

html = addCacheToken(html);
preview = addCacheToken(preview);

if (!runtime.includes(marker)) throw new Error('Summit Sprint V27 runtime marker is missing.');
if (!runtime.includes('class="mr-cliff-art"')) throw new Error('Summit Sprint V27 cliff image layer is missing.');
if (!runtime.includes('class="mr-start-art"')) throw new Error('Summit Sprint V27 start image layer is missing.');
if (!runtime.includes('class="mr-hold-art"')) throw new Error('Summit Sprint V27 hold image layer is missing.');
if (!runtime.includes('class="mr-summit-art"')) throw new Error('Summit Sprint V27 summit image layer is missing.');
if (!css.includes(marker)) throw new Error('Summit Sprint V27 CSS marker is missing.');

await Promise.all([
  writeFile(cssUrl, css),
  writeFile(runtimeUrl, runtime),
  writeFile(indexUrl, html),
  writeFile(previewUrl, preview)
]);

console.log('Applied Summit Sprint V27 professional rebuild: real image-layer cliffs authored for mobile/desktop aspect ratios, independent foothill and summit PNGs, eight physical hold PNGs, clean alpine sky, live overlays above the art, and authoritative multiplayer behavior preserved.');
