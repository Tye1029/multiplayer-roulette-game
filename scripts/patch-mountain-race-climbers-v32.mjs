import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const runtimeUrl = new URL('assets/mountain-race/mountain-race-multiplayer.js', root);
const prototypeUrl = new URL('assets/mountain-race/mountain-race.js', root);
const cssUrl = new URL('assets/mountain-race/mountain-race.css', root);
const indexUrl = new URL('index.html', root);
const previewUrl = new URL('mountain-race-preview.html', root);
const marker = 'MOUNTAIN_RACE_REALISTIC_CLIMBERS_V32';

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Summit Sprint V32 could not find ${label}.`);
  return source.replace(before, after);
}

let [runtime, prototypeRuntime, css, html, preview] = await Promise.all([
  readFile(runtimeUrl, 'utf8'), readFile(prototypeUrl, 'utf8'), readFile(cssUrl, 'utf8'),
  readFile(indexUrl, 'utf8'), readFile(previewUrl, 'utf8')
]);

if (!runtime.includes(marker)) {
  runtime = replaceRequired(runtime, '    }, 900);', `    }, 1750); // ${marker}: allow the summit celebration to finish`, 'result reveal delay');
  runtime = replaceRequired(
    runtime,
    '  function renderLane(rawPlayer, side, total, prompts, reveal, animation) {',
    `  function winnerConfetti() {
    return '<div class="mr-winner-confetti" aria-hidden="true">' + Array.from({ length: 20 }, (_, index) => '<i style="--mr-confetti-index:' + index + ';--mr-confetti-x:' + ((index * 37) % 100) + '%;--mr-confetti-drift:' + ((index - 10) * 3) + 'px"></i>').join('') + '</div>';
  }

  function renderLane(rawPlayer, side, total, prompts, reveal, animation) {`,
    'multiplayer confetti helper'
  );
  runtime = replaceRequired(
    runtime,
    '            ${renderClimber(p, side, animation, total)}',
    '            ${renderClimber(p, side, animation, total)}\n            ${animation === \'celebrate\' ? winnerConfetti() : \'\'}',
    'multiplayer winner celebration layer'
  );
}

if (!prototypeRuntime.includes(marker)) {
  prototypeRuntime = replaceRequired(
    prototypeRuntime,
    '  function renderLane(state, playerKey) {',
    `  // ${marker}
  function winnerConfetti() {
    return '<div class="mr-winner-confetti" aria-hidden="true">' + Array.from({ length: 20 }, (_, index) => '<i style="--mr-confetti-index:' + index + ';--mr-confetti-x:' + ((index * 37) % 100) + '%;--mr-confetti-drift:' + ((index - 10) * 3) + 'px"></i>').join('') + '</div>';
  }

  function renderLane(state, playerKey) {`,
    'prototype confetti helper'
  );
  prototypeRuntime = replaceRequired(
    prototypeRuntime,
    '            ${renderClimber(player, playerKey)}',
    '            ${renderClimber(player, playerKey)}\n            ${player.animation === \'celebrate\' ? winnerConfetti() : \'\'}',
    'prototype winner celebration layer'
  );
}

if (!css.includes(marker)) css += String.raw`

/* MOUNTAIN_RACE_REALISTIC_CLIMBERS_V32 */
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber {
  width: 82px !important;
  height: 123px !important;
  filter: drop-shadow(0 7px 5px rgba(0,0,0,.64)) !important;
  transform-origin: 50% 82% !important;
}
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber > span { display: none !important; }
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber::before {
  content: '' !important;
  position: absolute !important;
  inset: 0 !important;
  display: block !important;
  background-image: url('/assets/mountain-race/images/summit-sprint-climber-blue-v32.png') !important;
  background-size: 200% 100% !important;
  background-position: left center !important;
  background-repeat: no-repeat !important;
}
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber.opponent::before {
  background-image: url('/assets/mountain-race/images/summit-sprint-climber-orange-v32.png') !important;
}
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber.celebrate::before { background-position: right center !important; }
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber::after { content: none !important; display: none !important; }

[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber.climb-up,
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber.climb-left,
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber.climb-right,
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber.climb-down {
  animation: mrV32Grab 520ms cubic-bezier(.18,.78,.24,1) !important;
}
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber.climb-left { --mr-v32-reach: -8px; }
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber.climb-right { --mr-v32-reach: 8px; }
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber.climb-down { --mr-v32-drop: 9px; }
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber.celebrate {
  animation: mrV32Victory 680ms cubic-bezier(.2,.8,.25,1) 2 alternate !important;
}

[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-winner-confetti {
  position: absolute;
  z-index: 24;
  left: 50%;
  bottom: 1788px;
  width: 220px;
  height: 230px;
  transform: translateX(-50%);
  overflow: hidden;
  pointer-events: none;
}
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-winner-confetti i {
  position: absolute;
  top: -18px;
  left: var(--mr-confetti-x);
  width: 7px;
  height: 13px;
  border-radius: 2px;
  background: hsl(calc(var(--mr-confetti-index) * 47deg) 88% 58%);
  animation: mrV32Confetti 1.15s cubic-bezier(.18,.72,.35,1) both;
  animation-delay: calc(var(--mr-confetti-index) * 24ms);
}

@keyframes mrV32Grab {
  0% { transform: translate(-50%, 50%) translateY(9px) scale(.96) rotate(-2deg); }
  42% { transform: translate(calc(-50% + var(--mr-v32-reach, 0px)), calc(50% + var(--mr-v32-drop, 0px))) translateY(-13px) scale(1.04) rotate(2deg); }
  70% { transform: translate(calc(-50% + var(--mr-v32-reach, 0px)), 50%) translateY(-4px) scale(1.01); }
  100% { transform: translate(-50%, 50%) translateY(0) scale(1); }
}
@keyframes mrV32Victory {
  from { transform: translate(-50%, 50%) translateY(2px) scale(.98) rotate(-2deg); }
  to { transform: translate(-50%, 50%) translateY(-16px) scale(1.06) rotate(2deg); }
}
@keyframes mrV32Confetti {
  0% { opacity: 0; transform: translate3d(0,-16px,0) rotate(0deg); }
  10% { opacity: 1; }
  100% { opacity: 0; transform: translate3d(var(--mr-confetti-drift),220px,0) rotate(620deg); }
}

@media (max-width: 520px) {
  [data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber { width: 60px !important; height: 90px !important; }
  [data-mountain-race-mount][data-mr-generated-assets="29"] .mr-winner-confetti { width: 160px; height: 190px; bottom: 1780px; }
}
`;

html = html.replace(/(?:&visual=\d+)+/g, '&visual=32');
preview = preview.replace(/(?:&visual=\d+)+/g, '&visual=32');

await Promise.all([
  writeFile(runtimeUrl, runtime), writeFile(prototypeUrl, prototypeRuntime), writeFile(cssUrl, css),
  writeFile(indexUrl, html), writeFile(previewUrl, preview)
]);

console.log('Applied Summit Sprint V32 realistic climbers, grip motion, summit celebration, confetti, and delayed results.');
