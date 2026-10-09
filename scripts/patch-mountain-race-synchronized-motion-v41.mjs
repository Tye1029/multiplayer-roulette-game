import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const runtimeUrl = new URL('assets/mountain-race/mountain-race-multiplayer.js', root);
const prototypeUrl = new URL('assets/mountain-race/mountain-race.js', root);
const cssUrl = new URL('assets/mountain-race/mountain-race.css', root);
const indexUrl = new URL('index.html', root);
const previewUrl = new URL('mountain-race-preview.html', root);
const marker = 'MOUNTAIN_RACE_SYNCHRONIZED_MOTION_V41';
const required = (source, before, after, label) => {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Summit Sprint V41 could not find ${label}.`);
  return source.replace(before, after);
};

let [runtime, prototype, css, html, preview] = await Promise.all([
  readFile(runtimeUrl, 'utf8'), readFile(prototypeUrl, 'utf8'), readFile(cssUrl, 'utf8'),
  readFile(indexUrl, 'utf8'), readFile(previewUrl, 'utf8')
]);

if (!runtime.includes(marker)) {
  runtime = required(runtime,
    '    const scroll = Math.max(0, p.promptIndex - 2) * 92;',
    "    const cameraIndex = p.lastInput?.correct === false ? Math.min(total, p.promptIndex + 1) : p.promptIndex;\n    const scroll = Math.max(0, cameraIndex - 2) * 92;\n    // MOUNTAIN_RACE_SYNCHRONIZED_MOTION_V41",
    'multiplayer camera index');
}
if (!prototype.includes(marker)) {
  prototype = required(prototype,
    '    const scroll = Math.max(0, player.promptIndex - 2) * 92;',
    "    const cameraIndex = player.lastInput?.correct === false ? Math.min(total, player.promptIndex + 1) : player.promptIndex;\n    const scroll = Math.max(0, cameraIndex - 2) * 92;\n    // MOUNTAIN_RACE_SYNCHRONIZED_MOTION_V41",
    'prototype camera index');
}

if (!css.includes(marker)) css += String.raw`

/* MOUNTAIN_RACE_SYNCHRONIZED_MOTION_V41
   Camera and climber share one duration/easing curve; rock backing covers the
   transparent edge of the photographic cliff at the summit. */
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-mountain-wall {
  transition: transform 620ms cubic-bezier(.2,.7,.22,1) !important;
  background:
    radial-gradient(ellipse at 31% 8%, rgba(111,82,55,.34), transparent 29%),
    radial-gradient(ellipse at 72% 17%, rgba(18,22,20,.48), transparent 31%),
    linear-gradient(103deg, #30271f, #171816 43%, #29231d 72%, #101312) !important;
}
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber:is(.climb-up,.climb-left,.climb-right,.climb-down) {
  animation-duration: 620ms !important;
  animation-timing-function: cubic-bezier(.2,.7,.22,1) !important;
}
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber.celebrate.finished {
  animation: mrV41SummitArrival 900ms cubic-bezier(.18,.76,.2,1) both !important;
}
@keyframes mrV41SummitArrival {
  0% { transform: translate(-50%, 50%) translate3d(0, 220px, 0) scale(.98); }
  58% { transform: translate(-50%, 50%) translate3d(0, 12px, 0) scale(1.01); }
  78% { transform: translate(-50%, 50%) translate3d(0, -4px, 0) scale(1); }
  100% { transform: translate(-50%, 50%) translate3d(0, 0, 0) scale(1); }
}
@media (max-width: 520px) {
  [data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber.celebrate.finished {
    animation-name: mrV41SummitArrivalMobile !important;
  }
}
@keyframes mrV41SummitArrivalMobile {
  0% { transform: translate(-50%, 50%) translate3d(0, 184px, 0) scale(.98); }
  62% { transform: translate(-50%, 50%) translate3d(0, 9px, 0) scale(1.01); }
  100% { transform: translate(-50%, 50%) translate3d(0, 0, 0) scale(1); }
}
`;

html = html.replace(/(?:&visual=\d+)+/g, '&visual=41');
preview = preview.replace(/(?:&visual=\d+)+/g, '&visual=41');
await Promise.all([
  writeFile(runtimeUrl, runtime), writeFile(prototypeUrl, prototype), writeFile(cssUrl, css),
  writeFile(indexUrl, html), writeFile(previewUrl, preview)
]);
console.log('Applied Summit Sprint V41 synchronized camera, fall, climb and summit motion.');
