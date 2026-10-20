import { readFile, writeFile } from 'node:fs/promises';

const rootUrl = new URL('../', import.meta.url);
const cssUrl = new URL('assets/mountain-race/mountain-race.css', rootUrl);
const runtimeUrl = new URL('assets/mountain-race/mountain-race-multiplayer.js', rootUrl);
const indexUrl = new URL('index.html', rootUrl);
const previewUrl = new URL('mountain-race-preview.html', rootUrl);
const marker = 'MOUNTAIN_RACE_ROCKY_REBUILD_V26';

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Summit Sprint V26 rocky rebuild could not find ${label}.`);
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
    "    root.style.removeProperty('--mr-v24-holds');",
    `    root.style.removeProperty('--mr-v24-holds');\n    // ${marker}\n    // V26 is the active Summit Sprint terrain. Keep older markers/functions in the\n    // generated bundle only for regression compatibility; their presentation\n    // selectors are disabled by removing the V25 dataset.\n    delete root.dataset.mrVisualRestart;\n    root.dataset.mrRockyRebuild = '26';`,
    'V25 visual-root cleanup hook'
  );
}

if (!css.includes(marker)) {
  css += String.raw`

/* MOUNTAIN_RACE_ROCKY_REBUILD_V26
   Natural mountain rebuild. The cliff PNGs have transparent jagged silhouettes,
   broad diagonal/horizontal geological fractures and independently generated left
   and right faces. The unified sky remains visible around the rock instead of
   putting a texture inside rounded cards. Gameplay positions and overlays stay live. */

[data-mountain-race-mount][data-mr-rocky-rebuild="26"] {
  background: #7db2cd !important;
}

[data-mountain-race-mount][data-mr-rocky-rebuild="26"] > .mr-world-layer {
  display: none !important;
}

[data-mountain-race-mount][data-mr-rocky-rebuild="26"] .mountain-race-game {
  --mr-v26-sky: url('/assets/mountain-race/images/summit-sprint-sky-v26.png');
  --mr-v26-left-cliff: url('/assets/mountain-race/images/summit-sprint-cliff-left-v26.png');
  --mr-v26-right-cliff: url('/assets/mountain-race/images/summit-sprint-cliff-right-v26.png');
  --mr-v26-start-left: url('/assets/mountain-race/images/summit-sprint-start-left-v26.png');
  --mr-v26-start-right: url('/assets/mountain-race/images/summit-sprint-start-right-v26.png');
  --mr-v26-summit-left: url('/assets/mountain-race/images/summit-sprint-summit-left-v26.png');
  --mr-v26-summit-right: url('/assets/mountain-race/images/summit-sprint-summit-right-v26.png');
  width: min(100%, 1120px) !important;
  margin-inline: auto !important;
  background:
    linear-gradient(180deg, rgba(255,247,218,.035), rgba(17,45,58,.08) 62%, rgba(7,20,27,.18)),
    var(--mr-v26-sky) center 45% / cover no-repeat !important;
  box-shadow: 0 24px 65px rgba(4,12,17,.34) !important;
}

[data-mountain-race-mount][data-mr-rocky-rebuild="26"] .mountain-race-game::before,
[data-mountain-race-mount][data-mr-rocky-rebuild="26"] .mountain-race-game::after,
[data-mountain-race-mount][data-mr-rocky-rebuild="26"] .mr-race-stage::before {
  content: none !important;
  display: none !important;
}

[data-mountain-race-mount][data-mr-rocky-rebuild="26"] .mr-race-stage {
  position: relative !important;
  z-index: 3 !important;
  width: 100% !important;
  max-width: 960px !important;
  margin-inline: auto !important;
  grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  gap: 0 !important;
  padding-inline: clamp(5px, 1vw, 10px) !important;
  overflow: visible !important;
}

[data-mountain-race-mount][data-mr-rocky-rebuild="26"] .mr-lane {
  min-width: 0 !important;
  overflow: visible !important;
  border: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
}

[data-mountain-race-mount][data-mr-rocky-rebuild="26"] .mr-player-card {
  position: relative !important;
  z-index: 22 !important;
  margin: 0 4px !important;
  border: 1px solid rgba(225,237,236,.20) !important;
  border-radius: 13px !important;
  background:
    linear-gradient(180deg, rgba(16,25,27,.91), rgba(7,13,15,.86)) !important;
  box-shadow: 0 7px 17px rgba(2,8,11,.28) !important;
  backdrop-filter: blur(5px) !important;
}

[data-mountain-race-mount][data-mr-rocky-rebuild="26"] .mr-climb-viewport {
  position: relative !important;
  overflow: hidden !important;
  border: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
}

[data-mountain-race-mount][data-mr-rocky-rebuild="26"] .mr-climb-viewport::before {
  content: '' !important;
  display: block !important;
  position: absolute !important;
  inset: 0 !important;
  z-index: 4 !important;
  pointer-events: none !important;
  background:
    radial-gradient(ellipse at 18% 2%, rgba(255,244,208,.13), transparent 35%),
    linear-gradient(112deg, rgba(255,239,203,.035), transparent 42%, rgba(7,19,23,.035)) !important;
}

[data-mountain-race-mount][data-mr-rocky-rebuild="26"] .mr-climb-viewport::after {
  content: '' !important;
  display: block !important;
  position: absolute !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  height: 54px !important;
  z-index: 4 !important;
  pointer-events: none !important;
  background: linear-gradient(0deg, rgba(6,16,19,.16), transparent) !important;
}

[data-mountain-race-mount][data-mr-rocky-rebuild="26"] .mr-mountain-wall {
  position: absolute !important;
  z-index: 5 !important;
  left: 50% !important;
  right: auto !important;
  bottom: 0 !important;
  width: min(88%, 300px) !important;
  height: 1520px !important;
  margin: 0 !important;
  overflow: visible !important;
  border: 0 !important;
  border-radius: 0 !important;
  clip-path: none !important;
  background-color: transparent !important;
  background-position: center center !important;
  background-size: cover !important;
  background-repeat: no-repeat !important;
  transform: translate(-50%, var(--mr-wall-scroll, 0px)) !important;
  transition: transform 260ms cubic-bezier(.22,.84,.28,1) !important;
  filter:
    drop-shadow(5px 10px 9px rgba(3,7,7,.22))
    drop-shadow(-3px 4px 4px rgba(255,232,190,.045)) !important;
  box-shadow: none !important;
  backface-visibility: hidden !important;
  will-change: transform !important;
}

[data-mountain-race-mount][data-mr-rocky-rebuild="26"] .mr-lane.me .mr-mountain-wall {
  background-image: var(--mr-v26-left-cliff) !important;
}

[data-mountain-race-mount][data-mr-rocky-rebuild="26"] .mr-lane.opponent .mr-mountain-wall {
  background-image: var(--mr-v26-right-cliff) !important;
}

[data-mountain-race-mount][data-mr-rocky-rebuild="26"] .mr-mountain-wall::before {
  content: '' !important;
  display: block !important;
  position: absolute !important;
  left: 50% !important;
  bottom: -9px !important;
  width: 138% !important;
  height: 205px !important;
  z-index: 7 !important;
  transform: translateX(-50%) !important;
  pointer-events: none !important;
  background-position: center bottom !important;
  background-size: contain !important;
  background-repeat: no-repeat !important;
  filter: drop-shadow(0 12px 9px rgba(2,7,5,.34)) !important;
}

[data-mountain-race-mount][data-mr-rocky-rebuild="26"] .mr-lane.me .mr-mountain-wall::before {
  background-image: var(--mr-v26-start-left) !important;
}

[data-mountain-race-mount][data-mr-rocky-rebuild="26"] .mr-lane.opponent .mr-mountain-wall::before {
  background-image: var(--mr-v26-start-right) !important;
}

[data-mountain-race-mount][data-mr-rocky-rebuild="26"] .mr-mountain-wall::after {
  content: none !important;
  display: none !important;
}

[data-mountain-race-mount][data-mr-rocky-rebuild="26"] .mr-rock-hold {
  z-index: 10 !important;
  width: 74px !important;
  height: 52px !important;
  border: 0 !important;
  border-radius: 0 !important;
  background-color: transparent !important;
  background-position: center !important;
  background-size: contain !important;
  background-repeat: no-repeat !important;
  box-shadow: none !important;
  filter:
    drop-shadow(0 7px 4px rgba(5,7,6,.58))
    drop-shadow(-2px -1px 1px rgba(255,233,191,.08)) !important;
  image-rendering: auto !important;
}

[data-mountain-race-mount][data-mr-rocky-rebuild="26"] .mr-rock-hold:nth-of-type(6n + 1) { background-image: url('/assets/mountain-race/images/summit-sprint-hold-1-v26.png') !important; }
[data-mountain-race-mount][data-mr-rocky-rebuild="26"] .mr-rock-hold:nth-of-type(6n + 2) { background-image: url('/assets/mountain-race/images/summit-sprint-hold-2-v26.png') !important; }
[data-mountain-race-mount][data-mr-rocky-rebuild="26"] .mr-rock-hold:nth-of-type(6n + 3) { background-image: url('/assets/mountain-race/images/summit-sprint-hold-3-v26.png') !important; }
[data-mountain-race-mount][data-mr-rocky-rebuild="26"] .mr-rock-hold:nth-of-type(6n + 4) { background-image: url('/assets/mountain-race/images/summit-sprint-hold-4-v26.png') !important; }
[data-mountain-race-mount][data-mr-rocky-rebuild="26"] .mr-rock-hold:nth-of-type(6n + 5) { background-image: url('/assets/mountain-race/images/summit-sprint-hold-5-v26.png') !important; }
[data-mountain-race-mount][data-mr-rocky-rebuild="26"] .mr-rock-hold:nth-of-type(6n) { background-image: url('/assets/mountain-race/images/summit-sprint-hold-6-v26.png') !important; }

[data-mountain-race-mount][data-mr-rocky-rebuild="26"] .mr-rock-hold b {
  display: grid !important;
  place-items: center !important;
  width: 30px !important;
  height: 30px !important;
  min-width: 0 !important;
  min-height: 0 !important;
  padding: 0 !important;
  border: 1px solid rgba(239,242,232,.30) !important;
  border-radius: 8px !important;
  color: #fffdf4 !important;
  background: rgba(12,16,15,.72) !important;
  box-shadow: 0 3px 7px rgba(0,0,0,.28) !important;
  font-size: 1rem !important;
  line-height: 1 !important;
  text-shadow: 0 2px 2px rgba(0,0,0,.76) !important;
  backdrop-filter: none !important;
}

[data-mountain-race-mount][data-mr-rocky-rebuild="26"] .mr-rock-hold.current {
  border: 0 !important;
  background-color: transparent !important;
  box-shadow: none !important;
  filter:
    drop-shadow(0 8px 5px rgba(4,6,5,.60))
    drop-shadow(0 0 7px rgba(245,194,87,.58)) !important;
  animation: mr-v26-hold-pulse .76s ease-in-out infinite alternate !important;
}

[data-mountain-race-mount][data-mr-rocky-rebuild="26"] .mr-lane.opponent .mr-rock-hold.current {
  filter:
    drop-shadow(0 8px 5px rgba(4,6,5,.60))
    drop-shadow(0 0 6px rgba(120,196,222,.45)) !important;
  animation: none !important;
}

[data-mountain-race-mount][data-mr-rocky-rebuild="26"] .mr-rock-hold.passed {
  opacity: .58 !important;
  filter: saturate(.65) brightness(.80) drop-shadow(0 5px 3px rgba(4,6,5,.42)) !important;
}

[data-mountain-race-mount][data-mr-rocky-rebuild="26"] .mr-rock-hold.distant {
  opacity: .55 !important;
}

[data-mountain-race-mount][data-mr-rocky-rebuild="26"] .mr-rock-hold.unknown b {
  opacity: .12 !important;
}

[data-mountain-race-mount][data-mr-rocky-rebuild="26"] .mr-finish-ledge {
  z-index: 11 !important;
  width: 118% !important;
  height: 116px !important;
  padding-top: 20px !important;
  border: 0 !important;
  border-radius: 0 !important;
  color: #f5f6ef !important;
  background-color: transparent !important;
  background-position: center !important;
  background-size: contain !important;
  background-repeat: no-repeat !important;
  box-shadow: none !important;
  filter: drop-shadow(0 13px 9px rgba(3,7,7,.43)) !important;
}

[data-mountain-race-mount][data-mr-rocky-rebuild="26"] .mr-lane.me .mr-finish-ledge {
  background-image: var(--mr-v26-summit-left) !important;
}

[data-mountain-race-mount][data-mr-rocky-rebuild="26"] .mr-lane.opponent .mr-finish-ledge {
  background-image: var(--mr-v26-summit-right) !important;
}

[data-mountain-race-mount][data-mr-rocky-rebuild="26"] .mr-finish-ledge b {
  padding: 4px 8px !important;
  border: 1px solid rgba(255,255,255,.18) !important;
  border-radius: 7px !important;
  color: #f5f5ef !important;
  background: rgba(13,20,20,.62) !important;
  text-shadow: 0 2px 3px rgba(0,0,0,.76) !important;
  box-shadow: 0 3px 8px rgba(0,0,0,.19) !important;
}

[data-mountain-race-mount][data-mr-rocky-rebuild="26"] .mr-finish-ledge i {
  bottom: 70px !important;
}

[data-mountain-race-mount][data-mr-rocky-rebuild="26"] .mr-climber {
  z-index: 14 !important;
  filter: drop-shadow(0 7px 5px rgba(0,0,0,.58)) !important;
}

[data-mountain-race-mount][data-mr-rocky-rebuild="26"] .mr-altitude-meter {
  z-index: 17 !important;
  background: rgba(8,16,18,.42) !important;
}

[data-mountain-race-mount][data-mr-rocky-rebuild="26"] .mr-titlebar,
[data-mountain-race-mount][data-mr-rocky-rebuild="26"] .mr-command-deck {
  z-index: 30 !important;
}

[data-mountain-race-mount][data-mr-rocky-rebuild="26"] .mr-overlay {
  z-index: 70 !important;
}

@keyframes mr-v26-hold-pulse {
  from { transform: translate(-50%, 50%) scale(1); }
  to { transform: translate(-50%, 50%) scale(1.045); }
}

@media (max-width: 760px) {
  [data-mountain-race-mount][data-mr-rocky-rebuild="26"] .mountain-race-game {
    width: 100% !important;
    margin: 0 auto !important;
  }

  [data-mountain-race-mount][data-mr-rocky-rebuild="26"] .mr-race-stage {
    width: 100% !important;
    max-width: 100% !important;
    gap: 0 !important;
    padding-inline: 2px !important;
  }

  [data-mountain-race-mount][data-mr-rocky-rebuild="26"] .mr-player-card {
    margin-inline: 2px !important;
    border-radius: 10px !important;
  }

  [data-mountain-race-mount][data-mr-rocky-rebuild="26"] .mr-mountain-wall {
    width: 250px !important;
    height: 1520px !important;
    background-size: cover !important;
  }

  [data-mountain-race-mount][data-mr-rocky-rebuild="26"] .mr-lane.me .mr-mountain-wall {
    left: 47% !important;
  }

  [data-mountain-race-mount][data-mr-rocky-rebuild="26"] .mr-lane.opponent .mr-mountain-wall {
    left: 53% !important;
  }

  [data-mountain-race-mount][data-mr-rocky-rebuild="26"] .mr-mountain-wall::before {
    width: 132% !important;
    height: 178px !important;
  }

  [data-mountain-race-mount][data-mr-rocky-rebuild="26"] .mr-rock-hold {
    width: 62px !important;
    height: 45px !important;
  }

  [data-mountain-race-mount][data-mr-rocky-rebuild="26"] .mr-rock-hold b {
    width: 27px !important;
    height: 27px !important;
    font-size: .91rem !important;
    border-radius: 7px !important;
  }

  [data-mountain-race-mount][data-mr-rocky-rebuild="26"] .mr-finish-ledge {
    width: 126% !important;
    height: 102px !important;
  }
}
`;
}

function addVisualCacheToken(source) {
  return source.replace(/(mountain-race\.css\?[^"'\s>]+)/g, value => {
    const clean = value.replace(/&visual=\d+/g, '');
    return `${clean}&visual=26`;
  });
}

html = addVisualCacheToken(html);
preview = addVisualCacheToken(preview);

if (!runtime.includes(marker)) throw new Error('Summit Sprint V26 runtime marker is missing.');
if (!runtime.includes("root.dataset.mrRockyRebuild = '26'")) throw new Error('Summit Sprint V26 dataset activation is missing.');
if (!css.includes(marker)) throw new Error('Summit Sprint V26 CSS marker is missing.');
if (!css.includes('summit-sprint-cliff-left-v26.png') || !css.includes('summit-sprint-cliff-right-v26.png')) throw new Error('Summit Sprint V26 cliff PNGs are not wired.');
if (!css.includes('summit-sprint-start-left-v26.png') || !css.includes('summit-sprint-start-right-v26.png')) throw new Error('Summit Sprint V26 start platforms are not wired.');
if (!css.includes('summit-sprint-summit-left-v26.png') || !css.includes('summit-sprint-summit-right-v26.png')) throw new Error('Summit Sprint V26 summit platforms are not wired.');
if (!css.includes('summit-sprint-hold-6-v26.png')) throw new Error('Summit Sprint V26 hold PNG set is incomplete.');

await Promise.all([
  writeFile(cssUrl, css),
  writeFile(runtimeUrl, runtime),
  writeFile(indexUrl, html),
  writeFile(previewUrl, preview)
]);

console.log('Applied Summit Sprint V26 rocky mountain rebuild: transparent jagged cliffs, broad natural geology, separate foothill and summit shelves, physical rock holds, unified alpine sky, mobile centering, and unchanged authoritative multiplayer logic.');
