import { readFile, writeFile } from 'node:fs/promises';

const rootUrl = new URL('../', import.meta.url);
const cssUrl = new URL('assets/mountain-race/mountain-race.css', rootUrl);
const runtimeUrl = new URL('assets/mountain-race/mountain-race-multiplayer.js', rootUrl);
const indexUrl = new URL('index.html', rootUrl);
const previewUrl = new URL('mountain-race-preview.html', rootUrl);
const marker = 'MOUNTAIN_RACE_VISUAL_RESTART_V25';

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Summit Sprint V25 visual restart could not find ${label}.`);
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
    '    runtime.root = root;',
    `    runtime.root = root;\n    // ${marker}\n    root.dataset.mrVisualRestart = '25';\n    delete root.dataset.mrCorrectedReferenceReady;\n    delete root.dataset.mrCorrectedReference;\n    root.style.removeProperty('--mr-v24-left-cliff');\n    root.style.removeProperty('--mr-v24-right-cliff');\n    root.style.removeProperty('--mr-v24-grass');\n    root.style.removeProperty('--mr-v24-holds');`,
    'render root assignment'
  );

  // Retire the expensive screenshot/reference crop stages. Their functions remain
  // in the generated runtime so older validators keep their markers, but V25 no
  // longer invokes them or depends on any reference crop at presentation time.
  const legacyVisualCalls = [
    'ensureScreenshotBaseV20(root);',
    'ensureReferenceAtlasV21(root);',
    'ensureReferenceRebuildV22(root);',
    'ensureFullCliffV23(root);',
    'ensureCorrectedReferenceV24(root);'
  ];
  for (const call of legacyVisualCalls) {
    runtime = runtime.replaceAll(call, `void 0; // V25 retired ${call}`);
  }
}

if (!css.includes(marker)) {
  css += String.raw`

/* MOUNTAIN_RACE_VISUAL_RESTART_V25
   Clean art restart. All major terrain is served as newly generated PNG assets:
   independent left/right cliffs, sky, grassy start shelf, summit shelf, and six
   individual rock holds. No reference screenshot is stretched, repeated, or
   cropped at runtime. Gameplay DOM, controls, timers, synchronization, and result
   overlays remain untouched above this presentation layer. */

[data-mountain-race-mount][data-mr-visual-restart="25"] .mountain-race-game {
  --mr-v25-sky: url('/assets/mountain-race/images/summit-sprint-sky-v25.png');
  --mr-v25-left-cliff: url('/assets/mountain-race/images/summit-sprint-cliff-left-v25.png');
  --mr-v25-right-cliff: url('/assets/mountain-race/images/summit-sprint-cliff-right-v25.png');
  --mr-v25-start: url('/assets/mountain-race/images/summit-sprint-start-platform-v25.png');
  --mr-v25-summit: url('/assets/mountain-race/images/summit-sprint-summit-platform-v25.png');
  width: min(100%, 1120px) !important;
  margin-inline: auto !important;
  background:
    linear-gradient(180deg, rgba(16,34,45,.04), rgba(9,20,27,.26)),
    var(--mr-v25-sky) center 38% / cover no-repeat !important;
}

[data-mountain-race-mount][data-mr-visual-restart="25"] .mountain-race-game::before,
[data-mountain-race-mount][data-mr-visual-restart="25"] .mountain-race-game::after,
[data-mountain-race-mount][data-mr-visual-restart="25"] .mr-race-stage::before {
  content: none !important;
  display: none !important;
}

[data-mountain-race-mount][data-mr-visual-restart="25"] .mr-race-stage {
  position: relative !important;
  z-index: 3 !important;
  width: 100% !important;
  max-width: 980px !important;
  margin-inline: auto !important;
  grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  justify-items: stretch !important;
  gap: clamp(5px, 1vw, 10px) !important;
  padding-inline: clamp(6px, 1.4vw, 14px) !important;
}

[data-mountain-race-mount][data-mr-visual-restart="25"] .mr-lane {
  min-width: 0 !important;
  overflow: hidden !important;
  border: 1px solid rgba(222,232,228,.22) !important;
  border-radius: 18px 18px 9px 9px !important;
  background: rgba(15,27,32,.12) !important;
  box-shadow:
    0 12px 28px rgba(4,10,13,.24),
    inset 0 1px rgba(255,255,255,.08) !important;
}

[data-mountain-race-mount][data-mr-visual-restart="25"] .mr-player-card {
  z-index: 20 !important;
  background:
    linear-gradient(180deg, rgba(15,24,27,.94), rgba(8,14,16,.90)) !important;
  backdrop-filter: blur(6px);
}

[data-mountain-race-mount][data-mr-visual-restart="25"] .mr-climb-viewport {
  position: relative !important;
  overflow: hidden !important;
  background:
    linear-gradient(180deg, rgba(255,246,214,.08), rgba(23,55,69,.02) 48%, rgba(8,18,23,.16)),
    var(--mr-v25-sky) center 42% / cover no-repeat !important;
  box-shadow:
    inset 0 0 0 1px rgba(255,255,255,.05),
    inset 0 -28px 35px rgba(5,12,16,.16) !important;
}

[data-mountain-race-mount][data-mr-visual-restart="25"] .mr-climb-viewport::before {
  content: '' !important;
  display: block !important;
  position: absolute !important;
  inset: 0 !important;
  z-index: 5 !important;
  pointer-events: none !important;
  background:
    radial-gradient(ellipse at 30% 5%, rgba(255,244,205,.18), transparent 35%),
    linear-gradient(112deg, rgba(255,236,195,.075), transparent 37%, rgba(7,17,21,.09) 100%) !important;
}

[data-mountain-race-mount][data-mr-visual-restart="25"] .mr-climb-viewport::after {
  content: '' !important;
  display: block !important;
  position: absolute !important;
  inset: auto 0 0 !important;
  height: 82px !important;
  z-index: 5 !important;
  pointer-events: none !important;
  background: linear-gradient(0deg, rgba(6,13,16,.26), transparent) !important;
}

[data-mountain-race-mount][data-mr-visual-restart="25"] .mr-mountain-wall {
  z-index: 2 !important;
  bottom: 0 !important;
  height: 1700px !important;
  overflow: visible !important;
  clip-path: none !important;
  border: 0 !important;
  border-radius: 0 !important;
  background-color: #5e594f !important;
  background-position: center center !important;
  background-size: 100% 100% !important;
  background-repeat: no-repeat !important;
  image-rendering: auto !important;
  filter: contrast(1.04) saturate(.96) !important;
  box-shadow:
    inset 0 0 44px rgba(8,10,9,.14),
    0 13px 26px rgba(2,8,10,.24) !important;
  will-change: transform;
  backface-visibility: hidden;
}

[data-mountain-race-mount][data-mr-visual-restart="25"] .mr-lane.me .mr-mountain-wall {
  left: 0 !important;
  right: 4% !important;
  width: auto !important;
  background-image: var(--mr-v25-left-cliff) !important;
}

[data-mountain-race-mount][data-mr-visual-restart="25"] .mr-lane.opponent .mr-mountain-wall {
  left: 4% !important;
  right: 0 !important;
  width: auto !important;
  background-image: var(--mr-v25-right-cliff) !important;
}

[data-mountain-race-mount][data-mr-visual-restart="25"] .mr-mountain-wall::before {
  content: '' !important;
  display: block !important;
  position: absolute !important;
  left: -5% !important;
  right: -5% !important;
  bottom: -7px !important;
  height: 205px !important;
  z-index: 4 !important;
  pointer-events: none !important;
  background: var(--mr-v25-start) center bottom / 110% auto no-repeat !important;
  filter: drop-shadow(0 14px 13px rgba(2,6,5,.36));
}

[data-mountain-race-mount][data-mr-visual-restart="25"] .mr-mountain-wall::after {
  content: '' !important;
  display: block !important;
  position: absolute !important;
  inset: 0 !important;
  z-index: 3 !important;
  pointer-events: none !important;
  background:
    linear-gradient(90deg, rgba(7,9,8,.14), transparent 16% 82%, rgba(5,8,8,.13)),
    linear-gradient(112deg, rgba(255,234,190,.055), transparent 46%, rgba(5,9,9,.055)) !important;
}

[data-mountain-race-mount][data-mr-visual-restart="25"] .mr-rock-hold {
  z-index: 8 !important;
  width: 68px !important;
  height: 46px !important;
  border: 0 !important;
  border-radius: 0 !important;
  background-color: transparent !important;
  background-position: center !important;
  background-size: contain !important;
  background-repeat: no-repeat !important;
  box-shadow: none !important;
  filter: drop-shadow(0 7px 5px rgba(5,7,6,.52)) !important;
  image-rendering: auto !important;
}

[data-mountain-race-mount][data-mr-visual-restart="25"] .mr-rock-hold:nth-of-type(6n + 1) { background-image: url('/assets/mountain-race/images/summit-sprint-hold-1-v25.png') !important; }
[data-mountain-race-mount][data-mr-visual-restart="25"] .mr-rock-hold:nth-of-type(6n + 2) { background-image: url('/assets/mountain-race/images/summit-sprint-hold-2-v25.png') !important; }
[data-mountain-race-mount][data-mr-visual-restart="25"] .mr-rock-hold:nth-of-type(6n + 3) { background-image: url('/assets/mountain-race/images/summit-sprint-hold-3-v25.png') !important; }
[data-mountain-race-mount][data-mr-visual-restart="25"] .mr-rock-hold:nth-of-type(6n + 4) { background-image: url('/assets/mountain-race/images/summit-sprint-hold-4-v25.png') !important; }
[data-mountain-race-mount][data-mr-visual-restart="25"] .mr-rock-hold:nth-of-type(6n + 5) { background-image: url('/assets/mountain-race/images/summit-sprint-hold-5-v25.png') !important; }
[data-mountain-race-mount][data-mr-visual-restart="25"] .mr-rock-hold:nth-of-type(6n) { background-image: url('/assets/mountain-race/images/summit-sprint-hold-6-v25.png') !important; }

[data-mountain-race-mount][data-mr-visual-restart="25"] .mr-rock-hold b {
  display: grid !important;
  place-items: center !important;
  min-width: 26px !important;
  min-height: 26px !important;
  padding: 2px !important;
  border: 1px solid rgba(255,255,255,.24) !important;
  border-radius: 999px !important;
  color: #f5f4ea !important;
  background: rgba(18,22,20,.58) !important;
  box-shadow: 0 2px 7px rgba(0,0,0,.30) !important;
  text-shadow: 0 2px 2px rgba(0,0,0,.72) !important;
  backdrop-filter: blur(2px);
}

[data-mountain-race-mount][data-mr-visual-restart="25"] .mr-rock-hold.current {
  border: 0 !important;
  background-color: transparent !important;
  box-shadow: none !important;
  filter:
    drop-shadow(0 7px 5px rgba(5,7,6,.50))
    drop-shadow(0 0 9px rgba(244,190,83,.78)) !important;
  animation: mr-v25-hold-pulse .8s ease-in-out infinite alternate !important;
}

[data-mountain-race-mount][data-mr-visual-restart="25"] .mr-lane.opponent .mr-rock-hold.current {
  filter:
    drop-shadow(0 7px 5px rgba(5,7,6,.50))
    drop-shadow(0 0 8px rgba(120,196,222,.55)) !important;
  animation: none !important;
}

[data-mountain-race-mount][data-mr-visual-restart="25"] .mr-rock-hold.passed {
  opacity: .54 !important;
  filter: saturate(.65) brightness(.82) drop-shadow(0 5px 4px rgba(4,6,5,.34)) !important;
}

[data-mountain-race-mount][data-mr-visual-restart="25"] .mr-rock-hold.distant {
  opacity: .52 !important;
}

[data-mountain-race-mount][data-mr-visual-restart="25"] .mr-finish-ledge {
  z-index: 9 !important;
  width: 84% !important;
  height: 104px !important;
  padding-top: 18px !important;
  border: 0 !important;
  border-radius: 0 !important;
  color: #f4f5ef !important;
  background: var(--mr-v25-summit) center / contain no-repeat !important;
  box-shadow: none !important;
  filter: drop-shadow(0 12px 10px rgba(3,7,7,.42));
}

[data-mountain-race-mount][data-mr-visual-restart="25"] .mr-finish-ledge b {
  padding: 4px 8px !important;
  border-radius: 999px !important;
  color: #f5f5ef !important;
  background: rgba(18,27,28,.68) !important;
  text-shadow: 0 2px 3px rgba(0,0,0,.75) !important;
  box-shadow: 0 3px 8px rgba(0,0,0,.22) !important;
}

[data-mountain-race-mount][data-mr-visual-restart="25"] .mr-finish-ledge i {
  bottom: 64px !important;
  box-shadow: 0 2px 5px rgba(0,0,0,.44) !important;
}

[data-mountain-race-mount][data-mr-visual-restart="25"] .mr-climber {
  z-index: 13 !important;
  filter: drop-shadow(0 7px 5px rgba(0,0,0,.58)) !important;
}

[data-mountain-race-mount][data-mr-visual-restart="25"] .mr-altitude-meter {
  z-index: 16 !important;
  background: rgba(8,16,18,.48) !important;
  backdrop-filter: blur(2px);
}

[data-mountain-race-mount][data-mr-visual-restart="25"] .mr-titlebar,
[data-mountain-race-mount][data-mr-visual-restart="25"] .mr-command-deck {
  z-index: 30 !important;
}

[data-mountain-race-mount][data-mr-visual-restart="25"] .mr-overlay {
  z-index: 70 !important;
}

@keyframes mr-v25-hold-pulse {
  from { transform: translate(-50%, 50%) scale(1); }
  to { transform: translate(-50%, 50%) scale(1.055); }
}

@media (max-width: 760px) {
  [data-mountain-race-mount][data-mr-visual-restart="25"] .mountain-race-game {
    width: 100% !important;
    margin: 0 auto !important;
  }

  [data-mountain-race-mount][data-mr-visual-restart="25"] .mr-race-stage {
    width: 100% !important;
    max-width: 100% !important;
    gap: 4px !important;
    padding-inline: 4px !important;
  }

  [data-mountain-race-mount][data-mr-visual-restart="25"] .mr-lane {
    border-radius: 12px 12px 6px 6px !important;
  }

  [data-mountain-race-mount][data-mr-visual-restart="25"] .mr-lane.me .mr-mountain-wall {
    left: 0 !important;
    right: 3% !important;
  }

  [data-mountain-race-mount][data-mr-visual-restart="25"] .mr-lane.opponent .mr-mountain-wall {
    left: 3% !important;
    right: 0 !important;
  }

  [data-mountain-race-mount][data-mr-visual-restart="25"] .mr-rock-hold {
    width: 54px !important;
    height: 39px !important;
  }

  [data-mountain-race-mount][data-mr-visual-restart="25"] .mr-rock-hold b {
    min-width: 23px !important;
    min-height: 23px !important;
    font-size: .92rem !important;
  }

  [data-mountain-race-mount][data-mr-visual-restart="25"] .mr-finish-ledge {
    width: 92% !important;
    height: 92px !important;
  }

  [data-mountain-race-mount][data-mr-visual-restart="25"] .mr-mountain-wall::before {
    height: 180px !important;
    background-size: 116% auto !important;
  }
}
`;
}

function addVisualCacheToken(source) {
  return source.replace(/(mountain-race\.css\?[^"'\s>]+)/g, value => value.includes('visual=25') ? value : `${value}&visual=25`);
}

html = addVisualCacheToken(html);
preview = addVisualCacheToken(preview);

if (!runtime.includes(marker)) throw new Error('Summit Sprint V25 runtime marker is missing.');
if (!css.includes(marker)) throw new Error('Summit Sprint V25 CSS marker is missing.');
if (!css.includes('summit-sprint-cliff-left-v25.png') || !css.includes('summit-sprint-cliff-right-v25.png')) throw new Error('Summit Sprint V25 cliff PNGs are not wired.');
if (!css.includes('summit-sprint-start-platform-v25.png') || !css.includes('summit-sprint-summit-platform-v25.png')) throw new Error('Summit Sprint V25 platform PNGs are not wired.');
if (!css.includes('summit-sprint-hold-6-v25.png')) throw new Error('Summit Sprint V25 hold PNG set is incomplete.');

await Promise.all([
  writeFile(cssUrl, css),
  writeFile(runtimeUrl, runtime),
  writeFile(indexUrl, html),
  writeFile(previewUrl, preview)
]);

console.log('Applied Summit Sprint V25 visual restart: new high-resolution PNG sky, independent cliffs, grassy start shelf, summit shelf, separate ledges, mobile centering, and non-destructive lighting/shadows while leaving multiplayer gameplay logic intact.');
