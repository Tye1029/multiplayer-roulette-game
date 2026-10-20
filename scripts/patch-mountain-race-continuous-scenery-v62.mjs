import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const runtimeUrl = new URL('assets/mountain-race/mountain-race-multiplayer.js', root);
const prototypeUrl = new URL('assets/mountain-race/mountain-race.js', root);
const cssUrl = new URL('assets/mountain-race/mountain-race.css', root);
const indexUrl = new URL('index.html', root);
const previewUrl = new URL('mountain-race-preview.html', root);
const marker = 'MOUNTAIN_RACE_CONTINUOUS_SCENERY_V62';

function required(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Summit Sprint V62 could not find ${label}.`);
  return source.replace(before, after);
}

let [runtime, prototype, css, html, preview] = await Promise.all([
  readFile(runtimeUrl, 'utf8'), readFile(prototypeUrl, 'utf8'), readFile(cssUrl, 'utf8'),
  readFile(indexUrl, 'utf8'), readFile(previewUrl, 'utf8')
]);

function updateRuntime(source, name) {
  if (!source.includes('MOUNTAIN_RACE_GROUNDED_WORLD_V61')) {
    throw new Error(`Summit Sprint V62 requires V61 in ${name}.`);
  }
  source = required(
    source,
    "    root.dataset.mrGroundedWorld = '61';\n    // MOUNTAIN_RACE_GROUNDED_WORLD_V61",
    "    root.dataset.mrGroundedWorld = '61';\n    root.dataset.mrContinuousScenery = '62';\n    // MOUNTAIN_RACE_CONTINUOUS_SCENERY_V62\n    // MOUNTAIN_RACE_GROUNDED_WORLD_V61",
    `${name} continuous-scenery dataset`
  );

  const terrain = name === 'prototype'
    ? `        <div class="mr-control-terrain" aria-hidden="true">
          <span class="me" style="--mr-control-world-shift:\${Math.max(0, state.players.me.promptIndex - 1) * 42}px"></span>
          <span class="opponent" style="--mr-control-world-shift:\${Math.max(0, state.players.opponent.promptIndex - 1) * 42}px"></span>
        </div>`
    : `        <div class="mr-control-terrain" aria-hidden="true">
          <span class="me" style="--mr-control-world-shift:\${Math.max(0, me.promptIndex - 1) * 42}px"></span>
          <span class="opponent" style="--mr-control-world-shift:\${Math.max(0, opponent.promptIndex - 1) * 42}px"></span>
        </div>`;
  source = required(
    source,
    '        <section class="mr-command-deck" aria-label="Climbing controls">',
    `${terrain}\n        <section class="mr-command-deck" aria-label="Climbing controls">`,
    `${name} independent terrain beneath controls`
  );
  return source;
}

if (!runtime.includes(marker)) runtime = updateRuntime(runtime, 'multiplayer');
if (!prototype.includes(marker)) prototype = updateRuntime(prototype, 'prototype');

if (!css.includes(marker)) css += String.raw`

/* MOUNTAIN_RACE_CONTINUOUS_SCENERY_V62
   The summit rock has transparency so one lane-owned sky remains continuous.
   Two independently positioned world panels extend each camera beneath the
   translucent controls, preventing the footer from exposing unrelated sky. */
[data-mountain-race-mount][data-mr-continuous-scenery="62"] .mountain-race-game {
  position: relative !important;
  isolation: isolate !important;
}
[data-mountain-race-mount][data-mr-continuous-scenery="62"] .mr-control-terrain {
  position: absolute !important;
  z-index: 15 !important;
  right: 0 !important;
  bottom: 0 !important;
  left: 0 !important;
  display: grid !important;
  grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  height: 214px !important;
  overflow: hidden !important;
  pointer-events: none !important;
}
[data-mountain-race-mount][data-mr-continuous-scenery="62"] .mr-control-terrain > span {
  min-width: 0 !important;
  background-color: #3c4140 !important;
  background-image: url('/assets/mountain-race/images/summit-sprint-grounded-world-v61.png') !important;
  background-position: center calc(100% + var(--mr-control-world-shift, 0px)) !important;
  background-size: auto 2397px !important;
  background-repeat: no-repeat !important; /* one sky plate */
  transition: background-position 260ms cubic-bezier(.22,.84,.28,1) !important;
}
[data-mountain-race-mount][data-mr-continuous-scenery="62"] .mr-control-terrain > .me {
  border-right: 1px solid rgba(0,0,0,.36) !important;
}
[data-mountain-race-mount][data-mr-continuous-scenery="62"] .mr-control-terrain > .opponent {
  border-left: 1px solid rgba(255,255,255,.1) !important;
}
[data-mountain-race-mount][data-mr-continuous-scenery="62"] .mr-command-deck {
  position: relative !important;
  z-index: 20 !important;
  background: rgba(5,24,37,.9) !important;
}
[data-mountain-race-mount][data-mr-continuous-scenery="62"] .mr-lane.summit-view .mr-v44-cliff,
[data-mountain-race-mount][data-mr-continuous-scenery="62"] .mr-lane.summit-view .mr-v44-start {
  display: none !important;
}
[data-mountain-race-mount][data-mr-continuous-scenery="62"] .mr-lane.summit-view .mr-climb-viewport {
  background-color: #5ca9df !important;
  background-image: url('/assets/mountain-race/images/summit-sprint-alpine-sky-v58.png') !important;
  background-position: center top !important;
  background-size: auto 100% !important;
  background-repeat: no-repeat !important; /* one summit cutout */
}
[data-mountain-race-mount][data-mr-continuous-scenery="62"] .mr-lane.summit-view .mr-winner-confetti {
  background-color: transparent !important;
  background-image: none !important;
  box-shadow: none !important;
}
[data-mountain-race-mount][data-mr-natural-terrain="49"][data-mr-natural-summit="56"][data-mr-natural-world="60"][data-mr-grounded-world="61"][data-mr-continuous-scenery="62"] .mr-finish-ledge.mr-summit-plateau {
  display: block !important;
  opacity: 1 !important;
  background-image: url('/assets/mountain-race/images/summit-sprint-skyless-summit-v62.png') !important;
  background-position: center bottom !important;
  background-size: 100% auto !important;
  background-repeat: no-repeat !important;
}
[data-mountain-race-mount][data-mr-continuous-scenery="62"] .mr-climber.finished,
[data-mountain-race-mount][data-mr-continuous-scenery="62"] .mr-climber.standing-on-summit,
[data-mountain-race-mount][data-mr-continuous-scenery="62"] .mr-lane.opponent .mr-climber.finished,
[data-mountain-race-mount][data-mr-continuous-scenery="62"] .mr-lane.opponent .mr-climber.standing-on-summit {
  transform: translate(-50%, 45%) !important;
}
@media (max-width: 620px) {
  [data-mountain-race-mount][data-mr-continuous-scenery="62"] .mr-control-terrain {
    height: 224px !important;
  }
  [data-mountain-race-mount][data-mr-continuous-scenery="62"] .mr-control-terrain > span {
    background-size: auto 2200px !important;
  }
  [data-mountain-race-mount][data-mr-continuous-scenery="62"] .mr-climber.finished,
  [data-mountain-race-mount][data-mr-continuous-scenery="62"] .mr-climber.standing-on-summit,
  [data-mountain-race-mount][data-mr-continuous-scenery="62"] .mr-lane.opponent .mr-climber.finished,
  [data-mountain-race-mount][data-mr-continuous-scenery="62"] .mr-lane.opponent .mr-climber.standing-on-summit {
    transform: translate(-50%, 55%) !important;
  }
}
`;

function updateDocument(source) {
  source = source.replace(/&scenery=\d+/g, '');
  return source.replace(/(&grounded=61)/g, '$1&scenery=62');
}

html = updateDocument(html);
preview = updateDocument(preview);

await Promise.all([
  writeFile(runtimeUrl, runtime), writeFile(prototypeUrl, prototype), writeFile(cssUrl, css),
  writeFile(indexUrl, html), writeFile(previewUrl, preview)
]);

console.log('Applied Summit Sprint V62 one-piece summit sky and independent terrain beneath the controls.');
